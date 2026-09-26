// Server-only: offline speech recognition with OpenAI's Whisper (open model,
// run locally via transformers.js). Detects which of our 4 supported languages
// is being spoken, transcribes it, and translates it to English for triage.
import { spawn } from "node:child_process";
import path from "node:path";
import type {
  AutoProcessor as AutoProcessorT,
  AutoTokenizer as AutoTokenizerT,
  WhisperForConditionalGeneration as WhisperT,
} from "@huggingface/transformers";

export const SPEECH_LANGS = ["en", "fr", "zh", "es"] as const;
export type SpeechLang = (typeof SPEECH_LANGS)[number];

const MODEL_ID = process.env.WHISPER_MODEL ?? "onnx-community/whisper-small";

type Loaded = {
  processor: Awaited<ReturnType<typeof AutoProcessorT.from_pretrained>>;
  tokenizer: Awaited<ReturnType<typeof AutoTokenizerT.from_pretrained>>;
  model: Awaited<ReturnType<typeof WhisperT.from_pretrained>>;
  Tensor: typeof import("@huggingface/transformers").Tensor;
};

// Keep one copy of the model across dev hot-reloads.
const g = globalThis as unknown as { __whisper?: Promise<Loaded> };

export function loadWhisper(): Promise<Loaded> {
  if (!g.__whisper) {
    g.__whisper = (async () => {
      const T = await import("@huggingface/transformers");
      T.env.cacheDir = path.join(process.cwd(), ".cache", "models");
      const [processor, tokenizer, model] = await Promise.all([
        T.AutoProcessor.from_pretrained(MODEL_ID),
        T.AutoTokenizer.from_pretrained(MODEL_ID),
        T.WhisperForConditionalGeneration.from_pretrained(MODEL_ID, {
          dtype: "q8",
        }),
      ]);
      return { processor, tokenizer, model, Tensor: T.Tensor };
    })();
    // Let a failed load (e.g. no internet on first run) be retried later.
    g.__whisper.catch(() => {
      g.__whisper = undefined;
    });
  }
  return g.__whisper;
}

/** Decode any browser recording (WebM/Opus, MP4/AAC, Ogg…) to 16 kHz mono PCM. */
export function decodeAudio(buf: Buffer): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      "16000",
      "pipe:1",
    ]);
    const out: Buffer[] = [];
    let err = "";
    ff.stdout.on("data", (d: Buffer) => out.push(d));
    ff.stderr.on("data", (d: Buffer) => (err += d));
    ff.on("error", (e) =>
      reject(
        new Error(
          `ffmpeg not available (${e.message}) — install it with: brew install ffmpeg`,
        ),
      ),
    );
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed: ${err.trim()}`));
      const b = Buffer.concat(out);
      // Copy into an aligned buffer for Float32Array.
      const ab = new ArrayBuffer(b.length - (b.length % 4));
      new Uint8Array(ab).set(b.subarray(0, ab.byteLength));
      resolve(new Float32Array(ab));
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(buf);
  });
}

async function features(w: Loaded, audio: Float32Array) {
  const { input_features } = await w.processor(audio);
  return input_features;
}

/**
 * Which of en/fr/zh/es is being spoken: Whisper's first decoding step scores
 * every language token; we compare only the four we support.
 */
async function scoreLanguages(w: Loaded, input_features: unknown) {
  const cfg = w.model.generation_config as unknown as {
    decoder_start_token_id: number;
    lang_to_id: Record<string, number>;
  };
  const start = new w.Tensor(
    "int64",
    BigInt64Array.from([BigInt(cfg.decoder_start_token_id)]),
    [1, 1],
  );
  const out = (await w.model({ input_features, decoder_input_ids: start })) as {
    logits: { data: Float32Array; dims: number[] };
  };
  const logits = out.logits.data;
  const raw = SPEECH_LANGS.map((l) => logits[cfg.lang_to_id[`<|${l}|>`]]);
  const max = Math.max(...raw);
  const exp = raw.map((x) => Math.exp(x - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = Object.fromEntries(
    SPEECH_LANGS.map((l, i) => [l, exp[i] / sum]),
  ) as Record<SpeechLang, number>;
  const language = SPEECH_LANGS[exp.indexOf(Math.max(...exp))];
  return { language, confidence: probs[language], probs };
}

export async function detectLanguage(buf: Buffer) {
  const w = await loadWhisper();
  const audio = await decodeAudio(buf);
  return scoreLanguages(w, await features(w, audio));
}

/** Detect (unless forced) → transcribe in that language → translate to English. */
export async function transcribeAndTranslate(
  buf: Buffer,
  forced?: SpeechLang | null,
) {
  const w = await loadWhisper();
  const audio = await decodeAudio(buf);
  const input_features = await features(w, audio);
  const detected = forced
    ? { language: forced, confidence: 1 }
    : await scoreLanguages(w, input_features);
  const language = detected.language;

  const run = async (task: "transcribe" | "translate") => {
    const ids = await w.model.generate({
      input_features,
      language,
      task,
      max_new_tokens: 220,
    } as Parameters<typeof w.model.generate>[0]);
    return w.tokenizer
      .batch_decode(ids as never, { skip_special_tokens: true })[0]
      .trim();
  };

  const text = await run("transcribe");
  const english = language === "en" ? text : await run("translate");
  return { language, confidence: detected.confidence, text, english };
}
