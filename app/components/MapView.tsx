"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  DEMO_NOW,
  INCIDENT_STATS,
  MAP_BOUNDS,
  MAP_H,
  MAP_W,
  NEIGHBORHOODS,
  RESPONDER_UNITS,
  project,
  timeAgo,
  type CategoryKey,
  type Report,
} from "@/app/lib/data";
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
  XIcon,
} from "@/app/components/icons";

const URGENCY_RANK = { high: 0, medium: 1, low: 2 } as const;

function inBounds(r: Report) {
  return (
    r.latitude != null &&
    r.longitude != null &&
    r.latitude <= MAP_BOUNDS.north &&
    r.latitude >= MAP_BOUNDS.south &&
    r.longitude >= MAP_BOUNDS.west &&
    r.longitude <= MAP_BOUNDS.east
  );
}

function when(r: Report) {
  return r.live
    ? timeAgo(r.created_at, Date.parse(r.created_at))
    : timeAgo(r.created_at, DEMO_NOW);
}

export default function MapView({
  reports,
  selectedId,
  onSelect,
  onAssign,
}: {
  reports: Report[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAssign: (id: string, unit: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Set<CategoryKey>>(new Set());
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  const pinned = filtered.filter(inBounds);
  const offMap = filtered.filter((r) => r.live && !inBounds(r));
  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const hovered = pinned.find((r) => r.id === hoverId) ?? null;

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
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800">
            <p className="font-medium">
              Tampa Bay operating area ·{" "}
              <span className="tabular-nums">{pinned.length}</span> pins shown
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sample of {INCIDENT_STATS.pinned.toLocaleString()} located
              messages
            </p>
          </div>
          <div className="relative">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="block h-auto w-full"
              role="img"
              aria-label="Stylized map of Tampa Bay with request pins"
            >
              <defs>
                <pattern
                  id="grid"
                  width="50"
                  height="50"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M50 0H0V50"
                    fill="none"
                    className="stroke-zinc-200 dark:stroke-zinc-800"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect
                width={MAP_W}
                height={MAP_H}
                className="fill-stone-100 dark:fill-zinc-950"
              />
              <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />
              {/* Gulf of Mexico */}
              <path
                d="M0 0 L100 0 C110 120 120 250 130 330 C150 420 200 500 230 560 C250 610 280 660 330 700 L0 700 Z"
                className="fill-sky-100 dark:fill-sky-950/70"
              />
              {/* Tampa Bay */}
              <path
                d="M520 170 C560 200 560 260 590 290 L640 260 L660 300 C680 360 660 420 650 460 L640 520 C620 580 600 640 560 700 L330 700 C380 640 440 580 450 540 C460 460 440 400 470 350 C490 300 470 240 520 170 Z"
                className="fill-sky-100 dark:fill-sky-950/70"
              />
              {/* Storm track */}
              <path
                d="M40 690 C180 560 300 420 520 300 S 860 120 990 40"
                fill="none"
                strokeDasharray="6 8"
                strokeWidth="2"
                className="stroke-red-400/70 dark:stroke-red-500/60"
              />
              <text
                x="985"
                y="80"
                textAnchor="end"
                className="fill-red-500 text-[18px] font-semibold dark:fill-red-400"
              >
                Forecast track · Delphine →
              </text>
              <text
                x="30"
                y="420"
                className="fill-sky-500/80 text-[18px] italic dark:fill-sky-400/70"
              >
                Gulf of Mexico
              </text>
              <text
                x="520"
                y="620"
                className="fill-sky-500/80 text-[18px] italic dark:fill-sky-400/70"
              >
                Tampa Bay
              </text>
              {[...pinned].reverse().map((r) => {
                const p = project(r.latitude!, r.longitude!);
                const c = CATEGORIES[r.category];
                const isSel = r.id === selectedId;
                const radius = isSel ? 13 : r.urgency === "high" ? 9 : 7;
                return (
                  <g
                    key={r.id}
                    transform={`translate(${p.x} ${p.y})`}
                    className="cursor-pointer"
                    style={{
                      ["--c" as string]: c.color,
                      ["--cd" as string]: c.darkColor,
                    }}
                    onClick={() => onSelect(r.id)}
                    onMouseEnter={() => setHoverId(r.id)}
                    onMouseLeave={() => setHoverId(null)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${c.label}, ${r.urgency} urgency, ${r.raw_location_text ?? "unknown location"}`}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && onSelect(r.id)
                    }
                  >
                    {/* generous hit target */}
                    <circle r={18} fill="transparent" />
                    {(r.urgency === "high" || r.live) && (
                      <circle
                        r={radius + 6}
                        className="fill-[var(--c)] opacity-25 motion-safe:animate-pulse dark:fill-[var(--cd)]"
                      />
                    )}
                    <circle
                      r={radius}
                      strokeWidth={2}
                      className="fill-[var(--c)] stroke-white dark:fill-[var(--cd)] dark:stroke-zinc-950"
                    />
                    {isSel && (
                      <circle
                        r={radius + 5}
                        fill="none"
                        strokeWidth={2}
                        className="stroke-zinc-900 dark:stroke-white"
                      />
                    )}
                  </g>
                );
              })}
              {NEIGHBORHOODS.map((n) => {
                const p = project(n.lat, n.lng);
                return (
                  <text
                    key={n.name}
                    x={p.x}
                    y={p.y - 44}
                    textAnchor="middle"
                    paintOrder="stroke"
                    strokeWidth={5}
                    strokeLinejoin="round"
                    className="fill-zinc-600 stroke-stone-100 pointer-events-none text-[15px] font-semibold dark:fill-zinc-400 dark:stroke-zinc-950"
                  >
                    {n.name}
                  </text>
                );
              })}
            </svg>

            {hovered && (
              <div
                className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-zinc-200 bg-white p-2.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                style={{
                  left: `${(project(hovered.latitude!, hovered.longitude!).x / MAP_W) * 100}%`,
                  top: `${(project(hovered.latitude!, hovered.longitude!).y / MAP_H) * 100}%`,
                }}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  <CategoryDot category={hovered.category} />{" "}
                  {CATEGORIES[hovered.category].label}
                  <span className="ml-auto font-normal text-zinc-500 dark:text-zinc-400">
                    {when(hovered)}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-zinc-600 dark:text-zinc-300">
                  {hovered.description}
                </p>
              </div>
            )}

            {offMap.length > 0 && (
              <div className="absolute top-3 right-3 max-w-[16rem] rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 shadow dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100">
                <p className="font-semibold">
                  {offMap.length} live message{offMap.length > 1 ? "s" : ""}{" "}
                  outside this area
                </p>
                {offMap.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="mt-1 block text-left underline"
                  >
                    {r.latitude != null
                      ? `${r.latitude.toFixed(3)}, ${r.longitude!.toFixed(3)}`
                      : "Location pending"}{" "}
                    · {CATEGORIES[r.category].short}
                  </button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-xs backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
              {catKeys.map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <CategoryDot category={k} /> {CATEGORIES[k].short}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                Large pin = urgent
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
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(r.id)}
                        onMouseEnter={() => setHoverId(r.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
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
                            {r.raw_location_text ?? "Location pending"} ·{" "}
                            {when(r)}
                          </span>
                        </span>
                        {r.urgency === "high" && (
                          <span className="mt-0.5 shrink-0 text-[10px] font-bold text-red-600 uppercase dark:text-red-400">
                            Urgent
                          </span>
                        )}
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
}: {
  report: Report;
  onClose: () => void;
  onAssign: (id: string, unit: string | null) => void;
}) {
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
            <PinIcon width={14} height={14} />{" "}
            {r.raw_location_text ?? "Location pending"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {when(r)}
            {r.latitude != null &&
              ` · ${r.latitude.toFixed(4)}, ${r.longitude!.toFixed(4)}`}
          </p>
        </div>

        <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Transcript
          </p>
          <p className="mt-1 text-sm leading-relaxed">“{r.transcript}”</p>
          {r.audioUrl ? (
            <audio controls src={r.audioUrl} className="mt-3 h-10 w-full" />
          ) : (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Voice memo · {r.sizeKb} KB · {r.durationSec}s
            </p>
          )}
          {r.classifiedOnDevice && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Sorted on-device — awaiting Grok re-check.
            </p>
          )}
        </div>

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
