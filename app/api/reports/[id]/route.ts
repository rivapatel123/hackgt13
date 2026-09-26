import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(report);
}