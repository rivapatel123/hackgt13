"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Shell, {
  Toast,
  type NavItem,
  type Notice,
} from "@/app/components/Shell";
import EmergencyView from "@/app/components/EmergencyView";
import FamilyView, { useFamilyCircle } from "@/app/components/FamilyView";
import { PersonInNeed } from "@/app/components/ProfilesView";
import SettingsView, {
  DEFAULT_SETTINGS,
  type AppSettings,
} from "@/app/components/SettingsView";
import {
  AlertIcon,
  CheckIcon,
  HeartPulseIcon,
  SettingsIcon,
  SirenIcon,
  UsersIcon,
} from "@/app/components/icons";
import { DEMO_HOME, NOTIFICATIONS, type Report } from "@/app/lib/data";
import { useLiveLocation } from "@/app/lib/useLiveLocation";
import { fetchReport } from "@/app/lib/api";
import { setTheme, useTheme } from "@/app/lib/theme";

type Tab = "sos" | "family" | "profile" | "settings";

const HEADERS: Record<Tab, { title: string; sub: string }> = {
  sos: {
    title: "Emergency in progress",
    sub: "Stay where you are if it's safe. Tap SOS and speak — we'll get your message to responders.",
  },
  family: {
    title: "Family Circle",
    sub: "See where everyone is, and let them know you're safe with one tap.",
  },
  profile: {
    title: "Medical ID",
    sub: "Shared with responders automatically when you send an SOS.",
  },
  settings: {
    title: "Settings",
    sub: "Recording, location and display preferences.",
  },
};

const clock = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function CivilianDashboard() {
  const [tab, setTab] = useState<Tab>("sos");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [notices, setNotices] = useState<Notice[]>(NOTIFICATIONS);
  const [toast, setToast] = useState<{
    title: string;
    body: string;
    tone: "good" | "critical" | "info";
  } | null>(null);
  const theme = useTheme();

  const pushNotice = useCallback(
    (title: string, body: string, tone: "good" | "critical" | "info") => {
      setNotices((n) => [
        { id: `n-${Date.now()}-${n.length}`, tone, title, body, time: clock() },
        ...n,
      ]);
      setToast({ title, body, tone });
    },
    [],
  );

  // Your real position, watched from the moment the app opens.
  const { shareLocation, demoLocation } = settings;
  const live = useLiveLocation(shareLocation && !demoLocation);
  const { waitForFix } = live;
  const locate = useCallback(async () => {
    if (!shareLocation) return null;
    if (demoLocation) return { ...DEMO_HOME };
    return waitForFix(8000);
  }, [shareLocation, demoLocation, waitForFix]);

  const myPosition = useMemo(
    () => (live.coords ? { ...live.coords, address: live.address } : null),
    [live.coords, live.address],
  );
  const family = useFamilyCircle(pushNotice, locate, myPosition);
  const { markSOS, markAssigned, setMyLocation } = family;

  const addReport = useCallback(
    (r: Report, replaceId?: string) => {
      setMyReports((prev) => [
        r,
        ...prev.filter((p) => p.id !== r.id && p.id !== replaceId),
      ]);
      if (!replaceId) markSOS(r);
      // Your pin follows the location you sent with the message.
      if (r.latitude != null && r.longitude != null)
        setMyLocation(
          r.latitude,
          r.longitude,
          r.accuracy ?? null,
          r.gpsAddress ?? null,
        );
    },
    [markSOS, setMyLocation],
  );

  // Watch sent messages for a responder being assigned on the dispatcher side.
  const reportsRef = useRef(myReports);
  useEffect(() => {
    reportsRef.current = myReports;
  });
  useEffect(() => {
    const t = setInterval(async () => {
      const pending = reportsRef.current.filter(
        (r) => !r.id.startsWith("local-"),
      );
      for (const r of pending) {
        const fresh = await fetchReport(r.id).catch(() => null);
        if (!fresh || fresh.assignedTo === r.assignedTo) continue;
        setMyReports((prev) =>
          prev.map((p) =>
            p.id === r.id
              ? {
                  ...p,
                  assignedTo: fresh.assignedTo,
                  assignedAt: fresh.assignedAt,
                }
              : p,
          ),
        );
        if (fresh.assignedTo) {
          pushNotice(
            "Help is on the way",
            `${fresh.assignedTo} was assigned to your request. Stay where you are.`,
            "good",
          );
          markAssigned(fresh.assignedTo);
        }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pushNotice, markAssigned]);

  const nav: NavItem<Tab>[] = [
    { key: "sos", label: "Emergency", icon: SirenIcon, accent: true },
    {
      key: "family",
      label: "Family Circle",
      icon: UsersIcon,
      badge:
        family.members.filter(
          (m) => m.status === "nocontact" || m.status === "help",
        ).length || undefined,
    },
    { key: "profile", label: "Medical ID", icon: HeartPulseIcon },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Shell
      product="Emergency voice relay"
      nav={nav}
      tab={tab}
      onTab={setTab}
      title={HEADERS[tab].title}
      sub={HEADERS[tab].sub}
      titleTone={tab === "sos" ? "alert" : "default"}
      banner={
        tab === "sos" ? (
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
        ) : null
      }
      profile={{
        initials: "MD",
        name: "Maria Delgado",
        sub: "Medical ID · O+ · on file",
        gradient: "from-rose-400 to-red-600",
        onClick: () => setTab("profile"),
      }}
      switchTo={{ href: "/responder", label: "Open responder dashboard" }}
      notices={notices}
    >
      {/* Views stay mounted so a recording or check-in survives tab switches. */}
      <div hidden={tab !== "sos"}>
        <EmergencyView
          settings={settings}
          myReports={myReports}
          onReport={addReport}
          onCheckInSafe={family.checkInSafe}
          safeStatus={family.safeStatus}
          onOpenFamily={() => setTab("family")}
          location={live}
        />
      </div>
      <div hidden={tab !== "family"}>
        <FamilyView family={family} />
      </div>
      <div hidden={tab !== "profile"} className="max-w-3xl">
        <PersonInNeed />
      </div>
      <div hidden={tab !== "settings"}>
        <SettingsView
          settings={settings}
          onChange={setSettings}
          theme={theme}
          onThemeChange={setTheme}
        />
      </div>

      {toast && (
        <Toast onClose={() => setToast(null)}>
          <p className="flex items-center gap-2 font-semibold">
            {toast.tone === "good" ? (
              <CheckIcon width={16} height={16} className="text-emerald-600" />
            ) : (
              <AlertIcon
                width={16}
                height={16}
                className={
                  toast.tone === "critical" ? "text-red-600" : "text-sky-600"
                }
              />
            )}
            {toast.title}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{toast.body}</p>
        </Toast>
      )}
    </Shell>
  );
}
