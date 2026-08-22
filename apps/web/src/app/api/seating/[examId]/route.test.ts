import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExamData, ExamManifestEntry } from "~/lib/blob";

const ORIG_CWD = process.cwd();
let tmpDir: string;

let lastResponse: { status: number; body: unknown; headers?: Record<string, string> } | null = null;
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => {
      lastResponse = { status: init?.status ?? 200, body, headers: init?.headers };
      return lastResponse as any;
    },
  },
}));

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "seating-route-test-"));
  process.chdir(tmpDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  lastResponse = null;
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

function entry(examId: string, publishAt: string, expiresAt: string): ExamManifestEntry {
  return {
    examId,
    title: `Exam ${examId}`,
    session: "Morning",
    examDate: "2099-01-01",
    publishAt,
    expiresAt,
  };
}

function exam(examId: string, publishAt: string, expiresAt: string): ExamData {
  return {
    ...entry(examId, publishAt, expiresAt),
    rooms: [
      { room_no: "301", ranges: [{ roll_from: "CS24C01", roll_to: "CS24C10", label: "CS" }] },
    ],
  };
}

function makeParams(examId: string) {
  return { params: Promise.resolve({ examId }) } as any;
}

describe("GET /api/seating/[examId]", () => {
  it("returns 404 for unknown exam", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost"), makeParams("unknown"));
    expect(lastResponse?.status).toBe(404);
    expect(lastResponse?.body).toMatchObject({ error: "Exam not found" });
  });

  it("returns 404 with no-store cache for unknown exam", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost"), makeParams("unknown"));
    expect(lastResponse?.headers?.["Cache-Control"]).toBe("no-store");
  });

  it("returns scheduled status before publishAt", async () => {
    const blob = await import("~/lib/blob");
    // publishAt far in the future → currently scheduled
    await blob.writeExamData(
      "future",
      exam("future", "2099-12-31T00:00:00Z", "2099-12-31T23:59:59Z"),
    );
    await blob.writeManifest([entry("future", "2099-12-31T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(new Request("http://localhost"), makeParams("future"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "scheduled" });
    expect((lastResponse?.body as any).rooms).toBeUndefined();
  });

  it("returns live status with rooms inside release window", async () => {
    const blob = await import("~/lib/blob");
    // publishAt in past, expiresAt far in future → currently live
    await blob.writeExamData("live", exam("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z"));
    await blob.writeManifest([entry("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(new Request("http://localhost"), makeParams("live"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "live" });
    expect((lastResponse?.body as any).rooms).toBeDefined();
  });

  it("returns expired status after expiresAt", async () => {
    const blob = await import("~/lib/blob");
    // Both timestamps in the past → currently expired
    await blob.writeExamData("old", exam("old", "2020-01-01T00:00:00Z", "2020-01-01T12:00:00Z"));
    await blob.writeManifest([entry("old", "2020-01-01T00:00:00Z", "2020-01-01T12:00:00Z")]);

    const { GET } = await import("./route");
    await GET(new Request("http://localhost"), makeParams("old"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "expired" });
  });
});
