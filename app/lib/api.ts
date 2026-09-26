// Client helpers for /api/reports — shared by the civilian and responder dashboards.
import {
  isHazardKey,
  normalizeCategory,
  normalizeUrgency,
  type Report,
} from "@/app/lib/data";

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
    // SQLite datetime('now') is UTC without a zone marker.
    created_at: created.includes("T")
      ? created
      : new Date(`${created.replace(" ", "T")}Z`).toISOString(),
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
