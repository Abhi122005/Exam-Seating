import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";
export const dynamicParams = false;

const KNOWN_ROUTES: string[][] = [
  ["exam"],
  ["admin", "login"],
  ["admin", "schedule"],
  ["admin", "upload"],
];

export async function generateStaticParams() {
  return KNOWN_ROUTES.map((slug) => ({ slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const known = KNOWN_ROUTES.some(
    (k) => k.length === slug.length && k.every((s, i) => s === slug[i]),
  );
  if (!known || slug.some((s) => s.includes("..") || s.includes("\\"))) {
    return new NextResponse("Not Found", { status: 404 });
  }
  try {
    const file = await readFile(path.join(process.cwd(), "public", ...slug, "index.html"));
    return new NextResponse(file, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
