import { requireSession } from "../../../lib/auth";
import { readManifest, writeManifest, writeExamData } from "../../../lib/blob";
import { randomUUID } from "crypto";

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" }, // PDFs arrive base64-encoded in JSON, see below
  },
};

async function parseWithBackend(fileBase64, fileName) {
  const backendUrl = process.env.BACKEND_URL;
  const secret = process.env.BACKEND_SHARED_SECRET;
  if (!backendUrl || !secret) {
    throw new Error("BACKEND_URL / BACKEND_SHARED_SECRET are not configured");
  }

  const buffer = Buffer.from(fileBase64, "base64");
  const blob = new Blob([buffer], { type: "application/pdf" });

  const formData = new FormData();
  formData.append("file", blob, fileName || "upload.pdf");

  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/parse-pdf`, {
    method: "POST",
    headers: { "x-backend-secret": secret },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "PDF parsing failed");
  }
  return data; // { rooms, source, warning }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(req, res)) return;

  const { fileBase64, fileName, title, session, examDate, publishAt } = req.body || {};

  if (!fileBase64 || !title || !session || !examDate || !publishAt) {
    return res.status(400).json({
      error: "Missing required fields (file, title, session, examDate, publishAt)",
    });
  }

  let parsed;
  try {
    parsed = await parseWithBackend(fileBase64, fileName);
  } catch (err) {
    return res.status(502).json({ error: err.message || "PDF parsing failed" });
  }

  if (!parsed.rooms || parsed.rooms.length === 0) {
    return res.status(422).json({
      error: parsed.warning || "No rooms could be parsed from this PDF",
      source: parsed.source,
    });
  }

  const examId = randomUUID();
  const publishAtIso = new Date(publishAt).toISOString();
  const expiresAtIso = new Date(new Date(publishAt).getTime() + 5 * 60 * 60 * 1000).toISOString();

  const examData = {
    examId,
    title,
    session, // "FN" | "AN"
    examDate,
    publishAt: publishAtIso,
    expiresAt: expiresAtIso,
    parsedSource: parsed.source,
    rooms: parsed.rooms, // [{ room_no, ranges: [{roll_from, roll_to, label, count}] }]
    cleared: false,
  };

  let examUrl;
  try {
    examUrl = await writeExamData(examId, examData);
  } catch (err) {
    return res.status(500).json({ error: `Failed to write to Vercel Blob: ${err.message}` });
  }

  const manifest = await readManifest();
  manifest.push({
    examId,
    title,
    session,
    examDate,
    publishAt: publishAtIso,
    expiresAt: expiresAtIso,
    examUrl,
  });
  await writeManifest(manifest);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;

  return res.status(200).json({
    examId,
    studentUrl: `${siteUrl.replace(/\/$/, "")}/exam/${examId}`,
    publishAt: publishAtIso,
    expiresAt: expiresAtIso,
    warning: parsed.warning || null,
  });
}
