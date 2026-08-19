# 🎓 Exam Seating Allocation App

> Zero-database, privacy-first exam hall seating lookup system for staff and students.
> Staff upload PDF → students scan QR → instantly see room number.

## ✨ Features

- **PDF Upload & Auto-Parsing** — dual-format parser handles "Hall Allocation Summary" and "Subject Code" PDF layouts
- **Scheduled Release Gate** — seating data locked in private Vercel Blob until exact publish time, enforced server-side
- **1000+ Concurrent Students** — CDN-cached API responses (30 s TTL) keep Vercel function invocations low during peak load
- **QR Code Generation** — server-side SVG endpoint (`/api/qr?text=`) gives each exam scannable QR
- **Admin Dashboard** — list, postpone, re-publish, remove exams from one place
- **Roll Number Range Matching** — handles batch-letter rollovers (e.g. `C67 → D01`) without expanding ranges
- **Live Countdown** — student page shows ticking countdown until release, then auto-switches to roll lookup
- **Auto-Cleanup** — expired exams purged via lightweight external cron job (no paid tier needed)

---

## 🏗️ Architecture

**Static-first:** every page = hand-rolled HTML/CSS/vanilla JS in `public/` — zero client framework JS, each page < 14 KB raw (fits first TCP window even uncompressed). Next.js runs **API routes only** (App Router) and serves static pages via catch-all.

```
Staff Portal ─── Upload PDF + Set Schedule ──▶ Next.js API Route (Vercel)
                                                       │
                                          Forwards PDF │  ◀── shared secret auth
                                                       ▼
                                          FastAPI (Render) — PDF Parser
                                                       │
                                          Returns JSON  │
                                                       ▼
                                          Next.js writes JSON to Vercel Blob
                                          (Private access — no direct URL)
                                                       │
                                 ┌─────────────────────┘
                                 │
                     GET /api/seating/[examId]
                     (server-side time check;
                      the ONLY route that can read the Blob)
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
              CDN Cache (30s)        Student Browser
              (most requests)        (1000+ concurrent)
```

**No database.** Published seating data lives in **private** Vercel Blob store, released only through one gatekeeper route that checks server clock first. Every cloud service has **local fallback**: `.local_data/` on disk when `BLOB_READ_WRITE_TOKEN` missing, mock parser when Python service offline — `pnpm dev` works with zero configuration.

---

## 🛠️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Next.js 15 (App Router, API-only) on Vercel | Static pages in `public/`, zero client JS framework |
| **Backend** | Python 3 + FastAPI on Render (free) | Single-purpose PDF → JSON parser |
| **Storage** | Vercel Blob (free, 1 GB) | Private per-exam seating JSON, CDN-cached on read |
| **Styling** | Vanilla CSS, glassmorphism dark theme (`site.css`) | One shared stylesheet, no runtime CSS framework |
| **QR Code** | `qrcode-generator` → SVG via `/api/qr?text=` | Server-rendered, no client library |
| **Auth** | HMAC-signed session cookie (admin only) | Stateless, no DB required |
| **Package mgr** | pnpm 11 (pinned in `packageManager`) | Workspace + fast installs |

---

## 📁 Project Layout

```
exam-seating-app/
├── backend/                        Render — PDF parsing service
│   ├── main.py                       POST /api/parse-pdf  (shared-secret auth)
│   ├── pdf_parser.py                  Dual-format PDF → JSON parser
│   ├── requirements.txt
│   └── .env.example
└── frontend/                       Vercel — Next.js app
    ├── src/
    │   ├── app/
    │   │   ├── route.ts               Serves public/index.html at /
    │   │   ├── [...slug]/route.ts     Catch-all: serves other static pages
    │   │   └── api/
    │   │       ├── admin/login.ts     Set session cookie
    │   │       ├── admin/logout.ts    Clear session cookie
    │   │       ├── admin/manifest.ts  Dashboard list (auth required)
    │   │       ├── admin/publish.ts   Forward PDF → Render → push JSON to Blob
    │   │       ├── admin/exams/       PATCH postpone / DELETE remove (auth required)
    │   │       ├── seating/[examId].ts  Gatekeeper — ONLY route reading private Blob
    │   │       ├── manifest.ts        Public exam list for landing page
    │   │       ├── qr/route.ts        SVG QR for given text
    │   │       └── cron/cleanup.ts    Deletes expired exams; hit by external scheduler
    │   └── lib/
    │       ├── auth.ts                HMAC session cookie helpers (admin_session)
    │       ├── admin-session.ts       Token issue/verify (constant-time)
    │       ├── blob.ts                Gzip + private Vercel Blob, .local_data/ fallback
    │       ├── seating-format.ts      Range/singleton compaction + roll lookup
    │       ├── exam-publish.ts        Publish flow (parser adapter + manifest)
    │       ├── exam-release.ts        Time gate: scheduled / live / expired
    │       ├── exam-cleanup.ts        Prune/remove/postpone exams
    │       └── qr.ts                  SVG QR generation
    ├── public/
    │   ├── site.css                  Shared dark glassmorphism design system
    │   ├── seating.js                Shared client module (poll, lookup, countdown)
    │   ├── index.html                Landing page — exam list
    │   ├── exam/index.html           Student page — countdown + roll lookup + copy
    │   └── admin/
    │       ├── login/index.html      Master-password sign-in
    │       ├── schedule/index.html   Dashboard: list, postpone, QR, remove
    │       └── upload/index.html     Upload PDF + set schedule → Publish
    ├── pnpm-workspace.yaml          Build-script policy (sharp)
    ├── .env.example                  Required environment variables (see Setup)
    ├── vitest.config.ts             Tests run from repo root
    └── package.json
```

---

## ⚙️ Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 24+ and [pnpm](https://pnpm.io/) 11
- [Python](https://python.org/) 3.10+
- [Vercel](https://vercel.com) account (free Hobby tier)
- [Render](https://render.com) account (free tier)

---

### 1. Vercel Blob Store

In Vercel project dashboard:

1. **Storage → Create → Blob**
2. Choose **Private** access — ⚠️ cannot be changed later
3. Copy `BLOB_READ_WRITE_TOKEN` for local development
   *(Production: connecting store to project is enough — SDK authenticates via OIDC automatically)*

---

### 2. Backend — FastAPI on Render

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # Set BACKEND_SHARED_SECRET to long random string
python -m uvicorn main:app --reload   # → http://localhost:8000
```

**Deploy to Render (free):**

| Setting | Value |
|---------|-------|
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment var | `BACKEND_SHARED_SECRET` = your secret |

---

### 3. Frontend — Next.js on Vercel

```bash
cd frontend
pnpm install
cp .env.example .env.local    # Fill in all values — see comments in file
pnpm dev   # → http://localhost:3000  (works with zero env vars — local fallbacks)
```

**Environment variables** (`.env.example`):

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Staff login password (default `CEC2026` in code) |
| `PARSER_SERVICE_URL` | Python parser service URL (default `http://localhost:8000`) |
| `BACKEND_SHARED_SECRET` | Must match backend `.env` value (default `change-me`) |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob dashboard; missing → `.local_data/` fallback |
| `CRON_SECRET` | Bearer token for `/api/cron/cleanup` (dev bypasses check) |

**Deploy to Vercel:**
- Import repo, set root directory to `frontend`
- Add all env vars from `.env.example` in Vercel dashboard

---

### 4. Free External Cleanup Scheduler

Vercel Hobby cron limited to once-daily — not granular enough.
Use free external scheduler (e.g. [cron-job.org](https://cron-job.org)) to hit:

```
https://<your-site>/api/cron/cleanup   (header: Authorization: Bearer <CRON_SECRET>)
```

Run **every 15 minutes**. No account card required.

---

## 🧪 Verification

```bash
cd frontend
pnpm test          # 54 unit tests: storage, release gate, publish, cleanup, QR, client module
pnpm exec tsc --noEmit
pnpm build
```

Every page (HTML + CSS + JS) stays under **14 KB raw** so it fits first TCP window even uncompressed. Check:

```bash
Get-ChildItem public -Recurse -File | Sort-Object Length | Format-Table Length, FullName
```

---

## 🚀 Usage

| Step | URL | Who |
|------|-----|-----|
| 1 | `/admin/login` | Staff — sign in with admin password |
| 2 | `/admin/upload` | Staff — upload seating PDF, set exam name / date / publish time, click **Publish**, get QR code |
| 3 | `/admin/schedule` | Staff — view exams, postpone release time, pull QR, remove exam |
| 4 | `/exam?id=<id>` | Students — scan QR code; page shows countdown until publish time, then accepts roll number and returns room |

---

## 🔒 Security & Privacy

- Blob store created with **`access: 'private'`** — blobs require authentication on every read, **no direct public URL**
- `/api/seating/[examId]` sole gatekeeper route; checks server clock against `publishAt` / `expiresAt` before ever reading Blob
- Before release time, no room data fetched from Blob at all — nothing to leak
- Students only ever see **room number** — no class lists, roll ranges, or other student data exposed
- Admin area gated behind HMAC-signed, HTTP-only session cookie managed entirely server-side; every admin API route re-verifies it (no client-side-only gating)

---

## 🧩 Design Decisions & Tradeoffs

### Why Next.js writes to Blob (not Render directly)

Vercel Blob's stable, documented write path = JS SDK (`@vercel/blob`) called from Vercel server function. No public REST endpoint for external services to write directly. Flow:

> Staff uploads PDF → Next.js API route → forwards to Render for parsing → Render returns JSON → **same** Next.js route pushes JSON to Blob.

Render never touches Blob. End-to-end result identical — just routed through component with official write path.

### Why pages are static HTML, not React

Every page ships as self-contained HTML file (< 14 KB raw) with hand-rolled vanilla JS. No hydration, no client framework, no route prefetching — first paint is last paint. Keeps each page inside first TCP window (14 KB) even uncompressed, cuts client JS to near zero.

### Why roll numbers stored as ranges, not rows

Real seating PDFs provide roll numbers as ranges per room (e.g. `CS22C08–CS22C25`), not individual rows. Expanding ranges risks inventing non-existent roll numbers at batch-letter boundaries (`C67 → D01`). Ranges stored as `roll_from` / `roll_to`; matching = simple lexicographic between-check that handles letter rollovers correctly.

### Why cleanup cron is external

Render Cron Jobs billed separately (not free). Vercel Cron Jobs on Hobby free but capped at once-daily — not fine-grained enough to expire content hours after specific publish time. Free external scheduler hitting `/api/cron/cleanup` every 15 minutes achieves same result at $0.

### How 1000+ concurrent students handled

`/api/seating/[examId]` sets `Cache-Control: s-maxage=30` on published response. Large majority of concurrent student requests during busy release window served from CDN cache, not fresh function invocation — keeps within Vercel Hobby function-invocation limits.

---

## 📄 License

MIT