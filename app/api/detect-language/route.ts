import { NextRequest, NextResponse } from "next/server";
import { detectLanguage, loadWhisper } from "@/app/lib/speech";

// Warm-up: start loading the speech model so the first SOS isn't slow.
export async function GET() {
  try {
    await loadWhisper();
    return NextResponse.json({ ready: true });
  } catch (e) {
    return NextResponse.json(
      { ready: false, error: (e as Error).message },
      { status: 503 },
    );
  }
}

// A few seconds of the recording in progress → which language is being spoken.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0)
    return NextResponse.json({ error: "No audio" }, { status: 400 });
  try {
    const result = await detectLanguage(Buffer.from(await audio.arrayBuffer()));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }
}
