"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  DEMO_NOW,
  INCIDENT_STATS,
  LANGS,
  HAZARDS,
  fmtClock,
  fmtDate,
  fmtDuration,
  responseTime,
  RESPONDER_UNITS,
  timeAgo,
  type CategoryKey,
  type Report,
} from "@/app/lib/data";
import LeafletMap, { type MapPin } from "@/app/components/LeafletMap";
import type { Coords } from "@/app/lib/location";
import { distanceMetres } from "@/app/lib/useLiveLocation";
import {
  CategoryBadge,
  CategoryDot,
  UrgencyBadge,
} from "@/app/components/Badges";
import {
  AlertIcon,
  CheckIcon,
  PinIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "@/app/components/icons";

const URGENCY_RANK = { high: 0, medium: 1, low: 2 } as const;

// Demo reports are relative to the scenario clock; live ones to the real clock.
function when(r: Report, now: number) {
  return timeAgo(r.created_at, r.live ? now : DEMO_NOW);
}

export default function MapView({
  reports,
  selectedId,
  onSelect,
  onAssign,
  onDelete,
  now,
  me = null,
}: {
  me?: { coords: Coords | null; help: string | null } | null;
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAssign: (id: string, unit: string | null) => void;
  onDelete: (id: string) => void;
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Set<CategoryKey>>(new Set());
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [fitKey, setFitKey] = useState(0);

  const counts = useMemo(() => {
    const c = new Map<CategoryKey, number>();
    reports.forEach((r) => c.set(r.category, (c.get(r.category) ?? 0) + 1));
    return c;
  }, [reports]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports
      .filter((r) => (cats.size ? cats.has(r.category) : true))
      .filter((r) => (urgentOnly ? r.urgency === "high" : true))
      .filter((r) =>
        q
          ? [
              r.transcript,
              r.transcriptEn,
              r.raw_location_text,
              r.description,
              r.name,
              CATEGORIES[r.category].label,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort(
        (a, b) =>
          Number(!!b.live) - Number(!!a.live) ||
          URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
          b.created_at.localeCompare(a.created_at),
      );
  }, [reports, cats, urgentOnly, query]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const myCoords = me?.coords ?? null;
  const pins = useMemo<MapPin[]>(
    () =>
      filtered
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => {
          const c = CATEGORIES[r.category];
          return {
            kind: "dot" as const,
            id: r.id,
            lat: r.latitude!,
            lng: r.longitude!,
            color: c.color,
            darkColor: c.darkColor,
            radius: r.urgency === "high" || r.live ? 9 : 7,
            pulse: !!r.live || (r.urgency === "high" && !r.assignedTo),
            tooltip: `${c.label} · ${r.description}`,
            accuracy: r.id === selectedId ? r.accuracy : null,
          } as MapPin;
        })
        // The responder's own live position.
        .concat(
          myCoords
            ? [
                {
                  kind: "avatar",
                  id: "__me",
                  lat: myCoords.lat,
                  lng: myCoords.lng,
                  initials: "JO",
                  label: "You",
                  ring: "#2a78d6",
                  accuracy: myCoords.accuracy,
                },
              ]
            : [],
        ),
    [filtered, selectedId, myCoords],
  );

  const toggleCat = (k: CategoryKey) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const catKeys = (Object.keys(CATEGORIES) as CategoryKey[]).filter((k) =>
    counts.get(k),
  );

  return (
    <div className="space-y-4">
      {/* Filters in one row above the map */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center dark:border-zinc-800 dark:bg-zinc-900">
        <label className="relative w-full shrink-0 lg:w-72">
          <span className="sr-only">Search messages</span>
          <SearchIcon
            width={16}
            height={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: insulin, Brandon, boat, missing…"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pr-3 pl-9 text-sm placeholder:text-zinc-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by need"
        >
          {catKeys.map((k) => {
            const on = cats.has(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  on
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <CategoryDot category={k} />
                {CATEGORIES[k].short}
                <span className="tabular-nums opacity-70">{counts.get(k)}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={urgentOnly}
            onClick={() => setUrgentOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              urgentOnly
                ? "border-red-600 bg-red-600 text-white"
                : "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
            }`}
          >
            <AlertIcon width={14} height={14} /> Urgent only
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Map */}
        <section
          aria-label="Map of help requests"
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm xl:col-span-2 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800">
            <p className="font-medium">
              Live map · <span className="tabular-nums">{pins.length}</span>{" "}
              pins at their GPS positions
            </p>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-zinc-500 sm:block dark:text-zinc-400">
                Sample of {INCIDENT_STATS.pinned.toLocaleString()} located
                messages
              </p>
              {me && (
                <p
                  className={`hidden text-xs md:block ${me.coords ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                  title={me.help ?? undefined}
                >
                  {me.coords
                    ? `● You: ±${Math.round(me.coords.accuracy)} m`
                    : "● Your location: off"}
                </p>
              )}
              <button
                type="button"
                onClick={() => setFitKey((k) => k + 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Show all pins
              </button>
            </div>
          </div>
          <div className="relative">
            <LeafletMap
              ariaLabel="Street map with help-request pins"
              className="h-[26rem] sm:h-[32rem] xl:h-[38rem]"
              pins={pins}
              selectedId={selectedId}
              onSelect={onSelect}
              fitKey={fitKey}
              maxFitZoom={12}
            />
            {/* Legend */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-7rem)] flex-wrap gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-xs backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
              {catKeys.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <CategoryDot category={k} /> {CATEGORIES[k].short}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                Large pin = urgent · blue ring = GPS accuracy
              </span>
            </div>
          </div>
        </section>

        {/* Detail / list */}
        <div className="relative min-h-[28rem]">
          <section
            aria-label="Help requests"
            className="flex max-h-[46rem] flex-col xl:absolute xl:inset-0 xl:max-h-none overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {selected ? (
              <Detail
                report={selected}
                onClose={() => onSelect(null)}
                onAssign={onAssign}
                now={now}
                me={me?.coords ?? null}
              />
            ) : (
              <>
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <p className="font-semibold">
                    {filtered.length} request{filtered.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Urgent first · tap one to open
                  </p>
                </div>
                <ul className="flex-1 divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
                  {filtered.slice(0, 60).map((r) => (
                    <li key={r.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => onSelect(r.id)}
                        className="flex w-full gap-3 px-4 py-3 pr-10 text-left transition hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
                      >
                        <CategoryDot category={r.category} className="mt-1.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {r.description}
                            </span>
                            {r.live && (
                              <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                NEW
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {r.raw_location_text ?? "Location pending"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                            <time dateTime={r.created_at}>
                              {fmtClock(r.created_at)}
                            </time>{" "}
                            · {when(r, now)}
                            {r.assignedAt ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                {" "}
                                · ✓ responded in {fmtDuration(responseTime(r)!)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                          {r.urgency === "high" && (
                            <span className="text-[10px] font-bold text-red-600 uppercase dark:text-red-400">
                              Urgent
                            </span>
                          )}
                          {lowestConfidence(r) < LOW && (
                            <span
                              className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                              title="The AI is unsure about part of this message — check the recording"
                            >
                              ⚠ Verify
                            </span>
                          )}
                        </span>
                      </button>
                      {/* Demo cleanup: only appears on hover */}
                      <button
                        type="button"
                        onClick={() => onDelete(r.id)}
                        aria-label={`Delete message: ${r.description}`}
                        title="Delete"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-100 hover:text-red-600 focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="px-4 py-10 text-center text-sm text-zinc-500">
                      No messages match these filters.
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({
  report: r,
  onClose,
  onAssign,
  now,
  me,
}: {
  report: Report;
  onClose: () => void;
  onAssign: (id: string, unit: string | null) => void;
  now: number;
  me: Coords | null;
}) {
  const away =
    me && r.latitude != null && r.longitude != null
      ? distanceMetres(me, { lat: r.latitude, lng: r.longitude!, accuracy: 0 })
      : null;
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={r.category} />
          <UrgencyBadge urgency={r.urgency} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to list"
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <XIcon width={18} height={18} />
        </button>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-base font-semibold">{r.description}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <PinIcon width={14} height={14} className="shrink-0" />{" "}
            {r.raw_location_text ?? "Location pending"}
          </p>
          {r.latitude != null && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                GPS:
              </span>{" "}
              {r.latitude.toFixed(5)}, {r.longitude!.toFixed(5)}
              {r.accuracy ? ` · ±${Math.round(r.accuracy)} m` : ""}
              {r.gpsAddress && r.gpsAddress !== r.raw_location_text
                ? ` · near ${r.gpsAddress}`
                : ""}
            </p>
          )}
          {away != null && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {away < 1000
                ? `${Math.round(away)} m`
                : `${(away / 1000).toFixed(1)} km`}{" "}
              from you
            </p>
          )}
        </div>

        {/* When the message came in, and when someone answered it */}
        <ol className="space-y-2 border-l-2 border-zinc-200 pl-3 text-sm dark:border-zinc-700">
          <li>
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Message received
            </p>
            <p className="font-medium tabular-nums">
              <time dateTime={r.created_at}>
                {fmtClock(r.created_at, true)} · {fmtDate(r.created_at)}
              </time>{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                ({when(r, now)})
              </span>
            </p>
          </li>
          <li>
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Responder assigned
            </p>
            {r.assignedAt ? (
              <p className="font-medium tabular-nums">
                <time dateTime={r.assignedAt}>
                  {fmtClock(r.assignedAt, true)}
                </time>{" "}
                <span className="font-normal text-emerald-700 dark:text-emerald-400">
                  · {r.assignedTo} · {fmtDuration(responseTime(r)!)} after the
                  message
                </span>
              </p>
            ) : (
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Not yet ·{" "}
                {fmtDuration(
                  (r.live ? now : DEMO_NOW) - Date.parse(r.created_at),
                )}{" "}
                waiting
              </p>
            )}
          </li>
        </ol>

        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Transcript
            {r.language && r.language !== "en" && (
              <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-sky-900 normal-case dark:bg-sky-950 dark:text-sky-200">
                🌐 Spoken in {LANGS[r.language].english} (
                {LANGS[r.language].native})
              </span>
            )}
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            “<TranscriptWords report={r} />”
          </p>
          {r.words?.some((w) => w.p < LOW) && (
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-2">
                Dotted words
              </span>{" "}
              = the AI wasn&apos;t sure it heard them right. Hover for %.
            </p>
          )}
          {r.transcriptEn && (
            <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                English translation
              </p>
              <p className="mt-1 text-sm leading-relaxed">“{r.transcriptEn}”</p>
            </div>
          )}
          {r.audioUrl ? (
            <audio controls src={r.audioUrl} className="mt-3 h-10 w-full" />
          ) : r.sizeKb ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Voice memo · {r.sizeKb} KB
              {r.durationSec ? ` · ${r.durationSec}s` : ""}
            </p>
          ) : null}
        </div>

        <ConfidencePanel report={r} />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Caller</dt>
            <dd className="font-medium">{r.name ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">People</dt>
            <dd className="font-medium">{r.people ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Hazard</dt>
            <dd className="font-medium capitalize">{r.hazard ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="font-medium">
              {r.assignedTo ? "Responder assigned" : "Awaiting dispatch"}
            </dd>
          </div>
        </dl>

        <div>
          <label
            htmlFor="assign"
            className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Assign responder
          </label>
          <div className="mt-1.5 flex gap-2">
            <select
              id="assign"
              value={r.assignedTo ?? ""}
              onChange={(e) => onAssign(r.id, e.target.value || null)}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Unassigned</option>
              {RESPONDER_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
          {r.assignedTo && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckIcon width={16} height={16} /> {r.assignedTo} en route · ETA
              14 min
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- AI confidence (responders only) ----

const LOW = 0.5; // below this we ask the dispatcher to verify
const HIGH = 0.8;

/** The weakest measured confidence on a report (1 if nothing was measured). */
function lowestConfidence(r: Report) {
  const vals = [
    r.transcriptionConfidence,
    r.languageConfidence,
    r.urgencyConfidence,
    r.hazardSource === "caller" ? null : r.hazardConfidence,
  ].filter((v): v is number => typeof v === "number");
  return vals.length ? Math.min(...vals) : 1;
}

function level(p: number) {
  return p >= HIGH
    ? {
        label: "High",
        bar: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
      }
    : p >= LOW
      ? {
          label: "Medium",
          bar: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-400",
        }
      : {
          label: "Low",
          bar: "bg-red-500",
          text: "text-red-700 dark:text-red-400",
        };
}

function ConfidenceRow({
  name,
  value,
  answer,
  note,
}: {
  name: string;
  value: number | null | undefined;
  answer: string;
  note: string;
}) {
  const has = typeof value === "number";
  const lv = has ? level(value) : null;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{name}:</span> {answer}
        </span>
        <span
          className={`shrink-0 font-semibold tabular-nums ${lv?.text ?? "text-zinc-500 dark:text-zinc-400"}`}
        >
          {has ? `${Math.round(value * 100)}% · ${lv!.label}` : "—"}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700"
        role="meter"
        aria-label={`${name} confidence`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={has ? Math.round(value * 100) : undefined}
      >
        {has && (
          <div
            className={`h-1.5 rounded-full ${lv!.bar}`}
            style={{ width: `${Math.max(3, value * 100)}%` }}
          />
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        {note}
      </p>
    </li>
  );
}

function ConfidencePanel({ report: r }: { report: Report }) {
  const hazardLabel = r.hazard
    ? (HAZARDS.find((h) => h.key === r.hazard)?.label ?? r.hazard)
    : "None detected";
  const lowest = lowestConfidence(r);
  const whisper = !!r.words?.length;
  return (
    <section
      aria-label="AI confidence"
      className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          AI confidence
        </p>
        {lowest < LOW && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            ⚠ Listen to the recording to verify
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-3">
        <ConfidenceRow
          name="Transcription"
          value={r.transcriptionConfidence}
          answer={
            r.language && r.language !== "en"
              ? `${LANGS[r.language].english} speech`
              : "speech to text"
          }
          note={
            whisper
              ? "Whisper's average probability for each word it wrote"
              : r.live
                ? r.transcriptionConfidence != null
                  ? "Phone speech recognizer's own confidence"
                  : "Not measured (no audio model available)"
                : "Speech model's average word probability"
          }
        />
        {typeof r.languageConfidence === "number" && (
          <ConfidenceRow
            name="Language"
            value={r.languageConfidence}
            answer={r.language ? LANGS[r.language].english : "—"}
            note="Whisper's probability for this language vs. English, French, Mandarin and Spanish"
          />
        )}
        <ConfidenceRow
          name="Urgency"
          value={r.urgencyConfidence}
          answer={
            r.urgency === "high"
              ? "Urgent"
              : r.urgency === "medium"
                ? "Medium"
                : "Low"
          }
          note={
            r.urgencyConfidence === 1 && r.category === "safe"
              ? "The person tapped “I'm safe” themselves"
              : r.classifiedOnDevice === false
                ? "Grok's own estimate"
                : "Share of the evidence (urgent words + request type) pointing to this level"
          }
        />
        <ConfidenceRow
          name="Disaster"
          value={r.hazardSource === "alert" ? null : r.hazardConfidence}
          answer={hazardLabel}
          note={
            r.hazardSource === "caller"
              ? "Chosen by the caller (tapped it themselves)"
              : r.hazardSource === "alert"
                ? "Not mentioned in the message — taken from the area's active alert"
                : r.hazardSource === "voice"
                  ? "Picked from the phone's live captions"
                  : "Share of disaster keywords that point to this type"
          }
        />
      </ul>
      <details className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer font-medium">
          How is this calculated?
        </summary>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li>
            <strong>Transcription:</strong> we replay the speech model over its
            own transcript and read the probability it gave each word. The score
            is the geometric mean (exp of the average log-probability). Words
            under 50% are dotted.
          </li>
          <li>
            <strong>Language:</strong> Whisper scores all four supported
            languages from the audio; this is the winner&apos;s share.
          </li>
          <li>
            <strong>Urgency:</strong> urgent / medium / calm cue words in all
            four languages plus the request type are weighted, then converted to
            probabilities (softmax). 33% means no evidence either way.
          </li>
          <li>
            <strong>Disaster:</strong> the winning disaster&apos;s keyword
            weight ÷ (all disaster keyword weight + a reserve for “something
            else”), so a single weak word can&apos;t look certain.
          </li>
          <li>
            Green ≥ 80% · amber 50–79% · red &lt; 50% (please verify). These are
            estimates from the model, not guarantees.
          </li>
        </ul>
      </details>
    </section>
  );
}

/** Transcript with low-confidence words dotted (hover shows the %). */
function TranscriptWords({ report: r }: { report: Report }) {
  if (!r.words?.length) return <>{r.transcript}</>;
  return (
    <>
      {r.words.map((w, i) =>
        w.p < LOW ? (
          <span
            key={i}
            title={`${Math.round(w.p * 100)}% sure`}
            className={`underline decoration-dotted decoration-2 underline-offset-2 ${w.p < 0.3 ? "decoration-red-500" : "decoration-amber-500"}`}
          >
            {w.w}
          </span>
        ) : (
          <span key={i}>{w.w}</span>
        ),
      )}
    </>
  );
}
