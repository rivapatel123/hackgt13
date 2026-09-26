"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Shell, {
  Toast,
  type NavItem,
  type Notice,
} from "@/app/components/Shell";
import MapView from "@/app/components/MapView";
import AnalyticsView from "@/app/components/AnalyticsView";
import ProfilesView from "@/app/components/ProfilesView";
import SettingsView, {
  DEFAULT_SETTINGS,
  type DispatchPrefs,
} from "@/app/components/SettingsView";
import { CategoryBadge, UrgencyBadge } from "@/app/components/Badges";
import {
  ChartIcon,
  MapIcon,
  SettingsIcon,
  UserIcon,
} from "@/app/components/icons";
import { DEMO_NOW, SEED_REPORTS, type Report } from "@/app/lib/data";
import { assignReport, deleteReport, fetchReports } from "@/app/lib/api";
import { setTheme, useTheme } from "@/app/lib/theme";
import { useNow } from "@/app/lib/useNow";
import { locationHelp, useLiveLocation } from "@/app/lib/useLiveLocation";

type Tab = "map" | "analytics" | "profiles" | "settings";

const HEADERS: Record<Tab, { title: string; sub: string }> = {
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
    sub: "Your unit, and what you know about the person you're heading to.",
  },
  settings: { title: "Settings", sub: "Live feed, alerts and display." },
};

const RESPONDER_NOTICES: Notice[] = [
  {
    id: "r1",
    tone: "critical",
    title: "97 urgent requests unassigned",
    body: "Medical and flood rescues are concentrated around Apollo Beach and Ruskin.",
    time: "3:40 PM",
  },
  {
    id: "r2",
    tone: "warning",
    title: "Gandy Blvd closed",
    body: "Storm surge over the roadway — route high-water vehicles via I-275.",
    time: "3:12 PM",
  },
];

// Reads ?report=<id> (from the civilian "See what responders see" link).
function ReportParam({ onReport }: { onReport: (id: string) => void }) {
  const id = useSearchParams().get("report");
  useEffect(() => {
    if (id) onReport(id);
  }, [id, onReport]);
  return null;
}

export default function ResponderDashboard() {
  const [tab, setTab] = useState<Tab>("map");
  const [live, setLive] = useState<Report[]>([]);
  const [hiddenSeeds, setHiddenSeeds] = useState<Set<string>>(new Set());
  const [seedAssign, setSeedAssign] = useState<
    Record<string, { unit: string | null; at: string | null }>
  >({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [prefs, setPrefs] = useState<DispatchPrefs>({
    liveFeed: true,
    urgentAlerts: true,
  });
  const [notices, setNotices] = useState<Notice[]>(RESPONDER_NOTICES);
  const [incoming, setIncoming] = useState<Report | null>(null);
  const [feedError, setFeedError] = useState(false);
  const theme = useTheme();
  const now = useNow();
  // The responder's own position, for "you are here" and distances.
  const myLocation = useLiveLocation(true);

  const seen = useRef<Set<string> | null>(null);
  const deleted = useRef<Set<string>>(new Set());
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });

  const load = useCallback(async () => {
    try {
      const rows = (await fetchReports()).filter(
        (r) => !deleted.current.has(r.id),
      );
      setFeedError(false);
      setLive(rows);
      if (seen.current) {
        const fresh = rows.filter((r) => !seen.current!.has(r.id));
        fresh.forEach((r) => seen.current!.add(r.id));
        if (fresh.length) {
          const r = fresh[0];
          setNotices((n) => [
            {
              id: `n-${r.id}`,
              tone:
                r.urgency === "high"
                  ? "critical"
                  : r.category === "safe"
                    ? "good"
                    : "info",
              title: `New ${r.category === "safe" ? "check-in" : "request"} from ${r.name ?? "the field"}`,
              body: r.description || r.transcript,
              time: new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              }),
            },
            ...n,
          ]);
          if (prefsRef.current.urgentAlerts) setIncoming(r);
        }
      } else {
        seen.current = new Set(rows.map((r) => r.id));
      }
    } catch {
      setFeedError(true);
    }
  }, []);

  useEffect(() => {
    // First fetch runs right away; later ones on the interval while the feed is on.
    const first = setTimeout(load, 0);
    if (!prefs.liveFeed) return () => clearTimeout(first);
    const t = setInterval(load, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, prefs.liveFeed]);

  const reports = useMemo(
    () => [
      ...live,
      ...SEED_REPORTS.filter((r) => !hiddenSeeds.has(r.id)).map((r) =>
        r.id in seedAssign
          ? {
              ...r,
              assignedTo: seedAssign[r.id].unit,
              assignedAt: seedAssign[r.id].at,
            }
          : r,
      ),
    ],
    [live, seedAssign, hiddenSeeds],
  );

  const assign = useCallback(async (id: string, unit: string | null) => {
    // First assignment stamps the response time; changing unit keeps it.
    const stamp = (prev: string | null | undefined, now: string) =>
      unit ? (prev ?? now) : null;
    if (id.startsWith("seed-")) {
      // Demo reports live on the scenario clock.
      const seed = SEED_REPORTS.find((r) => r.id === id);
      setSeedAssign((s) => ({
        ...s,
        [id]: {
          unit,
          at: stamp(
            id in s ? s[id].at : seed?.assignedAt,
            new Date(DEMO_NOW).toISOString(),
          ),
        },
      }));
      return;
    }
    setLive((ls) =>
      ls.map((r) =>
        r.id === id
          ? {
              ...r,
              assignedTo: unit,
              assignedAt: stamp(r.assignedAt, new Date().toISOString()),
            }
          : r,
      ),
    );
    await assignReport(id, unit);
  }, []);

  // Demo cleanup: removes a message and its recording (demo pins are just hidden).
  const remove = useCallback(async (id: string) => {
    setSelectedId((sel) => (sel === id ? null : sel));
    setIncoming((r) => (r?.id === id ? null : r));
    if (id.startsWith("seed-")) {
      setHiddenSeeds((h) => new Set(h).add(id));
      return;
    }
    deleted.current.add(id);
    setLive((ls) => ls.filter((r) => r.id !== id));
    await deleteReport(id);
  }, []);

  const openReport = useCallback((id: string) => {
    setSelectedId(id);
    setTab("map");
  }, []);

  const urgentOpen = reports.filter(
    (r) => r.urgency === "high" && !r.assignedTo,
  ).length;
  const nav: NavItem<Tab>[] = [
    { key: "map", label: "Live Map", icon: MapIcon, badge: urgentOpen },
    { key: "analytics", label: "Analytics", icon: ChartIcon },
    { key: "profiles", label: "Profiles", icon: UserIcon },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Shell
      product="Responder dashboard"
      nav={nav}
      tab={tab}
      onTab={setTab}
      title={HEADERS[tab].title}
      sub={HEADERS[tab].sub}
      banner={
        <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 sm:px-8 dark:bg-zinc-800">
          <span
            className={`size-2 shrink-0 rounded-full ${feedError ? "bg-amber-400" : prefs.liveFeed ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-zinc-500"}`}
          />
          <span className="truncate">
            <strong className="font-semibold">
              Hurricane Delphine response
            </strong>{" "}
            ·{" "}
            {feedError
              ? "Live feed can't reach the server — retrying"
              : prefs.liveFeed
                ? "Live feed on"
                : "Live feed paused"}{" "}
            · {live.length} message{live.length === 1 ? "" : "s"} from the field
            this session · {urgentOpen} urgent unassigned
          </span>
        </div>
      }
      profile={{
        initials: "JO",
        name: "Lt. James Okafor",
        sub: "Rescue Task Force 3 · on duty",
        gradient: "from-sky-500 to-blue-700",
        onClick: () => setTab("profiles"),
      }}
      switchTo={{ href: "/", label: "Open civilian app" }}
      notices={notices}
    >
      <Suspense fallback={null}>
        <ReportParam onReport={openReport} />
      </Suspense>

      {tab === "map" && (
        <MapView
          reports={reports}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAssign={assign}
          onDelete={remove}
          me={{
            coords: myLocation.coords,
            help: locationHelp(myLocation.status),
          }}
          now={now}
        />
      )}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "profiles" && <ProfilesView />}
      {tab === "settings" && (
        <SettingsView
          mode="responder"
          settings={settings}
          onChange={setSettings}
          theme={theme}
          onThemeChange={setTheme}
          dispatch={prefs}
          onDispatchChange={setPrefs}
        />
      )}

      {incoming && (
        <Toast key={incoming.id} onClose={() => setIncoming(null)}>
          <p className="text-xs font-semibold tracking-wide text-red-700 uppercase dark:text-red-400">
            New from the field
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <CategoryBadge category={incoming.category} />
            <UrgencyBadge urgency={incoming.urgency} />
          </div>
          <p className="mt-2 line-clamp-3 text-zinc-700 dark:text-zinc-300">
            “{incoming.transcriptEn ?? incoming.transcript}”
          </p>
          <button
            type="button"
            onClick={() => {
              openReport(incoming.id);
              setIncoming(null);
            }}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Open on map
          </button>
        </Toast>
      )}
    </Shell>
  );
}
