# Sharayu Dental Clinic — Backend PRD

**Version:** 2.1  
**Date:** April 2026  
**Author:** Akib Tamboli — Solutions Architect  
**Repo:** `sharayu-backend/` — separately hosted from `sharayu-frontend/`  
**Scope:** Node.js 20 API server · EC2 Ubuntu 22.04  
**Architecture:** Full Server — EC2 · Node.js · MySQL 8 · Redis 7 · Bull · PDFKit  
**Companion docs:** `PRD_FRONTEND.md` · `SKILLS_BACKEND.md` · `CLAUDE_CODE_INSTRUCTIONS.md`

---

## Changelog

| Version | Summary |
|---------|---------|
| v1.0 | Initial backend — full patient portal support · Lambda/EventBridge for recalls |
| v2.0 | Lambda/EventBridge removed · Bull queue + Redis replace them · PDFKit in-process |
| **v2.1** | **`POST /appointments` made public (no Bearer) · patient upsert by phone · `booking_source` ENUM column · CORS updated for separate frontend repo · `BOOKING_FORM_URL` + `ADMIN_URL` env vars · S3 `booking/` subfolder** |

---

## Table of Contents

1. [Backend Overview](#1-backend-overview)
2. [Repo & Folder Structure](#2-repo--folder-structure)
3. [Tech Stack](#3-tech-stack)
4. [Database Schemas](#4-database-schemas)
5. [API Endpoint Catalogue](#5-api-endpoint-catalogue)
6. [Business Logic — Critical Flows](#6-business-logic--critical-flows)
7. [Bull Queue Architecture](#7-bull-queue-architecture)
8. [WhatsApp Integration](#8-whatsapp-integration)
9. [PDF Invoice Engine](#9-pdf-invoice-engine)
10. [GST & Invoice Logic](#10-gst--invoice-logic)
11. [node-cron Scheduler](#11-node-cron-scheduler)
12. [Authentication & Security](#12-authentication--security)
13. [AWS Integration](#13-aws-integration)
14. [Functional Requirements](#14-functional-requirements)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Infrastructure & Deployment](#16-infrastructure--deployment)
17. [Phased Delivery](#17-phased-delivery)
18. [Environment Variables](#18-environment-variables)
19. [Testing Checklist](#19-testing-checklist)

---

## 1. Backend Overview

The backend is a **Node.js 20 monolith** running on a single EC2 t3.small (Ubuntu 22.04). It is the sole server-side component in the system — the two Angular frontend apps are static builds served from S3 and never touch the backend directly except through the REST API.

| Responsibility | How |
|----------------|-----|
| All REST API endpoints | Express 4 — route → controller → service → repository |
| MySQL database access | Knex.js query builder with connection pool |
| Async job processing | Bull queues backed by Redis 7 |
| WA message dispatch | Bull worker → Meta BSP API |
| Invoice PDF generation | Bull worker → PDFKit in-process → S3 |
| Recall scheduling | Bull delayed jobs persisted in Redis AOF |
| Time-based triggers | node-cron (reminders, GST check, monthly report) |
| File storage | AWS S3 via SDK v3 (invoices, X-rays, static assets) |
| Email delivery | AWS SES (monthly analytics report to doctor) |

### Two-repo separation

This backend repo (`sharayu-backend/`) has no knowledge of the Angular workspace. The frontend and backend are independently deployed, independently versioned, and share nothing except the API contract defined in this document.

CORS explicitly allows both frontend origins:
- `https://book.sharayudental.com` — booking form (public, no auth)
- `https://admin.sharayudental.com` — admin dashboard (Bearer token auth)

---

## 2. Repo & Folder Structure

```
sharayu-backend/                    ← git root · BMAD installed here
├── .bmad-core/
├── .claude/skills/
├── docs/
│   ├── PRD_BACKEND.md              ← this file
│   └── SKILLS_BACKEND.md
│
├── src/
│   ├── server.js                   ← Express app bootstrap + PM2 entry
│   ├── app.js                      ← Middleware stack · route mounting
│   │
│   ├── routes/                     ← HTTP method + path + middleware only
│   │   ├── auth.routes.js
│   │   ├── patients.routes.js
│   │   ├── appointments.routes.js  ← POST has no verifyToken (public)
│   │   ├── cases.routes.js
│   │   ├── invoices.routes.js
│   │   ├── recalls.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── webhooks.routes.js
│   │   └── uploads.routes.js
│   │
│   ├── controllers/                ← Parse req · call service · send res
│   │   ├── auth.controller.js
│   │   ├── patients.controller.js
│   │   ├── appointments.controller.js
│   │   ├── cases.controller.js
│   │   ├── invoices.controller.js
│   │   ├── recalls.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── webhooks.controller.js
│   │   └── uploads.controller.js
│   │
│   ├── services/                   ← Business logic · orchestrates repos + queues
│   │   ├── auth.service.js
│   │   ├── appointment.service.js  ← closeAppointment() + createAppointment()
│   │   ├── case.service.js         ← updateStep() with healing window guard
│   │   ├── invoice.service.js
│   │   ├── recall.service.js
│   │   ├── whatsapp.service.js     ← sendTemplate() + verifyWebhook()
│   │   ├── pdf.service.js          ← generateInvoicePDF() + generateReportPDF()
│   │   └── gst.service.js          ← classifyGST() + thresholdCheck()
│   │
│   ├── repositories/               ← All Knex queries — no SQL elsewhere
│   │   ├── patient.repo.js
│   │   ├── appointment.repo.js
│   │   ├── case.repo.js
│   │   ├── invoice.repo.js
│   │   ├── recall.repo.js
│   │   ├── wa-log.repo.js
│   │   └── audit.repo.js
│   │
│   ├── queues/
│   │   ├── wa.queue.js
│   │   ├── pdf.queue.js
│   │   └── recall.queue.js
│   │
│   ├── workers/                    ← Bull consumers · separate PM2 processes
│   │   ├── wa.worker.js            ← always checks is_paediatric
│   │   ├── pdf.worker.js
│   │   └── recall.worker.js
│   │
│   ├── cron/                       ← node-cron · single PM2 process
│   │   ├── reminders.cron.js       ← 9AM IST = 03:30 UTC
│   │   ├── gst-check.cron.js       ← 8AM IST = 02:30 UTC
│   │   └── reports.cron.js         ← midnight IST 1st of month
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js      ← verifyToken() · requireRole()
│   │   ├── validate.middleware.js  ← Zod schema validation
│   │   ├── async.middleware.js     ← asyncHandler wrapper
│   │   └── error.middleware.js     ← global error handler
│   │
│   ├── lib/
│   │   ├── knex.js                 ← connection pool min:2 max:10
│   │   ├── redis.js                ← ioredis · localhost:6379
│   │   └── aws.js                  ← S3Client · SESClient · CloudWatchClient
│   │
│   └── utils/
│       ├── gst.util.js             ← SAC code table
│       ├── invoice-number.util.js  ← atomic INV-YYYY-NNNN
│       ├── timezone.util.js        ← IST helpers · msUntil9AmIST()
│       └── wa-templates.util.js    ← template name → variable mapper
│
├── db/
│   ├── migrations/                 ← run in numeric order (001–009)
│   └── seeds/                      ← 001_users.js through 007_wa_logs.js
│
├── ecosystem.config.js             ← PM2 — 6 processes
├── knexfile.js
├── .env.example
├── .env                            ← never committed
├── package.json
└── .github/
    └── workflows/
        └── deploy-backend.yml      ← push to main → SSM send-command → pm2 reload
```

---

## 3. Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.19 | HTTP server |
| `knex` | ^3.1 | Query builder + migrations |
| `mysql2` | ^3.9 | MySQL driver |
| `bull` | ^4.12 | Redis-backed job queues |
| `ioredis` | ^5.3 | Redis client (required by Bull) |
| `node-cron` | ^3.0 | Time-based scheduled jobs |
| `pdfkit` | ^0.15 | In-process PDF generation |
| `@aws-sdk/client-s3` | ^3.x | S3 upload + presigned URLs |
| `@aws-sdk/client-ses` | ^3.x | Email delivery |
| `@aws-sdk/client-cloudwatch` | ^3.x | Custom metrics |
| `@aws-sdk/s3-request-presigner` | ^3.x | 15-min TTL PDF links |
| `axios` | ^1.6 | Meta WhatsApp API calls |
| `jsonwebtoken` | ^9.0 | JWT sign + verify |
| `bcryptjs` | ^2.4 | Password hashing (cost 12) |
| `zod` | ^3.22 | Request body validation |
| `multer` | ^1.4 | Multipart file parsing |
| `multer-s3` | ^3.0 | Direct stream to S3 |
| `helmet` | ^7.1 | Security headers |
| `cors` | ^2.8 | CORS — `BOOKING_FORM_URL` + `ADMIN_URL` |
| `morgan` | ^1.10 | HTTP request logging |
| `dayjs` | ^1.11 | Date arithmetic |
| `ms` | ^2.1 | Human-readable → ms (Bull delays) |
| `uuid` | ^9.0 | UUID v4 generation |
| `pm2` | ^5.3 | Process manager (global) |

---

## 4. Database Schemas

MySQL 8 on RDS db.t3.micro. All timestamps stored as UTC. All PKs are UUID (`CHAR(36)`).

### Migration run order (FK dependencies)

```
001_create_users.js
002_create_patients.js          ← also creates invoice_sequence table
003_create_appointments.js      ← includes booking_source ENUM column
004_create_treatment_cases.js
005_create_treatment_steps.js
006_create_invoices.js
007_create_recall_schedules.js  ← bull_job_id column (not eventbridge_rule_id)
008_create_wa_logs.js           ← bull_job_id column
009_create_audit_log.js
```

### Table: `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | UUID |
| `name` | VARCHAR(120) | |
| `email` | VARCHAR(200) UNIQUE | |
| `password_hash` | VARCHAR(255) | bcrypt cost 12 |
| `role` | ENUM('doctor','receptionist','admin') | |
| `is_active` | BOOLEAN DEFAULT true | |
| `last_login` | TIMESTAMP NULL | |
| `created_at` | TIMESTAMP | |

### Table: `patients`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `name` | VARCHAR(120) | |
| `phone` | VARCHAR(15) UNIQUE | |
| `email` | VARCHAR(200) NULL | |
| `dob` | DATE NULL | |
| `is_paediatric` | BOOLEAN DEFAULT false | |
| `parent_name` | VARCHAR(120) NULL | required if paediatric |
| `parent_phone` | VARCHAR(15) NULL | WA goes here if paediatric |
| `allergies` | TEXT NULL | |
| `medical_history` | TEXT NULL | |
| `blood_thinner` | BOOLEAN DEFAULT false | |
| `notes` | TEXT NULL | |
| `created_at` | TIMESTAMP | |

### Table: `appointments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `patient_id` | CHAR(36) FK → patients | |
| `service_id` | VARCHAR(10) | SVC-01 to SVC-07 |
| `chair_id` | TINYINT | 1–10 |
| `dentist_id` | CHAR(36) FK → users NULL | |
| `scheduled_at` | DATETIME | stored UTC |
| `duration_mins` | SMALLINT DEFAULT 45 | |
| `status` | ENUM('booked','confirmed','in_progress','done','no_show','cancelled') DEFAULT 'booked' | |
| `intake_data` | JSON NULL | service-specific fields |
| `booking_source` | ENUM('whatsapp','website','direct','staff') DEFAULT 'staff' | **v2.1 addition** |
| `notes` | TEXT NULL | clinical notes |
| `wa_confirm_sent` | BOOLEAN DEFAULT false | |
| `wa_reminder_sent` | BOOLEAN DEFAULT false | |
| `created_by` | CHAR(36) FK → users NULL | NULL if public booking |
| `created_at` | TIMESTAMP | |

### Table: `treatment_cases`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `patient_id` | CHAR(36) FK → patients | |
| `case_type` | ENUM('rct','implant','orthodontics','pulpectomy') | |
| `status` | ENUM('active','complete','abandoned') DEFAULT 'active' | |
| `total_steps` | TINYINT | 3 or 4 depending on case type |
| `steps_completed` | TINYINT DEFAULT 0 | |
| `healing_window_start` | DATE NULL | implant only — set on Step 1 complete |
| `healing_window_end` | DATE NULL | implant only — `start + 90 days` |
| `notes` | TEXT NULL | |
| `created_at` | TIMESTAMP | |

### Table: `treatment_steps`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `case_id` | CHAR(36) FK → treatment_cases | |
| `step_number` | TINYINT | 1-based |
| `step_name` | VARCHAR(100) | |
| `appointment_id` | CHAR(36) FK → appointments NULL | |
| `status` | ENUM('pending','in_progress','complete','skipped') DEFAULT 'pending' | |
| `invoice_id` | CHAR(36) FK → invoices NULL | per-step partial invoice |
| `clinical_notes` | TEXT NULL | |
| `wa_sent_at` | TIMESTAMP NULL | |
| `completed_at` | TIMESTAMP NULL | |

### Table: `invoices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `invoice_number` | VARCHAR(20) UNIQUE | `INV-YYYY-NNNN` |
| `patient_id` | CHAR(36) FK → patients | |
| `appointment_id` | CHAR(36) FK → appointments NULL | |
| `case_id` | CHAR(36) FK → treatment_cases NULL | |
| `invoice_type` | ENUM('exempt','gst') | |
| `service_code` | VARCHAR(10) | SAC code |
| `line_items` | JSON | `[{ description, amount }]` |
| `subtotal` | DECIMAL(10,2) | |
| `gst_rate` | DECIMAL(5,2) DEFAULT 0 | |
| `gst_amount` | DECIMAL(10,2) DEFAULT 0 | |
| `total` | DECIMAL(10,2) | |
| `pdf_s3_key` | VARCHAR(300) NULL | NULL until PDF worker completes |
| `wa_sent_at` | TIMESTAMP NULL | |
| `created_at` | TIMESTAMP | |

### Table: `invoice_sequence`

| Column | Type | Notes |
|--------|------|-------|
| `year` | SMALLINT PK | e.g. 2026 |
| `last_seq` | INT DEFAULT 0 | incremented atomically |

Used by `getNextInvoiceNumber(trx)` — `INSERT ... ON DUPLICATE KEY UPDATE last_seq = last_seq + 1` + `SELECT FOR UPDATE` inside transaction.

### Table: `recall_schedules`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `patient_id` | CHAR(36) FK → patients | |
| `appointment_id` | CHAR(36) FK → appointments NULL | |
| `case_id` | CHAR(36) FK → treatment_cases NULL | |
| `service_id` | VARCHAR(10) | |
| `trigger_type` | ENUM('6_month','12_month','day_3','day_7','1_week','1_month','3_month') | |
| `scheduled_at` | TIMESTAMP | |
| `status` | ENUM('scheduled','sent','rebooked','cancelled','failed') DEFAULT 'scheduled' | |
| `bull_job_id` | VARCHAR(100) NULL | stored for cancellation |
| `message_template` | VARCHAR(80) | |
| `sent_at` | TIMESTAMP NULL | |
| `delivered_at` | TIMESTAMP NULL | |
| `rebooked_at` | TIMESTAMP NULL | |
| `retry_count` | TINYINT DEFAULT 0 | |
| `created_at` | TIMESTAMP | |

### Table: `wa_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `patient_id` | CHAR(36) FK → patients | |
| `message_type` | VARCHAR(60) | booking_confirmation / invoice_delivery / recall etc. |
| `template_name` | VARCHAR(80) | Meta BSP template name |
| `recipient_phone` | VARCHAR(15) | parent_phone if paediatric |
| `params` | JSON NULL | template variable values |
| `status` | ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued' | |
| `meta_message_id` | VARCHAR(100) NULL | wamid from Meta API |
| `bull_job_id` | VARCHAR(100) NULL | |
| `error_message` | TEXT NULL | |
| `retry_count` | TINYINT DEFAULT 0 | |
| `sent_at` | TIMESTAMP NULL | |
| `delivered_at` | TIMESTAMP NULL | |
| `read_at` | TIMESTAMP NULL | |
| `created_at` | TIMESTAMP | |

### Table: `audit_log`

| Column | Type | Notes |
|--------|------|-------|
| `id` | CHAR(36) PK | |
| `user_id` | CHAR(36) FK → users NULL | NULL for public booking |
| `action` | VARCHAR(80) | |
| `entity_type` | VARCHAR(40) | appointment / invoice / patient etc. |
| `entity_id` | CHAR(36) | |
| `diff` | JSON NULL | before/after for updates |
| `ip_address` | VARCHAR(45) NULL | |
| `created_at` | TIMESTAMP | |

---

## 5. API Endpoint Catalogue

Base URL: `https://api.sharayudental.com/v1`

### 5.1 Auth

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/auth/login` | Public | `{ email, password }` → `{ access_token, refresh_token, user }` |
| POST | `/auth/refresh` | Public | `{ refresh_token }` → `{ access_token }` |
| POST | `/auth/logout` | Bearer | `{ refresh_token }` → `{ success: true }` |

### 5.2 Patients

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/patients` | Bearer | `?search=phone_or_name&page=1&limit=20` |
| POST | `/patients` | Bearer | Create patient |
| GET | `/patients/:id` | Bearer | Profile + recent appointments + active cases |
| PUT | `/patients/:id` | Bearer | Partial update |
| GET | `/patients/:id/appointments` | Bearer | Paginated · `?status=booked` |
| GET | `/patients/:id/invoices` | Bearer | All invoices with presigned PDF URLs |
| GET | `/patients/:id/cases` | Bearer | All cases with steps |
| GET | `/patients/:id/recalls` | Bearer | All recall schedules |

### 5.3 Appointments

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/appointments/slots` | **Public** | `?date=&service_id=&chair_id=` |
| GET | `/appointments` | Bearer | `?date=&chair_id=&status=` |
| POST | `/appointments` | **Public** (booking form) / Bearer (admin) | Patient upsert by phone · `booking_source` field · enqueues WA |
| GET | `/appointments/:id` | Public | Full detail + intake_data |
| PUT | `/appointments/:id` | Bearer | Status update · reschedule · notes |
| POST | `/appointments/:id/complete` | Bearer | Critical flow — see Section 6.1 |
| POST | `/appointments/:id/no-show` | Bearer | Updates status · audit log |
| DELETE | `/appointments/:id` | Bearer | Cancel · removes day-before Bull job |

**`POST /appointments` — public booking form payload:**
```json
{
  "service_id":     "SVC-01",
  "chair_id":       1,
  "scheduled_at":   "2026-05-15T10:00:00",
  "booking_source": "whatsapp",
  "patient": {
    "name":  "Ramesh Kumar",
    "phone": "9876543210",
    "email": "ramesh@gmail.com"
  },
  "intake_data": {
    "last_scaling_date": "2025-11-01",
    "sensitivity_level": "mild"
  }
}
```

Patient upsert logic: `SELECT WHERE phone = ?` → if found return `patient_id`, if not found `INSERT` new patient. Both run inside the same DB transaction as the appointment INSERT.

### 5.4 Treatment Cases

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/cases` | Bearer | `{ patient_id, case_type, notes }` — backend pre-fills steps |
| GET | `/cases/:id` | Bearer | Case + all steps + linked appointments |
| PUT | `/cases/:id` | Bearer | Update status or notes |
| PUT | `/cases/:id/steps/:step_number` | Bearer | Mark step status — implant Step 2 has healing window guard |
| POST | `/cases/:id/complete` | Bearer | Final invoice + recall Bull job |

**Healing window guard on `PUT /cases/:id/steps/2` (implant):**
```
if case.case_type === 'implant' AND step_number === 2:
  if NOW() < healing_window_end:
    return 400 {
      error: 'Healing window not complete',
      healing_window_end: case.healing_window_end,
      days_remaining: ceil((healing_window_end - now) / 86400000)
    }
```

### 5.5 Invoices

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/invoices` | Bearer | Classifies GST → enqueues pdfQueue → returns `{ invoiceId, jobId }` |
| GET | `/invoices/:id` | Bearer | Invoice + presigned PDF URL (15-min TTL) |
| POST | `/invoices/:id/send-wa` | Bearer | Re-enqueues `invoice_ready` to waQueue |
| GET | `/invoices` | Bearer | `?patient_id=&date_from=&date_to=&type=exempt\|gst` |

### 5.6 Recalls

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/recalls/due` | Bearer | `?service_id=&overdue_only=true` |
| POST | `/recalls/:id/send` | Bearer | Immediate — `waQueue.add(template, data, { delay: 0 })` |
| PUT | `/recalls/:id/cancel` | Bearer | `recallQueue.getJob(bull_job_id).then(j => j.remove())` |
| GET | `/recalls/stats` | Bearer | Count by status for current month |

### 5.7 Dashboard

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/dashboard/today` | Bearer | Appointments today grouped by chair + `gst_flag` |
| GET | `/dashboard/revenue` | Bearer | `?period=day\|week\|month` |
| GET | `/dashboard/treatments` | Bearer | Count + revenue per service_id |
| GET | `/dashboard/wa-activity` | Bearer | wa_logs counts for today |
| GET | `/dashboard/recall-list` | Bearer | Overdue recalls |
| GET | `/dashboard/queue-health` | Bearer | Bull queue stats — waiting/active/failed |

### 5.8 Webhooks

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/webhooks/whatsapp` | Token verify | Meta challenge verification |
| POST | `/webhooks/whatsapp` | HMAC `X-Hub-Signature-256` | Delivery/read status → update wa_logs |

### 5.9 File Uploads

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/uploads/xray` | Public | `multipart/form-data` · `file` + `patient_phone` fields → returns `{ s3_key }` |

---

## 6. Business Logic — Critical Flows

### 6.1 `closeAppointment()` — Most Critical Function

All DB work is in one transaction. Bull jobs are enqueued after commit.

```
1. BEGIN TRANSACTION
2. UPDATE appointments SET status = 'done'
3. getNextInvoiceNumber(trx)   ← atomic: INSERT ... ON DUPLICATE KEY UPDATE + SELECT FOR UPDATE
4. classifyGST(service_id)     ← returns { sacCode, rate, type }
5. INSERT invoices (pdf_s3_key = NULL)
6. COMMIT
─── outside transaction ────────────────────────────
7. pdfQueue.add('generate_invoice', { invoiceId })
8. Cancel pending day-before reminder Bull job if still queued
9. recallService.createRecallJobs(patient_id, service_id, appointment_id)
10. audit_log entry
```

Steps 1–6 are atomic. Steps 7–10 run outside the transaction — if they fail, Bull retries automatically.

### 6.2 `createAppointment()` — Public Booking Endpoint

```
1. Zod validate request body (publicBookingSchema)
2. BEGIN TRANSACTION
3. upsertPatient(body.patient, trx)  ← find by phone or INSERT new
4. SELECT appointment WHERE scheduled_at + chair_id + status NOT IN (cancelled, no_show)
   → IF EXISTS: ROLLBACK → return 409 Conflict
5. INSERT appointments (patient_id, service_id, chair_id, scheduled_at, booking_source, intake_data)
6. COMMIT
─── outside transaction ────────────────────────────
7. waQueue.add('booking_confirmation', { patientId, appointmentId })
8. msUntil9AmIST = calculate delay to 9AM IST day before appointment
   → IF > 0: waQueue.add('day_before_reminder', { appointmentId }, { delay, jobId: `reminder-${id}` })
```

### 6.3 `updateStep()` — Implant Healing Window Guard

```
1. GET treatment_case and treatment_step
2. IF case.case_type === 'implant' AND step_number === 2:
     IF NOW() < case.healing_window_end:
       throw { status: 400, error: 'Healing window not complete',
               healing_window_end, days_remaining }
3. IF case.case_type === 'implant' AND step_number === 1 AND body.status === 'complete':
     healing_window_end = today + 90 days
     UPDATE treatment_cases SET healing_window_start=NOW(), healing_window_end
     scheduleRecall(patient_id, 'SVC-06', null, '1_week')
     scheduleRecall(patient_id, 'SVC-06', null, '1_month')
4. UPDATE treatment_steps SET status, clinical_notes, completed_at
5. UPDATE treatment_cases SET steps_completed = steps_completed + 1 IF status='complete'
```

### 6.4 `createRecallJobs()` — Recall Scheduling

```javascript
const RECALL_MAP = {
  'SVC-01': [{ type: '6_month',  template: 'recall_checkup' }],
  'SVC-02': [{ type: 'day_7',    template: 'restoration_day7_review' }],
  'SVC-03': [{ type: '12_month', template: 'recall_annual_review' }],
  'SVC-04': [{ type: 'day_3',    template: 'extraction_day3' },
             { type: 'day_7',    template: 'extraction_day7_review' }],
  'SVC-05': [{ type: '3_month',  template: 'ortho_quarterly' }],
  'SVC-06': [{ type: '12_month', template: 'implant_annual' }],
  'SVC-07': [{ type: '6_month',  template: 'paediatric_recall' }],
};
```

For each recall: INSERT `recall_schedules` → `recallQueue.add(template, data, { delay, jobId: recallId })` → store returned `job.id` in `recall_schedules.bull_job_id`.

---

## 7. Bull Queue Architecture

Three queues, all backed by Redis 7 at `127.0.0.1:6379`. Redis AOF (`appendonly yes`) ensures jobs survive PM2 restart.

| Queue | Purpose | Concurrency | Retries |
|-------|---------|-------------|---------|
| `waQueue` | WA message dispatch (immediate + delayed) | 3 | 3 · exponential backoff 5s |
| `pdfQueue` | PDF generation + S3 upload | 1 | 3 · exponential backoff 10s |
| `recallQueue` | Long-delayed recall jobs | 2 | 3 · exponential backoff 30s |

### WA Worker — paediatric routing is mandatory

```javascript
waQueue.process('booking_confirmation', 3, async (job) => {
  const { patientId, appointmentId } = job.data;
  const patient = await patientRepo.getById(patientId);

  // ✦ ALWAYS check before every WA dispatch ✦
  const recipientPhone = patient.is_paediatric ? patient.parent_phone : patient.phone;
  const recipientName  = patient.is_paediatric ? patient.parent_name  : patient.name;

  const logId = await waLogRepo.create({ patientId, recipientPhone, ... });
  const wamid = await whatsappService.sendBookingConfirmation(recipientPhone, recipientName, appointmentId);
  await waLogRepo.update(logId, { status: 'sent', meta_message_id: wamid, sent_at: new Date() });
});
```

### Recall cancellation

```javascript
async function cancelRecall(recallId) {
  const recall = await recallRepo.getById(recallId);
  if (recall.bull_job_id) {
    const job = await recallQueue.getJob(recall.bull_job_id);
    if (job) await job.remove();
  }
  await recallRepo.update(recallId, { status: 'cancelled' });
}
```

### PM2 — 6 processes

```javascript
// ecosystem.config.js
apps: [
  { name: 'api',           script: 'src/server.js', instances: 2, exec_mode: 'cluster' },
  { name: 'wa-worker',     script: 'src/workers/wa.worker.js',     instances: 1 },
  { name: 'pdf-worker',    script: 'src/workers/pdf.worker.js',    instances: 1 },
  { name: 'recall-worker', script: 'src/workers/recall.worker.js', instances: 1 },
  { name: 'cron',          script: 'src/cron/index.js',            instances: 1 },
]
```

---

## 8. WhatsApp Integration

Meta Business Suite BSP. All dispatch goes through Bull — never a direct HTTP call from a controller.

### Templates (17 total)

| Template name | Trigger |
|--------------|---------|
| `booking_confirmed` | `POST /appointments` (public or admin) |
| `appointment_reminder` | Day-before Bull job (9AM IST) |
| `invoice_ready` | PDF worker completion |
| `post_care_prophylaxis` | Appointment close — SVC-01 |
| `post_care_restoration` | Appointment close — SVC-02 |
| `post_care_rct` | Appointment close — SVC-03 |
| `post_care_extraction` | Appointment close — SVC-04 |
| `post_care_orthodontics` | Appointment close — SVC-05 |
| `post_care_implant` | Appointment close — SVC-06 |
| `post_care_pulpectomy` | Appointment close — SVC-07 |
| `extraction_day3` | 3-day recall — SVC-04 |
| `extraction_day7_review` | 7-day recall — SVC-04 |
| `recall_checkup` | 6-month recall — SVC-01 |
| `recall_annual_review` | 12-month recall — SVC-03 |
| `ortho_quarterly` | 3-month recall — SVC-05 |
| `implant_annual` | 12-month recall — SVC-06 |
| `paediatric_recall` | 6-month recall — SVC-07 (sent to parent_phone) |

### Phone formatting

All phones passed to Meta API prepended with `91` country code:
```javascript
const to91 = phone.startsWith('91') ? phone : `91${phone}`;
```

### Webhook verification

```javascript
function verifyWebhook(req) {
  const sig      = req.headers['x-hub-signature-256'];
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WA_APP_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```

---

## 9. PDF Invoice Engine

PDFKit runs in-process within the `pdf-worker` PM2 process. No external PDF service.

### Flow

```
1. pdfQueue job consumed by pdf.worker.js
2. pdf.service.generateInvoicePDF(invoice, patient)
3. PDFDocument streamed to Buffer
4. Buffer uploaded to S3: s3://sharayu-invoices/INV-2026-0001.pdf
   (ServerSideEncryption: AES256)
5. UPDATE invoices SET pdf_s3_key = 'invoices/INV-2026-0001.pdf'
6. waQueue.add('invoice_ready', { invoiceId, patientId })
7. waQueue.add('post_care_<service>', { patientId, serviceId })
```

### Invoice types

| invoice_type | Header text | GST rows shown | SAC code |
|-------------|-------------|----------------|---------|
| `exempt` | "RECEIPT" | No | 9993 |
| `gst` | "TAX INVOICE" | Yes — rate + amount | 9993 (5%) or 999722 (18%) |

---

## 10. GST & Invoice Logic

### Classification rules

| Service | SAC Code | GST Rate | Invoice type |
|---------|---------|---------|-------------|
| SVC-01 Prophylaxis | 9993 | 0% | exempt |
| SVC-02 Restoration | 9993 | 0% | exempt |
| SVC-03 RCT | 9993 | 0% | exempt |
| SVC-04 Extraction | 9993 | 0% | exempt |
| SVC-05 Orthodontics | 9993 | 0% | exempt |
| SVC-06 Implant procedure | 9993 | 0% | exempt |
| SVC-06 Implant material | 9993 | 5% | gst |
| SVC-07 Pulpectomy | 9993 | 0% | exempt |
| Teeth whitening / veneers | 999722 | 18% | gst |

### Threshold tracking (FY April–March)

GST registration required at Rs. 20,00,000 cosmetic revenue per financial year. `gst-check.cron.js` runs daily at 8AM IST, sums `invoices.total WHERE invoice_type='gst' AND created_at >= FY_START`, and updates a flag read by `GET /dashboard/today`.

| Revenue | Flag returned | Admin banner |
|---------|--------------|-------------|
| < Rs. 16L | `null` | Hidden |
| Rs. 16L–19L | `WARNING_80PCT` | Amber |
| Rs. 19L–20L | `CRITICAL_95PCT` | Red |
| ≥ Rs. 20L | `REGISTRATION_REQUIRED` | Dark red sticky |

### Invoice number atomicity

```javascript
// Inside Knex transaction:
await trx.raw(`
  INSERT INTO invoice_sequence (year, last_seq) VALUES (?, 1)
  ON DUPLICATE KEY UPDATE last_seq = last_seq + 1
`, [year]);
const [row] = await trx('invoice_sequence').where({ year }).select('last_seq').forUpdate();
return `INV-${year}-${String(row.last_seq).padStart(4, '0')}`;
```

---

## 11. node-cron Scheduler

Runs as the `cron` PM2 process. All cron expressions in UTC.

| Job | Cron (UTC) | IST equivalent | What it does |
|-----|-----------|---------------|-------------|
| Day-before reminders | `30 3 * * *` | 9:00 AM | Finds tomorrow's booked appointments · enqueues `day_before_reminder` WA jobs |
| GST threshold check | `30 2 * * *` | 8:00 AM | Sums cosmetic revenue · updates gst_flag |
| Monthly report | `30 18 1 * *` | Midnight IST 1st | pdfQueue monthly report → SES email to doctor |

---

## 12. Authentication & Security

### JWT tokens

| Token | Secret | Expiry | Storage |
|-------|--------|--------|---------|
| Access token | `ACCESS_SECRET` | 8h | Frontend `sessionStorage` |
| Refresh token | `REFRESH_SECRET` | 7d | httpOnly `Set-Cookie` |

### Route auth

```javascript
// Public routes (no middleware)
router.get('/appointments/slots', asyncHandler(ac.getSlots));
router.post('/appointments',      asyncHandler(ac.create));    // ← PUBLIC v2.1
router.get('/appointments/:id',   asyncHandler(ac.getById));
router.get('/webhooks/whatsapp',  asyncHandler(wc.verify));
router.post('/webhooks/whatsapp', asyncHandler(wc.handle));
router.post('/uploads/xray',      upload.single('file'), asyncHandler(uc.xray));

// Protected routes (verifyToken required)
router.get('/',    verifyToken, asyncHandler(ac.list));
router.put('/:id', verifyToken, asyncHandler(ac.update));
// ... all other routes
```

### CORS (v2.1)

```javascript
app.use(cors({
  origin: [
    process.env.BOOKING_FORM_URL,   // https://book.sharayudental.com
    process.env.ADMIN_URL,          // https://admin.sharayudental.com
  ],
  credentials:    true,
  methods:        ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
```

### Security middleware stack

```javascript
app.use(helmet());           // security headers
app.use(cors(config));       // origin whitelist
app.use(morgan('combined')); // request logging
app.use(express.json({ limit: '10mb' }));
```

---

## 13. AWS Integration

EC2 instance has an IAM role attached — no access keys stored on the instance.

| Service | Usage |
|---------|-------|
| **S3** | `sharayu-invoices` (PDF invoices) · `sharayu-xrays` (X-rays, CBCT) · `sharayu-assets` (frontend static builds — `booking/` and `admin/` subfolders) |
| **CloudFront** | Two distributions — one per frontend app |
| **SES** | Monthly report email to doctor |
| **CloudWatch** | Custom metrics: `BullFailedJobs` · `AppErrorCount` · `PDFGenerationTime` |
| **SSM Session Manager** | EC2 shell access — port 22 is closed |
| **Secrets Manager** | `DB_PASS` · `ACCESS_SECRET` · `REFRESH_SECRET` |
| **CloudTrail** | API call audit log |
| **ACM** | TLS certificates for all three domains |
| **WAF** | Rate limiting on API CloudFront |

### Presigned URL generation

```javascript
const getPresignedUrl = (key, bucket = process.env.S3_BUCKET_INVOICES, expiresIn = 900) =>
  getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
// expiresIn = 900 seconds = 15 minutes
```

---

## 14. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| BE-01 | `POST /appointments` accepts requests without auth header · Zod validates body | P0 |
| BE-02 | Patient upsert (find-or-create by phone) in same DB transaction as appointment INSERT | P0 |
| BE-03 | `booking_source` ENUM stored on every appointment | P0 |
| BE-04 | 409 returned when slot already taken (within same transaction check) | P0 |
| BE-05 | `closeAppointment()` steps 1–6 atomic in one Knex transaction | P0 |
| BE-06 | Invoice number atomic via `INSERT ON DUPLICATE KEY UPDATE` + `SELECT FOR UPDATE` | P0 |
| BE-07 | All WA dispatch goes through Bull queue — no synchronous Meta API calls | P0 |
| BE-08 | `bull_job_id` stored in `recall_schedules` and `wa_logs` immediately after `queue.add()` | P0 |
| BE-09 | `wa.worker.js` checks `patient.is_paediatric` before every Meta API call | P0 |
| BE-10 | Implant Step 2 API returns 400 with `days_remaining` before `healing_window_end` | P0 |
| BE-11 | Healing window = Step 1 completion date + 90 days | P0 |
| BE-12 | Recall jobs created per `RECALL_MAP` on `closeAppointment()` | P0 |
| BE-13 | Recall cancellation removes Bull job from Redis queue | P0 |
| BE-14 | PDFKit generates invoice PDF in-process · uploads to S3 with AES-256 | P0 |
| BE-15 | Presigned URLs have 15-min TTL | P0 |
| BE-16 | CORS allows `BOOKING_FORM_URL` and `ADMIN_URL` only | P0 |
| BE-17 | JWT access token 8h · refresh token 7d · httpOnly Set-Cookie | P0 |
| BE-18 | Redis AOF enabled · maxmemory 256mb · bind 127.0.0.1 | P0 |
| BE-19 | PM2 6 processes defined in `ecosystem.config.js` | P0 |
| BE-20 | node-cron UTC expressions for all IST-timed jobs | P0 |
| BE-21 | GST threshold flag updated daily · `REGISTRATION_REQUIRED` at Rs. 20L | P1 |
| BE-22 | Monthly PDF report generated + SES emailed to doctor | P1 |
| BE-23 | CloudWatch custom metrics published on Bull failures and app errors | P1 |
| BE-24 | All DB access through Knex repositories only — no raw SQL in services | P0 |

---

## 15. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-BE-01 | API response time (p95) | < 300ms for all GET endpoints |
| NFR-BE-02 | `POST /appointments` response time | < 500ms (includes DB transaction) |
| NFR-BE-03 | PDF generation time | < 10s (async — patient doesn't wait) |
| NFR-BE-04 | WA delivery after booking | < 30s end-to-end (Bull queue + Meta API) |
| NFR-BE-05 | Uptime | 99.5% monthly |
| NFR-BE-06 | Concurrent users | EC2 t3.small + 2 PM2 workers handles 50 concurrent requests |
| NFR-BE-07 | Job durability | All Bull jobs survive PM2 restart (Redis AOF) |
| NFR-BE-08 | No secrets on disk | `DB_PASS` from Secrets Manager · no `.pem` keys (SSM access) |
| NFR-BE-09 | Input validation | Every route uses Zod schema via `validate.middleware.js` |
| NFR-BE-10 | Error logging | All uncaught errors logged with stack trace + URL |

---

## 16. Infrastructure & Deployment

### EC2 setup summary

```bash
# Node.js 20 via nodesource
# PM2 global
# Redis 7 (localhost only, appendonly yes)
# Nginx (reverse proxy → localhost:3000)
# SSM Agent (access via SSM — port 22 closed in security group)
# CloudWatch agent
```

### Deploy (via SSM send-command)

```bash
cd /home/ubuntu/sharayu-backend
git pull origin main
npm ci --production
npx knex --knexfile knexfile.js migrate:latest
pm2 reload ecosystem.config.js --update-env
pm2 save
```

### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy-backend.yml
on:
  push:
    branches: [main]
steps:
  - uses: actions/checkout@v4
  - run: npm ci && npm test --if-present
  - uses: aws-actions/configure-aws-credentials@v4
    with: { role-to-assume: ${{ secrets.AWS_ROLE_ARN }}, aws-region: ap-south-1 }
  - run: |
      aws ssm send-command \
        --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=[
          "cd /home/ubuntu/sharayu-backend && git pull origin main",
          "npm ci --production",
          "npx knex --knexfile knexfile.js migrate:latest",
          "pm2 reload ecosystem.config.js --update-env && pm2 save"
        ]'
```

---

## 17. Phased Delivery

### Phase 1 — Weeks 1–3 (Foundation)

DB schema · Knex migrations · Auth (login/refresh/logout) · Patient CRUD · Appointment CRUD · Slot availability

### Phase 2 — Weeks 4–6 (Booking + Queues)

`POST /appointments` public endpoint with patient upsert · Bull queues setup · Redis config · WA booking confirmation worker · Day-before reminder worker

### Phase 3 — Weeks 7–9 (Invoicing + PDF)

Close appointment chain · Invoice creation · PDFKit engine · S3 upload · Invoice WA worker · GST classification

### Phase 4 — Weeks 10–12 (Cases + Recalls)

Treatment cases + steps · Healing window guard · Recall scheduling engine · Recall workers · Recall cancellation

### Phase 5 — Weeks 13–14 (Dashboard + Cron)

All dashboard endpoints · node-cron jobs · GST threshold check · Monthly report · CloudWatch metrics

---

## 18. Environment Variables

```bash
# Runtime
NODE_ENV=production
PORT=3000

# CORS — both separate frontend origins
BOOKING_FORM_URL=https://book.sharayudental.com
ADMIN_URL=https://admin.sharayudental.com

# Database (RDS — private subnet)
DB_HOST=<rds-endpoint>.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=sharayu_app
DB_PASS=<from-aws-secrets-manager>
DB_NAME=sharayu_dental

# Redis (EC2 localhost only)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auth
ACCESS_SECRET=<64-char-random-hex>
REFRESH_SECRET=<64-char-random-hex>
ACCESS_EXPIRY=8h
REFRESH_EXPIRY=7d

# AWS (no keys — EC2 instance profile handles credentials)
AWS_REGION=ap-south-1
S3_BUCKET_INVOICES=sharayu-invoices
S3_BUCKET_XRAYS=sharayu-xrays
S3_BUCKET_ASSETS=sharayu-assets

# SES
SES_FROM_EMAIL=noreply@sharayudental.com
SES_DOCTOR_EMAIL=doctor@sharayudental.com

# WhatsApp (Meta BSP)
WA_PHONE_NUMBER_ID=<meta-waba-phone-number-id>
WA_ACCESS_TOKEN=<meta-permanent-token>
WA_APP_SECRET=<meta-app-secret>
WA_WEBHOOK_VERIFY_TOKEN=<random-32-char-string>

# Clinic
CLINIC_NAME=Sharayu Dental Clinic
CLINIC_ADDRESS=<full address>
CLINIC_PHONE=+91XXXXXXXXXX
CLINIC_GSTIN=<if registered>
```

---

## 19. Testing Checklist

```
Auth
[ ] POST /auth/login → access_token + refresh_token returned
[ ] POST /auth/refresh → new access_token
[ ] Expired access_token → 401
[ ] Wrong role → 403

Public Booking
[ ] POST /appointments without Authorization header → 200
[ ] booking_source=whatsapp stored on appointment row
[ ] New patient created when phone not found (upsert INSERT)
[ ] Existing patient_id reused when phone already in DB
[ ] 409 returned when slot already booked
[ ] Bull waQueue job created after successful booking
[ ] WA confirmation received on patient phone within 30s

Paediatric routing
[ ] WA sent to parent_phone when is_paediatric=true
[ ] WA shows parent_name in template params

Close appointment chain
[ ] POST /appointments/:id/complete → invoice row in DB (pdf_s3_key=NULL)
[ ] pdfQueue job visible in Redis
[ ] PDF uploaded to S3 within 60s
[ ] invoices.pdf_s3_key updated after PDF generation
[ ] invoice_ready WA received on patient phone
[ ] post_care WA received (service-specific template)
[ ] Recall Bull jobs created with correct delays

Healing window (implant)
[ ] PUT /cases/:id/steps/2 → 400 before healing_window_end
[ ] Response body includes days_remaining and healing_window_end
[ ] PUT /cases/:id/steps/2 → 200 after healing_window_end
[ ] healing_window_end = Step 1 completion + 90 days

Recall engine
[ ] bull_job_id stored in recall_schedules immediately after queue.add()
[ ] PUT /recalls/:id/cancel → job removed from Redis
[ ] GET /recalls/due → returns overdue recalls only when overdue_only=true

Invoice + GST
[ ] SVC-01 → invoice_type=exempt · gst_rate=0 · no GST rows in PDF
[ ] Whitening → invoice_type=gst · gst_rate=18 · service_code=999722
[ ] invoice_number sequential (INV-2026-0001, 0002…) — no gaps or duplicates
[ ] Concurrent close: two simultaneous invoice creates don't get same sequence number

Bull durability
[ ] pm2 stop all → redis-cli ZCARD bull:recall:delayed shows pending jobs
[ ] pm2 start ecosystem.config.js → workers resume processing jobs

CORS
[ ] POST /appointments from book.sharayudental.com → no CORS error
[ ] POST /auth/login from admin.sharayudental.com → no CORS error
[ ] Request from unknown origin → CORS error

Security
[ ] Port 22 not reachable (security group check)
[ ] .env file not in git history (check .gitignore)
[ ] DB_PASS comes from Secrets Manager (not hardcoded)
```

---

*Backend PRD v2.1 — Sharayu Dental Clinic · April 2026 · Akib Tamboli*  
*Repo: `sharayu-backend/` · Stack: Node.js 20 · Express 4 · MySQL 8 · Redis 7 · Bull · PDFKit*  
*Key v2.1: `POST /appointments` public · patient upsert · booking_source · two-repo CORS*
