import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "release-test-"));
  process.chdir(tmpDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

async function freshRelease() {
  const blob = await import("~/lib/blob");
  const release = await import("~/lib/exam-release");
  return { blob, release };
}

const PUBLISH = "2026-08-18T08:00:00.000Z";
const EXPIRES = "2026-08-18T18:00:00.000Z";

function freshBlob() {
  return import("~/lib/blob");
}

type BlobModule = Awaited<ReturnType<typeof freshBlob>>;

async function seedLiveExam(blob: BlobModule, overrides: Record<string, unknown> = {}) {
  const exam = {
    examId: "e1",
    title: "KTU Exam",
    session: "Morning",
    examDate: "2026-08-18",
    publishAt: PUBLISH,
    expiresAt: EXPIRES,
    rooms: [{ room_no: "301", ranges: [{ roll_from: "CS24C01", roll_to: "CS24C10", count: 10 }] }],
    ...overrides,
  };
  await blob.writeExamData(exam.examId, exam);
  await blob.writeManifest([
    {
      examId: exam.examId,
      title: exam.title,
      session: exam.session,
      examDate: exam.examDate,
      publishAt: exam.publishAt,
      expiresAt: exam.expiresAt,
    },
  ]);
  return exam;
}

describe("exam release gate", () => {
  it("returns not found for unknown exams", async () => {
    const { release } = await freshRelease();
    expect(await release.getPublicExamState("ghost")).toEqual({ found: false });
  });

  it("returns expired when only the manifest entry remains", async () => {
    const { blob, release } = await freshRelease();
    await blob.writeManifest([
      {
        examId: "e1",
        title: "Old",
        session: "Morning",
        examDate: "2026-08-17",
        publishAt: "2026-08-17T08:00:00.000Z",
        expiresAt: "2026-08-17T18:00:00.000Z",
      },
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T10:00:00.000Z"));
    const state = await release.getPublicExamState("e1");
    expect(state).toMatchObject({ found: true, status: "expired" });
  });

  it("gates as scheduled before publishAt", async () => {
    const { blob, release } = await freshRelease();
    await seedLiveExam(blob);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T07:00:00.000Z"));
    const state = await release.getPublicExamState("e1");
    expect(state).toMatchObject({
      found: true,
      status: "scheduled",
      cacheControl: "public, s-maxage=10, stale-while-revalidate=5",
    });
  });

  it("serves rooms when live", async () => {
    const { blob, release } = await freshRelease();
    await seedLiveExam(blob);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T10:00:00.000Z"));
    const state = await release.getPublicExamState("e1");
    expect(state).toMatchObject({
      found: true,
      status: "live",
      cacheControl: "public, s-maxage=30, stale-while-revalidate=30",
    });
    expect(state.found && state.rooms).toHaveLength(1);
  });

  it("expires after expiresAt", async () => {
    const { blob, release } = await freshRelease();
    await seedLiveExam(blob);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T19:00:00.000Z"));
    const state = await release.getPublicExamState("e1");
    expect(state).toMatchObject({ found: true, status: "expired" });
    expect(state.found && state.rooms).toBeUndefined();
  });

  it("expires immediately when cleared", async () => {
    const { blob, release } = await freshRelease();
    await seedLiveExam(blob, { cleared: true, rooms: [] });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T10:00:00.000Z"));
    const state = await release.getPublicExamState("e1");
    expect(state).toMatchObject({ found: true, status: "expired" });
  });
});
