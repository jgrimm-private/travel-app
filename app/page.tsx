import Link from "next/link";
import { listTrips } from "@/lib/db";
import { formatDateRange, formatDuration, tripStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  ongoing: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  past: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function HomePage() {
  const trips = await listTrips();

  if (trips.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-5xl mb-4">🌍</p>
        <h1 className="text-xl font-semibold mb-2">Misty and Jon&apos;s Adventures!</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
          No trips yet — add your first trip and start building your travel history.
        </p>
        <Link
          href="/trips/new"
          className="inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 font-medium hover:opacity-85 transition-opacity"
        >
          Add a trip
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        Misty and Jon&apos;s Adventures!{" "}
        <span className="text-zinc-400 text-lg font-normal">({trips.length})</span>
      </h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {trips.map((trip) => {
          const status = tripStatus(trip);
          return (
            <li key={trip.id}>
              <Link
                href={`/trips/${trip.id}`}
                className="block rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="font-semibold text-lg leading-tight">{trip.name}</h2>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-3">
                  📍 {trip.location}
                </p>
                <p className="text-sm">
                  {formatDateRange(trip)}
                  <span className="text-zinc-400"> · {formatDuration(trip)}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
