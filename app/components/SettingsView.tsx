"use client";

import type { ReactNode } from "react";
import type { ThemeChoice } from "@/app/lib/theme";
import { LANGS, type LangKey } from "@/app/lib/data";

export type AppSettings = {
  bitrate: number;
  autoStopOnSilence: boolean;
  shareLocation: boolean;
  shareMedicalId: boolean;
  language: "auto" | LangKey;
  autoDetectHazard: boolean;
  demoLocation: boolean;
};


export const DEFAULT_SETTINGS: AppSettings = {
  bitrate: 12_000,
  autoStopOnSilence: true,
  shareLocation: true,
  shareMedicalId: true,
  language: "auto",
  autoDetectHazard: true,
  demoLocation: false,
};

const BITRATES = [
  {
    value: 6_000,
    label: "Ultra-low",
    note: "6 kbps · ~7 KB per 10 s · weakest links",
  },
  {
    value: 12_000,
    label: "Low",
    note: "12 kbps · ~15 KB per 10 s · recommended",
  },
  { value: 24_000, label: "Clear", note: "24 kbps · ~30 KB per 10 s" },
];

function Row({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-lg">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
        checked ? "bg-red-600" : "bg-zinc-300 dark:bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

export default function SettingsView({
  settings,
  onChange,
  theme,
  onThemeChange,
  mode = "civilian",
  dispatch,
  onDispatchChange,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
  theme: ThemeChoice;
  onThemeChange: (t: ThemeChoice) => void;
  mode?: "civilian" | "responder";
  dispatch?: DispatchPrefs;
  onDispatchChange?: (p: DispatchPrefs) => void;
}) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {mode === "responder" ? (
        <DispatchSettings
          prefs={dispatch ?? { liveFeed: true, urgentAlerts: true }}
          onChange={(p) => onDispatchChange?.(p)}
        />
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="pt-3 text-lg font-semibold">Voice messages</h2>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="py-4">
              <p className="font-medium">Compression</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Lower bitrate = smaller message = better odds over a congested
                satellite link.
              </p>
              <div
                role="radiogroup"
                aria-label="Audio compression"
                className="mt-3 grid gap-2 sm:grid-cols-3"
              >
                {BITRATES.map((b) => {
                  const on = settings.bitrate === b.value;
                  return (
                    <button
                      key={b.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set("bitrate", b.value)}
                      className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 ${
                        on
                          ? "border-red-600 bg-red-50 ring-1 ring-red-600 dark:bg-red-950/40"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <p className="font-semibold">{b.label}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {b.note}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            <Row
              title="Send automatically when I stop talking"
              desc="After ~3 seconds of silence your message is sent. No extra buttons."
            >
              <Toggle
                label="Auto-send on silence"
                checked={settings.autoStopOnSilence}
                onChange={(v) => set("autoStopOnSilence", v)}
              />
            </Row>
            <Row
              title="Detect the disaster from my voice"
              desc="We listen for words like “water rising” or “shaking” and pick the disaster type for you."
            >
              <Toggle
                label="Auto-detect disaster type"
                checked={settings.autoDetectHazard}
                onChange={(v) => set("autoDetectHazard", v)}
              />
            </Row>
            <Row
              title="Attach my GPS location"
              desc="Your phone\'s exact position is sent with every message so responders can pin you, even if you can\'t say where you are."
            >
              <Toggle
                label="Share location"
                checked={settings.shareLocation}
                onChange={(v) => set("shareLocation", v)}
              />
            </Row>
            <Row
              title="Demo location (Tampa Bay scenario)"
              desc="Off by default — your real GPS position is sent. Turn on only if GPS isn't available; it places you at 412 Bayshore Blvd, Tampa."
            >
              <Toggle
                label="Use demo location"
                checked={settings.demoLocation}
                onChange={(v) => set("demoLocation", v)}
              />
            </Row>
            <Row
              title="Share my Medical ID with responders"
              desc="Blood type, conditions, medications and allergies travel with your request."
            >
              <Toggle
                label="Share Medical ID"
                checked={settings.shareMedicalId}
                onChange={(v) => set("shareMedicalId", v)}
              />
            </Row>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="pt-3 text-lg font-semibold">Display & language</h2>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          <Row
            title="Appearance"
            desc="Dark mode saves battery on OLED phones."
          >
            <div
              role="radiogroup"
              aria-label="Theme"
              className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700"
            >
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={theme === t}
                  onClick={() => onThemeChange(t)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                    theme === t
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row
            title="Spoken language"
            desc="Auto-detect listens for English, French, Mandarin or Spanish and switches for you. Pick one to lock it."
          >
            <select
              value={settings.language}
              onChange={(e) =>
                set("language", e.target.value as AppSettings["language"])
              }
              aria-label="Spoken language"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="auto">Auto-detect (recommended)</option>
              {(Object.keys(LANGS) as LangKey[]).map((k) => (
                <option key={k} value={k}>
                  {LANGS[k].native}
                  {LANGS[k].native !== LANGS[k].english
                    ? ` — ${LANGS[k].english}`
                    : ""}
                </option>
              ))}
            </select>
          </Row>
          <Row
            title="Satellite link"
            desc="Direct-to-Cell · connected · last sync 14 seconds ago"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-500" /> Online
            </span>
          </Row>
        </div>
      </section>
    </div>
  );
}

export type DispatchPrefs = { liveFeed: boolean; urgentAlerts: boolean };

function DispatchSettings({
  prefs,
  onChange,
}: {
  prefs: DispatchPrefs;
  onChange: (p: DispatchPrefs) => void;
}) {
  const toggle = (k: keyof DispatchPrefs) => (v: boolean) =>
    onChange({ ...prefs, [k]: v });
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="pt-3 text-lg font-semibold">Dispatch</h2>
      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        <Row
          title="Live message feed"
          desc="Checks for new voice messages every few seconds and pins them on the map."
        >
          <Toggle
            label="Live feed"
            checked={prefs.liveFeed}
            onChange={toggle("liveFeed")}
          />
        </Row>
        <Row
          title="Pop-up alert for new requests"
          desc="Shows a banner when a new message arrives from the field."
        >
          <Toggle
            label="New request alerts"
            checked={prefs.urgentAlerts}
            onChange={toggle("urgentAlerts")}
          />
        </Row>
      </div>
    </section>
  );
}
