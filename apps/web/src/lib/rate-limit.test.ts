import { afterEach, describe, expect, it } from "vitest";
import { clearAll, getCount, MAX_FAILED, recordFailure, resetKey, WINDOW_MS } from "./rate-limit";

afterEach(() => {
  clearAll();
});

describe("recordFailure", () => {
  it("allows the first attempt", () => {
    expect(recordFailure("ip1")).toBe(true);
    expect(getCount("ip1")).toBe(1);
  });

  it("increments count on repeated failures", () => {
    recordFailure("ip1");
    recordFailure("ip1");
    recordFailure("ip1");
    expect(getCount("ip1")).toBe(3);
  });

  it("allows up to MAX_FAILED attempts", () => {
    for (let i = 0; i < MAX_FAILED - 1; i++) {
      expect(recordFailure("ip1")).toBe(true);
    }
    expect(recordFailure("ip1")).toBe(true);
    expect(getCount("ip1")).toBe(MAX_FAILED);
  });

  it("blocks after MAX_FAILED attempts", () => {
    for (let i = 0; i < MAX_FAILED; i++) {
      recordFailure("ip1");
    }
    expect(recordFailure("ip1")).toBe(false);
    expect(getCount("ip1")).toBe(MAX_FAILED);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < MAX_FAILED; i++) {
      recordFailure("ip1");
    }
    expect(recordFailure("ip1")).toBe(false);
    expect(recordFailure("ip2")).toBe(true);
  });

  it("resets after WINDOW_MS expires", () => {
    const now = Date.now();
    recordFailure("ip1", now);
    recordFailure("ip1", now);
    expect(getCount("ip1")).toBe(2);

    // After window expires, count resets
    recordFailure("ip1", now + WINDOW_MS + 1);
    expect(getCount("ip1")).toBe(1);
  });

  it("resets count to 1 when window expires", () => {
    const now = Date.now();
    for (let i = 0; i < MAX_FAILED; i++) {
      recordFailure("ip1", now);
    }
    expect(recordFailure("ip1", now)).toBe(false);

    // After window, fresh start
    expect(recordFailure("ip1", now + WINDOW_MS + 1)).toBe(true);
    expect(getCount("ip1")).toBe(1);
  });
});

describe("resetKey", () => {
  it("clears the counter for a key", () => {
    recordFailure("ip1");
    recordFailure("ip1");
    expect(getCount("ip1")).toBe(2);

    resetKey("ip1");
    expect(getCount("ip1")).toBe(0);
  });

  it("allows fresh attempts after reset", () => {
    const now = Date.now();
    for (let i = 0; i < MAX_FAILED; i++) {
      recordFailure("ip1", now);
    }
    expect(recordFailure("ip1", now)).toBe(false);

    resetKey("ip1");
    expect(recordFailure("ip1", now)).toBe(true);
  });

  it("does not affect other keys", () => {
    recordFailure("ip1");
    recordFailure("ip2");
    resetKey("ip1");
    expect(getCount("ip1")).toBe(0);
    expect(getCount("ip2")).toBe(1);
  });
});
