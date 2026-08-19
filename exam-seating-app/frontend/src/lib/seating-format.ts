import type { ParsedRange, ParsedRoom } from "~/lib/blob";

export interface RollHit {
  roomNo: string;
  label: string;
}

export function compactRooms(rooms: ParsedRoom[]): ParsedRoom[] {
  return rooms.map((room) => {
    const ranges: ParsedRange[] = [];
    const rolls: Record<string, string> = {};
    for (const range of room.ranges) {
      if (range.roll_from === range.roll_to) {
        const label = range.label ?? "";
        rolls[label] = rolls[label] ? `${rolls[label]},${range.roll_from}` : range.roll_from;
      } else {
        ranges.push(range);
      }
    }
    const compacted: ParsedRoom = { room_no: room.room_no, ranges };
    if (Object.keys(rolls).length > 0) {
      compacted.rolls = rolls;
    }
    return compacted;
  });
}

export function buildRollLookup(rooms: ParsedRoom[]): Map<string, RollHit> {
  const lookup = new Map<string, RollHit>();
  for (const room of rooms) {
    for (const [label, list] of Object.entries(room.rolls ?? {})) {
      for (const roll of list.split(",")) {
        lookup.set(roll.toUpperCase(), { roomNo: room.room_no, label: label || "General Batch" });
      }
    }
  }
  return lookup;
}