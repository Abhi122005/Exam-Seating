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

  it("rejects files over the configured size limit", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    // Stub a small cap so the boundary is exercised cheaply (no huge buffer).
    vi.stubEnv("MAX_UPLOAD_MB", "1");
    const big = new File([new Uint8Array(1024 * 1024 + 1)], "big.pdf", {
      type: "application/pdf",
    });
    await POST(makeRequest(big));
    expect(lastResponse?.status).toBe(400);
    expect(lastResponse?.body).toMatchObject({ error: "File too large (max 1 MB)" });
    vi.unstubAllEnvs();
  });

  it("allows a file just under the configured limit", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    vi.stubEnv("MAX_UPLOAD_MB", "1");
    vi.spyOn(await import("~/lib/exam-publish"), "publishExam").mockResolvedValue({
      examId: "2026-08-18-morning-test",
      warning: undefined,
    });
    // Exactly 1 MB, starting with the %PDF- magic bytes so it clears both the
    // size gate and the route's own magic-byte check; publishExam is mocked to
    // succeed, so a 200 here proves the size gate let it through.
    const buf = new Uint8Array(1024 * 1024);
    buf.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0); // "%PDF-"
    const ok = new File([buf], "ok.pdf", { type: "application/pdf" });
    await POST(makeRequest(ok));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
    vi.unstubAllEnvs();
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
