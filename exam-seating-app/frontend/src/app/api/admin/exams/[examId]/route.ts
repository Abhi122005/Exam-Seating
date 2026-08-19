import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { postponeExam, removeExam } from "~/lib/exam-cleanup";

export async function PATCH(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const body = await req.json().catch(() => null);
  const publishAt = typeof body?.publishAt === "string" ? body.publishAt : "";

  if (!publishAt) {
    return NextResponse.json({ error: "publishAt is required" }, { status: 400 });
  }

  const ok = await postponeExam(examId, publishAt);
  if (!ok) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const existed = await removeExam(examId);
  if (!existed) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}