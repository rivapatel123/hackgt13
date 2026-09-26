"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import EmergencyView from "@/app/components/EmergencyView";
import MapView from "@/app/components/MapView";
import AnalyticsView from "@/app/components/AnalyticsView";
import ProfilesView from "@/app/components/ProfilesView";
import SettingsView, {
  DEFAULT_SETTINGS,
  type AppSettings,
} from "@/app/components/SettingsView";
import {
  AlertIcon,
  BellIcon,
  ChartIcon,
  MapIcon,
  MoonIcon,
  SatelliteIcon,
  SettingsIcon,
  SirenIcon,
  SunIcon,
  UserIcon,
} from "@/app/components/icons";
import {
  NOTIFICATIONS,
  SEED_REPORTS,
  normalizeCategory,
  normalizeUrgency,
  type HazardKey,
  type Report,
} from "@/app/lib/data";
import { setTheme, useTheme } from "@/app/lib/theme";

type Tab = "sos" | "map" | "analytics" | "profiles" | "settings";

const NAV: {
  key: Tab;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { key: "sos", label: "Emergency", icon: SirenIcon },
  { key: "map", label: "Live Map", icon: MapIcon },
  { key: "analytics", label: "Analytics", icon: ChartIcon },
  { key: "profiles", label: "Profiles", icon: UserIcon },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

const HEADERS: Record<Tab, { title: string; sub: string }> = {
  sos: {
    title: "Emergency in progress",
    sub: "Stay where you are if it's safe. Tap SOS and speak — we'll get your message to responders.",
  },
  map: {
    title: "Dispatcher map",
    sub: "Every voice message transcribed, sorted and pinned — no memos to listen through.",
  },
  analytics: {
    title: "Incident analytics",
    sub: "Hurricane Delphine · last 24 hours",
  },
  profiles: {
    title: "Profiles",
    sub: "What responders know before they arrive.",
  },
  settings: {
    title: "Settings",
    sub: "Recording, location and display preferences.",
  },
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("sos");
  const [reports, setReports] = useState<Report[]>(SEED_REPORTS);
  const [myIds, setMyIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hazard, setHazard] = useState<HazardKey | null>("hurricane");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const theme = useTheme();

  // Pull real reports from the backend and show them alongside the demo data.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Record<string, unknown>[]) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        const real: Report[] = rows.map((row) => ({
          ...(row as unknown as Report),
          category: normalizeCategory(row.category),
          urgency: normalizeUrgency(row.urgency),
          created_at: new Date(
            `${String(row.created_at ?? "").replace(" ", "T")}Z`,
          ).toISOString(),
          live: true,
        }));
        setReports((prev) => [
          ...real.filter((r) => !prev.some((p) => p.id === r.id)),
          ...prev,
        ]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const addReport = useCallback((r: Report, replaceId?: string) => {
    setReports((prev) => [
      r,
      ...prev.filter((p) => p.id !== r.id && p.id !== replaceId),
    ]);
    setMyIds((prev) => [
      r.id,
      ...prev.filter((id) => id !== r.id && id !== replaceId),
    ]);
  }, []);

  const assign = useCallback((id: string, unit: string | null) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, assignedTo: unit } : r)),
    );
  }, []);

  const openOnMap = useCallback((id: string) => {
    setSelectedId(id);
    setTab("map");
  }, []);

  const myReports = myIds
    .map((id) => reports.find((r) => r.id === id))
    .filter((r): r is Report => !!r);
  const header = HEADERS[tab];

  return (
    <div className="flex min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-xl bg-red-600 text-white shadow-sm">
            <SirenIcon width={20} height={20} />
          </span>
          <div>
            <p className="font-semibold leading-tight tracking-tight">
              CallForHelp
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Emergency voice relay
            </p>
          </div>
        </div>

        <nav aria-label="Main" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((n) => {
              const active = tab === n.key;
              return (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={() => setTab(n.key)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-red-600 ${
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                    }`}
                  >
                    <n.icon
                      width={18}
                      height={18}
                      className={
                        active && n.key === "sos"
                          ? "text-red-600 dark:text-red-500"
                          : ""
                      }
                    />
                    {n.label}
                    {n.key === "map" && (
                      <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                        97
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mx-3 mb-3 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <p className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <SatelliteIcon width={14} height={14} /> Satellite link active
          </p>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Direct-to-Cell · 2 bars · 38 ms
          </p>
          <div className="mt-2 flex h-1.5 gap-0.5" aria-hidden="true">
            {[1, 1, 0, 0].map((on, i) => (
              <span
                key={i}
                className={`flex-1 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTab("profiles")}
          className="flex items-center gap-3 border-t border-zinc-200 px-4 py-4 text-left transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
        >
          <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-rose-400 to-red-600 text-sm font-bold text-white">
            MD
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              Maria Delgado
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              Medical ID · O+ · on file
            </span>
          </span>
          <UserIcon width={16} height={16} className="text-zinc-400" />
        </button>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {tab === "sos" && (
          <div
            role="alert"
            className="flex items-center gap-2 bg-red-700 px-4 py-2 text-sm font-medium text-white sm:px-8"
          >
            <AlertIcon width={16} height={16} className="shrink-0" />
            <span className="truncate">
              <strong className="font-bold">HURRICANE WARNING</strong> ·
              Category 4 Hurricane Delphine · landfall near Tampa Bay by 6:00 PM
              EDT · storm surge 9–13 ft
            </span>
          </div>
        )}

        <header className="flex items-start justify-between gap-4 px-4 pt-6 pb-4 sm:px-8">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 lg:hidden">
              <span className="grid size-7 place-items-center rounded-lg bg-red-600 text-white">
                <SirenIcon width={16} height={16} />
              </span>
              <span className="font-semibold">CallForHelp</span>
            </div>
            <h1
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${tab === "sos" ? "text-red-700 dark:text-red-400" : ""}`}
            >
              {header.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              {header.sub}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setTheme(
                  document.documentElement.classList.contains("dark")
                    ? "light"
                    : "dark",
                )
              }
              aria-label="Toggle light or dark mode"
              className="grid size-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <SunIcon width={18} height={18} className="hidden dark:block" />
              <MoonIcon width={18} height={18} className="dark:hidden" />
            </button>
            <Notifications />
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 sm:px-8">
          {tab === "sos" && (
            <EmergencyView
              settings={settings}
              hazard={hazard}
              onHazardChange={setHazard}
              myReports={myReports}
              onReport={addReport}
              onOpenMap={openOnMap}
            />
          )}
          {tab === "map" && (
            <MapView
              reports={reports}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAssign={assign}
            />
          )}
          {tab === "analytics" && <AnalyticsView />}
          {tab === "profiles" && <ProfilesView />}
          {tab === "settings" && (
            <SettingsView
              settings={settings}
              onChange={setSettings}
              theme={theme}
              onThemeChange={setTheme}
            />
          )}
        </main>
      </div>

      {/* ---- Bottom tabs (mobile) ---- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = tab === n.key;
            return (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => setTab(n.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    active
                      ? n.key === "sos"
                        ? "text-red-600 dark:text-red-500"
                        : "text-zinc-900 dark:text-white"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <n.icon width={20} height={20} />
                  {n.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toneDot = {
    critical: "bg-red-600",
    warning: "bg-amber-500",
    info: "bg-sky-500",
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setRead(true);
        }}
        aria-label={
          read
            ? "Notifications"
            : `Notifications, ${NOTIFICATIONS.length} unread`
        }
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <BellIcon width={18} height={18} />
        {!read && (
          <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-zinc-50 dark:ring-zinc-950">
            {NOTIFICATIONS.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <p className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
            Alerts
          </p>
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${toneDot[n.tone]}`}
                />
                <div>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {n.body}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">{n.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
