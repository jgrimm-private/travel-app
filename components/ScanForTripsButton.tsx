"use client";

import Link from "next/link";
import { useState } from "react";
import type { DiscoverResult } from "@/lib/discover";

export default function ScanForTripsButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Scan failed");
      setResult(body as DiscoverResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleScan}
        disabled={busy}
        className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        {busy ? "Scanning Dropbox…" : "🔎 Scan Dropbox for new trips"}
      </button>
      <p className="mt-2 text-xs text-zinc-400">
        Looks through every photo in Dropbox and creates a trip for each group taken away from
        home ({" "}
        <span className="whitespace-nowrap">Westerville, OH</span> /{" "}
        <span className="whitespace-nowrap">Charlotte, NC</span>, 100mi radius). Screenshots and
        photos with no reliable date are skipped automatically. Dropbox only exposes each photo's
        real date/GPS one file at a time, so for a few thousand photos this is deliberately slow
        (~10&ndash;20 minutes) to stay well under Dropbox&apos;s rate limit &mdash; leave this tab
        open and let it finish.
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-3 text-sm">
          {result.created.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">
              No new trips found ({result.stats.clustersFound} candidate group
              {result.stats.clustersFound === 1 ? "" : "s"} matched an existing trip or didn&apos;t
              have enough photos).
            </p>
          ) : (
            <>
              <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                Created {result.created.length} new trip{result.created.length === 1 ? "" : "s"}:
              </p>
              <ul className="list-disc ml-4 space-y-0.5">
                {result.created.map((trip) => (
                  <li key={trip.id}>
                    <Link href={`/trips/${trip.id}`} className="underline">
                      {trip.name}
                    </Link>{" "}
                    <span className="text-zinc-400">
                      ({trip.start_date} – {trip.end_date})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            Scanned {result.stats.scanned} photos · {result.stats.skippedHome} near home ·{" "}
            {result.stats.skippedScreenshot} screenshots · {result.stats.skippedNoReliableDate} no
            reliable date · {result.stats.skippedNoGps} no GPS
          </p>
        </div>
      )}
    </div>
  );
}
