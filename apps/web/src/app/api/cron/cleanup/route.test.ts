import { beforeEach, describe, expect, it, vi } from "vitest";

let lastResponse: { status: number; body: unknown } | null = null;
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => {
      lastResponse = { status: init?.status ?? 200, body };
      return lastResponse as any;
    },
  },
}));

import { GET } from "./route";

beforeEach(() => {
  lastResponse = null;
  vi.unstubAllEnvs();
});

function makeRequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/cleanup", { headers });
}

describe("GET /api/cron/cleanup", () => {
  it("returns 401 without authorization in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await GET(makeRequest());
    expect(lastResponse?.status).toBe(401);
  });

  it("returns 200 with valid cron secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "test-secret");
    await GET(makeRequest({ authorization: "Bearer test-secret" }));
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
  });

  it("bypasses auth in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await GET(makeRequest());
    expect(lastResponse?.status).toBe(200);
    expect(lastResponse?.body).toMatchObject({ success: true });
  });

  it("reports removed count", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await GET(makeRequest());
    expect(lastResponse?.body).toMatchObject({
      success: true,
      message: expect.stringContaining("Cleaned up"),
    });
  });
});
