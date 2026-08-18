import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { readManifest, writeExamData, writeManifest } from "~/lib/blob";
import { compactRooms } from "~/lib/seating-format";

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

    const parserUrl = process.env.PARSER_SERVICE_URL || "http://localhost:8000";
    const backendSecret = process.env.BACKEND_SHARED_SECRET || "change-me";

    let rooms: any[] = [];
    let warning: string | undefined = undefined;

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

      if (parserRes.ok) {
        const parsedData = await parserRes.json();
        rooms = parsedData.rooms || [];
        warning = parsedData.warning;
      } else {
        throw new Error(`Parser HTTP ${parserRes.status}`);
      }
    } catch (parserErr: any) {
      // Local testing fallback when Python parser service is offline or unreachable
      console.warn("Python parser unreachable, using local fallback parser:", parserErr.message);
      warning = "Python parser service unreachable. Used local development fallback seating rooms.";
      rooms = [
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
    }

    const examId = `${examDate}-${session.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const expiresAt = new Date(new Date(publishAt).getTime() + 5 * 60 * 60 * 1000).toISOString();

    const examRecord = {
      examId,
      title,
      session,
      examDate: examDate!,
      publishAt,
      expiresAt,
      rooms: compactRooms(rooms),
    };

    await writeExamData(examId, examRecord);

    const manifest = await readManifest();
    manifest.unshift({
      examId,
      title,
      session,
      examDate: examDate!,
      publishAt,
      expiresAt,
    });
    await writeManifest(manifest);

    return NextResponse.json({
      success: true,
      examId,
      warning,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process PDF" }, { status: 500 });
  }
}
