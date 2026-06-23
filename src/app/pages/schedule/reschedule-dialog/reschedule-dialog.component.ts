import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { format, parseISO } from 'date-fns';
import { AppointmentsService, Appointment, Slot } from '../../../services/appointments.service';
import {
  formatAppointmentTime12h,
  formatSlotTime12h,
  isSlotTimeInPast,
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

  readonly currentDate = this.formatCurrentDate();
  readonly currentTime = formatAppointmentTime12h(this.data.scheduled_at);
  readonly shimmerSlots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

  private selectedDateIso(): string | null {
    return this.selectedDate ? format(this.selectedDate, 'yyyy-MM-dd') : null;
  }

  isSlotPast(slot: Slot): boolean {
    const dateIso = this.selectedDateIso();
    return dateIso ? isSlotTimeInPast(dateIso, slot.time) : false;
  }

  isSlotSelectable(slot: Slot): boolean {
    if (slot.taken) return false;
    const dateIso = this.selectedDateIso();
    if (!dateIso) return false;
    return !isSlotTimeInPast(dateIso, slot.time);
  }

  hasSelectableSlots(): boolean {
    return this.slots.some(s => this.isSlotSelectable(s));
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
    this.slotsError   = '';
    this.slotsLoading = true;

    const dateStr = format(date, 'yyyy-MM-dd');
    this.apptSvc.getSlots(dateStr, this.data.service_id, this.data.chair_id).subscribe({
      next: r => {
        this.slots = r.slots ?? [];
        if (this.selectedSlot && !this.isSlotSelectable({ time: this.selectedSlot, taken: false })) {
          this.selectedSlot = null;
        }
        this.slotsLoading = false;
      },
      error: () => { this.slotsError = 'Could not load slots. Try again.'; this.slotsLoading = false; },
    });
  }

  selectSlot(time: string): void {
    if (!this.isSlotSelectable({ time, taken: false })) return;
    if (this.selectedSlot === time) return;
    this.selectedSlot = time;
  }

  confirm(): void {
    if (!this.selectedDate || !this.selectedSlot) return;
    if (!this.isSlotSelectable({ time: this.selectedSlot, taken: false })) {
      this.error = 'This time has passed. Please choose a future slot.';
      this.selectedSlot = null;
      return;
    }
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
