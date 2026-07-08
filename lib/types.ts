export interface Trip {
  id: number;
  name: string;
  location: string;
  lat: number | null;
  lng: number | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  notes: string;
  created_at: string;
}

export interface TripInput {
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  notes?: string;
}

export type PhotoMatchReason = "date+location" | "date";

export interface MatchedPhoto {
  path: string;
  name: string;
  taken_at: string;
  lat: number | null;
  lng: number | null;
  matched_by: PhotoMatchReason;
}

export interface TripPhotoResults {
  /** Matched by a real EXIF/capture date (and GPS radius, when available). */
  confirmed: MatchedPhoto[];
  /** Date fell in range, but only via Dropbox's file-modified timestamp —
   * not a real capture date, so shown separately instead of auto-included. */
  maybe: MatchedPhoto[];
  /** Matched the date range but look like screenshots/saved images; hidden
   * by default, restorable via the photo overrides API. */
  hiddenScreenshots: MatchedPhoto[];
}

export function tripDurationDays(trip: Pick<Trip, "start_date" | "end_date">): number {
  const start = new Date(trip.start_date + "T00:00:00Z").getTime();
  const end = new Date(trip.end_date + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}
