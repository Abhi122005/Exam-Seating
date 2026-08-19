import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExamData } from "~/lib/blob";

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "blob-test-"));
  process.chdir(tmpDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

async function freshBlob() {
  return await import("~/lib/blob");
}

const exam: ExamData = {
  examId: "t1",
  title: "Test Exam",
  session: "Morning",
  examDate: "2026-08-18",
  publishAt: new Date("2026-08-18T08:00:00Z").toISOString(),
  expiresAt: new Date("2026-08-18T18:00:00Z").toISOString(),
  rooms: [
    {
      room_no: "301",
      ranges: [{ roll_from: "CS24C01", roll_to: "CS24C10", count: 10 }],
      rolls: { CS203: "CS24C11,CS24C12" },
    },
  ],
};

describe("blob storage seam", () => {
  it("stores gzip bytes and reads them back", async () => {
    const blob = await freshBlob();
    await blob.writeExamData(exam.examId, exam);
    const file = path.join(tmpDir, ".local_data", "exam-seating", "exams", "t1.json");
    const buf = await fs.readFile(file);
    expect(buf[0]).toBe(0x1f);
    expect(buf[1]).toBe(0x8b);
    const back = await blob.readExamData(exam.examId);
    expect(back).toEqual(exam);
  });

  it("still reads legacy uncompressed JSON", async () => {
    const blob = await freshBlob();
    const dir = path.join(tmpDir, ".local_data", "exam-seating", "exams");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "t1.json"), JSON.stringify(exam), "utf-8");
    const back = await blob.readExamData(exam.examId);
    expect(back).toEqual(exam);
  });

  it("round-trips the manifest gzipped", async () => {
    const blob = await freshBlob();
    const entry = {
      examId: exam.examId,
      title: exam.title,
      session: exam.session,
      examDate: exam.examDate,
      publishAt: exam.publishAt,
      expiresAt: exam.expiresAt,
    };
    await blob.writeManifest([entry]);
    expect(await blob.readManifest()).toEqual([entry]);
  });

  it("returns null for missing data", async () => {
    const blob = await freshBlob();
    expect(await blob.readExamData("nope")).toBeNull();
    expect(await blob.readManifest()).toEqual([]);
  });

  it("deletes stored blobs", async () => {
    const blob = await freshBlob();
    await blob.writeExamData(exam.examId, exam);
    await blob.deleteExamData(exam.examId);
    expect(await blob.readExamData(exam.examId)).toBeNull();
  });
});