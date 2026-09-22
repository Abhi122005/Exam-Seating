import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAdminPassword, getBackendSharedSecret, getCronSecret } from "./env";

describe("env utilities", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns ADMIN_PASSWORD when configured", () => {
    process.env.ADMIN_PASSWORD = "test-admin-password";
    expect(getAdminPassword()).toBe("test-admin-password");
  });

  it("throws when ADMIN_PASSWORD is missing", () => {
    delete process.env.ADMIN_PASSWORD;
    expect(() => getAdminPassword()).toThrowError(/ADMIN_PASSWORD is not set/);
  });

  it("returns BACKEND_SHARED_SECRET when configured", () => {
    process.env.BACKEND_SHARED_SECRET = "test-backend-secret";
    expect(getBackendSharedSecret()).toBe("test-backend-secret");
  });

  it("throws when BACKEND_SHARED_SECRET is missing", () => {
    delete process.env.BACKEND_SHARED_SECRET;
    expect(() => getBackendSharedSecret()).toThrowError(/BACKEND_SHARED_SECRET is not set/);
  });

  it("returns CRON_SECRET when configured", () => {
    process.env.CRON_SECRET = "test-cron-secret";
    expect(getCronSecret()).toBe("test-cron-secret");
  });

  it("throws when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;
    expect(() => getCronSecret()).toThrowError(/CRON_SECRET is not set/);
  });
});
