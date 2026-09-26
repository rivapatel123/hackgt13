"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API (not in lib.dom for all TS versions).
type SpeechResultList = ArrayLike<{
  isFinal: boolean;
  0: { transcript: string };
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
};

export type Recording = {
  blob: Blob;
  url: string;
  mimeType: string;
  durationSec: number;
  sizeKb: number;
  transcript: string;
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
  const [coords, setCoords] = useState<Recording["coords"]>(null);

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
  const interimRef = useRef("");
  const coordsRef = useRef<Recording["coords"]>(null);
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

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (activeRef.current) return;
    setError(null);
    setTranscript("");
    setElapsed(0);
    setCoords(null);
    finalTextRef.current = "";
    interimRef.current = "";
    coordsRef.current = null;
    heardVoiceRef.current = false;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("error");
      setError("This browser can't record audio. Try Chrome, Safari, or Edge.");
      return;
    }

    setStatus("requesting");

    // Location is requested in parallel so it never delays the recording.
    if (optsRef.current.shareLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          coordsRef.current = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          };
          setCoords(coordsRef.current);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      );
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
    recorder.onstop = () => {
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
      optsRef.current.onComplete({
        blob,
        url: URL.createObjectURL(blob),
        mimeType: type,
        durationSec,
        sizeKb: blob.size / 1024,
        transcript: text,
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
    const SR =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).webkitSpeechRecognition;
    setLiveCaptions(!!SR);
    if (SR) {
      const recog = new SR();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = "en-US";
      recog.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalTextRef.current += ` ${r[0].transcript}`;
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
      try {
        recog.start();
      } catch {}
    }

    startedAtRef.current = performance.now();
    lastVoiceRef.current = startedAtRef.current;
    recorder.start(250);
    setStatus("recording");
    rafRef.current = requestAnimationFrame(tick);
  }, [cleanup, stop]);

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
    start,
    stop,
  };
}
