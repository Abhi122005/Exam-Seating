import { readManifest, writeManifest, deleteExamData } from "../../../lib/blob";

export default async function handler(req, res) {
  const secret = req.headers["x-cleanup-secret"] || req.query.secret;
  if (!secret || secret !== process.env.CLEANUP_SECRET) {
    return res.status(401).json({ error: "Invalid or missing cleanup secret" });
  }

  const manifest = await readManifest();
  const now = Date.now();
  let deletedCount = 0;

  // Keep the manifest entry itself (it's tiny, and it's what lets the
  // staff dashboard keep showing exam history, and lets the student page
  // still show a clean "this has expired" instead of a bare 404) --
  // just delete the actual room-data blob, which is the part that can
  // grow large over many exams.
  for (const entry of manifest) {
    if (!entry.dataDeleted && now > new Date(entry.expiresAt).getTime()) {
      await deleteExamData(entry.examId);
      entry.dataDeleted = true;
      deletedCount += 1;
    }
  }

  if (deletedCount > 0) {
    await writeManifest(manifest);
  }

  return res.status(200).json({ checked: manifest.length, deleted: deletedCount });
}
