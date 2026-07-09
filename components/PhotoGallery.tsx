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

interface LightboxState {
  list: MatchedPhoto[];
  index: number;
}

async function setPhotoStatus(path: string, status: "ignored" | "included" | "reset") {
  await fetch("/api/photos/ignore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, status }),
  });
}

/** Inlines each photo's duplicates right after it, so a slideshow can page
 * through every shot (originals and near-duplicates alike) in order. */
function flatten(photos: MatchedPhoto[]): MatchedPhoto[] {
  const out: MatchedPhoto[] = [];
  for (const photo of photos) {
    out.push(photo);
    if (photo.duplicates) out.push(...photo.duplicates);
  }
  return out;
}

export default function PhotoGallery({ tripId }: { tripId: number }) {
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [showMaybe, setShowMaybe] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = () => {
    fetch(`/api/trips/${tripId}/photos`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setFailed(true));
  };

  useEffect(load, [tripId]);

  const openLightbox = (section: MatchedPhoto[], photo: MatchedPhoto) => {
    const list = flatten(section);
    const index = Math.max(
      list.findIndex((p) => p.path === photo.path),
      0
    );
    setLightbox({ list, index });
  };

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setLightbox((prev) => prev && { ...prev, index: Math.min(prev.index + 1, prev.list.length - 1) });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((prev) => prev && { ...prev, index: Math.max(prev.index - 1, 0) });
      } else if (e.key === "Escape") {
        setLightbox(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox !== null]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const lightboxPhoto = lightbox?.list[lightbox.index];

  return (
    <>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
        {data.confirmed.length} photo{data.confirmed.length === 1 ? "" : "s"} matched from Dropbox
      </p>
      <PhotoGrid
        photos={data.confirmed}
        onSelect={(photo) => openLightbox(data.confirmed, photo)}
        onHide={hidePhoto}
      />

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
              <PhotoGrid
                photos={data.maybe}
                onSelect={(photo) => openLightbox(data.maybe, photo)}
                onHide={hidePhoto}
              />
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
                    onClick={() => openLightbox(data.hiddenScreenshots, photo)}
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

      {lightbox && lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label={lightboxPhoto.name}
        >
          {lightbox.index > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox({ ...lightbox, index: lightbox.index - 1 });
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 text-white w-10 h-10 flex items-center justify-center text-2xl"
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/thumbnail?path=${encodeURIComponent(lightboxPhoto.path)}&size=large`}
            alt={lightboxPhoto.name}
            className="max-h-[85vh] max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox.index < lightbox.list.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox({ ...lightbox, index: lightbox.index + 1 });
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 text-white w-10 h-10 flex items-center justify-center text-2xl"
              aria-label="Next photo"
            >
              ›
            </button>
          )}

          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white/70 text-xs">
              {lightbox.index + 1} / {lightbox.list.length}
            </span>
            <button
              type="button"
              onClick={() => hidePhoto(lightboxPhoto.path)}
              className="rounded-md bg-white/90 dark:bg-zinc-900/90 px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              🚫 Not part of this trip
            </button>
          </div>
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
          {photo.duplicates && photo.duplicates.length > 0 && (
            <span
              className="absolute bottom-1 left-1 rounded-md bg-black/70 text-white text-xs px-1.5 py-0.5 pointer-events-none"
              title={`${photo.duplicates.length} similar shot${photo.duplicates.length === 1 ? "" : "s"} taken around the same time/place — click to browse`}
            >
              +{photo.duplicates.length}
            </span>
          )}
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
