import type { Trip } from "./types";
import { tripDurationDays } from "./types";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  return DATE_FMT.format(new Date(isoDate + "T00:00:00Z"));
}

export function formatDateRange(trip: Pick<Trip, "start_date" | "end_date">): string {
  if (trip.start_date === trip.end_date) return formatDate(trip.start_date);
  return `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`;
}

export function formatDuration(trip: Pick<Trip, "start_date" | "end_date">): string {
  const days = tripDurationDays(trip);
  return days === 1 ? "1 day" : `${days} days`;
}

export function tripStatus(trip: Pick<Trip, "start_date" | "end_date">): "upcoming" | "ongoing" | "past" {
  const today = new Date().toISOString().slice(0, 10);
  if (trip.start_date > today) return "upcoming";
  if (trip.end_date < today) return "past";
  return "ongoing";
}
