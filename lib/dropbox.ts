// Dropbox integration: lists photos and matches them to a trip by the date
// they were taken and (when EXIF GPS data exists) how close they are to the
// trip's location.
//
// Setup: create a Dropbox app at https://www.dropbox.com/developers/apps with
// the files.metadata.read and files.content.read scopes, set DROPBOX_APP_KEY
// in .env.local, and click "Connect Dropbox" in the app's Settings page.

import { dropboxConnected, getAccessToken } from "./dropbox-auth";
import type { MatchedPhoto, Trip } from "./types";

// Overridable so tests can point at a mock server.
const API_BASE = process.env.DROPBOX_API_BASE ?? "https://api.dropboxapi.com/2";
const CONTENT_BASE = process.env.DROPBOX_CONTENT_BASE ?? "https://content.dropboxapi.com/2";

// Folder to scan for photos ("" = entire Dropbox). Camera uploads live in
// "/Camera Uploads" by default.
const PHOTOS_PATH = process.env.DROPBOX_PHOTOS_PATH ?? "";
const MATCH_RADIUS_KM = Number(process.env.PHOTO_MATCH_RADIUS_KM ?? "100");
const MAX_ENTRIES = 10_000;

export function dropboxConfigured(): boolean {
  return dropboxConnected();
}

interface DropboxFileEntry {
  ".tag": string;
  name: string;
  path_lower: string;
  client_modified?: string;
  media_info?: {
    ".tag": string;
    metadata?: {
      ".tag": string;
      time_taken?: string;
      location?: { latitude: number; longitude: number };
    };
  };
}

async function dropboxRpc<T>(endpoint: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Dropbox ${endpoint} failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface ListFolderResponse {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
}

async function listAllPhotoEntries(): Promise<DropboxFileEntry[]> {
  const entries: DropboxFileEntry[] = [];
  let page = await dropboxRpc<ListFolderResponse>("/files/list_folder", {
    path: PHOTOS_PATH,
    recursive: true,
    include_media_info: true,
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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Photos match a trip when they were taken within the trip's date range.
 * If both the photo and the trip have coordinates, the photo must also fall
 * within MATCH_RADIUS_KM of the trip location; photos without GPS data are
 * kept as date-only matches.
 */
export async function findTripPhotos(trip: Trip): Promise<MatchedPhoto[]> {
  const entries = await listAllPhotoEntries();
  const rangeStart = `${trip.start_date}T00:00:00`;
  const rangeEnd = `${trip.end_date}T23:59:59`;

  const matches: MatchedPhoto[] = [];
  for (const entry of entries) {
    const meta = entry.media_info?.metadata;
    const takenAt = meta?.time_taken ?? entry.client_modified;
    if (!takenAt) continue;
    const taken = takenAt.replace(/Z$/, "");
    if (taken < rangeStart || taken > rangeEnd) continue;

    const gps = meta?.location;
    if (gps && trip.lat != null && trip.lng != null) {
      if (haversineKm(gps.latitude, gps.longitude, trip.lat, trip.lng) > MATCH_RADIUS_KM) {
        continue;
      }
      matches.push({
        path: entry.path_lower,
        name: entry.name,
        taken_at: takenAt,
        lat: gps.latitude,
        lng: gps.longitude,
        matched_by: "date+location",
      });
    } else {
      matches.push({
        path: entry.path_lower,
        name: entry.name,
        taken_at: takenAt,
        lat: gps?.latitude ?? null,
        lng: gps?.longitude ?? null,
        matched_by: "date",
      });
    }
  }
  matches.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
  return matches;
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
