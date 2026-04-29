# Claude Skills — Frontend

**Project:** Sharayu Dental Clinic  
**Repo:** `sharayu-frontend/` (separate from `sharayu-backend/`)  
**Apps:** `booking-form/` (patient, single page, mobile-first) + `admin/` (clinic staff, desktop)  
**Stack:** Angular 17+ · TypeScript · Angular Material / Tailwind CSS · RxJS · HttpClient  
**BMAD:** Install at `sharayu-frontend/` root — NOT at a parent folder  
**Claude Code:** Always open at `sharayu-frontend/` root

---

## Skill Map

| # | Skill | booking-form | admin |
|---|-------|:---:|:---:|
| 1 | Angular workspace + two apps setup | ✓ | ✓ |
| 2 | booking-form app — single component, no routing | ✓ | — |
| 3 | Admin app — routing module + route guards | — | ✓ |
| 4 | Angular services + HttpClient | ✓ | ✓ |
| 5 | Section reveal state machine (booking-form) | ✓ | — |
| 6 | URL param reading (`?service=`, `?ref=`) | ✓ | — |
| 7 | ServiceDropdown component | ✓ | — |
| 8 | DateStrip component | ✓ | — |
| 9 | SlotGrid component — async pipe + service call | ✓ | — |
| 10 | PatientDetails — phone lookup + auto-fill | ✓ | — |
| 11 | IntakeSection + 7 service sub-forms | ✓ | — |
| 12 | Booking submission — 409/500 error handling | ✓ | — |
| 13 | ConfirmationCard + reset | ✓ | — |
| 14 | Reactive Forms + Validators (both apps) | ✓ | ✓ |
| 15 | File upload with progress (X-ray/CBCT) | ✓ | — |
| 16 | Auth guard + JWT interceptor (admin) | — | ✓ |
| 17 | Auth service — login, refresh, logout | — | ✓ |
| 18 | Admin schedule view with auto-refresh | — | ✓ |
| 19 | Healing window countdown component | — | ✓ |
| 20 | Angular Charts (ng2-charts / Chart.js) | — | ✓ |
| 21 | Shared UI component library (both apps) | ✓ | ✓ |
| 22 | IST date formatting with date-fns | ✓ | ✓ |
| 23 | Environment files + build configuration | ✓ | ✓ |
| 24 | Angular build optimisation + lazy loading | ✓ | ✓ |

---

## Skill 1 — Angular Workspace + Two Apps

```bash
# ── From inside sharayu-frontend/ repo root ──────────────────────────
# Angular workspace with no default app — two apps added separately
ng new sharayu-frontend --no-create-application --strict

cd sharayu-frontend

# Generate booking-form app (no routing — single component page)
ng generate application booking-form \
  --routing=false \
  --style=scss \
  --prefix=app

# Generate admin app (with routing — full multi-page SPA)
ng generate application admin \
  --routing=true \
  --style=scss \
  --prefix=app

# Install shared dependencies
npm install @angular/cdk @angular/material \
  @angular/forms @angular/common \
  date-fns axios

# For admin charts
npm install ng2-charts chart.js
```

**`angular.json` — key build targets:**
```json
{
  "projects": {
    "booking-form": {
      "architect": {
        "build": {
          "options": {
            "outputPath": "dist/booking-form",
            "index": "projects/booking-form/src/index.html",
            "main": "projects/booking-form/src/main.ts",
            "budgets": [
              { "type": "initial", "maximumWarning": "500kb", "maximumError": "1mb" }
            ]
          }
        }
      }
    },
    "admin": {
      "architect": {
        "build": {
          "options": {
            "outputPath": "dist/admin",
            "index": "projects/admin/src/index.html",
            "main": "projects/admin/src/main.ts"
          }
        }
      }
    }
  }
}
```

**Build commands:**
```bash
# Build booking-form for production
ng build booking-form --configuration=production

# Build admin for production
ng build admin --configuration=production
```

---

## Skill 2 — booking-form App — Single Component, No Routing

The booking form is one Angular component — `BookingFormComponent` — that progressively reveals sections. No routing module. No lazy loading at the component level.

**`projects/booking-form/src/app/app.module.ts`:**
```typescript
import { NgModule }          from '@angular/core';
import { BrowserModule }     from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule }  from '@angular/common/http';
import { AppComponent }      from './app.component';
import { BookingFormModule } from './booking-form/booking-form.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    HttpClientModule,
    BookingFormModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

**`projects/booking-form/src/app/app.component.ts`:**
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `<app-booking-form></app-booking-form>`,
})
export class AppComponent {}
```

**`projects/booking-form/src/environments/environment.ts`:**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/v1',
  clinicPhone: '+91XXXXXXXXXX',
};
```

**`projects/booking-form/src/environments/environment.production.ts`:**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.sharayudental.com/v1',
  clinicPhone: '+91XXXXXXXXXX',
};
```

---

## Skill 3 — Admin App — Routing Module + Route Guards

```typescript
// projects/admin/src/app/app-routing.module.ts
import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard }            from './guards/auth.guard';
import { LoginComponent }       from './pages/login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () => import('./layout/layout.module').then(m => m.LayoutModule),
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
```

**Layout child routes (lazy-loaded):**
```typescript
// projects/admin/src/app/layout/layout-routing.module.ts
const routes: Routes = [
  { path: '', redirectTo: 'schedule', pathMatch: 'full' },
  {
    path: 'schedule',
    loadChildren: () => import('../pages/schedule/schedule.module')
                        .then(m => m.ScheduleModule),
  },
  {
    path: 'patients',
    loadChildren: () => import('../pages/patients/patients.module')
                        .then(m => m.PatientsModule),
  },
  {
    path: 'patients/:id',
    loadChildren: () => import('../pages/patient-profile/patient-profile.module')
                        .then(m => m.PatientProfileModule),
  },
  {
    path: 'cases/:id',
    loadChildren: () => import('../pages/case-detail/case-detail.module')
                        .then(m => m.CaseDetailModule),
  },
  {
    path: 'invoices',
    loadChildren: () => import('../pages/invoices/invoices.module')
                        .then(m => m.InvoicesModule),
  },
  {
    path: 'recalls',
    loadChildren: () => import('../pages/recalls/recalls.module')
                        .then(m => m.RecallsModule),
  },
  {
    path: 'analytics',
    loadChildren: () => import('../pages/analytics/analytics.module')
                        .then(m => m.AnalyticsModule),
  },
];
```

**Auth Guard:**
```typescript
// projects/admin/src/app/guards/auth.guard.ts
import { Injectable }      from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService }     from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.router.navigate(['/login']);
    return false;
  }
}
```

---

## Skill 4 — Angular Services + HttpClient

**Base API service pattern (booking-form):**
```typescript
// projects/booking-form/src/app/services/booking.service.ts
import { Injectable }  from '@angular/core';
import { HttpClient }  from '@angular/common/http';
import { Observable }  from 'rxjs';
import { environment } from '../../environments/environment';

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
    return this.http.get<any>(`${this.api}/patients`, {
      params: { search: phone, limit: '1' },
    }).pipe(
      map(r => ({
        found:   (r.patients?.length ?? 0) > 0,
        patient: r.patients?.[0] ?? null,
      }))
    );
  }

  submitBooking(payload: BookingPayload): Observable<BookingResult> {
    return this.http.post<BookingResult>(`${this.api}/appointments`, payload);
  }

  uploadFile(file: File, patientPhone: string): Observable<{ s3_key: string }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('patient_phone', patientPhone);
    return this.http.post<{ s3_key: string }>(`${this.api}/uploads/xray`, fd);
  }
}
```

**Admin services pattern (with auth token):**
```typescript
// projects/admin/src/app/services/appointments.service.ts
import { Injectable }   from '@angular/core';
import { HttpClient }   from '@angular/common/http';
import { Observable }   from 'rxjs';
import { environment }  from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private api = `${environment.apiUrl}/appointments`;

  constructor(private http: HttpClient) {}

  getSchedule(date: string): Observable<AppointmentList> {
    return this.http.get<AppointmentList>(this.api, { params: { date, limit: '100' } });
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

## Skill 5 — Section Reveal State Machine (booking-form)

All section visibility is driven by a single component class. Angular's `*ngIf` and `[@sectionReveal]` animation handle show/hide.

```typescript
// projects/booking-form/src/app/booking-form/booking-form.component.ts
import { Component, OnInit } from '@angular/core';
import { BookingService }    from '../services/booking.service';
import { animate, style, transition, trigger } from '@angular/animations';

export const sectionReveal = trigger('sectionReveal', [
  transition(':enter', [
    style({ opacity: 0, maxHeight: '0', overflow: 'hidden' }),
    animate('400ms ease-out', style({ opacity: 1, maxHeight: '2000px' })),
  ]),
]);

@Component({
  selector: 'app-booking-form',
  templateUrl: './booking-form.component.html',
  animations: [sectionReveal],
})
export class BookingFormComponent implements OnInit {
  // ── State ──────────────────────────────────────────────────────────
  selectedService: string | null = null;
  selectedDate:    string | null = null;
  selectedSlot:    string | null = null;
  slotError:       string | null = null;
  patientData:     PatientFormValue | null = null;
  intakeData:      Record<string, any> | null = null;
  submitting  = false;
  submitError: string | null = null;
  submitted   = false;
  bookingResult: any = null;
  bookingSource = 'direct';

  // ── Section visibility ─────────────────────────────────────────────
  get showDate()    { return !!this.selectedService; }
  get showSlot()    { return !!this.selectedDate; }
  get showPatient() { return !!this.selectedSlot; }
  get showIntake()  { return !!this.patientData; }
  get showSubmit()  { return !!this.intakeData; }

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const svc = params.get('service');
    if (svc) this.selectedService = svc;
    this.bookingSource = params.get('ref') || 'direct';
  }

  onServiceChange(svc: string): void {
    this.selectedService = svc;
    this.selectedDate = this.selectedSlot = this.slotError = null;
    this.patientData = this.intakeData = null;
  }

  onDateChange(date: string): void {
    this.selectedDate = date;
    this.selectedSlot = null;
    this.slotError = null;
  }

  onSlotChange(slot: string): void {
    this.selectedSlot = slot;
    this.slotError = null;
  }

  onPatientComplete(data: PatientFormValue): void { this.patientData = data; }
  onIntakeComplete(data: Record<string, any>): void { this.intakeData = data; }

  onSubmit(): void {
    this.submitting = true;
    this.submitError = null;
    this.bookingService.submitBooking({
      service_id:     this.selectedService!,
      chair_id:       1,
      scheduled_at:   `${this.selectedDate}T${this.selectedSlot}:00`,
      booking_source: this.bookingSource,
      patient:        this.patientData!,
      intake_data:    this.intakeData!,
    }).subscribe({
      next: (result) => {
        this.bookingResult = result;
        this.submitted = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        if (err.status === 409) {
          this.selectedSlot = null;
          this.slotError = 'This slot was just taken. Please choose another time.';
        } else {
          this.submitError = 'Booking failed. Please call us to book.';
        }
        this.submitting = false;
      },
      complete: () => { this.submitting = false; },
    });
  }

  resetAll(): void {
    this.selectedService = this.selectedDate = this.selectedSlot = null;
    this.slotError = this.patientData = this.intakeData = null;
    this.submitting = false;
    this.submitError = null;
    this.submitted = false;
    this.bookingResult = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
```

**Template `booking-form.component.html`:**
```html
<!-- Header -->
<header class="booking-header">
  <img src="assets/clinic-logo.png" alt="" class="logo">
  <div>
    <p class="clinic-name">Sharayu Dental Clinic</p>
    <p class="subtitle">Book an Appointment</p>
  </div>
</header>

<ng-container *ngIf="submitted; else formTpl">
  <app-confirmation-card
    [booking]="bookingResult"
    (bookAnother)="resetAll()">
  </app-confirmation-card>
</ng-container>

<ng-template #formTpl>
  <div class="booking-sections">

    <!-- Section 1 — always visible -->
    <app-service-dropdown
      [value]="selectedService"
      (serviceChange)="onServiceChange($event)">
    </app-service-dropdown>

    <div *ngIf="showDate" [@sectionReveal]>
      <app-date-strip
        [value]="selectedDate"
        (dateChange)="onDateChange($event)">
      </app-date-strip>
    </div>

    <div *ngIf="showSlot" [@sectionReveal]>
      <p *ngIf="slotError" class="slot-error">{{ slotError }}</p>
      <app-slot-grid
        [date]="selectedDate!"
        [serviceId]="selectedService!"
        [selectedSlot]="selectedSlot"
        (slotChange)="onSlotChange($event)">
      </app-slot-grid>
    </div>

    <div *ngIf="showPatient" [@sectionReveal]>
      <app-patient-details
        (formComplete)="onPatientComplete($event)">
      </app-patient-details>
    </div>

    <div *ngIf="showIntake" [@sectionReveal]>
      <app-intake-section
        [serviceId]="selectedService!"
        (formComplete)="onIntakeComplete($event)">
      </app-intake-section>
    </div>

    <div *ngIf="showSubmit" [@sectionReveal]>
      <app-booking-summary
        [service]="selectedService!"
        [date]="selectedDate!"
        [slot]="selectedSlot!"
        [patient]="patientData!">
      </app-booking-summary>
      <p *ngIf="submitError" class="submit-error">{{ submitError }}</p>
      <button class="btn-primary btn-full"
              [disabled]="submitting"
              (click)="onSubmit()">
        {{ submitting ? 'Booking...' : 'Confirm Booking' }}
      </button>
    </div>

  </div>
</ng-template>
```

---

## Skill 6 — URL Param Reading (`?service=`, `?ref=`)

```typescript
// Read in BookingFormComponent.ngOnInit()
ngOnInit(): void {
  const params = new URLSearchParams(window.location.search);

  const svc = params.get('service');
  const VALID_SERVICES = ['SVC-01','SVC-02','SVC-03','SVC-04','SVC-05','SVC-06','SVC-07'];
  if (svc && VALID_SERVICES.includes(svc)) {
    this.selectedService = svc;
  }

  this.bookingSource = params.get('ref') || 'direct';
  // Stored in bookingSource, sent in POST body as booking_source
}
```

---

## Skill 7 — ServiceDropdown Component

```typescript
// booking-form: service-dropdown.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

export const SERVICES = [
  { id: 'SVC-01', label: 'Oral Prophylaxis (Scaling & Polishing)' },
  { id: 'SVC-02', label: 'Restoration (Filling)' },
  { id: 'SVC-03', label: 'Root Canal Treatment' },
  { id: 'SVC-04', label: 'Tooth Extraction' },
  { id: 'SVC-05', label: 'Orthodontics (Braces / Aligners)' },
  { id: 'SVC-06', label: 'Dental Implant' },
  { id: 'SVC-07', label: 'Paediatric Pulpectomy' },
];

@Component({
  selector: 'app-service-dropdown',
  template: `
    <div class="section-card">
      <label class="section-label" for="service-select">Select treatment</label>
      <select id="service-select" class="form-select"
              [value]="value || ''"
              (change)="onChange($event)">
        <option value="">Choose a treatment…</option>
        <option *ngFor="let s of services" [value]="s.id">{{ s.label }}</option>
      </select>
    </div>
  `,
})
export class ServiceDropdownComponent {
  @Input()  value: string | null = null;
  @Output() serviceChange = new EventEmitter<string>();

  services = SERVICES;

  onChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) this.serviceChange.emit(val);
  }
}
```

---

## Skill 8 — DateStrip Component

```typescript
// booking-form: date-strip.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { addDays, format, isSunday, isToday } from 'date-fns';

@Component({
  selector: 'app-date-strip',
  template: `
    <div class="section-card">
      <p class="section-label">Select date</p>
      <div class="date-strip">
        <button *ngFor="let d of dates"
                class="date-btn"
                [class.selected]="value === d.iso"
                [class.off]="d.isOff"
                [disabled]="d.isOff"
                (click)="!d.isOff && select(d.iso)">
          <span class="day-name">{{ d.dayName }}</span>
          <span class="day-num">{{ d.dayNum }}</span>
          <span class="month">{{ d.month }}</span>
        </button>
      </div>
    </div>
  `,
})
export class DateStripComponent implements OnInit {
  @Input()  value: string | null = null;
  @Output() dateChange = new EventEmitter<string>();

  dates: DateItem[] = [];

  // Off days: 0=Sunday. Add holiday dates as 'YYYY-MM-DD' strings here.
  private readonly OFF_DAYS = [0];
  private readonly HOLIDAYS: string[] = [];

  ngOnInit(): void {
    this.dates = Array.from({ length: 14 }, (_, i) => {
      const d   = addDays(new Date(), i + 1);
      const iso = format(d, 'yyyy-MM-dd');
      return {
        iso,
        dayName: format(d, 'EEE'),
        dayNum:  format(d, 'd'),
        month:   format(d, 'MMM'),
        isOff:   this.OFF_DAYS.includes(d.getDay()) || this.HOLIDAYS.includes(iso),
      };
    });
  }

  select(iso: string): void { this.dateChange.emit(iso); }
}
```

---

## Skill 9 — SlotGrid Component (async pipe)

```typescript
// booking-form: slot-grid.component.ts
import { Component, Input, Output, EventEmitter,
         OnChanges, SimpleChanges } from '@angular/core';
import { BookingService } from '../services/booking.service';
import { BehaviorSubject, switchMap, catchError, of, tap } from 'rxjs';
import { format, parseISO } from 'date-fns';

@Component({
  selector: 'app-slot-grid',
  template: `
    <div class="section-card">
      <p class="section-label">Select time</p>

      <div *ngIf="loading" class="slot-skeleton">
        <div *ngFor="let i of [1,2,3,4,5,6,7,8,9]" class="skeleton-pill"></div>
      </div>

      <p *ngIf="error && !loading" class="slot-error">
        Could not load slots.
        <button class="link-btn" (click)="reload()">Try again</button>
      </p>

      <p *ngIf="!loading && !error && slots.length === 0" class="slot-empty">
        No slots available. Please select another date.
      </p>

      <div *ngIf="!loading && !error && slots.length > 0" class="slot-grid">
        <button *ngFor="let slot of slots"
                class="slot-btn"
                [class.selected]="slot.time === selectedSlot"
                [class.taken]="slot.taken"
                [disabled]="slot.taken"
                (click)="!slot.taken && select(slot.time)">
          {{ formatTime(slot.time) }}
        </button>
      </div>
    </div>
  `,
})
export class SlotGridComponent implements OnChanges {
  @Input()  date:         string = '';
  @Input()  serviceId:    string = '';
  @Input()  selectedSlot: string | null = null;
  @Output() slotChange = new EventEmitter<string>();

  slots:   Slot[]  = [];
  loading = false;
  error   = false;

  constructor(private bookingService: BookingService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['date'] || changes['serviceId']) && this.date && this.serviceId) {
      this.loadSlots();
    }
  }

  loadSlots(): void {
    this.loading = true;
    this.error   = false;
    this.slots   = [];
    this.bookingService.getSlots(this.date, this.serviceId).subscribe({
      next:     (r) => { this.slots = r.slots; this.loading = false; },
      error:    ()  => { this.error = true;    this.loading = false; },
    });
  }

  reload(): void { this.loadSlots(); }

  select(time: string): void { this.slotChange.emit(time); }

  formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const d = new Date(); d.setHours(h, m);
    return format(d, 'h:mm a');
  }
}
```

---

## Skill 10 — PatientDetails Component (Phone Lookup + Auto-fill)

```typescript
// booking-form: patient-details.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { BookingService } from '../services/booking.service';
import { debounceTime, distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-patient-details',
  template: `
    <div class="section-card">
      <p class="section-label">Your details</p>

      <div *ngIf="returningPatient" class="welcome-banner">
        Welcome back, <strong>{{ form.value.name }}</strong>!
        Your details have been filled in.
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <div class="form-field">
          <label>WhatsApp number</label>
          <input formControlName="phone" type="tel" inputmode="numeric"
                 placeholder="98765 43210"
                 (blur)="onPhoneBlur()">
          <span class="spinner" *ngIf="checkingPhone">…</span>
          <p class="field-error" *ngIf="f['phone'].touched && f['phone'].invalid">
            Enter a valid 10-digit mobile number
          </p>
        </div>

        <div class="form-field">
          <label>Full name</label>
          <input formControlName="name" placeholder="Your name">
          <p class="field-error" *ngIf="f['name'].touched && f['name'].invalid">
            Name is required
          </p>
        </div>

        <div class="form-field">
          <label>Email (optional)</label>
          <input formControlName="email" type="email" placeholder="you@example.com">
        </div>

        <button type="submit" class="btn-primary btn-full"
                [disabled]="form.invalid">Continue</button>
      </form>
    </div>
  `,
})
export class PatientDetailsComponent {
  @Output() formComplete = new EventEmitter<PatientFormValue>();

  form = this.fb.group({
    phone: ['', [Validators.required, Validators.pattern(/^(\+91)?[6-9]\d{9}$/)]],
    name:  ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.email]],
  });

  returningPatient = false;
  checkingPhone    = false;

  get f() { return this.form.controls; }

  constructor(private fb: FormBuilder, private bookingService: BookingService) {}

  onPhoneBlur(): void {
    const phone = (this.form.value.phone || '').replace(/\D/g, '').slice(-10);
    if (phone.length < 10) return;
    this.checkingPhone = true;
    this.bookingService.lookupPatient(phone).subscribe({
      next: (r) => {
        if (r.found && r.patient) {
          this.form.patchValue({ name: r.patient.name, email: r.patient.email || '' });
          this.returningPatient = true;
        } else {
          this.returningPatient = false;
        }
        this.checkingPhone = false;
      },
      error: () => { this.checkingPhone = false; },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.formComplete.emit(this.form.value as PatientFormValue);
  }
}
```

---

## Skill 11 — IntakeSection + 7 Service Sub-forms

```typescript
// booking-form: intake-section.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-intake-section',
  template: `
    <div class="section-card">
      <p class="section-label">Treatment details</p>
      <app-prophylaxis-intake  *ngIf="serviceId === 'SVC-01'" (formComplete)="onDone($event)"></app-prophylaxis-intake>
      <app-restoration-intake  *ngIf="serviceId === 'SVC-02'" (formComplete)="onDone($event)"></app-restoration-intake>
      <app-rct-intake          *ngIf="serviceId === 'SVC-03'" (formComplete)="onDone($event)"></app-rct-intake>
      <app-extraction-intake   *ngIf="serviceId === 'SVC-04'" (formComplete)="onDone($event)"></app-extraction-intake>
      <app-orthodontics-intake *ngIf="serviceId === 'SVC-05'" (formComplete)="onDone($event)"></app-orthodontics-intake>
      <app-implant-intake      *ngIf="serviceId === 'SVC-06'" (formComplete)="onDone($event)"></app-implant-intake>
      <app-pulpectomy-intake   *ngIf="serviceId === 'SVC-07'" (formComplete)="onDone($event)"></app-pulpectomy-intake>
    </div>
  `,
})
export class IntakeSectionComponent {
  @Input()  serviceId!: string;
  @Output() formComplete = new EventEmitter<Record<string, any>>();
  onDone(data: Record<string, any>): void { this.formComplete.emit(data); }
}
```

**Extraction sub-form (most complex — consent + conditional blood thinner):**
```typescript
// extraction-intake.component.ts
import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, Validators }         from '@angular/forms';

@Component({
  selector: 'app-extraction-intake',
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="form-field">
        <label>Tooth number</label>
        <input formControlName="toothNumber" placeholder="e.g. 36">
      </div>

      <label class="checkbox-label">
        <input type="checkbox" formControlName="bloodThinner">
        On blood thinners?
      </label>

      <div *ngIf="form.value.bloodThinner" class="form-field">
        <label>Which medication?</label>
        <input formControlName="bloodThinnerName" placeholder="e.g. Ecosprin 75mg">
      </div>

      <div class="form-field">
        <label>Other current medications (optional)</label>
        <input formControlName="medications">
      </div>

      <div class="form-field">
        <label class="checkbox-label">
          <input type="checkbox" formControlName="consent">
          I consent to tooth extraction and understand the post-operative instructions
        </label>
        <p class="field-error" *ngIf="form.get('consent')?.touched && !form.value.consent">
          Consent is required to proceed
        </p>
      </div>

      <button type="submit" class="btn-primary btn-full"
              [disabled]="form.invalid || !form.value.consent">Continue</button>
    </form>
  `,
})
export class ExtractionIntakeComponent {
  @Output() formComplete = new EventEmitter<Record<string, any>>();

  form = this.fb.group({
    toothNumber:      ['', Validators.required],
    bleedingDisorder: [false],
    bloodThinner:     [false],
    bloodThinnerName: [''],
    medications:      [''],
    consent:          [false],
  });

  constructor(private fb: FormBuilder) {}

  onSubmit(): void {
    if (this.form.invalid || !this.form.value.consent) return;
    this.formComplete.emit(this.form.value);
  }
}
```

---

## Skill 12 — Booking Submission + Error Handling

```typescript
// booking.service.ts — full typed payload
export interface BookingPayload {
  service_id:     string;
  chair_id:       number;
  scheduled_at:   string;
  booking_source: string;
  patient: {
    name:  string;
    phone: string;
    email?: string;
  };
  intake_data: Record<string, any>;
}

// Error handling in component:
onSubmit(): void {
  this.bookingService.submitBooking(payload).subscribe({
    next: (result) => {
      this.bookingResult = result;
      this.submitted = true;
    },
    error: (err: HttpErrorResponse) => {
      if (err.status === 409) {
        this.selectedSlot = null;
        this.slotError = 'This slot was just taken. Please choose another time.';
        // Scroll back to slot grid
        document.querySelector('app-slot-grid')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        this.submitError = `Booking failed. Please call us: ${environment.clinicPhone}`;
      }
    },
  });
}
```

---

## Skill 13 — ConfirmationCard Component

```typescript
// booking-form: confirmation-card.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { format, parseISO }                        from 'date-fns';
import { formatInTimeZone }                        from 'date-fns-tz';
import { SERVICES }                                from '../service-dropdown/service-dropdown.component';

@Component({
  selector: 'app-confirmation-card',
  template: `
    <div class="confirmation-page">
      <div class="check-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>

      <h1>Appointment Confirmed!</h1>
      <p class="wa-note">A confirmation has been sent to your WhatsApp.</p>

      <div class="summary-card">
        <div class="summary-row" *ngFor="let row of summaryRows">
          <span class="label">{{ row.label }}</span>
          <span class="value">{{ row.value }}</span>
        </div>
      </div>

      <button class="link-btn" (click)="bookAnother.emit()">
        Book another appointment
      </button>

      <p class="clinic-contact">
        Questions? Call us:
        <a [href]="'tel:' + clinicPhone">{{ clinicPhone }}</a>
      </p>
    </div>
  `,
})
export class ConfirmationCardComponent {
  @Input()  booking: any = {};
  @Output() bookAnother = new EventEmitter<void>();

  clinicPhone = environment.clinicPhone;

  get summaryRows() {
    const t = formatInTimeZone(
      parseISO(this.booking.scheduled_at),
      'Asia/Kolkata', 'd MMM yyyy, h:mm a'
    );
    return [
      { label: 'Patient',  value: this.booking.patient_name },
      { label: 'Service',  value: SERVICES.find(s => s.id === this.booking.service_id)?.label },
      { label: 'Date & Time', value: t },
    ];
  }
}
```

---

## Skill 14 — Reactive Forms + Validators (Both Apps)

```typescript
// Standard form setup used across all sub-forms
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';

// Custom phone validator
export function indianPhoneValidator(control: AbstractControl) {
  const val = (control.value || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(val) ? null : { invalidPhone: true };
}

// Usage in component:
this.form = this.fb.group({
  phone: ['', [Validators.required, indianPhoneValidator]],
  name:  ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
  email: ['', [Validators.email]],
});

// Consent must be true (not just checked)
this.form = this.fb.group({
  consent: [false, [Validators.requiredTrue]],
});

// Template helper
get f() { return this.form.controls; }
// Usage: *ngIf="f['phone'].touched && f['phone'].invalid"
```

---

## Skill 15 — File Upload with Progress

```typescript
// booking-form: file-upload.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { HttpClient, HttpEventType }              from '@angular/common/http';
import { environment }                            from '../../environments/environment';

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

@Component({
  selector: 'app-file-upload',
  template: `
    <div class="upload-zone" (click)="state !== 'uploading' && fileInput.click()">
      <input #fileInput type="file" [accept]="accept" class="sr-only"
             (change)="handleFile($event)">

      <ng-container [ngSwitch]="state">
        <div *ngSwitchCase="'idle'" class="upload-idle">
          <span class="upload-icon">↑</span>
          <p>Tap to upload (max {{ maxSizeMB }}MB)</p>
          <p class="hint">JPG · PNG · PDF · DCM</p>
        </div>
        <div *ngSwitchCase="'uploading'">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progress"></div>
          </div>
          <p>Uploading {{ progress }}%</p>
        </div>
        <div *ngSwitchCase="'done'" class="upload-done">
          <span>✓</span> {{ filename }}
        </div>
        <div *ngSwitchCase="'error'" class="upload-error">
          <p>{{ errorMsg }}</p>
          <button (click)="$event.stopPropagation(); state = 'idle'">Try again</button>
        </div>
      </ng-container>
    </div>
  `,
})
export class FileUploadComponent {
  @Input()  accept    = '.jpg,.jpeg,.png,.pdf,.dcm';
  @Input()  maxSizeMB = 20;
  @Input()  patientPhone = '';
  @Output() uploaded  = new EventEmitter<string>();

  state: UploadState = 'idle';
  progress = 0;
  filename = '';
  errorMsg = '';

  constructor(private http: HttpClient) {}

  handleFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > this.maxSizeMB * 1024 * 1024) {
      this.state    = 'error';
      this.errorMsg = `File must be under ${this.maxSizeMB}MB`;
      return;
    }
    this.state    = 'uploading';
    this.filename = file.name;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('patient_phone', this.patientPhone);
    this.http.post<{ s3_key: string }>(
      `${environment.apiUrl}/uploads/xray`, fd,
      { reportProgress: true, observe: 'events' }
    ).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.progress = Math.round((event.loaded / (event.total || 1)) * 100);
        }
        if (event.type === HttpEventType.Response) {
          this.state = 'done';
          this.uploaded.emit((event.body as any).s3_key);
        }
      },
      error: () => {
        this.state    = 'error';
        this.errorMsg = 'Upload failed. Please try again.';
      },
    });
  }
}
```

---

## Skill 16 — JWT HTTP Interceptor (Admin)

```typescript
// projects/admin/src/app/interceptors/auth.interceptor.ts
import { Injectable }                           from '@angular/core';
import { HttpInterceptor, HttpRequest,
         HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap }  from 'rxjs/operators';
import { AuthService }                          from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshing     = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getAccessToken();
    const authed = token ? req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    }) : req;

    return next.handle(authed).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 && !req.url.includes('/auth/')) {
          return this.handle401(req, next);
        }
        return throwError(() => err);
      })
    );
  }

  private handle401(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.refreshing) {
      return this.refreshSubject.pipe(
        filter(t => t !== null), take(1),
        switchMap(t => next.handle(this.addToken(req, t!)))
      );
    }
    this.refreshing = true;
    this.refreshSubject.next(null);
    return this.auth.refresh().pipe(
      switchMap(token => {
        this.refreshing = false;
        this.refreshSubject.next(token);
        return next.handle(this.addToken(req, token));
      }),
      catchError(err => {
        this.refreshing = false;
        this.auth.logout();
        return throwError(() => err);
      })
    );
  }

  private addToken(req: HttpRequest<any>, token: string) {
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
}
```

**Register in admin AppModule:**
```typescript
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
],
```

---

## Skill 17 — Auth Service (Admin)

```typescript
// projects/admin/src/app/services/auth.service.ts
import { Injectable }   from '@angular/core';
import { HttpClient }   from '@angular/common/http';
import { Router }       from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { environment }  from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'access_token';
  private readonly api       = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<User> {
    return this.http.post<LoginResponse>(`${this.api}/auth/login`, { email, password },
                                         { withCredentials: true })
      .pipe(tap(r => sessionStorage.setItem(this.TOKEN_KEY, r.access_token)),
            map(r => r.user));
  }

  refresh(): Observable<string> {
    return this.http.post<{ access_token: string }>(
      `${this.api}/auth/refresh`, {}, { withCredentials: true }
    ).pipe(
      tap(r  => sessionStorage.setItem(this.TOKEN_KEY, r.access_token)),
      map(r  => r.access_token)
    );
  }

  logout(): void {
    this.http.post(`${this.api}/auth/logout`, {}, { withCredentials: true }).subscribe();
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null { return sessionStorage.getItem(this.TOKEN_KEY); }
  isLoggedIn(): boolean           { return !!this.getAccessToken(); }
}
```

---

## Skill 18 — Admin Schedule with Auto-Refresh

```typescript
// projects/admin/src/app/pages/schedule/schedule.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { AppointmentsService }          from '../../services/appointments.service';
import { interval, Subscription, switchMap, startWith } from 'rxjs';
import { formatISO }                    from 'date-fns';

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
})
export class ScheduleComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  loading = true;
  selectedChair = 0; // 0 = all
  today = formatISO(new Date(), { representation: 'date' });

  private sub!: Subscription;

  constructor(private apptService: AppointmentsService) {}

  ngOnInit(): void {
    // Auto-refresh every 60 seconds
    this.sub = interval(60_000).pipe(
      startWith(0),
      switchMap(() => this.apptService.getSchedule(this.today))
    ).subscribe({
      next:  (r) => { this.appointments = r.appointments; this.loading = false; },
      error: ()  => { this.loading = false; },
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get filtered(): Appointment[] {
    return this.selectedChair
      ? this.appointments.filter(a => a.chair_id === this.selectedChair)
      : this.appointments;
  }
}
```

---

## Skill 19 — Healing Window Countdown (Admin)

```typescript
// admin: healing-window-banner.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { differenceInDays, parseISO, isPast } from 'date-fns';

@Component({
  selector: 'app-healing-window-banner',
  template: `
    <ng-container *ngIf="show">
      <!-- Healing complete -->
      <div *ngIf="healed" class="banner banner-success">
        <span class="banner-icon">✓</span>
        <div>
          <p class="banner-title">Healing complete</p>
          <p class="banner-sub">Step 2 (Abutment Placement) can now be scheduled</p>
        </div>
      </div>

      <!-- Healing in progress -->
      <div *ngIf="!healed" class="banner banner-warning">
        <span class="banner-icon">🔒</span>
        <div class="banner-body">
          <p class="banner-title">Healing in progress — Step 2 blocked</p>
          <p class="banner-sub">
            Step 2 available in <strong>{{ daysLeft }} days</strong>
            · {{ healingWindowEnd | date:'d MMM yyyy' }}
          </p>
          <div class="progress-track">
            <div class="progress-fill" [style.width.%]="percent"></div>
          </div>
          <p class="banner-pct">{{ percent }}% of osseointegration period complete</p>
        </div>
      </div>
    </ng-container>
  `,
})
export class HealingWindowBannerComponent implements OnInit {
  @Input() caseType!: string;
  @Input() healingWindowEnd!: string;
  @Input() stepsCompleted!: number;

  show   = false;
  healed = false;
  daysLeft = 0;
  percent  = 0;

  ngOnInit(): void {
    if (this.caseType !== 'implant' || !this.healingWindowEnd) return;
    this.show    = true;
    const endDate = parseISO(this.healingWindowEnd);
    this.healed   = isPast(endDate);
    if (!this.healed) {
      this.daysLeft = Math.max(differenceInDays(endDate, new Date()), 0);
      const elapsed = 90 - this.daysLeft;
      this.percent  = Math.min(Math.round((elapsed / 90) * 100), 99);
    }
  }
}
```

---

## Skill 20 — Charts (ng2-charts + Chart.js)

```typescript
// admin: revenue-chart.component.ts
import { Component, Input, OnChanges } from '@angular/core';
import { ChartData, ChartOptions }     from 'chart.js';

@Component({
  selector: 'app-revenue-chart',
  template: `
    <div class="chart-card">
      <div class="chart-header">
        <h3>Revenue</h3>
        <div class="period-tabs">
          <button *ngFor="let p of periods"
                  [class.active]="period === p"
                  (click)="changePeriod(p)">
            {{ p | titlecase }}
          </button>
        </div>
      </div>
      <canvas baseChart
              [data]="chartData"
              [options]="chartOptions"
              type="bar">
      </canvas>
    </div>
  `,
})
export class RevenueChartComponent implements OnChanges {
  @Input() data: RevenuePoint[] = [];
  @Input() period = 'week';
  @Output() periodChange = new EventEmitter<string>();

  periods = ['day', 'week', 'month'];

  chartOptions: ChartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        ticks: {
          callback: (v) => `₹${Number(v) / 1000}k`,
        },
      },
    },
  };

  chartData: ChartData<'bar'> = { labels: [], datasets: [] };

  ngOnChanges(): void {
    this.chartData = {
      labels:   this.data.map(d => d.label),
      datasets: [{
        data:            this.data.map(d => d.total),
        backgroundColor: '#1A5FAB',
        borderRadius:    5,
      }],
    };
  }

  changePeriod(p: string): void { this.periodChange.emit(p); }
}
```

---

## Skill 21 — Shared UI Components

```typescript
// Shared button component (used in both apps)
@Component({
  selector: 'app-button',
  template: `
    <button [type]="type"
            [disabled]="disabled"
            [class]="'btn btn-' + variant"
            (click)="clicked.emit($event)">
      <ng-content></ng-content>
    </button>
  `,
})
export class ButtonComponent {
  @Input() type    = 'button';
  @Input() variant = 'primary';  // primary | secondary | danger | ghost
  @Input() disabled = false;
  @Output() clicked = new EventEmitter<MouseEvent>();
}

// Status badge pipe (admin)
@Pipe({ name: 'statusColor' })
export class StatusColorPipe implements PipeTransform {
  transform(status: string): string {
    const map: Record<string, string> = {
      booked:      'badge-blue',
      confirmed:   'badge-green',
      in_progress: 'badge-amber',
      done:        'badge-gray',
      no_show:     'badge-red',
      cancelled:   'badge-light',
    };
    return map[status] || 'badge-gray';
  }
}
```

---

## Skill 22 — IST Date Formatting (Both Apps)

```typescript
// shared/utils/date.utils.ts
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, differenceInDays, isPast } from 'date-fns';

const IST = 'Asia/Kolkata';

export const toISTDate      = (d: string) => formatInTimeZone(parseISO(d), IST, 'd MMM yyyy');
export const toISTDateTime  = (d: string) => formatInTimeZone(parseISO(d), IST, 'd MMM yyyy, h:mm a');
export const toISTTime      = (d: string) => formatInTimeZone(parseISO(d), IST, 'h:mm a');
export const toISTDayFull   = (d: string) => formatInTimeZone(parseISO(d), IST, 'EEEE, d MMMM yyyy');
export const isOverdue      = (d: string) => isPast(parseISO(d));
export const daysUntil      = (d: string) => differenceInDays(parseISO(d), new Date());

// Angular pipe wrapper
@Pipe({ name: 'istDate' })
export class ISTDatePipe implements PipeTransform {
  transform(value: string, format = 'datetime'): string {
    if (!value) return '';
    const fns: Record<string, (d: string) => string> = {
      date:     toISTDate,
      datetime: toISTDateTime,
      time:     toISTTime,
      day:      toISTDayFull,
    };
    return (fns[format] || toISTDateTime)(value);
  }
}
```

**Install required:**
```bash
npm install date-fns date-fns-tz
```

---

## Skill 23 — Environment Files + Build Configuration

**`angular.json` file replacements per environment:**
```json
"configurations": {
  "production": {
    "fileReplacements": [
      {
        "replace": "projects/booking-form/src/environments/environment.ts",
        "with":    "projects/booking-form/src/environments/environment.production.ts"
      }
    ],
    "optimization": true,
    "outputHashing": "all",
    "sourceMap": false,
    "budgets": [
      { "type": "initial",    "maximumWarning": "500kb", "maximumError": "1mb" },
      { "type": "anyComponentStyle", "maximumWarning": "4kb" }
    ]
  }
}
```

**Never hardcode API URLs in components** — always use `environment.apiUrl`.

---

## Skill 24 — Angular Build Optimisation + Lazy Loading

```typescript
// Lazy loading every admin page module
// admin-routing.module.ts — each path uses loadChildren
{
  path: 'analytics',
  loadChildren: () =>
    import('./pages/analytics/analytics.module').then(m => m.AnalyticsModule),
}

// Common module pattern — import heavy libs (charts) only in their module
// analytics.module.ts
@NgModule({
  imports: [
    NgChartsModule,   // only imported here, not in AppModule
    CommonModule,
    AnalyticsRoutingModule,
  ],
  declarations: [AnalyticsComponent, RevenueChartComponent],
})
export class AnalyticsModule {}
```

**Build & analyse:**
```bash
# Production build
ng build admin --configuration=production --stats-json

# Analyse bundle (optional)
npx webpack-bundle-analyzer dist/admin/stats.json
```

---

*Frontend Skills — Sharayu Dental Clinic v3.0 · April 2026 · Akib Tamboli*  
*Repo: sharayu-frontend/ · Stack: Angular 17+ · TypeScript · RxJS · date-fns*  
*booking-form/: no routing, single component state machine · admin/: lazy-loaded modules, JWT interceptor*
