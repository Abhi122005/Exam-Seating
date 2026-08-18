import { readExamData, readManifest } from "~/lib/blob";
import type { ExamManifestEntry, ParsedRoom } from "~/lib/blob";

export type ExamReleaseState =
  | { found: false }
  | {
      found: true;
      status: "scheduled" | "expired" | "live";
      meta: ExamManifestEntry;
      rooms?: ParsedRoom[];
      cacheControl: string;
    };

export async function getPublicExamState(examId: string): Promise<ExamReleaseState> {
  const exam = await readExamData(examId);

  if (!exam) {
    const manifest = await readManifest();
    const entry = manifest.find((e) => e.examId === examId);
    if (!entry) {
      return { found: false };
    }
    return {
      found: true,
      status: "expired",
      meta: entry,
      cacheControl: "public, s-maxage=300",
    };
  }

  const now = Date.now();
  const publishAt = new Date(exam.publishAt).getTime();
  const expiresAt = new Date(exam.expiresAt).getTime();

  if (now < publishAt) {
    return {
      found: true,
      status: "scheduled",
      meta: exam,
      cacheControl: "public, s-maxage=10, stale-while-revalidate=5",
    };
  }

  if (now > expiresAt || exam.cleared) {
    return {
      found: true,
      status: "expired",
      meta: exam,
      cacheControl: "public, s-maxage=300",
    };
  }

  return {
    found: true,
    status: "live",
    meta: exam,
    rooms: exam.rooms,
    cacheControl: "public, s-maxage=30, stale-while-revalidate=30",
  };
}