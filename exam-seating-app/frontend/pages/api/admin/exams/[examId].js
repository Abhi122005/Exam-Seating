import { requireSession } from "../../../../lib/auth";
import { readManifest, writeManifest, readExamData, writeExamData, deleteExamData } from "../../../../lib/blob";

export default async function handler(req, res) {
  const { examId } = req.query;

  if (req.method === "DELETE") {
    if (!requireSession(req, res)) return;
    const manifest = await readManifest();
    const exam = manifest.find((e) => e.examId === examId);
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    await deleteExamData(examId); // actually frees the storage, not just clears it
    await writeManifest(manifest.filter((e) => e.examId !== examId));
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!requireSession(req, res)) return;

  const { publishAt } = req.body || {};
  if (!publishAt) return res.status(400).json({ error: "publishAt is required" });

  const manifest = await readManifest();
  const entry = manifest.find((e) => e.examId === examId);
  if (!entry) return res.status(404).json({ error: "Exam not found" });

  const publishAtIso = new Date(publishAt).toISOString();
  const expiresAtIso = new Date(new Date(publishAt).getTime() + 5 * 60 * 60 * 1000).toISOString();

  entry.publishAt = publishAtIso;
  entry.expiresAt = expiresAtIso;
  await writeManifest(manifest);

  const data = await readExamData(examId);
  if (data) {
    await writeExamData(examId, { ...data, publishAt: publishAtIso, expiresAt: expiresAtIso });
  }

  return res.status(200).json({ ok: true, publishAt: publishAtIso, expiresAt: expiresAtIso });
}
