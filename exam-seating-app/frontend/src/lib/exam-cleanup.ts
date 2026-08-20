import {
  deleteExamData,
  readExamData,
  readManifest,
  writeExamData,
  writeManifest,
} from "~/lib/blob";

export const RELEASE_WINDOW_MS = 5 * 60 * 60 * 1000;

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

export async function postponeExam(examId: string, publishAt: string): Promise<boolean> {
  const manifest = await readManifest();
  const entry = manifest.find((e) => e.examId === examId);
  if (!entry) return false;

  const publishAtIso = new Date(publishAt).toISOString();
  const expiresAt = new Date(new Date(publishAtIso).getTime() + RELEASE_WINDOW_MS).toISOString();

  entry.publishAt = publishAtIso;
  entry.expiresAt = expiresAt;
  await writeManifest(manifest);

  const data = await readExamData(examId);
  if (data) {
    await writeExamData(examId, { ...data, publishAt: publishAtIso, expiresAt });
  }
  return true;
}
