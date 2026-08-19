import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { deleteExamData, readManifest, writeManifest } from "~/lib/blob";

export async function POST(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;

  await deleteExamData(examId);
  const manifest = await readManifest();
  const nextManifest = manifest.filter((e) => e.examId !== examId);
  await writeManifest(nextManifest);

  return NextResponse.json({ success: true });
}
