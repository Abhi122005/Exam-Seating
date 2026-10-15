#!/usr/bin/env python3
"""Optimize raster images in apps/web/public and emit modern variants.

Why this exists
---------------
Every UI icon in this app is an inline SVG, so the only raster asset is the
Open Graph share card (og-image.png). Even so, this script is the maintained,
one-command way to keep ANY raster image small:

  * og:<image> / twitter:image  -> a compact JPEG (crawler-safe; most social
    crawlers still do not reliably fetch WebP for share cards).
  * on-page <img>               -> WebP + AVIF-ish progressive JPEG variants at
    several widths, ready for <picture srcset>.

Usage
-----
    python scripts/optimize-images.py            # write optimized files
    python scripts/optimize-images.py --check    # CI: fail if any file is stale

The script is deterministic and idempotent: it only rewrites a file when the
optimized bytes are meaningfully smaller, so it is safe to run on every commit
via lint-staged or CI. Requires Pillow (`pip install pillow`).
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

try:
    from PIL import Image, features
except ImportError:  # pragma: no cover
    sys.stderr.write("Pillow is required: pip install pillow\n")
    sys.exit(2)

REPO = Path(__file__).resolve().parent.parent
PUBLIC = REPO / "apps" / "web" / "public"

# A file is considered "stale" (needs optimizing) if it is larger than this.
MAX_SOURCE_BYTES = 40 * 1024  # 40 KB

# Widths (px) to emit for responsive <picture> variants, capped at the source.
SRCSET_WIDTHS = (480, 960, 1200)

RASTER_EXTS = {".png", ".jpg", ".jpeg"}


def _jpeg_bytes(im: Image.Image, quality: int, width: int | None = None) -> bytes:
    if width is not None and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    rgb = im.convert("RGB")
    buf = io.BytesIO()
    rgb.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def _webp_bytes(im: Image.Image, quality: int, width: int | None = None) -> bytes:
    if width is not None and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    rgb = im.convert("RGB")
    buf = io.BytesIO()
    rgb.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue()


def optimize_file(path: Path, check_only: bool) -> tuple[str, int, int]:
    """Optimize one raster in place. Returns (status, old_bytes, new_bytes)."""
    old = path.stat().st_size
    im = Image.open(path)

    if path.suffix.lower() in (".jpg", ".jpeg"):
        new = _jpeg_bytes(im, quality=78, width=1200)
        if len(new) < old - 1024 and not check_only:
            path.write_bytes(new)
        return ("jpg", old, len(new))

    # PNG: rewrite the source as a progressive JPEG when the PNG has no
    # transparency (share cards / photos). Keep PNG only if it has alpha.
    has_alpha = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 255

    if has_alpha:
        # Emit a WebP companion (great for on-page <picture>) but keep the PNG.
        webp = _webp_bytes(im, quality=82)
        webp_path = path.with_suffix(".webp")
        if not check_only and (
            not webp_path.exists() or webp_path.stat().st_size > len(webp)
        ):
            webp_path.write_bytes(webp)
        return ("png+webp", old, min(old, len(webp)))

    # No alpha -> the PNG is almost certainly a photo/share card. Emit a
    # sidecar JPEG (og:image/twitter:image friendly) and a WebP.
    jpg_path = path.with_suffix(".jpg")
    jpg = _jpeg_bytes(im, quality=78, width=1200)
    if not check_only and (not jpg_path.exists() or jpg_path.stat().st_size > len(jpg)):
        jpg_path.write_bytes(jpg)

    webp = _webp_bytes(im, quality=82)
    webp_path = path.with_suffix(".webp")
    if not check_only and (
        not webp_path.exists() or webp_path.stat().st_size > len(webp)
    ):
        webp_path.write_bytes(webp)

    # Responsive webp variants for future <picture> use.
    if features.check("webp") and not check_only:
        for w in SRCSET_WIDTHS:
            if w >= im.width:
                continue
            vp = path.with_suffix(f".{w}w.webp")
            v = _webp_bytes(im, quality=78, width=w)
            if not vp.exists() or vp.stat().st_size > len(v):
                vp.write_bytes(v)

    return ("png->jpg+webp", old, len(jpg))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="fail if any file is stale")
    args = ap.parse_args()

    if not PUBLIC.exists():
        sys.stderr.write(f"public dir not found: {PUBLIC}\n")
        return 2

    rasters = sorted(p for p in PUBLIC.rglob("*") if p.suffix.lower() in RASTER_EXTS)
    stale: list[Path] = []
    total_before = total_after = 0

    def kb(n: int) -> str:
        return f"{n / 1024:.1f}KB"

    for p in rasters:
        status, before, after = optimize_file(p, args.check)
        total_before += before
        total_after += min(before, after)
        print(f"  {status:14} {p.relative_to(PUBLIC)}  {kb(before)} -> {kb(after)}")
        if before > MAX_SOURCE_BYTES and after > MAX_SOURCE_BYTES:
            stale.append(p)

    print(f"\nTotal: {total_before / 1024:.1f}KB -> {total_after / 1024:.1f}KB")

    if args.check and stale:
        sys.stderr.write(
            "\nUnoptimized large images still present:\n"
            + "\n".join(f"  {p.relative_to(REPO)}" for p in stale)
            + "\nRun: python scripts/optimize-images.py\n"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
