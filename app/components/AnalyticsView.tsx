"use client";

import { useState } from "react";
import {
  CATEGORIES,
  CATEGORY_TOTALS,
  HOURLY_VOLUME,
  INCIDENT_STATS,
} from "@/app/lib/data";
import { CategoryDot } from "@/app/components/Badges";

const card =
  "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

function hourLabel(i: number) {
  // Last 24h ending at 3 PM.
  const h = (16 + i) % 24;
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

function HourlyChart() {
  const [hover, setHover] = useState<number | null>(null);
  const max = 350;
  const ticks = [0, 100, 200, 300];
  const peak = HOURLY_VOLUME.indexOf(Math.max(...HOURLY_VOLUME));
  return (
    <section className={`${card} lg:col-span-2`} aria-labelledby="hourly-title">
      <h2 id="hourly-title" className="font-semibold">
        Voice messages per hour
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Peak of{" "}
        <strong className="text-zinc-900 dark:text-zinc-100">
          {HOURLY_VOLUME[peak]}
        </strong>{" "}
        at {hourLabel(peak)} as the outer bands made landfall
      </p>
      <div className="mt-5 pl-9">
        <div className="relative">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute right-0 left-9 border-t border-zinc-100 dark:border-zinc-800"
              style={{ bottom: `${(t / max) * 100}%` }}
            >
              <span className="absolute -top-2 -left-9 w-7 text-right text-[11px] tabular-nums text-zinc-400">
                {t}
              </span>
            </div>
          ))}
          <div
            className="relative flex h-56 items-end gap-[2px]"
            onMouseLeave={() => setHover(null)}
          >
            {HOURLY_VOLUME.map((v, i) => (
              <div
                key={i}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-[#1c5cab] dark:bg-[#86b6ef]" : "bg-[#2a78d6] dark:bg-[#3987e5]"}`}
                  style={{ height: `${(v / max) * 100}%` }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs whitespace-nowrap shadow dark:border-zinc-700 dark:bg-zinc-800">
                    <span className="font-semibold tabular-nums">{v}</span>{" "}
                    messages · {hourLabel(i)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
          <span>{hourLabel(0)}</span>
          <span>{hourLabel(8)}</span>
          <span>{hourLabel(16)}</span>
          <span>{hourLabel(23)}</span>
        </div>
      </div>
    </section>
  );
}

function CategoryBars() {
  const rows = [...CATEGORY_TOTALS].sort((a, b) => b.count - a.count);
  const max = rows[0].count;
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className={card} aria-labelledby="cat-title">
      <h2 id="cat-title" className="font-semibold">
        What people are asking for
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Auto-sorted by Grok from {total.toLocaleString()} messages
      </p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li
            key={r.key}
            title={`${CATEGORIES[r.key].label}: ${r.count.toLocaleString()} (${Math.round((r.count / total) * 100)}%)`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <CategoryDot category={r.key} />
                {CATEGORIES[r.key].label}
              </span>
              <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                {r.count.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-2 rounded-full bg-[var(--c)] dark:bg-[var(--cd)]"
                style={{
                  width: `${(r.count / max) * 100}%`,
                  ["--c" as string]: CATEGORIES[r.key].color,
                  ["--cd" as string]: CATEGORIES[r.key].darkColor,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BandwidthCompare() {
  const rows = [
    {
      label: "1-minute phone call",
      kb: 480,
      note: "needs a live connection the whole time",
    },
    {
      label: "Typical messaging-app voice note",
      kb: 120,
      note: "~32 kbps AAC",
    },
    {
      label: "CallForHelp voice message",
      kb: 3.8,
      note: "12 kbps Opus, mono, silence trimmed",
      ours: true,
    },
  ];
  return (
    <section className={card} aria-labelledby="bw-title">
      <h2 id="bw-title" className="font-semibold">
        Why tiny messages get through
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Average size per request
      </p>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={r.ours ? "font-semibold" : ""}>{r.label}</span>
              <span
                className={`tabular-nums ${r.ours ? "font-semibold text-red-700 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}
              >
                {r.kb} KB
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-2 rounded-full ${r.ours ? "bg-red-600" : "bg-zinc-400 dark:bg-zinc-500"}`}
                style={{ width: `max(6px, ${(r.kb / 480) * 100}%)` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {r.note}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950/50 dark:text-red-100">
        <strong>126× smaller</strong> than a call — 5,184 messages used just
        19.7 MB of satellite bandwidth.
      </p>
    </section>
  );
}

function UrgencySplit() {
  const parts = [
    { label: "Urgent", value: 1486, cls: "bg-red-600" },
    { label: "Medium", value: 2019, cls: "bg-amber-400" },
    { label: "Low / safe", value: 1679, cls: "bg-zinc-400 dark:bg-zinc-500" },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <section className={card} aria-labelledby="urg-title">
      <h2 id="urg-title" className="font-semibold">
        Urgency triage
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {INCIDENT_STATS.unresolvedHigh} urgent requests still unassigned
      </p>
      <div className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.label}
            className={p.cls}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.label}: ${p.value.toLocaleString()}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${p.cls}`} />
            {p.label}
            <span className="ml-auto tabular-nums text-zinc-600 dark:text-zinc-400">
              {p.value.toLocaleString()} · {Math.round((p.value / total) * 100)}
              %
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResponseTable() {
  const rows = CATEGORY_TOTALS.filter((r) => r.key !== "safe").sort(
    (a, b) => a.medianMin - b.medianMin,
  );
  return (
    <section className={card} aria-labelledby="resp-title">
      <h2 id="resp-title" className="font-semibold">
        Median time from message to responder assigned
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 font-medium">Need</th>
              <th className="py-2 text-right font-medium">Requests</th>
              <th className="py-2 text-right font-medium">Median dispatch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <CategoryDot category={r.key} /> {CATEGORIES[r.key].label}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.count.toLocaleString()}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {r.medianMin} min
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AnalyticsView() {
  const s = INCIDENT_STATS;
  const tiles = [
    { label: "Messages received", value: s.messagesReceived.toLocaleString() },
    { label: "Rescues completed", value: s.rescuesCompleted.toLocaleString() },
    { label: "Median dispatch", value: "6m 42s" },
    { label: "Bandwidth used", value: "19.7 MB" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={card}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {t.value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <HourlyChart />
        <BandwidthCompare />
        <CategoryBars />
        <ResponseTable />
        <UrgencySplit />
      </div>
    </div>
  );
}
