export async function geocode(address: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address,
  )}&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  const loc = data.results[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

// Turn GPS coordinates into a readable street address (OpenStreetMap
// Nominatim — free, no key; fine for low-volume demo traffic).
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "CallForHelp/0.1 (hackathon demo)",
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (!res.ok) return null;
    const a = (await res.json()).address ?? {};
    const street = [a.house_number, a.road ?? a.pedestrian ?? a.footway]
      .filter(Boolean)
      .join(" ");
    const place = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county;
    const parts = [street || a.neighbourhood || a.amenity, place].filter(
      Boolean,
    );
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  }
}
