// Groups near-duplicate photos: e.g. you and a travel partner both taking a
// shot of the same moment on separate phones. Cheap heuristic on metadata
// already fetched (capture time + GPS) rather than comparing actual image
// content — catches the common "standing next to each other" case without
// downloading/analyzing every photo.

import { haversineKm } from "./geo";
import type { MatchedPhoto } from "./types";

const WINDOW_SECONDS = Number(process.env.PHOTO_DUPLICATE_WINDOW_SECONDS ?? "15");
const RADIUS_METERS = Number(process.env.PHOTO_DUPLICATE_RADIUS_METERS ?? "50");

function isNearDuplicate(a: MatchedPhoto, b: MatchedPhoto): boolean {
  const secondsApart = Math.abs(Date.parse(b.taken_at) - Date.parse(a.taken_at)) / 1000;
  if (secondsApart > WINDOW_SECONDS) return false;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000 <= RADIUS_METERS;
  }
  // No GPS to confirm location on one or both — time proximity alone still
  // catches the common case, just with a smidge more false-positive risk.
  return true;
}

/**
 * Collapses near-duplicate photos into a single representative entry with
 * the rest attached as `duplicates`. Input must already be sorted by
 * taken_at — duplicates are always adjacent once sorted, so each new photo
 * only needs comparing against the current group's representative (the
 * first photo added to it), not every prior photo.
 */
export function groupNearDuplicates(photos: MatchedPhoto[]): MatchedPhoto[] {
  const result: MatchedPhoto[] = [];
  for (const photo of photos) {
    const representative = result[result.length - 1];
    if (representative && isNearDuplicate(representative, photo)) {
      (representative.duplicates ??= []).push(photo);
    } else {
      result.push({ ...photo });
    }
  }
  return result;
}
