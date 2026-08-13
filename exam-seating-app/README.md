# 🎓 Exam Seating Allocation App

> A zero-database, privacy-first exam hall seating lookup system for staff and students.  
> Staff upload a PDF → students scan a QR code → they instantly see their room number.

## ✨ Features

- **PDF Upload & Auto-Parsing** — Dual-format parser handles both "Hall Allocation Summary" and "Subject Code" PDF layouts
- **Scheduled Release Gate** — Seating data stays locked in a private Vercel Blob until the exact publish time, enforced server-side
- **1000+ Concurrent Students** — CDN-cached API responses (30 s TTL) keep Vercel function invocations low during peak load
- **QR Code Generation** — Each exam gets a unique QR code for staff to share with students
- **Admin Dashboard** — List, postpone, re-publish, or remove exams from one place
- **Roll Number Range Matching** — Handles batch-letter rollovers (e.g. `C67 → D01`) without expanding ranges
- **Auto-Cleanup** — Expired exams are purged via a lightweight external cron job (no paid tier needed)

---

## 🏗️ Architecture

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
                                ┌──────────────────────┘
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

**No database.** The published seating data lives in a **private** Vercel Blob store and is only ever released through one gatekeeper route that checks the server clock first.

---

## 🛠️ Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Next.js 16 (Pages Router) on Vercel | Staff portal + student lookup page with SSR time-gating |
| **Backend** | Python 3 + FastAPI on Render (free) | Single-purpose PDF → JSON parser |
| **Storage** | Vercel Blob (free, 1 GB) | Private per-exam seating JSON, CDN-cached on read |
| **Styling** | Vanilla CSS, glassmorphism dark theme | No runtime CSS framework overhead |
| **QR Code** | `qrcode.react` | Renders exam URL as a scannable QR |
| **Auth** | Signed session cookie (admin only) | Stateless, no DB required |

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
    ├── pages/
    │   ├── index.js                  Landing page
    │   ├── admin/
    │   │   ├── login.js              Password → signed session cookie
    │   │   ├── index.js              Upload PDF + set schedule → Publish → QR code
    │   │   └── schedule.js           Dashboard: list, postpone, remove
    │   ├── exam/[examId].js          Student page — calls /api/seating only
    │   └── api/
    │       ├── admin/login.js        Set session cookie
    │       ├── admin/logout.js       Clear session cookie
    │       ├── admin/publish.js      Forward PDF → Render → push JSON to Blob
    │       ├── admin/exams/          Dashboard list, postpone, remove endpoints
    │       ├── seating/[examId].js   Gatekeeper — ONLY route reading the private Blob
    │       └── cron/cleanup.js       Deletes expired exams; hit by external scheduler
    ├── lib/
    │   ├── blob.js                   Vercel Blob read/write helpers
    │   └── auth.js                   Signed session cookie helpers
    ├── styles/
    │   └── globals.css               Global dark-theme design system
    ├── proxy.js                      Middleware: gates /admin/* behind session cookie
    ├── .env.example                  Required environment variables (see Setup)
    └── package.json
```

---

## ⚙️ Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Python](https://python.org/) 3.10+
- A [Vercel](https://vercel.com) account (free Hobby tier)
- A [Render](https://render.com) account (free tier)

---

### 1. Vercel Blob Store

In your Vercel project dashboard:

1. Go to **Storage → Create → Blob**
2. Choose **Private** access — ⚠️ this **cannot be changed later**
3. Copy your `BLOB_READ_WRITE_TOKEN` for local development
   *(In production, connecting the store to the project is enough — the SDK authenticates via OIDC automatically)*

---

### 2. Backend — FastAPI on Render

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # Set BACKEND_SHARED_SECRET to a long random string
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
npm install
cp .env.example .env.local    # Fill in all values — see comments in the file
npm run dev   # → http://localhost:3000
```

**Environment variables** (`.env.example`):

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Staff login password |
| `BACKEND_URL` | Your Render service URL |
| `BACKEND_SHARED_SECRET` | Must match the backend `.env` value |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Blob dashboard (local dev only) |
| `CLEANUP_SECRET` | Secret token for the `/api/cron/cleanup` route |
| `NEXT_PUBLIC_SITE_URL` | Public base URL (e.g. `https://your-site.vercel.app`) |

**Deploy to Vercel:**
- Import the repo, set root directory to `frontend`
- Add all env vars from `.env.example` in the Vercel dashboard

---

### 4. Free External Cleanup Scheduler

Vercel Hobby cron is limited to once-daily, which isn't granular enough.
Instead, use a free external scheduler (e.g. [cron-job.org](https://cron-job.org)) to hit:

```
https://<your-site>/api/cron/cleanup?secret=<CLEANUP_SECRET>
```

Set it to run **every 15 minutes**. No account card required.

---

## 🚀 Usage

| Step | URL | Who |
|------|-----|-----|
| 1 | `/admin/login` | Staff — sign in with admin password |
| 2 | `/admin` | Staff — upload seating PDF, set exam name / date / publish time, click **Publish**, get QR code |
| 3 | `/admin/schedule` | Staff — view all exams, postpone a release time, pull up a QR, or remove an exam |
| 4 | `/exam/<id>` | Students — scan the QR code; page shows a countdown until publish time, then accepts a roll number and returns the room |

---

## 🔒 Security & Privacy

- The Blob store is created with **`access: 'private'`** — blobs require authentication on every read and have **no direct public URL**
- `/api/seating/[examId]` is the sole gatekeeper route; it checks the server clock against `publishAt` / `expiresAt` before ever reading from Blob
- Before the release time, no room data is fetched from Blob at all — there is nothing to leak
- Students only ever see their **room number** — no class lists, roll ranges, or other student data are exposed
- The admin area is gated behind a signed, HTTP-only session cookie managed entirely server-side

---

## 🧩 Design Decisions & Tradeoffs

### Why Next.js writes to Blob (not Render directly)

Vercel Blob's stable, documented write path is its JS SDK (`@vercel/blob`) called from a Vercel server function. There is no public REST endpoint for external services to write directly. So the flow is:

> Staff uploads PDF → Next.js API route → forwards to Render for parsing → Render returns JSON → **same** Next.js route pushes JSON to Blob.

Render never touches Blob. The end-to-end result is identical — just routed through the one component that has an official write path.

### Why roll numbers are stored as ranges, not rows

Real seating PDFs provide roll numbers as ranges per room (e.g. `CS22C08–CS22C25`), not individual rows. Expanding ranges would risk inventing non-existent roll numbers at batch-letter boundaries (`C67 → D01`). Instead, ranges are stored as `roll_from` / `roll_to` and matching is a simple lexicographic between-check that handles letter rollovers correctly.

### Why the cleanup cron is external

Render's Cron Jobs are billed separately (not free). Vercel's own Cron Jobs on Hobby are free but capped at once-daily — not fine-grained enough to expire content hours after a specific publish time. A free external scheduler hitting `/api/cron/cleanup` every 15 minutes achieves the same result at $0.

### How 1000+ concurrent students are handled

The `/api/seating/[examId]` route sets `Cache-Control: s-maxage=30` on the published response. The large majority of concurrent student requests during a busy release window are served from CDN cache, not a fresh function invocation — keeping well within Vercel Hobby's function-invocation limits.

---

## 📄 License

MIT
