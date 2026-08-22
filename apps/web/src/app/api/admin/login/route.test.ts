import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll } from "~/lib/rate-limit";

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

function makeRequest(password: string, headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ password }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAll();
  lastResponse = null;
});

describe("POST /api/admin/login — auth", () => {
  it("returns 401 for wrong password", async () => {
    await POST(makeRequest("wrong"));
    expect(lastResponse?.status).toBe(401);
    expect(lastResponse?.body).toMatchObject({ success: false, message: "Invalid admin password" });
  });

  it("returns 200 and sets session cookie for correct password", async () => {
    await POST(makeRequest("CEC2026"));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "admin_session",
      expect.stringMatching(/^.{20,}\..{20,}$/),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("session cookie value is a valid, non-expired token", async () => {
    const { verifySessionToken } = await import("~/lib/admin-session");
    await POST(makeRequest("CEC2026"));

    const token = mockCookieStore.set.mock.calls[0][1];
    expect(verifySessionToken(token)).toBe(true);

    const [payloadB64] = token.split(".");
    const payload = Buffer.from(payloadB64, "base64url");
    const ts = payload.readUInt32BE(0);
    const now = Math.floor(Date.now() / 1000);
    expect(now - ts).toBeLessThan(5);
  });

  it("rejects empty body", async () => {
    const req = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    await POST(req);
    expect(lastResponse?.status).toBe(401);
  });

  it("rejects missing password field", async () => {
    const req = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await POST(req);
    expect(lastResponse?.status).toBe(401);
  });
});

describe("POST /api/admin/login — rate limiting", () => {
  it("returns 429 after exceeding rate limit", async () => {
    const { recordFailure } = await import("~/lib/rate-limit");
    // Simulate MAX_FAILED failures for this IP via the shared module
    for (let i = 0; i < 100; i++) {
      recordFailure("unknown");
    }
    // Now the route handler should see the exhausted limit
    await POST(makeRequest("wrong"));
    expect(lastResponse?.status).toBe(429);
  });

  it("successful login clears rate limit for the IP", async () => {
    const { recordFailure, getCount } = await import("~/lib/rate-limit");
    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      recordFailure("unknown");
    }
    expect(getCount("unknown")).toBe(100);

    // Successful login resets
    await POST(makeRequest("CEC2026"));
    expect(getCount("unknown")).toBe(0);

    // Can fail again without 429
    await POST(makeRequest("wrong"));
    expect(lastResponse?.status).toBe(401);
  });
});
