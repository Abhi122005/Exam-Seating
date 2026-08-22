import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  lastResponse = null;
});

describe("GET /api/manifest", () => {
  it("returns an array", async () => {
    await GET();
    expect(Array.isArray(lastResponse?.body)).toBe(true);
  });

  it("returns 200", async () => {
    await GET();
    expect(lastResponse?.status).toBe(200);
  });

  it("sets cache-control header", async () => {
    await GET();
    expect(lastResponse?.headers?.["Cache-Control"]).toContain("s-maxage=30");
  });
});
