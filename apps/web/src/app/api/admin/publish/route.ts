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
    const session = (formData.get("session") as string) || "Morning";
    const examDate = (formData.get("examDate") as string) || new Date().toISOString().split("T")[0];
    const publishAt = (formData.get("publishAt") as string) || new Date().toISOString();

    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    // Server-side PDF validation
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPdf =
      head[0] === 0x25 &&
      head[1] === 0x50 &&
      head[2] === 0x44 &&
      head[3] === 0x46 &&
      head[4] === 0x2d;
    if (!isPdf) {
      return NextResponse.json({ error: "File is not a valid PDF" }, { status: 400 });
    }

    const result = await publishExam({ file, title, session, examDate, publishAt });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
