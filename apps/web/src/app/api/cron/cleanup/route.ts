import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { pruneExpiredExams } from "~/lib/exam-cleanup";
import { getCronSecret } from "~/lib/env";

function hasValidCronAuth(authHeader: string | null, cronSecret: string): boolean {
  if (!authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  const headerBytes = Buffer.from(authHeader);
  const expectedBytes = Buffer.from(expected);

  if (headerBytes.length !== expectedBytes.length) return false;
  return crypto.timingSafeEqual(headerBytes, expectedBytes);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = getCronSecret();
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev && !hasValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { removed } = await pruneExpiredExams();

  return NextResponse.json({
    success: true,
    message: `Cleaned up ${removed} expired exam seating files`,
  });
}
