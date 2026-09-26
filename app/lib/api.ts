// Client helpers for /api/reports — shared by the civilian and responder dashboards.
import {
  isHazardKey,
  isLangKey,
  normalizeCategory,
  normalizeUrgency,
  type Report,
} from "@/app/lib/data";

// SQLite datetime('now') is UTC without a zone marker.
function sqlTime(v: string) {
  return v.includes("T")
    ? v
    : new Date(`${v.replace(" ", "T")}Z`).toISOString();
}
const num = (v: unknown) => (typeof v === "number" ? v : null);
function parseWords(v: unknown): Report["words"] {
  if (typeof v !== "string") return null;
  try {
    const w = JSON.parse(v);
    return Array.isArray(w) ? w : null;
  } catch {
    return null;
  }
}

export function fromApi(row: Record<string, unknown>): Report {
  const id = String(row.id);
  const created = String(row.created_at ?? "");
  return {
    id,
    transcript: String(row.transcript ?? ""),
    category: normalizeCategory(row.category),
    urgency: normalizeUrgency(row.urgency),
    description: String(row.description ?? ""),
    raw_location_text: (row.raw_location_text as string | null) ?? null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    created_at: sqlTime(created),
    hazard: isHazardKey(row.hazard) ? row.hazard : null,
    name: (row.name as string) ?? undefined,
    audioUrl: row.has_audio ? `/api/reports/${id}/audio` : undefined,
    sizeKb: typeof row.size_kb === "number" ? row.size_kb : undefined,
    durationSec:
      typeof row.duration_sec === "number"
        ? Math.round(row.duration_sec)
        : undefined,
    assignedTo: (row.assigned_to as string | null) ?? null,
    accuracy: typeof row.accuracy_m === "number" ? row.accuracy_m : null,
    gpsAddress: (row.gps_address as string | null) ?? null,
    language: isLangKey(row.language) ? row.language : null,
    transcriptEn: (row.transcript_en as string | null) ?? null,
    assignedAt: row.assigned_at ? sqlTime(String(row.assigned_at)) : null,
    transcriptionConfidence: num(row.transcription_conf),
    languageConfidence: num(row.language_conf),
    urgencyConfidence: num(row.urgency_conf),
    hazardConfidence: num(row.hazard_conf),
    hazardSource: (row.hazard_source as Report["hazardSource"]) ?? null,
    words: parseWords(row.transcript_words),
    classifiedOnDevice: row.classified_by !== "grok",
    live: true,
  };
}

export async function fetchReports(): Promise<Report[]> {
  const res = await fetch("/api/reports", { cache: "no-store" });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows.map(fromApi) : [];
}

export async function fetchReport(id: string): Promise<Report | null> {
  const res = await fetch(`/api/reports/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return fromApi(await res.json());
}

export async function assignReport(id: string, unit: string | null) {
  const res = await fetch(`/api/reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assigned_to: unit }),
  });
  return res.ok;
}

export async function postReport(fd: FormData): Promise<Report> {
  const res = await fetch("/api/reports", {
    method: "POST",
    body: fd,
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return fromApi(await res.json());
}

export async function deleteReport(id: string) {
  const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
  return res.ok;
}
