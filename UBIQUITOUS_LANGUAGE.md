# Ubiquitous Language

## Exam Lifecycle

| Term               | Definition                                                                   | Aliases to avoid     |
| ------------------ | ---------------------------------------------------------------------------- | -------------------- |
| **Exam**           | A single seating release slot with title, session, date, and release window  | Test, paper          |
| **ExamId**         | Stable identifier: `<examDate>-<session>-<4 hex>`; generated at publish time | ID, identifier       |
| **Session**        | Morning (FN) or Evening (AN) exam slot                                       | Slot, time           |
| **Release Window** | The `[publishAt, expiresAt]` interval during which an exam is live           | Window, period       |
| **Release Gate**   | Time-based rule controlling whether seating data is served                   | Gatekeeper, guard    |
| **Compaction**     | Publish-time transform packing singletons into comma-joined rolls            | Compression, packing |

## Seating Data

| Term                | Definition                                                                         | Aliases to avoid       |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| **Seating Payload** | Room allocation data: list of rooms with roll ranges and compacted singleton rolls | Allocation, assignment |
| **Roll Range**      | Contiguous roll-number interval (`roll_from` → `roll_to`) assigned to a room       | Range, interval        |
| **Singleton Roll**  | Range where `roll_from == roll_to`; compacted out of ranges into rolls             | Single, individual     |
| **Manifest**        | Ordered list of exam metadata entries; one gzipped JSON blob, newest first         | Index, catalog         |

## Authentication

| Term                | Definition                                                                                                                              | Aliases to avoid   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Session Cookie**  | Two-part token (`payload.signature`): uint32 timestamp + 16-byte nonce, HMAC-signed. Verified by signature + 24h expiry                 | Token, auth cookie |
| **Rate Limiter**    | In-memory per-IP counter of failed login attempts (100 per 15min window). Successful login clears the counter. Never blocks a real user | Throttle, limiter  |
| **Master Password** | Single shared admin password checked via timing-safe comparison                                                                         | Secret, credential |

## Storage

| Term             | Definition                                                                                                        | Aliases to avoid         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Storage Seam** | `lib/blob.ts` — gzipped JSON behind read/write/delete adapters; Vercel Blob in production, `.local_data/` locally | Blob storage, file store |
| **Edge Cache**   | CDN cache on `/api/seating/[examId]` (`s-maxage=30`)                                                              | CDN, cache               |

## Architecture

| Term                | Definition                                                                               | Aliases to avoid    |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| **Deep Module**     | Module with small interface hiding substantial implementation; high leverage for callers | Service, component  |
| **Entry Point**     | A root-level `.ts` file in `src/lib/` that is the public surface of a module             | Index, barrel       |
| **Module Boundary** | Enforced rule: route handlers import only through entry points, never into subfolders    | Interface, contract |

## Relationships

- An **Exam** has one **Release Window** defined by **publishAt** and **expiresAt**
- The **Release Gate** reads the **Exam** and decides: scheduled, live, or expired
- **Compaction** transforms a **Seating Payload** at publish time; **decompaction** (client-side lookup) reverses it
- A **Session Cookie** is issued by the login endpoint and verified by every admin route
- The **Rate Limiter** counts failed attempts per IP; success clears the count
- **Module Boundaries** are enforced by dependency-cruiser; violated imports fail CI

## Example Dialogue

> **Dev:** "When a student hits the **Release Gate** before **publishAt**, what do they see?"

> **Domain expert:** "The **Release Gate** returns `status: scheduled` with `cacheControl: s-maxage=10`. The client polls every 10 seconds until the gate opens."

> **Dev:** "And after **expiresAt**?"

> **Domain expert:** "The gate returns `expired`. The **Cron Cleanup** will eventually delete the blob, but the **Manifest** entry stays — the page shows 'expired' from the manifest metadata."

> **Dev:** "What about the **Rate Limiter** on login? If an admin mistypes their password 50 times, are they locked out?"

> **Domain expert:** "No — the window is 100 attempts per 15 minutes, and it's per IP. Plus, a successful login clears the counter. We never block a real user."

## Flagged Ambiguities

- **"token" vs "cookie"** — the **Session Cookie** is an HMAC-signed _token_ stored in an HttpOnly _cookie_. Use "session cookie" for the cookie mechanism, "session token" for the cryptographic payload. Don't use "auth token" (implies JWT/Bearer).
- **"rate limit" vs "throttle"** — use **Rate Limiter** for the per-IP failed-attempt counter. "Throttle" implies request-frequency limiting, which this is not.
- **"cleanup" vs "deletion"** — the **Cron Cleanup** _deletes_ exam blobs; it does not mark them. The old "cleared" flag is legacy. Say "expired" for the student-facing status, "pruned" for the server-side action.
