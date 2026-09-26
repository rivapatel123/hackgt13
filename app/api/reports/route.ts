import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { transcribeAudio, parseReport } from "@/app/lib/grok";
import { geocode } from "@/app/lib/geocode";
import { db } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File;
  const gpsLat = formData.get("lat") as string | null;
  const gpsLng = formData.get("lng") as string | null;

  const buffer = Buffer.from(await audioFile.arrayBuffer());
  const transcript = await transcribeAudio(buffer);
  const parsed = await parseReport(transcript);

  let lat = gpsLat ? parseFloat(gpsLat) : null;
  let lng = gpsLng ? parseFloat(gpsLng) : null;

  if (!lat && parsed.location_text) {
    const coords = await geocode(parsed.location_text);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO reports (id, transcript, category, urgency, description, raw_location_text, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, transcript, parsed.category, parsed.urgency, parsed.description, parsed.location_text, lat, lng);

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  return NextResponse.json(report);
}

export async function GET() {
  const reports = db.prepare("SELECT * FROM reports ORDER BY created_at DESC").all();
  return NextResponse.json(reports);
}