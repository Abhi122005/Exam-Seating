import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRollLookup } from "~/lib/seating-format";
import type { ExamData, ParsedRoom } from "~/lib/blob";
import { esc, findSeat, runSeatingApp, statusFor } from "./seating.js";

const PAYLOAD: ExamData = {
  examId: "2026-08-18-morning-a3f9",
  title: "CS202 Exam",
  session: "Morning",
  publishAt: "2026-08-18T08:00:00Z",
  expiresAt: "2026-08-18T18:00:00Z",
  examDate: "2026-08-18",
  rooms: [
    {
      room_no: "301",
      ranges: [
        { roll_from: "CS24C01", roll_to: "CS24C10", count: 10, label: "CS-A" },
        { roll_from: "EC24B01", roll_to: "EC24B05", count: 5 },
      ],
      rolls: { "": "CS24C11,CS24C12" },
    },
    {
      room_no: "302",
      ranges: [{ roll_from: "ME24A01", roll_to: "ME24A40", count: 40, label: "ME" }],
      rolls: { CS203: "ME24A41,ME24A42" },
    },
  ],
};

const json = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("statusFor", () => {
  const entry = { publishAt: "2026-08-18T08:00:00Z", expiresAt: "2026-08-18T18:00:00Z" };

  it("is scheduled before publishAt", () => {
    expect(statusFor(entry, Date.parse("2026-08-18T07:59:59Z"))).toBe("scheduled");
  });

  it("is live inside the release window", () => {
    expect(statusFor(entry, Date.parse("2026-08-18T08:00:00Z"))).toBe("live");
    expect(statusFor(entry, Date.parse("2026-08-18T18:00:00Z"))).toBe("live");
  });

  it("is expired after expiresAt", () => {
    expect(statusFor(entry, Date.parse("2026-08-18T18:00:01Z"))).toBe("expired");
  });
});

describe("findSeat", () => {
  it("hits a singleton roll case-insensitively", () => {
    expect(findSeat(PAYLOAD, "cs24c11")).toEqual({ room_no: "301", label: "General Batch" });
    expect(findSeat(PAYLOAD, "ME24A42")).toEqual({ room_no: "302", label: "CS203" });
  });

  it("hits a roll range and reports the range bounds", () => {
    expect(findSeat(PAYLOAD, "CS24C05")).toEqual({
      room_no: "301",
      label: "CS-A",
      roll_from: "CS24C01",
      roll_to: "CS24C10",
    });
    expect(findSeat(PAYLOAD, "EC24B03")).toEqual({
      room_no: "301",
      label: "General Batch",
      roll_from: "EC24B01",
      roll_to: "EC24B05",
    });
  });

  it("prefers a singleton hit over a range that lexically contains it", () => {
    const payload: ParsedRoom[] = [
      { room_no: "301", ranges: [{ roll_from: "CS24C01", roll_to: "CS24C30" }] },
      { room_no: "302", ranges: [], rolls: { "": "CS24C15" } },
    ];
    expect(findSeat({ rooms: payload }, "CS24C15")).toEqual({
      room_no: "302",
      label: "General Batch",
    });
  });

  it("returns undefined for no match, blank input, and empty payloads", () => {
    expect(findSeat(PAYLOAD, "XX99X99")).toBeUndefined();
    expect(findSeat(PAYLOAD, "   ")).toBeUndefined();
    expect(findSeat({ rooms: [] }, "CS24C01")).toBeUndefined();
  });
});

describe("conformance with buildRollLookup", () => {
  it("agrees with the tested server-side lookup for every singleton roll", () => {
    const lookup = buildRollLookup(PAYLOAD.rooms);
    for (const room of PAYLOAD.rooms) {
      for (const [label, list] of Object.entries(room.rolls ?? {})) {
        for (const roll of list.split(",")) {
          const expected = lookup.get(roll.toUpperCase());
          expect(expected).toBeDefined();
          const hit = findSeat(PAYLOAD, roll.toLowerCase());
          expect(hit).toEqual({ room_no: expected!.roomNo, label: expected!.label });
        }
      }
    }
  });

  it("agrees on mixed-case and edge roll numbers", () => {
    const edge: ParsedRoom[] = [
      { room_no: "301", ranges: [{ roll_from: "CS24A01", roll_to: "CS24Z99" }] },
      { room_no: "302", ranges: [], rolls: { B1: "cs24a00,Cs24b01" } },
    ];
    const lookup = buildRollLookup(edge);
    for (const roll of ["cs24a00", "CS24B01", "cs24b01"]) {
      const expected = lookup.get(roll.toUpperCase());
      expect(expected).toBeDefined();
      const hit = findSeat({ rooms: edge }, roll);
      expect(hit).toEqual({ room_no: expected!.roomNo, label: expected!.label });
    }
  });
});

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    expect(esc(null)).toBe("");
    expect(esc("plain")).toBe("plain");
  });
});

describe("runSeatingApp", () => {
  const scheduled = {
    status: "scheduled",
    title: "CS202",
    session: "Morning",
    publishAt: "2026-08-18T08:00:00Z",
  };
  const live = { ...scheduled, status: "live", rooms: [{ room_no: "301", ranges: [] }] };
  const expired = { ...scheduled, status: "expired" };

  async function flush() {
    await vi.advanceTimersByTimeAsync(0);
  }

  it("polls every 10s while scheduled but only emits on change", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(scheduled));
    const onStatus = vi.fn();
    const onPayload = vi.fn();
    runSeatingApp({ examId: "e1", fetch: fetchFn, onStatus, onPayload });

    await flush();
    expect(fetchFn).toHaveBeenCalledWith("/api/seating/e1");
    expect(onStatus).toHaveBeenCalledWith("scheduled");
    expect(onPayload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onPayload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onPayload).toHaveBeenCalledTimes(1);
  });

  it("emits live once and stops polling", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json(scheduled))
      .mockResolvedValueOnce(json(live));
    const onStatus = vi.fn();
    const onPayload = vi.fn();
    runSeatingApp({ examId: "e1", fetch: fetchFn, onStatus, onPayload });

    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(onStatus).toHaveBeenLastCalledWith("live");
    expect(onPayload).toHaveBeenLastCalledWith(live);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("emits payload before status so pages can render with data", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(live));
    const calls: string[] = [];
    runSeatingApp({
      examId: "e1",
      fetch: fetchFn,
      onStatus: (s) => calls.push(`status:${s}`),
      onPayload: (d) => calls.push(`payload:${d.status}`),
    });
    await flush();
    expect(calls).toEqual(["payload:live", "status:live"]);
  });

  it("does not poll an expired exam", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(expired));
    const onStatus = vi.fn();
    runSeatingApp({ examId: "e1", fetch: fetchFn, onStatus });
    await flush();
    expect(onStatus).toHaveBeenCalledWith("expired");
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("treats non-ok responses and payload errors as terminal notfound", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "no" }, false))
      .mockResolvedValue(json({ error: "no" }));
    const onError = vi.fn();
    runSeatingApp({ examId: "e1", fetch: fetchFn, onError });
    await flush();
    expect(onError).toHaveBeenCalledWith("notfound");
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries after 30s on network failure, then emits", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("failed"))
      .mockResolvedValue(json(scheduled));
    const onError = vi.fn();
    const onStatus = vi.fn();
    runSeatingApp({ examId: "e1", fetch: fetchFn, onStatus, onError });

    await flush();
    expect(onError).toHaveBeenCalledWith("retry");
    expect(onStatus).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith("scheduled");
  });

  it("stop() cancels pending polls", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(scheduled));
    const app = runSeatingApp({
      examId: "e1",
      fetch: fetchFn,
      onStatus: vi.fn(),
      onPayload: vi.fn(),
      onError: vi.fn(),
    });
    await flush();
    app.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});