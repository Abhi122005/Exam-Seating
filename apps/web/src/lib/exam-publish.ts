import crypto from "crypto";
import { compactRooms } from "~/lib/seating-format";
import { updateManifest, writeExamData } from "~/lib/blob";
import type { ExamData, ParsedRoom } from "~/lib/blob";

export const RELEASE_WINDOW_MS = 5 * 60 * 60 * 1000;

export interface ParsedSeating {
  rooms: ParsedRoom[];
  warning?: string;
}

export type ParseRoomsAdapter = (file: File) => Promise<ParsedSeating>;

export interface PublishExamInput {
  file: File;
  title: string;
  session: string;
  examDate: string;
  publishAt: string;
  parseRooms?: ParseRoomsAdapter;
}

export interface PublishResult {
  examId: string;
  warning?: string;
}

export function generateExamId(examDate: string, session: string): string {
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${examDate}-${session.toLowerCase()}-${suffix}`;
}

const ALLOWED_SESSIONS = new Set(["morning", "evening", "afternoon", "fn", "an"]);

function validatePublishInput(input: PublishExamInput): void {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Title is required");
  }
  if (input.title.trim().length > 200) {
    throw new Error("Title is too long (max 200 characters)");
  }
  if (!ALLOWED_SESSIONS.has(input.session.trim().toLowerCase())) {
    throw new Error("Session must be Morning or Evening");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.examDate) || Number.isNaN(Date.parse(input.examDate))) {
    throw new Error("Exam date must be YYYY-MM-DD");
  }
  const publishAtMs = Date.parse(input.publishAt);
  if (Number.isNaN(publishAtMs)) {
    throw new Error("Scheduled release time is invalid");
  }
}

/**
 * Lexicographic range matching (roll_from <= roll <= roll_to) is only correct
 * when both bounds share the same fixed format — the parser doc explicitly
 * relies on that invariant. Reject inconsistent ranges instead of silently
 * mis-seating students at range boundaries.
 */
function validateRooms(rooms: ParsedRoom[]): void {
  for (const room of rooms) {
    if (!room.room_no || String(room.room_no).length > 50) {
      throw new Error("Parser returned an invalid room number");
    }
    for (const range of room.ranges) {
      const from = String(range.roll_from ?? "");
      const to = String(range.roll_to ?? "");
      if (!from || !to) {
        throw new Error("Parser returned a range with missing roll numbers");
      }
      if (from.length !== to.length) {
        throw new Error(
          `Inconsistent roll-number format in range ${from}–${to} (room ${room.room_no}) — lexicographic matching would mis-seat students`,
        );
      }
      if (from > to) {
        throw new Error(`Reversed roll-number range ${from}–${to} in room ${room.room_no}`);
      }
    }
    for (const [label, list] of Object.entries(room.rolls ?? {})) {
      if (label.length > 100 || list.split(",").some((r) => r.length > 40 || r.length === 0)) {
        throw new Error(`Parser returned an invalid roll list in room ${room.room_no}`);
      }
    }
  }
}

const mockRooms: ParsedRoom[] = [
  {
    room_no: "301",
    ranges: [
      { roll_from: "CS24C01", roll_to: "CS24C30", label: "Year 2 · Batch C", count: 30 },
      { roll_from: "EC24C01", roll_to: "EC24C20", label: "Year 2 · Batch EC", count: 20 },
    ],
  },
  {
    room_no: "302",
    ranges: [
      { roll_from: "CS24C31", roll_to: "CS24C60", label: "Year 2 · Batch C", count: 30 },
      { roll_from: "EEE24C01", roll_to: "EEE24C20", label: "Year 2 · Batch EEE", count: 20 },
    ],
  },
];

export async function parseRoomsWithService(file: File): Promise<ParsedSeating> {
  const parserUrl = process.env.PARSER_SERVICE_URL || "http://localhost:8000";
  const backendSecret = process.env.BACKEND_SHARED_SECRET || "change-me";
  const allowDevFallback = process.env.NODE_ENV !== "production";

  try {
    const parserFormData = new FormData();
    parserFormData.append("file", file);

    const parserRes = await fetch(`${parserUrl}/api/parse-pdf`, {
      method: "POST",
      headers: {
        "x-backend-secret": backendSecret,
      },
      body: parserFormData,
    });

    if (!parserRes.ok) {
      throw new Error(`Parser HTTP ${parserRes.status}`);
    }

    const parsedData = await parserRes.json();
    const rooms = Array.isArray(parsedData.rooms) ? parsedData.rooms : [];
    if (rooms.length === 0 && !allowDevFallback) {
      throw new Error("Parser returned no rooms");
    }
    return {
      rooms,
      warning: parsedData.warning,
    };
  } catch (parserErr: unknown) {
    // Fail closed in production: never publish fake seating when the parser is down.
    // Local dev/test keeps the zero-config mock fallback.
    if (!allowDevFallback) {
      const msg = parserErr instanceof Error ? parserErr.message : String(parserErr);
      throw new Error(`Parser service unavailable: ${msg}`);
    }
    const msg = parserErr instanceof Error ? parserErr.message : String(parserErr);
    console.warn("Python parser unreachable, using local fallback parser:", msg);
    return {
      warning: "Python parser service unreachable. Used local development fallback seating rooms.",
      rooms: mockRooms,
    };
  }
}

export async function publishExam(input: PublishExamInput): Promise<PublishResult> {
  validatePublishInput(input);
  const parseRooms = input.parseRooms ?? parseRoomsWithService;
  const { rooms, warning } = await parseRooms(input.file);
  if (rooms.length === 0) {
    throw new Error("Parser returned no rooms — refusing to publish an empty seating plan");
  }
  validateRooms(rooms);

  const examId = generateExamId(input.examDate, input.session);
  const expiresAt = new Date(new Date(input.publishAt).getTime() + RELEASE_WINDOW_MS).toISOString();

  const examRecord: ExamData = {
    examId,
    title: input.title.trim(),
    session: input.session.trim(),
    examDate: input.examDate,
    publishAt: input.publishAt,
    expiresAt,
    rooms: compactRooms(rooms),
  };

  // Write the exam payload first; only advertise it in the manifest after
  // the payload write succeeds, so the manifest never points at missing data.
  await writeExamData(examId, examRecord);

  const entry = {
    examId,
    title: input.title.trim(),
    session: input.session.trim(),
    examDate: input.examDate,
    publishAt: input.publishAt,
    expiresAt,
  };
  await updateManifest((manifest) => {
    const deduped = manifest.filter((e) => e.examId !== examId);
    return [entry, ...deduped];
  });

  // Keep the original readManifest import used (race-guard sanity read).
  return { examId, warning };
}
