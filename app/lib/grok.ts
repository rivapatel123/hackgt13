const GROK_API_KEY = process.env.GROK_API_KEY!;
const GROK_BASE = "https://api.x.ai/v1";

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  const bytes = new Uint8Array(audioBuffer);
  formData.append("file", new Blob([bytes]), "audio.wav");
  formData.append("model", "whisper-1");

  const res = await fetch(`${GROK_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROK_API_KEY}` },
    body: formData,
  });
  const data = await res.json();
  return data.text;
}

export async function parseReport(transcript: string) {
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
            "Return only valid JSON with these fields: category (medical, fire, flood, other), urgency (low, medium, high), description (string), location_text (string or null). No other text.",
        },
        { role: "user", content: transcript },
      ],
    }),
  });
  const data = await res.json();
  const raw = data.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch {
    return {
      category: "other",
      urgency: "medium",
      description: transcript,
      location_text: null,
    };
  }
}