# CEC exam seating allocation portal

Exam seating lookup system built for the College of Engineering Chengannur (CEC) KTU examination cell. Students open the site, type their registration number, and instantly see their exam room. The system is designed for 1,000+ concurrent students during peak release windows while keeping monthly cost at zero.

The monorepo holds a Next.js 15 App Router web app (plain `fetch` REST API routes, TypeScript, Tailwind CSS) and a Python FastAPI service that parses KTU seating PDFs.

## Architecture and data flow

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

## Features

- **Instant client side search (<1ms):** in-browser lexicographic roll range matching for CEC students (`CS24C01` to `CS24C30`). Zero database hits during rush hours.
- **CDN edge cached payload:** the shell page renders instantly from the origin while the rooms payload is served by Vercel's edge cache (`s-maxage=30`); 99.9% of rush requests never execute server code.
- **Private blob release gate:** seating data stays private (`access: 'private'`) and gzip compressed at rest. Access is strictly gated by server side `publishAt` timestamps.
- **KTU PDF parser engine:** FastAPI service powered by `pdfplumber` for row reconstruction across complex multi column KTU seating layout tables.
- **Zero database staff auth:** HMAC signed HttpOnly session cookie (never the raw password) set server side by `/api/admin/login`.
- **Dual mode local fallbacks:** automatic fallback to local file storage (`.local_data/`) and a mock parser when running locally without cloud tokens.
- **Dark and light mode:** built in theme switcher powered by `next-themes` and Tailwind CSS.
- **Automated expired cleanup:** scheduled cron worker wipes seating data 5 hours after exam release.

## Tech stack

| Layer          | Technology                | Purpose                                                               |
| -------------- | ------------------------- | --------------------------------------------------------------------- |
| **Monorepo**   | `pnpm` workspaces         | Clean workspace management (`apps/web` + `services/parser`)           |
| **Frontend**   | Next.js 15 App Router     | React 19, Server Components & Route Handlers                          |
| **API Layer**  | Plain `fetch` REST routes | Route handlers + client side range matching; no client data libraries |
| **Styling**    | Tailwind CSS              | Responsive mobile first design with `next-themes`                     |
| **Storage**    | `@vercel/blob` (private)  | Private gzipped JSON seating data storage                             |
| **PDF parser** | Python 3.14 + FastAPI     | Multi column KTU PDF extraction with `pdfplumber`                     |

## Repository layout

```
exam-seating/
├── pnpm-workspace.yaml        # Workspace configuration (apps/*, services/*)
├── package.json               # Root monorepo scripts
├── AGENTS.md                  # Guidelines for AI agents & contributors
├── ARCHITECTURE.md            # Detailed architectural & scalability breakdown
├── CONTEXT.md                 # Domain glossary & seam map
├── apps/
│   └── web/                   # Next.js 15 App Router application
│       ├── .env.example       # Default environment variables (ADMIN_PASSWORD=CEC2026)
│       ├── vitest.config.ts   # Test runner configuration
│       ├── src/
│       │   ├── app/           # App Router pages & API handlers
│       │   ├── lib/           # Deep modules: blob, exam-release, exam-publish,
│       │   │                  # seating-format, admin-session (with local fallbacks)
│       │   └── components/    # StudentSearch & ThemeToggle components
│       └── postcss.config.mjs # Tailwind v4 PostCSS setup
└── services/
    └── parser/                # Python FastAPI PDF parser service
        ├── main.py            # FastAPI service endpoints
        ├── pdf_parser.py      # pdfplumber regex extraction engine
        ├── pyproject.toml     # Ruff lint/format config
        └── requirements.txt
```

## Quick start

Requirements: Node.js 24 (`engines` pin `>=24 <25`, mirrored in `.nvmrc`) and pnpm 11 (`>=11 <12`). Corepack supplies pnpm.

### 1. Local development without cloud tokens

```bash
# Clone the repository
git clone https://github.com/Abhi122005/Exam-Seating.git
cd Exam-Seating

# Install dependencies
# pnpm install also installs pre-commit hooks automatically (via husky)
pnpm install

# Start the local Next.js dev server
pnpm dev

# Or run web + parser together
pnpm dev:all
```

Open http://localhost:3000 to test student search, or http://localhost:3000/admin/login for the staff portal. Default master password: `CEC2026`.

When running locally without cloud tokens, the app automatically uses local file storage (`.local_data/`) and built-in fallback parser logic.

Pre-commit hooks install with `pnpm install`; no manual step needed. Staged files get Prettier formatting, ESLint fixes for `*.ts`/`*.tsx`, and Ruff lint plus format for `*.py`. If `ruff` is not installed the Python hook prints a warning and commits anyway; add it with `pip install -r services/parser/requirements-dev.txt`. Heavy gates (typecheck, test, build) run in CI rather than on commit. Reinstall hooks anytime with `pnpm run prepare`.

### 2. Optional local Python parser service

```bash
cd services/parser
python -m venv .venv
.venv\Scripts\activate          # Windows (source .venv/bin/activate elsewhere)
pip install -r requirements.txt

# Optional ruff for lint/format, used by pre-commit hooks and pnpm lint:python
pip install -r requirements-dev.txt

uvicorn main:app --reload --port 8000
```

From the repo root you can also start it with `pnpm dev:parser`.

## Production deployment (free tier)

### 1. Python parser on Render

1. Create a new web service on Render.
2. Root directory: `services/parser`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Environment variable: `BACKEND_SHARED_SECRET=change-me-secret`

### 2. Web app on Vercel

1. Deploy `apps/web` on Vercel.
2. Add a Vercel Blob store from the Storage tab (private access).
3. Set environment variables:
   - `ADMIN_PASSWORD` = `CEC2026`
   - `PARSER_SERVICE_URL` = `https://your-parser.onrender.com`
   - `BACKEND_SHARED_SECRET` = `change-me-secret`
   - `CRON_SECRET` = `change-me-cron-secret`
4. Important safety step: set Hard Spend Limit = **$0** in Vercel Spend Management.

## Handover: fork and redeploy if the owner is unreachable

This repo is maintained by Abhi122005. If CEC staff or students need to operate this system and cannot contact the repository owner, do not wait: fork and redeploy.

1. Fork this repository into the CEC org (or any account with access).
2. Redeploy web (`apps/web`) on Vercel, free tier. No code changes needed.
3. Redeploy parser (`services/parser`) on Render or any Python host.
4. Set your own secrets. Nothing sensitive is stored in the repo: `ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `PARSER_SERVICE_URL`, `BACKEND_SHARED_SECRET` (see `.env.example`).
5. Set the repo variable `CI_ADMINS` on the fork so admins keep the `[skip ci]` bypass (see AGENTS.md).
6. Republish PDFs. Existing exam blobs live under the original Vercel account and do not carry over; upload fresh PDFs on the new deployment.

No database or paid service is required. The zero cost guarantee and local fallbacks (`lib/blob.ts` falling back to `.local_data/`) keep working in the fork. The MIT license permits free institutional reuse.

## Verification and build

```bash
# Verify production Next.js compilation
pnpm --filter web build

# Verify Python parser syntax
python -m py_compile services/parser/main.py services/parser/pdf_parser.py

# Lint, typecheck, and test (CI runs these on every push and PR)
pnpm lint
pnpm lint:python
pnpm typecheck
pnpm test
pnpm format:check
pnpm format:check:python
```

Pre-commit hooks (Husky + lint-staged) auto-format and lint staged files. Full typecheck/test/build run in GitHub Actions (`.github/workflows/ci.yml`) so commits stay fast. PR titles must follow conventional commits (`feat:`, `fix:`, `chore:`) enforced by the CI pr-title check. Admins listed in the repo variable `CI_ADMINS` can skip CI with `[skip ci]` in the commit message or PR title.

## License

MIT license. Developed for College of Engineering Chengannur (CEC). Free for institutional use.
