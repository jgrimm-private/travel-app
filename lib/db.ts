import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Trip, TripInput } from "./types";

const DATA_DIR = process.env.TRAVEL_APP_DATA_DIR ?? path.join(process.cwd(), "data");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "travel.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
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
  `);
  return db;
}

export interface DropboxAuth {
  refresh_token: string;
  account_name: string | null;
  account_email: string | null;
  connected_at: string;
}

export function getDropboxAuth(): DropboxAuth | undefined {
  return getDb()
    .prepare("SELECT refresh_token, account_name, account_email, connected_at FROM dropbox_auth WHERE id = 1")
    .get() as DropboxAuth | undefined;
}

export function saveDropboxAuth(auth: {
  refresh_token: string;
  account_name?: string | null;
  account_email?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO dropbox_auth (id, refresh_token, account_name, account_email, connected_at)
       VALUES (1, @refresh_token, @account_name, @account_email, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         refresh_token = @refresh_token,
         account_name = @account_name,
         account_email = @account_email,
         connected_at = datetime('now')`
    )
    .run({
      refresh_token: auth.refresh_token,
      account_name: auth.account_name ?? null,
      account_email: auth.account_email ?? null,
    });
}

export function clearDropboxAuth(): void {
  getDb().prepare("DELETE FROM dropbox_auth WHERE id = 1").run();
}

export function listTrips(): Trip[] {
  return getDb()
    .prepare("SELECT * FROM trips ORDER BY start_date DESC, id DESC")
    .all() as Trip[];
}

export function getTrip(id: number): Trip | undefined {
  return getDb().prepare("SELECT * FROM trips WHERE id = ?").get(id) as Trip | undefined;
}

export function createTrip(input: TripInput, coords: { lat: number; lng: number } | null): Trip {
  const result = getDb()
    .prepare(
      `INSERT INTO trips (name, location, lat, lng, start_date, end_date, notes)
       VALUES (@name, @location, @lat, @lng, @start_date, @end_date, @notes)`
    )
    .run({
      name: input.name,
      location: input.location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes ?? "",
    });
  return getTrip(Number(result.lastInsertRowid))!;
}

export function updateTrip(
  id: number,
  input: TripInput,
  coords: { lat: number; lng: number } | null
): Trip | undefined {
  getDb()
    .prepare(
      `UPDATE trips
       SET name = @name, location = @location, lat = @lat, lng = @lng,
           start_date = @start_date, end_date = @end_date, notes = @notes
       WHERE id = @id`
    )
    .run({
      id,
      name: input.name,
      location: input.location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      notes: input.notes ?? "",
    });
  return getTrip(id);
}

export function deleteTrip(id: number): boolean {
  return getDb().prepare("DELETE FROM trips WHERE id = ?").run(id).changes > 0;
}

export type PhotoOverrideStatus = "ignored" | "included";

/** Manual photo hide/restore decisions, keyed by Dropbox path (lowercased). */
export function getPhotoOverrides(): Map<string, PhotoOverrideStatus> {
  const rows = getDb().prepare("SELECT path, status FROM photo_overrides").all() as Array<{
    path: string;
    status: PhotoOverrideStatus;
  }>;
  return new Map(rows.map((r) => [r.path, r.status]));
}

export function setPhotoOverride(path: string, status: PhotoOverrideStatus): void {
  getDb()
    .prepare(
      `INSERT INTO photo_overrides (path, status, created_at)
       VALUES (@path, @status, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET status = @status, created_at = datetime('now')`
    )
    .run({ path, status });
}

export function clearPhotoOverride(path: string): void {
  getDb().prepare("DELETE FROM photo_overrides WHERE path = ?").run(path);
}
