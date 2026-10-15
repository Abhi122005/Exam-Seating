import { NextResponse } from "next/server";
import { lookupSeat } from "~/lib/exam-release";

const EXAM_ID_RE = /^[A-Za-z0-9-]{1,128}$/;

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  if (!EXAM_ID_RE.test(examId)) {
    return NextResponse.json(
      { error: "Invalid exam id" },
      { status: 400, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }
  const roll = new URL(req.url).searchParams.get("roll") ?? "";

  const { found, state } = await lookupSeat(examId, roll);

  if (!found) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }

  if (!state) {
    return NextResponse.json(
      { error: "Valid roll number is required" },
      { status: 400, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }

  // Single-student result only — never return the full seating plan.
  // Private per-roll response: must not be cached by shared CDN.
  return NextResponse.json(state, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
