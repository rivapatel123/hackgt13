"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coords } from "@/app/lib/location";

export type LocationStatus =
  | "off" // sharing turned off in Settings
  | "locating"
  | "ok"
  | "denied" // the user (or browser) blocked location for this site
  | "unavailable" // no fix: e.g. macOS Location Services is off for the browser
  | "insecure" // page isn't HTTPS/localhost, so browsers refuse location
  | "unsupported";

export type LiveLocation = {
  status: LocationStatus;
  coords: Coords | null;
  address: string | null;
  updatedAt: number | null;
  /** Ask again (e.g. after the user allowed location in the browser). */
  retry: () => void;
  /** Resolves with a fix as soon as one exists (or null after `ms`). */
  waitForFix: (ms?: number) => Promise<Coords | null>;
};

function metres(a: Coords, b: Coords) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export { metres as distanceMetres };

/**
 * Watches the device's real GPS position while `enabled`, and looks up the
 * street address for it. Starts asking as soon as the page opens so the fix
 * is ready before someone taps SOS.
 */
export function useLiveLocation(enabled: boolean): LiveLocation {
  const [status, setStatus] = useState<LocationStatus>("locating");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const coordsRef = useRef<Coords | null>(null);
  const waiters = useRef<((c: Coords | null) => void)[]>([]);
  const lastLookup = useRef<Coords | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let watchId: number | null = null;
    let perm: PermissionStatus | null = null;
    let cancelled = false;

    const fail = (s: LocationStatus) => {
      setStatus(s);
      waiters.current.splice(0).forEach((w) => w(coordsRef.current));
    };

    // Run on the next tick so state updates don't happen synchronously in the effect.
    const kickoff = setTimeout(() => {
      if (!window.isSecureContext) return fail("insecure");
      if (!navigator.geolocation) return fail("unsupported");
      setStatus((s) => (s === "ok" ? s : "locating"));
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const c = {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            accuracy: p.coords.accuracy,
          };
          coordsRef.current = c;
          setCoords(c);
          setUpdatedAt(Date.now());
          setStatus("ok");
          waiters.current.splice(0).forEach((w) => w(c));
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) fail("denied");
          else if (err.code === err.POSITION_UNAVAILABLE) fail("unavailable");
          // TIMEOUT: keep watching — a fix often arrives a moment later.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
      // If the user flips the site permission to "Allow", start over.
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((p) => {
          if (cancelled) return;
          perm = p;
          p.onchange = () => {
            if (p.state === "granted") setAttempt((a) => a + 1);
            else if (p.state === "denied") fail("denied");
          };
        })
        .catch(() => {});
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(kickoff);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (perm) perm.onchange = null;
    };
  }, [enabled, attempt]);

  // Street address, looked up again only after moving ~25 m.
  useEffect(() => {
    if (!coords) return;
    if (lastLookup.current && metres(lastLookup.current, coords) < 25) return;
    lastLookup.current = coords;
    const ctrl = new AbortController();
    fetch(`/api/geocode?lat=${coords.lat}&lng=${coords.lng}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.address && setAddress(d.address))
      .catch(() => {});
    return () => ctrl.abort();
  }, [coords]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const waitForFix = useCallback((ms = 8000) => {
    if (coordsRef.current) return Promise.resolve(coordsRef.current);
    return new Promise<Coords | null>((resolve) => {
      const t = setTimeout(() => resolve(coordsRef.current), ms);
      waiters.current.push((c) => {
        clearTimeout(t);
        resolve(c);
      });
    });
  }, []);

  return {
    status: enabled ? status : "off",
    coords: enabled ? coords : null,
    address: enabled ? address : null,
    updatedAt,
    retry,
    waitForFix,
  };
}

/** Plain-language fix for each problem, shown next to the map. */
export function locationHelp(status: LocationStatus): string | null {
  switch (status) {
    case "insecure":
      return "Browsers only share location on secure pages. Open http://localhost:3000 on this computer, or run “npm run dev:https” and use the https:// address on your phone.";
    case "denied":
      return "Location is blocked for this site. Click the icon at the left of the address bar → Location → Allow. It will update automatically.";
    case "unavailable":
      return "Your device couldn't find its position. On a Mac, turn on System Settings → Privacy & Security → Location Services, and allow your browser.";
    case "unsupported":
      return "This browser can't share its location.";
    case "off":
      return "Location sharing is off in Settings.";
    default:
      return null;
  }
}
