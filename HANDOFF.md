# HANDOFF — Exam Seating App (static HTML + API-only rewrite)

> For **Abhishek** (repo owner) or any maintainer picking this up.
> Last updated: 2026-08-20 by sebin-gg (conversion + verification complete).

## What happened

The React/Next.js Pages Router frontend was fully replaced with a **static HTML + API-only Next.js 15 App Router** app, mirroring the iedc website architecture (sebin-gg/iedc-web-management-cell-task1):

- Every page is hand-rolled HTML/CSS/vanilla JS in `frontend/public/`, served by a catch-all route — **zero client framework JS**, no hydration.
- All backend work moved to `frontend/src/app/api/*` route handlers.
- All features preserved: scheduled release gate, postpone, QR codes, countdown, clipboard copy, dark glassmorphism, logout, auto-cleanup.
- Storage: gzip-compressed private Vercel Blob with `.local_data/` local fallback (zero-config local dev).
- Parser: FastAPI backend kept as-is; local mock parser fallback when offline.

**Verified end-to-end:** 54 vitest tests pass, `tsc --noEmit` clean, `pnpm build` OK, live smoke test of every API passed (login 401/200, publish+mock fallback, scheduled gate, postpone +5 h window, delete, cron cleanup, QR SVG, 404s, auth enforcement).

## How to run

```bash
cd exam-seating-app/frontend
pnpm install          # pnpm 11 (Node 24) — pnpm-workspace.yaml allows sharp build
pnpm dev              # works with zero env vars (local fallbacks)
pnpm test             # 54 tests
pnpm exec tsc --noEmit
pnpm build
```

Env vars (`frontend/.env.example`): `ADMIN_PASSWORD` (default `CEC2026`), `PARSER_SERVICE_URL`, `BACKEND_SHARED_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.

## Routes

| URL | Purpose |
|---|---|
| `/` | Public exam list |
| `/exam?id=<examId>` | Student lookup — countdown, roll search, copy room |
| `/admin/login` | Master-password sign-in |
| `/admin/upload` | Upload PDF + set schedule → publish → QR |
| `/admin/schedule` | Dashboard: list, postpone, QR, remove |
| `/api/manifest`, `/api/seating/[examId]` | Public APIs (release-gated) |
| `/api/admin/*` | Auth-required (HMAC `admin_session` cookie, 24 h) |
| `/api/qr?text=` | SVG QR endpoint |
| `/api/cron/cleanup` | GET, `Authorization: Bearer $CRON_SECRET` |

## Per-page data usage (raw / gzip wire)

| Page | Total raw | Gzip |
|---|---|---|
| `/` | 13,671 B | 5.1 KB |
| `/exam?id=` | **17,693 B** ⚠️ | 6.5 KB |
| `/admin/login` | 9,145 B | 3.6 KB |
| `/admin/schedule` | 12,267 B | 4.6 KB |
| `/admin/upload` | 12,100 B | 4.5 KB |

Budget: page HTML < 14 KB (all pass); combined HTML+CSS+JS ~14.6 KB (exam page over).

## Recommended next tasks (do these)

1. **Trim `site.css` (6,374 B vs 3,755 B in iedc reference).** Every page pays this file, so it's the biggest lever — dedupe overlapping rules, drop unused ones. Should save ~1.5–2 KB/page and pull the exam page under the combined budget.
2. **Dedupe `/exam` inline `<style>` (≈2.5 KB)** — it restates shared classes already in `site.css`; keep only true deltas (~1 KB saving).
3. Optional micro-wins: 3 inline SVG icons on landing page (~600 B); admin/login inlines its own `esc()` (60 B) — can import from `/seating.js`.

## Conventions (keep)

- **NEVER format `public/**/*.html` with Prettier** — it inflates files 40–60% and blows the 14 KB budget.
- Keep pages < 14 KB raw; check sizes with `Get-ChildItem public -Recurse -File | Sort-Object Length`.
- Don't expand roll ranges into rows server-side — matching stays client-side lexicographic (`roll_from ≤ regNo ≤ roll_to`).
- No database. No client framework. `pnpm` only (lockfile committed).
- Tests live beside code: `src/lib/*.test.ts` + `public/seating.test.ts` (conformance test ties client lookup to server lookup).
- `frontend/.local_data/` is runtime fallback storage — gitignored, never commit it.
- Pre-commit style: conventional commits (`feat:` / `fix:` / `refactor:` / `docs:`).

## Deploy notes

- Vercel: root directory `frontend`, env vars from `.env.example`. Blob store must be **private**.
- Render: `backend/` (uvicorn), `BACKEND_SHARED_SECRET` must match frontend.
- Cron: free external scheduler (cron-job.org) → `GET /api/cron/cleanup` with Bearer `CRON_SECRET`, every 15 min.
- CI not set up in this repo yet (iedc repo has `.github/workflows/ci.yml` — lift it if desired).