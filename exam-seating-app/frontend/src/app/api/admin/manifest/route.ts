import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "~/lib/auth";
import { readManifest } from "~/lib/blob";

export async function GET() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await readManifest());
}