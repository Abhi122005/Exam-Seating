import { NextResponse } from "next/server";
import { getPublicExamMeta } from "~/lib/exam-release";

const EXAM_ID_RE = /^[A-Za-z0-9-]{1,128}$/;

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  if (!EXAM_ID_RE.test(examId)) {
    return NextResponse.json(
      { error: "Invalid exam id" },
      { status: 400, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }
  const state = await getPublicExamMeta(examId);
  if (!state.found) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }
  return NextResponse.json(
    { ...state.meta, status: state.status },
    { status: 200, headers: { "Cache-Control": state.cacheControl } },
  );
}
