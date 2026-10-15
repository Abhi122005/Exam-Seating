import { NextResponse } from "next/server";
import { readManifest } from "~/lib/blob";

export async function GET() {
  return NextResponse.json(await readManifest(), {
    // Bounded staleness: after a delete/release the public list may be stale
    // for at most ~75s at the CDN edge (no purge on free tier).
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" },
  });
}
