import { NextResponse } from "next/server";
import { pruneExpiredExams } from "~/lib/exam-cleanup";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "change-me-cron";
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { removed } = await pruneExpiredExams();

  return NextResponse.json({
    success: true,
    message: `Cleaned up ${removed} expired exam seating files`,
  });
}
