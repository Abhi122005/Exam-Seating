# 🏗️ System Architecture & Scalability Guide

This document provides a deep-dive technical explanation of the architecture, security model, and zero-cost scaling strategy used in the **KTU Exam Seating Portal**.

---

## 1. High-Level Architecture Overview

```
                                   STAFF PORTAL
                                        │
                       (1) Upload PDF + Schedule Release Time
                                        ▼
                        FastAPI PDF Parser (Render Free)
                                        │
                     (2) Parse PDF ➔ Extract Roll Ranges
                                        ▼
                      Next.js API & Private Vercel Blob
                                        │
                 (3) Compress + Gate: gzip payload, release module
                                        ▼
        ┌───────────────────────────────┬───────────────────────────────┐
        │ /exam/[examId]                │ /api/seating/[examId]         │
        │ (dynamic origin shell,       │ (server-side time gate +      │
        │  metadata only, no rooms)    │  full payload leg)            │
        └───────────────┬──────────────┴───────────────┬───────────────┘
                        ▼                              │
                 STUDENT PHONES                        ▼
              (browser fetches rooms          Edge Cache (s-maxage=30)
               from the cached leg)                 ▼
                                              STUDENT PHONES
                              (1000+ Concurrent Searches / <1ms)
```

---

## 2. Zero-Cost Concurrency Engineering

### Why Traditional Systems Fail Under Rush Traffic

- During exam morning rushes (9:50 AM – 10:00 AM), 1,000+ students hit the seating portal within a 5-minute window.
- Traditional SQL query architectures execute: `SELECT * FROM seating WHERE roll_no = '...'`.
- This leads to:
  - Connection pool exhaustion on free database tiers (Postgres/MySQL connection limit: 20-50).
  - Rate-limit shutdowns or HTTP 500 errors.
  - Unexpected server resource bill spikes.

### The Solution: Shell Page + CDN Edge Caching + Client Range Search

1. **Split delivery legs (the release gate holds on both):**
   - `/exam/[examId]` is a dynamic origin render of the _shell_ only — title, session, and the gated status banner. It never reads the seating payload, so it stays small and cheap.
   - `/api/seating/[examId]` is the _payload leg_: the same gate decides `scheduled` / `live` / `expired`, and only a `live` exam returns rooms.
2. **Edge CDN Caching (`Cache-Control: public, s-maxage=30`):**
   - The payload leg returns the compact gzip-friendly JSON.
   - Vercel's global CDN caches this HTTP response at edge locations worldwide for 30 seconds.
   - 99.9% of incoming student requests are served directly from CDN Edge Memory without triggering Next.js server execution.
3. **In-Browser Lexicographic Range Search (<1ms):**
   - The payload is compact: ranges + per-label singleton maps, gzipped at rest (typically a few KB over the wire).
   - Roll numbers are stored as ranges (`CS24C01` to `CS24C30`).
   - The student's phone filters the room location locally in JavaScript using string comparison (`regNo >= roll_from && regNo <= roll_to`).
4. **Automatic go-live:** a page left open in "scheduled" state polls the cached leg every 30 s and flips to the search form the moment the release goes live.

---

## 3. Dual-Mode Fallback Architecture

To ensure developers can test the application 100% locally without cloud accounts, every cloud service has an automatic fallback:

| Component       | Cloud Production Mode                | Local Development Fallback                     |
| --------------- | ------------------------------------ | ---------------------------------------------- |
| **Storage**     | Private Vercel Blob (`@vercel/blob`) | File System (`.local_data/`)                   |
| **PDF Parser**  | Python FastAPI on Render             | Node.js Built-in Mock Parser                   |
| **Cron Worker** | `cron-job.org` + `CRON_SECRET`       | Dev mode bypass (`NODE_ENV === 'development'`) |

---

## 4. Security & Data Gatekeeping

- **Private Blob Storage (`access: 'private'`):** Files stored in Vercel Blob cannot be accessed via direct public HTTP URLs. (Private, not encrypted.)
- **Gzip at rest:** every blob is stored gzipped with magic-byte detection on read, so legacy raw JSON keeps working.
- **Server Time Check:** the release module inspects the server clock against `publishAt`. Requests received before `publishAt` return `{ status: "scheduled" }` without reading seating data.
- **HMAC session cookie:** `/api/admin/login` issues a stateless HMAC-signed session token (never the master password itself) set as an HttpOnly, SameSite=Lax cookie. Protected procedures verify the signature in constant time.
- **Automated Data Lifecycle:** 5 hours after exam release, `/api/cron/cleanup` deletes expired exam blobs in a single storage op per exam, preventing long-term data clutter.

---

## 5. Module Map

| Module     | File                                 | Responsibility                                                                                         |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Release    | `apps/web/src/lib/exam-release.ts`   | Release gate + status/cache directives; `getPublicExamState` (payload) and `getPublicExamMeta` (shell) |
| Publish    | `apps/web/src/lib/exam-publish.ts`   | examId generation, parser adapter (mock fallback), compaction, storage writes                          |
| Storage    | `apps/web/src/lib/blob.ts`           | Gzip seam, Vercel Blob / `.local_data/` adapters                                                       |
| Compaction | `apps/web/src/lib/seating-format.ts` | `compactRooms` + `buildRollLookup`                                                                     |
| Session    | `apps/web/src/lib/admin-session.ts`  | HMAC token issue/verify, constant-time password check                                                  |
| Auth glue  | `apps/web/src/lib/auth.ts`           | Next.js `cookies()` access for route handlers and admin auth check                                     |

See `CONTEXT.md` for the domain glossary.

---

## 6. Handover: Fork & Redeploy

Repo owner: **sebin-gg**. If CEC maintainers cannot reach the owner, fork the
repo and redeploy instead of waiting: `apps/web` on Vercel, `services/parser`
on Render (or any host). All configuration is environment-variable based — no
secrets or database live in the repo — so a fork starts from `.env.example`,
sets its own tokens, and republishes PDFs (old exam blobs remain under the
original Vercel account). The zero-cost guarantee, dual-mode fallbacks, and
`CI_ADMINS` admin bypass all transfer unchanged. See
`docs/adr/0001-fork-and-redeploy-handover.md` for rationale.
