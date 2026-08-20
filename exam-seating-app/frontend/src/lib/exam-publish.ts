import crypto from "crypto";
import { compactRooms } from "~/lib/seating-format";
import { readManifest, writeExamData, writeManifest } from "~/lib/blob";
import type { ExamData, ParsedRoom } from "~/lib/blob";

export const RELEASE_WINDOW_MS = 5 * 60 * 60 * 1000;

export interface ParsedSeating {
  rooms: ParsedRoom[];
  source?: string;
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
  parsedSource?: string;
}

export function generateExamId(examDate: string, session: string): string {
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${examDate}-${session.toLowerCase()}-${suffix}`;
}

const mockRooms: ParsedRoom[] = [
  {
    room_no: "301",
    ranges: [
      { roll_from: "CS24C01", roll_to: "CS24C30", label: "Year 2 \u00b7 Batch C", count: 30 },
      { roll_from: "EC24C01", roll_to: "EC24C20", label: "Year 2 \u00b7 Batch EC", count: 20 },
    ],
  },
  {
    room_no: "302",
    ranges: [
      { roll_from: "CS24C31", roll_to: "CS24C60", label: "Year 2 \u00b7 Batch C", count: 30 },
      { roll_from: "EEE24C01", roll_to: "EEE24C20", label: "Year 2 \u00b7 Batch EEE", count: 20 },
    ],
  },
];

export async function parseRoomsWithService(file: File): Promise<ParsedSeating> {
  const parserUrl = process.env.PARSER_SERVICE_URL || "http://localhost:8000";
  const backendSecret = process.env.BACKEND_SHARED_SECRET || "change-me";

  try {
    const parserFormData = new FormData();
    parserFormData.append("file", file);

    const parserRes = await fetch(`${parserUrl.replace(/\/$/, "")}/api/parse-pdf`, {
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
    return {
      rooms: parsedData.rooms || [],
      source: parsedData.source,
      warning: parsedData.warning,
    };
  } catch (parserErr: any) {
    // Local testing fallback when Python parser service is offline or unreachable
    console.warn("Python parser unreachable, using local fallback parser:", parserErr.message);
    return {
      source: "local_fallback",
      warning: "Python parser service unreachable. Used local development fallback seating rooms.",
      rooms: mockRooms,
    };
  }
}

export async function publishExam(input: PublishExamInput): Promise<PublishResult> {
  const parseRooms = input.parseRooms ?? parseRoomsWithService;
  const { rooms, source, warning } = await parseRooms(input.file);

  const examId = generateExamId(input.examDate, input.session);
  const publishAtIso = new Date(input.publishAt).toISOString();
  const expiresAt = new Date(new Date(publishAtIso).getTime() + RELEASE_WINDOW_MS).toISOString();

  const examRecord: ExamData = {
    examId,
    title: input.title,
    session: input.session,
    examDate: input.examDate,
    publishAt: publishAtIso,
    expiresAt,
    parsedSource: source,
    rooms: compactRooms(rooms),
  };

  await writeExamData(examId, examRecord);

  const manifest = await readManifest();
  manifest.unshift({
    examId,
    title: input.title,
    session: input.session,
    examDate: input.examDate,
    publishAt: publishAtIso,
    expiresAt,
  });
  await writeManifest(manifest);

  return { examId, warning, parsedSource: source };
}
