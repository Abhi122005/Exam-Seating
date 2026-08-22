import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const mockCookieStore = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(undefined),
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

let lastResponse: { status: number; body: unknown } | null = null;
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => {
      lastResponse = { status: init?.status ?? 200, body };
      return lastResponse as any;
    },
  },
}));

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(async () => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "delete-route-test-"));
  process.chdir(tmpDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  mockCookieStore.get.mockReturnValue(undefined);
  lastResponse = null;
});

afterEach(() => {
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeParams(examId: string) {
  return { params: Promise.resolve({ examId }) } as any;
}

describe("POST /api/admin/exams/[examId]/delete", () => {
  it("returns 401 without valid session", async () => {
    const { POST } = await import("./route");
    await POST(new Request("http://localhost", { method: "POST" }), makeParams("exam1"));
    expect(lastResponse?.status).toBe(401);
  });

  it("deletes exam with valid session", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    const blob = await import("~/lib/blob");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });

    await blob.writeExamData("exam1", {
      examId: "exam1",
      title: "Test",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T08:00:00Z",
      expiresAt: "2026-08-18T20:00:00Z",
      rooms: [],
    });
    await blob.writeManifest([
      {
        examId: "exam1",
        title: "Test",
        session: "Morning",
        examDate: "2026-08-18",
        publishAt: "2026-08-18T08:00:00Z",
        expiresAt: "2026-08-18T20:00:00Z",
      },
    ]);

    const { POST } = await import("./route");
    await POST(new Request("http://localhost", { method: "POST" }), makeParams("exam1"));

    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
    expect(await blob.readExamData("exam1")).toBeNull();
    expect(await blob.readManifest()).toEqual([]);
  });

  it("returns success for non-existent exam (idempotent)", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });

    const { POST } = await import("./route");
    await POST(new Request("http://localhost", { method: "POST" }), makeParams("nope"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
  });
});
