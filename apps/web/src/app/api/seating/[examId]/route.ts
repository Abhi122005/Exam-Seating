import { NextResponse } from "next/server";
import { getPublicExamState } from "~/lib/exam-release";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;

  const state = await getPublicExamState(examId);

  if (!state.found) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { ...state.meta, status: state.status, rooms: state.rooms },
    { status: 200, headers: { "Cache-Control": state.cacheControl } }
  );
}