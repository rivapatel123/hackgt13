import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "reports.db");
export const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    transcript TEXT,
    category TEXT,
    urgency TEXT,
    description TEXT,
    raw_location_text TEXT,
    latitude REAL,
    longitude REAL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Columns added for the two-dashboard flow. Added one by one so existing
// reports.db files keep working.
const extraColumns: Record<string, string> = {
  hazard: "TEXT",
  audio: "BLOB",
  audio_mime: "TEXT",
  size_kb: "REAL",
  duration_sec: "REAL",
  name: "TEXT",
  source: "TEXT",
  assigned_to: "TEXT",
  classified_by: "TEXT",
  accuracy_m: "REAL",
  gps_address: "TEXT",
};
const existing = new Set(
  (db.prepare("PRAGMA table_info(reports)").all() as { name: string }[]).map(
    (c) => c.name,
  ),
);
for (const [col, type] of Object.entries(extraColumns)) {
  if (!existing.has(col))
    db.exec(`ALTER TABLE reports ADD COLUMN ${col} ${type}`);
}

// Everything except the audio bytes, plus a flag saying whether audio exists.
export const REPORT_COLUMNS = `id, transcript, category, urgency, description, raw_location_text,
  latitude, longitude, created_at, hazard, audio_mime, size_kb, duration_sec, name, source,
  assigned_to, classified_by, accuracy_m, gps_address, (audio IS NOT NULL) AS has_audio`;
