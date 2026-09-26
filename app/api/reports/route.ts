import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { transcribeAudio, parseReport, grokConfigured } from "@/app/lib/grok";
import { geocode, reverseGeocode } from "@/app/lib/geocode";
import { db, REPORT_COLUMNS } from "@/app/lib/db";
import {
  SPEECH_LANGS,
  transcribeAndTranslate,
  type SpeechLang,
} from "@/app/lib/speech";
import {
  classifyLocally,
  detectHazard,
  scoreUrgency,
  extractAddress,
  summarize,
  isHazardKey,
  normalizeCategory,
  normalizeUrgency,
} from "@/app/lib/data";

function num01(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

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
  // Language the caller's device guessed / the caller picked in Settings.
  const langHint = str(formData.get("language"));
  const clientLang = (SPEECH_LANGS as readonly string[]).includes(
    langHint ?? "",
  )
    ? (langHint as SpeechLang)
    : null;
  const forcedLang =
    formData.get("language_forced") === "1" ? clientLang : null;
  // "caller" = they tapped a disaster button themselves; "voice" = auto-picked
  // on the phone from live captions (with that guess's confidence).
  const hazardSourceHint = str(formData.get("hazard_source"));
  const hazardConfHint = Number(formData.get("hazard_confidence")) || null;
  const captionConfidence = Number(formData.get("caption_confidence")) || null;

  if (!audio && !clientTranscript) {
    return NextResponse.json(
      { error: "Send audio or a transcript" },
      { status: 400 },
    );
  }

  const buffer = audio ? Buffer.from(await audio.arrayBuffer()) : null;

  // 1) Transcribe on the server with Whisper: detects en/fr/zh/es, transcribes
  //    in that language, and translates to English. Falls back to Grok, then
  //    to the phone's live captions.
  let transcript = clientTranscript ?? "";
  let english = transcript;
  let language: SpeechLang | null = clientLang ?? null;
  let languageConfidence: number | null = null;
  // Without Whisper, fall back to the phone recognizer's own confidence.
  let transcriptionConfidence: number | null = clientTranscript
    ? captionConfidence
    : null;
  let words: { w: string; p: number }[] | null = null;
  if (buffer) {
    try {
      const r = await transcribeAndTranslate(buffer, forcedLang);
      if (r.text) {
        transcript = r.text;
        english = r.english || r.text;
        language = r.language;
        languageConfidence = forcedLang ? null : r.languageConfidence;
        transcriptionConfidence = r.transcriptionConfidence;
        words = r.words;
      }
    } catch (e) {
      console.warn("[reports] Whisper unavailable:", (e as Error).message);
      if (grokConfigured) {
        try {
          transcript = await transcribeAudio(
            buffer,
            audio!.name,
            audio!.type || "audio/webm",
          );
          english = transcript;
        } catch (e2) {
          console.warn(
            "[reports] Grok transcription failed:",
            (e2 as Error).message,
          );
        }
      }
    }
  }

  // 2) Categorize (from the English translation, plus the original words).
  let classifiedBy = "keywords";
  const both = `${english} ${transcript === english ? "" : transcript}`;
  const local = classifyLocally(both);
  let parsed = {
    category: local.category as string,
    urgency: local.urgency as string,
    urgencyConfidence: null as number | null,
    hazardConfidence: null as number | null,
    description: english
      ? summarize(english)
      : "Voice message (no transcript yet)",
    location_text: extractAddress(english) ?? extractAddress(transcript),
    hazard: detectHazard(both)?.key ?? null,
  };
  if (english && grokConfigured && categoryHint !== "safe") {
    try {
      const g = await parseReport(english);
      parsed = {
        category: g.category ?? parsed.category,
        urgency: g.urgency ?? parsed.urgency,
        description: g.description ?? parsed.description,
        location_text: g.location_text ?? parsed.location_text,
        hazard: isHazardKey(g.hazard) ? g.hazard : parsed.hazard,
        // Grok's own estimates (0–1), when it provides them.
        urgencyConfidence: num01(g.urgency_confidence),
        hazardConfidence: num01(g.hazard_confidence),
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

  // Urgency + how sure we are. A tapped "I'm safe" is the person's own answer.
  let urgency: string;
  let urgencyConfidence: number | null;
  if (category === "safe" && categoryHint === "safe") {
    urgency = "low";
    urgencyConfidence = 1;
  } else if (classifiedBy === "grok") {
    urgency = normalizeUrgency(parsed.urgency);
    urgencyConfidence = parsed.urgencyConfidence;
  } else {
    const u = scoreUrgency(both, category);
    urgency = u.urgency;
    urgencyConfidence = u.confidence;
  }

  // Disaster type + how sure we are, and who decided it.
  let hazard = parsed.hazard;
  let hazardConfidence: number | null = null;
  let hazardSource: string | null = null;
  if (isHazardKey(hazardHint) && hazardSourceHint === "caller") {
    hazard = hazardHint;
    hazardConfidence = 1;
    hazardSource = "caller";
  } else if (classifiedBy === "grok" && parsed.hazard) {
    hazardConfidence = parsed.hazardConfidence;
    hazardSource = "ai";
  } else {
    const det = detectHazard(both);
    if (det) {
      hazard = det.key;
      hazardConfidence = det.confidence;
      hazardSource = "ai";
    } else if (isHazardKey(hazardHint)) {
      hazard = hazardHint;
      hazardConfidence = hazardConfHint;
      hazardSource = "voice";
    } else hazard = null;
  }

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
       hazard, audio, audio_mime, size_kb, duration_sec, name, source, classified_by, accuracy_m, gps_address,
       language, transcript_en, transcription_conf, language_conf, urgency_conf, hazard_conf,
       hazard_source, transcript_words)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    language,
    language && language !== "en" ? english : null,
    transcriptionConfidence,
    languageConfidence,
    urgencyConfidence,
    hazardConfidence,
    hazardSource,
    words ? JSON.stringify(words) : null,
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
