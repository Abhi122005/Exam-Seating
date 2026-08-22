import { NextResponse } from "next/server";
import { readManifest } from "~/lib/blob";

export async function GET() {
  return NextResponse.json(await readManifest(), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
