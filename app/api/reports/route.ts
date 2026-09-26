import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { transcribeAudio, parseReport, grokConfigured } from "@/app/lib/grok";
import { geocode, reverseGeocode } from "@/app/lib/geocode";
import { db, REPORT_COLUMNS } from "@/app/lib/db";
import {
  classifyLocally,
  detectHazard,
  extractAddress,
  summarize,
  isHazardKey,
  normalizeCategory,
  normalizeUrgency,
} from "@/app/lib/data";

function str(v: FormDataEntryValue | null) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio");
  const audio =
    audioFile instanceof File && audioFile.size > 0 ? audioFile : null;
  const gpsLat = str(formData.get("lat"));
  const gpsLng = str(formData.get("lng"));
  const accuracy = Number(formData.get("accuracy")) || null;
  // The browser's live captions, used when server-side transcription isn't available.
  const clientTranscript = str(formData.get("transcript"));
  const categoryHint = str(formData.get("category"));
  const hazardHint = str(formData.get("hazard"));
  const name = str(formData.get("name"));
  const source = str(formData.get("source")) ?? "voice";
  const durationSec = Number(formData.get("duration")) || null;

  if (!audio && !clientTranscript) {
    return NextResponse.json(
      { error: "Send audio or a transcript" },
      { status: 400 },
    );
  }

  const buffer = audio ? Buffer.from(await audio.arrayBuffer()) : null;

  // 1) Transcribe with Grok when possible; fall back to the live captions.
  let transcript = clientTranscript ?? "";
  let classifiedBy = "keywords";
  if (buffer && grokConfigured) {
    try {
      transcript = await transcribeAudio(
        buffer,
        audio!.name,
        audio!.type || "audio/webm",
      );
    } catch (e) {
      console.warn(
        "[reports] transcription fell back to client captions:",
        (e as Error).message,
      );
    }
  }

  // 2) Categorize with Grok when possible; fall back to keyword triage.
  const local = classifyLocally(transcript);
  let parsed = {
    category: local.category as string,
    urgency: local.urgency as string,
    description: transcript
      ? summarize(transcript)
      : "Voice message (no transcript yet)",
    location_text: extractAddress(transcript),
    hazard: detectHazard(transcript)?.key ?? null,
  };
  if (transcript && grokConfigured && categoryHint !== "safe") {
    try {
      const g = await parseReport(transcript);
      parsed = {
        category: g.category ?? parsed.category,
        urgency: g.urgency ?? parsed.urgency,
        description: g.description ?? parsed.description,
        location_text: g.location_text ?? null,
        hazard: isHazardKey(g.hazard) ? g.hazard : parsed.hazard,
      };
      classifiedBy = "grok";
    } catch (e) {
      console.warn(
        "[reports] categorization fell back to keywords:",
        (e as Error).message,
      );
    }
  }

  const category = normalizeCategory(categoryHint ?? parsed.category);
  const urgency =
    category === "safe" ? "low" : normalizeUrgency(parsed.urgency);
  const hazard = isHazardKey(hazardHint) ? hazardHint : parsed.hazard;

  let lat = gpsLat ? parseFloat(gpsLat) : null;
  let lng = gpsLng ? parseFloat(gpsLng) : null;

  if (lat == null && parsed.location_text && process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const coords = await geocode(parsed.location_text);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    } catch {}
  }

  // Street address for the device's GPS fix (only when the phone sent one).
  const gpsAddress =
    gpsLat && lat != null && lng != null
      ? await reverseGeocode(lat, lng)
      : null;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO reports (id, transcript, category, urgency, description, raw_location_text, latitude, longitude,
       hazard, audio, audio_mime, size_kb, duration_sec, name, source, classified_by, accuracy_m, gps_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    transcript,
    category,
    urgency,
    parsed.description,
    parsed.location_text ??
      gpsAddress ??
      (lat != null ? `GPS ${lat.toFixed(4)}, ${lng!.toFixed(4)}` : null),
    lat,
    lng,
    hazard,
    buffer,
    audio?.type || null,
    buffer ? Math.round((buffer.length / 1024) * 10) / 10 : null,
    durationSec,
    name,
    source,
    classifiedBy,
    gpsLat ? accuracy : null,
    gpsAddress,
  );

  const report = db
    .prepare(`SELECT ${REPORT_COLUMNS} FROM reports WHERE id = ?`)
    .get(id);
  return NextResponse.json(report);
}

export async function GET() {
  const reports = db
    .prepare(`SELECT ${REPORT_COLUMNS} FROM reports ORDER BY created_at DESC`)
    .all();
  return NextResponse.json(reports);
}
