import { describe, expect, it } from "vitest";
import { qrSvg } from "~/lib/qr";

describe("qr module", () => {
  it("generates an SVG with dark modules", () => {
    const svg = qrSvg("https://example.com/exam?id=123");
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain("<rect ");
    expect(svg).toContain("viewBox=");
  });

  it("produces distinct SVGs for different texts", () => {
    expect(qrSvg("https://example.com/a")).not.toBe(qrSvg("https://example.com/b"));
  });

  it("stays reasonably small for typical seating URLs", () => {
    const svg = qrSvg("https://example.com/exam?id=2026-08-18-morning-a3f9");
    expect(svg.length).toBeLessThan(50000);
  });
});
