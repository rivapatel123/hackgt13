"use client";

import { useSyncExternalStore } from "react";

// A shared ticking clock. Returns 0 during server render so markup is stable;
// components should treat 0 as "time unknown yet".
let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 5_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!current) current = Date.now();
      return current;
    },
    () => 0,
  );
}
