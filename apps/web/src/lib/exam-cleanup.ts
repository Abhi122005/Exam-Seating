import { deleteExamData, readExamData, readManifest, updateManifest } from "~/lib/blob";

export async function pruneExpiredExams(now: number = Date.now()): Promise<{ removed: number }> {
  const manifest = await readManifest();
  const expired = manifest.filter((entry) => now > new Date(entry.expiresAt).getTime());
  for (const entry of expired) {
    // Delete payload first so a failed delete keeps the manifest entry
    // (visible, retryable) instead of silently dropping the reference.
    await deleteExamData(entry.examId);
  }
  if (expired.length > 0) {
    const expiredIds = new Set(expired.map((e) => e.examId));
    await updateManifest((current) => current.filter((entry) => !expiredIds.has(entry.examId)));
  }
  return { removed: expired.length };
}

export async function removeExam(examId: string): Promise<boolean> {
  const manifest = await readManifest();
  const existed = manifest.some((entry) => entry.examId === examId);
  // Delete the payload before touching the manifest: a storage failure must
  // surface as an error, never as a false "deleted" success.
  await deleteExamData(examId);
  const stored = await readExamData(examId);
  if (existed || stored) {
    await updateManifest((current) => current.filter((entry) => entry.examId !== examId));
  }
  // Truly unknown exam (no manifest entry, no stored blob): idempotent
  // success with no write needed.
  return existed || stored !== null;
}
