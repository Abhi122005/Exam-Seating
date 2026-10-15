/**
 * Web-layer PDF upload ceiling (the first gate, ahead of the parser).
 *
 * Seating PDFs are normally well under 1 MB, but letterhead logos / seals /
 * high-DPI exports inflate size. The real resource guard is the parser's
 * page-count cap; this bounds the serverless request body. Overridable via
 * MAX_UPLOAD_MB, but it never fails open.
 */

// Safe default when MAX_UPLOAD_MB is missing or invalid.
const DEFAULT_MAX_UPLOAD_MB = 15;
// Absolute ceiling so a typo'd/huge env value can never become unbounded.
const ABSOLUTE_MAX_UPLOAD_MB = 100;

/**
 * Resolve the upload cap (MB) from a raw MAX_UPLOAD_MB value. A missing,
 * blank, non-finite, or non-positive value falls back to the safe default
 * (never unlimited); an explicit value is clamped to the absolute ceiling.
 */
export function resolveMaxUploadMb(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_MAX_UPLOAD_MB;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_UPLOAD_MB;
  return Math.min(n, ABSOLUTE_MAX_UPLOAD_MB);
}
