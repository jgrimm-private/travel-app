"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Trip } from "@/lib/types";

const FIELD_CLS =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500";

export default function TripForm({ trip }: { trip?: Trip }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      location: form.get("location"),
      start_date: form.get("start_date"),
      end_date: form.get("end_date"),
      notes: form.get("notes"),
    };
    const res = await fetch(trip ? `/api/trips/${trip.id}` : "/api/trips", {
      method: trip ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Save failed (${res.status})`);
      setSaving(false);
      return;
    }
    const saved = await res.json();
    router.push(`/trips/${saved.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Trip name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={trip?.name}
          placeholder="Spring in Lisbon"
          className={FIELD_CLS}
        />
      </div>
      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Location
        </label>
        <input
          id="location"
          name="location"
          required
          defaultValue={trip?.location}
          placeholder="Lisbon, Portugal"
          className={FIELD_CLS}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Used to find the spot on the map and match your photos by GPS.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_date" className="block text-sm font-medium mb-1">
            Start date
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={trip?.start_date}
            className={FIELD_CLS}
          />
        </div>
        <div>
          <label htmlFor="end_date" className="block text-sm font-medium mb-1">
            End date
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={trip?.end_date}
            className={FIELD_CLS}
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={trip?.notes}
          placeholder="Favorite meals, places, memories…"
          className={FIELD_CLS}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : trip ? "Save changes" : "Add trip"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
