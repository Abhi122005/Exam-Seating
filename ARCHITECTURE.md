# 🏗️ System Architecture & Scalability Guide

This document provides a deep-dive technical explanation of the architecture, security model, and zero-cost scaling strategy used in the **KTU Exam Seating Portal**.

---

## 1. High-Level Architecture Overview

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
                     (3) Store Private JSON (Encrypted)
                                       ▼
                        ┌─────────────────────────────┐
                        │ /api/seating/[examId]       │
                        │ (Server-Side Time Gate)     │
                        └──────────────┬──────────────┘
                                       │
                         (4) Edge Cache (s-maxage=30)
                                       ▼
                                STUDENT PHONES
                     (1000+ Concurrent Searches / <1ms)
```

---

## 2. Zero-Cost Concurrency Engineering

### Why Traditional Systems Fail Under Rush Traffic

- During exam morning rushes (9:50 AM – 10:00 AM), 1,000+ students hit the seating portal within a 5-minute window.
- Traditional SQL query architectures execute: `SELECT * FROM seating WHERE roll_no = '...'`.
- This leads to:
  - Connection pool exhaustion on free database tiers (Postgres/MySQL connection limit: 20-50).
  - Rate-limit shutdowns or HTTP 500 errors.
  - Unexpected server resource bill spikes.

### The Solution: CDN Edge Caching + Client Range Search

1. **Edge CDN Caching (`Cache-Control: public, s-maxage=30`):**
   - The gatekeeper API endpoint `/api/seating/[examId]` returns the exam seating JSON payload.
   - Vercel's global CDN caches this HTTP response at edge locations worldwide for 30 seconds.
   - 99.9% of incoming student requests are served directly from CDN Edge Memory without triggering Next.js server execution.
2. **In-Browser Lexicographic Range Search (<1ms):**
   - The JSON payload size is compact (~50KB).
   - Roll numbers are stored as ranges (`CS24C01` to `CS24C30`).
   - The student's phone filters the room location locally in JavaScript using string comparison (`regNo >= roll_from && regNo <= roll_to`).

---

## 3. Dual-Mode Fallback Architecture

To ensure developers can test the application 100% locally without cloud accounts, every cloud service has an automatic fallback:

| Component       | Cloud Production Mode                | Local Development Fallback                     |
| --------------- | ------------------------------------ | ---------------------------------------------- |
| **Storage**     | Private Vercel Blob (`@vercel/blob`) | File System (`.local_data/`)                   |
| **PDF Parser**  | Python FastAPI on Render             | Node.js Built-in Mock Parser                   |
| **Cron Worker** | `cron-job.org` + `CRON_SECRET`       | Dev mode bypass (`NODE_ENV === 'development'`) |

---

## 4. Security & Data Gatekeeping

- **Private Blob Storage (`access: 'private'`):** Files stored in Vercel Blob cannot be accessed via direct public HTTP URLs.
- **Server Time Check:** `/api/seating/[examId]` inspects server clock against `publishAt`. Requests received before `publishAt` return `{ status: "scheduled" }` without reading seating data.
- **Automated Data Lifecycle:** 5 hours after exam release, `/api/cron/cleanup` marks seating data as cleared and deletes private blob files to prevent long-term data clutter.
