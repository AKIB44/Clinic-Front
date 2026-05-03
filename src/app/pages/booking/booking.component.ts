import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpErrorResponse } from '@angular/common/http';
import { addDays, format, isSunday } from 'date-fns';
import { forkJoin } from 'rxjs';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { AppointmentsService, BookingPayload, Slot } from '../../services/appointments.service';
import { PatientsService } from '../../services/patients.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { ClinicsService } from '../../services/clinics.service';
import { authApiConfig } from '../../auth/auth.config';

/** UI row for mat-select: real service UUID from GET /v1/services?clinic_id= */
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

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './booking.component.html',
})
export class BookingComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private clinicServices = inject(ClinicServicesService);
  private chairsService = inject(ChairsService);
  private clinicsService = inject(ClinicsService);

  services: BookingServiceOption[] = [];
  servicesLoading = false;
  servicesError = '';
  /** Blocks the whole flow: missing clinic, no chairs, etc. */
  metaError = '';

  clinicId: string | null = null;
  /** First active chair UUID from GET /v1/chairs — required for slots + booking */
  defaultChairId: string | null = null;

  dates: DateOption[] = [];

  selectedService: string | null = null;
  selectedDate: string | null = null;
  selectedSlot: string | null = null;
  slots: Slot[] = [];
  slotsLoading = false;
  slotsError = '';
  slotConflict = '';
  welcomeBack = '';

  patientForm!: FormGroup;
  patientSaved = false;
  patientData: { name: string; phone: string; email: string } | null = null;

  submitting = false;
  submitError = '';
  submitted = false;
  bookingSource = 'direct';
  confirmedTime = '';
  confirmedService = '';

  constructor(
    private fb: FormBuilder,
    private apptService: AppointmentsService,
    private patientsService: PatientsService
  ) {}

  ngOnInit() {
    this.buildDatesAndPatientForm();
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

    // No ?clinic= — single-clinic MVP: resolve via GET /v1/clinic (public or tenant default)
    this.servicesLoading = true;
    this.metaError = '';
    this.clinicsService.get().subscribe({
      next: (r) => {
        const id = r.clinic?.id?.trim();
        if (!id) {
          this.servicesLoading = false;
          this.metaError =
            'No clinic is available. Use /booking?clinic=<clinic-uuid> or contact the clinic.';
          return;
        }
        this.clinicId = id;
        this.loadServicesAndChairs(q);
      },
      error: () => {
        this.servicesLoading = false;
        this.metaError =
          'Could not load clinic automatically (the booking API may require ?clinic=<uuid>). ' +
          'Ask the clinic for the booking link, or set publicBookingClinicId in auth.config.ts for testing.';
      },
    });
  }

  /** Load treatments + chairs for {@link clinicId}. Pass query map for ?service= deep link. */
  private loadServicesAndChairs(q: ParamMap) {
    if (!this.clinicId) return;

    this.servicesLoading = true;
    this.servicesError = '';
    this.metaError = '';

    forkJoin({
      services: this.clinicServices.list(this.clinicId),
      chairs: this.chairsService.list(this.clinicId),
    }).subscribe({
      next: ({ services: svcRes, chairs: chairRes }) => {
        const rawServices = svcRes.services ?? [];
        this.services = rawServices
          .filter((s) => s.is_active !== false)
          .map((s) => ({ id: s.id, label: s.name }));

        const chairs = chairRes.chairs ?? [];
        const usable = chairs.filter((c) => c.is_active !== false);
        const pick = usable[0] ?? chairs[0];
        this.defaultChairId = pick?.id ?? null;

        if (!this.defaultChairId) {
          this.metaError = 'No chairs are configured for this clinic. Please contact the clinic.';
        }

        const svcParam = q.get('service');
        if (svcParam && this.services.some((s) => s.id === svcParam)) {
          this.selectedService = svcParam;
        }

        this.servicesLoading = false;
      },
      error: () => {
        this.servicesError =
          'Could not load treatments or chairs for this clinic. If you are testing locally, confirm GET /v1/services and /v1/chairs allow this clinic_id.';
        this.servicesLoading = false;
      },
    });
  }

  private buildDatesAndPatientForm() {
    this.dates = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(new Date(), i + 1);
      return {
        iso: format(d, 'yyyy-MM-dd'),
        label: format(d, 'd'),
        shortDay: format(d, 'EEE'),
        disabled: isSunday(d),
      };
    });

    this.patientForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', Validators.email],
    });
  }

  get showDate() {
    return !!this.selectedService && !!this.defaultChairId;
  }
  get showSlot() {
    return !!this.selectedDate;
  }
  get showPatient() {
    return !!this.selectedSlot;
  }
  get showIntake() {
    return !!this.patientData;
  }

  onServiceChange(svcId: string) {
    this.selectedService = svcId;
    this.selectedDate = null;
    this.selectedSlot = null;
    this.slots = [];
    this.slotConflict = '';
    this.patientData = null;
    this.patientSaved = false;
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
    this.slotsError = '';
    this.apptService
      .getSlots(this.selectedDate, this.selectedService, this.defaultChairId)
      .subscribe({
        next: (r) => {
          this.slots = r.slots ?? [];
          this.slotsLoading = false;
        },
        error: () => {
          this.slotsError = 'Failed to load slots. Please try again.';
          this.slotsLoading = false;
        },
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
          this.patientForm.patchValue({
            name: r.patient.name,
            email: r.patient.email ?? '',
          });
          this.welcomeBack = `Welcome back, ${r.patient.name}!`;
        } else {
          this.welcomeBack = '';
        }
      },
      error: () => {
        /* silent */
      },
    });
  }

  submitPatient() {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      return;
    }
    this.patientData = {
      name: this.patientForm.value.name,
      phone: this.patientForm.value.phone,
      email: this.patientForm.value.email ?? '',
    };
    this.patientSaved = true;
  }

  get serviceLabel(): string {
    return this.services.find((s) => s.id === this.selectedService)?.label ?? '';
  }

  get formattedDate(): string {
    return this.selectedDate
      ? format(new Date(this.selectedDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')
      : '';
  }

  submitBooking() {
    if (
      !this.selectedService ||
      !this.selectedDate ||
      !this.selectedSlot ||
      !this.patientData ||
      !this.defaultChairId
    )
      return;

    this.submitting = true;
    this.submitError = '';

    // Re-fetch slots to catch any race condition before hitting the booking API
    this.apptService
      .getSlots(this.selectedDate, this.selectedService, this.defaultChairId)
      .subscribe({
        next: (r) => {
          this.slots = r.slots ?? [];
          const fresh = this.slots.find(s => s.time === this.selectedSlot);

          if (!fresh || fresh.taken) {
            // Slot was taken between selection and submission
            this.selectedSlot = null;
            this.slotConflict = 'This slot was just taken. Please choose another time.';
            this.submitting = false;
            document.querySelector('.slots-section')?.scrollIntoView({ behavior: 'smooth' });
            return;
          }

          this.doBook();
        },
        error: () => {
          // If slot re-check fails, proceed optimistically — backend 409 will catch it
          this.doBook();
        },
      });
  }

  private doBook() {
    const payload: BookingPayload = {
      service_id: this.selectedService!,
      chair_id: this.defaultChairId!,
      scheduled_at: `${this.selectedDate}T${this.selectedSlot}:00`,
      booking_source: this.bookingSource,
      patient: this.patientData!,
      intake_data: {},
    };

    this.apptService.book(payload).subscribe({
      next: () => {
        this.confirmedTime = `${this.formattedDate} at ${this.selectedSlot}`;
        this.confirmedService = this.serviceLabel;
        this.submitted = true;
        this.submitting = false;
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.selectedSlot = null;
          this.slotConflict = 'This slot was just taken. Please choose another time.';
          this.loadSlots(); // refresh with latest availability
          document.querySelector('.slots-section')?.scrollIntoView({ behavior: 'smooth' });
        } else {
          this.submitError = 'Booking failed. Please try again or call us directly.';
        }
        this.submitting = false;
      },
    });
  }

  resetAll() {
    this.selectedService = null;
    this.selectedDate = null;
    this.selectedSlot = null;
    this.slots = [];
    this.patientData = null;
    this.patientSaved = false;
    this.patientForm.reset();
    this.submitted = false;
    this.submitError = '';
    this.welcomeBack = '';
    this.slotConflict = '';
    window.scrollTo(0, 0);
  }
}
