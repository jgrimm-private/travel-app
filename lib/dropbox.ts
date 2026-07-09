// Dropbox integration: lists photos and matches them to a trip by the date
// they were taken and (when EXIF GPS data exists) how close they are to the
// trip's location.
//
// Setup: create a Dropbox app at https://www.dropbox.com/developers/apps with
// the files.metadata.read and files.content.read scopes, set DROPBOX_APP_KEY
// in .env.local, and click "Connect Dropbox" in the app's Settings page.

import { getPhotoOverrides } from "./db";
import { dropboxConnected, getAccessToken } from "./dropbox-auth";
import { groupNearDuplicates } from "./duplicates";
import { haversineKm } from "./geo";
import { isLikelyScreenshot } from "./photo-filters";
import type { MatchedPhoto, Trip, TripPhotoResults } from "./types";

// Overridable so tests can point at a mock server.
const API_BASE = process.env.DROPBOX_API_BASE ?? "https://api.dropboxapi.com/2";
const CONTENT_BASE = process.env.DROPBOX_CONTENT_BASE ?? "https://content.dropboxapi.com/2";

// Folder to scan for photos ("" = entire Dropbox). Camera uploads live in
// "/Camera Uploads" by default.
const PHOTOS_PATH = process.env.DROPBOX_PHOTOS_PATH ?? "";
const MATCH_RADIUS_KM = Number(process.env.PHOTO_MATCH_RADIUS_KM ?? "100");
const MAX_ENTRIES = 10_000;

export async function dropboxConfigured(): Promise<boolean> {
  return dropboxConnected();
}

export interface DropboxFileEntry {
  ".tag": string;
  name: string;
  path_lower: string;
  client_modified?: string;
}

export interface PhotoMediaInfo {
  time_taken?: string;
  location?: { latitude: number; longitude: number };
}

// Only these formats carry EXIF-style capture metadata; PNG/GIF (screenshots,
// saved images) never do, so skip the API call for them entirely.
const EXIF_CAPABLE_RE = /\.(jpe?g|heic|heif|webp)$/i;

// Dropbox's 429 response puts the real cooldown in the JSON body
// (error.retry_after, in seconds) — the HTTP Retry-After header isn't
// reliably set. Shared across all callers so that one 429 pauses every
// in-flight request instead of each one independently retrying every couple
// of seconds, which is what compounds a single rate-limit hit into a much
// longer account-wide lockout.
let dropboxBlockedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSharedBackoff(): Promise<void> {
  const remaining = dropboxBlockedUntil - Date.now();
  if (remaining > 0) await sleep(remaining);
}

// Floor on time between the *start* of consecutive requests, shared across
// all callers, so total throughput stays well under Dropbox's burst limit
// even before any 429 has happened.
const MIN_REQUEST_INTERVAL_MS = Number(process.env.DROPBOX_MIN_REQUEST_INTERVAL_MS ?? "200");
let nextRequestNotBefore = 0;

async function throttle(): Promise<void> {
  await waitForSharedBackoff();
  const wait = nextRequestNotBefore - Date.now();
  nextRequestNotBefore = Math.max(Date.now(), nextRequestNotBefore) + MIN_REQUEST_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

async function dropboxRpc<T>(endpoint: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    await throttle();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) {
      const errBody = await res.json().catch(() => null);
      const retryAfterSeconds = errBody?.error?.retry_after ?? Number(res.headers.get("Retry-After")) ?? 30;
      dropboxBlockedUntil = Math.max(dropboxBlockedUntil, Date.now() + retryAfterSeconds * 1000);
      if (attempt === 0) {
        await waitForSharedBackoff();
        continue;
      }
      throw new Error(
        `Dropbox is rate-limiting this app — try again in about ${Math.ceil(retryAfterSeconds)}s.`
      );
    }
    if (!res.ok) {
      throw new Error(`Dropbox ${endpoint} failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as T;
  }
  throw new Error("Dropbox request failed");
}

interface ListFolderResponse {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
}

export async function listAllPhotoEntries(): Promise<DropboxFileEntry[]> {
  const entries: DropboxFileEntry[] = [];
  // Note: list_folder's include_media_info flag does not actually populate
  // media_info on these entries (confirmed against the live API — every
  // entry comes back with no media_info field at all, regardless of this
  // flag). Real capture-time/GPS metadata has to be fetched per-file via
  // fetchMediaInfo() below, which uses /files/get_metadata instead.
  let page = await dropboxRpc<ListFolderResponse>("/files/list_folder", {
    path: PHOTOS_PATH,
    recursive: true,
    limit: 2000,
  });
  entries.push(...page.entries);
  while (page.has_more && entries.length < MAX_ENTRIES) {
    page = await dropboxRpc<ListFolderResponse>("/files/list_folder/continue", {
      cursor: page.cursor,
    });
    entries.push(...page.entries);
  }
  return entries.filter(
    (e) => e[".tag"] === "file" && /\.(jpe?g|png|gif|webp|heic)$/i.test(e.name)
  );
}

async function getMediaInfoWithRetry(path: string, token: string): Promise<PhotoMediaInfo | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    const res = await fetch(`${API_BASE}/files/get_metadata`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, include_media_info: true }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => null);
      const retryAfterSeconds = body?.error?.retry_after ?? Number(res.headers.get("Retry-After")) ?? 30;
      dropboxBlockedUntil = Math.max(dropboxBlockedUntil, Date.now() + retryAfterSeconds * 1000);
      await waitForSharedBackoff();
      continue;
    }
    if (!res.ok) return null;
    const body = (await res.json()) as { media_info?: { metadata?: PhotoMediaInfo } };
    return body.media_info?.metadata ?? null;
  }
  return null;
}

// Conservative on purpose: a burst of concurrent get_metadata calls is what
// triggered a 5-minute account-wide Dropbox lockout during testing.
const MEDIA_INFO_CONCURRENCY = Number(process.env.DROPBOX_MEDIA_INFO_CONCURRENCY ?? "4");

/**
 * Fetches real capture-time/GPS metadata for a set of entries via per-file
 * /files/get_metadata calls (list_folder's include_media_info doesn't work —
 * see listAllPhotoEntries). One HTTP call per EXIF-capable file, so callers
 * should narrow the input down first where possible. Deliberately
 * throttled: for a full-library scan of a few thousand photos this can take
 * several minutes, which is expected.
 */
export async function fetchMediaInfo(
  entries: DropboxFileEntry[]
): Promise<Map<string, PhotoMediaInfo>> {
  const result = new Map<string, PhotoMediaInfo>();
  const candidates = entries.filter((e) => EXIF_CAPABLE_RE.test(e.name));
  if (candidates.length === 0) return result;

  const token = await getAccessToken();
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const entry = candidates[cursor++];
      const info = await getMediaInfoWithRetry(entry.path_lower, token);
      if (info) result.set(entry.path_lower, info);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MEDIA_INFO_CONCURRENCY, candidates.length) }, worker)
  );
  return result;
}

// How far outside the trip's own date range to still fetch real metadata for
// a file, based only on its (possibly-off) client_modified timestamp. Wide
// enough to tolerate client_modified drifting from the real capture date by
// a few days without having to fetch metadata for the entire Dropbox library
// on every trip page view.
const CLIENT_MODIFIED_BUFFER_DAYS = 5;

/**
 * Photos match a trip when they were taken within the trip's date range.
 * If both the photo and the trip have coordinates, the photo must also fall
 * within MATCH_RADIUS_KM of the trip location; photos without GPS data are
 * kept as date-only matches.
 *
 * Only a real EXIF/media "time taken" counts as a reliable date. Falling
 * back to Dropbox's client_modified (the file's last-modified timestamp,
 * which reflects when it was saved/synced, not when the photo was taken)
 * produces false matches — e.g. a house-listing photo saved to Dropbox
 * during a trip's date range would otherwise show up in that trip's
 * gallery. Those get returned separately as "maybe" instead of being
 * silently included. Likely screenshots are filtered out entirely unless
 * explicitly restored via a photo override.
 */
export async function findTripPhotos(trip: Trip): Promise<TripPhotoResults> {
  const entries = await listAllPhotoEntries();
  const overrides = await getPhotoOverrides();
  const rangeStart = `${trip.start_date}T00:00:00`;
  const rangeEnd = `${trip.end_date}T23:59:59`;

  const bufferMs = CLIENT_MODIFIED_BUFFER_DAYS * 86_400_000;
  const bufferedStart = Date.parse(rangeStart) - bufferMs;
  const bufferedEnd = Date.parse(rangeEnd) + bufferMs;
  const candidates = entries.filter((e) => {
    if (!e.client_modified) return false;
    const t = Date.parse(e.client_modified);
    return t >= bufferedStart && t <= bufferedEnd;
  });
  const mediaInfo = await fetchMediaInfo(candidates);

  const confirmed: MatchedPhoto[] = [];
  const maybe: MatchedPhoto[] = [];
  const hiddenScreenshots: MatchedPhoto[] = [];

  for (const entry of candidates) {
    const meta = mediaInfo.get(entry.path_lower);
    const reliableTakenAt = meta?.time_taken;
    const takenAt = reliableTakenAt ?? entry.client_modified;
    if (!takenAt) continue;
    const taken = takenAt.replace(/Z$/, "");
    if (taken < rangeStart || taken > rangeEnd) continue;

    const gps = meta?.location;
    const photo: MatchedPhoto = {
      path: entry.path_lower,
      name: entry.name,
      taken_at: takenAt,
      lat: gps?.latitude ?? null,
      lng: gps?.longitude ?? null,
      matched_by:
        gps && trip.lat != null && trip.lng != null ? "date+location" : "date",
    };

    if (
      gps &&
      trip.lat != null &&
      trip.lng != null &&
      haversineKm(gps.latitude, gps.longitude, trip.lat, trip.lng) > MATCH_RADIUS_KM
    ) {
      continue;
    }

    const override = overrides.get(entry.path_lower);
    if (override === "ignored") continue;
    if (override !== "included" && isLikelyScreenshot({ name: entry.name, hasMediaInfo: !!meta })) {
      hiddenScreenshots.push(photo);
      continue;
    }

    if (reliableTakenAt) {
      confirmed.push(photo);
    } else {
      maybe.push(photo);
    }
  }

  confirmed.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  maybe.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  hiddenScreenshots.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  return { confirmed: groupNearDuplicates(confirmed), maybe, hiddenScreenshots };
}

/** Fetch a JPEG thumbnail for a Dropbox file. */
export async function getThumbnail(
  path: string,
  size: "w640h480" | "w2048h1536" = "w640h480"
): Promise<ArrayBuffer> {
  const token = await getAccessToken();
  const res = await fetch(`${CONTENT_BASE}/files/get_thumbnail_v2`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({
        resource: { ".tag": "path", path },
        format: { ".tag": "jpeg" },
        size: { ".tag": size },
      }),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Dropbox thumbnail failed (${res.status}): ${await res.text()}`);
  }
  return res.arrayBuffer();
}
