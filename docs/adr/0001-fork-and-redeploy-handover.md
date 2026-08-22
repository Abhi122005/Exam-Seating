# ADR-0001: Fork-and-Redeploy Handover for CEC Maintainers

- **Status:** Accepted (amended 2026-08-22 — owner migrated to Abhi122005, see ADR-0003)
- **Date:** 2026-08-19
- **Owner:** Abhi122005 (originally sebin-gg)

## Context

The exam seating portal serves College of Engineering Chengannur (CEC). The
repository owner (`Abhi122005`, originally `sebin-gg` — migrated 2026-08-22) is a single individual. A future CEC maintainer
(student or staff) may need to operate, fix, or deploy the system when the
owner is unreachable. Waiting for access blocks exam-day operations.

## Decision

When the owner is unreachable, CEC maintainers **fork this repository and
redeploy independently** instead of waiting for access:

1. Fork the repo (CEC org or personal account).
2. Deploy `apps/web` on Vercel (free tier); `services/parser` on Render or any
   Python host.
3. Set fresh environment secrets from `.env.example` — nothing sensitive is
   stored in the repo:
   - `ADMIN_PASSWORD`
   - `BLOB_READ_WRITE_TOKEN` (private Vercel Blob store)
   - `CRON_SECRET`
   - `PARSER_SERVICE_URL`
   - `BACKEND_SHARED_SECRET`
4. Set repo variable `CI_ADMINS` on the fork so admins keep the `[skip ci]`
   bypass in `.github/workflows/ci.yml`.
5. Republish exam PDFs on the fork — existing blobs stay under the original
   Vercel account.

## Consequences

- **Positive:** No single point of failure in ownership; exam operations can
  continue without owner access; zero-cost and dual-mode local fallbacks
  (`lib/blob.ts` → `.local_data/`, mock parser) work unchanged; MIT license
  permits free reuse.
- **Negative:** Blob data does not migrate between Vercel accounts — each fork
  starts empty and must republish PDFs. Forked deployments diverge from the
  original; changes should be pushed back upstream via PRs when possible.
