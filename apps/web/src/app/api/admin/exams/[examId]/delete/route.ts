import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { removeExam } from "~/lib/exam-cleanup";

export async function POST(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  await removeExam(examId);

  return NextResponse.json({ success: true });
}
