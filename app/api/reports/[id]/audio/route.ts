import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// Streams the original compressed voice message so responders can listen.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = db
    .prepare("SELECT audio, audio_mime FROM reports WHERE id = ?")
    .get(id) as { audio: Buffer | null; audio_mime: string | null } | undefined;
  if (!row?.audio)
    return NextResponse.json({ error: "no audio" }, { status: 404 });
  return new NextResponse(new Uint8Array(row.audio), {
    headers: {
      "Content-Type": row.audio_mime || "audio/webm",
      "Content-Length": String(row.audio.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
