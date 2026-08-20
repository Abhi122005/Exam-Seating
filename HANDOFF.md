# HANDOFF — Exam Seating App (static HTML + API-only rewrite)

> For **Abhishek** (repo owner) or any maintainer.
> Last updated: 2026-08-20 by sebin-gg. Conversion + verification complete.

## What happened

React/Next.js Pages Router frontend fully replaced with **static HTML + API-only Next.js 15 App Router** app, mirroring iedc website architecture (sebin-gg/iedc-web-management-cell-task1):

- Every page = hand-rolled HTML/CSS/vanilla JS in `frontend/public/`, served by catch-all route. Zero client framework JS, no hydration.
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
| `/` | 2,852 B | 1.24 KB |
| `/exam?id=` | 4,342 B | 1.75 KB |
| `/admin/login` | 2,442 B | 1.21 KB |
| `/admin/schedule` | 5,155 B | 2.03 KB |
| `/admin/upload` | 4,987 B | 1.96 KB |

Shared assets: `site.css` = 16,441 B raw / 3.66 KB gzip; `seating.js` = 3,541 B raw / 1.21 KB gzip. Public pages load both; admin pages load `site.css` only. All HTML pages remain below the 14 KB raw budget.

## Recommended next tasks

All recommended tasks are complete. Inline and embedded page styles now live in `site.css`; page-size checks pass, public pages do not call admin APIs, and the existing pure `src/lib` boundaries remain unchanged.

## DX improvements

1. CI pipeline: `.github/workflows/ci.yml` runs frontend quality gates and backend Ruff.
2. Page-size guard: `pnpm page-size` enforces the 14 KB raw HTML budget.
3. Pre-commit hooks: Husky and lint-staged run ESLint/Prettier and Ruff.
4. Prettier and ESLint configs are committed; public HTML/JS stays excluded from formatting.
5. Package scripts, Node/pnpm metadata, `.nvmrc`, and `.editorconfig` are committed.
6. Ruff config and development requirements are committed for the parser.
7. `pnpm smoke` checks public routes, 404s, QR, unauthorized admin access, and login/session flow.
8. Admin and cleanup routes emit structured `{ route, status, ms }` logs.
9. GitHub issue and pull-request templates are committed.
10. Storage and release logic remains behind the existing testable `src/lib` seams.

## Conventions (keep)

- **NEVER format `public/**/*.html` with Prettier** — inflates files 40–60%, blows 14 KB budget.
- Keep pages < 14 KB raw. Check: `Get-ChildItem public -Recurse -File | Sort-Object Length`.
- Don't expand roll ranges into rows server-side — matching stays client-side lexicographic (`roll_from ≤ regNo ≤ roll_to`).
- No database. No client framework. `pnpm` only (lockfile committed).
- Tests beside code: `src/lib/*.test.ts` + `public/seating.test.ts` (conformance test ties client lookup to server lookup).
- `frontend/.local_data/` = runtime fallback storage — gitignored, never commit.
- Conventional commits (`feat:` / `fix:` / `refactor:` / `docs:`).

## Deploy notes

- Vercel: root directory `frontend`, env vars from `.env.example`. Blob store must be **private**.
- Render: `backend/` (uvicorn), `BACKEND_SHARED_SECRET` must match frontend.
- Cron: free external scheduler (cron-job.org) → `GET /api/cron/cleanup` with Bearer `CRON_SECRET`, every 15 min.
- CI is configured in `.github/workflows/ci.yml`.