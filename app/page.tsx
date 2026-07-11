import Link from "next/link";
import { listTrips } from "@/lib/db";
import { formatDateRange, formatDuration, tripStatus } from "@/lib/format";
import { cardGradientClass } from "@/lib/theme";
import { tripDurationDays, type Trip } from "@/lib/types";

export const dynamic = "force-dynamic";

// "past" has no badge at all — obvious from the dates, no need to say it.
const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-white/90 dark:bg-zinc-950/80 text-sky-700 dark:text-sky-300",
  ongoing: "bg-white/90 dark:bg-zinc-950/80 text-emerald-700 dark:text-emerald-300",
};

export default async function HomePage() {
  const trips = await listTrips();

  if (trips.length === 0) {
    return (
      <div className="text-center py-24">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 via-rose-500/20 to-violet-500/20">
          <span className="text-5xl">🌍</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          <span className="gradient-text">Misty &amp; Jon&apos;s Adventures</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
          No trips yet — add your first trip and start building your travel history.
        </p>
        <Link
          href="/trips/new"
          className="inline-block rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500 text-white px-5 py-2.5 font-medium shadow-sm shadow-rose-500/30 hover:shadow-md hover:shadow-rose-500/40 hover:brightness-105 transition-all"
        >
          Add a trip
        </Link>
      </div>
    );
  }

  const totalDays = trips.reduce((sum, trip) => sum + tripDurationDays(trip), 0);

  const tripsByYear = new Map<string, Trip[]>();
  for (const trip of trips) {
    const year = trip.start_date.slice(0, 4);
    if (!tripsByYear.has(year)) tripsByYear.set(year, []);
    tripsByYear.get(year)!.push(trip);
  }

  return (
    <div>
      <section className="mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          <span className="gradient-text">Misty &amp; Jon&apos;s Adventures</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">
          {trips.length} trip{trips.length === 1 ? "" : "s"} · {totalDays} day
          {totalDays === 1 ? "" : "s"} on the road
        </p>
      </section>

      {[...tripsByYear.entries()].map(([year, yearTrips]) => (
        <section key={year} className="mb-12 last:mb-0">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="text-3xl font-bold tracking-tight">{year}</h2>
            <span className="text-sm text-zinc-400 dark:text-zinc-500 shrink-0">
              {yearTrips.length} trip{yearTrips.length === 1 ? "" : "s"}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-zinc-300 dark:from-zinc-700 to-transparent" />
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {yearTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const status = tripStatus(trip);
  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        className="group block rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-900/5 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-zinc-900/10 dark:hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className={`relative h-24 ${cardGradientClass(trip.location)}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          {status !== "past" && (
            <span
              className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm flex items-center gap-1 ${STATUS_STYLES[status]}`}
            >
              {status === "ongoing" && (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {status}
            </span>
          )}
          <h2 className="absolute bottom-2.5 left-4 right-4 font-semibold text-lg leading-tight text-white drop-shadow-sm truncate">
            {trip.name}
          </h2>
        </div>
        <div className="p-4">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2 flex items-center gap-1 truncate">
            <span>📍</span> {trip.location}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {formatDateRange(trip)}
            <span className="text-zinc-400 dark:text-zinc-500"> · {formatDuration(trip)}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}
