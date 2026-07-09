import Link from "next/link";
import { notFound } from "next/navigation";
import DeleteTripButton from "@/components/DeleteTripButton";
import PhotoGallery from "@/components/PhotoGallery";
import { getTrip } from "@/lib/db";
import { formatDateRange, formatDuration, tripStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const trip = Number.isInteger(id) ? await getTrip(id) : undefined;
  if (!trip) notFound();

  const status = tripStatus(trip);

  return (
    <div>
      <div className="mb-2">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← All trips
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">{trip.name}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            📍 {trip.location}
            {trip.lat != null && trip.lng != null && (
              <span className="text-xs text-zinc-400 ml-2 font-mono">
                {trip.lat.toFixed(3)}, {trip.lng.toFixed(3)}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/trips/${trip.id}/edit`}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Edit
          </Link>
          <DeleteTripButton tripId={trip.id} />
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Dates</dt>
          <dd className="font-medium text-sm">{formatDateRange(trip)}</dd>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Duration</dt>
          <dd className="font-medium text-sm">{formatDuration(trip)}</dd>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <dt className="text-xs uppercase tracking-wide text-zinc-400 mb-1">Status</dt>
          <dd className="font-medium text-sm capitalize">{status}</dd>
        </div>
      </dl>

      {trip.notes && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{trip.notes}</p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Photos</h2>
        <PhotoGallery tripId={trip.id} />
      </section>
    </div>
  );
}
