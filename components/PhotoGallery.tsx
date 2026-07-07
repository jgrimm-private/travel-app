"use client";

import { useEffect, useState } from "react";
import type { MatchedPhoto } from "@/lib/types";

interface PhotosResponse {
  configured: boolean;
  photos: MatchedPhoto[];
  error?: string;
}

export default function PhotoGallery({ tripId }: { tripId: number }) {
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState<MatchedPhoto | null>(null);

  useEffect(() => {
    fetch(`/api/trips/${tripId}/photos`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setFailed(true));
  }, [tripId]);

  if (failed) {
    return <p className="text-sm text-red-600 dark:text-red-400">Couldn’t load photos.</p>;
  }
  if (!data) {
    return <p className="text-sm text-zinc-400 animate-pulse">Looking for photos in Dropbox…</p>;
  }
  if (!data.configured) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-5 text-sm text-zinc-500 dark:text-zinc-400">
        <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          📷 Connect Dropbox to see photos from this trip
        </p>
        <p>
          Photos taken during these dates (and near this location) will show up here
          automatically.{" "}
          <a href="/settings" className="underline">
            Connect Dropbox in Settings
          </a>{" "}
          — it&apos;s a one-time setup.
        </p>
      </div>
    );
  }
  if (data.error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">Dropbox error: {data.error}</p>
    );
  }
  if (data.photos.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No photos found in Dropbox for these dates.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
        {data.photos.length} photo{data.photos.length === 1 ? "" : "s"} matched from Dropbox
      </p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {data.photos.map((photo) => (
          <li key={photo.path}>
            <button
              type="button"
              onClick={() => setLightbox(photo)}
              className="block w-full aspect-square overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              title={`${photo.name} — ${photo.matched_by === "date+location" ? "matched by date and GPS" : "matched by date"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/thumbnail?path=${encodeURIComponent(photo.path)}`}
                alt={photo.name}
                loading="lazy"
                className="h-full w-full object-cover hover:scale-105 transition-transform"
              />
            </button>
          </li>
        ))}
      </ul>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label={lightbox.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/thumbnail?path=${encodeURIComponent(lightbox.path)}&size=large`}
            alt={lightbox.name}
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
