# Sharayu Dental Clinic — Frontend PRD

**Version:** 4.0  
**Date:** April 2026  
**Author:** Akib Tamboli — Solutions Architect  
**Repo:** `sharayu-frontend/` — separately hosted from `sharayu-backend/`  
**Stack:** Angular 17+ · TypeScript · RxJS · Angular Material · date-fns · ng2-charts  
**Hosting:** AWS S3 + CloudFront (static build)  
**Companion docs:** `PRD_BACKEND.md` · `SKILLS_FRONTEND.md` · `CLAUDE_CODE_INSTRUCTIONS.md`

---

## Changelog

| Version | Summary |
|---------|---------|
| v1.0 | Full multi-page patient portal (Home → Service → Slot → Patient → Intake → Confirm) |
| v2.0 | Portal replaced by single booking-form page · Admin unchanged · React/Vite stack |
| v3.0 | No-router booking-form · WA / website CTA entry · Separate frontend/backend repos |
| **v4.0** | **Full migration to Angular 17+ TypeScript · Single Angular workspace · two apps · `--routing=false` on booking-form · lazy-loaded admin modules · HttpClient replaces axios · ReactiveFormsModule replaces React Hook Form** |

---

## Table of Contents

1. [Frontend Overview](#1-frontend-overview)
2. [Angular Workspace Architecture](#2-angular-workspace-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Workspace Folder Structure](#4-workspace-folder-structure)
5. [Booking Form App — Full Spec](#5-booking-form-app--full-spec)
6. [Admin Dashboard — All Screens](#6-admin-dashboard--all-screens)
7. [Angular Module Design](#7-angular-module-design)
8. [API Integration Layer](#8-api-integration-layer)
9. [State & Forms](#9-state--forms)
10. [File Upload — X-rays & CBCT](#10-file-upload--x-rays--cbct)
11. [Charts & Analytics](#11-charts--analytics)
12. [Shared Design System](#12-shared-design-system)
13. [Functional Requirements](#13-functional-requirements)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Phased Delivery](#15-phased-delivery)
16. [Build & Deploy](#16-build--deploy)
17. [Accessibility & Mobile Rules](#17-accessibility--mobile-rules)

---

## 1. Frontend Overview

The frontend is one **Angular workspace** (`sharayu-frontend/`) containing two Angular apps, both statically built and served from S3 + CloudFront. Neither app has server-side logic. Both call the REST API at `https://api.sharayudental.com/v1`.

| App | Audience | Device | URL |
|-----|----------|--------|-----|
| `booking-form` | Patients | Mobile-first · 390px | `https://book.sharayudental.com` |
| `admin` | Doctor + Receptionist | Desktop · 1280px+ | `https://admin.sharayudental.com` |

### How patients reach the booking form

```
WhatsApp message (recall / confirmation / broadcast)
  → "Book Now" link
  → https://book.sharayudental.com?service=SVC-01&ref=whatsapp

Clinic website CTA button
  → https://book.sharayudental.com?service=SVC-02&ref=website

Patient types URL directly
  → https://book.sharayudental.com          (no params — dropdown starts empty)
```

`?service=SVC-xx` pre-selects the service dropdown on load. `?ref=` is read and sent to the backend as `booking_source` for analytics. Both params are optional.

---

## 2. Angular Workspace Architecture

```
sharayu-frontend/                  ← git root · BMAD installed here
├── angular.json                   ← workspace config — both apps defined here
├── tsconfig.json                  ← strict mode on
├── package.json                   ← single package.json for entire workspace
├── projects/
│   ├── booking-form/              ← patient app · --routing=false
│   └── admin/                     ← staff app · --routing=true · lazy modules
├── .bmad-core/
├── .claude/skills/
├── docs/
│   └── PRD_FRONTEND.md
└── .github/workflows/
    ├── deploy-booking-form.yml    ← triggers on projects/booking-form/** changes
    └── deploy-admin.yml           ← triggers on projects/admin/** changes
```

### Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| Single workspace, two apps | One `node_modules`, shared tooling, independent builds |
| `booking-form --routing=false` | Single page · no router overhead · all state in one component |
| `admin --routing=true` with `loadChildren` | Every page lazy-loaded → faster initial load |
| No NgRx in either app | Service + `subscribe()` is sufficient for this scale |
| No shared library in v1 | Acceptable duplication avoids premature abstraction |
| Angular `HttpClient` throughout | No axios · consistent with Angular DI · interceptors work automatically |
| `ReactiveFormsModule` for all forms | Type-safe · `Validators.requiredTrue` for consent · `patchValue` for auto-fill |
| `@angular/animations` for section reveal | No JS toggle logic — declarative state machine |

---

## 3. Tech Stack

### Both apps

| Package | Version | Purpose |
|---------|---------|---------|
| `@angular/core` | ^17 | Framework |
| `@angular/common` | ^17 | `CommonModule`, `AsyncPipe`, directives |
| `@angular/forms` | ^17 | `ReactiveFormsModule`, `FormBuilder`, `Validators` |
| `@angular/common/http` | ^17 | `HttpClient` — replaces axios entirely |
| `@angular/platform-browser` | ^17 | `BrowserModule`, `BrowserAnimationsModule` |
| `@angular/cdk` | ^17 | Portal, overlay (Angular Material dep) |
| `@angular/material` | ^17 | Form fields · buttons · dialogs · spinners · tables · snack bar |
| `@angular/animations` | ^17 | `sectionReveal` trigger for booking-form |
| `date-fns` | ^3.6 | Date arithmetic — `addDays`, `format`, `differenceInDays` |
| `date-fns-tz` | ^3.1 | IST formatting — `formatInTimeZone('Asia/Kolkata', ...)` |
| `rxjs` | ^7.8 | `Observable`, `interval`, `switchMap`, `BehaviorSubject` |

### Admin app only

| Package | Version | Purpose |
|---------|---------|---------|
| `ng2-charts` | ^6 | Angular wrapper for Chart.js |
| `chart.js` | ^4 | Revenue bar + no-show line charts |

### Not in this stack

React · Vite · Tailwind · TanStack Query · NgRx · Akita · React Hook Form · Zod · Recharts · Radix UI · axios · Redux

---

## 4. Workspace Folder Structure

```
sharayu-frontend/
├── angular.json
├── tsconfig.json
├── package.json
│
└── projects/
    │
    ├── booking-form/
    │   └── src/
    │       ├── index.html
    │       ├── main.ts
    │       ├── styles.scss
    │       ├── assets/
    │       │   └── clinic-logo.png
    │       ├── environments/
    │       │   ├── environment.ts               # apiUrl: localhost:3000/v1
    │       │   └── environment.production.ts    # apiUrl: api.sharayudental.com/v1
    │       └── app/
    │           ├── app.module.ts                # Bootstrap — no RouterModule
    │           ├── app.component.ts             # <app-booking-form> only
    │           │
    │           ├── services/
    │           │   └── booking.service.ts       # HttpClient · no auth header
    │           │
    │           └── booking-form/
    │               ├── booking-form.module.ts
    │               ├── booking-form.component.ts       # ALL state here
    │               ├── booking-form.component.html
    │               ├── booking-form.component.scss
    │               │
    │               ├── service-dropdown/
    │               │   └── service-dropdown.component.ts
    │               ├── date-strip/
    │               │   └── date-strip.component.ts
    │               ├── slot-grid/
    │               │   └── slot-grid.component.ts      # ngOnChanges → HttpClient
    │               ├── patient-details/
    │               │   └── patient-details.component.ts  # phone lookup + patchValue
    │               ├── intake-section/
    │               │   ├── intake-section.component.ts   # *ngIf per service
    │               │   └── intake/
    │               │       ├── prophylaxis-intake.component.ts
    │               │       ├── restoration-intake.component.ts
    │               │       ├── rct-intake.component.ts
    │               │       ├── extraction-intake.component.ts    # consent + blood thinner
    │               │       ├── orthodontics-intake.component.ts
    │               │       ├── implant-intake.component.ts       # CBCT + consent
    │               │       └── pulpectomy-intake.component.ts    # parent fields
    │               ├── confirmation-card/
    │               │   └── confirmation-card.component.ts
    │               └── shared-ui/
    │                   ├── file-upload.component.ts    # HttpClient reportProgress
    │                   └── section-reveal.animation.ts # @angular/animations trigger
    │
    └── admin/
        └── src/
            ├── index.html
            ├── main.ts
            ├── styles.scss
            ├── environments/
            │   ├── environment.ts
            │   └── environment.production.ts
            └── app/
                ├── app.module.ts                # HTTP_INTERCEPTORS registration
                ├── app.component.ts             # <router-outlet>
                ├── app-routing.module.ts        # AuthGuard on all non-login routes
                │
                ├── guards/
                │   └── auth.guard.ts            # CanActivate → /login if not authed
                ├── interceptors/
                │   └── auth.interceptor.ts      # Bearer + 401 BehaviorSubject refresh
                │
                ├── layout/
                │   ├── layout.module.ts
                │   ├── layout.component.ts      # MatSidenav + topbar + router-outlet
                │   └── layout-routing.module.ts # All child routes (lazy)
                │
                ├── pages/                       # Each = lazy-loaded NgModule
                │   ├── login/
                │   ├── schedule/                # interval(60s) auto-refresh
                │   ├── patients/
                │   ├── patient-profile/         # MatTabGroup — 5 tabs
                │   ├── case-detail/             # MatStepper + HealingWindowBanner
                │   ├── invoices/
                │   ├── invoice-create/          # FormArray line items + GST preview
                │   ├── recalls/
                │   └── analytics/               # ng2-charts
                │
                ├── services/
                │   ├── auth.service.ts
                │   ├── appointments.service.ts
                │   ├── patients.service.ts
                │   ├── cases.service.ts
                │   ├── invoices.service.ts
                │   ├── recalls.service.ts
                │   └── dashboard.service.ts
                │
                └── shared/
                    ├── components/
                    │   ├── healing-window-banner/
                    │   ├── gst-threshold-banner/
                    │   ├── status-badge/
                    │   └── file-viewer/         # presigned URL <iframe>
                    └── pipes/
                        ├── ist-date.pipe.ts
                        └── status-color.pipe.ts
```

---

## 5. Booking Form App — Full Spec

### 5.1 Overview

| Property | Value |
|----------|-------|
| Angular app name | `booking-form` |
| Routing | None — `ng generate application booking-form --routing=false` |
| Entry | `AppComponent` template = `<app-booking-form></app-booking-form>` |
| State location | `BookingFormComponent` class properties only |
| State library | None |
| URL | `https://book.sharayudental.com` |

### 5.2 Section Reveal State Machine

`BookingFormComponent` holds all booking state as class properties. Computed `get` properties drive `*ngIf` directives. Sections appear one by one as the patient completes each.

```typescript
// BookingFormComponent — complete state
selectedService: string | null = null;
selectedDate:    string | null = null;
selectedSlot:    string | null = null;
slotError:       string | null = null;
patientData:     PatientValue  | null = null;
intakeData:      Record<string,any> | null = null;
submitting   = false;
submitError: string | null = null;
submitted    = false;
bookingResult: BookingResult | null = null;
bookingSource  = 'direct';  // from ?ref= URL param

// Section visibility — drives *ngIf in template
get showDate()    { return !!this.selectedService; }
get showSlot()    { return !!this.selectedDate; }
get showPatient() { return !!this.selectedSlot; }
get showIntake()  { return !!this.patientData; }
get showSubmit()  { return !!this.intakeData; }
```

### 5.3 Form Layout (Mobile — 390px)

```
┌─────────────────────────────────────────┐
│ [logo] Sharayu Dental Clinic  sticky ↑  │
│        Book an Appointment              │
├─────────────────────────────────────────┤
│ SECTION 1 — always visible              │
│  <select>  Choose a treatment…  ▼       │
├─────────────────────────────────────────┤ *ngIf="showDate" [@sectionReveal]
│ SECTION 2 — Date                        │
│ ← Sat 11 | Sun ✕ | Mon 13 | Tue 14 →  │  horizontal scroll, Sunday disabled
├─────────────────────────────────────────┤ *ngIf="showSlot" [@sectionReveal]
│ SECTION 3 — Slot                        │
│ [10:00 am] [10:30 am] [●11:00] ...     │  taken = disabled + strikethrough
├─────────────────────────────────────────┤ *ngIf="showPatient" [@sectionReveal]
│ SECTION 4 — Your details                │
│ Phone  [98765 43210___]  (lookup blur)  │
│ Name   [_______________]                │
│ Email  [_______________]  (optional)    │
│ [Continue]                              │
├─────────────────────────────────────────┤ *ngIf="showIntake" [@sectionReveal]
│ SECTION 5 — Treatment details           │
│ (service-specific sub-form)             │
├─────────────────────────────────────────┤ *ngIf="showSubmit" [@sectionReveal]
│ ── Booking Summary ──────────────────── │
│ Service  Oral Prophylaxis               │
│ Date     Saturday, 12 April 2026        │
│ Time     11:00 AM                       │
│ Patient  Ramesh Kumar                   │
│                                         │
│ [Confirm Booking]                       │
└─────────────────────────────────────────┘

On success → entire form replaced by ConfirmationCard (submitted = true)
```

### 5.4 Component Specs

**ServiceDropdown**
- `@Input() value: string | null`
- `@Output() serviceChange: EventEmitter<string>`
- Template: `<select>` with `*ngFor` over 7 services
- `ngOnInit`: reads `?service=` from `window.location.search`, emits if valid SVC-xx

**DateStrip**
- `ngOnInit` generates next 14 days using `date-fns` `addDays`
- `OFF_DAYS = [0]` (Sunday) + configurable `HOLIDAYS: string[]`
- Each date: `<button>` with `[class.selected]`, `[disabled]="d.isOff"`
- CSS: `overflow-x: auto; white-space: nowrap; scroll-snap-type: x mandatory`

**SlotGrid**
- `@Input()` — `date`, `serviceId`, `selectedSlot`
- `@Output()` — `slotChange: EventEmitter<string>`
- `ngOnChanges()` triggers `BookingService.getSlots()` when `date` or `serviceId` changes
- Internal: `loading`, `error`, `slots[]` class properties
- Loading state: 9 skeleton pills (`<div class="skeleton-pill">`)
- Empty: "No slots available. Please select another date."
- Error: inline message + "Try again" link that calls `loadSlots()` again
- Taken slots: `[disabled]="slot.taken"` + `.taken` CSS class (strikethrough)

**PatientDetails**
- `ReactiveFormsModule` — `FormBuilder.group({ phone, name, email })`
- `phone` blur → `BookingService.lookupPatient(phone)` → if found: `form.patchValue({ name, email })` + show "Welcome back, [name]!" banner
- Phone lookup failure: silent — patient fills manually, no blocking error
- Submit emits `(formComplete)` to parent with form value

**IntakeSection**
- `@Input() serviceId: string`
- Template: 7 `*ngIf="serviceId === 'SVC-xx'"` blocks loading respective sub-component
- Each sub-component emits `(formComplete)` with intake data to `IntakeSection` → parent

**ConfirmationCard**
- Shown via `*ngIf="submitted; else formTpl"`
- Shows: clinic logo · ✓ checkmark · "Appointment Confirmed!" · summary table (patient, service, date+time in IST) · "WA confirmation sent to your number" · "Book Another Appointment" button
- "Book Another" → calls `resetAll()` on parent component
- `resetAll()` sets all state back to null/false + `window.scrollTo(0, 0)`

### 5.5 Intake Sub-form Fields

| Service | Required fields | Special |
|---------|----------------|---------|
| SVC-01 Prophylaxis | Last scaling date · sensitivity (mild/moderate/severe) · concerns | — |
| SVC-02 Restoration | Tooth number · cavity type (caries/fracture/worn) · material pref · anaesthesia allergy | — |
| SVC-03 RCT | Tooth number · severity · previous RCT y/n · allergies | X-ray file upload (optional) |
| SVC-04 Extraction | Tooth number · bleeding disorder y/n · blood thinner y/n + name · medications | X-ray upload (optional) · `Validators.requiredTrue` consent |
| SVC-05 Orthodontics | Age · crowding severity · previous treatment y/n | Photos upload (optional) |
| SVC-06 Implant | Bone quality · smoker y/n · diabetic y/n · budget discussed y/n | CBCT upload (optional) · `Validators.requiredTrue` consent |
| SVC-07 Pulpectomy | Tooth number · child age · allergies · medical conditions | **parent name (required)** · **parent phone (required)** · `Validators.requiredTrue` parent consent |

### 5.6 Booking Submission

```typescript
// BookingFormComponent.onSubmit()
this.bookingService.submitBooking({
  service_id:     this.selectedService!,
  chair_id:       1,
  scheduled_at:   `${this.selectedDate}T${this.selectedSlot}:00`,
  booking_source: this.bookingSource,     // 'whatsapp' | 'website' | 'direct'
  patient: {
    name:  this.patientData!.name,
    phone: this.patientData!.phone,
    email: this.patientData!.email,
  },
  intake_data: this.intakeData!,
}).subscribe({
  next:  (r) => { this.bookingResult = r; this.submitted = true; },
  error: (e) => {
    if (e.status === 409) {
      this.selectedSlot = null;
      this.slotError = 'This slot was just taken. Please choose another time.';
      document.querySelector('app-slot-grid')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.submitError = `Booking failed. Please call us: ${environment.clinicPhone}`;
    }
    this.submitting = false;
  },
});
```

### 5.7 Error Handling

| Scenario | Behaviour |
|----------|-----------|
| 409 Slot taken | Clear `selectedSlot` · set `slotError` · scroll SlotGrid into view |
| 500 / network error | Show `submitError` with clinic phone number |
| Slots API fails | Inline error + "Try again" button inside `SlotGridComponent` |
| Phone lookup fails | Silent — form stays empty, patient fills manually |
| File upload > 20MB | Inline error inside `FileUploadComponent` |
| File wrong MIME type | Inline error — accepted: `.jpg .jpeg .png .pdf .dcm` |

---

## 6. Admin Dashboard — All Screens

### D-01 — Login

**Route:** `/login`

Email + password reactive form → `AuthService.login()` → stores `access_token` in `sessionStorage` (httpOnly refresh cookie set by backend) → redirect: doctor → `/analytics`, receptionist → `/schedule`.

### D-02 — Today's Schedule

**Route:** `/schedule` | lazy module: `ScheduleModule`

`ScheduleComponent` subscribes to `interval(60_000).pipe(startWith(0), switchMap(...))` → auto-refresh. Chair tabs (Chair 1 / Chair 2 / All) filter the local `appointments[]` array. Appointment cards show patient name · service · time · status badge. Actions: View Detail · Mark No-Show · Close Appointment. "New Appointment" opens `MatDialog`.

**Status badge map:**

| Status | Badge class |
|--------|-------------|
| `booked` | `.badge-blue` |
| `confirmed` | `.badge-green` |
| `in_progress` | `.badge-amber` |
| `done` | `.badge-gray` |
| `no_show` | `.badge-red` |
| `cancelled` | `.badge-light` |

### D-03 — Appointment Detail Dialog

`MatDialog` → `AppointmentDetailDialogComponent`

Patient name + phone (click → patient profile) · service · chair · scheduled time. Intake data expanded per service fields. Allergy alert banner if `patient.allergies` set. Blood thinner alert banner if `patient.blood_thinner === true`. Clinical notes textarea — editable, auto-saves on blur via `PUT /appointments/:id`. WA log history per message (sent / delivered / read). Action buttons: Mark In Progress · Mark Done (triggers close chain) · Mark No-Show · Reschedule.

### D-04 — New Appointment Dialog

`MatDialog` → `NewAppointmentDialogComponent`

Patient `MatAutocomplete` search (phone or name). If not found: inline create fields. `MatSelect` for service and chair. Date strip + slot grid sub-components. Submit → `AppointmentsService.createAppointment()` → closes dialog → schedule refreshes.

### D-05 — Reschedule Dialog

Current appointment read-only. Date + slot picker. `PUT /appointments/:id` with `{ scheduled_at }` → toast.

### D-06 — No-Show Dialog

`MatDialog` confirm. `POST /appointments/:id/no-show`.

### D-07 — Patient Search

**Route:** `/patients` | lazy: `PatientsModule`

Debounced input (300ms) → `PatientsService.search(term)`. Result list: name · phone · last visit · active cases count. Click → `/patients/:id`.

### D-08 — Patient Profile

**Route:** `/patients/:id` | lazy: `PatientProfileModule`

Header: name · phone · email · DOB · paediatric badge · allergy/blood-thinner banners. `MatTabGroup` with 5 tabs — each fetches lazily on first activation:

| Tab | Data source |
|-----|-------------|
| Appointments | `GET /patients/:id/appointments` |
| Cases | `GET /patients/:id/cases` |
| Invoices | `GET /patients/:id/invoices` |
| Recalls | `GET /patients/:id/recalls` |
| WA Logs | `GET /patients/:id/wa-logs` (via dashboard) |

Edit icon → `MatDialog` → `PatientEditDialogComponent` → `PATCH /patients/:id`.

### D-09 — Patient Edit Dialog

All patient fields including paediatric toggle. Toggling `is_paediatric` shows/hides parent fields. `PATCH /patients/:id` on save.

### D-10 — X-ray / File Viewer

Thumbnail grid from patient's uploaded files. Click → `MatDialog` with `<iframe [src]="presignedUrl">` for PDF or `<img>` for images. Presigned URL (15-min TTL) fetched on dialog open.

### D-11 — Active Cases List

Filter chips: All / RCT / Implant / Orthodontics / Pulpectomy. Case cards: patient name · type badge · `X/Y steps` progress · last activity. Click → `/cases/:id`.

### D-12 — RCT Case Detail

**Route:** `/cases/:id` (case_type=rct) | lazy: `CaseDetailModule`

4-step `MatStepper` (non-linear, read-only display). Each step: status badge · appointment date · invoice amount · WA sent timestamp · "Mark Complete" button · clinical notes textarea. "Book Next Session" → `NewAppointmentDialogComponent`.

### D-13 — Implant Case Detail

**Route:** `/cases/:id` (case_type=implant)

Same `MatStepper` as D-12. `HealingWindowBannerComponent` shown above Step 2 tile.

**HealingWindowBanner states:**

| State | Display |
|-------|---------|
| `healing_window_end` not set | Hidden |
| Now < `healing_window_end` | Amber banner · `[daysLeft] days remaining` · `percent%` progress bar · Step 2 blocked |
| Now ≥ `healing_window_end` | Green banner · "Healing complete · Step 2 can be scheduled" |

`daysLeft = differenceInDays(parseISO(healing_window_end), new Date())` via `date-fns`. Total osseointegration period = 90 days.

### D-14 — Orthodontics Case Detail

Rolling session list (not fixed-step stepper). "Add Session" opens `NewAppointmentDialogComponent`. Retainer recall status shown at bottom.

### D-15 — Paediatric Pulpectomy Case Detail

Prominent paediatric badge. All WA log entries labelled "Sent to: [parent_name] ([parent_phone])". 3-step `MatStepper`.

### D-16 — New Case Dialog

Patient search or pre-filled from patient profile. `MatSelect` for case type. Submit → `POST /cases` → backend pre-fills steps.

### D-17 — Invoice Create

**Route:** `/invoices/new?appointment_id=` | lazy: `InvoiceCreateModule`

Patient name + service read-only (from appointment). GST classification shown dynamically: "SAC 9993 — Exempt 0%" or "SAC 999722 — 18% GST". Line items: `FormArray` — description + amount · add/remove row. Subtotal / GST / Total computed in real-time via `valueChanges`. "Generate Invoice & Send" → `POST /invoices` → loading spinner → `MatSnackBar` toast.

### D-18 — Invoice List

**Route:** `/invoices` | lazy: `InvoicesModule`

`MatDateRangePicker` · patient search · type filter (All / Exempt / GST). `MatTable`: invoice number · patient · service · date · total · type badge · View button. Click View → `InvoiceDetailDialogComponent`.

### D-19 — Invoice Detail Dialog

`MatDialog` with `<iframe [src]="presignedPdfUrl">`. Metadata: number · patient · date · total · type. "Resend to WhatsApp" → `POST /invoices/:id/send-wa` → toast. "Download" → opens presigned URL.

### D-20 — GST Threshold Banner

`GSTThresholdBannerComponent` rendered in `LayoutComponent` — present on every admin page.

| Backend flag | Banner style | Message |
|-------------|-------------|---------|
| `WARNING_80PCT` | Amber bar | "Cosmetic revenue at ₹16L — ₹4L remaining before GST threshold" |
| `CRITICAL_95PCT` | Red bar | "Cosmetic revenue at ₹19L — Contact your CA immediately" |
| `REGISTRATION_REQUIRED` | Dark red sticky | "₹20L threshold reached — GST registration required" |
| `null` | Hidden | — |

Banner data comes from `GET /dashboard/today` response field `gst_flag`.

### D-21 — Recall Due List

**Route:** `/recalls` | lazy: `RecallsModule`

`MatChipListbox` filter by service. Overdue-only toggle. `MatTable`: patient · phone · service · due date · overdue badge · "Send WA Now" · "Cancel". "Send WA Now" → `POST /recalls/:id/send` → toast. "Cancel" → `MatDialog` confirm → `PUT /recalls/:id/cancel`.

### D-22 — Recall History Dialog

All recalls for patient. `MatTable`: service · trigger type · scheduled · sent · delivered · status · rebooked date.

### D-24 — Revenue Chart

**Route:** `/analytics` | lazy: `AnalyticsModule`

`ng2-charts` `BarChart`. Period toggle: Day / Week / Month. Y-axis formatter: `₹Xk`. Data: `GET /dashboard/revenue?period=`.

### D-25 — Treatment Breakdown

`ng2-charts` `BarChart` — count + revenue per service_id. Data: `GET /dashboard/treatments`.

### D-26 — WA Activity Log

Stat cards: Queued · Sent · Delivered · Read · Failed (today). 7-day `ng2-charts` `LineChart` sparkline.

### D-27 — No-Show Report

`ng2-charts` `LineChart` — no-show rate % per week. `MatTable` below: last 4 weeks · appointments · no-shows · rate.

---

## 7. Angular Module Design

### booking-form AppModule

```typescript
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,    // required for @angular/animations
    ReactiveFormsModule,
    HttpClientModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    BookingFormModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### admin AppModule

```typescript
@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

### Admin routing — all lazy

```typescript
// app-routing.module.ts
{ path: 'login', component: LoginComponent },
{
  path: '',
  canActivate: [AuthGuard],
  loadChildren: () => import('./layout/layout.module').then(m => m.LayoutModule),
},

// layout-routing.module.ts (child routes)
{ path: 'schedule',    loadChildren: () => import('./pages/schedule/...') },
{ path: 'patients',    loadChildren: () => import('./pages/patients/...') },
{ path: 'patients/:id', loadChildren: () => import('./pages/patient-profile/...') },
{ path: 'cases/:id',   loadChildren: () => import('./pages/case-detail/...') },
{ path: 'invoices',    loadChildren: () => import('./pages/invoices/...') },
{ path: 'invoices/new', loadChildren: () => import('./pages/invoice-create/...') },
{ path: 'recalls',     loadChildren: () => import('./pages/recalls/...') },
{ path: 'analytics',   loadChildren: () => import('./pages/analytics/...') },
```

---

## 8. API Integration Layer

### booking-form — public endpoints only

```typescript
@Injectable({ providedIn: 'root' })
export class BookingService {
  private api = environment.apiUrl;
  constructor(private http: HttpClient) {}

  getSlots(date: string, serviceId: string): Observable<{ slots: Slot[] }> {
    return this.http.get<{ slots: Slot[] }>(`${this.api}/appointments/slots`, {
      params: { date, service_id: serviceId, chair_id: '1' },
    });
  }

  lookupPatient(phone: string): Observable<{ found: boolean; patient?: Patient }> {
    return this.http.get<any>(`${this.api}/patients`, { params: { search: phone, limit: '1' } })
      .pipe(map(r => ({ found: r.patients?.length > 0, patient: r.patients?.[0] })));
  }

  // POST /appointments — no Authorization header (public endpoint)
  submitBooking(payload: BookingPayload): Observable<BookingResult> {
    return this.http.post<BookingResult>(`${this.api}/appointments`, payload);
  }
}
```

### admin — AuthInterceptor adds Bearer

The `AuthInterceptor` intercepts every outgoing request:

1. Reads `sessionStorage.getItem('access_token')` → adds `Authorization: Bearer <token>`
2. On 401 response: queues all pending requests in a `BehaviorSubject`
3. Calls `POST /auth/refresh` once (guarded by `refreshing` flag)
4. On success: stores new token → flushes queued requests with new token
5. On refresh failure: calls `AuthService.logout()` → navigates to `/login`

### Admin service pattern

```typescript
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private api = `${environment.apiUrl}/appointments`;
  constructor(private http: HttpClient) {}

  getSchedule(date: string): Observable<{ appointments: Appointment[] }> {
    return this.http.get<any>(this.api, { params: { date, limit: '100' } });
  }
  closeAppointment(id: string): Observable<CloseResult> {
    return this.http.post<CloseResult>(`${this.api}/${id}/complete`, {});
  }
  markNoShow(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/${id}/no-show`, {});
  }
}
```

---

## 9. State & Forms

### booking-form — component class properties only

All booking form state lives as properties of `BookingFormComponent`. No service, no NgRx, no `Subject`. Computed `get` properties drive template `*ngIf`. Each child component emits via `@Output() EventEmitter` when its section is complete.

```typescript
// Section transition handlers
onServiceChange(svc: string): void {
  this.selectedService = svc;
  // Reset downstream sections
  this.selectedDate = this.selectedSlot = this.slotError = null;
  this.patientData = this.intakeData = null;
}
onDateChange(date: string): void { this.selectedDate = date; this.selectedSlot = null; }
onSlotChange(slot: string): void  { this.selectedSlot = slot; this.slotError = null; }
onPatientComplete(p: PatientValue): void { this.patientData = p; }
onIntakeComplete(i: Record<string,any>): void { this.intakeData = i; }
```

### admin — service + component subscription

All server data via Angular services returning `Observable<T>`. Components subscribe in `ngOnInit()` using `Subscription` aggregated via `sub.add()` and unsubscribed in `ngOnDestroy()`.

```typescript
private sub = new Subscription();
ngOnInit(): void {
  this.sub.add(
    interval(60_000).pipe(startWith(0), switchMap(() => this.apptService.getSchedule(this.today)))
      .subscribe(r => { this.appointments = r.appointments; this.loading = false; })
  );
}
ngOnDestroy(): void { this.sub.unsubscribe(); }
```

### Reactive Forms — validators used

```typescript
Validators.required
Validators.minLength(2), Validators.maxLength(120)
Validators.email
Validators.pattern(/^(\+91)?[6-9]\d{9}$/)   // Indian mobile
Validators.requiredTrue                       // consent checkboxes (extraction, implant, pulpectomy)
```

---

## 10. File Upload — X-rays & CBCT

`FileUploadComponent` used inside RCT, Extraction, Orthodontics, Implant intake sub-forms. Upload is **optional** in all cases.

```
States: idle → uploading (progress bar) → done (s3_key stored) → error (retry)

Upload flow:
1. Patient selects file
2. FileUploadComponent checks size (> 20MB → error state)
3. HttpClient.post() with { reportProgress: true, observe: 'events' }
4. HttpEventType.UploadProgress → update progress bar
5. HttpEventType.Response → state = 'done', emit s3_key via @Output()
6. Parent intake form stores s3_key in form value
7. s3_key included in intake_data when booking is submitted
```

Accepted MIME types / extensions: `.jpg .jpeg .png .pdf .dcm`  
Max file size: 20MB  
S3 bucket: `sharayu-xrays` (backend handles actual upload — frontend calls `POST /uploads/xray`)

---

## 11. Charts & Analytics

All charts live exclusively in `AnalyticsModule`. Heavy `chart.js` bundle is therefore lazy-loaded and does not affect initial admin load.

```typescript
// Revenue BarChart — ChartData<'bar'>
chartData: ChartData<'bar'> = {
  labels:   ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  datasets: [{ data: [12000, 8500, 16000, 9000, 14000, 11000],
               backgroundColor: '#1A5FAB', borderRadius: 5 }],
};
chartOptions: ChartOptions<'bar'> = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { ticks: { callback: v => `₹${Number(v)/1000}k` } } },
};
// Template: <canvas baseChart [data]="chartData" [options]="chartOptions" type="bar">
```

---

## 12. Shared Design System

### Colour tokens

```scss
// styles.scss — CSS variables used in both apps
:root {
  --brand-50:  #E8EDF4;
  --brand-500: #1A5FAB;
  --brand-600: #0D1B2A;
  --teal-500:  #0A6B52;
  --teal-100:  #E2F3ED;
  --coral-500: #8B2020;
  --coral-100: #FAEAEA;
  --gold-500:  #C4973A;
}
```

### IST date formatting

```typescript
// shared/pipes/ist-date.pipe.ts
import { formatInTimeZone } from 'date-fns-tz';

@Pipe({ name: 'istDate' })
export class ISTDatePipe implements PipeTransform {
  transform(value: string, fmt = 'datetime'): string {
    const IST = 'Asia/Kolkata';
    const formats: Record<string, string> = {
      date:     'd MMM yyyy',
      datetime: 'd MMM yyyy, h:mm a',
      time:     'h:mm a',
      day:      'EEEE, d MMMM yyyy',
    };
    return formatInTimeZone(parseISO(value), IST, formats[fmt] ?? formats['datetime']);
  }
}
// Usage: {{ appointment.scheduled_at | istDate:'datetime' }}
```

### Touch targets (booking-form)

All interactive elements: `min-height: 44px; min-width: 44px`. Slot pills: `height: 44px`. Submit button: `height: 48px`.

---

## 13. Functional Requirements

### booking-form

| ID | Requirement | Priority |
|----|-------------|----------|
| FE-B-01 | `--routing=false` · no `RouterModule` · single `BookingFormComponent` state machine | P0 |
| FE-B-02 | `?service=` URL param read in `ngOnInit` → pre-selects dropdown | P0 |
| FE-B-03 | `?ref=` URL param captured → sent as `booking_source` in POST body | P0 |
| FE-B-04 | ServiceDropdown — `<select>` — 7 services SVC-01 to SVC-07 | P0 |
| FE-B-05 | DateStrip — next 14 days · horizontal scroll · Sunday + `HOLIDAYS[]` disabled | P0 |
| FE-B-06 | SlotGrid — `ngOnChanges` fetches on date/service change · taken = disabled | P0 |
| FE-B-07 | PatientDetails — phone blur lookup · `patchValue` auto-fill · "Welcome back" banner | P0 |
| FE-B-08 | 7 intake sub-forms — all fields per Section 5.5 | P0 |
| FE-B-09 | `Validators.requiredTrue` consent on extraction / implant / pulpectomy | P0 |
| FE-B-10 | SVC-07: parent name + parent phone required · parent consent `requiredTrue` | P0 |
| FE-B-11 | File upload — `HttpClient reportProgress` · max 20MB · optional · idle/uploading/done/error states | P0 |
| FE-B-12 | 409 → clear slot · `slotError` · scroll SlotGrid into view | P0 |
| FE-B-13 | 500 / network → `submitError` with `environment.clinicPhone` | P0 |
| FE-B-14 | `ConfirmationCard` on success · "Book Another" → `resetAll()` | P0 |
| FE-B-15 | `[@sectionReveal]` `@angular/animations` trigger for section reveal | P0 |
| FE-B-16 | Mobile-first · all touch targets ≥ 44px · `inputmode="numeric"` on phone | P0 |

### admin

| ID | Requirement | Priority |
|----|-------------|----------|
| FE-A-01 | JWT auth — `AuthService` + `AuthGuard` + `sessionStorage` access token | P0 |
| FE-A-02 | `AuthInterceptor` — `BehaviorSubject` queuing · refresh-once · logout on fail | P0 |
| FE-A-03 | Schedule — chair tabs · status badges · `interval(60s)` auto-refresh · `OnDestroy` unsub | P0 |
| FE-A-04 | Appointment detail `MatDialog` — intake data · allergy/blood-thinner alerts · close actions | P0 |
| FE-A-05 | New appointment `MatDialog` — patient autocomplete + inline create · slot picker | P0 |
| FE-A-06 | Patient profile `MatTabGroup` — 5 lazy tabs · edit dialog | P0 |
| FE-A-07 | Case detail `MatStepper` — step mark-complete · clinical notes · "Book Next Session" | P0 |
| FE-A-08 | Implant `HealingWindowBannerComponent` — locked/unlocked · `date-fns differenceInDays` · progress bar | P0 |
| FE-A-09 | Invoice create — `FormArray` line items · real-time GST preview via `valueChanges` | P0 |
| FE-A-10 | Invoice PDF preview `MatDialog` — `<iframe>` presigned URL · resend WA | P0 |
| FE-A-11 | `GSTThresholdBannerComponent` in `LayoutComponent` — amber/red/dark-red states | P1 |
| FE-A-12 | Recall list — service filter · overdue badge · one-tap send · cancel confirm | P0 |
| FE-A-13 | `ng2-charts` Revenue `BarChart` — day/week/month toggle | P1 |
| FE-A-14 | `ng2-charts` Treatment breakdown + WA activity + no-show `LineChart` | P1 |
| FE-A-15 | All page modules lazy-loaded via `loadChildren` | P0 |
| FE-A-16 | `MatSnackBar` toasts on all mutations (success + error) | P0 |
| FE-A-17 | Empty states on all `MatTable` views | P0 |
| FE-A-18 | `OnDestroy` unsubscribe on all `interval()` subscriptions | P0 |

---

## 14. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-FE-01 | booking-form first paint (4G mobile) | < 3s · Lighthouse ≥ 85 |
| NFR-FE-02 | Admin initial load | < 2s |
| NFR-FE-03 | booking-form bundle (initial + vendor) | < 200KB gzipped |
| NFR-FE-04 | Admin initial chunk | < 300KB gzipped |
| NFR-FE-05 | Each admin lazy page chunk | < 100KB gzipped |
| NFR-FE-06 | Token storage | `access_token` in `sessionStorage` only — never `localStorage` |
| NFR-FE-07 | HTTPS enforced | CloudFront HTTP → HTTPS redirect on both distributions |
| NFR-FE-08 | Error surfacing | `error` handler in every `subscribe()` — `MatSnackBar` or inline message |
| NFR-FE-09 | Loading states | `MatProgressSpinner` or skeleton on all async data |
| NFR-FE-10 | `OnDestroy` | All `Subscription` objects unsubscribed — no memory leaks |
| NFR-FE-11 | TypeScript strict | `"strict": true` in `tsconfig.json` — no `any` without explicit cast |

---

## 15. Phased Delivery

### Phase 1 — Weeks 1–4 (48h)

| Task | Hours |
|------|-------|
| Angular workspace bootstrap · both apps scaffolded · `angular.json` · environments | 8h |
| booking-form: ServiceDropdown + DateStrip + SlotGrid | 16h |
| booking-form: PatientDetails with phone lookup | 8h |
| booking-form: BookingFormComponent state machine + section reveal animation | 8h |
| Admin: Login + AuthService + AuthGuard + AuthInterceptor | 8h |

### Phase 2 — Weeks 5–8 (64h)

| Task | Hours |
|------|-------|
| booking-form: all 7 intake sub-forms + IntakeSectionComponent | 22h |
| booking-form: FileUploadComponent + ConfirmationCard + error handling | 10h |
| Admin: LayoutComponent (sidenav + topbar + router-outlet) + routing setup | 8h |
| Admin: Schedule page + AppointmentDetailDialog + NewAppointmentDialog | 16h |
| Admin: GSTThresholdBannerComponent in layout | 4h |
| Admin: PatientSearch + PatientProfile (MatTabGroup) | 4h |

### Phase 3 — Weeks 9–12 (52h)

| Task | Hours |
|------|-------|
| Admin: Case detail — RCT MatStepper · Implant + HealingWindowBanner · Ortho · Pulpectomy | 28h |
| Admin: Recall due list + send/cancel + history dialog | 12h |
| Admin: Invoice create (FormArray) + Invoice list + PDF preview dialog | 12h |

### Phase 4 — Weeks 13–14 (32h)

| Task | Hours |
|------|-------|
| Admin: Analytics — 4 charts (ng2-charts) | 18h |
| Both apps: empty states · MatProgressSpinner skeletons · error boundaries | 8h |
| Lighthouse audit + bundle analysis (`--stats-json`) + fixes | 6h |

**Total: 196h**

---

## 16. Build & Deploy

### Environment files

```typescript
// projects/booking-form/src/environments/environment.production.ts
export const environment = {
  production:  true,
  apiUrl:      'https://api.sharayudental.com/v1',
  clinicPhone: '+91XXXXXXXXXX',
};

// projects/admin/src/environments/environment.production.ts
export const environment = {
  production: true,
  apiUrl:     'https://api.sharayudental.com/v1',
  clinicName: 'Sharayu Dental Clinic',
};
```

### Build commands (from workspace root)

```bash
ng build booking-form --configuration=production   # → dist/booking-form/
ng build admin --configuration=production          # → dist/admin/
```

### S3 + CloudFront deploy

```bash
# booking-form
aws s3 sync dist/booking-form/ s3://sharayu-assets/booking/ --delete \
  --cache-control "max-age=31536000,immutable" --exclude "index.html"
aws s3 cp dist/booking-form/index.html s3://sharayu-assets/booking/index.html \
  --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id $BOOKING_CF_ID --paths "/*"

# admin
aws s3 sync dist/admin/ s3://sharayu-assets/admin/ --delete \
  --cache-control "max-age=31536000,immutable" --exclude "index.html"
aws s3 cp dist/admin/index.html s3://sharayu-assets/admin/index.html \
  --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id $ADMIN_CF_ID --paths "/*"
```

### CloudFront setup

Both distributions need a **custom error rule**: HTTP 404 → serve `/index.html` as HTTP 200. This is required for Angular client-side routing in admin (without it, direct `/patients/123` URLs return 404).

| Distribution | Origin | Domain |
|-------------|--------|--------|
| `$BOOKING_CF_ID` | `s3://sharayu-assets/booking/` | `book.sharayudental.com` |
| `$ADMIN_CF_ID` | `s3://sharayu-assets/admin/` | `admin.sharayudental.com` |

### GitHub Actions CI/CD (sharayu-frontend repo)

Two workflow files — each triggered only when its app's files change:

```yaml
# .github/workflows/deploy-booking-form.yml
on:
  push:
    branches: [main]
    paths: ['projects/booking-form/**']
steps:
  - uses: actions/checkout@v4
  - run: npm ci
  - run: npx ng build booking-form --configuration=production
  - uses: aws-actions/configure-aws-credentials@v4
    with: { role-to-assume: ${{ secrets.AWS_ROLE_ARN }}, aws-region: ap-south-1 }
  - run: |
      aws s3 sync dist/booking-form/ s3://sharayu-assets/booking/ --delete \
        --cache-control "max-age=31536000,immutable" --exclude "index.html"
      aws s3 cp dist/booking-form/index.html s3://sharayu-assets/booking/index.html \
        --cache-control "no-cache"
      aws cloudfront create-invalidation \
        --distribution-id ${{ secrets.BOOKING_CF_ID }} --paths "/*"
```

---

## 17. Accessibility & Mobile Rules

### booking-form (patients on mobile — critical)

- All `<input>` and `<select>` elements have `<label>` with matching `for` / `id`
- Error messages linked via `aria-describedby`
- `type="tel"` + `inputmode="numeric"` on phone field
- `type="email"` on email field
- File inputs have explicit `accept` attribute
- All touch targets ≥ 44×44px
- Slot grid keyboard navigable (Tab + Enter/Space)
- No icon-only interactive elements without `aria-label`
- `@media (prefers-reduced-motion: reduce)` — animation trigger sets duration to 0ms

### admin

- All `MatDialog` components are focus-trapped by Angular Material
- `MatTable` has proper `role="columnheader"` and `role="cell"`
- `MatSelect` fully keyboard navigable
- Skip-to-content link at top of `LayoutComponent`
- `MatDatepicker` accessible by Angular Material a11y

---

*Frontend PRD v4.0 — Sharayu Dental Clinic · April 2026 · Akib Tamboli*  
*Repo: `sharayu-frontend/` · Stack: Angular 17+ · TypeScript · RxJS · Angular Material · date-fns · ng2-charts*  
*booking-form: `--routing=false` · single component state machine · no NgRx*  
*admin: `--routing=true` · lazy-loaded modules · AuthGuard · AuthInterceptor · MatDialog*
