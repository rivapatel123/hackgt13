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
// Whisper hears 30 s at a time; longer messages are processed in pieces.
const SAMPLE_RATE = 16_000;
const CHUNK_SAMPLES = 28 * SAMPLE_RATE;
const MIN_TAIL = 0.5 * SAMPLE_RATE;

export async function transcribeAndTranslate(
  buf: Buffer,
  forced?: SpeechLang | null,
) {
  const w = await loadWhisper();
  const audio = await decodeAudio(buf);
  const chunks: Float32Array[] = [];
  for (let i = 0; i < audio.length; i += CHUNK_SAMPLES) {
    const piece = audio.subarray(i, i + CHUNK_SAMPLES);
    if (piece.length >= MIN_TAIL || chunks.length === 0) chunks.push(piece);
  }
  const feats = [];
  for (const c of chunks) feats.push(await features(w, c));

  const detected = forced
    ? { language: forced, confidence: 1 }
    : await scoreLanguages(w, feats[0]);
  const language = detected.language;

  const run = async (
    input_features: unknown,
    task: "transcribe" | "translate",
  ) => {
    const ids = (await w.model.generate({
      input_features,
      language,
      task,
      max_new_tokens: 220,
    } as Parameters<typeof w.model.generate>[0])) as unknown as {
      data: BigInt64Array;
    };
    const text = w.tokenizer
      .batch_decode(ids as never, { skip_special_tokens: true })[0]
      .trim();
    return { text, ids: Array.from(ids.data) };
  };

  const texts: string[] = [];
  const englishParts: string[] = [];
  const words: { w: string; p: number }[] = [];
  let logSum = 0;
  let count = 0;
  for (const f of feats) {
    const heard = await run(f, "transcribe");
    if (!heard.text) continue;
    texts.push(heard.text);
    englishParts.push(
      language === "en" ? heard.text : (await run(f, "translate")).text,
    );
    const scored = await scoreTranscript(w, f, heard.ids, language);
    logSum += scored.logSum;
    count += scored.count;
    // Keep a space between pieces so word grouping stays readable.
    if (words.length && scored.words.length && language !== "zh")
      scored.words[0] = {
        ...scored.words[0],
        w: ` ${scored.words[0].w.trimStart()}`,
      };
    words.push(...scored.words);
  }
  const sep = language === "zh" ? "" : " ";
  return {
    language,
    languageConfidence: detected.confidence,
    text: texts.join(sep).trim(),
    english: englishParts.join(" ").trim(),
    transcriptionConfidence: count ? Math.exp(logSum / count) : null,
    words,
  };
}

/**
 * How sure Whisper was of its own transcript: re-run the decoder over the
 * final tokens (teacher forcing) and read the probability it gave each one.
 * Overall confidence = geometric mean of token probabilities, i.e.
 * exp(average log-probability) — the standard Whisper quality score.
 * Each word's confidence is its least-certain token.
 */
async function scoreTranscript(
  w: Loaded,
  input_features: unknown,
  ids: bigint[],
  language: SpeechLang,
) {
  const n = ids.length;
  if (n < 2) return { confidence: null, words: [], logSum: 0, count: 0 };
  const dec = new w.Tensor("int64", BigInt64Array.from(ids.slice(0, n - 1)), [
    1,
    n - 1,
  ]);
  const out = (await w.model({ input_features, decoder_input_ids: dec })) as {
    logits: { data: Float32Array; dims: number[] };
  };
  const { data, dims } = out.logits;
  const V = dims[2];
  const piece = (id: number) =>
    w.tokenizer.decode([id], { skip_special_tokens: true });

  const tokens: { id: number; p: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const next = Number(ids[i + 1]);
    if (piece(next) === "") continue; // prompt / end / timestamp tokens
    const off = i * V;
    let max = -Infinity;
    for (let k = 0; k < V; k++) if (data[off + k] > max) max = data[off + k];
    let sum = 0;
    for (let k = 0; k < V; k++) sum += Math.exp(data[off + k] - max);
    tokens.push({ id: next, p: Math.exp(data[off + next] - max) / sum });
  }
  if (!tokens.length)
    return { confidence: null, words: [], logSum: 0, count: 0 };

  const logSum = tokens.reduce((a, t) => a + Math.log(Math.max(t.p, 1e-9)), 0);
  const meanLog = logSum / tokens.length;

  // Group tokens into words (a leading space starts a new word; Chinese has
  // no spaces, so each complete character group becomes its own "word").
  const words: { w: string; p: number }[] = [];
  let group: { id: number; p: number }[] = [];
  const flush = () => {
    if (!group.length) return;
    const text = w.tokenizer.decode(
      group.map((g) => g.id),
      { skip_special_tokens: true },
    );
    words.push({ w: text, p: Math.min(...group.map((g) => g.p)) });
    group = [];
  };
  for (const t of tokens) {
    if (piece(t.id).startsWith(" ") && group.length) flush();
    group.push(t);
    if (language === "zh") {
      const text = w.tokenizer.decode(
        group.map((g) => g.id),
        { skip_special_tokens: true },
      );
      if (!text.includes("\uFFFD")) flush();
    }
  }
  flush();

  return {
    confidence: Math.exp(meanLog),
    logSum,
    count: tokens.length,
    words: words.map((x) => ({ w: x.w, p: Math.round(x.p * 1000) / 1000 })),
  };
}
