"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeafletMap, { type MapPin } from "@/app/components/LeafletMap";
import type { Coords } from "@/app/lib/location";
import {
  AlertIcon,
  BellIcon,
  CheckIcon,
  PinIcon,
  ShieldIcon,
  SirenIcon,
  UsersIcon,
} from "@/app/components/icons";
import { DEMO_HOME, type Report } from "@/app/lib/data";
import { postReport } from "@/app/lib/api";
import { useNow } from "@/app/lib/useNow";

export type MemberStatus = "safe" | "help" | "unknown" | "asking" | "nocontact";

export type Member = {
  id: string;
  name: string;
  relation: string;
  kin?: string; // how you'd refer to them: "sister", "son"
  initials: string;
  gradient: string;
  withMe?: boolean; // physically with you — shown on your map pin
  accuracy?: number | null; // GPS accuracy in metres (for "You")
  lat: number;
  lng: number;
  place: string;
  battery: number;
  status: MemberStatus;
  note: string;
  updatedAt: number | null; // ms timestamp once something happens this session
  agoMinAtLoad: number; // how stale the scenario data is before that
  // How this person answers a check-in request (demo family).
  reply?: { afterMs: number; status: MemberStatus; note: string };
  escalated?: boolean;
};

type FeedItem = {
  id: string;
  tone: "good" | "bad" | "info";
  text: string;
  at: number | null;
  agoMinAtLoad?: number;
};

const INITIAL_MEMBERS: Member[] = [
  {
    id: "me",
    name: "Maria Delgado",
    relation: "You",
    initials: "MD",
    gradient: "from-rose-400 to-red-600",
    lat: DEMO_HOME.lat,
    lng: DEMO_HOME.lng,
    place: "Home · 412 Bayshore Blvd",
    battery: 23,
    status: "unknown",
    note: "You haven't checked in yet",
    updatedAt: null,
    agoMinAtLoad: 0,
  },
  {
    id: "roberto",
    name: "Roberto Delgado",
    relation: "Husband · with you",
    withMe: true,
    initials: "RD",
    gradient: "from-amber-400 to-orange-600",
    lat: DEMO_HOME.lat,
    lng: DEMO_HOME.lng,
    place: "Home · 412 Bayshore Blvd",
    battery: 41,
    status: "help",
    note: "Hurt his leg in a fall — can't walk",
    updatedAt: null,
    agoMinAtLoad: 9,
  },
  {
    id: "mateo",
    name: "Mateo Delgado",
    relation: "Grandson, 9 · with you",
    withMe: true,
    initials: "MA",
    gradient: "from-sky-400 to-blue-600",
    lat: DEMO_HOME.lat,
    lng: DEMO_HOME.lng,
    place: "Home · 412 Bayshore Blvd",
    battery: 100,
    status: "safe",
    note: "With you — no phone of his own",
    updatedAt: null,
    agoMinAtLoad: 9,
  },
  {
    id: "sofia",
    name: "Sofia Delgado",
    relation: "Daughter",
    initials: "SD",
    gradient: "from-emerald-400 to-teal-600",
    lat: 27.938,
    lng: -82.292,
    place: "Brandon High School shelter",
    battery: 76,
    status: "safe",
    note: "“At the shelter, we have power and water. Love you Mami.”",
    updatedAt: null,
    agoMinAtLoad: 12,
  },
  {
    id: "elena",
    name: "Elena Ruiz",
    relation: "Sister",
    kin: "sister",
    initials: "ER",
    gradient: "from-violet-400 to-purple-600",
    lat: 27.772,
    lng: -82.645,
    place: "St. Petersburg · 18th Ave N",
    battery: 34,
    status: "unknown",
    note: "Hasn't checked in since the storm hit",
    updatedAt: null,
    agoMinAtLoad: 48,
    reply: {
      afterMs: 3500,
      status: "safe",
      note: "“Water's in the street but we're upstairs and fine.”",
    },
  },
  {
    id: "luis",
    name: "Luis Delgado",
    relation: "Son, 34",
    kin: "son",
    initials: "LD",
    gradient: "from-zinc-400 to-zinc-600",
    lat: 27.866,
    lng: -82.338,
    place: "Riverview · near Boyette Rd",
    battery: 6,
    status: "unknown",
    note: "Last seen driving home from work",
    updatedAt: null,
    agoMinAtLoad: 131,
    reply: {
      afterMs: 7000,
      status: "nocontact",
      note: "No reply — his phone may be off or out of battery",
    },
  },
];

const INITIAL_FEED: FeedItem[] = [
  {
    id: "f1",
    tone: "good",
    text: "Sofia checked in safe at Brandon High School shelter",
    at: null,
    agoMinAtLoad: 12,
  },
  {
    id: "f2",
    tone: "bad",
    text: "Roberto was marked as hurt (fall injury)",
    at: null,
    agoMinAtLoad: 9,
  },
  {
    id: "f3",
    tone: "info",
    text: "Hurricane Warning issued for Hillsborough & Pinellas",
    at: null,
    agoMinAtLoad: 64,
  },
];

export function fmtAgo(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function ago(at: number | null, agoMin: number | undefined, now: number) {
  if (at != null) return now ? fmtAgo(now - at) : "just now";
  return fmtAgo((agoMin ?? 0) * 60_000);
}

/** Family Circle state for the civilian dashboard. */
export function useFamilyCircle(
  onNotice: (
    title: string,
    body: string,
    tone: "good" | "critical" | "info",
  ) => void,
  locate: () => Promise<Coords | null>,
) {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [safeStatus, setSafeStatus] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const noticeRef = useRef(onNotice);
  useEffect(() => {
    noticeRef.current = onNotice;
  });
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const log = useCallback((tone: FeedItem["tone"], text: string) => {
    setFeed((f) => [
      { id: `f-${Date.now()}-${Math.random()}`, tone, text, at: Date.now() },
      ...f,
    ]);
  }, []);

  const update = useCallback((id: string, patch: Partial<Member>) => {
    setMembers((ms) =>
      ms.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: Date.now() } : m,
      ),
    );
  }, []);

  const others = members.filter((m) => m.id !== "me").length;

  // Move "You" (and the people with you) to your latest GPS fix.
  const setMyLocation = useCallback(
    (
      lat: number,
      lng: number,
      accuracy: number | null,
      address: string | null,
    ) => {
      setMembers((ms) =>
        ms.map((m) =>
          m.id === "me"
            ? {
                ...m,
                lat,
                lng,
                accuracy,
                place: address ? `Near ${address}` : "Your current location",
                updatedAt: Date.now(),
              }
            : m.withMe
              ? {
                  ...m,
                  lat,
                  lng,
                  place: address ? `With you · near ${address}` : "With you",
                }
              : m,
        ),
      );
    },
    [],
  );

  const checkInSafe = useCallback(async () => {
    setSafeStatus("sending");
    update("me", { status: "safe", note: "You checked in as safe" });
    log("good", `You checked in safe — ${others} family members notified`);
    noticeRef.current(
      "Family notified",
      `${others} people in Delgado Family know you're safe.`,
      "good",
    );
    // Also tell relief teams, so they can deprioritise this address.
    const fd = new FormData();
    fd.append(
      "transcript",
      "Maria Delgado checked in: I'm safe. (Family Circle check-in)",
    );
    fd.append("category", "safe");
    fd.append("name", "Maria Delgado");
    fd.append("source", "checkin");
    // Send where you actually are right now.
    const loc = await locate();
    if (loc) {
      fd.append("lat", String(loc.lat));
      fd.append("lng", String(loc.lng));
      if (loc.accuracy) fd.append("accuracy", String(Math.round(loc.accuracy)));
    }
    try {
      const saved = await postReport(fd);
      if (loc)
        setMyLocation(loc.lat, loc.lng, loc.accuracy, saved.gpsAddress ?? null);
    } catch {
      log(
        "info",
        "Couldn't reach relief teams yet — your family was still notified",
      );
    }
    setSafeStatus("sent");
  }, [locate, log, others, update, setMyLocation]);

  const markSOS = useCallback(
    (r: Report) => {
      update("me", {
        status: "help",
        note: `SOS sent: ${r.description || "voice message"}`,
      });
      log(
        "bad",
        `You sent an SOS — ${others} family members were alerted automatically`,
      );
      setSafeStatus("idle");
    },
    [log, others, update],
  );

  const markAssigned = useCallback(
    (unit: string) => {
      log("info", `${unit} is on the way to you — family can follow along`);
    },
    [log],
  );

  const ask = useCallback(
    (ids: string[]) => {
      const targets = members.filter((m) => ids.includes(m.id) && m.reply);
      if (targets.length === 0) return;
      targets.forEach((m) =>
        update(m.id, { status: "asking", note: "Check-in request sent…" }),
      );
      log(
        "info",
        `Asked ${targets.map((m) => m.name.split(" ")[0]).join(" & ")} to check in`,
      );
      targets.forEach((m) => {
        const t = setTimeout(() => {
          update(m.id, { status: m.reply!.status, note: m.reply!.note });
          const first = m.name.split(" ")[0];
          if (m.reply!.status === "safe") {
            log("good", `${first} checked in safe`);
            noticeRef.current(`${first} is safe`, m.reply!.note, "good");
          } else {
            log("bad", `${first} didn't answer the check-in`);
            noticeRef.current(
              `No reply from ${first}`,
              "You can ask responders to check on them.",
              "critical",
            );
          }
        }, m.reply!.afterMs);
        timers.current.push(t);
      });
    },
    [log, members, update],
  );

  const escalate = useCallback(
    async (id: string) => {
      const m = members.find((x) => x.id === id);
      if (!m) return;
      const fd = new FormData();
      fd.append(
        "transcript",
        `This is Maria Delgado. I can't reach my ${m.kin ?? "family member"} ${m.name}. ` +
          `Last seen ${m.place}, ${fmtAgo(m.agoMinAtLoad * 60_000).replace(" ago", "")} ago. ` +
          `Their phone battery was ${m.battery}% and they aren't answering. Please check on them.`,
      );
      fd.append("category", "missing_person");
      fd.append("name", "Maria Delgado");
      fd.append("source", "family");
      fd.append("lat", String(m.lat));
      fd.append("lng", String(m.lng));
      try {
        await postReport(fd);
        setMembers((ms) =>
          ms.map((x) =>
            x.id === id ? { ...x, escalated: true, updatedAt: Date.now() } : x,
          ),
        );
        log(
          "bad",
          `Responders asked to check on ${m.name.split(" ")[0]} at his last known location`,
        );
        noticeRef.current(
          "Missing-person request sent",
          `Responders have ${m.name}'s last known location.`,
          "info",
        );
      } catch {
        log(
          "info",
          `Couldn't reach responders — try again when you have signal`,
        );
      }
    },
    [log, members],
  );

  return {
    members,
    feed,
    safeStatus,
    setMyLocation,
    checkInSafe,
    markSOS,
    markAssigned,
    ask,
    escalate,
  };
}

const RING_HEX: Record<MemberStatus, string> = {
  safe: "#059669",
  help: "#dc2626",
  unknown: "#a1a1aa",
  asking: "#f59e0b",
  nocontact: "#f59e0b",
};

const STATUS_STYLE: Record<
  MemberStatus,
  { label: string; pill: string; ring: string }
> = {
  safe: {
    label: "Safe",
    pill: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200",
    ring: "stroke-emerald-500",
  },
  help: {
    label: "Needs help",
    pill: "bg-red-600 text-white",
    ring: "stroke-red-600",
  },
  unknown: {
    label: "Not checked in",
    pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    ring: "stroke-zinc-400",
  },
  asking: {
    label: "Asking…",
    pill: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200",
    ring: "stroke-amber-500",
  },
  nocontact: {
    label: "No reply",
    pill: "bg-amber-500 text-white",
    ring: "stroke-amber-500",
  },
};

export default function FamilyView({
  family,
}: {
  family: ReturnType<typeof useFamilyCircle>;
}) {
  const { members, feed, safeStatus, checkInSafe, ask, escalate } = family;
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  const counts = {
    safe: members.filter((m) => m.status === "safe").length,
    help: members.filter((m) => m.status === "help").length,
    unknown: members.filter(
      (m) =>
        m.status === "unknown" ||
        m.status === "nocontact" ||
        m.status === "asking",
    ).length,
  };
  const askable = members
    .filter(
      (m) => m.reply && (m.status === "unknown" || m.status === "nocontact"),
    )
    .map((m) => m.id);
  const me = members[0];
  // People physically with you share your pin instead of stacking on it.
  const { withMe, mapPins, mapLines } = useMemo(() => {
    const withMe = members.filter((m) => m.withMe);
    const apart = members.filter((m) => !m.withMe);
    const mapPins: MapPin[] = apart.map((m) => ({
      kind: "avatar",
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      initials: m.initials,
      label:
        m.id === "me"
          ? ["You", ...withMe.map((w) => w.name.split(" ")[0])].join(", ")
          : m.name.split(" ")[0],
      ring: RING_HEX[m.status],
      pulse: m.status === "help" || m.status === "asking",
      accuracy: m.id === "me" ? m.accuracy : null,
      badge:
        m.id === "me" && withMe.length
          ? {
              text: `+${withMe.length}`,
              color: withMe.some((w) => w.status === "help")
                ? "#dc2626"
                : "#27272a",
            }
          : undefined,
    }));
    const mapLines: [number, number][][] = apart.slice(1).map((m) => [
      [me.lat, me.lng],
      [m.lat, m.lng],
    ]);
    return { withMe, mapPins, mapLines };
  }, [members, me]);

  return (
    <div className="space-y-6">
      {/* Summary + primary actions */}
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex -space-x-2">
          {members.map((m) => (
            <span
              key={m.id}
              className={`grid size-10 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-2 ring-white dark:ring-zinc-900 ${m.gradient}`}
            >
              {m.initials}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            Delgado Family · {members.length} people
          </h2>
          <p className="flex flex-wrap gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {counts.safe} safe
            </span>
            <span className="font-medium text-red-700 dark:text-red-400">
              {counts.help} need help
            </span>
            <span>{counts.unknown} not heard from</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={checkInSafe}
            disabled={safeStatus === "sending"}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
          >
            {safeStatus === "sent" ? (
              <CheckIcon width={18} height={18} />
            ) : (
              <ShieldIcon width={18} height={18} />
            )}
            {safeStatus === "sent"
              ? "You're checked in safe"
              : safeStatus === "sending"
                ? "Notifying…"
                : "I'm safe"}
          </button>
          <button
            type="button"
            onClick={() => ask(askable)}
            disabled={askable.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <BellIcon width={18} height={18} /> Ask everyone to check in
          </button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        {/* Map */}
        <section
          aria-label="Family locations"
          className="self-start overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm xl:col-span-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800">
            <p className="font-medium">Live locations</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shared over satellite · updates every few minutes
            </p>
          </div>
          <LeafletMap
            ariaLabel="Map of where your family members are"
            className="h-[24rem] sm:h-[30rem]"
            pins={mapPins}
            lines={mapLines}
            selectedId={withMe.some((w) => w.id === selected) ? "me" : selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
            fitKey={`${me.lat.toFixed(4)},${me.lng.toFixed(4)}`}
          />
        </section>

        {/* Member list */}
        <section aria-label="Family members" className="xl:col-span-2">
          <ul className="space-y-3">
            {members.map((m) => {
              const st = STATUS_STYLE[m.status];
              const isSel = selected === m.id;
              return (
                <li
                  key={m.id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition dark:bg-zinc-900 ${
                    isSel
                      ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setSelected(isSel ? null : m.id)}
                      aria-label={`Show ${m.name} on the map`}
                      className={`grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${m.gradient}`}
                    >
                      {m.initials}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {m.id === "me" ? "You" : m.name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.pill}`}
                        >
                          {st.label}
                        </span>
                        {m.escalated && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900 dark:bg-sky-950/70 dark:text-sky-200">
                            Responders notified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {m.relation}
                      </p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        {m.note}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <PinIcon width={12} height={12} /> {m.place}
                        </span>
                        <span>{ago(m.updatedAt, m.agoMinAtLoad, now)}</span>
                        <span
                          className={
                            m.battery <= 15
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : ""
                          }
                        >
                          🔋 {m.battery}%
                        </span>
                      </p>
                    </div>
                  </div>
                  {m.reply &&
                    (m.status === "unknown" || m.status === "nocontact") && (
                      <div className="mt-3 flex flex-wrap gap-2 pl-14">
                        <button
                          type="button"
                          onClick={() => ask([m.id])}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <BellIcon width={14} height={14} /> Ask to check in
                        </button>
                        {m.status === "nocontact" && !m.escalated && (
                          <button
                            type="button"
                            onClick={() => escalate(m.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            <SirenIcon width={14} height={14} /> Ask responders
                            to check on {m.name.split(" ")[0]}
                          </button>
                        )}
                      </div>
                    )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UsersIcon width={18} height={18} /> Family activity
        </h2>
        <ul
          aria-live="polite"
          className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800"
        >
          {feed.map((f) => (
            <li key={f.id} className="flex items-start gap-3 py-2.5 text-sm">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white ${
                  f.tone === "good"
                    ? "bg-emerald-600"
                    : f.tone === "bad"
                      ? "bg-red-600"
                      : "bg-sky-600"
                }`}
              >
                {f.tone === "good" ? (
                  <CheckIcon width={12} height={12} />
                ) : f.tone === "bad" ? (
                  <AlertIcon width={11} height={11} />
                ) : (
                  <BellIcon width={11} height={11} />
                )}
              </span>
              <span className="flex-1">{f.text}</span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                {ago(f.at, f.agoMinAtLoad, now)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
