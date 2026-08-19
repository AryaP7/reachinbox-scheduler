# ReachInbox – Full-stack Email Job Scheduler

A production-grade email scheduler service + dashboard built for the Outbox Labs / ReachInbox hiring assignment.

- **Backend:** TypeScript · Express.js · BullMQ (Redis) · Prisma + PostgreSQL · Nodemailer (Ethereal SMTP)
- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · NextAuth (real Google OAuth)
- **Infra:** Docker Compose for Redis + PostgreSQL

```
reachinbox-scheduler/
├── docker-compose.yml      # Redis 7 + PostgreSQL 16
├── backend/                # Express API + BullMQ worker
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts        # API + worker bootstrap (reconciler runs here)
│       ├── queue/          # emailQueue, worker, Redis rate limiter
│       ├── services/       # scheduler (batching + restart reconcile), senders
│       ├── routes/         # /api/emails endpoints
│       └── middleware/     # Google ID token verification
└── frontend/               # Next.js dashboard
    └── src/
        ├── app/            # login page, dashboard, NextAuth route
        ├── components/     # Header, Tabs, EmailTable, ComposeModal + ui/ primitives
        └── lib/            # typed API client, auth options, CSV lead parsing
```

---

## 0. Quick local run (no Docker, no Google OAuth)

Docker is optional. Postgres and Redis both install natively in one command each, and an env-gated demo login lets you skip OAuth while testing (Google OAuth remains the real login path; the demo provider only exists when `DEMO_MODE=true`).

On Windows:

```bash
winget install PostgreSQL.PostgreSQL.17 --silent --override "--mode unattended --superpassword postgres --serverport 5432"
```

```bash
winget install taizod1024.redis-windows-fork --silent
```

(macOS: `brew install postgresql@17 redis`. Or just use `docker compose up -d`.)

Then create the database, set `AUTH_DISABLED=true` in `backend/.env` and `DEMO_MODE=true` + `NEXT_PUBLIC_DEMO_MODE=true` in `frontend/.env.local`, and run both dev servers. Open http://localhost:3000 and hit **Login** — in demo mode it signs you in without credentials, as an admin.

## 1. Running the project (full setup)

### Prerequisites

- Node.js ≥ 20
- Docker Desktop (recommended) — or a local Redis 6+ and PostgreSQL 14+

### Step 1 – Start Redis + PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` (user/pass `postgres`, db `reachinbox`) and Redis on `localhost:6379`, both with persistent volumes (Redis runs with AOF enabled so queued jobs survive container restarts).

### Step 2 – Backend (API + worker)

```bash
cd backend
cp .env.example .env        # then fill in GOOGLE_CLIENT_ID (see OAuth section)
npm install
npx prisma migrate dev --name init   # creates tables (or: npm run db:push)
npm run dev                 # starts API on :4000 + BullMQ worker in the same process
```

On first boot the backend **auto-provisions `SENDER_COUNT` Ethereal accounts** (via `nodemailer.createTestAccount()`) and stores them in the `Sender` table — no manual Ethereal signup needed. Sent emails include a **preview URL** (shown in the dashboard's Sent tab) where you can view the message on ethereal.email.

To test the API without OAuth set `AUTH_DISABLED=true` in `backend/.env`.

### Step 3 – Frontend

```bash
cd frontend
cp .env.example .env.local   # fill in Google credentials + NEXTAUTH_SECRET
npm install
npm run dev                  # http://localhost:3000
```

### Step 4 – Google OAuth setup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) and create an **OAuth client ID** (type: Web application).
2. Add authorized origins/redirects:
   - Origin: `http://localhost:3000`
   - Redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Put the client ID + secret in `frontend/.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and the **same client ID** in `backend/.env` (`GOOGLE_CLIENT_ID`) — the backend verifies the Google ID token on every API request.
4. Generate `NEXTAUTH_SECRET`: `openssl rand -base64 32` (any random string works locally).

### Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | backend | postgres@localhost | Prisma connection string |
| `REDIS_URL` | backend | redis://localhost:6379 | BullMQ + rate-limit counters |
| `WORKER_CONCURRENCY` | backend | `5` | Parallel jobs per worker |
| `MIN_SEND_DELAY_MS` | backend | `2000` | Hard minimum gap between sends per sender |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | backend | `100` | Global per-sender hourly cap |
| `SENDER_COUNT` | backend | `3` | Ethereal accounts auto-provisioned on boot |
| `GOOGLE_CLIENT_ID` | both | – | OAuth client; backend verifies ID tokens against it |
| `AUTH_DISABLED` | backend | `false` | Skip auth for local curl testing |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_SECRET` | frontend | – | NextAuth config |
| `NEXT_PUBLIC_API_URL` | frontend | `http://localhost:4000` | Backend base URL |

---

## 2. Architecture overview

### How scheduling works (no cron anywhere)

1. `POST /api/emails/schedule` receives `{ subject, body, recipients[], startTime, delayBetweenSeconds, hourlyLimit }`.
2. Recipients are normalized, validated and de-duplicated. A `EmailBatch` row plus one `EmailJob` row **per recipient** are written to PostgreSQL (single `createMany`).
3. Each recipient gets a pre-computed send slot: `scheduledAt = startTime + i × delay`, and senders are assigned **round-robin** across all Ethereal accounts.
4. One **BullMQ delayed job per email** is enqueued via `addBulk`, with `delay = scheduledAt - now` and — critically — **`jobId = EmailJob.id`**.
5. The BullMQ worker picks jobs up when their delay expires, passes the Redis rate-limit gate, sends via the assigned sender's SMTP transport (pooled per sender), and updates the row to `SENT` with the Ethereal `messageId` + preview URL.

Pre-spreading sends at schedule time means that under load the queue wakes jobs up already spaced out; the Redis limiter in the worker is the hard backstop, not the primary spacing mechanism.

### Persistence across restarts

Two independent layers guarantee restart safety:

1. **Redis is the source of truth for the queue.** BullMQ delayed jobs live in Redis (AOF-persisted in docker-compose), so a backend restart loses nothing — jobs simply fire at their original timestamps when the worker reconnects.
2. **A boot-time reconciler covers Redis data loss.** On startup, every `SCHEDULED`/`PROCESSING` row in Postgres is checked against the queue; any email whose Redis job is missing (e.g. `FLUSHALL`, volume wipe) is re-enqueued at its **original** `scheduledAt`. Rows stuck in `PROCESSING` (crash mid-send) are reset to `SCHEDULED` first.

### Idempotency — why nothing is ever sent twice

- **`jobId = EmailJob.id`**: BullMQ silently ignores an `add()` for a jobId that already exists, so the reconciler (or a double-submitted request) can never create duplicate jobs.
- **Status guard in the worker**: before sending, the worker re-reads the row; anything already `SENT` is skipped. This protects against BullMQ redeliveries (stalled-job recovery, retries after a crash between send and DB update).
- Delivery is therefore *at-least-once at the queue level, exactly-once at the send level* under normal operation; the only theoretical duplicate window is a crash in the milliseconds between SMTP acceptance and the `SENT` update, which the `PROCESSING` state makes observable.

### Rate limiting & throttling (Redis-backed, multi-instance safe)

All counters live in **Redis**, never process memory, so limits hold across any number of workers/instances:

| Mechanism | Key | Behavior |
|---|---|---|
| Per-sender hourly cap (`MAX_EMAILS_PER_HOUR_PER_SENDER`) | `rl:sender:{id}:{hourWindow}` | Atomic `INCR`; over the cap → `DECR` (rollback) and reschedule |
| Per-batch hourly cap (user's "Hourly limit" in compose) | `rl:batch:{id}:{hourWindow}` | Same pattern, layered on top of the sender cap |
| Min delay between sends (**default 2 s per sender**, `MIN_SEND_DELAY_MS`) | `throttle:sender:{id}` | `SET NX PX` acts as an auto-expiring distributed lock; effective delay = `max(env min, batch delay)` |

**Trade-off:** because the hourly counters live in Redis keyed by hour window, a *full Redis data loss* resets the hour's budget — recovered jobs get a fresh allowance for the current window. Scheduled emails themselves are never lost (they're rebuilt from Postgres by the reconciler); only the "how many have I already sent this hour" accounting resets. Moving counters to the DB would close this at the cost of a write on every send; Redis was chosen for throughput.

**Ordering:** deferred jobs are re-slotted in order, but with worker concurrency > 1 the exact set that wins the last few slots of a window is racy (several jobs check the limit simultaneously). Order is preserved *as much as possible* rather than strictly FIFO.

**When a limit is hit, jobs are never dropped or failed.** The worker calls `job.moveToDelayed(retryAt)` and throws BullMQ's `DelayedError`, which parks the job **without consuming a retry attempt**. Jobs deferred into the next hour window are assigned monotonically increasing slots (`nextWindowStart + seq × delay` via a Redis `resched:*` counter), which **preserves their relative order** and pre-spaces them so they don't re-trip the throttle when the window opens.

### Concurrency

- Worker concurrency is configurable via `WORKER_CONCURRENCY` (default 5).
- Parallel safety: rate-limit checks are atomic Redis operations with rollback; the min-delay lock (`SET NX`) guarantees only one send per sender per window even with concurrent jobs; idempotency guards make redeliveries harmless.

### Behavior under load (1000+ emails at the same time)

- The schedule endpoint writes 1000 rows in one `createMany` and enqueues via one `addBulk` — no per-email round trips.
- Send slots are pre-spread by the batch delay, so jobs mature gradually rather than stampeding.
- Whatever exceeds an hourly cap is deterministically pushed into the next hour window **in order**, and keeps rolling forward hour by hour until sent. Nothing is lost, nothing duplicates, order is preserved per sender/batch.
- With multiple senders (round-robin), throughput scales linearly: 3 senders × 100/hour = 300 emails/hour aggregate.

### Failure handling

Send failures retry up to 3 times with exponential backoff (5 s base). After the final attempt the row is marked `FAILED` with the error message, which the dashboard shows in the Sent tab.

---

## 3. API reference

All endpoints (except `/health`) require `Authorization: Bearer <Google ID token>` unless `AUTH_DISABLED=true`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/emails/schedule` | Schedule a batch. Body: `{ subject, body, recipients[], startTime, delayBetweenSeconds, hourlyLimit? }` |
| `GET` | `/api/emails?status=scheduled\|sent&page=&pageSize=&search=` | Paginated list (scheduled = SCHEDULED+PROCESSING asc by time; sent = SENT+FAILED desc) |
| `GET` | `/api/emails/counts` | `{ scheduled, sent }` totals for the sidebar |
| `GET` | `/api/emails/senders` | List provisioned Ethereal senders (populates the From selector) |
| `GET` | `/api/emails/:id` | Single email with full body, for the detail view |
| `GET` | `/health` | Liveness probe |

`POST /api/emails/schedule` also accepts an optional `senderId` (omit to rotate round-robin) and an `attachments` array of `{ filename, mimeType, content }` where `content` is base64.

| Method | Path | Role | Description |
|---|---|---|---|
| `PATCH` | `/api/emails/:id/star` | MEMBER | Toggle star |
| `PATCH` | `/api/emails/:id/archive` | MEMBER | Archive / restore |
| `DELETE` | `/api/emails/:id` | MEMBER | Soft-delete; cancels the queued job if it has not sent |
| `GET` | `/api/emails/attachments/:id/download` | VIEWER | Download an attachment |
| `GET` | `/api/admin/me` | any | Current user, role and permissions |
| `GET`/`PUT`/`DELETE` | `/api/admin/settings[/:key]` | ADMIN | Read, override, reset a runtime setting |
| `GET` | `/api/admin/settings/audit` | ADMIN | Settings change history |
| `GET` | `/api/admin/users` | ADMIN | List users |
| `PATCH` | `/api/admin/users/:id/role` | ADMIN | Change a user's role |

### A note on cancelling a send

`DELETE` returns `cancelled: true` only when the job was still waiting in Redis and was genuinely removed. If a worker has already claimed the row, the SMTP handoff is in flight and cannot be recalled — the API then reports `cancelled: false` and the UI says so, rather than claiming a cancellation that did not happen. The worker claims each row with a conditional `updateMany` before touching SMTP, so a delete that lands first reliably wins.

---

## 4. Features implemented

**Backend**
- ✅ Scheduler: BullMQ delayed jobs (no cron of any kind), per-recipient jobs, round-robin multi-sender via Ethereal SMTP
- ✅ Persistence: Redis-backed queue survives restarts; boot reconciler re-enqueues from Postgres if Redis was wiped; no re-sends, no restart-from-scratch
- ✅ Idempotency: `jobId = EmailJob.id` + status guard in worker
- ✅ Rate limiting: Redis hourly counters per sender (env-configurable) **and** per batch (user-configurable); over-limit jobs deferred to next window, order preserved
- ✅ Throttling: min 2 s between sends per sender (env-configurable), enforced via Redis `SET NX PX` lock
- ✅ Concurrency: configurable worker concurrency, safe under parallelism
- ✅ Retries with backoff + `FAILED` state; Zod-validated APIs; Google ID token verification middleware

### Access control (RBAC)

Three roles, enforced on the server for every mutating route and mirrored in the UI:

| Role | Can do |
|---|---|
| **VIEWER** | Read the dashboard: lists, detail views, attachments |
| **MEMBER** | Everything above, plus compose/schedule and star/archive/delete |
| **ADMIN** | Everything above, plus runtime Settings and user role management |

Accounts are created automatically on first Google sign-in (name/avatar/email come from the OAuth profile — there is no manual signup). The **first user to sign in becomes ADMIN**, as does any address in `ADMIN_EMAILS`; everyone after defaults to MEMBER. The last remaining admin cannot be demoted, so the instance can never be locked out. Roles are changed from **Settings → Users**.

### Runtime settings from the dashboard

Admins can tune throughput live at **/dashboard/settings** — minimum send delay, hourly cap per sender, worker concurrency and sender count — with per-field range validation and a full audit trail of who changed what.

**These are stored in the database, not written back to `.env`, and that is deliberate.** Env vars are only read at process start, so rewriting the file would appear to do nothing until a restart; an endpoint that writes env files is also an arbitrary-write/RCE risk if auth is ever bypassed (`NODE_OPTIONS`, `DATABASE_URL`, …). A DB row applies immediately across every worker and instance, and is safely scoped: only four whitelisted numeric keys are editable, and secrets and connection strings are rejected outright. Each row shows its env default and can be reset back to it.

**Frontend** — built to match the provided Figma (light theme, left sidebar, list rows):
- ✅ **Login screen**: Google OAuth via NextAuth + the email/password form from the design, centered card
- ✅ **Sidebar**: ONB logo, user avatar/name/email with logout menu, Compose button, CORE nav (Scheduled / Sent) with live counts
- ✅ **List screens**: search, a working **filter panel** (status / sender / starred-only, with an active-filter count), refresh; rows show `To:`, an orange scheduled-time chip (or Sent/Failed/Cancelled chip), bold subject with body preview, attachment count, and a **persisted star toggle**
- ✅ **Compose page**: From selector (real sender accounts, or round-robin), recipient chips with `+N` overflow, Upload List for CSV/TXT, **working attachments** via the paperclip (multi-file, size-capped, sent as real MIME attachments), Subject, Delay between 2 emails, Hourly Limit, rich-text editor with the full Figma toolbar, and a Send Later popover with quick picks
- ✅ **Email detail**: sender block with avatar, recipient, timestamp, rendered HTML body, downloadable attachment cards, status pill, Ethereal preview link, and working **star / archive / delete** (delete cancels a not-yet-sent email and pulls it from the queue)
- ✅ **Archived** view alongside Scheduled and Sent
- ✅ **Settings** and **Users** pages for admins, hidden entirely from non-admins
- ✅ Loading states, empty states, pagination, error/success toasts, live 15 s refresh
- ✅ Reusable UI kit (Button, IconButton, Spinner, EmptyState, icon set), typed API client, shared `useCounts` hook

**Note on the Figma:** the file opens read-only without Dev Mode, so exact tokens could not be inspected. Colors, spacing and type were matched visually from the design frames (primary green `#00A63E`, active pill `#E7F7EE`, field grey `#F5F6F7`, Inter). All layout and structure match; individual pixel values may differ by a hair.
