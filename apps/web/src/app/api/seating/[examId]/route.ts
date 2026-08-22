import { NextResponse } from "next/server";
import { getPublicExamState } from "~/lib/exam-release";

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const state = await getPublicExamState(examId);

  if (!state.found) {
    return NextResponse.json(
      { error: "Exam not found" },
      { status: 404, headers: { "Cache-Control": "no-store, no-cache" } },
    );
  }

  // Add stale-while-revalidate for smoother edge caching
  const cacheControl = state.cacheControl.replace(
    /s-maxage=(\d+)/,
    "s-maxage=$1, stale-while-revalidate=$1",
  );

  return NextResponse.json(
    { ...state.meta, status: state.status, rooms: state.rooms },
    { status: 200, headers: { "Cache-Control": cacheControl } },
  );
}
