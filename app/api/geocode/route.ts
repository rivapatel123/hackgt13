import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/app/lib/geocode";

// Street address for a GPS fix (used for the live "you are here" card).
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  return NextResponse.json({ address: await reverseGeocode(lat, lng) });
}
