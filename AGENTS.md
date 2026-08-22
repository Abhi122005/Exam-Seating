# AI Agent & Contributor Guidance (AGENTS.md)

This file contains guidelines, architectural rules, and project patterns for AI coding assistants (Antigravity, Claude, Copilot) and human developers working on this codebase.

---

## 🛠️ Package Manager & Workspace Rules

- **Default Package Manager:** Always use `pnpm` for JavaScript/TypeScript commands.
  - Version pinned in `packageManager` (`pnpm@11.21.0`) + `engines` (Node 24, pnpm 11) — enforced by Corepack and CI.
  - Workspace execution: `pnpm --filter web <command>`
  - Dependency additions: `pnpm --filter web add <pkg>`
  - Install command: `pnpm install` (use `pnpm install --no-frozen-lockfile` if modifying `package.json`).
- **Monorepo Layout:**
  - `apps/web`: Next.js 15 with **API routes only** (no React pages — zero client framework JS) + `@vercel/blob`. UI is hand-rolled static HTML/CSS/vanilla JS in `apps/web/public/` (one self-contained page per route, each <14 KB raw so it fits the first TCP window even uncompressed). Served via root + catch-all route handlers (`src/app/route.ts`, `src/app/[...slug]/route.ts`) with `force-static` + `generateStaticParams`. Plain `fetch` REST API routes — no tRPC, no React Query, no client data libraries.
  - `services/parser`: Python 3.14 + FastAPI + `pdfplumber`, linted with Ruff (`pyproject.toml`).
  - **IMPORTANT:** `apps/web/public/**/*.html` is in `.prettierignore` on purpose — Prettier inflates these files 40-60% and would blow the <14 KB budget. Never format them.

---

## 🔒 Security & Architecture Directives

1. **Zero Database Cost Guarantee:**
   - DO NOT introduce a database (Postgres, Prisma, Supabase, Redis) to this project.
   - Authentication MUST remain master-password HTTP-only session cookie (`lib/admin-session.ts`).
   - Seating data MUST remain stored in private Vercel Blobs or local filesystem fallback (`lib/blob.ts`).

2. **Dual-Mode Local Fallbacks:**
   - Every cloud service MUST maintain a working local fallback:
     - Storage: `lib/blob.ts` must fallback to `.local_data/` when `BLOB_READ_WRITE_TOKEN` is missing.
     - PDF Parser: `/api/admin/publish` must fallback to local mock parser if Python backend is offline.
     - Cron: `/api/cron/cleanup` must bypass `CRON_SECRET` check in `NODE_ENV === 'development'`.
   - Never break local zero-config development when modifying storage or API routes.

3. **Client-Side Lexicographic Matching:**
   - Seating searches MUST happen client-side using range comparisons (`regNo >= roll_from && regNo <= roll_to`).
   - DO NOT expand ranges into individual student rows in backend JSON responses.

---

## 🧪 Verification Commands

Before completing any task or committing changes, run:

```bash
# 1. Verify Next.js build compilation
$env:SFW_SHIM_ACTIVE="1"
pnpm --filter web build

# 2. Verify Python parser syntax + lint
python -m py_compile services/parser/main.py services/parser/pdf_parser.py
pnpm lint:python

# 3. Run the full gate (lint, typecheck, boundaries, test) before pushing
pnpm lint && pnpm typecheck && pnpm --filter web lint:boundaries && pnpm test
```

## 📦 Module Boundaries

`src/lib/` modules are deep modules — each `.ts` file is an entry point; subfolders (if added later) are private. Route handlers import only through entry points. Enforced by `pnpm lint:boundaries` (dependency-cruiser). See [src/lib/README.md](./apps/web/src/lib/README.md).

---

## 🧰 DX Tooling

- **CI (`.github/workflows/ci.yml`)**: runs lint, typecheck, test, web build, Ruff + Python syntax check, and PR title convention on every push to `main` and on PRs. Mirrors the local pre-commit gates.
  - **Admin bypass**: admins (usernames in the repo variable `CI_ADMINS`, comma-separated) can skip CI by including `[skip ci]` in the commit message or PR title. Non-admins cannot — an empty/missing `CI_ADMINS` means nobody can bypass. GitHub's native "allow admins to bypass required checks" branch-protection setting is the other escape hatch.
- **Pre-commit hooks** (Husky + lint-staged): auto-format + eslint-fix staged web files, Ruff fix+format staged `.py` files via `scripts/lint-staged-py.mjs`. Installed automatically by `pnpm install` (husky prepare); reinstall with `pnpm run prepare`. Fast by design — heavy gates (typecheck/test/build) live in CI only. Ruff missing on PATH? The Python hook warns and skips gracefully — install with `pip install -r services/parser/requirements-dev.txt` to enable. Hooked in `.husky/pre-commit` — run `pnpm exec lint-staged` to test.
- **Formatting:** Prettier (`.prettierrc.json`). Run `pnpm format` to write, `pnpm format:check` to verify. Python formatted with Ruff (`pnpm format:python`).
- **Linting:** ESLint flat config + `eslint-config-next` (`eslint.config.mjs`). Run `pnpm lint`. Python linted with Ruff (`pnpm lint:python`).
- **Typecheck:** `pnpm typecheck` (tsc --noEmit). The build type-checks the API/lib layer too (`next build`).
- **Tests:** Vitest (`apps/web/src/**/*.test.ts` and `apps/web/public/seating.test.ts`) covering the release gate, seating compaction, the gzip storage seam, the client seating module, and exam cleanup. Run `pnpm test`.
- **Python parser locally:** `pnpm dev:parser` (uvicorn on :8000); `pnpm dev:all` runs web + parser together. Ruff must be on PATH (e.g. parser venv activated with `requirements-dev.txt` installed) for `pnpm lint:python` and pre-commit.
- **Browser automation:** Always use Chrome or Chromium for any browser-based automation (Puppeteer, Playwright, Lighthouse, screenshot tools, etc.). Do NOT use Edge — Puppeteer + Edge has known bugs with headless mode and CDP compatibility. Prefer: `C:/Program Files/Google/Chrome/Application/chrome.exe` (Chrome) or system-installed `chromium`. Either works — pick whichever is installed. If neither found, install Chromium before proceeding.
- Node 24 + pnpm 11 pinned in `packageManager`/`engines` and `.nvmrc` (24); editor defaults in `.editorconfig`.

---

## 🔁 Handover (Owner Unreachable)

Repo owner is **Abhi122005**. If a CEC maintainer cannot reach the owner, **fork
this repository and redeploy** — do not wait for access:

- Fork → redeploy `apps/web` on Vercel, `services/parser` on Render (or any host).
- All config is env-var based; set fresh secrets (`ADMIN_PASSWORD`,
  `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `PARSER_SERVICE_URL`,
  `BACKEND_SHARED_SECRET`). Nothing sensitive lives in the repo.
- Set repo variable `CI_ADMINS` on the fork to keep the admin `[skip ci]` bypass.
- Old exam blobs stay under the original Vercel account — republish PDFs on the fork.
- Zero-database guarantee and `.local_data/` fallback work unchanged. MIT license permits reuse.
- See `docs/adr/0001-fork-and-redeploy-handover.md` for rationale.

## 📝 Commit Conventions

Use concise, conventional commits:

- `feat: ...` for new features
- `fix: ...` for bug fixes
- `docs: ...` for documentation
- `refactor: ...` for architectural improvements

PR titles MUST use the same prefixes — enforced by the CI `pr-title` check.
