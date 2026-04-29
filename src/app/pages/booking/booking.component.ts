import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { HttpErrorResponse } from '@angular/common/http';
import { addDays, format, isSunday } from 'date-fns';
import { AppointmentsService, Slot } from '../../services/appointments.service';
import { PatientsService } from '../../services/patients.service';

const SERVICES = [
  { id: 'SVC-01', label: 'Oral Prophylaxis (Scaling & Polishing)' },
  { id: 'SVC-02', label: 'Restoration (Filling)' },
  { id: 'SVC-03', label: 'Root Canal Treatment' },
  { id: 'SVC-04', label: 'Tooth Extraction' },
  { id: 'SVC-05', label: 'Orthodontics (Braces / Aligners)' },
  { id: 'SVC-06', label: 'Dental Implant' },
  { id: 'SVC-07', label: 'Paediatric Pulpectomy' },
];

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
  services = SERVICES;
  dates: DateOption[] = [];

  // Section state
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
    const params = new URLSearchParams(window.location.search);
    const svc = params.get('service');
    if (svc && SERVICES.find((s) => s.id === svc)) {
      this.selectedService = svc;
    }
    const ref = params.get('ref');
    if (ref) this.bookingSource = ref;

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

  // Section visibility
  get showDate() { return !!this.selectedService; }
  get showSlot() { return !!this.selectedDate; }
  get showPatient() { return !!this.selectedSlot; }
  get showIntake() { return !!this.patientData; }

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
    if (!this.selectedDate || !this.selectedService) return;
    this.slotsLoading = true;
    this.slotsError = '';
    this.apptService.getSlots(this.selectedDate, this.selectedService).subscribe({
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
      error: () => { /* silent */ },
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
    return SERVICES.find((s) => s.id === this.selectedService)?.label ?? '';
  }

  get formattedDate(): string {
    return this.selectedDate
      ? format(new Date(this.selectedDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')
      : '';
  }

  submitBooking() {
    if (!this.selectedService || !this.selectedDate || !this.selectedSlot || !this.patientData) return;
    this.submitting = true;
    this.submitError = '';

    const payload = {
      service_id: this.selectedService,
      chair_id: 1,
      scheduled_at: `${this.selectedDate}T${this.selectedSlot}:00`,
      booking_source: this.bookingSource,
      patient: this.patientData,
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
