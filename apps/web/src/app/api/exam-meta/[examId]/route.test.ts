import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

let lastResponse: { status: number; body: unknown; headers?: Record<string, string> } | null = null;
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      lastResponse = { status: init?.status ?? 200, body, headers: init?.headers };
      return lastResponse as any;
    },
  },
}));

import { GET } from "./route";

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "exam-meta-test-"));
  process.chdir(tmpDir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  lastResponse = null;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeParams(examId: string) {
  return { params: Promise.resolve({ examId }) } as any;
}

describe("GET /api/exam-meta/[examId]", () => {
  it("returns 404 for unknown exam", async () => {
    await GET(new Request("http://localhost"), makeParams("ghost"));
    expect(lastResponse?.status).toBe(404);
  });

  it("returns shell meta without rooms for a live exam", async () => {
    const blob = await import("~/lib/blob");
    await blob.writeExamData("e1", {
      examId: "e1",
      title: "KTU Exam",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2020-01-01T00:00:00Z",
      expiresAt: "2099-12-31T23:59:59Z",
      rooms: [{ room_no: "301", ranges: [] }],
    });
    await blob.writeManifest([
      {
        examId: "e1",
        title: "KTU Exam",
        session: "Morning",
        examDate: "2026-08-18",
        publishAt: "2020-01-01T00:00:00Z",
        expiresAt: "2099-12-31T23:59:59Z",
      },
    ]);

    const { GET: fresh } = await import("./route");
    await fresh(new Request("http://localhost"), makeParams("e1"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ examId: "e1", status: "live" });
    expect(lastResponse?.body).not.toHaveProperty("rooms");
    expect(lastResponse?.body).not.toHaveProperty("seat");
  });
});
