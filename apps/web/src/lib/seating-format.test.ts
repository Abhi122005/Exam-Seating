import { describe, expect, it } from "vitest";
import { buildRollLookup, compactRooms } from "~/lib/seating-format";
import type { ParsedRoom } from "~/lib/blob";

const sampleRooms: ParsedRoom[] = [
  {
    room_no: "301",
    ranges: [
      { roll_from: "CS24C01", roll_to: "CS24C10", label: "Year 2 · Batch C", count: 10 },
      { roll_from: "CS24C11", roll_to: "CS24C11", label: "CS203", count: 1 },
      { roll_from: "CS24C12", roll_to: "CS24C12", label: "CS203", count: 1 },
      { roll_from: "CS24C13", roll_to: "CS24C13", label: "EC201", count: 1 },
      { roll_from: "CS24C14", roll_to: "CS24C14", label: null, count: 1 },
    ],
  },
];

describe("compactRooms", () => {
  it("keeps hall-style ranges untouched", () => {
    const [room] = compactRooms(sampleRooms);
    expect(room!.ranges).toEqual([
      { roll_from: "CS24C01", roll_to: "CS24C10", label: "Year 2 · Batch C", count: 10 },
    ]);
  });

  it("groups singletons into per-label comma lists", () => {
    const [room] = compactRooms(sampleRooms);
    expect(room!.rolls).toEqual({
      CS203: "CS24C11,CS24C12",
      EC201: "CS24C13",
      "": "CS24C14",
    });
  });

  it("omits rolls key when no singletons exist", () => {
    const [room] = compactRooms([
      { room_no: "302", ranges: [{ roll_from: "A1", roll_to: "A9", count: 9 }] },
    ]);
    expect(room!.rolls).toBeUndefined();
  });
});

describe("buildRollLookup", () => {
  it("maps every compacted roll to its room and label", () => {
    const [room] = compactRooms(sampleRooms);
    const lookup = buildRollLookup([room!]);
    expect(lookup.get("CS24C11")).toEqual({ roomNo: "301", label: "CS203" });
    expect(lookup.get("CS24C13")).toEqual({ roomNo: "301", label: "EC201" });
  });

  it("matches case-insensitively when the caller uppercases", () => {
    const [room] = compactRooms(sampleRooms);
    const lookup = buildRollLookup([room!]);
    expect(lookup.get("cs24c12".toUpperCase())).toEqual({ roomNo: "301", label: "CS203" });
  });

  it("does not include range-covered rolls", () => {
    const [room] = compactRooms(sampleRooms);
    const lookup = buildRollLookup([room!]);
    expect(lookup.get("CS24C05")).toBeUndefined();
  });

  it("falls back to General Batch for unlabelled rolls", () => {
    const [room] = compactRooms(sampleRooms);
    const lookup = buildRollLookup([room!]);
    expect(lookup.get("CS24C14")).toEqual({ roomNo: "301", label: "General Batch" });
  });
});
