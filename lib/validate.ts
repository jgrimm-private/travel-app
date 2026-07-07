import type { TripInput } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a normalized TripInput, or an error message string. */
export function validateTripInput(body: unknown): TripInput | string {
  const b = body as Record<string, unknown>;
  if (typeof b?.name !== "string" || b.name.trim() === "") return "name is required";
  if (typeof b?.location !== "string" || b.location.trim() === "") return "location is required";
  if (typeof b?.start_date !== "string" || !DATE_RE.test(b.start_date))
    return "start_date must be YYYY-MM-DD";
  if (typeof b?.end_date !== "string" || !DATE_RE.test(b.end_date))
    return "end_date must be YYYY-MM-DD";
  if (b.end_date < b.start_date) return "end_date must not be before start_date";
  if (b.notes !== undefined && typeof b.notes !== "string") return "notes must be a string";
  return {
    name: b.name.trim(),
    location: b.location.trim(),
    start_date: b.start_date,
    end_date: b.end_date,
    notes: (b.notes as string | undefined)?.trim() ?? "",
  };
}
