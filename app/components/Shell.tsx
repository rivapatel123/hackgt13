"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  BellIcon,
  MoonIcon,
  SatelliteIcon,
  SirenIcon,
  SunIcon,
  UserIcon,
} from "@/app/components/icons";
import { setTheme } from "@/app/lib/theme";

export type NavItem<T extends string> = {
  key: T;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: number | string;
  accent?: boolean;
};

export type Notice = {
  id: string;
  tone: "critical" | "warning" | "info" | "good";
  title: string;
  body: string;
  time: string;
};

export default function Shell<T extends string>({
  product,
  nav,
  tab,
  onTab,
  title,
  sub,
  titleTone = "default",
  banner,
  profile,
  switchTo,
  notices,
  children,
}: {
  product: string;
  nav: NavItem<T>[];
  tab: T;
  onTab: (t: T) => void;
  title: string;
  sub: string;
  titleTone?: "default" | "alert";
  banner?: ReactNode;
  profile: {
    initials: string;
    name: string;
    sub: string;
    gradient: string;
    onClick: () => void;
  };
  switchTo: { href: string; label: string };
  notices: Notice[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ---- Sidebar (desktop) ---- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-xl bg-red-600 text-white shadow-sm">
            <SirenIcon width={20} height={20} />
          </span>
          <div>
            <p className="leading-tight font-semibold tracking-tight">
              ResQ
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {product}
            </p>
          </div>
        </div>

        <nav aria-label="Main" className="flex-1 px-3">
          <ul className="space-y-1">
            {nav.map((n) => {
              const active = tab === n.key;
              return (
                <li key={n.key}>
                  <button
                    type="button"
                    onClick={() => onTab(n.key)}
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
                        active && n.accent
                          ? "text-red-600 dark:text-red-500"
                          : ""
                      }
                    />
                    {n.label}
                    {n.badge != null && n.badge !== 0 && (
                      <span className="ml-auto rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                        {n.badge}
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

        <Link
          href={switchTo.href}
          className="mx-3 mb-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-center text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
        >
          {switchTo.label} →
        </Link>

        <button
          type="button"
          onClick={profile.onClick}
          className="flex items-center gap-3 border-t border-zinc-200 px-4 py-4 text-left transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
        >
          <span
            className={`grid size-10 place-items-center rounded-full bg-gradient-to-br text-sm font-bold text-white ${profile.gradient}`}
          >
            {profile.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {profile.name}
            </span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {profile.sub}
            </span>
          </span>
          <UserIcon width={16} height={16} className="text-zinc-400" />
        </button>
      </aside>

      {/* ---- Main ---- */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {banner}
        <header className="flex items-start justify-between gap-4 px-4 pt-6 pb-4 sm:px-8">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 lg:hidden">
              <span className="grid size-7 place-items-center rounded-lg bg-red-600 text-white">
                <SirenIcon width={16} height={16} />
              </span>
              <span className="font-semibold">ResQ</span>
              <Link
                href={switchTo.href}
                className="ml-1 text-xs text-zinc-500 underline dark:text-zinc-400"
              >
                {switchTo.label}
              </Link>
            </div>
            <h1
              className={`text-2xl font-bold tracking-tight sm:text-3xl ${titleTone === "alert" ? "text-red-700 dark:text-red-400" : ""}`}
            >
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
              {sub}
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
            <Notifications notices={notices} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-10 sm:px-8">{children}</main>
      </div>

      {/* ---- Bottom tabs (mobile) ---- */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
      >
        <ul
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))`,
          }}
        >
          {nav.map((n) => {
            const active = tab === n.key;
            return (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => onTab(n.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    active
                      ? n.accent
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

const TONE_DOT: Record<Notice["tone"], string> = {
  critical: "bg-red-600",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  good: "bg-emerald-500",
};

function Notifications({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const unread = Math.max(0, notices.length - seen);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setSeen(notices.length);
        }}
        aria-label={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <BellIcon width={18} height={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-zinc-50 dark:ring-zinc-950">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <p className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
            Alerts
          </p>
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {notices.map((n) => (
              <li key={n.id} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_DOT[n.tone]}`}
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

export function Toast({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      role="status"
      className="fixed right-4 bottom-24 z-40 max-w-sm rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-2xl lg:bottom-6 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {children}
    </div>
  );
}
