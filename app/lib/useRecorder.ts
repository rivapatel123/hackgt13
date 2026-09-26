"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in lib.dom for all TS versions).
type SpeechResultList = ArrayLike<{
  isFinal: boolean;
  0: { transcript: string; confidence?: number };
}>;
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition() {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type Recording = {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
  sizeKb: number;
  transcript: string;
  captionConfidence: number | null; // browser recognizer's average confidence
  coords: { lat: number; lng: number; accuracy: number } | null;
};

export type RecorderStatus = "idle" | "requesting" | "recording" | "error";

const BAR_COUNT = 40;
const SPEAKING_RMS = 0.035;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "";
}

export function useRecorder(opts: {
  bitrate: number;
  maxSeconds: number;
  autoStopOnSilence: boolean;
  shareLocation: boolean;
  lang?: string;
  onComplete: (r: Recording) => void;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveCaptions, setLiveCaptions] = useState(true);
  const [captionLang, setCaptionLang] = useState<string | null>(null);
  const [heardVoice, setHeardVoice] = useState(false);
  const [coords, setCoords] = useState<Recording["coords"]>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const lastVoiceRef = useRef(0);
  const heardVoiceRef = useRef(false);
  const finalTextRef = useRef("");
  const confRef = useRef<number[]>([]);
  const interimRef = useRef("");
  const coordsRef = useRef<Recording["coords"]>(null);
  const coordsPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    try {
      recogRef.current?.stop();
    } catch {}
    recogRef.current = null;
  }, []);

  // (Re)start live captions in a given language.
  const beginCaptions = useCallback((lang: string) => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const old = recogRef.current;
    recogRef.current = null;
    try {
      old?.abort();
    } catch {}
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = lang;
    recog.onresult = (e) => {
      if (recogRef.current !== recog) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalTextRef.current += ` ${r[0].transcript}`;
          const c = r[0].confidence;
          if (typeof c === "number" && c > 0) confRef.current.push(c);
        }
        else interim += r[0].transcript;
      }
      interimRef.current = interim;
      setTranscript(
        `${finalTextRef.current} ${interim}`.replace(/\s+/g, " ").trim(),
      );
    };
    recog.onerror = () => {};
    recog.onend = () => {
      // Chrome ends recognition after pauses; keep it going while recording.
      if (activeRef.current && recogRef.current === recog) {
        try {
          recog.start();
        } catch {}
      }
    };
    recogRef.current = recog;
    setCaptionLang(lang);
    try {
      recog.start();
    } catch {}
  }, []);

  /** Switch live captions to the detected language mid-recording. */
  const switchLang = useCallback(
    (lang: string) => {
      if (!activeRef.current) return;
      // Words so far were decoded in the wrong language — start clean.
      finalTextRef.current = "";
      confRef.current = [];
      interimRef.current = "";
      setTranscript("");
      beginCaptions(lang);
    },
    [beginCaptions],
  );

  /** The audio recorded so far (for a quick language check). */
  const snapshot = useCallback(() => {
    if (!chunksRef.current.length) return null;
    return new Blob(chunksRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(
    async (lang?: string) => {
      if (activeRef.current) return;
      setError(null);
      setTranscript("");
      setElapsed(0);
      setCoords(null);
      setGeoError(null);
      coordsPromiseRef.current = Promise.resolve();
      finalTextRef.current = "";
      confRef.current = [];
      interimRef.current = "";
      coordsRef.current = null;
      heardVoiceRef.current = false;
      setHeardVoice(false);

      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        setStatus("error");
        setError(
          "This browser can't record audio. Try Chrome, Safari, or Edge.",
        );
        return;
      }

      setStatus("requesting");

      // Location is requested in parallel so it never delays the recording.
      if (optsRef.current.shareLocation && navigator.geolocation) {
        coordsPromiseRef.current = new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              coordsRef.current = {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy: p.coords.accuracy,
              };
              setCoords(coordsRef.current);
              resolve();
            },
            (err) => {
              setGeoError(
                err.code === err.PERMISSION_DENIED
                  ? "Location is blocked — allow it in your browser so responders can find you."
                  : "Couldn't get a GPS fix — responders will use the address you said.",
              );
              resolve();
            },
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
          );
        });
      } else if (optsRef.current.shareLocation) {
        setGeoError("This device can't share its location.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });
      } catch {
        setStatus("error");
        setError(
          "Microphone access was blocked. Allow the microphone in your browser's address bar, then tap the button again.",
        );
        return;
      }
      streamRef.current = stream;
      activeRef.current = true;

      // --- Recorder (compressed Opus at a very low bitrate) ---
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: optsRef.current.bitrate,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const durationSec = (performance.now() - startedAtRef.current) / 1000;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const text = `${finalTextRef.current} ${interimRef.current}`
          .replace(/\s+/g, " ")
          .trim();
        cleanup();
        setStatus("idle");
        setLevel(0);
        setSpeaking(false);
        setBars(Array(BAR_COUNT).fill(0));
        // Give a slow GPS fix a few more seconds so the pin is exact.
        if (!coordsRef.current) {
          await Promise.race([
            coordsPromiseRef.current,
            new Promise((r) => setTimeout(r, 6000)),
          ]);
        }
        optsRef.current.onComplete({
          blob,
          url: URL.createObjectURL(blob),
          mimeType: type,
          durationSec,
          sizeKb: blob.size / 1024,
          transcript: text,
          captionConfidence: confRef.current.length
            ? confRef.current.reduce((a, b) => a + b, 0) / confRef.current.length
            : null,
          coords: coordsRef.current,
        });
      };
      recorderRef.current = recorder;

      // --- Live level meter ---
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;
      // Safari (and Chrome without a fresh tap) can start the context suspended.
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const timeData = new Float32Array(analyser.fftSize);
      const history: number[] = Array(BAR_COUNT).fill(0);
      let lastPush = 0;

      const tick = (now: number) => {
        if (!activeRef.current) return;
        analyser.getFloatTimeDomainData(timeData);
        let sum = 0;
        for (let i = 0; i < timeData.length; i++)
          sum += timeData[i] * timeData[i];
        const rms = Math.sqrt(sum / timeData.length);
        const norm = Math.min(1, rms * 6);
        const isVoice = rms > SPEAKING_RMS;
        if (isVoice) {
          lastVoiceRef.current = now;
          if (!heardVoiceRef.current) setHeardVoice(true);
          heardVoiceRef.current = true;
        }
        if (now - lastPush > 70) {
          history.shift();
          history.push(norm);
          lastPush = now;
          setBars([...history]);
        }
        setLevel(norm);
        setSpeaking(now - lastVoiceRef.current < 350);

        const secs = (now - startedAtRef.current) / 1000;
        setElapsed(secs);
        const o = optsRef.current;
        if (secs >= o.maxSeconds) {
          stop();
          return;
        }
        // Auto-send: stop after ~3.5s of silence once the person has spoken.
        if (
          o.autoStopOnSilence &&
          heardVoiceRef.current &&
          secs > 6 &&
          now - lastVoiceRef.current > 3500
        ) {
          stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      // --- Live captions (Web Speech API, where available) ---
      setLiveCaptions(!!getSpeechRecognition());
      beginCaptions(lang ?? optsRef.current.lang ?? "en-US");

      startedAtRef.current = performance.now();
      lastVoiceRef.current = startedAtRef.current;
      recorder.start(250);
      setStatus("recording");
      rafRef.current = requestAnimationFrame(tick);
    },
    [cleanup, stop, beginCaptions],
  );

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    error,
    elapsed,
    bars,
    level,
    speaking,
    transcript,
    liveCaptions,
    coords,
    geoError,
    captionLang,
    heardVoice,
    switchLang,
    snapshot,
    start,
    stop,
  };
}
