import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpErrorResponse } from '@angular/common/http';
import { addDays, format, isSunday } from 'date-fns';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AppointmentsService, BookingPayload, Slot } from '../../services/appointments.service';
import { PatientsService } from '../../services/patients.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { ClinicsService } from '../../services/clinics.service';
import { authApiConfig } from '../../auth/auth.config';

export interface BookingServiceOption {
  id: string;
  label: string;
}

interface DateOption {
  iso: string;
  label: string;
  shortDay: string;
  disabled: boolean;
}

// ── Intake option lists ───────────────────────────────────────────────────────

export const LAST_VISIT_OPTIONS = [
  'Less than 6 months ago',
  '6–12 months ago',
  '1–2 years ago',
  'More than 2 years ago',
  'First time visiting a dentist',
];

export const ALLERGY_OPTIONS = [
  'Latex / Rubber',
  'Penicillin / Antibiotics',
  'Local anaesthetics (Lidocaine)',
  'Nickel / Metal alloys',
  'Acrylic resin',
  'Aspirin / NSAIDs',
  'None known',
];

export const SENSITIVITY_OPTIONS = [
  'No sensitivity',
  'Hot or cold sensitivity',
  'Sensitivity to sweet foods',
  'Pain while chewing',
  'Spontaneous or throbbing pain',
];

export const YES_NO_OPTIONS    = ['Yes', 'No', 'Not sure'];
export const PAIN_OPTIONS      = ['None', 'Mild', 'Moderate', 'Severe'];
export const GUM_BLEED_OPTIONS = ['Yes', 'No', 'Sometimes'];

export const ORTHO_CONCERN_OPTIONS = [
  'Crowding',
  'Spacing / gaps',
  'Overbite',
  'Underbite',
  'Crossbite',
  'Aesthetics / smile',
];

// ── Plain intake model ────────────────────────────────────────────────────────

interface IntakeModel {
  last_dental_visit:         string;
  known_allergies:           string[];
  dental_sensitivity:        string;
  blood_thinning_medication: string;
  pain_level:                string;
  previous_treatment:        string;
  impacted_tooth:            string;
  gum_bleeding:              string;
  ortho_previous:            string;
  ortho_concern:             string;
  diabetic:                  string;
  restoration_old_filling:   string;
  teeth_grinding:            string;
  previous_whitening:        string;
  child_age:                 string;
  anxiety_previous:          string;
}

function emptyIntake(): IntakeModel {
  return {
    last_dental_visit:         '',
    known_allergies:           [],
    dental_sensitivity:        '',
    blood_thinning_medication: '',
    pain_level:                '',
    previous_treatment:        '',
    impacted_tooth:            '',
    gum_bleeding:              '',
    ortho_previous:            '',
    ortho_concern:             '',
    diabetic:                  '',
    restoration_old_filling:   '',
    teeth_grinding:            '',
    previous_whitening:        '',
    child_age:                 '',
    anxiety_previous:          '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './booking.component.html',
})
export class BookingComponent implements OnInit, OnDestroy {
  private route          = inject(ActivatedRoute);
  private router         = inject(Router);
  private clinicServices = inject(ClinicServicesService);
  private chairsService  = inject(ChairsService);
  private clinicsService = inject(ClinicsService);

  // ── Pill option lists ───────────────────────────────────────────────────────
  readonly lastVisitOptions    = LAST_VISIT_OPTIONS;
  readonly allergyOptions      = ALLERGY_OPTIONS;
  readonly sensitivityOptions  = SENSITIVITY_OPTIONS;
  readonly yesNoOptions        = YES_NO_OPTIONS;
  readonly painOptions         = PAIN_OPTIONS;
  readonly gumBleedOptions     = GUM_BLEED_OPTIONS;
  readonly orthoConcernOptions = ORTHO_CONCERN_OPTIONS;

  services: BookingServiceOption[] = [];
  servicesLoading = false;
  servicesError   = '';
  metaError       = '';

  clinicId:       string | null = null;
  defaultChairId: string | null = null;

  dates: DateOption[] = [];

  selectedService: string | null = null;
  selectedDate:    string | null = null;
  selectedSlot:    string | null = null;
  slots:       Slot[] = [];
  slotsLoading = false;
  slotsError   = '';
  slotConflict = '';
  welcomeBack  = '';

  patientForm!: FormGroup;
  patientSaved = false;
  patientData: { name: string; phone: string; email: string } | null = null;

  intake: IntakeModel = emptyIntake();
  intakeSaved   = false;
  intakePayload: Record<string, unknown> = {};

  submitting    = false;
  submitError   = '';
  submitted     = false;
  bookingSource = 'direct';
  confirmedTime    = '';
  confirmedService = '';
  redirectCountdown = 5;
  private redirectTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private apptService: AppointmentsService,
    private patientsService: PatientsService
  ) {}

  ngOnInit() {
    this.buildForms();
    const q = this.route.snapshot.queryParamMap;
    this.bookingSource = q.get('ref') ?? 'direct';

    const explicit = (
      q.get('clinic') ??
      q.get('clinic_id') ??
      authApiConfig.publicBookingClinicId ??
      ''
    ).trim();

    if (explicit) {
      this.clinicId = explicit;
      this.loadServicesAndChairs(q);
      return;
    }

    this.servicesLoading = true;
    this.metaError = '';
    this.clinicsService.get().subscribe({
      next: (r) => {
        const id = r.clinic?.id?.trim();
        if (!id) {
          this.servicesLoading = false;
          this.metaError = 'No clinic is available. Use /booking?clinic=<clinic-uuid> or contact the clinic.';
          return;
        }
        this.clinicId = id;
        this.loadServicesAndChairs(q);
      },
      error: () => {
        this.servicesLoading = false;
        this.metaError = 'Could not load clinic automatically. Ask the clinic for the booking link.';
      },
    });
  }

  ngOnDestroy() {
    if (this.redirectTimer) clearInterval(this.redirectTimer);
  }

  private loadServicesAndChairs(q: ParamMap) {
    if (!this.clinicId) return;
    this.servicesLoading = true;
    this.servicesError   = '';
    this.metaError       = '';

    forkJoin({
      services: this.clinicServices.list(this.clinicId),
      chairs:   this.chairsService.list(this.clinicId),
    }).subscribe({
      next: ({ services: svcRes, chairs: chairRes }) => {
        this.services = (svcRes.services ?? [])
          .filter(s => s.is_active !== false)
          .map(s => ({ id: s.id, label: s.name }));

        const chairs = chairRes.chairs ?? [];
        const pick   = chairs.filter(c => c.is_active !== false)[0] ?? chairs[0];
        this.defaultChairId = pick?.id ?? null;

        if (!this.defaultChairId) {
          this.metaError = 'No chairs are configured for this clinic.';
        }

        const svcParam = q.get('service');
        if (svcParam && this.services.some(s => s.id === svcParam)) {
          this.selectedService = svcParam;
        }

        this.servicesLoading = false;
      },
      error: () => {
        this.servicesError   = 'Could not load treatments or chairs for this clinic.';
        this.servicesLoading = false;
      },
    });
  }

  private buildForms() {
    this.dates = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(new Date(), i + 1);
      return {
        iso:      format(d, 'yyyy-MM-dd'),
        label:    format(d, 'd'),
        shortDay: format(d, 'EEE'),
        disabled: isSunday(d),
      };
    });

    this.patientForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      name:  ['', [Validators.required, Validators.minLength(2)]],
      email: ['', Validators.email],
    });
  }

  // ── Step visibility ─────────────────────────────────────────────────────────

  get showDate()       { return !!this.selectedService && !!this.defaultChairId; }
  get showSlot()       { return !!this.selectedDate; }
  get showPatient()    { return !!this.selectedSlot; }
  get showIntakeForm() { return this.patientSaved && !this.intakeSaved; }
  get showSummary()    { return this.patientSaved && this.intakeSaved; }

  // ── Service-specific intake sections ───────────────────────────────────────

  private get svcKey(): string { return this.serviceLabel.toLowerCase(); }

  get showRctQuestions():         boolean { return /root.canal|rct|endodontic/.test(this.svcKey); }
  get showExtractionQuestions():  boolean { return /extract|pull|remov/.test(this.svcKey); }
  get showOrthoQuestions():       boolean { return /ortho|brace|aligner/.test(this.svcKey); }
  get showImplantQuestions():     boolean { return /implant/.test(this.svcKey); }
  get showCleaningQuestions():    boolean { return /oral|prophylaxis|clean|scale/.test(this.svcKey); }
  get showRestorationQuestions(): boolean { return /restor|fill|composit/.test(this.svcKey); }
  get showCrownQuestions():       boolean { return /crown|cap/.test(this.svcKey); }
  get showWhiteningQuestions():   boolean { return /bleach|whiten/.test(this.svcKey); }
  get showPedoQuestions():        boolean { return /pulpect|pulp|baby|pedo/.test(this.svcKey); }

  // ── Pill selection helpers ─────────────────────────────────────────────────

  selectPill(field: keyof IntakeModel, value: string) {
    // Toggle: clicking the active pill deselects it
    (this.intake as unknown as Record<string, unknown>)[field] =
      this.intake[field] === value ? '' : value;
  }

  toggleAllergy(value: string) {
    const list = this.intake.known_allergies;
    const idx  = list.indexOf(value);
    if (idx === -1) {
      this.intake.known_allergies = [...list, value];
    } else {
      this.intake.known_allergies = list.filter(v => v !== value);
    }
  }

  isSelected(field: keyof IntakeModel, value: string): boolean {
    return this.intake[field] === value;
  }

  isAllergySelected(value: string): boolean {
    return this.intake.known_allergies.includes(value);
  }

  // ── Flow actions ────────────────────────────────────────────────────────────

  onServiceChange(svcId: string) {
    this.selectedService = svcId;
    this.selectedDate    = null;
    this.selectedSlot    = null;
    this.slots           = [];
    this.slotConflict    = '';
    this.patientData     = null;
    this.patientSaved    = false;
    this.intakeSaved     = false;
    this.intake          = emptyIntake();
  }

  onDateSelect(iso: string) {
    this.selectedDate = iso;
    this.selectedSlot = null;
    this.slotConflict = '';
    this.loadSlots();
  }

  loadSlots() {
    if (!this.selectedDate || !this.selectedService || !this.defaultChairId) return;
    this.slotsLoading = true;
    this.slotsError   = '';
    this.apptService.getSlots(this.selectedDate, this.selectedService, this.defaultChairId).subscribe({
      next:  (r) => { this.slots = r.slots ?? []; this.slotsLoading = false; },
      error: ()  => { this.slotsError = 'Failed to load slots. Please try again.'; this.slotsLoading = false; },
    });
  }

  onSlotSelect(slot: Slot) {
    if (slot.taken) return;
    this.selectedSlot = slot.time;
    this.slotConflict = '';
  }

  onPhoneBlur() {
    const phone = this.patientForm.get('phone')?.value;
    if (!phone || phone.length < 10) return;
    this.patientsService.lookupByPhone(phone).subscribe({
      next: (r) => {
        if (r.found && r.patient) {
          this.patientForm.patchValue({ name: r.patient.name, email: r.patient.email ?? '' });
          this.welcomeBack = `Welcome back, ${r.patient.name}!`;
        } else {
          this.welcomeBack = '';
        }
      },
      error: () => { /* silent */ },
    });
  }

  submitPatient() {
    if (this.patientForm.invalid) { this.patientForm.markAllAsTouched(); return; }
    this.patientData  = {
      name:  this.patientForm.value.name,
      phone: this.patientForm.value.phone,
      email: this.patientForm.value.email ?? '',
    };
    this.patientSaved = true;
  }

  submitIntake() {
    const data: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(this.intake)) {
      if (val !== '' && val !== null && val !== undefined) {
        if (Array.isArray(val) && val.length === 0) continue;
        data[key] = val;
      }
    }
    this.intakePayload = data;
    this.intakeSaved   = true;
  }

  skipIntake() {
    this.intakePayload = {};
    this.intakeSaved   = true;
  }

  // ── Labels ──────────────────────────────────────────────────────────────────

  get serviceLabel(): string {
    return this.services.find(s => s.id === this.selectedService)?.label ?? '';
  }

  get formattedDate(): string {
    return this.selectedDate
      ? format(new Date(this.selectedDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')
      : '';
  }

  // ── Booking submission ──────────────────────────────────────────────────────

  submitBooking() {
    if (!this.selectedService || !this.selectedDate || !this.selectedSlot ||
        !this.patientData || !this.defaultChairId) return;

    this.submitting  = true;
    this.submitError = '';

    this.apptService.getSlots(this.selectedDate, this.selectedService, this.defaultChairId).subscribe({
      next: (r) => {
        this.slots = r.slots ?? [];
        const fresh = this.slots.find(s => s.time === this.selectedSlot);
        if (!fresh || fresh.taken) {
          this.selectedSlot = null;
          this.slotConflict = 'This slot was just taken. Please choose another time.';
          this.submitting   = false;
          document.querySelector('.slots-section')?.scrollIntoView({ behavior: 'smooth' });
          return;
        }
        this.doBook();
      },
      error: () => { this.doBook(); },
    });
  }

  private doBook() {
    const payload: BookingPayload = {
      service_id:     this.selectedService!,
      chair_id:       this.defaultChairId!,
      scheduled_at:   `${this.selectedDate}T${this.selectedSlot}:00`,
      booking_source: this.bookingSource,
      patient:        this.patientData!,
      intake_data:    this.intakePayload,
    };

    this.apptService.book(payload).subscribe({
      next: () => {
        this.confirmedTime    = `${this.formattedDate} at ${this.selectedSlot}`;
        this.confirmedService = this.serviceLabel;
        this.submitted        = true;
        this.submitting       = false;
        this.startRedirectCountdown();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.selectedSlot = null;
          this.slotConflict = 'This slot was just taken. Please choose another time.';
          this.loadSlots();
          document.querySelector('.slots-section')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          this.submitError = 'Booking failed. Please try again or call us directly.';
        }
        this.submitting = false;
      },
    });
  }

  private startRedirectCountdown() {
    this.redirectCountdown = 5;
    this.redirectTimer = setInterval(() => {
      this.redirectCountdown--;
      if (this.redirectCountdown <= 0) {
        clearInterval(this.redirectTimer!);
        this.redirectTimer = null;
        this.router.navigate(['/schedule']);
      }
    }, 1000);
  }

  resetAll() {
    if (this.redirectTimer) { clearInterval(this.redirectTimer); this.redirectTimer = null; }
    this.selectedService = null;
    this.selectedDate    = null;
    this.selectedSlot    = null;
    this.slots           = [];
    this.patientData     = null;
    this.patientSaved    = false;
    this.intakeSaved     = false;
    this.intake          = emptyIntake();
    this.intakePayload   = {};
    this.patientForm.reset();
    this.submitted   = false;
    this.submitError = '';
    this.welcomeBack = '';
    this.slotConflict = '';
    window.scrollTo(0, 0);
  }
}
