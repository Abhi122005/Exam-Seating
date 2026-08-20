import { NextResponse } from "next/server";
import { qrSvg } from "~/lib/qr";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const text = url.searchParams.get("text") || "";
  if (!text || text.length > 512) {
    return NextResponse.json(
      { error: "text query param is required (max 512 chars)" },
      { status: 400 },
    );
  }

  const svg = qrSvg(text);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
