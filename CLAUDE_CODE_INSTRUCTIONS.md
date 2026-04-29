# Claude Code — Instructions & Context

**Project:** Sharayu Dental Clinic Portal & Practice Management System  
**Developer:** Akib Tamboli — Solutions Architect  
**Architecture:** Full Server — Node.js 20 on EC2 Ubuntu 22.04  
**PRD versions:** Backend v2.1 · Frontend v3.0  
**Hosting:** Frontend and Backend are **two separate repositories, separately hosted**

> Read this file completely before writing any code. Every section matters.

---

## 1. What This Project Is

A dental practice management system split into two independent deployments:

### `sharayu-frontend/` repo — Two Angular apps

**`booking-form/`** — Single Angular app (no routing module). Accessible via:
- WhatsApp "Book Now" link: `https://book.sharayudental.com?service=SVC-01&ref=whatsapp`
- Clinic website CTA button: `https://book.sharayudental.com?ref=website`

**`admin/`** — Angular SPA for doctor and receptionist. Login required. Desktop-optimised.  
URL: `https://admin.sharayudental.com`

Both apps are static builds deployed to **S3 + CloudFront**.  
Both call the same backend API at `https://api.sharayudental.com/v1`.  
Neither app talks directly to the database or handles any server-side logic.

### `sharayu-backend/` repo — Node.js API server

Single Node.js 20 monolith on EC2. Handles all API, PDF generation, WA dispatch, Bull queues, cron jobs.  
URL: `https://api.sharayudental.com/v1`

---

## 2. Two-Repo Separation — What This Means

| Concern | Frontend repo | Backend repo |
|---------|--------------|--------------|
| Language | Angular 17+ TypeScript | Node.js 20 + Express |
| Hosting | S3 + CloudFront (static) | EC2 t3.small (server) |
| BMAD install | `.bmad-core/` in `sharayu-frontend/` | `.bmad-core/` in `sharayu-backend/` |
| Claude Code session | Open inside `sharayu-frontend/` | Open inside `sharayu-backend/` |
| CI/CD | GitHub Actions → S3 sync | GitHub Actions → PM2 reload |
| `.env` | `booking-form/.env` + `admin/.env` | `backend/.env` |
| Deploys | Fully independent | Fully independent |
| Database | Never touches DB directly | Knex.js + RDS MySQL |
| Auth tokens | sessionStorage (admin) | JWT issued by this server |

**Important for Claude Code:** When you open Claude Code inside `sharayu-frontend/`, you only see frontend code. When you open it inside `sharayu-backend/`, you only see backend code. Do not assume files from the other repo are present.

---

## 3. Absolute Rules — Never Break These

**1. `POST /appointments` is public — no Bearer token.**  
The booking form has no auth. This endpoint must work without an `Authorization` header. Zod validates the body. Patient is upserted (find-or-create by phone) inside the transaction.

**2. Patient upsert by phone — not by ID from booking form.**  
The booking form sends `{ patient: { name, phone, email }, ...appointmentFields }`. The backend calls `upsertPatient()` to find-or-create before inserting the appointment. Never require the booking form to know a `patient_id` in advance.

**3. `booking_source` must be stored.**  
Every appointment has `booking_source` ENUM: `whatsapp | website | direct | staff`. The booking form sends it from `?ref=` URL param. Admin-created appointments default to `staff`.

**4. All async jobs go through Bull queue.**  
Never `setTimeout` for WA dispatch. Never `setInterval` for recalls. If something needs to happen later, it goes into Bull with a delay. This survives a PM2 restart.

**5. `bull_job_id` must be stored immediately after job creation.**  
After any `recallQueue.add()` or `waQueue.add()`, store `job.id` in `recall_schedules.bull_job_id` or `wa_logs.bull_job_id` before returning. This is how cancellation works.

**6. Paediatric flag checked in every WA dispatch — no exceptions.**  
In every Bull WA worker, before calling Meta API, check `patient.is_paediatric`. If true, route to `patient.parent_phone` and use `patient.parent_name`. Never skip this check.

**7. Healing window guard is an API-level check.**  
`PUT /cases/:id/steps/2` for implant cases must check `healing_window_end` in the service layer. Return `400 { error, healing_window_end, days_remaining }` if not yet complete.

**8. Invoice number is atomic — inside the DB transaction.**  
Format: `INV-{YYYY}-{NNNN}`. Use `INSERT INTO invoice_sequence ... ON DUPLICATE KEY UPDATE` + `SELECT FOR UPDATE` inside the same Knex transaction as the invoice INSERT.

**9. No routing module in booking-form.**  
`booking-form` has `--routing=false`. `AppModule` imports `BookingFormModule` only. There is no `RouterModule`, no `<router-outlet>`. All section state lives in `BookingFormComponent` as class properties.

**10. No NgRx or state management library in booking-form.**  
Slot fetching uses Angular `HttpClient` inside a service, subscribed in `SlotGridComponent.ngOnChanges()`. Do not install NgRx, Akita, or any external state library in booking-form. Component class properties are sufficient.

**11. No sensitive data in localStorage.**  
Admin access tokens stored via `sessionStorage.setItem('access_token', ...)` in `AuthService`. Refresh tokens come from httpOnly cookie set by the backend. Never `localStorage.setItem('token', ...)`.

**12. Port 22 closed — SSM only.**  
No SSH inbound rules anywhere. All EC2 shell access via SSM Session Manager.

---

## 4. Repository Structures

### `sharayu-frontend/` — Frontend Repo

```
sharayu-frontend/
├── .bmad-core/                     # BMAD installed here
├── .claude/skills/                 # Claude Code skills
├── _bmad/
├── docs/                           # PRD_FRONTEND_v3.md · SKILLS_FRONTEND.md
│
├── projects/
│   ├── booking-form/               # Angular app — no routing module
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app/
│   │       │   ├── app.module.ts   # Bootstraps BookingFormModule, no RouterModule
│   │       │   ├── app.component.ts  # <app-booking-form> only
│   │       │   ├── booking-form/
│   │       │   │   ├── booking-form.module.ts
│   │       │   │   ├── booking-form.component.ts  # ALL state here
│   │       │   │   ├── booking-form.component.html
│   │       │   │   ├── service-dropdown/
│   │       │   │   ├── date-strip/
│   │       │   │   ├── slot-grid/         # ngOnChanges → HttpClient
│   │       │   │   ├── patient-details/   # phone lookup + auto-fill
│   │       │   │   ├── intake-section/    # routes to 7 sub-form components
│   │       │   │   ├── intake/
│   │       │   │   │   ├── prophylaxis-intake/
│   │       │   │   │   ├── restoration-intake/
│   │       │   │   │   ├── rct-intake/
│   │       │   │   │   ├── extraction-intake/
│   │       │   │   │   ├── orthodontics-intake/
│   │       │   │   │   ├── implant-intake/
│   │       │   │   │   └── pulpectomy-intake/
│   │       │   │   ├── confirmation-card/
│   │       │   │   └── shared-ui/
│   │       │   └── services/
│   │       │       └── booking.service.ts  # HttpClient, no auth header
│   │       └── environments/
│   │           ├── environment.ts
│   │           └── environment.production.ts
│   │
│   └── admin/                      # Angular app — lazy-loaded routing
│       └── src/
│           ├── main.ts
│           ├── app/
│           │   ├── app.module.ts
│           │   ├── app-routing.module.ts  # AuthGuard on all routes
│           │   ├── app.component.ts
│           │   ├── guards/
│           │   │   └── auth.guard.ts
│           │   ├── interceptors/
│           │   │   └── auth.interceptor.ts  # Bearer token + 401 refresh
│           │   ├── layout/
│           │   │   └── layout.module.ts  # sidebar + topbar + router-outlet
│           │   ├── pages/             # each page is a lazy-loaded module
│           │   │   ├── login/
│           │   │   ├── schedule/      # auto-refresh every 60s
│           │   │   ├── patients/
│           │   │   ├── patient-profile/
│           │   │   ├── case-detail/   # healing window banner
│           │   │   ├── invoices/
│           │   │   ├── recalls/
│           │   │   └── analytics/     # ng2-charts
│           │   └── services/
│           │       ├── auth.service.ts
│           │       ├── appointments.service.ts
│           │       ├── patients.service.ts
│           │       ├── cases.service.ts
│           │       ├── invoices.service.ts
│           │       ├── recalls.service.ts
│           │       └── dashboard.service.ts
│           └── environments/
│               ├── environment.ts
│               └── environment.production.ts
│
├── angular.json                    # workspace config for both apps
├── tsconfig.json
├── tsconfig.app.json
└── package.json                    # single package.json for workspace
│
└── .github/
    └── workflows/
        ├── deploy-booking-form.yml  # push to main → build → S3 booking/
        └── deploy-admin.yml         # push to main → build → S3 admin/
```

### `sharayu-backend/` — Backend Repo

```
sharayu-backend/
├── .bmad-core/                     # BMAD installed here — separate from frontend
├── .claude/skills/
├── _bmad/
├── docs/                           # PRD_BACKEND_v2.md · SKILLS_BACKEND.md
│
├── src/
│   ├── server.js
│   ├── app.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── patients.routes.js
│   │   ├── appointments.routes.js  # POST is public — no verifyToken
│   │   ├── cases.routes.js
│   │   ├── invoices.routes.js
│   │   ├── recalls.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── webhooks.routes.js
│   │   └── uploads.routes.js
│   ├── controllers/
│   ├── services/
│   │   ├── appointment.service.js  # createAppointment() has upsertPatient()
│   │   ├── case.service.js         # updateStep() has healing window guard
│   │   ├── invoice.service.js
│   │   ├── recall.service.js
│   │   ├── whatsapp.service.js
│   │   ├── pdf.service.js
│   │   └── gst.service.js
│   ├── repositories/
│   ├── queues/
│   │   ├── wa.queue.js
│   │   ├── pdf.queue.js
│   │   └── recall.queue.js
│   ├── workers/
│   │   ├── wa.worker.js            # ALWAYS checks is_paediatric
│   │   ├── pdf.worker.js
│   │   └── recall.worker.js
│   ├── cron/
│   │   ├── reminders.cron.js       # 9AM IST = 03:30 UTC
│   │   ├── gst-check.cron.js       # 8AM IST = 02:30 UTC
│   │   └── reports.cron.js         # midnight IST 1st of month
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── async.middleware.js
│   │   └── error.middleware.js
│   └── lib/
│       ├── knex.js
│       ├── redis.js
│       └── aws.js
│   utils/
│       ├── gst.util.js
│       ├── invoice-number.util.js
│       ├── timezone.util.js
│       └── wa-templates.util.js
│
├── db/
│   ├── migrations/                 # 001–009 run in order
│   └── seeds/                      # 001–007
│
├── ecosystem.config.js
├── knexfile.js
├── .env
├── .env.example
├── package.json
└── .github/
    └── workflows/
        └── deploy-backend.yml      # push to main → SSH → npm ci → pm2 reload
```

---

## 5. EC2 Base Setup (via SSM Session Manager)

```bash
# 1. System update
sudo apt-get update && sudo apt-get upgrade -y

# 2. Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v20.x.x

# 3. PM2
sudo npm install -g pm2
pm2 --version

# 4. Redis 7
sudo apt-get install -y redis-server
sudo tee -a /etc/redis/redis.conf << 'EOF'
appendonly yes
appendfsync everysec
bind 127.0.0.1
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF
sudo systemctl enable redis-server
sudo systemctl restart redis-server
redis-cli ping   # PONG

# 5. Nginx (reverse proxy → PM2 port 3000)
sudo apt-get install -y nginx

# 6. Git + clone backend repo
sudo apt-get install -y git
cd /home/ubuntu
git clone https://github.com/your-org/sharayu-backend.git
cd sharayu-backend

# 7. Dependencies + migrations
npm ci
npx knex --knexfile knexfile.js migrate:latest
npx knex --knexfile knexfile.js seed:run

# 8. Start PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command
```

---

## 6. Environment Variables

### `sharayu-backend/.env`

```bash
# Runtime
NODE_ENV=production
PORT=3000

# CORS — both frontend origins
BOOKING_FORM_URL=https://book.sharayudental.com
ADMIN_URL=https://admin.sharayudental.com

# Database
DB_HOST=<rds-endpoint>.ap-south-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=sharayu_app
DB_PASS=<from-aws-secrets-manager>
DB_NAME=sharayu_dental

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auth
ACCESS_SECRET=<64-char-hex>
REFRESH_SECRET=<64-char-hex>
ACCESS_EXPIRY=8h
REFRESH_EXPIRY=7d

# AWS (no keys — EC2 instance profile)
AWS_REGION=ap-south-1
S3_BUCKET_INVOICES=sharayu-invoices
S3_BUCKET_XRAYS=sharayu-xrays
S3_BUCKET_ASSETS=sharayu-assets

# SES
SES_FROM_EMAIL=noreply@sharayudental.com
SES_DOCTOR_EMAIL=doctor@sharayudental.com

# WhatsApp
WA_PHONE_NUMBER_ID=<meta-phone-number-id>
WA_ACCESS_TOKEN=<meta-permanent-token>
WA_APP_SECRET=<meta-app-secret>
WA_WEBHOOK_VERIFY_TOKEN=<random-32-chars>

# Clinic
CLINIC_NAME=Sharayu Dental Clinic
CLINIC_ADDRESS=<full address>
CLINIC_PHONE=+91XXXXXXXXXX
CLINIC_GSTIN=<if registered>
```

### `sharayu-frontend/projects/booking-form/src/environments/environment.production.ts`

```typescript
export const environment = {
  production:  true,
  apiUrl:      'https://api.sharayudental.com/v1',
  clinicPhone: '+91XXXXXXXXXX',
};
```

### `sharayu-frontend/projects/admin/src/environments/environment.production.ts`

```typescript
export const environment = {
  production: true,
  apiUrl:     'https://api.sharayudental.com/v1',
  clinicName: 'Sharayu Dental Clinic',
};
```

---

## 7. Critical Implementation Flows

### Flow A — Public Booking (booking-form → backend)

```
1. Patient opens https://book.sharayudental.com?service=SVC-03&ref=whatsapp
2. ServiceDropdown reads ?service= → pre-selects SVC-03
3. DateStrip shows next 14 days → patient picks date
4. SlotGrid: ngOnChanges → GET /appointments/slots (public, no auth)
5. Patient picks slot → PatientDetails appears
6. Phone blur → GET /patients?search=phone
   → found: auto-fill name+email, "Welcome back" banner
   → not found: blank fields
7. Patient fills details → IntakeSection appears (RCT sub-form)
8. Intake complete → Submit button appears
9. POST /appointments (NO auth header) {
     service_id, chair_id, scheduled_at,
     booking_source: "whatsapp",
     patient: { name, phone, email },
     intake_data: { ... }
   }
10. Backend: Zod validate → BEGIN TXN → upsertPatient(phone)
    → slot conflict check → INSERT appointment → COMMIT
    → waQueue.add(booking_confirmation)
    → waQueue.add(day_before_reminder, { delay: msUntil9AmIST })
11. 200 → booking-form: ConfirmationCard shown
12. Bull WA worker: is_paediatric? → route phone → Meta API
13. Patient receives WA
```

### Flow B — Appointment Close Chain

```
1. Receptionist: "Close Appointment" in admin dashboard
2. POST /appointments/:id/complete (Bearer required)
3. appointment.service.closeAppointment():
   a. BEGIN TXN
   b. UPDATE appointments status='done'
   c. getNextInvoiceNumber(trx) — atomic sequence
   d. classifyGST(service_id)
   e. INSERT invoices (pdf_s3_key=NULL)
   f. COMMIT
   g. pdfQueue.add('generate_invoice', { invoiceId })
   h. recallService.createRecallJobs(...)
4. pdf.worker: PDFKit → S3 PutObject → UPDATE invoices.pdf_s3_key
5. On PDF complete: waQueue.add(invoice_ready) + waQueue.add(post_care)
6. wa.worker: check is_paediatric → getPresignedUrl(15min) → Meta API
7. Meta webhook → POST /webhooks/whatsapp → UPDATE wa_logs.status
```

### Flow C — Recall Cancellation

```
1. PUT /recalls/:id/cancel (Bearer)
2. GET recall_schedules WHERE id = recallId
3. IF bull_job_id: recallQueue.getJob(bull_job_id).then(j => j.remove())
4. UPDATE recall_schedules SET status='cancelled'
```

---

## 8. Database Migration Run Order

```bash
# Always from inside sharayu-backend/
npx knex migrate:latest

# Runs in this exact order (FK dependencies):
001_create_users.js
002_create_patients.js         # + invoice_sequence table
003_create_appointments.js     # + booking_source ENUM column
004_create_treatment_cases.js
005_create_treatment_steps.js
006_create_invoices.js
007_create_recall_schedules.js # bull_job_id column (NOT eventbridge_rule_id)
008_create_wa_logs.js          # bull_job_id column
009_create_audit_log.js
```

---

## 9. CI/CD Pipelines (GitHub Actions)

### Frontend — `sharayu-frontend/.github/workflows/deploy-booking-form.yml`

```yaml
name: Deploy booking-form
on:
  push:
    branches: [main]
    paths: ['booking-form/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: booking-form/package-lock.json }
      - run: npm ci
      - run: npx ng build booking-form --configuration=production
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-south-1
      - run: |
          aws s3 sync dist/booking-form/ s3://sharayu-assets/booking/ --delete \
            --cache-control "max-age=31536000,immutable" --exclude "index.html"
          aws s3 cp dist/booking-form/index.html s3://sharayu-assets/booking/index.html \
            --cache-control "no-cache"
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.BOOKING_CF_ID }} --paths "/*"
```

### Frontend — `sharayu-frontend/.github/workflows/deploy-admin.yml`

```yaml
name: Deploy admin
on:
  push:
    branches: [main]
    paths: ['admin/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: admin/package-lock.json }
      - run: npm ci
      - run: npx ng build admin --configuration=production
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-south-1
      - run: |
          aws s3 sync dist/admin/ s3://sharayu-assets/admin/ --delete \
            --cache-control "max-age=31536000,immutable" --exclude "index.html"
          aws s3 cp dist/admin/index.html s3://sharayu-assets/admin/index.html \
            --cache-control "no-cache"
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.ADMIN_CF_ID }} --paths "/*"
```

### Backend — `sharayu-backend/.github/workflows/deploy-backend.yml`

```yaml
name: Deploy backend
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test --if-present
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-south-1
      - name: Deploy via SSM
        run: |
          aws ssm send-command \
            --instance-ids ${{ secrets.EC2_INSTANCE_ID }} \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "cd /home/ubuntu/sharayu-backend",
              "git pull origin main",
              "npm ci --production",
              "npx knex --knexfile knexfile.js migrate:latest",
              "pm2 reload ecosystem.config.js --update-env",
              "pm2 save"
            ]'
```

---

## 10. Manual Deploy Commands (via SSM when needed)

```bash
# ── Backend (on EC2 via SSM) ──────────────────────────────────────────
cd /home/ubuntu/sharayu-backend
git pull origin main
npm ci --production
npx knex --knexfile knexfile.js migrate:latest
pm2 reload ecosystem.config.js --update-env
pm2 logs api --lines 20 --nostream
pm2 status

# ── Frontend (from your local machine or CI runner) ───────────────────
# booking-form
cd sharayu-frontend
npm ci
ng build booking-form --configuration=production
aws s3 sync dist/booking-form/ s3://sharayu-assets/booking/ --delete \
  --cache-control "max-age=31536000,immutable" --exclude "index.html"
aws s3 cp dist/booking-form/index.html s3://sharayu-assets/booking/index.html \
  --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id $BOOKING_CF_ID --paths "/*"

# admin
ng build admin --configuration=production
aws s3 sync dist/admin/ s3://sharayu-assets/admin/ --delete \
  --cache-control "max-age=31536000,immutable" --exclude "index.html"
aws s3 cp dist/admin/index.html s3://sharayu-assets/admin/index.html \
  --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id $ADMIN_CF_ID --paths "/*"
```

---

## 11. GitHub Secrets Required

### `sharayu-frontend` repo secrets

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC-based S3/CloudFront access |
| `BOOKING_API_URL` | Used in environment.production.ts at build time |
| `ADMIN_API_URL` | Used in environment.production.ts at build time |
| `BOOKING_CF_ID` | CloudFront distribution ID for booking-form |
| `ADMIN_CF_ID` | CloudFront distribution ID for admin |

### `sharayu-backend` repo secrets

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | IAM role ARN for SSM send-command |
| `EC2_INSTANCE_ID` | `i-0xxxxxxxxxxxxxxxxx` |

---

## 12. CloudWatch Alarms to Create

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| CPU high | CPUUtilization | > 80% for 5 min |
| Memory high | mem_used_percent | > 85% |
| RDS storage | FreeStorageSpace | < 2GB |
| Bull failures | BullFailedJobs (custom) | > 0 |
| App errors | AppErrorCount (custom) | > 10/5min |

---

## 13. BMAD Setup — Two Separate Installs

```bash
# Frontend repo — open terminal inside sharayu-frontend/
cd sharayu-frontend
npx bmad-method install
# Choose: current directory · Claude Code · ui (Angular frontend)

# Backend repo — open terminal inside sharayu-backend/
cd sharayu-backend
npx bmad-method install
# Choose: current directory · Claude Code · service (backend/API)

# Each repo has its own:
# .bmad-core/   — BMAD agents and workflows
# .claude/      — Claude Code skills
# _bmad/        — BMAD state
# docs/         — PRD and skills markdown files
```

**When using Claude Code:**
- For frontend work: open Claude Code at `sharayu-frontend/` root
- For backend work: open Claude Code at `sharayu-backend/` root
- Never open Claude Code at a parent folder that contains both repos — BMAD will conflict

---

## 14. Testing Checklist

```
Auth
[ ] POST /auth/login returns access_token + refresh_token
[ ] POST /auth/refresh returns new access_token
[ ] Expired access_token returns 401
[ ] Wrong role returns 403

Public Booking (booking-form → backend)
[ ] POST /appointments without Authorization header succeeds (200)
[ ] booking_source=whatsapp stored on appointment row
[ ] New patient created in DB when phone not found (upsert)
[ ] Existing patient reused when phone already in DB
[ ] 409 returned when slot already taken
[ ] WA confirmation received on patient phone

Paediatric routing
[ ] Booking for is_paediatric patient → WA sent to parent_phone only
[ ] Confirmation WA shows parent_name not child name

Close appointment chain
[ ] POST /complete creates invoice row
[ ] pdfQueue job in Redis
[ ] PDF in S3 within 60s
[ ] Invoice WA + post-care WA received
[ ] Recall Bull job with correct delay created

Healing window (implant)
[ ] PUT /cases/:id/steps/2 returns 400 before healing_window_end
[ ] Response includes days_remaining
[ ] Returns 200 after healing_window_end passes

Recall
[ ] bull_job_id stored in recall_schedules
[ ] PUT /recalls/:id/cancel removes job from Redis
[ ] GET /recalls/due returns overdue recalls

Invoice + GST
[ ] SVC-01: invoice_type=exempt, gst_rate=0
[ ] SVC-WHITENING: invoice_type=gst, gst_rate=18, service_code=999722
[ ] invoice_number sequential, no duplicates under concurrent load

Bull durability
[ ] Stop PM2 → jobs still in Redis (redis-cli ZCARD bull:recall:delayed)
[ ] Start PM2 → workers resume processing

booking-form UI
[ ] ?service=SVC-03 pre-selects RCT
[ ] ?ref=whatsapp captured in POST body
[ ] Sections reveal in order
[ ] 409 → scroll to slot grid, clear slot, show error
[ ] ConfirmationCard "Book Another" resets all state

CORS
[ ] POST /appointments called from book.sharayudental.com succeeds
[ ] POST /auth/login called from admin.sharayudental.com succeeds
[ ] Request from unlisted origin returns CORS error
```

---

## 15. Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Adding Bearer middleware to `POST /appointments` | This endpoint is **public** — no auth |
| Requiring `patient_id` in booking form body | Booking form sends `patient: { name, phone, email }` — backend upserts |
| Forgetting `booking_source` column in appointments migration | `ENUM('whatsapp','website','direct','staff') DEFAULT 'staff'` |
| Using `setTimeout` for WA dispatch | Always `waQueue.add()` |
| Using `localStorage` for access tokens | `sessionStorage` only |
| Adding `RouterModule` to booking-form AppModule | No routing in booking-form — `--routing=false` |
| Installing NgRx in booking-form | Plain `HttpClient` subscription in component — no state library |
| Invoice number outside DB transaction | Must be inside `knex.transaction()` with `FOR UPDATE` |
| Missing `is_paediatric` check in WA worker | Always check before Meta API call |
| Using `eventbridge_rule_id` column | Column is `bull_job_id` |
| Opening port 22 | SSM Session Manager only |
| Running `npx bmad-method install` at parent folder | Install inside each repo root separately |
| Opening Claude Code at parent of both repos | Open at `sharayu-frontend/` OR `sharayu-backend/` — never the parent |
| Sharing `.env` between repos | Each repo has its own `.env` — no crossover |
| Deploying both from one CI pipeline | Each repo has its own GitHub Actions workflows |

---

*Claude Code instructions — Sharayu Dental Clinic · Backend v2.1 · Frontend v3.0 · April 2026*  
*Two separate repos: sharayu-frontend/ (Angular, S3+CloudFront) · sharayu-backend/ (Node.js, EC2+PM2)*
