"use client";

export type Coords = { lat: number; lng: number; accuracy: number };

/** One GPS fix from the device, or null if it's blocked or too slow. */
export function getCurrentLocation(timeoutMs = 12_000): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
