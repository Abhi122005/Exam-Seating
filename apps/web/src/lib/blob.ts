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

function isVercelBlobAvailable(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
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
  if (isVercelBlobAvailable()) {
    try {
      const result = await get(pathname, { access: ACCESS, useCache: false });
      if (!result) return null;
      const res = new Response(result.stream);
      const buf = Buffer.from(await res.arrayBuffer());
      return parseJsonBuffer(buf) as T;
    } catch {
      // fallback to local read if Vercel Blob fails
      return readLocalJson<T>(pathname);
    }
  }
  return readLocalJson<T>(pathname);
}

async function writePrivateJson(pathname: string, data: unknown): Promise<void> {
  if (isVercelBlobAvailable()) {
    try {
      await put(pathname, serializeJson(data), {
        access: ACCESS,
        addRandomSuffix: false,
        contentType: "application/gzip",
        allowOverwrite: true,
      });
      return;
    } catch {
      // fallback to local write
    }
  }
  await writeLocalJson(pathname, data);
}

export async function readManifest(): Promise<ExamManifestEntry[]> {
  try {
    const data = await readPrivateJson<{ exams: ExamManifestEntry[] }>(MANIFEST_PATH);
    return data?.exams || [];
  } catch {
    return [];
  }
}

export async function writeManifest(exams: ExamManifestEntry[]): Promise<void> {
  await writePrivateJson(MANIFEST_PATH, { exams });
}

export function examBlobPath(examId: string): string {
  return `exam-seating/exams/${examId}.json`;
}

export async function writeExamData(examId: string, data: ExamData): Promise<string> {
  const relPath = examBlobPath(examId);
  if (isVercelBlobAvailable()) {
    try {
      const blob = await put(relPath, serializeJson(data), {
        access: ACCESS,
        addRandomSuffix: false,
        contentType: "application/gzip",
        allowOverwrite: true,
      });
      return blob.url;
    } catch {
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
  if (isVercelBlobAvailable()) {
    try {
      await del(relPath);
    } catch {
      // ignore
    }
  }
  await deleteLocalFile(relPath);
}