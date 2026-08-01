import { readExamData, readManifest } from "../../../lib/blob";

export default async function handler(req, res) {
  const { examId } = req.query;

  let exam = await readExamData(examId);

  if (!exam) {
    // Either it never existed, or the cleanup cron already deleted its
    // room-data blob after expiry -- check the (much smaller, kept
    // forever) manifest entry to tell those two cases apart and still
    // show a clean "expired" screen instead of a bare 404.
    const manifest = await readManifest();
    const entry = manifest.find((e) => e.examId === examId);
    if (!entry) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "Exam not found" });
    }
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json({
      examId: entry.examId,
      title: entry.title,
      session: entry.session,
      examDate: entry.examDate,
      publishAt: entry.publishAt,
      expiresAt: entry.expiresAt,
      status: "expired",
    });
  }

  const now = Date.now();
  const publishAt = new Date(exam.publishAt).getTime();
  const expiresAt = new Date(exam.expiresAt).getTime();

  const base = {
    examId: exam.examId,
    title: exam.title,
    session: exam.session,
    examDate: exam.examDate,
    publishAt: exam.publishAt,
    expiresAt: exam.expiresAt,
  };

  if (now < publishAt) {
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=5");
    return res.status(200).json({ ...base, status: "scheduled" });
  }

  if (now > expiresAt || exam.cleared) {
    res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.status(200).json({ ...base, status: "expired" });
  }

  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
  return res.status(200).json({ ...base, status: "live", rooms: exam.rooms });
}
