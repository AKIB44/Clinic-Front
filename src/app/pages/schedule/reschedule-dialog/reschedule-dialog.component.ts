import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  trigger, transition, style, animate, query, stagger, state,
} from '@angular/animations';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { format, parseISO } from 'date-fns';
import { AppointmentsService, Appointment, Slot } from '../../../services/appointments.service';
import {
  formatAppointmentTime12h,
  formatSlotTime12h,
} from '../../../utils/appointment-time';

function appointmentFromPatchResponse(body: unknown): Appointment | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const o = body as Record<string, unknown>;
  const nested = o['appointment'];
  if (nested && typeof nested === 'object' && 'id' in nested && 'scheduled_at' in nested) {
    return nested as Appointment;
  }
  if ('id' in o && 'scheduled_at' in o) return body as Appointment;
  return undefined;
}

@Component({
  selector: 'reschedule-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './reschedule-dialog.component.html',
  styleUrl: './reschedule-dialog.component.scss',
  animations: [
    trigger('dialogEnter', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(16px) scale(0.97)' }),
        animate('380ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
    trigger('reveal', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms 60ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'none' })),
      ]),
    ]),
    trigger('slotList', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'scale(0.9) translateY(8px)' }),
          stagger(40, [
            animate('260ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'none' })),
          ]),
        ], { optional: true }),
      ]),
    ]),
    trigger('confirmPulse', [
      state('ready', style({ transform: 'scale(1)' })),
      state('idle', style({ transform: 'scale(1)' })),
      transition('idle => ready', [
        animate('200ms ease-out', style({ transform: 'scale(1.03)' })),
        animate('200ms ease-in', style({ transform: 'scale(1)' })),
      ]),
    ]),
  ],
})
export class RescheduleDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<RescheduleDialogComponent>);
  readonly data     = inject<Appointment>(MAT_DIALOG_DATA);
  private apptSvc   = inject(AppointmentsService);

  readonly minDate = new Date();
  selectedDate: Date | null = null;
  selectedSlot: string | null = null;
  slots: Slot[] = [];
  slotsLoading = false;
  slotsError   = '';
  updating     = false;
  error        = '';
  confirmPulse = 'idle';
  dateFlash    = false;

  readonly currentDate = this.formatCurrentDate();
  readonly currentTime = formatAppointmentTime12h(this.data.scheduled_at);

  private formatCurrentDate(): string {
    try {
      const d = parseISO(this.data.scheduled_at);
      if (Number.isNaN(d.getTime())) return this.data.scheduled_at;
      return format(d, 'EEE, d MMM yyyy');
    } catch {
      return '';
    }
  }

  ngOnInit(): void {
    try {
      const current = parseISO(this.data.scheduled_at);
      if (!Number.isNaN(current.getTime())) {
        this.onDateChange(current);
      }
    } catch {
      // User picks from calendar.
    }
  }

  formatSlot(time: string): string {
    return formatSlotTime12h(time);
  }

  formatSelectedDate(): string {
    if (!this.selectedDate) return '';
    return format(this.selectedDate, 'EEE, d MMM yyyy');
  }

  formatSelectedTime(): string {
    return this.selectedSlot ? formatSlotTime12h(this.selectedSlot) : '';
  }

  isDateChanged(): boolean {
    if (!this.selectedDate) return false;
    try {
      const current = parseISO(this.data.scheduled_at);
      return format(current, 'yyyy-MM-dd') !== format(this.selectedDate, 'yyyy-MM-dd');
    } catch {
      return true;
    }
  }

  onDateChange(date: Date | null): void {
    if (!date) return;
    this.selectedDate = date;
    this.selectedSlot = null;
    this.slots        = [];
    this.slotsError   = '';
    this.slotsLoading = true;
    this.dateFlash    = true;
    setTimeout(() => { this.dateFlash = false; }, 520);

    const dateStr = format(date, 'yyyy-MM-dd');
    this.apptSvc.getSlots(dateStr, this.data.service_id, this.data.chair_id).subscribe({
      next:  r => { this.slots = r.slots ?? []; this.slotsLoading = false; },
      error: () => { this.slotsError = 'Could not load slots. Try again.'; this.slotsLoading = false; },
    });
  }

  selectSlot(time: string): void {
    if (this.selectedSlot === time) return;
    this.selectedSlot = time;
    this.confirmPulse = 'ready';
    setTimeout(() => { this.confirmPulse = 'idle'; }, 420);
  }

  confirm(): void {
    if (!this.selectedDate || !this.selectedSlot) return;
    this.updating = true;
    this.error    = '';
    const dateStr = format(this.selectedDate, 'yyyy-MM-dd');
    this.apptSvc.reschedule(this.data.id, { scheduled_at: `${dateStr}T${this.selectedSlot}:00+05:30` }).subscribe({
      next: (res) => {
        const appt = appointmentFromPatchResponse(res);
        this.dialogRef.close(
          appt ? { reload: true as const, appointment: appt } : { reload: true as const },
        );
      },
      error: () => { this.error = 'Reschedule failed. Please try again.'; this.updating = false; },
    });
  }
}
