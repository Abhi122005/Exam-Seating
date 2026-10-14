import { NextResponse } from "next/server";
import { getPublicExamMeta } from "~/lib/exam-release";

export async function GET(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
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
