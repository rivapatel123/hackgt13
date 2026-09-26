const GROK_API_KEY = process.env.GROK_API_KEY;
const GROK_BASE = "https://api.x.ai/v1";

export const grokConfigured = Boolean(GROK_API_KEY);

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename = "audio.webm",
  mimeType = "audio/webm",
): Promise<string> {
  if (!GROK_API_KEY) throw new Error("GROK_API_KEY is not set");
  const formData = new FormData();
  const bytes = new Uint8Array(audioBuffer);
  formData.append("file", new Blob([bytes], { type: mimeType }), filename);
  formData.append("model", "whisper-1");

  const res = await fetch(`${GROK_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROK_API_KEY}` },
    body: formData,
  });
  if (!res.ok)
    throw new Error(
      `Grok transcription failed: ${res.status} ${await res.text()}`,
    );
  const data = await res.json();
  if (typeof data.text !== "string")
    throw new Error("Grok transcription returned no text");
  return data.text;
}

export async function parseReport(transcript: string) {
  if (!GROK_API_KEY) throw new Error("GROK_API_KEY is not set");
  const res = await fetch(`${GROK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4",
      messages: [
        {
          role: "system",
          content:
            "You triage disaster voice messages. Return only valid JSON with these fields: " +
            "category (one of: medical, food_water, missing_person, shelter, safe, fire, flood, other), " +
            "urgency (low, medium, high), description (short summary under 90 characters), " +
            "location_text (string or null), " +
            "hazard (one of: hurricane, flood, tornado, earthquake, wildfire, tsunami, volcano, or null). No other text.",
        },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok)
    throw new Error(`Grok chat failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(raw) as {
    category?: string;
    urgency?: string;
    description?: string;
    location_text?: string | null;
    hazard?: string | null;
  };
}
