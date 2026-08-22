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

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  lastResponse = null;
});

describe("GET /api/admin/manifest", () => {
  it("returns 401 without valid session", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    await GET();
    expect(lastResponse?.status).toBe(401);
  });

  it("returns 200 with valid session", async () => {
    const { issueSessionToken } = await import("~/lib/admin-session");
    mockCookieStore.get.mockReturnValue({ value: issueSessionToken() });
    await GET();
    expect(lastResponse?.status).toBe(200);
    expect(Array.isArray(lastResponse?.body)).toBe(true);
  });
});
