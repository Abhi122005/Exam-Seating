import { findSeatInRooms } from "~/lib/seating-format";
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

export interface SeatLookupResult {
  status: "scheduled" | "expired" | "live";
  seat?: { room_no: string; label: string; roll_from?: string; roll_to?: string };
}

export async function lookupSeat(
  examId: string,
  roll: string,
): Promise<{ found: boolean; state?: SeatLookupResult }> {
  const q = roll.trim().toUpperCase();
  // Validate server-side too: keep lookups cheap and reject junk early.
  if (!q || q.length > 40 || !/^[A-Z0-9-]+$/.test(q)) {
    return { found: true, state: undefined };
  }
  const exam = await readExamData(examId);
  if (!exam) {
    const manifest = await readManifest();
    const entry = manifest.find((e) => e.examId === examId);
    if (!entry) return { found: false };
    return { found: true, state: { status: "expired" } };
  }
  const now = Date.now();
  if (now < new Date(exam.publishAt).getTime()) {
    return { found: true, state: { status: "scheduled" } };
  }
  if (now > new Date(exam.expiresAt).getTime() || exam.cleared) {
    return { found: true, state: { status: "expired" } };
  }
  const hit = findSeatInRooms(exam.rooms, q);
  return {
    found: true,
    state: {
      status: "live",
      seat: hit
        ? { room_no: hit.roomNo, label: hit.label, roll_from: hit.roll_from, roll_to: hit.roll_to }
        : undefined,
    },
  };
}

export async function getPublicExamState(examId: string): Promise<ExamReleaseState> {
  return resolveExamState(examId, true);
}

export async function getPublicExamMeta(examId: string): Promise<ExamReleaseState> {
  return resolveExamState(examId, false);
}

async function resolveExamState(examId: string, includeRooms: boolean): Promise<ExamReleaseState> {
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

  // Shell meta: strip rooms/payload internals so the public meta endpoint
  // can never leak the seating plan through the meta object.
  const { rooms: _rooms, cleared: _cleared, ...shellMeta } = exam;

  const now = Date.now();
  const publishAt = new Date(exam.publishAt).getTime();
  const expiresAt = new Date(exam.expiresAt).getTime();

  if (now < publishAt) {
    return {
      found: true,
      status: "scheduled",
      meta: shellMeta,
      cacheControl: "public, s-maxage=10, stale-while-revalidate=5",
    };
  }

  if (now > expiresAt || exam.cleared) {
    return {
      found: true,
      status: "expired",
      meta: shellMeta,
      cacheControl: "public, s-maxage=300",
    };
  }

  return {
    found: true,
    status: "live",
    meta: shellMeta,
    rooms: includeRooms ? exam.rooms : undefined,
    cacheControl: "public, s-maxage=30, stale-while-revalidate=30",
  };
}
