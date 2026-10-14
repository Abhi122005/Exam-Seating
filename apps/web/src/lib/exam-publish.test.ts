import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ParsedRoom } from "~/lib/blob";
const rng = vi.hoisted(() => ({ counter: 0 }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes: (size: number) => {
      rng.counter++;
      const buf = Buffer.alloc(size);
      buf.writeUIntBE(rng.counter % 2 ** 24, buf.length - 3, 3);
      return buf;
    },
  };
});

const ORIG_CWD = process.cwd();
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "publish-test-"));
  process.chdir(tmpDir);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("NODE_ENV", "test");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.chdir(ORIG_CWD);
  rmSync(tmpDir, { recursive: true, force: true });
});

async function freshPublish() {
  const blob = await import("~/lib/blob");
  const publish = await import("~/lib/exam-publish");
  return { blob, publish };
}

const rooms: ParsedRoom[] = [
  {
    room_no: "301",
    ranges: [{ roll_from: "CS24C01", roll_to: "CS24C30", label: "Year 2", count: 30 }],
  },
  {
    room_no: "302",
    ranges: [
      { roll_from: "CS24C31", roll_to: "CS24C32", label: "Year 2", count: 2 },
      { roll_from: "CS24C33", roll_to: "CS24C33", label: "Year 2", count: 1 },
    ],
  },
];

function fakeParser(seating: { rooms: ParsedRoom[]; warning?: string }) {
  return vi.fn(async () => seating);
}

describe("exam publish module", () => {
  it("publishes an exam through an injected parser", async () => {
    const { blob, publish } = await freshPublish();
    const parser = fakeParser({ rooms, warning: "partial table" });

    const result = await publish.publishExam({
      file: new File([new Uint8Array(8)], "seating.pdf"),
      title: "KTU Exam",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T08:00:00.000Z",
      parseRooms: parser,
    });

    expect(parser).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ examId: expect.any(String), warning: "partial table" });
    expect(result.examId).toMatch(/^2026-08-18-morning-[0-9a-f]{6}$/);

    const stored = await blob.readExamData(result.examId);
    expect(stored).toMatchObject({
      examId: result.examId,
      title: "KTU Exam",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T08:00:00.000Z",
      expiresAt: "2026-08-18T13:00:00.000Z",
    });
    expect(stored?.rooms).toEqual([
      {
        room_no: "301",
        ranges: [{ roll_from: "CS24C01", roll_to: "CS24C30", label: "Year 2", count: 30 }],
      },
      {
        room_no: "302",
        ranges: [{ roll_from: "CS24C31", roll_to: "CS24C32", label: "Year 2", count: 2 }],
        rolls: { "Year 2": "CS24C33" },
      },
    ]);
  });

  it("prepends the new exam to the manifest", async () => {
    const { blob, publish } = await freshPublish();
    const parser = fakeParser({ rooms });

    const first = await publish.publishExam({
      file: new File([new Uint8Array(8)], "a.pdf"),
      title: "First",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T08:00:00.000Z",
      parseRooms: parser,
    });
    const second = await publish.publishExam({
      file: new File([new Uint8Array(8)], "b.pdf"),
      title: "Second",
      session: "Evening",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T14:00:00.000Z",
      parseRooms: parser,
    });

    const manifest = await blob.readManifest();
    expect(manifest.map((e) => e.examId)).toEqual([second.examId, first.examId]);
  });

  it("generates collision-resistant exam ids", async () => {
    const { publish } = await freshPublish();
    const ids = new Set();
    for (let i = 0; i < 200; i++) {
      ids.add(publish.generateExamId("2026-08-18", "Morning"));
    }
    expect(ids.size).toBe(200);
  });

  it("refuses to publish when the parser returns no rooms", async () => {
    const { blob, publish } = await freshPublish();
    const parser = fakeParser({ rooms: [] });
    await expect(
      publish.publishExam({
        file: new File([new Uint8Array(8)], "empty.pdf"),
        title: "KTU Exam",
        session: "Morning",
        examDate: "2026-08-18",
        publishAt: "2026-08-18T08:00:00.000Z",
        parseRooms: parser,
      }),
    ).rejects.toThrow(/no rooms/i);
    expect(await blob.readManifest()).toEqual([]);
  });

  it("rejects invalid publish input before touching the parser", async () => {
    const { publish } = await freshPublish();
    const parser = fakeParser({ rooms });
    const base = {
      file: new File([new Uint8Array(8)], "a.pdf"),
      title: "KTU Exam",
      session: "Morning",
      examDate: "2026-08-18",
      publishAt: "2026-08-18T08:00:00.000Z",
      parseRooms: parser,
    };
    await expect(publish.publishExam({ ...base, title: "  " })).rejects.toThrow(/title/i);
    await expect(publish.publishExam({ ...base, session: "Night" })).rejects.toThrow(/session/i);
    await expect(publish.publishExam({ ...base, examDate: "18-08-2026" })).rejects.toThrow(/date/i);
    await expect(publish.publishExam({ ...base, publishAt: "not-a-date" })).rejects.toThrow(
      /release/i,
    );
    expect(parser).not.toHaveBeenCalled();
  });

  it("fails closed when the parser service is unreachable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { publish } = await freshPublish();
    // No injected parser → parseRoomsWithService hits localhost:8000, which
    // refuses the connection in tests.
    await expect(
      publish.publishExam({
        file: new File([new Uint8Array(8)], "a.pdf"),
        title: "KTU Exam",
        session: "Morning",
        examDate: "2026-08-18",
        publishAt: "2026-08-18T08:00:00.000Z",
      }),
    ).rejects.toThrow(/parser service unavailable/i);
  });

  it("uses the zero-config mock fallback only outside production", async () => {
    const { publish } = await freshPublish();
    const seating = await publish.parseRoomsWithService(new File([new Uint8Array(8)], "a.pdf"));
    expect(seating.rooms.length).toBeGreaterThan(0);
    expect(seating.warning).toMatch(/development fallback/i);
  });
});
