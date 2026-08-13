# 🎓 Exam Seating Allocation App

Matches this architecture:

```
Staff Portal --Upload PDF + Set Schedule--> Render (Python FastAPI, PDF parser)
                                                 |
                                     Parse PDF -> Push JSON
                                                 v
                                   Vercel (Next.js + PRIVATE seating JSON
                                            in Vercel Blob, per exam)
                                                 ^
                              GET /api/seating/[examId]  (server-side
                              time check; only route allowed to read Blob)
                                                 |
                                   Student Browser (1000+ concurrent,
                                   most reads served from CDN cache)
```

No database — but also no publicly-fetchable static file. The published
seating data lives in a **private** Vercel Blob and is only ever released
through one gatekeeper route that checks the time server-side first.

## Tech stack

| Layer     | Choice                                  | Why |
|-----------|--------------------------------------------|-----|
| Frontend  | **Next.js**, on **Vercel** (free)           | Staff portal pages + the student page that reads the JSON |
| Backend   | **Python + FastAPI**, on **Render** (free)  | Does exactly one thing: parse the uploaded PDF into structured rooms/ranges |
| Storage   | **Vercel Blob** (free — 1GB)                | Where `seating_data` JSON actually lives, per exam, CDN-cached |
| QR code   | `qrcode.react`                              | Encodes the student URL |

## Where this deviates from the diagram, and why

Two boxes in the original diagram aren't available for free exactly as
drawn. I kept the *outcome* the diagram describes, just realized slightly
differently:

**"Push JSON" happens from Next.js, not directly from Render.**
Vercel Blob's officially documented, stable write path is its JS SDK
(`@vercel/blob`) used from a Vercel server function — there's no public,
documented REST endpoint for third-party services like a separate Python
backend to call directly. So the actual flow is: Staff Portal uploads the
PDF → a Next.js API route forwards it to Render just for parsing → Render
returns structured JSON → the *same* Next.js API route pushes it to Vercel
Blob. Render never touches Blob directly. End-to-end result is identical to
the diagram (PDF in, CDN-cached JSON out) — just routed through the one
component that has an official way to write to Blob.

**"Auto-Cleanup Cron" isn't a Render Cron Job or a Vercel Cron Job.**
Render's Cron Jobs are billed separately (not covered by the free web
service tier). Vercel's own Cron Jobs are free on Hobby, but capped at
**once a day** — not fine-grained enough to expire something 5 hours after
a specific publish time. So cleanup is a normal API route
(`/api/cron/cleanup`) protected by a secret, triggered by a **free external
scheduler** hitting it every ~15 minutes — e.g.
[cron-job.org](https://cron-job.org) (free) or a scheduled GitHub Actions
workflow. Functionally this *is* the diagram's cron box; it just lives
outside Render/Vercel because that's the only way to get sub-daily
scheduling for $0.

## The release gate is enforced server-side (private Blob + a gatekeeper route)

Earlier versions of this exact diagram had students fetch a **public**
static JSON file directly from Blob, gated only by a client-side check —
which meant the raw data was technically fetchable early by anyone with
the link, even though the link itself was an unguessable random ID. That's
fixed now:

- The Blob store is created with **`access: 'private'`**. Private blobs
  require authentication on *every* read — they are not reachable by URL
  at all, by anyone, under any circumstances. There is no direct link to
  leak.
- Students hit **`/api/seating/[examId]`** instead, a small Next.js
  function that's the *only* thing with credentials to read the blob. It
  checks the server's own clock against `publishAt`/`expiresAt` before
  deciding what to return: before release, room data is never read from
  Blob at all, let alone sent to the browser.

This does mean student reads go through a Vercel serverless function
again, not a raw CDN file — but that's a much smaller cost than it sounds:
the function does one tiny JSON fetch and a timestamp comparison (trivial
memory/CPU), it auto-scales rather than being a single instance like
Render's free tier, and the "published" response is cached at the CDN edge
for ~30 seconds (`Cache-Control: s-maxage=30`), so the large majority of
concurrent student requests during a busy release window are served from
cache, not a fresh function invocation. 1000+ concurrent students is still
comfortably within Vercel Hobby's function-invocation allowance for an
event like this.

## Roll numbers are ranges, not individual rows

Real seating-list PDFs give roll numbers as ranges per room (e.g.
`CS22C08–CS22C25`), not one row per student. Ranges are kept as-is
(`roll_from`/`roll_to`) rather than expanded, because the "batch letter"
boundary (`...C67` → `D01`) isn't a fixed, guessable size — expanding could
invent roll numbers that don't exist. Matching is a lexicographic
"is this roll number between these two strings" check, which handles the
letter rollover correctly on its own.

## Two PDF formats are auto-detected

`backend/pdf_parser.py` was tested against a real seating PDF (not just a
sample image) and handles:
1. **"Hall Allocation Summary"** layout — `Year Batch From To Count
   Absentees` rows grouped under `Hall: NNN` headers. Primary format.
2. The older **"Subject: CODE -N Nos"** table-cell style.

Word-position clustering (not raw text line breaks) is used to reconstruct
rows, because column text can otherwise merge across a line or page break
in some PDF exports — this was a real bug caught by testing against an
actual file, not a hypothetical.

Students only ever see their **room number** — nothing else.

## Project layout

```
exam-seating-app/
├── backend/                     Render — PDF parsing only
│   ├── main.py                    POST /api/parse-pdf (shared-secret auth)
│   ├── pdf_parser.py               Dual-format parser
│   ├── requirements.txt
│   └── .env.example
└── frontend/                    Vercel — Next.js (Pages Router)
    ├── pages/
    │   ├── admin/
    │   │   ├── login.js            Password -> signed session cookie
    │   │   ├── index.js            Upload PDF + Set Schedule -> Publish
    │   │   └── schedule.js         Dashboard: list, postpone, remove
    │   ├── exam/[examId].js        Student page — calls /api/seating only
    │   └── api/
    │       ├── admin/login.js, logout.js
    │       ├── admin/publish.js    Forwards PDF to Render, pushes JSON to Blob
    │       ├── admin/exams/…       Dashboard list + postpone/remove
    │       ├── seating/[examId].js Gatekeeper — the ONLY route allowed to
    │       │                       read the private Blob; time-checks first
    │       └── cron/cleanup.js     Hit by an external free scheduler
    ├── lib/
    │   ├── blob.js                 Vercel Blob read/write helpers
    │   └── auth.js                 Signed session cookie helpers
    ├── proxy.js                    Gates /admin/* pages behind the cookie
    └── package.json
```

## Setup

### 1. Vercel Blob

In your Vercel project: **Storage → Create → Blob**, and choose **Private**
access when creating the store (this can't be changed later — a public
store can't be switched to private or vice versa). Copy the
`BLOB_READ_WRITE_TOKEN` it gives you for local development; in production
on Vercel itself, connecting the store to the project is enough — the SDK
authenticates automatically.

### 2. Backend (Render)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set BACKEND_SHARED_SECRET to a long random string
python -m uvicorn main:app --reload   # http://localhost:8000
```

Deploy free on Render: New → Web Service → root dir `backend` → build
`pip install -r requirements.txt` → start
`uvicorn main:app --host 0.0.0.0 --port $PORT` → add `BACKEND_SHARED_SECRET`.

### 3. Frontend (Vercel)

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in every value, see comments in the file
npm run dev   # http://localhost:3000
```

Deploy free on Vercel: import the repo, root dir `frontend`, add every env
var from `.env.example` (same `BACKEND_SHARED_SECRET` as Render, plus
`BACKEND_URL` = your Render URL, plus the Blob token/base URL).

### 4. Free external cleanup scheduler

At [cron-job.org](https://cron-job.org) (free, no card): create a job
hitting `https://<your-site>/api/cron/cleanup?secret=<CLEANUP_SECRET>`
every 15 minutes.

## Using it

1. `/admin/login` — sign in with the staff password.
2. `/admin` — upload the seating PDF, set session/date/publish time,
   **Publish**. Get a QR code.
3. `/admin/schedule` — see everything published, postpone a release time,
   pull up a QR again, or remove an exam early.
4. Students scan the QR → `/exam/<id>` → countdown until publish time, then
   enter roll number → room number.
