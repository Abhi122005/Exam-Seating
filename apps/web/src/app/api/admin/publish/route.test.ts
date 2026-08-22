import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { POST } from "./route";

function makePdfFile(name = "test.pdf"): File {
  const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  return new File([content], name, { type: "application/pdf" });
}

function makeRequest(file: File | null, extra?: Record<string, string>): Request {
  const fd = new FormData();
  if (file) fd.append("file", file);
  fd.append("title", "Test Exam");
  fd.append("session", "Morning");
  fd.append("examDate", "2026-08-18");
  fd.append("publishAt", "2026-08-18T08:00:00Z");
  return new Request("http://localhost/api/admin/publish", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  lastResponse = null;
});

describe("POST /api/admin/publish", () => {
  it("returns 401 without valid session", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await POST(makeRequest(makePdfFile()));
    expect(lastResponse?.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    await POST(makeRequest(null));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "PDF file is required" });
  });

  it("rejects non-PDF content type", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    const txt = new File(["hello"], "test.txt", { type: "text/plain" });
    await POST(makeRequest(txt));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "File must be a PDF" });
  });

  it("rejects file with wrong magic bytes", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    const fake = new File([new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00])], "fake.pdf", {
      type: "application/pdf",
    });
    await POST(makeRequest(fake));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "File is not a valid PDF" });
  });

  it("rejects files over 10 MB", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    });
    await POST(makeRequest(big));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "File too large (max 10 MB)" });
  });

  it("accepts valid PDF with correct magic bytes", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    // publishExam will call the parser adapter — mock it to return rooms
    const { publishExam } = await import("~/lib/exam-publish");
    vi.spyOn(await import("~/lib/exam-publish"), "publishExam").mockResolvedValue({
      examId: "2026-08-18-morning-test",
      warning: undefined,
    });
    await POST(makeRequest(makePdfFile()));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
  });
});
