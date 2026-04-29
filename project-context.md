# Sharayu Dental Clinic — Project Context

**Document type:** BMAD Project Context  
**Version:** 1.0  
**Date:** April 2026  
**Author:** Akib Tamboli — Solutions Architect  
**Purpose:** Single source of truth for BMAD agents. Read this before any other file in either repo.

---

## 1. What This Project Is

A **dental practice management system** built for Sharayu Dental Clinic. It digitises three things the clinic currently does manually: patient appointment booking, clinical treatment tracking, and patient follow-up via WhatsApp.

The system has three user-facing surfaces:

| Surface | Who uses it | How they access it |
|---------|------------|-------------------|
| **Booking form** | Patients | WhatsApp "Book Now" link or clinic website button |
| **Admin dashboard** | Doctor + Receptionist | Direct URL, desktop browser, login required |
| **WhatsApp** | Patients | Automated messages sent by the system (not a UI the clinic builds) |

The clinic is a small practice — one dentist, one or two receptionists, approximately 20–40 appointments per day. The system is optimised for this scale, not for enterprise multi-branch use.

---

## 2. Business Context

### The clinic's workflow (before this system)

1. Patient calls or messages on WhatsApp to book
2. Receptionist writes it in a paper diary or Excel
3. Doctor treats patient, writes notes on paper
4. Receptionist generates invoice manually in Tally
5. Follow-up reminders sent manually on WhatsApp

### What this system automates

1. Patient books themselves via WA link or website CTA → no receptionist involvement for booking
2. Treatment cases tracked digitally — steps, invoices, healing windows
3. Invoices generated as PDFs automatically when appointment is closed
4. PDF sent to patient via WhatsApp automatically
5. Recall reminders sent automatically at the right interval per service
6. Admin sees schedule, case status, revenue, WA activity in one dashboard

### What this system does NOT do

- No telemedicine or video consult
- No insurance billing
- No multi-branch / multi-doctor scheduling
- No patient-facing login or portal (patients interact only through WhatsApp + the booking form)
- No payment gateway integration
- No inventory management

---

## 3. Two-Repo Architecture

This project is split into exactly two repositories. They are independent deployments with no shared code, no shared CI/CD pipeline, and no shared BMAD install.

```
sharayu-frontend/     ← Angular workspace (S3 + CloudFront)
sharayu-backend/      ← Node.js server (EC2 + PM2)
```

The two repos communicate exclusively through the REST API at `https://api.sharayudental.com/v1`. The frontend never touches the database directly.

### When you are working in sharayu-frontend/

- You only see Angular code
- You call the backend via `HttpClient` — no direct DB access
- BMAD is installed at `sharayu-frontend/` root
- Open Claude Code at `sharayu-frontend/` root — never at a parent folder

### When you are working in sharayu-backend/

- You only see Node.js code
- The frontend Angular code does not exist in this context
- BMAD is installed at `sharayu-backend/` root
- Open Claude Code at `sharayu-backend/` root

### Never

- Never run `npx bmad-method install` at a parent directory containing both repos
- Never open Claude Code at a folder that contains both repos as children
- Never share `.env` files between repos
- Never import Angular code into Node.js or vice versa

---

## 4. System Architecture at a Glance

```
Patient
  │  WhatsApp "Book Now" link or website CTA
  │  https://book.sharayudental.com?service=SVC-01&ref=whatsapp
  ▼
┌─────────────────────────────────┐
│  booking-form (Angular)         │  S3 + CloudFront
│  Single page · no routing       │  book.sharayudental.com
│  All state in one component     │
└────────────┬────────────────────┘
             │ POST /appointments (public, no auth)
             │ GET  /appointments/slots (public)
             ▼
┌─────────────────────────────────┐
│  Node.js API Server             │  EC2 t3.small · Ubuntu 22.04
│  Express 4 · PM2 (6 processes)  │  api.sharayudental.com
│  Port 3000 · behind Nginx       │
│                                 │
│  ┌──────────┐ ┌──────────────┐  │
│  │  waQueue │ │  pdfQueue    │  │  Bull queues
│  │  recall  │ │  (Redis AOF) │  │  backed by Redis 7
│  │  Queue   │ └──────────────┘  │  on localhost:6379
│  └──────────┘                   │
│                                 │
│  node-cron (3 scheduled jobs)   │
└────┬──────────┬─────────────────┘
     │          │
     ▼          ▼
┌─────────┐  ┌──────────────────────┐
│ MySQL 8 │  │ S3 (3 buckets)       │
│ RDS     │  │ sharayu-invoices     │
│ private │  │ sharayu-xrays        │
│ subnet  │  │ sharayu-assets       │
└─────────┘  └──────────────────────┘

Doctor / Receptionist
  │  Direct URL · login required
  ▼
┌─────────────────────────────────┐
│  admin (Angular)                │  S3 + CloudFront
│  Lazy-loaded modules            │  admin.sharayudental.com
│  AuthGuard + AuthInterceptor    │
└────────────┬────────────────────┘
             │ Bearer token (all routes)
             ▼
        Same API server above
```

---

## 5. Frontend — Angular Workspace

**Repo:** `sharayu-frontend/`  
**Stack:** Angular 17+ · TypeScript · RxJS · Angular Material · date-fns · ng2-charts  
**Build:** `ng build [app-name] --configuration=production`  
**Output:** `dist/booking-form/` and `dist/admin/`

### Two apps in one workspace

| | booking-form | admin |
|-|-------------|-------|
| Angular routing | `--routing=false` (none) | `--routing=true` + `loadChildren` |
| State management | Component class properties | Service + `subscribe()` |
| Auth | None (public) | `AuthGuard` + `AuthInterceptor` |
| Device target | Mobile-first 390px | Desktop 1280px+ |
| Key Angular Material | `MatSelect`, `MatButton`, `MatProgressSpinner` | `MatDialog`, `MatStepper`, `MatTabGroup`, `MatTable`, `MatSnackBar`, `MatDatepicker` |
| Charts | No | `ng2-charts` + `chart.js` |
| HTTP | `HttpClient` · no auth header | `HttpClient` · Bearer via `AuthInterceptor` |
| Bundle target | < 200KB gzipped | < 300KB initial + lazy chunks < 100KB |

### Booking form — how it works

A single `BookingFormComponent` with all state as class properties. Six sections appear progressively — each section is wrapped in `*ngIf` driven by `get` computed properties:

```
selectedService → showDate
selectedDate    → showSlot
selectedSlot    → showPatient
patientData     → showIntake
intakeData      → showSubmit
submitted=true  → ConfirmationCard (form hidden)
```

Each child component emits via `@Output() EventEmitter` when its section is complete. No NgRx. No `BehaviorSubject` for section state. No router.

**Entry URL parameters:**
- `?service=SVC-01` — pre-selects the service dropdown on `ngOnInit`
- `?ref=whatsapp` — captured as `bookingSource`, sent in the POST body as `booking_source`

### Admin — key patterns

- Every page module is lazy-loaded via `loadChildren`
- `AuthInterceptor` uses `BehaviorSubject` pattern to prevent parallel refresh calls (queue all 401 retries while one refresh is in flight)
- `AuthService` stores `access_token` in `sessionStorage` — never `localStorage`
- Refresh token is httpOnly cookie set by the backend
- Schedule page auto-refreshes via `interval(60_000).pipe(startWith(0), switchMap(...))` — must `unsubscribe()` in `ngOnDestroy`
- `HealingWindowBannerComponent` uses `date-fns` `differenceInDays` + `isPast` — no custom date logic

---

## 6. Backend — Node.js Monolith

**Repo:** `sharayu-backend/`  
**Stack:** Node.js 20 · Express 4 · Knex.js · MySQL 8 · Redis 7 · Bull · PDFKit · AWS SDK v3  
**Process manager:** PM2 (6 processes)  
**EC2:** t3.small · Ubuntu 22.04 · ap-south-1 (Mumbai)

### Layer rules (never cross these)

```
Route       → HTTP method + path + middleware only
Controller  → parse req · call service · send res · no DB · no queue
Service     → business logic · orchestrates repos + queues
Repository  → all Knex queries · returns plain objects · no business logic
Worker      → Bull consumer · calls service · updates DB
Cron        → node-cron · calls service · no HTTP
```

### PM2 processes

| Process name | Script | Instances | Role |
|-------------|--------|-----------|------|
| `api` | `src/server.js` | 2 (cluster) | HTTP server |
| `wa-worker` | `src/workers/wa.worker.js` | 1 | WA message dispatch |
| `pdf-worker` | `src/workers/pdf.worker.js` | 1 | PDF generation → S3 |
| `recall-worker` | `src/workers/recall.worker.js` | 1 | Recall job consumer |
| `cron` | `src/cron/index.js` | 1 | Scheduled jobs |

### Three Bull queues

| Queue | Purpose | Retries |
|-------|---------|---------|
| `waQueue` | WA dispatch — immediate + delayed day-before reminders | 3 · exponential backoff 5s |
| `pdfQueue` | Invoice PDF generation | 3 · exponential backoff 10s |
| `recallQueue` | Long-delayed recall messages (days to months in future) | 3 · exponential backoff 30s |

Redis is on the same EC2 instance (`127.0.0.1:6379`). AOF enabled — jobs survive PM2 restart.

---

## 7. Services — The 7 Treatments

| ID | Service | Steps | Key rules |
|----|---------|-------|-----------|
| SVC-01 | Oral Prophylaxis | Single visit | 6-month recall |
| SVC-02 | Restoration (Filling) | Single visit | Day 7 review recall |
| SVC-03 | Root Canal Treatment | 4 steps | 12-month recall |
| SVC-04 | Tooth Extraction | Single visit | Day 3 + Day 7 recalls · blood thinner alert |
| SVC-05 | Orthodontics (Braces/Aligners) | Rolling sessions | 3-month quarterly recall |
| SVC-06 | Dental Implant | 3 steps | **90-day healing window between Step 1 and Step 2** · 12-month recall |
| SVC-07 | Paediatric Pulpectomy | 3 steps | **All WA goes to parent_phone** · 6-month recall |

---

## 8. Critical Business Rules

These are the rules that must never be violated. Every agent must know them.

### Rule 1 — POST /appointments is public

The booking form has no login. `POST /appointments` accepts requests with no `Authorization` header. Zod validates the body. The backend upserts the patient by phone number (find-or-create) inside the same DB transaction as the appointment INSERT.

### Rule 2 — Patient upsert by phone

The booking form sends `{ patient: { name, phone, email }, ...appointment fields }`. The backend does `SELECT WHERE phone = ?` — if found, uses that `patient_id`; if not found, inserts a new patient. Never require the booking form to know a `patient_id` in advance.

### Rule 3 — booking_source on every appointment

Every appointment has `booking_source ENUM('whatsapp','website','direct','staff')`. The booking form sends it from the `?ref=` URL param. Admin-created appointments default to `'staff'`. This is used for analytics.

### Rule 4 — All WA dispatch through Bull

Never a synchronous Meta API call from a controller. Every WA message goes through `waQueue.add()`. This ensures retries, durability, and paediatric routing.

### Rule 5 — Paediatric routing in every WA worker

Before every Meta API call, check `patient.is_paediatric`. If `true`, send to `patient.parent_phone` using `patient.parent_name`. This check must be in every WA worker job handler — without exception.

### Rule 6 — bull_job_id stored immediately

After any `recallQueue.add()` or `waQueue.add()`, store the returned `job.id` in the DB row before returning. This is how cancellation works. Without it, recalls cannot be cancelled.

### Rule 7 — Healing window is an API-level guard

`PUT /cases/:id/steps/2` for implant cases checks `healing_window_end` in the **service layer**. Returns `400 { error, healing_window_end, days_remaining }` if healing is not complete. The Angular admin shows a banner — but the backend is the authoritative guard.

Healing window = Step 1 completion date + 90 days. Set automatically when Step 1 is marked complete.

### Rule 8 — Invoice number is atomic

Format `INV-YYYY-NNNN`. Generated with `INSERT INTO invoice_sequence ... ON DUPLICATE KEY UPDATE` + `SELECT FOR UPDATE` inside the same Knex transaction as the invoice INSERT. Never generated outside a transaction.

### Rule 9 — closeAppointment() transaction boundary

Steps 1–6 are inside one Knex transaction: UPDATE appointment status → get invoice number → classify GST → INSERT invoice. Steps 7–10 (enqueue PDF, enqueue WA, create recall jobs, audit log) happen **after** the transaction commits. The invoice row always exists before any async work starts.

### Rule 10 — No router in booking-form

`booking-form` uses `ng generate application booking-form --routing=false`. No `RouterModule`. No `<router-outlet>`. No `RouterLink`. All section state is managed by `BookingFormComponent` class properties and `*ngIf` directives.

### Rule 11 — No NgRx in either Angular app

Plain `HttpClient` subscriptions. Component class properties for local state. `Subscription` objects unsubscribed in `ngOnDestroy`. NgRx, Akita, and any other state management library are not used.

### Rule 12 — Tokens in sessionStorage only

Admin `access_token` stored in `sessionStorage.setItem('access_token', ...)`. Never `localStorage`. Refresh token is httpOnly cookie set by the backend via `Set-Cookie`. Never stored in JavaScript-accessible storage.

### Rule 13 — No port 22

EC2 access exclusively via AWS SSM Session Manager. The EC2 security group has no inbound rule on port 22. No `.pem` keys. No SSH.

### Rule 14 — IST for all user-facing dates

All timestamps stored as UTC in MySQL. All user-facing dates formatted in IST (`Asia/Kolkata`) using `date-fns-tz` `formatInTimeZone()` (frontend) or `dayjs().tz('Asia/Kolkata')` (backend). node-cron expressions are written in UTC and converted: 9AM IST = `30 3 * * *` UTC.

---

## 9. Database — 9 Tables

All on MySQL 8 RDS db.t3.micro · private subnet · accessed via Knex.js only.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `users` | Doctor + receptionist accounts | `role ENUM('doctor','receptionist','admin')` |
| `patients` | Patient records | `phone UNIQUE` · `is_paediatric` · `parent_phone` |
| `appointments` | All appointment slots | `booking_source ENUM` · `intake_data JSON` · `status ENUM` |
| `treatment_cases` | Multi-step treatment tracking | `case_type ENUM` · `healing_window_end DATE` |
| `treatment_steps` | Individual steps within a case | `step_number` · `status ENUM` · `bull_job_id` |
| `invoices` | Financial records | `invoice_type ENUM('exempt','gst')` · `pdf_s3_key` |
| `invoice_sequence` | Atomic invoice numbering | `year PK` · `last_seq INT` |
| `recall_schedules` | Recall job tracking | `trigger_type ENUM` · `bull_job_id` · `status ENUM` |
| `wa_logs` | WA message history | `recipient_phone` (may be parent_phone) · `meta_message_id` |
| `audit_log` | Action history | `user_id NULL` (NULL for public booking) |

**Migration run order (FK dependencies):**
```
001 users → 002 patients → 003 appointments → 004 treatment_cases
→ 005 treatment_steps → 006 invoices → 007 recall_schedules
→ 008 wa_logs → 009 audit_log
```

---

## 10. GST Rules

India's GST on dental services. Tracked per financial year (April 1 → March 31).

| Service | SAC Code | GST Rate | Invoice label |
|---------|---------|---------|--------------|
| SVC-01–07 (all dental procedures) | 9993 | 0% | RECEIPT |
| SVC-06 implant material supply | 9993 | 5% | TAX INVOICE |
| Teeth whitening, veneers (cosmetic) | 999722 | 18% | TAX INVOICE |

**Threshold monitoring:** GST registration required at Rs. 20,00,000 cosmetic (18% GST) revenue per FY. The system tracks this daily and shows banners in the admin dashboard:

- Rs. 16L → amber banner
- Rs. 19L → red banner + email alert
- Rs. 20L → dark red sticky banner (registration required)

---

## 11. WhatsApp Automation — 17 Templates

All dispatch via `waQueue` Bull queue → `wa.worker.js` → Meta BSP API. All phones prefixed `91` for India.

| Template | Trigger | Routing |
|---------|---------|---------|
| `booking_confirmed` | Any booking (public or admin) | patient or parent_phone |
| `appointment_reminder` | 9AM IST day before appointment | patient or parent_phone |
| `invoice_ready` | PDF generation complete | patient or parent_phone |
| `post_care_*` (7 templates) | Appointment close, one per service | patient or parent_phone |
| `extraction_day3` | 3 days post-extraction | patient |
| `extraction_day7_review` | 7 days post-extraction | patient |
| `recall_checkup` | 6 months — SVC-01 | patient |
| `recall_annual_review` | 12 months — SVC-03 | patient |
| `ortho_quarterly` | 3 months — SVC-05 | patient |
| `implant_annual` | 12 months — SVC-06 | patient |
| `paediatric_recall` | 6 months — SVC-07 | **parent_phone** |

Meta webhook (`POST /webhooks/whatsapp`) updates `wa_logs.status` as messages are delivered/read. Verified via HMAC `X-Hub-Signature-256`.

---

## 12. AWS Services Used

All on `ap-south-1` (Mumbai). EC2 uses an IAM instance profile — no access keys stored anywhere.

| Service | What it does in this project |
|---------|------------------------------|
| **EC2 t3.small** | Runs the Node.js API server + Redis + all PM2 processes |
| **RDS MySQL db.t3.micro** | Main database · private subnet |
| **S3 — `sharayu-invoices`** | PDF invoice storage (AES-256 encrypted) |
| **S3 — `sharayu-xrays`** | X-ray and CBCT file uploads |
| **S3 — `sharayu-assets`** | Angular static builds (`booking/` and `admin/` subfolders) |
| **CloudFront** | Two distributions — one per frontend app · HTTPS · gzip/brotli |
| **ACM** | TLS certs for `book.`, `admin.`, `api.` subdomains |
| **Route 53** | DNS for all three subdomains |
| **SES** | Monthly analytics PDF email to doctor |
| **SSM Session Manager** | EC2 shell access (port 22 is closed) |
| **Secrets Manager** | `DB_PASS` · `ACCESS_SECRET` · `REFRESH_SECRET` |
| **CloudWatch** | Custom metrics: `BullFailedJobs` · `AppErrorCount` · alerts |
| **CloudTrail** | API call audit |
| **WAF** | Rate limiting on API CloudFront distribution |

---

## 13. URLs & Domains

| URL | What it serves |
|-----|---------------|
| `https://book.sharayudental.com` | booking-form Angular app (S3 + CloudFront) |
| `https://admin.sharayudental.com` | admin Angular app (S3 + CloudFront) |
| `https://api.sharayudental.com/v1` | Node.js REST API (EC2 + Nginx) |

---

## 14. API Contract Summary

Base: `https://api.sharayudental.com/v1`

### Public endpoints (no auth required)

| Method | Path | Used by |
|--------|------|---------|
| GET | `/appointments/slots` | booking-form slot grid |
| POST | `/appointments` | booking-form submit |
| GET | `/appointments/:id` | booking confirmation page |
| POST | `/uploads/xray` | booking-form file upload |
| GET | `/webhooks/whatsapp` | Meta verification |
| POST | `/webhooks/whatsapp` | Meta delivery receipts |
| POST | `/auth/login` | admin login |
| POST | `/auth/refresh` | admin token refresh |

### Bearer-protected endpoints (admin only)

All other routes require `Authorization: Bearer <access_token>`. The admin `AuthInterceptor` adds this header automatically.

Key admin-only endpoints:
- `POST /appointments/:id/complete` — triggers the invoice + WA + recall chain
- `PUT /cases/:id/steps/:n` — advances treatment steps (implant Step 2 has healing window guard)
- `POST /invoices` — creates invoice → enqueues PDF generation
- `PUT /recalls/:id/cancel` — removes Bull job from Redis
- `GET /dashboard/*` — all dashboard data including gst_flag

---

## 15. Environment Variables Reference

### sharayu-backend/.env

```
NODE_ENV=production
PORT=3000

# CORS — both Angular frontend origins
BOOKING_FORM_URL=https://book.sharayudental.com
ADMIN_URL=https://admin.sharayudental.com

# Database
DB_HOST=<rds-endpoint>
DB_USER=sharayu_app
DB_PASS=<from secrets manager>
DB_NAME=sharayu_dental

# Redis (localhost only)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auth
ACCESS_SECRET=<64-char-hex>
REFRESH_SECRET=<64-char-hex>
ACCESS_EXPIRY=8h
REFRESH_EXPIRY=7d

# AWS (no keys — instance profile)
AWS_REGION=ap-south-1
S3_BUCKET_INVOICES=sharayu-invoices
S3_BUCKET_XRAYS=sharayu-xrays
S3_BUCKET_ASSETS=sharayu-assets
SES_FROM_EMAIL=noreply@sharayudental.com
SES_DOCTOR_EMAIL=doctor@sharayudental.com

# WhatsApp
WA_PHONE_NUMBER_ID=<meta-id>
WA_ACCESS_TOKEN=<meta-token>
WA_APP_SECRET=<meta-secret>
WA_WEBHOOK_VERIFY_TOKEN=<random-32-chars>

# Clinic
CLINIC_NAME=Sharayu Dental Clinic
CLINIC_PHONE=+91XXXXXXXXXX
CLINIC_GSTIN=<if registered>
```

### sharayu-frontend — Angular environment files

```typescript
// environment.production.ts (booking-form)
export const environment = {
  production:  true,
  apiUrl:      'https://api.sharayudental.com/v1',
  clinicPhone: '+91XXXXXXXXXX',
};

// environment.production.ts (admin)
export const environment = {
  production: true,
  apiUrl:     'https://api.sharayudental.com/v1',
  clinicName: 'Sharayu Dental Clinic',
};
```

---

## 16. CI/CD

Two repos, three GitHub Actions workflows, zero shared pipelines.

### sharayu-frontend — deploy-booking-form.yml

- Triggers on: push to `main` with changes in `projects/booking-form/**`
- Steps: `npm ci` → `ng build booking-form --configuration=production` → S3 sync `dist/booking-form/` → CloudFront invalidation
- Auth: OIDC IAM role (`role-to-assume`) — no stored access keys

### sharayu-frontend — deploy-admin.yml

- Triggers on: push to `main` with changes in `projects/admin/**`
- Steps: `npm ci` → `ng build admin --configuration=production` → S3 sync `dist/admin/` → CloudFront invalidation
- Auth: same OIDC role

### sharayu-backend — deploy-backend.yml

- Triggers on: push to `main`
- Steps: `npm ci` → `npm test --if-present` → SSM `send-command` to EC2: `git pull` → `npm ci` → `knex migrate:latest` → `pm2 reload --update-env`
- Auth: OIDC role with `ssm:SendCommand` permission

---

## 17. BMAD Setup

Both repos have independent BMAD installs. Install at the root of each repo separately.

```bash
# Frontend
cd sharayu-frontend
npx bmad-method install
# Select: current directory · Claude Code · ui (Angular)

# Backend
cd sharayu-backend
npx bmad-method install
# Select: current directory · Claude Code · service (Node.js API)
```

Each repo has its own:

```
.bmad-core/      ← BMAD agents and workflows
.claude/skills/  ← Claude Code skills
_bmad/           ← BMAD state
docs/            ← PRD, skills, and this context file
```

**BMAD agent cheat sheet for this project:**

| When you need to... | Use agent |
|--------------------|----------|
| Plan a new feature | `pm` (product manager) |
| Design architecture | `architect` |
| Build frontend code | `dev` (in sharayu-frontend session) |
| Build backend code | `dev` (in sharayu-backend session) |
| Write user stories | `sm` (scrum master) |
| Validate PRD/arch | `po` (product owner) |
| Review code | `dev` with review instructions |

---

## 18. Companion Documents

All documents live in the `docs/` folder of each repo.

| Document | Location | Purpose |
|----------|----------|---------|
| `project-context.md` | Both repos `docs/` | **This file** — read first |
| `PRD_FRONTEND.md` | `sharayu-frontend/docs/` | Full Angular frontend spec |
| `PRD_BACKEND.md` | `sharayu-backend/docs/` | Full Node.js backend spec |
| `SKILLS_FRONTEND.md` | `sharayu-frontend/docs/` | 24 Angular implementation skills |
| `SKILLS_BACKEND.md` | `sharayu-backend/docs/` | 15 Node.js implementation skills |
| `CLAUDE_CODE_INSTRUCTIONS.md` | Both repos `docs/` | Absolute rules + flows for Claude Code |

### Reading order for a new Claude Code session

**Frontend session:** `project-context.md` → `CLAUDE_CODE_INSTRUCTIONS.md` → `PRD_FRONTEND.md` → `SKILLS_FRONTEND.md`

**Backend session:** `project-context.md` → `CLAUDE_CODE_INSTRUCTIONS.md` → `PRD_BACKEND.md` → `SKILLS_BACKEND.md`

---

## 19. Common Mistakes — Do Not Do These

| Mistake | Why it matters | Correct approach |
|---------|---------------|-----------------|
| Adding auth middleware to `POST /appointments` | Booking form has no login | This endpoint is public — no `verifyToken` |
| Sending `patient_id` from booking form | Patient may not exist yet | Send `patient: { name, phone, email }` — backend upserts |
| Forgetting `booking_source` column | Breaks analytics | `ENUM('whatsapp','website','direct','staff') DEFAULT 'staff'` |
| Using `setTimeout` for WA dispatch | Not durable — dies on restart | Always `waQueue.add()` |
| Storing `access_token` in `localStorage` | XSS risk | `sessionStorage` only |
| Adding `RouterModule` to booking-form | Breaks single-page design | `--routing=false` — no router ever |
| Installing NgRx in either Angular app | Unnecessary complexity | Component class properties + `subscribe()` |
| Generating invoice number outside a transaction | Duplicate invoice numbers | Must be inside `knex.transaction()` with `FOR UPDATE` |
| Skipping `is_paediatric` check in WA worker | WA goes to child instead of parent | Check in every single WA worker handler |
| Using `eventbridge_rule_id` column | Old v1 architecture (Lambda) | Column is `bull_job_id` |
| Opening port 22 on EC2 | Security violation | SSM Session Manager only |
| Running BMAD install at parent folder | Ancestor conflict error | Install inside each repo root separately |
| Hardcoding API URLs in Angular components | Won't work in production | Always use `environment.apiUrl` |
| Using `new Date()` for IST scheduling | Off by 5h 30m | `dayjs().tz('Asia/Kolkata')` or `formatInTimeZone(..., 'Asia/Kolkata', ...)` |
| Writing raw SQL in services | Breaks the layer contract | All queries in repository files via Knex |

---

*Project Context v1.0 — Sharayu Dental Clinic · April 2026 · Akib Tamboli*  
*Read this file first in every BMAD session. It is the single source of truth for project decisions.*
