# ADR-0002: Merge auth.ts into admin-session.ts

## Status

Accepted

## Context

`lib/auth.ts` was a thin re-export wrapper over `lib/admin-session.ts` plus two
Next.js-specific functions (`getAdminCookieOptions`, `isAdminAuthenticated`). The
two-file split existed to isolate the `next/headers` import from the pure crypto
module. However, the indirection added a layer without adding depth — callers
bounced between two files to understand the full auth seam.

## Decision

Merge `auth.ts` into `admin-session.ts`. All auth logic — HMAC signing, timestamp
expiry, password check, cookie options, and Next.js `cookies()` access — lives in
one module. Route handlers import directly from `~/lib/admin-session`.

## Consequences

- **Pro:** Single seam for all auth knowledge. No indirection layer. Callers import
  from one place.
- **Pro:** `admin-session.ts` becomes deeper (6 exports, substantial implementation).
- **Con:** The module now mixes pure crypto (testable, no deps) with a Next.js
  framework import (`cookies`). A change to HMAC logic touches a file that imports
  `next/headers`.
- **Mitigation:** The Next.js import is isolated to one async function
  (`isAdminAuthenticated`). The crypto functions remain pure and independently
  testable. If the framework coupling becomes a problem, the split can be reversed.

## Alternatives considered

- **Keep the split** — preserves isolation but adds indirection. The code review
  flagged this as a "shallow re-export" smell (Middle Man).
- **Extract a pure crypto module + Next.js adapter** — cleanest separation but
  three files for a small surface area. Over-engineered for this codebase size.
