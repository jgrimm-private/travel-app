import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteTripButton from "@/components/DeleteTripButton";
import PhotoGallery from "@/components/PhotoGallery";
import { getTrip } from "@/lib/db";
import { formatDateRange, formatDuration, tripStatus } from "@/lib/format";
import { cardGradientClass } from "@/lib/theme";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-white/90 dark:bg-zinc-950/80 text-sky-700 dark:text-sky-300",
  ongoing: "bg-white/90 dark:bg-zinc-950/80 text-emerald-700 dark:text-emerald-300",
  past: "bg-white/80 dark:bg-zinc-950/70 text-zinc-500 dark:text-zinc-400",
};

const STAT_TILES = [
  { label: "Dates", icon: "📅" },
  { label: "Duration", icon: "⏱️" },
  { label: "Status", icon: "🧭" },
] as const;

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const trip = Number.isInteger(id) ? await getTrip(id) : undefined;
  if (!trip) notFound();

  const status = tripStatus(trip);
  const stats = [formatDateRange(trip), formatDuration(trip), status];

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-4 transition-colors"
      >
        ← All trips
      </Link>

      <div className={`relative rounded-2xl overflow-hidden mb-6 ${cardGradientClass(trip.location)}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="relative px-6 py-10 sm:px-8 sm:py-12">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm mb-3 ${STATUS_STYLES[status]}`}
          >
            {status === "ongoing" && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {status}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-sm mb-2">
            {trip.name}
          </h1>
          <p className="text-white/90 flex items-center gap-1.5 flex-wrap">
            📍 {trip.location}
            {trip.lat != null && trip.lng != null && (
              <span className="text-xs text-white/60 font-mono">
                {trip.lat.toFixed(3)}, {trip.lng.toFixed(3)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-8">
        <Link
          href={`/trips/${trip.id}/edit`}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Edit
        </Link>
        <DeleteTripButton tripId={trip.id} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        {STAT_TILES.map((tile, i) => (
          <div
            key={tile.label}
            className="rounded-2xl border border-zinc-900/5 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-4"
          >
            <dt className="text-xs uppercase tracking-wide text-zinc-400 mb-1 flex items-center gap-1.5">
              <span>{tile.icon}</span> {tile.label}
            </dt>
            <dd className="font-semibold text-sm capitalize">{stats[i]}</dd>
          </div>
        ))}
      </dl>

      {trip.notes && (
        <section className="mb-8 rounded-2xl border border-zinc-900/5 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm p-5">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-1.5">📝 Notes</h2>
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{trip.notes}</p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-1.5">📷 Photos</h2>
        <PhotoGallery tripId={trip.id} />
      </section>
    </div>
  );
}
