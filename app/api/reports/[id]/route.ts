import { NextRequest, NextResponse } from "next/server";
import { db, REPORT_COLUMNS } from "@/app/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = db
    .prepare(`SELECT ${REPORT_COLUMNS} FROM reports WHERE id = ?`)
    .get(id);
  if (!report)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(report);
}

// Responders assign (or unassign) a unit to a report.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const assignedTo =
    typeof body.assigned_to === "string" && body.assigned_to
      ? body.assigned_to
      : null;
  const result = db
    .prepare("UPDATE reports SET assigned_to = ? WHERE id = ?")
    .run(assignedTo, id);
  if (result.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    db.prepare(`SELECT ${REPORT_COLUMNS} FROM reports WHERE id = ?`).get(id),
  );
}

// Demo cleanup: responders can remove a message (and its recording).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = db.prepare("DELETE FROM reports WHERE id = ?").run(id);
  if (result.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
