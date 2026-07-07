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
  `);
  return db;
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
