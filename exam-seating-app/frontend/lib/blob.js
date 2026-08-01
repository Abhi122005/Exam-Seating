import { put, head, get, del } from "@vercel/blob";

const MANIFEST_PATH = "exam-seating/manifest.json";

// Every blob in this app is PRIVATE: it cannot be fetched by URL at all,
// by anyone, ever -- only server code running with this project's
// credentials (OIDC on Vercel) can read it via get()/head(). This is what
// actually enforces the release-time gate: even someone who somehow
// obtained the exact blob URL gets nothing, because private blobs require
// authentication on every read, not just "the URL is hard to guess".
const ACCESS = "private";

async function readPrivateJson(pathname) {
  const result = await get(pathname, { access: ACCESS });
  if (!result) return null;
  const res = new Response(result.stream);
  return res.json();
}

/** Reads the manifest (list of published exams). Returns [] if it doesn't exist yet. */
export async function readManifest() {
  try {
    return (await readPrivateJson(MANIFEST_PATH))?.exams || [];
  } catch {
    return []; // manifest hasn't been created yet
  }
}

export async function writeManifest(exams) {
  await put(MANIFEST_PATH, JSON.stringify({ exams }), {
    access: ACCESS,
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export function examBlobPath(examId) {
  return `exam-seating/exams/${examId}.json`;
}

export async function writeExamData(examId, data) {
  const blob = await put(examBlobPath(examId), JSON.stringify(data), {
    access: ACCESS,
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
  return blob.url; // note: this URL is NOT fetchable directly -- private
}

export async function readExamData(examId) {
  try {
    // useCache: false ensures we always see the very latest publish/postpone
    // write immediately, rather than a possibly-stale cached copy.
    const result = await get(examBlobPath(examId), { access: ACCESS, useCache: false });
    if (!result) return null;
    const res = new Response(result.stream);
    return res.json();
  } catch {
    return null;
  }
}

/** Actually removes the blob object from storage (not just clears its
 * contents) -- del() is free of charge on Vercel Blob regardless of plan. */
export async function deleteExamData(examId) {
  try {
    await del(examBlobPath(examId));
  } catch {
    // already gone, or never existed -- fine either way
  }
}
