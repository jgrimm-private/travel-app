// Scans the whole Dropbox library, groups photos taken away from home into
// trip-shaped clusters, and creates a Trip for each one that isn't already
// tracked. Meant to be run on demand (e.g. a "Scan for new trips" button),
// not on every page load — it walks every photo in the account.

import { createTrip, getPhotoOverrides, listTrips } from "./db";
import { fetchMediaInfo, listAllPhotoEntries } from "./dropbox";
import { reverseGeocode } from "./geocode";
import { isNearHome } from "./home-zones";
import { isLikelyScreenshot } from "./photo-filters";
import type { Trip } from "./types";

// A gap of this many days with no away-from-home photos ends one trip and
// starts looking for the next.
const GAP_DAYS = Number(process.env.TRIP_DISCOVERY_GAP_DAYS ?? "4");
// Fewer photos than this and it's treated as a one-off outing, not a trip.
const MIN_PHOTOS = Number(process.env.TRIP_DISCOVERY_MIN_PHOTOS ?? "3");
// Nominatim's usage policy asks for ~1 request/second.
const REVERSE_GEOCODE_DELAY_MS = 1100;

interface Candidate {
  path: string;
  name: string;
  takenAt: string;
  lat: number;
  lng: number;
}

interface Cluster {
  photos: Candidate[];
  start_date: string;
  end_date: string;
  representative: { lat: number; lng: number };
}

export interface DiscoverStats {
  scanned: number;
  skippedNoReliableDate: number;
  skippedNoGps: number;
  skippedHome: number;
  skippedScreenshot: number;
  skippedIgnored: number;
  clustersFound: number;
  skippedTooFewPhotos: number;
  skippedDuplicate: number;
}

export interface DiscoverResult {
  created: Trip[];
  stats: DiscoverStats;
}

function dayGapBetween(aIso: string, bIso: string): number {
  return Math.abs(Date.parse(bIso) - Date.parse(aIso)) / 86_400_000;
}

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

function overlapsExistingTrip(cluster: Cluster, trips: Trip[]): boolean {
  return trips.some(
    (t) => !(cluster.end_date < t.start_date || cluster.start_date > t.end_date)
  );
}

function buildClusters(candidates: Candidate[]): Cluster[] {
  const sorted = [...candidates].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const clusters: Candidate[][] = [];
  for (const photo of sorted) {
    const current = clusters[clusters.length - 1];
    if (current && dayGapBetween(current[current.length - 1].takenAt, photo.takenAt) <= GAP_DAYS) {
      current.push(photo);
    } else {
      clusters.push([photo]);
    }
  }
  return clusters.map((photos) => {
    const mid = photos[Math.floor(photos.length / 2)];
    return {
      photos,
      start_date: datePart(photos[0].takenAt),
      end_date: datePart(photos[photos.length - 1].takenAt),
      representative: { lat: mid.lat, lng: mid.lng },
    };
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverTrips(): Promise<DiscoverResult> {
  const entries = await listAllPhotoEntries();
  const overrides = await getPhotoOverrides();
  const existingTrips = await listTrips();

  const stats: DiscoverStats = {
    scanned: entries.length,
    skippedNoReliableDate: 0,
    skippedNoGps: 0,
    skippedHome: 0,
    skippedScreenshot: 0,
    skippedIgnored: 0,
    clustersFound: 0,
    skippedTooFewPhotos: 0,
    skippedDuplicate: 0,
  };

  // Full-library scan: fetch real metadata for every entry (list_folder's
  // include_media_info flag doesn't work — see listAllPhotoEntries in
  // lib/dropbox.ts). This is one HTTP call per photo, so it's slow (a few
  // minutes for a few thousand photos) but only runs when the user asks for
  // a scan, not on every page load.
  const mediaInfo = await fetchMediaInfo(entries);

  const candidates: Candidate[] = [];
  for (const entry of entries) {
    const override = overrides.get(entry.path_lower);
    if (override === "ignored") {
      stats.skippedIgnored++;
      continue;
    }

    const meta = mediaInfo.get(entry.path_lower);
    // Only a real capture-time EXIF value is trustworthy enough to place a
    // photo on a specific trip; Dropbox's client_modified reflects when the
    // file was saved/synced, which is exactly what caused unrelated photos
    // (e.g. house-hunting screenshots saved during an unrelated trip's date
    // range) to get mixed into a trip before.
    const takenAt = meta?.time_taken;
    if (!takenAt) {
      stats.skippedNoReliableDate++;
      continue;
    }

    const gps = meta?.location;
    if (!gps) {
      stats.skippedNoGps++;
      continue;
    }

    if (override !== "included" && isLikelyScreenshot({ name: entry.name, hasMediaInfo: !!meta })) {
      stats.skippedScreenshot++;
      continue;
    }

    if (isNearHome(gps.latitude, gps.longitude)) {
      stats.skippedHome++;
      continue;
    }

    candidates.push({
      path: entry.path_lower,
      name: entry.name,
      takenAt,
      lat: gps.latitude,
      lng: gps.longitude,
    });
  }

  const allClusters = buildClusters(candidates);
  const clusters = allClusters.filter((c) => {
    if (c.photos.length < MIN_PHOTOS) {
      stats.skippedTooFewPhotos++;
      return false;
    }
    return true;
  });
  stats.clustersFound = clusters.length;

  const created: Trip[] = [];
  for (const cluster of clusters) {
    if (overlapsExistingTrip(cluster, [...existingTrips, ...created])) {
      stats.skippedDuplicate++;
      continue;
    }

    if (created.length > 0) await sleep(REVERSE_GEOCODE_DELAY_MS);
    const place = await reverseGeocode(cluster.representative.lat, cluster.representative.lng);
    const label = place?.label ?? `${cluster.representative.lat.toFixed(2)}, ${cluster.representative.lng.toFixed(2)}`;

    const trip = await createTrip(
      {
        name: `${label} Trip`,
        location: label,
        start_date: cluster.start_date,
        end_date: cluster.end_date,
        notes: `Auto-discovered from ${cluster.photos.length} Dropbox photos.`,
      },
      cluster.representative
    );
    created.push(trip);
  }

  return { created, stats };
}
