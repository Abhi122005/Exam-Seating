# 🎓 CEC Exam Seating Allocation Portal

### College of Engineering Chengannur (CEC) — KTU Examination Cell

> High-concurrency, zero-cost exam seating lookup system built for **College of Engineering Chengannur (CEC)** with **Next.js 15 App Router** (plain `fetch` REST API routes, TypeScript, Tailwind CSS) and a **Python FastAPI** PDF parser. Designed to handle **1,000+ concurrent students** with **$0 monthly cost** and **zero risk of unexpected charges**.

---

## 📸 Architecture & Data Flow

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

## ✨ Features

- **⚡ Instant Client-Side Search (<1ms):** Performs in-browser lexicographic roll range matching for CEC students (`CS24C01`–`CS24C30`). Zero database hits during rush hours.
- **🌍 CDN Edge-Cached Payload:** The shell page renders instantly from the origin while the rooms payload is served by Vercel's edge cache (`s-maxage=30`) — 99.9% of rush requests never execute server code.
- **🔒 Private Blob Release Gate:** Seating data is private (`access: 'private'`) and gzip-compressed at rest. Access is strictly gated by server-side `publishAt` timestamps.
- **📄 KTU PDF Parser Engine:** Python FastAPI service powered by `pdfplumber` for row reconstruction across complex multi-column KTU seating layout tables.
- **🔐 Zero-Database Staff Auth:** HMAC-signed HttpOnly session cookie (never the raw password) set server-side by `/api/admin/login`.
- **💻 Dual-Mode Local Fallbacks:** Automatic fallback to local file storage (`.local_data/`) and mock parser when running locally without cloud tokens.
- **🌓 Minimal Dark / Light Mode:** Built-in theme switcher powered by `next-themes` and Tailwind CSS.
- **🧹 Automated Expired Cleanup:** Scheduled cron worker automatically wipes seating data 5 hours after exam release.

---

## 🛠️ Tech Stack

| Layer          | Technology                | Purpose                                                               |
| -------------- | ------------------------- | --------------------------------------------------------------------- |
| **Monorepo**   | `pnpm` workspaces         | Clean workspace management (`apps/web` + `services/parser`)           |
| **Frontend**   | Next.js 15 App Router     | React 19, Server Components & Route Handlers                          |
| **API Layer**  | Plain `fetch` REST routes | Route handlers + client-side range matching; no client data libraries |
| **Styling**    | Tailwind CSS              | Responsive mobile-first design with `next-themes`                     |
| **Storage**    | `@vercel/blob` (Private)  | Private gzipped JSON seating data storage                             |
| **PDF Parser** | Python 3.14 + FastAPI     | Multi-column KTU PDF extraction with `pdfplumber`                     |

---

## 📁 Repository Layout

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

---

## 🚀 Quick Start

### 1. Local Zero-Config Development (No Cloud Tokens Needed)

```bash
# Clone the repository
git clone https://github.com/Abhi122005/Exam-Seating.git
cd Exam-Seating

# Install dependencies
# pnpm install also installs the pre-commit hooks automatically (via husky)
pnpm install

# Start local Next.js development server
pnpm dev

# Or run web + parser together
pnpm dev:all
```

Open `http://localhost:3000` to test Student Search, or `http://localhost:3000/admin/login` for Staff Portal (Default Master Password: `CEC2026`).

> **Note:** When running locally without cloud tokens, the app automatically uses local file system storage (`.local_data/`) and built-in fallback parser logic.

#### Pre-commit hooks (all platforms)

Hooks install automatically with `pnpm install` (no manual step).

- **Staged files only:** Prettier formats web files, ESLint fixes `*.ts`/`*.tsx`, Ruff lints + formats `*.py`. Fast by design.
- **No Python lint? No problem:** if `ruff` is not installed, the Python hook prints a warning and commits anyway — it never blocks you.
- **Install ruff for real Python linting** (recommended for parser work): `pip install -r services/parser/requirements-dev.txt`.
- **Heavy gates (typecheck/test/build) run in CI**, not on commit — PRs catch them.
- Reinstall hooks manually at any time with `pnpm run prepare`.

---

### 2. Optional: Run Local Python Parser Service

```bash
# Installs FastAPI + pdfplumber into a virtualenv
cd services/parser
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Optional: ruff (lint/format) — needed for pre-commit hooks and `pnpm lint:python`
pip install -r requirements-dev.txt

# Start the parser (or run it from the repo root with `pnpm dev:parser`)
uvicorn main:app --reload --port 8000
```

---

## ☁️ Production Deployment (100% Free Tier)

### 1. Python Parser (Render Free Tier)

1. Create a **New Web Service** on Render.
2. Root Directory: `services/parser`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set Environment Variable: `BACKEND_SHARED_SECRET=change-me-secret`

### 2. Next.js Web App (Vercel Free Tier)

1. Deploy `apps/web` on Vercel.
2. Add a **Vercel Blob** store from the Storage tab (`access: 'private'`).
3. Set Environment Variables:
   - `ADMIN_PASSWORD` = `CEC2026`
   - `PARSER_SERVICE_URL` = `https://your-parser.onrender.com`
   - `BACKEND_SHARED_SECRET` = `change-me-secret`
   - `CRON_SECRET` = `change-me-cron-secret`
4. **Important Safety Step:** Set Hard Spend Limit = **$0** in Vercel Spend Management.

---

## 🔁 Handover: Fork & Redeploy (If Owner Is Unreachable)

This repo is maintained by **Abhi122005**. If CEC staff or students need to operate
this system and **cannot contact the repository owner**, do not wait — fork and
redeploy:

1. **Fork** this repository into the CEC org (or any account with access).
2. **Redeploy web** (`apps/web`) on Vercel — free tier. No code changes needed.
3. **Redeploy parser** (`services/parser`) on Render or any Python host.
4. **Set your own secrets** — nothing sensitive is stored in the repo:
   `ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`,
   `PARSER_SERVICE_URL`, `BACKEND_SHARED_SECRET` (see `.env.example`).
5. **Set the repo variable `CI_ADMINS`** on the fork so admins keep the
   `[skip ci]` bypass (see AGENTS.md).
6. **Republish PDFs** — existing exam blobs live under the original Vercel
   account and do not carry over. Upload fresh PDFs on the new deployment.

No database or paid service is required; the zero-cost guarantee and local
fallbacks (`lib/blob.ts` → `.local_data/`) keep working in the fork. MIT
license permits free institutional reuse.

---

## 🧪 Verification & Build

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

Pre-commit hooks (Husky + lint-staged) auto-format and lint staged files (web +
Python via Ruff). Full typecheck/test/build run in GitHub Actions (`.github/workflows/ci.yml`)
instead, so commits stay fast. PR titles must follow conventional commits
(`feat:`, `fix:`, `chore:`, ...) — enforced by the CI `pr-title` check. Admins
listed in the repo variable `CI_ADMINS` can skip CI with `[skip ci]` in the
commit message or PR title.

---

## 📜 License

MIT License. Developed for **College of Engineering Chengannur (CEC)**. Free for institutional use.
