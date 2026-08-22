import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExamData, ExamManifestEntry } from "~/lib/blob";

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "cleanup-test-"));
  process.chdir(tmpDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  vi.resetModules();
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

async function freshModules() {
  const blob = await import("~/lib/blob");
  const cleanup = await import("~/lib/exam-cleanup");
  return { blob, cleanup };
}

function entry(examId: string, expiresAt: string): ExamManifestEntry {
  return {
    examId,
    title: `Exam ${examId}`,
    session: "Morning",
    examDate: "2026-08-18",
    publishAt: "2026-08-18T08:00:00Z",
    expiresAt,
  };
}

function exam(examId: string, expiresAt: string): ExamData {
  return { ...entry(examId, expiresAt), rooms: [{ room_no: "301", ranges: [] }] };
}

describe("exam cleanup module", () => {
  it("prunes expired exams from blob and manifest together", async () => {
    const { blob, cleanup } = await freshModules();
    const expired = exam("old", "2026-08-18T10:00:00Z");
    const live = exam("new", "2026-08-18T20:00:00Z");
    await blob.writeExamData(expired.examId, expired);
    await blob.writeExamData(live.examId, live);
    await blob.writeManifest([
      entry("old", "2026-08-18T10:00:00Z"),
      entry("new", "2026-08-18T20:00:00Z"),
    ]);

    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:00Z"));

    expect(removed).toBe(1);
    expect(await blob.readExamData("old")).toBeNull();
    expect(await blob.readExamData("new")).not.toBeNull();
    expect(await blob.readManifest()).toEqual([entry("new", "2026-08-18T20:00:00Z")]);
  });

  it("skips the manifest write when nothing expired", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeManifest([entry("new", "2026-08-18T20:00:00Z")]);
    const spy = vi.spyOn(blob, "writeManifest");

    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:00Z"));

    expect(removed).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("removes a single exam and its manifest entry", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeExamData("t1", exam("t1", "2026-08-18T20:00:00Z"));
    await blob.writeManifest([
      entry("t1", "2026-08-18T20:00:00Z"),
      entry("t2", "2026-08-18T20:00:00Z"),
    ]);

    const existed = await cleanup.removeExam("t1");

    expect(existed).toBe(true);
    expect(await blob.readExamData("t1")).toBeNull();
    expect(await blob.readManifest()).toEqual([entry("t2", "2026-08-18T20:00:00Z")]);
  });

  it("reports false and writes nothing for an unknown exam", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeManifest([entry("t1", "2026-08-18T20:00:00Z")]);
    const spy = vi.spyOn(blob, "writeManifest");

    const existed = await cleanup.removeExam("nope");

    expect(existed).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(await blob.readManifest()).toEqual([entry("t1", "2026-08-18T20:00:00Z")]);
  });
});

describe("pruneExpiredExams edge cases", () => {
  it("prunes all exams when every exam is expired", async () => {
    const { blob, cleanup } = await freshModules();
    const e1 = exam("a", "2026-08-18T10:00:00Z");
    const e2 = exam("b", "2026-08-18T11:00:00Z");
    await blob.writeExamData("a", e1);
    await blob.writeExamData("b", e2);
    await blob.writeManifest([
      entry("a", "2026-08-18T10:00:00Z"),
      entry("b", "2026-08-18T11:00:00Z"),
    ]);

    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:00Z"));

    expect(removed).toBe(2);
    expect(await blob.readExamData("a")).toBeNull();
    expect(await blob.readExamData("b")).toBeNull();
    expect(await blob.readManifest()).toEqual([]);
  });

  it("handles empty manifest", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeManifest([]);

    const { removed } = await cleanup.pruneExpiredExams();

    expect(removed).toBe(0);
  });

  it("does not prune an exam at the exact expiry boundary", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeExamData("edge", exam("edge", "2026-08-18T12:00:00Z"));
    await blob.writeManifest([entry("edge", "2026-08-18T12:00:00Z")]);

    // now === expiresAt → now > expiresAt is false → not expired
    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:00Z"));

    expect(removed).toBe(0);
    expect(await blob.readExamData("edge")).not.toBeNull();
  });

  it("prunes one second after expiry", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeExamData("edge", exam("edge", "2026-08-18T12:00:00Z"));
    await blob.writeManifest([entry("edge", "2026-08-18T12:00:00Z")]);

    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:01Z"));

    expect(removed).toBe(1);
    expect(await blob.readExamData("edge")).toBeNull();
  });

  it("prunes single expired exam when it is the only one", async () => {
    const { blob, cleanup } = await freshModules();
    await blob.writeExamData("only", exam("only", "2026-08-18T10:00:00Z"));
    await blob.writeManifest([entry("only", "2026-08-18T10:00:00Z")]);

    const { removed } = await cleanup.pruneExpiredExams(Date.parse("2026-08-18T12:00:00Z"));

    expect(removed).toBe(1);
    expect(await blob.readExamData("only")).toBeNull();
    expect(await blob.readManifest()).toEqual([]);
  });
});
