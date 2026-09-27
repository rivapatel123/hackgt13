//testing

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  DEMO_HOME,
  HAZARDS,
  LANGS,
  classifyLocally,
  detectHazard,
  deviceLanguage,
  fmtClock,
  fmtDate,
  fmtDuration,
  responseTime,
  isLangKey,
  type HazardKey,
  type LangKey,
  type Report,
} from "@/app/lib/data";
import type { Coords } from "@/app/lib/location";
import { locationHelp, type LiveLocation } from "@/app/lib/useLiveLocation";
import { postReport } from "@/app/lib/api";
import { useRecorder, type Recording } from "@/app/lib/useRecorder";
import type { AppSettings } from "@/app/components/SettingsView";
import {
  AlertIcon,
  CheckIcon,
  MicIcon,
  PinIcon,
  RefreshIcon,
  SatelliteIcon,
  ShieldIcon,
  StopIcon,
  UsersIcon,
} from "@/app/components/icons";
import { CategoryBadge, UrgencyBadge } from "@/app/components/Badges";
import LeafletMap, { type MapPin } from "@/app/components/LeafletMap";

type Stage = "idle" | "sending" | "done";
type StepState = "done" | "active" | "waiting" | "failed";

type Submission = {
  recording: Recording;
  report: Report | null;
  stage: Stage;
  error: string | null;
  coords: Coords | null; // location that was sent with the message
};

// Live language check: switch captions at ≥ CONFIDENT; stop re-checking at ≥ SETTLED.
const CONFIDENT = 0.75;
const SETTLED = 0.92;
const newProbe = () => ({
  count: 0,
  busy: false,
  voiceAt: -1, // recording time (s) when speech was first heard
  nextAt: 0, // when the next check is due
  settled: false,
});

const PROMPTS = [
  {
    key: "who",
    label: "Who you are",
    hint: "Your name and how many people are with you",
    example: "“This is Maria, there are 3 of us…”",
    test: /\b(my name|this is|i'?m [a-z]+|i am|name'?s|there (are|is) \w+ of us|with my)\b|je m'appelle|c'est \w+|je suis|nous sommes|me llamo|mi nombre|soy \w+|somos|estoy con|我叫|我是|我们有|我们.{0,3}个人/i,
  },
  {
    key: "where",
    label: "Where you are",
    hint: "Street address, landmark, or floor",
    example: "“…at 412 Bayshore Blvd, second floor…”",
    test: /\b(\d{2,}|street|st\b|avenue|ave\b|road|rd\b|blvd|boulevard|drive|near|floor|apartment|apt|building|highway|hwy|corner|behind|next to)\b|\d{2,}|\brue\b|étage|près d|à côté|calle|avenida|\bpiso\b|cerca de|al lado|número|路|街|号|楼|层|附近/i,
  },
  {
    key: "what",
    label: "What you need",
    hint: "Medical help, water, rescue, shelter — or that you're safe",
    example: "“…my husband is hurt and we need a boat.”",
    test: /\b(need|help|hurt|injur|bleed|water|food|trapped|stuck|shelter|missing|medic|insulin|oxygen|rescue|boat|safe|okay)\b|besoin|aide|blessé|de l'eau|nourriture|coincé|secours|bateau|en sécurité|necesit|ayuda|herid|agua|comida|atrapad|rescate|\bbote\b|a salvo|需要|帮助|救命|受伤|食物|被困|救援|船|安全/i,
  },
] as const;

export default function EmergencyView({
  settings,
  myReports,
  onReport,
  onCheckInSafe,
  safeStatus,
  onOpenFamily,
  location,
}: {
  location: LiveLocation;
  settings: AppSettings;
  myReports: Report[];
  onReport: (r: Report, replaceId?: string) => void;
  onCheckInSafe: () => void;
  safeStatus: "idle" | "sending" | "sent";
  onOpenFamily: () => void;
}) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  // A chip the caller tapped themselves always wins over the voice guess.
  const [manualHazard, setManualHazard] = useState<HazardKey | "none" | null>(
    null,
  );

  // Spoken language: auto-detected from the first seconds of speech (or locked in Settings).
  const [lang, setLang] = useState<{
    key: LangKey;
    source: "device" | "detected" | "manual";
    confidence?: number;
  } | null>(null);
  const langRef = useRef<LangKey | null>(null);
  const lastDetected = useRef<LangKey | null>(null);
  const probe = useRef(newProbe());

  const hazardFor = useCallback(
    (text: string): HazardKey | null => {
      if (manualHazard) return manualHazard === "none" ? null : manualHazard;
      return settings.autoDetectHazard
        ? (detectHazard(text)?.key ?? null)
        : null;
    },
    [manualHazard, settings.autoDetectHazard],
  );

  const send = useCallback(
    async (rec: Recording, replaceId?: string) => {
      setSubmission({
        recording: rec,
        report: null,
        stage: "sending",
        error: null,
        coords: null,
      });
      const ext = rec.mimeType.includes("mp4")
        ? "m4a"
        : rec.mimeType.includes("ogg")
          ? "ogg"
          : "webm";
      const fd = new FormData();
      fd.append(
        "audio",
        new File([rec.blob], `sos-${Date.now()}.${ext}`, {
          type: rec.mimeType,
        }),
      );
      // Real GPS from the live location watcher (waits briefly for a first fix).
      const coords: Coords | null = !settings.shareLocation
        ? null
        : settings.demoLocation
          ? DEMO_HOME
          : (location.coords ?? (await location.waitForFix(6000)));
      if (coords) {
        fd.append("lat", String(coords.lat));
        fd.append("lng", String(coords.lng));
        if (!settings.demoLocation)
          fd.append("accuracy", String(Math.round(coords.accuracy)));
      }
      const hazard = hazardFor(rec.transcript);
      if (hazard) {
        fd.append("hazard", hazard);
        // Tell responders whether the caller chose it or we guessed it.
        const picked = manualHazard && manualHazard !== "none";
        fd.append("hazard_source", picked ? "caller" : "voice");
        const guess = picked ? null : detectHazard(rec.transcript);
        if (guess) fd.append("hazard_confidence", String(guess.confidence));
      }
      if (rec.captionConfidence)
        fd.append("caption_confidence", String(rec.captionConfidence));
      if (rec.transcript) fd.append("transcript", rec.transcript);
      fd.append("duration", String(Math.round(rec.durationSec)));
      fd.append("name", "Maria Delgado");
      fd.append("source", "voice");
      if (langRef.current) fd.append("language", langRef.current);
      if (settings.language !== "auto") fd.append("language_forced", "1");

      // Play back the local copy instantly; the server keeps its own copy.
      const base = {
        audioUrl: rec.url,
        sizeKb: Math.round(rec.sizeKb * 10) / 10,
        durationSec: Math.round(rec.durationSec),
        live: true,
      };

      let report: Report;
      let error: string | null = null;
      try {
        const saved = await postReport(fd);
        report = {
          ...saved,
          ...base,
          transcript: saved.transcript || rec.transcript,
        };
        // Start the next recording in the language the server heard.
        if (saved.language) lastDetected.current = saved.language;
      } catch (e) {
        // Keep the person's message even if the uplink or AI is unavailable.
        const guess = classifyLocally(rec.transcript);
        error = e instanceof Error ? e.message : "Upload failed";
        report = {
          ...base,
          hazard,
          assignedTo: null,
          id: `local-${Date.now()}`,
          transcript:
            rec.transcript ||
            "(Audio saved — transcript will be generated when the satellite uplink reconnects.)",
          category: guess.category,
          urgency: guess.urgency,
          description: rec.transcript
            ? rec.transcript.slice(0, 120)
            : "Voice message queued",
          raw_location_text: coords
            ? `GPS ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
            : null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          accuracy: settings.demoLocation ? null : (coords?.accuracy ?? null),
          language: langRef.current,
          created_at: new Date().toISOString(),
          classifiedOnDevice: true,
        };
      }
      onReport(report, replaceId);
      setSubmission({ recording: rec, report, stage: "done", error, coords });
    },
    [
      hazardFor,
      manualHazard,
      onReport,
      location,
      settings.shareLocation,
      settings.demoLocation,
      settings.language,
    ],
  );

  const recorder = useRecorder({
    bitrate: settings.bitrate,
    maxSeconds: 45,
    autoStopOnSilence: settings.autoStopOnSilence,
    // Location comes from the live watcher above, not a separate request.
    shareLocation: false,
    onComplete: send,
  });

  const recording = recorder.status === "recording";
  const requesting = recorder.status === "requesting";
  const heard = PROMPTS.map((p) => p.test.test(recorder.transcript));
  const timeIndex = recorder.elapsed < 5 ? 0 : recorder.elapsed < 11 ? 1 : 2;
  // With live captions, highlight the first thing not yet said; otherwise pace by time.
  const activePrompt = !recording
    ? -1
    : recorder.liveCaptions
      ? heard.findIndex((h) => !h)
      : timeIndex;

  const handlePress = () => {
    if (recording) recorder.stop();
    else if (!requesting) {
      setSubmission(null);
      setManualHazard(null);
      // Start captions in the locked language, the last one we heard, or the device's.
      const first: LangKey =
        settings.language !== "auto"
          ? settings.language
          : (lastDetected.current ?? deviceLanguage());
      langRef.current = first;
      setLang({
        key: first,
        source: settings.language !== "auto" ? "manual" : "device",
      });
      probe.current = newProbe();
      recorder.start(LANGS[first].speech);
    }
  };

  // Auto-detect: once the person has been talking ~3 s, send the audio so far
  // to Whisper. Only switch captions when it's confident; otherwise keep
  // listening and ask again every ~2.5 s (up to 5 times) until it's sure.
  const { elapsed, heardVoice, snapshot, switchLang } = recorder;
  useEffect(() => {
    if (!recording || settings.language !== "auto" || !heardVoice) return;
    const p = probe.current;
    if (p.voiceAt < 0) {
      // Time from the first word, not from the button press (skips silence).
      p.voiceAt = elapsed;
      p.nextAt = elapsed + 3;
    }
    if (p.settled || p.busy || p.count >= 5 || elapsed < p.nextAt) return;
    const blob = snapshot();
    if (!blob) return;
    const speechSec = elapsed - p.voiceAt;
    p.busy = true;
    p.count += 1;
    p.nextAt = elapsed + 2.5;
    const fd = new FormData();
    fd.append("audio", new File([blob], "probe.webm", { type: blob.type }));
    fetch("/api/detect-language", { method: "POST", body: fd })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !isLangKey(d.language)) return;
        // Not sure yet (e.g. only a name or a few words so far): keep listening.
        if (d.confidence < CONFIDENT) return;
        if (d.language !== langRef.current)
          switchLang(LANGS[d.language as LangKey].speech);
        langRef.current = d.language;
        lastDetected.current = d.language;
        setLang({
          key: d.language,
          source: "detected",
          confidence: d.confidence,
        });
        // Very sure after enough speech: stop checking.
        if (d.confidence >= SETTLED && speechSec >= 5) p.settled = true;
      })
      .catch(() => {})
      .finally(() => {
        p.busy = false;
      });
  }, [recording, elapsed, heardVoice, snapshot, switchLang, settings.language]);

  // The voice guess updates live as the caller talks.
  const detection =
    settings.autoDetectHazard && !manualHazard
      ? detectHazard(recorder.transcript)
      : null;
  const serverHazard = submission?.report?.hazard ?? null;
  const hazard: HazardKey | null =
    manualHazard === "none"
      ? null
      : (manualHazard ?? detection?.key ?? serverHazard ?? null);
  const autoPicked = !manualHazard && hazard != null;
  const latest = submission?.report
    ? (myReports.find((r) => r.id === submission.report!.id) ??
      submission.report)
    : null;

  const secs = Math.floor(recorder.elapsed);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        {/* ---- Big red button ---- */}
        <section
          aria-labelledby="sos-title"
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8 xl:col-span-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="sos-title" className="text-lg font-semibold">
                Call for help
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Tap once and talk. It sends{" "}
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  automatically
                </strong>{" "}
                when you stop.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900">
              <SatelliteIcon width={14} height={14} /> Satellite linked ·{" "}
              {Math.round(settings.bitrate / 1000)} kbps
            </span>
          </div>

          {/* Hazard: one tap, optional */}
          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              What&apos;s happening?{" "}
              <span className="normal-case tracking-normal">
                {settings.autoDetectHazard
                  ? "(we pick this from your voice)"
                  : "(optional · one tap)"}
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {HAZARDS.map((h) => {
                const on = hazard === h.key;
                return (
                  <button
                    key={h.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setManualHazard(on ? "none" : h.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                      on
                        ? "border-red-600 bg-red-600 text-white shadow-sm"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span aria-hidden="true">{h.emoji}</span>
                    {h.label}
                    {on && autoPicked && (
                      <span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold tracking-wide uppercase">
                        Auto
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p
              aria-live="polite"
              className="mt-2 flex min-h-5 items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
            >
              {autoPicked && hazard ? (
                <>
                  <MicIcon
                    width={14}
                    height={14}
                    className="shrink-0 text-red-600 dark:text-red-400"
                  />
                  <span>
                    Detected from your voice:{" "}
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {HAZARDS.find((h) => h.key === hazard)?.label}
                    </strong>
                    {detection?.cues.length
                      ? ` — heard “${detection.cues.slice(0, 3).join("”, “")}”`
                      : " — from your last message"}
                    . Tap another if it&apos;s wrong.
                  </span>
                </>
              ) : manualHazard && manualHazard !== "none" ? (
                <span>You picked this. Tap it again to clear.</span>
              ) : settings.autoDetectHazard ? (
                <span>
                  Just talk — say what&apos;s happening and we&apos;ll select it
                  for you.
                </span>
              ) : null}
            </p>
          </fieldset>

          <div className="mt-8 flex flex-col items-center">
            <div className="relative grid place-items-center">
              {/* Voice-reactive halo */}
              {recording && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-red-500/25 transition-transform duration-75"
                  style={{
                    transform: `scale(${1.04 + recorder.level * 0.35})`,
                  }}
                />
              )}
              {!recording && !requesting && (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-red-500/20 motion-safe:animate-ping [animation-duration:2.2s]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -inset-4 rounded-full border-2 border-red-500/20"
                  />
                </>
              )}
              <button
                type="button"
                onClick={handlePress}
                aria-label={
                  recording
                    ? "Stop and send your message now"
                    : "Start recording an emergency voice message"
                }
                className={`relative grid size-64 place-items-center rounded-full text-white shadow-[0_20px_60px_-15px_rgba(220,38,38,0.7)] transition active:scale-[0.97] focus-visible:outline-4 focus-visible:outline-offset-8 focus-visible:outline-red-600 sm:size-72 lg:size-80 ${
                  recording
                    ? "bg-gradient-to-b from-red-600 to-red-800"
                    : "bg-gradient-to-b from-red-500 to-red-700 hover:from-red-500 hover:to-red-600"
                }`}
              >
                <span className="flex flex-col items-center gap-2 px-6 text-center">
                  {recording ? (
                    <>
                      <StopIcon width={44} height={44} />
                      <span className="font-mono text-4xl font-semibold tabular-nums">
                        {clock}
                      </span>
                      <span className="text-sm font-medium text-red-50">
                        {recorder.speaking
                          ? "Listening…"
                          : "Keep talking, or tap to send"}
                      </span>
                    </>
                  ) : requesting ? (
                    <>
                      <MicIcon
                        width={48}
                        height={48}
                        className="motion-safe:animate-pulse"
                      />
                      <span className="text-lg font-semibold">
                        Allow microphone…
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-5xl font-black tracking-tight sm:text-6xl">
                        SOS
                      </span>
                      <span className="flex items-center gap-1.5 text-base font-semibold">
                        <MicIcon width={20} height={20} /> Tap &amp; speak
                      </span>
                      <span className="text-xs font-medium text-red-100">
                        Sends automatically
                      </span>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Live waveform */}
            <div
              className="mt-8 flex h-16 w-full max-w-md items-center justify-center gap-[3px]"
              role="img"
              aria-label={
                recording
                  ? recorder.speaking
                    ? "Microphone is picking up your voice"
                    : "Microphone is on, waiting for your voice"
                  : "Microphone off"
              }
            >
              {recorder.bars.map((b, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-full transition-[height] duration-75 ${recording ? (recorder.speaking ? "bg-red-600 dark:bg-red-500" : "bg-red-300 dark:bg-red-800") : "bg-zinc-200 dark:bg-zinc-700"}`}
                  style={{ height: `${Math.max(6, b * 64)}px` }}
                />
              ))}
            </div>

            {/* Spoken language */}
            {lang && (recording || submission) && (
              <p
                aria-live="polite"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <span aria-hidden="true">🌐</span>
                {lang.source === "detected" ? (
                  <>
                    Language detected:{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {LANGS[lang.key].native}
                    </strong>
                  </>
                ) : lang.source === "manual" ? (
                  <>
                    Listening in{" "}
                    <strong className="text-zinc-900 dark:text-white">
                      {LANGS[lang.key].native}
                    </strong>{" "}
                    (set in Settings)
                  </>
                ) : (
                  <>
                    Listening in {LANGS[lang.key].native} — detecting your
                    language…
                  </>
                )}
              </p>
            )}

            {/* Live captions */}
            <div
              aria-live="polite"
              className="mt-3 min-h-[3.5rem] w-full max-w-xl text-center"
            >
              {recording ? (
                recorder.transcript ? (
                  <p className="text-lg leading-snug text-zinc-800 dark:text-zinc-100">
                    “{recorder.transcript}”
                  </p>
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {recorder.liveCaptions
                      ? recorder.speaking
                        ? "Hearing you…"
                        : "Start talking — your words will appear here."
                      : "Recording your voice. Words appear after it's sent (live captions need Chrome or Edge)."}
                  </p>
                )
              ) : recorder.error ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200"
                >
                  {recorder.error}
                </p>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Your voice is compressed to about{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">
                    1.5 KB per second
                  </strong>{" "}
                  so it gets through even on a weak satellite link.
                </p>
              )}
            </div>

            {!recording && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onCheckInSafe}
                  disabled={safeStatus === "sending"}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                >
                  {safeStatus === "sent" ? (
                    <CheckIcon width={16} height={16} />
                  ) : (
                    <ShieldIcon width={16} height={16} />
                  )}
                  {safeStatus === "sent"
                    ? "Family told you're safe"
                    : safeStatus === "sending"
                      ? "Telling your family…"
                      : "I'm safe — tell my family"}
                </button>
                <button
                  type="button"
                  onClick={onOpenFamily}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <UsersIcon width={16} height={16} /> Family Circle
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---- Right column: what to say + delivery status ---- */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <section
            aria-labelledby="say-title"
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 id="say-title" className="text-lg font-semibold">
              Say these 3 things
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Short is fine. We&apos;ll sort the rest.
            </p>
            <ol className="mt-4 space-y-3">
              {PROMPTS.map((p, i) => {
                const active = activePrompt === i;
                const done = recording && heard[i];
                return (
                  <li
                    key={p.key}
                    className={`flex gap-4 rounded-xl border p-4 transition ${
                      active
                        ? "border-red-500 bg-red-50 ring-2 ring-red-500/30 dark:border-red-500 dark:bg-red-950/40"
                        : done
                          ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/40"
                    }`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-black ${
                        done
                          ? "bg-emerald-600 text-white"
                          : active
                            ? "bg-red-600 text-white"
                            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      }`}
                    >
                      {done ? <CheckIcon width={20} height={20} /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-extrabold uppercase tracking-tight text-zinc-950 dark:text-white">
                        {p.label}
                      </p>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {p.hint}
                      </p>
                      <p className="mt-1 text-sm italic text-zinc-500 dark:text-zinc-400">
                        {p.example}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <DeliveryCard
            submission={
              submission && latest
                ? { ...submission, report: latest }
                : submission
            }
            coords={submission?.coords ?? null}
            demo={settings.demoLocation}
            location={location}
            shareLocation={settings.shareLocation}
            onRetry={() =>
              submission && send(submission.recording, submission.report?.id)
            }
          />
        </div>
      </div>

      {myReports.length > 0 && (
        <section
          aria-labelledby="mine-title"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 id="mine-title" className="text-lg font-semibold">
            Your messages
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Every recording is kept here so you and responders can replay it.
          </p>
          <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
            {myReports.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 py-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={r.category} />
                    <UrgencyBadge urgency={r.urgency} />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Sent {fmtClock(r.created_at)}
                      {r.assignedAt
                        ? ` · ${r.assignedTo} responded ${fmtClock(r.assignedAt)} (${fmtDuration(responseTime(r)!)} later)`
                        : " · waiting for a responder"}
                      {r.sizeKb ? ` · ${r.sizeKb} KB` : ""}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {r.transcript}
                  </p>
                </div>
                {r.audioUrl && (
                  <audio
                    controls
                    src={r.audioUrl}
                    className="h-10 w-full md:w-72"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DeliveryCard({
  submission,
  coords,
  demo,
  location,
  shareLocation,
  onRetry,
}: {
  submission: Submission | null;
  coords: Coords | null;
  demo: boolean;
  location: LiveLocation;
  shareLocation: boolean;
  onRetry: () => void;
}) {
  if (!submission) {
    return (
      <LocationCard
        location={location}
        demo={demo}
        shareLocation={shareLocation}
      />
    );
  }

  const { recording, report, stage, error } = submission;
  const done = stage === "done";
  const failed = done && !!error;
  const steps: { label: string; detail: string; state: StepState }[] = [
    {
      label: "Recorded",
      detail: `${recording.durationSec.toFixed(0)} sec`,
      state: "done",
    },
    {
      label: "Compressed",
      detail: `${recording.sizeKb.toFixed(1)} KB · Opus`,
      state: "done",
    },
    failed
      ? {
          label: "Couldn't reach server",
          detail: "Saved on this phone",
          state: "failed",
        }
      : {
          label: "Sent via satellite",
          detail: coords
            ? demo
              ? "with demo location"
              : `with GPS · ±${Math.round(coords.accuracy)} m`
            : "no GPS fix · using your words",
          state: done ? "done" : "active",
        },
    failed
      ? {
          label: "Sorted on this device",
          detail: report ? CATEGORIES[report.category].label : "…",
          state: "done",
        }
      : {
          label:
            report?.language && report.language !== "en"
              ? `Heard ${LANGS[report.language].native} · translated`
              : report?.classifiedOnDevice
                ? "Transcribed & sorted"
                : "Transcribed & sorted by Grok",
          detail: report ? CATEGORIES[report.category].label : "…",
          state: done ? "done" : "waiting",
        },
    {
      label: "Responders notified",
      detail: failed ? "After it's sent" : "Pinned on dispatcher map",
      state: done && !failed ? "done" : "waiting",
    },
    ...(done && !failed
      ? [
          report?.assignedTo
            ? {
                label: `${report.assignedTo} is on the way`,
                detail: report.assignedAt
                  ? `Responded ${fmtClock(report.assignedAt)} · ${fmtDuration(responseTime(report)!)} after you asked`
                  : "Stay where you are",
                state: "done" as StepState,
              }
            : {
                label: "Waiting for a responder",
                detail: "You'll see who's coming here",
                state: "active" as StepState,
              },
        ]
      : []),
  ];

  return (
    <section
      aria-live="polite"
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {failed
            ? "Saved — not sent yet"
            : done
              ? "Help request delivered"
              : "Sending your message…"}
        </h2>
        {failed ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            <RefreshIcon width={14} height={14} /> Send again
          </button>
        ) : (
          done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
              <CheckIcon width={14} height={14} /> Sent
            </span>
          )
        )}
      </div>
      {report && !failed && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Received by responders at{" "}
          <time
            dateTime={report.created_at}
            className="font-medium text-zinc-700 dark:text-zinc-300"
          >
            {fmtClock(report.created_at, true)}
          </time>{" "}
          on {fmtDate(report.created_at)}
        </p>
      )}

      <ol className="mt-4 space-y-2.5">
        {steps.map((s, i) => {
          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full ${
                  s.state === "done"
                    ? "bg-emerald-600 text-white"
                    : s.state === "failed"
                      ? "bg-amber-500 text-white"
                      : s.state === "active"
                        ? "border-2 border-red-600 border-t-transparent motion-safe:animate-spin"
                        : "border-2 border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {s.state === "done" && <CheckIcon width={14} height={14} />}
                {s.state === "failed" && <AlertIcon width={13} height={13} />}
              </span>
              <span
                className={`font-medium ${s.state === "done" || s.state === "failed" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
              >
                {s.label}
              </span>
              <span className="ml-auto text-right text-xs text-zinc-500 dark:text-zinc-400">
                {s.detail}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Your recording
        </p>
        <audio controls src={recording.url} className="h-10 w-full" />
      </div>

      {report?.latitude != null && report.longitude != null && (
        <YourLocation report={report} demo={demo} />
      )}

      {report && (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={report.category} />
            <UrgencyBadge urgency={report.urgency} />
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            “{report.transcript}”
          </p>
          {report.transcriptEn && (
            <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
              <span className="block text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {report.language ? `${LANGS[report.language].english} → ` : ""}
                English for responders
              </span>
              “{report.transcriptEn}”
            </p>
          )}
          {error && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Uplink unavailable ({error}). Your recording is saved on this
              phone — tap Send again when you have signal.
            </p>
          )}
          {!error && (
            <Link
              href={`/responder?report=${report.id}`}
              target="_blank"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline dark:text-red-400"
            >
              <PinIcon width={16} height={16} /> See what responders see ↗
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function YourLocation({ report, demo }: { report: Report; demo: boolean }) {
  const pins = useMemo<MapPin[]>(
    () => [
      {
        kind: "avatar",
        id: "me",
        lat: report.latitude!,
        lng: report.longitude!,
        initials: "MD",
        label: "You",
        ring: "#dc2626",
        pulse: true,
        accuracy: report.accuracy,
      },
    ],
    [report.latitude, report.longitude, report.accuracy],
  );
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <LeafletMap
        ariaLabel="Map showing the location you sent"
        className="h-44"
        pins={pins}
        fitKey={`${report.latitude},${report.longitude}`}
        maxFitZoom={16}
      />
      <p className="flex items-start gap-1.5 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
        <PinIcon width={14} height={14} className="mt-px shrink-0" />
        <span>
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
            {demo ? "Demo location sent" : "Your GPS location was sent"}
          </strong>
          {" · "}
          {report.gpsAddress ??
            `${report.latitude!.toFixed(5)}, ${report.longitude!.toFixed(5)}`}
          {report.accuracy ? ` · ±${Math.round(report.accuracy)} m` : ""}
        </span>
      </p>
    </div>
  );
}

function LocationCard({
  location,
  demo,
  shareLocation,
}: {
  location: LiveLocation;
  demo: boolean;
  shareLocation: boolean;
}) {
  const coords = !shareLocation ? null : demo ? DEMO_HOME : location.coords;
  const pins = useMemo<MapPin[]>(
    () =>
      coords
        ? [
            {
              kind: "avatar",
              id: "me",
              lat: coords.lat,
              lng: coords.lng,
              initials: "MD",
              label: "You",
              ring: "#2a78d6",
              accuracy: demo ? null : coords.accuracy,
            },
          ]
        : [],
    [coords, demo],
  );
  const help = demo ? null : locationHelp(location.status);
  return (
    <section
      aria-labelledby="loc-title"
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <h2 id="loc-title" className="text-lg font-semibold">
          Your location
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            coords
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
              : help
                ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${coords ? "bg-emerald-500 motion-safe:animate-pulse" : help ? "bg-amber-500" : "bg-zinc-400 motion-safe:animate-pulse"}`}
          />
          {coords
            ? demo
              ? "Demo location"
              : `GPS · ±${Math.round(coords.accuracy)} m`
            : help
              ? "Not available"
              : "Finding you…"}
        </span>
      </div>
      {coords ? (
        <LeafletMap
          ariaLabel="Map showing where you are right now"
          className="h-48"
          pins={pins}
          fitKey={`${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`}
          maxFitZoom={16}
        />
      ) : (
        <div className="grid h-48 place-items-center bg-zinc-50 px-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400">
          {help ?? "Waiting for your device's GPS…"}
        </div>
      )}
      <div className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">
          {coords ? (
            <>
              <PinIcon
                width={14}
                height={14}
                className="mr-1 inline align-[-2px]"
              />
              {demo
                ? DEMO_HOME.label
                : (location.address ??
                  `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)}
              <span className="block text-xs text-zinc-500">
                Sent automatically with your SOS
              </span>
            </>
          ) : (
            "Responders will use the address you say out loud."
          )}
        </p>
        {!demo && help && location.status !== "off" && (
          <button
            type="button"
            onClick={location.retry}
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}
