import { deleteExamData, readManifest, writeManifest } from "~/lib/blob";

export async function pruneExpiredExams(now: number = Date.now()): Promise<{ removed: number }> {
  const manifest = await readManifest();
  const expired = manifest.filter((entry) => now > new Date(entry.expiresAt).getTime());
  for (const entry of expired) {
    await deleteExamData(entry.examId);
  }
  if (expired.length > 0) {
    await writeManifest(manifest.filter((entry) => !expired.includes(entry)));
  }
  return { removed: expired.length };
}

export async function removeExam(examId: string): Promise<boolean> {
  const manifest = await readManifest();
  const nextManifest = manifest.filter((entry) => entry.examId !== examId);
  const existed = nextManifest.length !== manifest.length;
  await deleteExamData(examId);
  if (existed) {
    await writeManifest(nextManifest);
  }
  return existed;
}
