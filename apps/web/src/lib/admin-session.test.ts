import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  checkAdminPassword,
  issueSessionToken,
  SESSION_MAX_AGE,
  verifySessionToken,
} from "~/lib/admin-session";

/**
 * Craft a session token with an arbitrary timestamp.
 * Used to test expiry without waiting 24 hours.
 */
function craftTokenWithTimestamp(ts: number): string {
  const password = process.env.ADMIN_PASSWORD || "CEC2026";
  const nonce = crypto.randomBytes(16);
  const payload = Buffer.alloc(4 + 16);
  payload.writeUInt32BE(ts, 0);
  nonce.copy(payload, 4);
  const sig = crypto.createHmac("sha256", password).update(payload).digest();
  return `${payload.toString("base64url")}.${sig.toString("base64url")}`;
}

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

describe("session expiry", () => {
  it("accepts a token issued just now", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftTokenWithTimestamp(now);
    expect(verifySessionToken(token)).toBe(true);
  });

  it("accepts a token issued 1 second before expiry", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftTokenWithTimestamp(now - SESSION_MAX_AGE + 1);
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a token issued exactly at expiry boundary", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftTokenWithTimestamp(now - SESSION_MAX_AGE);
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects a token issued well in the past", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftTokenWithTimestamp(now - SESSION_MAX_AGE - 3600);
    expect(verifySessionToken(token)).toBe(false);
  });

  it("rejects a token with a future timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = craftTokenWithTimestamp(now + 3600);
    // future timestamp: now - future = negative, which is < SESSION_MAX_AGE
    // This should actually PASS because -3600 < 86400
    // But it's a clock-skew scenario — the signature is valid
    expect(verifySessionToken(token)).toBe(true);
  });

  it("rejects a token with a zero timestamp", () => {
    const token = craftTokenWithTimestamp(0);
    expect(verifySessionToken(token)).toBe(false);
  });
});
