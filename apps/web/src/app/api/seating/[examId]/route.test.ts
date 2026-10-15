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
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("NODE_ENV", "test");
  lastResponse = null;
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
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

function getReq(examId: string, roll?: string) {
  const url =
    roll === undefined
      ? `http://localhost/api/seating/${examId}`
      : `http://localhost/api/seating/${examId}?roll=${encodeURIComponent(roll)}`;
  return new Request(url);
}

describe("GET /api/seating/[examId] — single-student lookup", () => {
  it("returns 404 for unknown exam", async () => {
    const { GET } = await import("./route");
    await GET(getReq("unknown", "CS24C01"), makeParams("unknown"));
    expect(lastResponse?.status).toBe(404);
    expect(lastResponse?.body).toMatchObject({ error: "Exam not found" });
  });

  it("returns 404 with no-store cache for unknown exam", async () => {
    const { GET } = await import("./route");
    await GET(getReq("unknown", "CS24C01"), makeParams("unknown"));
    expect(lastResponse?.headers?.["Cache-Control"]).toContain("no-store");
  });

  it("rejects malformed exam ids with 400 before touching storage", async () => {
    const { GET } = await import("./route");
    await GET(getReq("../../etc/passwd", "CS24C01"), makeParams("../../etc/passwd"));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "Invalid exam id" });
  });

  it("requires a roll number and never returns the full seating plan", async () => {
    const blob = await import("~/lib/blob");
    await blob.writeExamData("live", exam("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z"));
    await blob.writeManifest([entry("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(getReq("live"), makeParams("live"));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "Valid roll number is required" });
  });

  it("returns only the matching seat for a live exam", async () => {
    const blob = await import("~/lib/blob");
    await blob.writeExamData("live", exam("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z"));
    await blob.writeManifest([entry("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(getReq("live", "CS24C05"), makeParams("live"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({
      status: "live",
      seat: { room_no: "301" },
    });
    // Privacy invariant: the whole allocation must never leave the server.
    expect(lastResponse?.body).not.toHaveProperty("rooms");
    expect(lastResponse?.headers?.["Cache-Control"]).toContain("no-store");
  });

  it("returns live with no seat for an unknown roll", async () => {
    const blob = await import("~/lib/blob");
    await blob.writeExamData("live", exam("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z"));
    await blob.writeManifest([entry("live", "2020-01-01T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(getReq("live", "ZZ99Z99"), makeParams("live"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "live" });
    expect((lastResponse?.body as any).seat).toBeUndefined();
  });

  it("returns scheduled status before publishAt without a seat", async () => {
    const blob = await import("~/lib/blob");
    // publishAt far in the future → currently scheduled
    await blob.writeExamData(
      "future",
      exam("future", "2099-12-31T00:00:00Z", "2099-12-31T23:59:59Z"),
    );
    await blob.writeManifest([entry("future", "2099-12-31T00:00:00Z", "2099-12-31T23:59:59Z")]);

    const { GET } = await import("./route");
    await GET(getReq("future", "CS24C01"), makeParams("future"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "scheduled" });
    expect((lastResponse?.body as any).seat).toBeUndefined();
  });

  it("returns expired status after expiresAt", async () => {
    const blob = await import("~/lib/blob");
    // Both timestamps in the past → currently expired
    await blob.writeExamData("old", exam("old", "2020-01-01T00:00:00Z", "2020-01-01T12:00:00Z"));
    await blob.writeManifest([entry("old", "2020-01-01T00:00:00Z", "2020-01-01T12:00:00Z")]);

    const { GET } = await import("./route");
    await GET(getReq("old", "CS24C01"), makeParams("old"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ status: "expired" });
  });
});
