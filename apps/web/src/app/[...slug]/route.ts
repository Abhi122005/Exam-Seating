import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const NOT_FOUND_HTML =
  "<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>404</title></head><body><h1>Page Not Found</h1><p><a href='/'>Go home</a></p></body></html>";

const KNOWN_ROUTES: string[][] = [
  ["exam"],
  ["admin", "login"],
  ["admin", "schedule"],
  ["admin", "upload"],
];

export async function generateStaticParams() {
  return KNOWN_ROUTES.map((slug) => ({ slug }));
}

async function getNotFoundHtml(): Promise<string> {
  try {
    return (await readFile(path.join(process.cwd(), "public", "404.html"))).toString();
  } catch {
    return NOT_FOUND_HTML;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const known = KNOWN_ROUTES.some(
    (k) => k.length === slug.length && k.every((s, i) => s === slug[i]),
  );
  if (!known || slug.some((s) => s.includes("..") || s.includes("\\"))) {
    const body = await getNotFoundHtml();
    return new NextResponse(body, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
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
    const body = await getNotFoundHtml();
    return new NextResponse(body, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
