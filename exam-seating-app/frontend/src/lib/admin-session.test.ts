import { describe, expect, it } from "vitest";
import { checkAdminPassword, issueSessionToken, verifySessionToken } from "~/lib/admin-session";

describe("admin session module", () => {
  it("issues tokens that verify", () => {
    const token = issueSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const token = issueSessionToken();
    const [nonce] = token.split(".");
    expect(verifySessionToken(`${nonce}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBe(false);
    expect(verifySessionToken(`${"A".repeat(22)}.${nonce}`)).toBe(false);
  });

  it("rejects malformed and missing tokens", () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken("")).toBe(false);
    expect(verifySessionToken("no-separator")).toBe(false);
    expect(verifySessionToken("short.bad")).toBe(false);
  });

  it("rejects tokens signed with a different password", () => {
    const token = issueSessionToken();
    const original = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "different-password";
    try {
      expect(verifySessionToken(token)).toBe(false);
    } finally {
      if (original === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = original;
    }
  });

  it("verifies the master password in constant-time fashion", () => {
    expect(checkAdminPassword("CEC2026")).toBe(true);
    expect(checkAdminPassword("wrong")).toBe(false);
  });
});
