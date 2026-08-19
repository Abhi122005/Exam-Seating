# CONTEXT.md — Domain Glossary

Canonical vocabulary for the CEC Exam Seating Portal. Use these terms in code, docs, issues, and reviews. This file exists so future reviews find seams by name.

## Domain terms

| Term                      | Canonical meaning                                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **exam**                  | A single seating release slot (title + session + date + release window). Identified by `examId`.                                                                                                                                    |
| **examId**                | Stable identifier: `<examDate>-<session slug>-<4 hex chars>` (e.g. `2026-08-18-morning-a3f9`). Uniqueness is generated at publish, not user-supplied.                                                                               |
| **session**               | Morning (FN) or Evening (AN) exam slot. Display name kept as-is (`Morning`/`Evening`); the examId slug lowercases it.                                                                                                               |
| **examDate**              | Calendar date of the exam, `YYYY-MM-DD`.                                                                                                                                                                                            |
| **publishAt**             | Timestamp when the release gate opens. Before this, students see "scheduled" and no rooms leave the server.                                                                                                                         |
| **expiresAt**             | Timestamp when the release gate closes (`publishAt` + 5 hours). After this, the exam reads as "expired".                                                                                                                            |
| **release gate**          | The time-based rule controlling whether seating data is served. Lives in `lib/exam-release.ts`; `/api/seating/[examId]` crosses it. Static pages are display-only and never gate data.                                              |
| **release window**        | The `[publishAt, expiresAt]` interval during which an exam is "live".                                                                                                                                                               |
| **seating payload**       | The room allocation data for an exam: a list of **rooms** with roll **ranges** and compacted singleton **rolls**.                                                                                                                   |
| **roll range**            | A contiguous roll-number interval (`roll_from` → `roll_to`, e.g. `CS24C01`–`CS24C30`) assigned to a room, optionally labelled (batch).                                                                                              |
| **singleton roll**        | A range where `roll_from == roll_to`. Compaction moves these out of `ranges` into `rolls` (keyed by label, comma-joined values) to shrink the payload.                                                                              |
| **manifest**              | Ordered list of exam metadata entries (`ExamManifestEntry`) — the index page and the release gate read it. One gzipped JSON blob, newest exam first.                                                                                |
| **compaction**            | The publish-time transform (`lib/seating-format.ts`) that packs singletons into `rolls` and leaves true ranges intact. Reverse concern is client-side lookup (`buildRollLookup`).                                                   |
| **cleared**               | Terminal state of an exam's data after the cron cleanup deletes its blob. The page then reads "expired" via the manifest entry. The `cleared` flag is legacy-only; new cleanups delete outright.                                    |
| **edge cache**            | The CDN cache on `/api/seating/[examId]` (`s-maxage=30`). The student page's shell is served fresh from the origin; the rooms payload comes from the edge.                                                                          |
| **release module**        | `lib/exam-release.ts` — `getPublicExamState` (full payload leg) and `getPublicExamMeta` (shell leg, no rooms read).                                                                                                                 |
| **publish module**        | `lib/exam-publish.ts` — `publishExam`, owns id generation, the parser adapter (mock fallback included), compaction, and both storage writes.                                                                                        |
| **storage seam**          | `lib/blob.ts` — gzipped JSON behind `read/write/delete` adapters; Vercel Blob in production, `.local_data/` locally.                                                                                                                |
| **client seating module** | `public/seating.js` — `findSeat`, `statusFor`, `runSeatingApp`, `esc`; the browser-side display companion to the release module. Server status is authoritative; the client only fetches, polls (10s while scheduled), and renders. |
| **session cookie**        | `admin_session` — an HMAC-signed session token (not the password), set server-side with HttpOnly + SameSite=Lax. Issued by `/api/admin/login`.                                                                                      |

## Ambiguity notes

- **"encrypted"** — never use for storage: blobs are `private`-access but not encrypted. Say "private".
- **"cleared" vs "expired"** — `expired` is the status a student sees (time passed or data gone); `cleared` is the legacy storage flag. After cleanup the blob is deleted, not marked.
- **"gatekeeper"** — the release gate is a module, not a single endpoint; only the API route crosses it. The index badge and exam page render `statusFor`/server status for display; the client never recomputes the gate.

## Seams worth keeping

- Every storage write/read crosses `lib/blob.ts` — keep new adapters behind it.
- Every public status decision crosses `lib/exam-release.ts` — keep the gate out of route handlers and components.
- Student-page roll lookup and status display cross `public/seating.js` — keep `findSeat`/`statusFor`/`runSeatingApp` out of inline page scripts; it is tested via `public/seating.test.ts` (conformance against `buildRollLookup`).
- Admin mutations stay behind `protectedAdminProcedure` or the admin auth check; never re-implement the password check in a route.
