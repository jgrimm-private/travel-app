// Storage layer on libsql, so the same code runs everywhere:
// - Local dev: a SQLite file in data/ (no setup needed)
// - Vercel + Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN for persistence
// - Vercel without Turso: falls back to /tmp — works, but data is ephemeral
//   and vanishes on redeploy/idle, so treat that mode as a preview only.

import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import type { Trip, TripInput } from "./types";

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const dir =
    process.env.TRAVEL_APP_DATA_DIR ??
    (process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data"));
  fs.mkdirSync(dir, { recursive: true });
  return createClient({ url: `file:${path.join(dir, "travel.db")}` });
}

let dbPromise: Promise<Client> | null = null;

function getDb(): Promise<Client> {
  dbPromise ??= (async () => {
    const client = makeClient();
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        lat REAL,
        lng REAL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS dropbox_auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        refresh_token TEXT NOT NULL,
        account_name TEXT,
        account_email TEXT,
        connected_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS photo_overrides (
        path TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('ignored', 'included')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS photo_media_cache (
        path TEXT PRIMARY KEY,
        time_taken TEXT,
        lat REAL,
        lng REAL,
        found INTEGER NOT NULL,
        checked_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    return client;
  })();
  return dbPromise;
}

export interface DropboxAuth {
  refresh_token: string;
  account_name: string | null;
  account_email: string | null;
  connected_at: string;
}

export async function getDropboxAuth(): Promise<DropboxAuth | undefined> {
  const db = await getDb();
  const rs = await db.execute(
    "SELECT refresh_token, account_name, account_email, connected_at FROM dropbox_auth WHERE id = 1"
  );
  return rs.rows[0] as unknown as DropboxAuth | undefined;
}

export async function saveDropboxAuth(auth: {
  refresh_token: string;
  account_name?: string | null;
  account_email?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO dropbox_auth (id, refresh_token, account_name, account_email, connected_at)
          VALUES (1, :refresh_token, :account_name, :account_email, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            refresh_token = :refresh_token,
            account_name = :account_name,
            account_email = :account_email,
            connected_at = datetime('now')`,
    args: {
      refresh_token: auth.refresh_token,
      account_name: auth.account_name ?? null,
      account_email: auth.account_email ?? null,
    },
  });
}

export async function clearDropboxAuth(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM dropbox_auth WHERE id = 1");
}

export async function listTrips(): Promise<Trip[]> {
  const db = await getDb();
  const rs = await db.execute("SELECT * FROM trips ORDER BY start_date DESC, id DESC");
  return rs.rows as unknown as Trip[];
}

export async function getTrip(id: number): Promise<Trip | undefined> {
  const db = await getDb();
  const rs = await db.execute({ sql: "SELECT * FROM trips WHERE id = ?", args: [id] });
  return rs.rows[0] as unknown as Trip | undefined;
}

export async function createTrip(
  input: TripInput,
  coords: { lat: number; lng: number } | null
): Promise<Trip> {
  const db = await getDb();
  const rs = await db.execute({
    sql: `INSERT INTO trips (name, location, lat, lng, start_date, end_date, notes)
          VALUES (:name, :location, :lat, :lng, :start_date, :end_date, :notes)`,
    args: {
      name: input.name,
      location: input.location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes ?? "",
    },
  });
  return (await getTrip(Number(rs.lastInsertRowid)))!;
}

export async function updateTrip(
  id: number,
  input: TripInput,
  coords: { lat: number; lng: number } | null
): Promise<Trip | undefined> {
  const db = await getDb();
  await db.execute({
    sql: `UPDATE trips
          SET name = :name, location = :location, lat = :lat, lng = :lng,
              start_date = :start_date, end_date = :end_date, notes = :notes
          WHERE id = :id`,
    args: {
      id,
      name: input.name,
      location: input.location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes ?? "",
    },
  });
  return getTrip(id);
}

export async function deleteTrip(id: number): Promise<boolean> {
  const db = await getDb();
  const rs = await db.execute({ sql: "DELETE FROM trips WHERE id = ?", args: [id] });
  return rs.rowsAffected > 0;
}

export type PhotoOverrideStatus = "ignored" | "included";

/** Manual photo hide/restore decisions, keyed by Dropbox path (lowercased). */
export async function getPhotoOverrides(): Promise<Map<string, PhotoOverrideStatus>> {
  const db = await getDb();
  const rs = await db.execute("SELECT path, status FROM photo_overrides");
  return new Map(
    rs.rows.map((r) => [r.path as string, r.status as PhotoOverrideStatus])
  );
}

export async function setPhotoOverride(
  path: string,
  status: PhotoOverrideStatus
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT INTO photo_overrides (path, status, created_at)
          VALUES (:path, :status, datetime('now'))
          ON CONFLICT(path) DO UPDATE SET status = :status, created_at = datetime('now')`,
    args: { path, status },
  });
}

export async function clearPhotoOverride(path: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM photo_overrides WHERE path = ?", args: [path] });
}

export interface CachedMediaInfo {
  time_taken: string | null;
  lat: number | null;
  lng: number | null;
}

// A "not found" result is only trusted for this long before we ask Dropbox
// again — covers a freshly-uploaded photo whose metadata was still
// processing ("pending") the first time we checked. A "found" result never
// goes stale: a photo's capture date/GPS never changes once taken.
const NEGATIVE_CACHE_TTL_HOURS = Number(process.env.PHOTO_METADATA_NEGATIVE_TTL_HOURS ?? "24");

/** Looks up cached Dropbox capture-time/GPS metadata for a batch of paths.
 * Only returns entries that are still considered fresh (see above) — a
 * missing/absent path means "go fetch it from Dropbox". */
export async function getCachedMediaInfo(
  paths: string[]
): Promise<Map<string, CachedMediaInfo | null>> {
  const result = new Map<string, CachedMediaInfo | null>();
  if (paths.length === 0) return result;

  const db = await getDb();
  const placeholders = paths.map(() => "?").join(",");
  const rs = await db.execute({
    sql: `SELECT path, time_taken, lat, lng, found, checked_at FROM photo_media_cache WHERE path IN (${placeholders})`,
    args: paths,
  });

  const staleBefore = Date.now() - NEGATIVE_CACHE_TTL_HOURS * 3_600_000;
  for (const row of rs.rows) {
    const found = Number(row.found) === 1;
    if (!found) {
      const checkedAt = Date.parse(`${String(row.checked_at).replace(" ", "T")}Z`);
      if (checkedAt < staleBefore) continue; // treat as a cache miss, re-check
      result.set(row.path as string, null);
    } else {
      result.set(row.path as string, {
        time_taken: row.time_taken as string | null,
        lat: row.lat as number | null,
        lng: row.lng as number | null,
      });
    }
  }
  return result;
}

export interface MediaCacheEntry {
  path: string;
  time_taken: string | null;
  lat: number | null;
  lng: number | null;
  found: boolean;
}

export async function setCachedMediaInfo(entries: MediaCacheEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDb();
  await db.batch(
    entries.map((e) => ({
      sql: `INSERT INTO photo_media_cache (path, time_taken, lat, lng, found, checked_at)
            VALUES (:path, :time_taken, :lat, :lng, :found, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
              time_taken = :time_taken, lat = :lat, lng = :lng, found = :found,
              checked_at = datetime('now')`,
      args: {
        path: e.path,
        time_taken: e.time_taken,
        lat: e.lat,
        lng: e.lng,
        found: e.found ? 1 : 0,
      },
    })),
    "write"
  );
}
