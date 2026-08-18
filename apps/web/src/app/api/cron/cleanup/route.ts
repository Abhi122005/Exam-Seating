import { NextResponse } from "next/server";
import {
  deleteExamData,
  readExamData,
  readManifest,
  writeExamData,
  writeManifest,
} from "~/lib/blob";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "change-me-cron";
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const manifest = await readManifest();
  const now = Date.now();
  let updatedCount = 0;

  for (const entry of manifest) {
    const expiresAt = new Date(entry.expiresAt).getTime();
    if (now > expiresAt) {
      const examData = await readExamData(entry.examId);
      if (examData && !examData.cleared) {
        await writeExamData(entry.examId, {
          ...examData,
          cleared: true,
          rooms: [],
        });
        await deleteExamData(entry.examId);
        updatedCount++;
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `Cleaned up ${updatedCount} expired exam seating files`,
  });
}
