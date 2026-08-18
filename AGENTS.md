# AI Agent & Contributor Guidance (AGENTS.md)

This file contains guidelines, architectural rules, and project patterns for AI coding assistants (Antigravity, Claude, Copilot) and human developers working on this codebase.

---

## 🛠️ Package Manager & Workspace Rules

- **Default Package Manager:** Always use `pnpm` for JavaScript/TypeScript commands.
  - Workspace execution: `pnpm --filter web <command>`
  - Dependency additions: `pnpm --filter web add <pkg>`
  - Install command: `pnpm install` (use `pnpm install --no-frozen-lockfile` if modifying `package.json`).
- **Monorepo Layout:**
  - `apps/web`: Next.js 15 App Router + tRPC v11 + Tailwind CSS + TypeScript + `@vercel/blob`.
  - `services/parser`: Python 3.14 + FastAPI + `pdfplumber`.

---

## 🔒 Security & Architecture Directives

1. **Zero Database Cost Guarantee:**
   - DO NOT introduce a database (Postgres, Prisma, Supabase, Redis) to this project.
   - Authentication MUST remain master-password HTTP-only session cookie (`lib/auth.ts`).
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

# 2. Verify Python parser syntax
python -m py_compile services/parser/main.py services/parser/pdf_parser.py
```

## 🧰 DX Tooling

- **Pre-commit hooks** (Husky + lint-staged): auto-format + eslint-fix staged files, then full `typecheck` and `test`. Hooked in `.husky/pre-commit` — run `pnpm exec lint-staged` to test.
- **Formatting:** Prettier (`.prettierrc.json`). Run `pnpm format` to write, `pnpm format:check` to verify.
- **Linting:** ESLint flat config + `eslint-config-next` (`eslint.config.mjs`). Run `pnpm lint`.
- **Typecheck:** `pnpm typecheck` (tsc --noEmit). Note: `next.config.mjs` sets `ignoreBuildErrors`, so typecheck is NOT covered by the build.
- **Tests:** Vitest (`apps/web/src/**/*.test.ts`) covering the release gate, seating compaction, and the gzip storage seam. Run `pnpm test`.
- **Python parser locally:** `pnpm dev:parser` (uvicorn on :8000).
- Node version pinned in `.nvmrc` (24); editor defaults in `.editorconfig`.

---

## 📝 Commit Conventions

Use concise, conventional commits:

- `feat: ...` for new features
- `fix: ...` for bug fixes
- `docs: ...` for documentation
- `refactor: ...` for architectural improvements
