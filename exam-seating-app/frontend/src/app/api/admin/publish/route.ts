import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { publishExam } from "~/lib/exam-publish";

export async function POST(req: Request) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "KTU Exam Seating";
    const session = (formData.get("session") as string) || "FN";
    const examDate = (formData.get("examDate") as string) || new Date().toISOString().split("T")[0];
    const publishAt = (formData.get("publishAt") as string) || new Date().toISOString();

    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const result = await publishExam({ file, title, session, examDate, publishAt });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host")}`;
    const studentUrl = `${siteUrl.replace(/\/$/, "")}/exam?id=${encodeURIComponent(result.examId)}`;

    return NextResponse.json({
      success: true,
      examId: result.examId,
      studentUrl,
      publishAt: new Date(publishAt).toISOString(),
      warning: result.warning || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process PDF" }, { status: 500 });
  }
}