"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export type MapPin =
  | {
      kind: "dot";
      id: string;
      lat: number;
      lng: number;
      color: string;
      darkColor: string;
      radius: number;
      pulse?: boolean;
      tooltip?: string;
      accuracy?: number | null;
    }
  | {
      kind: "avatar";
      id: string;
      lat: number;
      lng: number;
      initials: string;
      label: string;
      ring: string; // CSS color for the status ring
      badge?: { text: string; color: string };
      pulse?: boolean;
      accuracy?: number | null;
    };

// Standard OpenStreetMap tiles (no API key). Dark mode inverts them in CSS.
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/**
 * Real street map (Leaflet + OpenStreetMap/CARTO tiles).
 * - `fitKey`: change it to re-fit the view to all pins.
 * - `selectedId`: the map flies to that pin whenever it changes.
 */
export default function LeafletMap({
  pins,
  lines = [],
  selectedId = null,
  onSelect,
  fitKey = "init",
  maxFitZoom = 14,
  className = "",
  ariaLabel,
}: {
  pins: MapPin[];
  lines?: [number, number][][];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  fitKey?: string | number;
  maxFitZoom?: number;
  className?: string;
  ariaLabel: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tiles = useRef<Leaflet.TileLayer | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Create the map once (Leaflet needs `window`, so load it on the client).
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current) return;
      const lib = mod.default;
      L.current = lib;
      const m = lib.map(el.current, {
        zoomControl: true,
        attributionControl: true,
        worldCopyJump: true,
      });
      m.setView([27.9, -82.5], 10);
      const d = isDark();
      const t = lib.tileLayer(TILE_URL, {
        attribution: ATTRIBUTION,
        maxZoom: 19,
      });
      t.on("tileerror", () => setTilesFailed(true));
      t.on("tileload", () => setTilesFailed(false));
      t.addTo(m);
      tiles.current = t;
      layer.current = lib.layerGroup().addTo(m);
      map.current = m;
      observer = new MutationObserver(() => {
        const nd = isDark();
        setDark(nd);
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      setDark(d);
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Keep Leaflet sized correctly when its container is shown/resized.
  useEffect(() => {
    if (!ready || !el.current) return;
    const ro = new ResizeObserver(() => map.current?.invalidateSize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [ready]);

  // Draw pins, accuracy circles and lines.
  useEffect(() => {
    const lib = L.current;
    const group = layer.current;
    if (!ready || !lib || !group) return;
    group.clearLayers();
    const surface = dark ? "#09090b" : "#ffffff";

    for (const line of lines) {
      lib
        .polyline(line, {
          color: dark ? "#52525b" : "#a1a1aa",
          weight: 2,
          dashArray: "4 6",
          interactive: false,
        })
        .addTo(group);
    }

    // Draw the selected pin last so it sits on top of any pin at the same spot.
    const ordered = [...pins].sort(
      (a, b) => Number(a.id === selectedId) - Number(b.id === selectedId),
    );
    for (const p of ordered) {
      if (p.accuracy && p.accuracy > 0) {
        lib
          .circle([p.lat, p.lng], {
            radius: p.accuracy,
            color: "#2a78d6",
            weight: 1,
            fillColor: "#2a78d6",
            fillOpacity: 0.12,
            interactive: false,
          })
          .addTo(group);
      }
      const selected = p.id === selectedId;
      if (p.kind === "dot") {
        const fill = dark ? p.darkColor : p.color;
        if (p.pulse) {
          lib
            .circleMarker([p.lat, p.lng], {
              radius: p.radius + 6,
              stroke: false,
              fillColor: fill,
              fillOpacity: 0.25,
              className: "cfh-pulse",
              interactive: false,
            })
            .addTo(group);
        }
        const dot = lib.circleMarker([p.lat, p.lng], {
          radius: selected ? p.radius + 4 : p.radius,
          color: surface,
          weight: 2,
          fillColor: fill,
          fillOpacity: 1,
        });
        if (p.tooltip)
          dot.bindTooltip(esc(p.tooltip), {
            direction: "top",
            offset: [0, -p.radius],
          });
        dot.on("click", () => onSelectRef.current?.(p.id));
        dot.addTo(group);
        if (selected) {
          lib
            .circleMarker([p.lat, p.lng], {
              radius: p.radius + 9,
              color: dark ? "#ffffff" : "#18181b",
              weight: 2,
              fill: false,
              interactive: false,
            })
            .addTo(group);
        }
      } else {
        const badge = p.badge
          ? `<span class="cfh-avatar-badge" style="background:${p.badge.color}">${esc(p.badge.text)}</span>`
          : "";
        const icon = lib.divIcon({
          className: "",
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          html: `<div class="cfh-avatar${p.pulse ? " cfh-avatar-pulse" : ""}${selected ? " cfh-avatar-selected" : ""}" style="--ring:${p.ring}">${esc(
            p.initials,
          )}${badge}</div><div class="cfh-avatar-label">${esc(p.label)}</div>`,
        });
        const mk = lib.marker([p.lat, p.lng], {
          icon,
          keyboard: true,
          title: p.label,
          riseOnHover: true,
        });
        mk.on("click", () => onSelectRef.current?.(p.id));
        mk.addTo(group);
      }
    }
  }, [ready, pins, lines, selectedId, dark]);

  // Fit to all pins on first load and whenever fitKey changes.
  const pinsRef = useRef(pins);
  useEffect(() => {
    pinsRef.current = pins;
  });
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    const pts = pinsRef.current.map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length === 1) m.setView(pts[0], maxFitZoom);
    else if (pts.length > 1)
      m.fitBounds(lib.latLngBounds(pts), {
        padding: [40, 40],
        maxZoom: maxFitZoom,
      });
  }, [ready, fitKey, maxFitZoom]);

  // Fly to the selected pin (also once it appears, if its data loads later).
  const sel = selectedId ? pins.find((x) => x.id === selectedId) : undefined;
  const selLat = sel?.lat;
  const selLng = sel?.lng;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || selLat == null || selLng == null) return;
    m.flyTo([selLat, selLng], Math.max(m.getZoom(), 14), { duration: 0.8 });
  }, [ready, selectedId, selLat, selLng]);

  return (
    <div className={`relative isolate ${className}`}>
      <div
        ref={el}
        role="region"
        aria-label={ariaLabel}
        className="h-full w-full bg-zinc-100 dark:bg-zinc-900"
      />
      {tilesFailed && (
        <p className="pointer-events-none absolute top-2 left-1/2 z-[1000] -translate-x-1/2 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 shadow dark:bg-amber-950 dark:text-amber-100">
          Street map offline — pins are still at their exact GPS positions
        </p>
      )}
    </div>
  );
}
