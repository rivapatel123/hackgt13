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