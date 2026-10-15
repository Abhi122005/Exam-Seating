import { put, get, del } from "@vercel/blob";
import { gzipSync, gunzipSync } from "zlib";
import fs from "fs/promises";
import path from "path";

export interface ExamManifestEntry {
  examId: string;
  title: string;
  session: string;
  examDate: string;
  publishAt: string;
  expiresAt: string;
}

export interface ParsedRange {
  roll_from: string;
  roll_to: string;
  label?: string | null;
  count?: number | null;
}

export interface ParsedRoom {
  room_no: string;
  ranges: ParsedRange[];
  rolls?: Record<string, string>;
}

export interface ExamData extends ExamManifestEntry {
  rooms: ParsedRoom[];
  cleared?: boolean;
}

const MANIFEST_PATH = "exam-seating/manifest.json";
const ACCESS = "private" as const;

const LOCAL_DATA_DIR = path.join(process.cwd(), ".local_data");

const GZIP_MAGIC = [0x1f, 0x8b];

function serializeJson(data: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(data), "utf-8"));
}

function parseJsonBuffer(buf: Buffer): unknown {
  if (buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1]) {
    return JSON.parse(gunzipSync(buf).toString("utf-8"));
  }
  return JSON.parse(buf.toString("utf-8"));
}

async function ensureLocalDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // directory exists
  }
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isVercelBlobAvailable(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * In production, refusing to fall back to the ephemeral serverless filesystem
 * also means refusing to run without Blob storage configured at all. A missing
 * token in production is a misconfiguration, not a development convenience.
 */
function assertStorageConfigured(): void {
  if (isProduction() && !isVercelBlobAvailable()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not configured — refusing to use the ephemeral serverless filesystem in production",
    );
  }
}

/** True when an error means "blob does not exist" rather than "storage broke". */
function isBlobNotFound(err: unknown): boolean {
  return err instanceof Error && err.name === "BlobNotFoundError";
}

// --- Local File System Storage ---
async function readLocalJson<T>(relativePath: string): Promise<T | null> {
  try {
    const fullPath = path.join(LOCAL_DATA_DIR, relativePath);
    const buf = await fs.readFile(fullPath);
    return parseJsonBuffer(buf) as T;
  } catch {
    return null;
  }
}

async function writeLocalJson(relativePath: string, data: unknown): Promise<string> {
  const fullPath = path.join(LOCAL_DATA_DIR, relativePath);
  await ensureLocalDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, serializeJson(data));
  return `file://${fullPath}`;
}

async function deleteLocalFile(relativePath: string): Promise<void> {
  try {
    const fullPath = path.join(LOCAL_DATA_DIR, relativePath);
    await fs.unlink(fullPath);
  } catch {
    // file missing
  }
}

// --- Combined Storage Interface ---
async function readPrivateJson<T>(pathname: string): Promise<T | null> {
  assertStorageConfigured();
  if (isVercelBlobAvailable()) {
    try {
      const result = await get(pathname, { access: ACCESS, useCache: true });
      if (!result) return null;
      const res = new Response(result.stream);
      const buf = Buffer.from(await res.arrayBuffer());
      return parseJsonBuffer(buf) as T;
    } catch (err) {
      // "Blob does not exist" is a valid outcome (exam deleted / never
      // published) — never treat it as a storage failure.
      if (isBlobNotFound(err)) return null;
      // Production must fail closed: the Vercel serverless filesystem is
      // neither durable nor shared, so a silent local fallback can serve
      // missing/stale data as if the publish succeeded.
      if (isProduction()) throw err;
      // fallback to local read if Vercel Blob fails
      return readLocalJson<T>(pathname);
    }
  }
  return readLocalJson<T>(pathname);
}

async function writePrivateJson(pathname: string, data: unknown): Promise<void> {
  assertStorageConfigured();
  if (isVercelBlobAvailable()) {
    try {
      await put(pathname, serializeJson(data), {
        access: ACCESS,
        addRandomSuffix: false,
        contentType: "application/gzip",
        allowOverwrite: true,
      });
      return;
    } catch (err) {
      // Production must surface the failure instead of writing to ephemeral disk.
      if (isProduction()) throw err;
      // fallback to local write
    }
  }
  await writeLocalJson(pathname, data);
}

export async function readManifest(): Promise<ExamManifestEntry[]> {
  // Not-found maps to an empty manifest; storage failures must propagate
  // (readPrivateJson already fails closed in production) — swallowing them
  // here would let publish/cleanup overwrite a real manifest with [].
  const data = await readPrivateJson<{ exams: ExamManifestEntry[] }>(MANIFEST_PATH);
  return data?.exams || [];
}

export async function writeManifest(exams: ExamManifestEntry[]): Promise<void> {
  await writePrivateJson(MANIFEST_PATH, { exams });
}

/**
 * Atomic-ish manifest update for a zero-DB blob store: re-read the manifest
 * right before writing and merge by examId, with a bounded retry loop so two
 * concurrent publishes/deletes don't silently drop each other's entries.
 */
export async function updateManifest(
  mutate: (current: ExamManifestEntry[]) => ExamManifestEntry[],
  attempts = 3,
): Promise<ExamManifestEntry[]> {
  let last: ExamManifestEntry[] = [];
  for (let i = 0; i < attempts; i++) {
    const current = await readManifest();
    const next = mutate(current);
    // Last-writer merge: if the manifest changed under us, re-apply our
    // mutation on top of the freshest copy instead of overwriting it.
    last = next;
    try {
      await writeManifest(next);
      return next;
    } catch (err) {
      if (i === attempts - 1) throw err;
    }
    void last;
  }
  return last;
}

export function examBlobPath(examId: string): string {
  return `exam-seating/exams/${examId}.json`;
}

export async function writeExamData(examId: string, data: ExamData): Promise<string> {
  const relPath = examBlobPath(examId);
  assertStorageConfigured();
  if (isVercelBlobAvailable()) {
    try {
      const blob = await put(relPath, serializeJson(data), {
        access: ACCESS,
        addRandomSuffix: false,
        contentType: "application/gzip",
        allowOverwrite: true,
      });
      return blob.url;
    } catch (err) {
      if (isProduction()) throw err;
      // fallback to local write
    }
  }
  return writeLocalJson(relPath, data);
}

export async function readExamData(examId: string): Promise<ExamData | null> {
  return readPrivateJson<ExamData>(examBlobPath(examId));
}

export async function deleteExamData(examId: string): Promise<void> {
  const relPath = examBlobPath(examId);
  assertStorageConfigured();
  if (isVercelBlobAvailable()) {
    try {
      await del(relPath);
    } catch (err) {
      // Deletion must be visible: swallowing the error lets the API report
      // success while the underlying data remains.
      if (isProduction()) throw err;
      // ignore in dev/test
    }
  }
  await deleteLocalFile(relPath);
}
