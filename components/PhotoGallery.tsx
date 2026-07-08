"use client";

import { useEffect, useState } from "react";
import type { MatchedPhoto } from "@/lib/types";

interface PhotosResponse {
  configured: boolean;
  confirmed: MatchedPhoto[];
  maybe: MatchedPhoto[];
  hiddenScreenshots: MatchedPhoto[];
  error?: string;
}

async function setPhotoStatus(path: string, status: "ignored" | "included" | "reset") {
  await fetch("/api/photos/ignore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, status }),
  });
}

export default function PhotoGallery({ tripId }: { tripId: number }) {
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState<MatchedPhoto | null>(null);
  const [showMaybe, setShowMaybe] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = () => {
    fetch(`/api/trips/${tripId}/photos`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setFailed(true));
  };

  useEffect(load, [tripId]);

  const hidePhoto = async (path: string) => {
    setLightbox(null);
    await setPhotoStatus(path, "ignored");
    load();
  };

  const restorePhoto = async (path: string) => {
    await setPhotoStatus(path, "included");
    load();
  };

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
  if (data.confirmed.length === 0 && data.maybe.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No photos found in Dropbox for these dates.
      </p>
    );
  }

  return (
    <>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
        {data.confirmed.length} photo{data.confirmed.length === 1 ? "" : "s"} matched from Dropbox
      </p>
      <PhotoGrid photos={data.confirmed} onSelect={setLightbox} onHide={hidePhoto} />

      {data.maybe.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowMaybe((v) => !v)}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
          >
            {showMaybe ? "Hide" : "Show"} {data.maybe.length} possible match
            {data.maybe.length === 1 ? "" : "es"} (no reliable capture date)
          </button>
          {showMaybe && (
            <div className="mt-3">
              <p className="text-xs text-zinc-400 mb-2">
                These only matched by Dropbox&apos;s file-modified date, not the photo&apos;s
                actual capture date — double check before trusting them.
              </p>
              <PhotoGrid photos={data.maybe} onSelect={setLightbox} onHide={hidePhoto} />
            </div>
          )}
        </div>
      )}

      {data.hiddenScreenshots.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
          >
            {showHidden ? "Hide" : "Show"} {data.hiddenScreenshots.length} auto-hidden screenshot
            {data.hiddenScreenshots.length === 1 ? "" : "s"}
          </button>
          {showHidden && (
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {data.hiddenScreenshots.map((photo) => (
                <li key={photo.path} className="relative">
                  <button
                    type="button"
                    onClick={() => setLightbox(photo)}
                    className="block w-full aspect-square overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 opacity-60 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    title={photo.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/thumbnail?path=${encodeURIComponent(photo.path)}`}
                      alt={photo.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => restorePhoto(photo.path)}
                    className="absolute bottom-1 right-1 rounded-md bg-black/70 text-white text-xs px-1.5 py-0.5 hover:bg-black/90"
                    title="This is a real trip photo, keep it in the gallery"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              hidePhoto(lightbox.path);
            }}
            className="absolute top-4 right-4 rounded-md bg-white/90 dark:bg-zinc-900/90 px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            🚫 Not part of this trip
          </button>
        </div>
      )}
    </>
  );
}

function PhotoGrid({
  photos,
  onSelect,
  onHide,
}: {
  photos: MatchedPhoto[];
  onSelect: (photo: MatchedPhoto) => void;
  onHide: (path: string) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {photos.map((photo) => (
        <li key={photo.path} className="group relative">
          <button
            type="button"
            onClick={() => onSelect(photo)}
            className="block w-full aspect-square overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            title={`${photo.name} — ${photo.matched_by === "date+location" ? "matched by date and GPS" : "matched by date"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/thumbnail?path=${encodeURIComponent(photo.path)}`}
              alt={photo.name}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHide(photo.path);
            }}
            className="absolute top-1 right-1 rounded-md bg-black/60 text-white text-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity"
            title="Not part of this trip — hide it"
          >
            🚫
          </button>
        </li>
      ))}
    </ul>
  );
}
