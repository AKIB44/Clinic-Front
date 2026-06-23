import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpErrorResponse } from '@angular/common/http';
import { addDays, format } from 'date-fns';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, filter } from 'rxjs/operators';
import { Router, RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger, state } from '@angular/animations';
import { AppointmentsService, BookingPayload, Slot } from '../../services/appointments.service';
import { PatientsService } from '../../services/patients.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { AuthService } from '../../auth/auth.service';
import { ClinicService, Chair } from '../../models/clinic.model';
import { formatSlotTime12h } from '../../utils/appointment-time';

// ── Types ────────────────────────────────────────────────────────────────────

interface DateOption {
  iso: string;
  label: string;
  shortDay: string;
  disabled: boolean;
}

interface SlotGroup {
  label: string;
  icon: string;
  slots: Slot[];
}

interface IntakeModel {
  last_dental_visit: string;
  known_allergies: string[];
  dental_sensitivity: string;
  blood_thinning_medication: string;
  pain_level: string;
  previous_treatment: string;
  impacted_tooth: string;
  gum_bleeding: string;
  ortho_previous: string;
  ortho_concern: string;
  diabetic: string;
  restoration_old_filling: string;
  teeth_grinding: string;
  previous_whitening: string;
  child_age: string;
  anxiety_previous: string;
}

/** Persisted across page reload (sessionStorage). Files are not stored. */
interface BookingDraft {
  step: number;
  serviceId: string | null;
  selectedDate: string | null;
  selectedSlot: string | null;
  selectedChairId: string | null;
  serviceSearch: string;
  patientForm: Record<string, unknown>;
  intake: IntakeModel;
  intakeExpanded: boolean;
  welcomeBack: string;
  patientSaved: boolean;
  patientData: BookingComponent['patientData'];
}

const BOOKING_DRAFT_PREFIX = 'df_booking_draft_';

// ── Service visual map ───────────────────────────────────────────────────────

const SERVICE_VISUALS: { pattern: RegExp; icon: string; gradient: string; emoji: string }[] = [
  { pattern: /clean|scale|prophylaxis|oral hygiene/i,  icon: 'sparkles',         gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', emoji: '✨' },
  { pattern: /root.canal|rct|endodontic/i,              icon: 'tooth',            gradient: 'linear-gradient(135deg,#f43f5e,#e11d48)', emoji: '🦷' },
  { pattern: /extract|removal|pull/i,                   icon: 'medical-cross',    gradient: 'linear-gradient(135deg,#f97316,#ea580c)', emoji: '🔴' },
  { pattern: /ortho|brace|aligner|invisalign/i,         icon: 'align-center',     gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', emoji: '📐' },
  { pattern: /implant/i,                                icon: 'bolt',             gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)', emoji: '⚡' },
  { pattern: /crown|cap|veneer/i,                       icon: 'crown',            gradient: 'linear-gradient(135deg,#eab308,#ca8a04)', emoji: '👑' },
  { pattern: /whiten|bleach/i,                          icon: 'sun',              gradient: 'linear-gradient(135deg,#fbbf24,#f59e0b)', emoji: '☀️' },
  { pattern: /fill|restor|composit/i,                   icon: 'pencil',           gradient: 'linear-gradient(135deg,#10b981,#059669)', emoji: '✏️' },
  { pattern: /x.?ray|radio|imaging/i,                   icon: 'scan',             gradient: 'linear-gradient(135deg,#64748b,#475569)', emoji: '📡' },
  { pattern: /consult|check|exam/i,                     icon: 'stethoscope',      gradient: 'linear-gradient(135deg,#14b8a6,#0d9488)', emoji: '🩺' },
  { pattern: /child|pedo|baby/i,                        icon: 'heart',            gradient: 'linear-gradient(135deg,#ec4899,#db2777)', emoji: '💖' },
  { pattern: /surgery|surgical/i,                       icon: 'scalpel',          gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', emoji: '🏥' },
];

const DEFAULT_VISUAL = { icon: 'tooth', gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)', emoji: '🦷' };

function getServiceVisual(name: string) {
  return SERVICE_VISUALS.find(v => v.pattern.test(name)) ?? DEFAULT_VISUAL;
}

// ── Intake option lists ──────────────────────────────────────────────────────

const LAST_VISIT_OPTIONS = ['Less than 6 months ago', '6–12 months ago', '1–2 years ago', 'More than 2 years ago', 'First time visiting a dentist'];
const ALLERGY_OPTIONS    = ['Latex / Rubber', 'Penicillin / Antibiotics', 'Local anaesthetics (Lidocaine)', 'Nickel / Metal alloys', 'Acrylic resin', 'Aspirin / NSAIDs', 'None known'];
const SENSITIVITY_OPTIONS = ['No sensitivity', 'Hot or cold sensitivity', 'Sensitivity to sweet foods', 'Pain while chewing', 'Spontaneous or throbbing pain'];
const YES_NO_OPTIONS     = ['Yes', 'No', 'Not sure'];
const PAIN_OPTIONS       = ['None', 'Mild', 'Moderate', 'Severe'];
const GUM_BLEED_OPTIONS  = ['Yes', 'No', 'Sometimes'];
const ORTHO_CONCERN_OPTIONS = ['Crowding', 'Spacing / gaps', 'Overbite', 'Underbite', 'Crossbite', 'Aesthetics / smile'];

function emptyIntake(): IntakeModel {
  return {
    last_dental_visit: '', known_allergies: [], dental_sensitivity: '',
    blood_thinning_medication: '', pain_level: '', previous_treatment: '',
    impacted_tooth: '', gum_bleeding: '', ortho_previous: '', ortho_concern: '',
    diabetic: '', restoration_old_filling: '', teeth_grinding: '',
    previous_whitening: '', child_age: '', anxiety_previous: '',
  };
}

// ── Animations ───────────────────────────────────────────────────────────────

const stepAnimation = trigger('stepSlide', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(40px)' }),
    animate('320ms cubic-bezier(0.35,0,0.25,1)', style({ opacity: 1, transform: 'translateX(0)' })),
  ]),
  transition(':leave', [
    animate('240ms cubic-bezier(0.35,0,0.25,1)', style({ opacity: 0, transform: 'translateX(-40px)' })),
  ]),
]);

const cardsAnimation = trigger('cardsList', [
  transition(':enter', [
    query('.svc-card', [
      style({ opacity: 0, transform: 'translateY(20px) scale(0.94)' }),
      stagger(45, [
        animate('360ms cubic-bezier(0.22,1,0.36,1)', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
    ], { optional: true }),
  ]),
]);

const slotsAnimation = trigger('slotsIn', [
  transition(':enter', [
    query('.slot-chip', [
      style({ opacity: 0, transform: 'translateY(10px)' }),
      stagger(25, [
        animate('220ms cubic-bezier(0.22,1,0.36,1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ], { optional: true }),
  ]),
]);

const fadeUp = trigger('fadeUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate('280ms cubic-bezier(0.22,1,0.36,1)', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

const confirmAnim = trigger('confirmIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.88)' }),
    animate('480ms cubic-bezier(0.34,1.56,0.64,1)', style({ opacity: 1, transform: 'scale(1)' })),
  ]),
]);

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, ReactiveFormsModule, MaterialModule, TablerIconsModule, RouterLink],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [stepAnimation, cardsAnimation, confirmAnim, slotsAnimation, fadeUp],
})
export class BookingComponent implements OnInit, OnDestroy {
  private router         = inject(Router);
  private clinicSvc      = inject(ClinicServicesService);
  private chairsSvc      = inject(ChairsService);
  private auth           = inject(AuthService);
  private apptService    = inject(AppointmentsService);
  private patientsService = inject(PatientsService);
  private fb             = inject(FormBuilder);
  private cdr            = inject(ChangeDetectorRef);

  // ── Step ─────────────────────────────────────────────────────────────────
  readonly step = signal<1 | 2 | 3 | 4>(1);

  // ── Services ──────────────────────────────────────────────────────────────
  readonly services        = signal<ClinicService[]>([]);
  readonly servicesLoading = signal(false);
  readonly metaError       = signal('');
  readonly serviceSearch   = signal('');
  readonly filteredServices = computed(() => {
    const term = this.serviceSearch().trim().toLowerCase();
    if (!term) return this.services();
    return this.services().filter(s => s.name.toLowerCase().includes(term));
  });

  // ── Dates ─────────────────────────────────────────────────────────────────
  readonly todayIso = format(new Date(), 'yyyy-MM-dd');
  readonly dates: DateOption[] = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(new Date(), i);
    return { iso: format(d, 'yyyy-MM-dd'), label: format(d, 'd'), shortDay: format(d, 'EEE'), disabled: false };
  });

  // ── Selection state ───────────────────────────────────────────────────────
  readonly selectedService = signal<ClinicService | null>(null);
  readonly selectedDate    = signal<string | null>(null);
  readonly selectedSlot    = signal<string | null>(null);

  // ── Slots ─────────────────────────────────────────────────────────────────
  readonly slots        = signal<Slot[]>([]);
  readonly slotsLoading = signal(false);
  readonly slotsError   = signal('');
  readonly slotConflict = signal('');

  readonly slotGroups = computed<SlotGroup[]>(() => {
    const all = this.slots();
    const morning   = all.filter(s => { const h = +s.time.split(':')[0]; return h >= 7 && h < 12; });
    const afternoon = all.filter(s => { const h = +s.time.split(':')[0]; return h >= 12 && h < 17; });
    const evening   = all.filter(s => { const h = +s.time.split(':')[0]; return h >= 17; });
    return [
      { label: 'Morning', icon: 'sunrise', slots: morning },
      { label: 'Afternoon', icon: 'sun', slots: afternoon },
      { label: 'Evening', icon: 'sunset', slots: evening },
    ].filter(g => g.slots.length > 0);
  });

  readonly hasSelectableSlots = computed(() => {
    const date = this.selectedDate();
    if (!date) return false;
    return this.slots().some(s => this.isSlotSelectable(s, date));
  });

  // ── Patient ───────────────────────────────────────────────────────────────
  patientForm!: FormGroup;
  readonly welcomeBack  = signal('');
  readonly patientSaved = signal(false);
  patientData: { name: string; phone: string; email: string; age?: number; gender?: string; address?: string; clinical_history?: string } | null = null;

  // ── Clinical file attachments ─────────────────────────────────────────────
  readonly clinicalFiles = signal<File[]>([]);
  isDragging = false;

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files) this.addFiles(Array.from(files));
  }

  private addFiles(incoming: File[]) {
    const MAX_BYTES = 10 * 1024 * 1024;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const valid = incoming.filter(f => allowed.includes(f.type) && f.size <= MAX_BYTES);
    const existing = this.clinicalFiles();
    const merged = [...existing];
    for (const f of valid) {
      if (!merged.some(e => e.name === f.name && e.size === f.size)) merged.push(f);
    }
    this.clinicalFiles.set(merged.slice(0, 5));
    this.cdr.markForCheck();
  }

  removeFile(file: File) {
    this.clinicalFiles.set(this.clinicalFiles().filter(f => f !== file));
  }

  fileIcon(f: File): string {
    return f.type === 'application/pdf' ? 'file-type-pdf' : 'photo';
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // ── Intake ────────────────────────────────────────────────────────────────
  intake: IntakeModel = emptyIntake();
  readonly intakeExpanded = signal(false);
  intakePayload: Record<string, unknown> = {};

  readonly genderOptions = [
    { value: 'male',   label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other',  label: 'Other' },
  ];

  readonly lastVisitOptions    = LAST_VISIT_OPTIONS;
  readonly allergyOptions      = ALLERGY_OPTIONS;
  readonly sensitivityOptions  = SENSITIVITY_OPTIONS;
  readonly yesNoOptions        = YES_NO_OPTIONS;
  readonly painOptions         = PAIN_OPTIONS;
  readonly gumBleedOptions     = GUM_BLEED_OPTIONS;
  readonly orthoConcernOptions = ORTHO_CONCERN_OPTIONS;

  // ── Submission ────────────────────────────────────────────────────────────
  readonly submitting   = signal(false);
  readonly submitError  = signal('');
  readonly submitted    = signal(false);
  confirmedTime    = '';
  confirmedService = '';
  confirmedDateIso = '';
  redirectCountdown = 5;
  private redirectTimer: ReturnType<typeof setInterval> | null = null;

  // ── Chairs ────────────────────────────────────────────────────────────────
  readonly chairs           = signal<Chair[]>([]);
  readonly selectedChairId  = signal<string | null>(null);
  readonly selectedChair    = computed(() =>
    this.chairs().find(c => c.id === this.selectedChairId()) ?? null
  );

  readonly lookupBusy = signal(false);
  private readonly destroy$ = new Subject<void>();
  private draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed labels ───────────────────────────────────────────────────────
  readonly serviceLabel = computed(() => this.selectedService()?.name ?? '');
  readonly formattedDate = computed(() =>
    this.selectedDate()
      ? format(new Date(this.selectedDate()! + 'T00:00:00'), 'EEEE, d MMMM yyyy')
      : ''
  );

  readonly steps = [
    { num: 1, label: 'Treatment' },
    { num: 2, label: 'Date & Time' },
    { num: 3, label: 'Details' },
    { num: 4, label: 'Confirm' },
  ];

  readonly ageMin = 1;
  readonly ageMax = 150;

  ngOnInit() {
    this.patientForm = this.fb.group({
      name:             ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z\s]+$/)]],
      phone:            ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      age:              [null, [Validators.required, Validators.min(this.ageMin), Validators.max(this.ageMax)]],
      gender:           ['', Validators.required],
      address:          ['', Validators.required],
      email:            ['', Validators.email],
      clinical_history: [''],
    });

    this.loadServicesAndChairs();

    this.patientForm.valueChanges
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.scheduleSaveDraft());
    this.patientForm.get('phone')!.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        filter((v: string) => !!v && /^[6-9]\d{9}$/.test(v)),
        switchMap((phone: string) => {
          this.lookupBusy.set(true);
          this.cdr.markForCheck();
          return this.patientsService.search(phone);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: r => this.applyLookup(r.patients ?? []),
        error: () => { this.lookupBusy.set(false); this.cdr.markForCheck(); },
      });

    // Re-evaluate match when the name is edited (same phone, different person).
    this.patientForm.get('name')!.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        const phone = this.patientForm.get('phone')?.value;
        if (phone && /^[6-9]\d{9}$/.test(phone)) {
          this.patientsService.search(phone).subscribe({
            next: r => this.applyLookup(r.patients ?? [], { skipNamePatch: true }),
          });
        }
      });
  }

  ngOnDestroy() {
    if (this.redirectTimer) clearInterval(this.redirectTimer);
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private draftKey(): string {
    return `${BOOKING_DRAFT_PREFIX}${this.auth.getActiveClinicId() ?? 'default'}`;
  }

  private scheduleSaveDraft(): void {
    if (this.submitted()) return;
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.saveDraft();
      this.draftSaveTimer = null;
    }, 280);
  }

  private saveDraft(): void {
    if (this.submitted() || !this.patientForm) return;
    const draft: BookingDraft = {
      step: this.step(),
      serviceId: this.selectedService()?.id ?? null,
      selectedDate: this.selectedDate(),
      selectedSlot: this.selectedSlot(),
      selectedChairId: this.selectedChairId(),
      serviceSearch: this.serviceSearch(),
      patientForm: this.patientForm.getRawValue(),
      intake: { ...this.intake, known_allergies: [...this.intake.known_allergies] },
      intakeExpanded: this.intakeExpanded(),
      welcomeBack: this.welcomeBack(),
      patientSaved: this.patientSaved(),
      patientData: this.patientData,
    };
    try {
      sessionStorage.setItem(this.draftKey(), JSON.stringify(draft));
    } catch { /* quota — ignore */ }
  }

  private restoreDraft(): void {
    if (!this.patientForm) return;
    const raw = sessionStorage.getItem(this.draftKey());
    if (!raw) return;

    try {
      const d = JSON.parse(raw) as BookingDraft;
      if (d.serviceId) {
        const svc = this.services().find(s => s.id === d.serviceId);
        if (!svc) { this.clearDraft(); return; }
        this.selectedService.set(svc);
      } else if (d.step > 1) {
        this.clearDraft();
        return;
      }

      if (d.selectedChairId) {
        const chairOk = this.chairs().some(c => c.id === d.selectedChairId);
        if (chairOk) this.selectedChairId.set(d.selectedChairId);
      }

      if (d.selectedDate) this.selectedDate.set(d.selectedDate);
      if (d.selectedSlot) this.selectedSlot.set(d.selectedSlot);
      if (d.serviceSearch) this.serviceSearch.set(d.serviceSearch);

      if (d.intake) {
        this.intake = { ...emptyIntake(), ...d.intake };
        if (!Array.isArray(this.intake.known_allergies)) this.intake.known_allergies = [];
      }
      if (d.intakeExpanded) this.intakeExpanded.set(d.intakeExpanded);
      if (d.welcomeBack) this.welcomeBack.set(d.welcomeBack);
      if (d.patientData) this.patientData = d.patientData;
      if (d.patientSaved) this.patientSaved.set(d.patientSaved);

      if (d.patientForm) {
        this.patientForm.patchValue(d.patientForm, { emitEvent: false });
      }

      let step = Math.min(4, Math.max(1, d.step ?? 1)) as 1 | 2 | 3 | 4;
      if (step >= 2 && !this.selectedService()) step = 1;
      if (step >= 3 && (!this.selectedDate() || !this.selectedSlot())) step = 2;
      if (step === 4 && !this.patientData) step = 3;
      this.step.set(step);

      if (this.selectedDate() && this.selectedService() && this.selectedChairId()) {
        this.loadSlots();
      }
    } catch {
      this.clearDraft();
    }
  }

  private clearDraft(): void {
    try { sessionStorage.removeItem(this.draftKey()); } catch { /* ignore */ }
  }

  private applyLookup(matches: { id: string; name: string; email?: string; age?: number; gender?: string; address?: string; clinical_history?: string }[], opts: { skipNamePatch?: boolean } = {}) {
    this.lookupBusy.set(false);
    const typedName = (this.patientForm.get('name')?.value ?? '').trim().toLowerCase();
    const exact = typedName
      ? matches.find(p => p.name.trim().toLowerCase() === typedName)
      : (matches.length === 1 ? matches[0] : undefined);

    if (exact) {
      const patch: Record<string, unknown> = {
        email:            exact.email ?? '',
        age:              exact.age != null
          ? Math.min(this.ageMax, Math.max(this.ageMin, exact.age))
          : null,
        gender:           exact.gender ?? '',
        address:          exact.address ?? '',
        clinical_history: exact.clinical_history ?? '',
      };
      if (!opts.skipNamePatch) patch['name'] = exact.name;
      this.patientForm.patchValue(patch, { emitEvent: false });
      this.welcomeBack.set(`Welcome back, ${exact.name}!`);
    } else if (matches.length > 0 && typedName) {
      this.welcomeBack.set(`New patient — phone shared with ${matches.length} other record${matches.length > 1 ? 's' : ''}`);
    } else {
      this.welcomeBack.set('');
    }
    this.cdr.markForCheck();
  }

  private loadServicesAndChairs() {
    const clinicId = this.auth.getActiveClinicId() ?? undefined;
    this.servicesLoading.set(true);
    this.metaError.set('');

    forkJoin({
      services: this.clinicSvc.list(clinicId),
      chairs:   this.chairsSvc.list(clinicId),
    }).subscribe({
      next: ({ services: svcRes, chairs: chairRes }) => {
        this.services.set((svcRes.services ?? []).filter(s => s.is_active !== false));
        const activeChairs = (chairRes.chairs ?? []).filter(c =>
          c.is_active !== false && c.operational_status !== 'out_of_order'
        );
        this.chairs.set(activeChairs);
        // Preselect the first active chair so the slot lookup can run without
        // the user explicitly picking one. They can still change it.
        this.selectedChairId.set(activeChairs[0]?.id ?? null);
        if (!this.selectedChairId()) this.metaError.set('No active chairs configured for this clinic. Please set up chairs first.');
        this.servicesLoading.set(false);
        this.restoreDraft();
        this.cdr.markForCheck();
      },
      error: () => {
        this.metaError.set('Could not load clinic data. Please refresh.');
        this.servicesLoading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  // ── Service visual ────────────────────────────────────────────────────────

  getVisual(svc: ClinicService) {
    return getServiceVisual(svc.name);
  }

  // ── Step navigation ───────────────────────────────────────────────────────

  selectService(svc: ClinicService) {
    this.selectedService.set(svc);
    this.selectedDate.set(null);
    this.selectedSlot.set(null);
    this.slots.set([]);
    this.step.set(2);
    this.scheduleSaveDraft();
  }

  onChairSelect(id: string) {
    if (this.selectedChairId() === id) return;
    this.selectedChairId.set(id);
    // Slots are per-chair — invalidate the picked slot and refetch if a date
    // is already selected.
    this.selectedSlot.set(null);
    this.slotConflict.set('');
    if (this.selectedDate()) this.loadSlots();
    this.scheduleSaveDraft();
  }

  onDateSelect(iso: string) {
    if (this.dates.find(d => d.iso === iso)?.disabled) return;
    this.selectedDate.set(iso);
    this.selectedSlot.set(null);
    this.slotConflict.set('');
    this.loadSlots();
    this.scheduleSaveDraft();
  }

  loadSlots() {
    const svc  = this.selectedService();
    const date = this.selectedDate();
    if (!date || !svc || !this.selectedChairId()) return;
    this.slotsLoading.set(true);
    this.slotsError.set('');
    this.apptService.getSlots(date, svc.id, this.selectedChairId()!).subscribe({
      next: r => {
        this.slots.set(r.slots ?? []);
        const selected = this.selectedSlot();
        if (selected && !this.isSlotSelectable({ time: selected, taken: false }, date)) {
          this.selectedSlot.set(null);
          this.slotConflict.set(this.slotUnavailableMessage({ time: selected, taken: false }, date));
        }
        this.slotsLoading.set(false);
        this.cdr.markForCheck();
      },
      error: () => { this.slotsError.set('Failed to load slots. Please try again.'); this.slotsLoading.set(false); this.cdr.markForCheck(); },
    });
  }

  isSlotPast(slot: Slot, dateIso = this.selectedDate()): boolean {
    if (!dateIso || !slot.time) return false;
    return this.isSlotInPast(dateIso, slot.time);
  }

  isSlotSelectable(slot: Slot, dateIso = this.selectedDate()): boolean {
    if (!dateIso || slot.taken) return false;
    return !this.isSlotInPast(dateIso, slot.time);
  }

  onSlotSelect(slot: Slot) {
    const date = this.selectedDate();
    if (!date || !this.isSlotSelectable(slot, date)) return;
    this.selectedSlot.set(slot.time);
    this.slotConflict.set('');
    this.scheduleSaveDraft();
  }

  proceedToDetails() {
    const slot = this.selectedSlot();
    const date = this.selectedDate();
    if (!slot || !date) return;
    if (!this.isSlotSelectable({ time: slot, taken: false }, date)) {
      this.selectedSlot.set(null);
      this.slotConflict.set(this.slotUnavailableMessage({ time: slot, taken: false }, date));
      return;
    }
    this.step.set(3);
    this.scheduleSaveDraft();
  }

  private isSlotInPast(dateIso: string, time: string): boolean {
    const slotStart = new Date(`${dateIso}T${time}:00+05:30`);
    if (Number.isNaN(slotStart.getTime())) return true;
    return slotStart.getTime() <= Date.now();
  }

  private slotUnavailableMessage(slot: Slot, dateIso: string): string {
    if (slot.taken) return 'This slot was just taken. Please choose another time.';
    if (this.isSlotInPast(dateIso, slot.time)) {
      return 'This time has passed. Please choose a future slot.';
    }
    return 'This slot is no longer available. Please choose another time.';
  }

  slotLabel(time: string | null | undefined): string {
    return time ? formatSlotTime12h(time) : '';
  }

  /** Kept for backward template compat — live lookup is debounced via valueChanges. */
  onPhoneBlur() { /* no-op */ }

  proceedToConfirm() {
    this.patientForm.markAllAsTouched();
    if (this.patientForm.invalid) return;
    const v = this.patientForm.value;
    this.patientData = {
      name:             v.name,
      phone:            v.phone,
      email:            v.email ?? '',
      age:              v.age != null && v.age !== '' ? Number(v.age) : undefined,
      gender:           v.gender || undefined,
      address:          v.address || undefined,
      clinical_history: v.clinical_history || undefined,
    };
    this.patientSaved.set(true);

    // collect intake
    const data: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(this.intake)) {
      if (val !== '' && val !== null && val !== undefined) {
        if (Array.isArray(val) && val.length === 0) continue;
        data[key] = val;
      }
    }
    this.intakePayload = data;

    this.step.set(4);
    this.scheduleSaveDraft();
  }

  goBack() {
    const cur = this.step();
    if (cur > 1) {
      this.step.set((cur - 1) as 1 | 2 | 3 | 4);
      this.scheduleSaveDraft();
    }
  }

  leaveBooking(): void {
    this.router.navigate(['/schedule']);
  }

  get scheduleViewQueryParams(): { date?: string } {
    return this.confirmedDateIso ? { date: this.confirmedDateIso } : {};
  }

  private navigateToScheduleView(): void {
    this.router.navigate(['/schedule'], { queryParams: this.scheduleViewQueryParams });
  }

  // ── Intake helpers ────────────────────────────────────────────────────────

  private get svcKey(): string { return this.serviceLabel().toLowerCase(); }

  get showRctQuestions():         boolean { return /root.canal|rct|endodontic/.test(this.svcKey); }
  get showExtractionQuestions():  boolean { return /extract|pull|remov/.test(this.svcKey); }
  get showOrthoQuestions():       boolean { return /ortho|brace|aligner/.test(this.svcKey); }
  get showImplantQuestions():     boolean { return /implant/.test(this.svcKey); }
  get showCleaningQuestions():    boolean { return /oral|prophylaxis|clean|scale/.test(this.svcKey); }
  get showRestorationQuestions(): boolean { return /restor|fill|composit/.test(this.svcKey); }
  get showCrownQuestions():       boolean { return /crown|cap/.test(this.svcKey); }
  get showWhiteningQuestions():   boolean { return /bleach|whiten/.test(this.svcKey); }
  get showPedoQuestions():        boolean { return /pulpect|pulp|baby|pedo/.test(this.svcKey); }

  setGender(value: string) {
    const current = this.patientForm.get('gender')?.value;
    this.patientForm.patchValue({ gender: current === value ? '' : value });
  }

  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sanitized = input.value.replace(/[^A-Za-z\s]/g, '');
    if (sanitized !== input.value) {
      input.value = sanitized;
      this.patientForm.get('name')!.setValue(sanitized, { emitEvent: false });
      this.cdr.markForCheck();
    }
  }

  onNameBlur(): void {
    const ctrl = this.patientForm.get('name')!;
    const trimmed = (ctrl.value ?? '').trim().replace(/\s+/g, ' ');
    if (trimmed !== ctrl.value) {
      ctrl.setValue(trimmed);
      this.cdr.markForCheck();
    }
  }

  onAgeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    if (raw === '') return;

    const num = Number(raw);
    if (!Number.isFinite(num) || num <= this.ageMax) return;

    this.patientForm.get('age')!.setValue(this.ageMax);
    input.value = String(this.ageMax);
    this.cdr.markForCheck();
  }

  onAgeBlur(): void {
    const ctrl = this.patientForm.get('age')!;
    const val = ctrl.value;
    if (val === null || val === '' || val === undefined) return;

    const num = Number(val);
    if (!Number.isFinite(num)) return;

    const clamped = Math.min(this.ageMax, Math.max(this.ageMin, num));
    if (clamped !== num) {
      ctrl.setValue(clamped);
      this.cdr.markForCheck();
    }
  }

  selectPill(field: keyof IntakeModel, value: string) {
    (this.intake as unknown as Record<string, unknown>)[field] =
      this.intake[field] === value ? '' : value;
    this.scheduleSaveDraft();
  }

  toggleAllergy(value: string) {
    const list = this.intake.known_allergies;
    this.intake.known_allergies = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    this.scheduleSaveDraft();
  }

  isSelected(field: keyof IntakeModel, value: string): boolean { return this.intake[field] === value; }
  isAllergySelected(value: string): boolean { return this.intake.known_allergies.includes(value); }

  // ── Booking submission ────────────────────────────────────────────────────

  submitBooking() {
    const svc = this.selectedService();
    if (!svc || !this.selectedDate() || !this.selectedSlot() || !this.patientData || !this.selectedChairId()) return;
    this.submitting.set(true);
    this.submitError.set('');

    this.apptService.getSlots(this.selectedDate()!, svc.id, this.selectedChairId()!).subscribe({
      next: r => {
        this.slots.set(r.slots ?? []);
        const date = this.selectedDate()!;
        const selectedTime = this.selectedSlot()!;
        const fresh = r.slots?.find(s => s.time === selectedTime);
        const slot = fresh ?? { time: selectedTime, taken: false };
        if (!this.isSlotSelectable(slot, date)) {
          this.selectedSlot.set(null);
          this.slotConflict.set(this.slotUnavailableMessage(slot, date));
          this.submitting.set(false);
          this.step.set(2);
          return;
        }
        this.doBook();
      },
      error: () => this.doBook(),
    });
  }

  private doBook() {
    const payload: BookingPayload = {
      service_id:     this.selectedService()!.id,
      chair_id:       this.selectedChairId()!,
      scheduled_at:   `${this.selectedDate()}T${this.selectedSlot()}:00+05:30`,
      booking_source: 'internal',
      patient:        this.patientData!,
      intake_data:    this.intakePayload,
    };

    this.apptService.book(payload).subscribe({
      next: () => {
        this.confirmedTime    = `${this.formattedDate()} at ${this.slotLabel(this.selectedSlot())}`;
        this.confirmedService = this.serviceLabel();
        this.confirmedDateIso = this.selectedDate() ?? '';
        this.clearDraft();
        this.submitted.set(true);
        this.submitting.set(false);
        this.startRedirectCountdown();
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.selectedSlot.set(null);
          this.slotConflict.set('This slot was just taken. Please choose another time.');
          this.step.set(2);
        } else {
          this.submitError.set('Booking failed. Please try again.');
        }
        this.submitting.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  private startRedirectCountdown() {
    this.redirectCountdown = 5;
    this.redirectTimer = setInterval(() => {
      this.redirectCountdown--;
      this.cdr.markForCheck();
      if (this.redirectCountdown <= 0) {
        clearInterval(this.redirectTimer!);
        this.redirectTimer = null;
        this.navigateToScheduleView();
      }
    }, 1000);
  }

  resetAll() {
    if (this.redirectTimer) { clearInterval(this.redirectTimer); this.redirectTimer = null; }
    this.clearDraft();
    this.step.set(1);
    this.selectedService.set(null);
    this.selectedDate.set(null);
    this.selectedSlot.set(null);
    this.slots.set([]);
    this.patientData = null;
    this.patientSaved.set(false);
    this.welcomeBack.set('');
    this.slotConflict.set('');
    this.submitError.set('');
    this.submitted.set(false);
    this.intake = emptyIntake();
    this.intakePayload = {};
    this.clinicalFiles.set([]);
    this.patientForm.reset();
    window.scrollTo(0, 0);
  }
}
