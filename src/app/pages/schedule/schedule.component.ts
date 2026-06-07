import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router, NavigationEnd } from '@angular/router';
import { interval, Subject, fromEvent, forkJoin, merge, of } from 'rxjs';
import { map, switchMap, takeUntil, filter, debounceTime } from 'rxjs/operators';
import { ScheduleEventsService } from '../../services/schedule-events.service';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { AppointmentsService, Appointment, AppointmentStatus, Slot } from '../../services/appointments.service';
import { PatientsService, Patient } from '../../services/patients.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { AuthService } from '../../auth/auth.service';
import { Chair } from '../../models/clinic.model';
import { HasPermissionDirective } from '../../core/rbac/has-permission.directive';
import { SessionApiService } from '../../features/treatment-session/services/session-api.service';
import { ReleaseNotesService } from '../../services/release-notes.service';
import { ReleaseNotesDialogComponent } from '../../components/release-notes-dialog/release-notes-dialog.component';

// ── Icon / color helpers ──────────────────────────────────────────────────────

const ICON_PALETTE: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['oral', 'prophylaxis', 'cleaning', 'scale'],  icon: 'tooth' },
  { keywords: ['root canal', 'rct', 'endodontic'],            icon: 'needle' },
  { keywords: ['extraction', 'pull', 'remov'],                icon: 'scissors' },
  { keywords: ['restoration', 'filling', 'composite'],        icon: 'puzzle' },
  { keywords: ['ortho', 'braces', 'aligner'],                 icon: 'align-center' },
  { keywords: ['implant'],                                     icon: 'bolt' },
  { keywords: ['pulpectomy', 'pulp', 'baby', 'pedo'],         icon: 'baby-carriage' },
  { keywords: ['crown', 'cap'],                                icon: 'diamond' },
  { keywords: ['bleach', 'whiten'],                            icon: 'sparkles' },
  { keywords: ['xray', 'x-ray', 'radio'],                     icon: 'scan' },
];

const COLOR_PALETTE: Array<{ bg: string; dot: string }> = [
  { bg: '#e3f2fd', dot: '#1976d2' },
  { bg: '#e8f5e9', dot: '#388e3c' },
  { bg: '#fff8e1', dot: '#f57c00' },
  { bg: '#fce4ec', dot: '#c62828' },
  { bg: '#f3e5f5', dot: '#7b1fa2' },
  { bg: '#e0f2f1', dot: '#00796b' },
  { bg: '#fff3e0', dot: '#e65100' },
  { bg: '#e8eaf6', dot: '#303f9f' },
  { bg: '#fafafa', dot: '#616161' },
];

function iconForService(name: string): string {
  const lower = name.toLowerCase();
  for (const entry of ICON_PALETTE) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.icon;
  }
  return 'stethoscope';
}

export interface ServiceColumn {
  serviceId: string;
  label: string;
  icon: string;
  headerBg: string;
  dotColor: string;
}

/** Summary pills: narrow which rows appear in service columns (counts stay full-day). */
export type ScheduleStatFilter = 'all' | 'active' | 'done' | 'pending';

export const STATUS_LABEL: Record<string, string> = {
  booked:       'Booked',
  confirmed:    'Confirmed',
  in_progress:  'In Progress',
  in_treatment: 'In Treatment',
  done:         'Done',
  no_show:      'No Show',
  cancelled:    'Cancelled',
};

export const BOOKING_SOURCE_ICON: Record<string, string> = {
  whatsapp: 'brand-whatsapp',
  website:  'world',
  direct:   'phone',
  staff:    'stethoscope',
};

/** Normalize PATCH bodies — some APIs return `{ appointment }`, others return the row at top level. */
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

const STATUS_ACTIONS: Record<AppointmentStatus, Array<{ label: string; next: AppointmentStatus; color: string }>> = {
  in_treatment: [],  // handled by Start Treatment button separately
  booked:      [
    { label: 'Confirm',  next: 'confirmed',   color: 'primary' },
    { label: 'No Show',  next: 'no_show',     color: 'warn'    },
    { label: 'Cancel',   next: 'cancelled',   color: 'warn'    },
  ],
  confirmed:   [
    { label: 'Start',    next: 'in_progress', color: 'primary' },
    { label: 'No Show',  next: 'no_show',     color: 'warn'    },
    { label: 'Cancel',   next: 'cancelled',   color: 'warn'    },
  ],
  in_progress: [
    { label: 'Done',     next: 'done',        color: 'primary' },
    { label: 'No Show',  next: 'no_show',     color: 'warn'    },
    { label: 'Cancel',   next: 'cancelled',   color: 'warn'    },
  ],
  done:        [],
  no_show:     [],
  cancelled:   [],
};

// ── Reschedule Dialog ─────────────────────────────────────────────────────────

@Component({
  selector: 'reschedule-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  template: `
    <div class="rs-dialog">
      <div class="rs-header">
        <i-tabler name="calendar-event" size="20"></i-tabler>
        <div>
          <h2 class="rs-title">Reschedule Appointment</h2>
          <div class="rs-subtitle">{{ data.patient_name }} · {{ data.service_name }}</div>
        </div>
      </div>

      <mat-dialog-content class="rs-body">
        <div class="rs-section-label">New Date</div>
        <mat-form-field appearance="outline" class="rs-date-field">
          <mat-label>Pick a date</mat-label>
          <input matInput [matDatepicker]="dp" [(ngModel)]="selectedDate"
                 [min]="minDate" (dateChange)="onDateChange($event.value)">
          <mat-datepicker-toggle matSuffix [for]="dp"></mat-datepicker-toggle>
          <mat-datepicker #dp></mat-datepicker>
        </mat-form-field>

        @if (slotsLoading) {
          <div class="rs-slots-loading">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Loading available slots…</span>
          </div>
        }

        @if (!slotsLoading && slotsError) {
          <div class="rs-error">{{ slotsError }}</div>
        }

        @if (!slotsLoading && !slotsError && slots.length > 0) {
          <div class="rs-section-label">Available Slots</div>
          <div class="rs-slot-grid">
            @for (s of slots; track s.time) {
              <button type="button" class="rs-slot"
                      [class.rs-slot-sel]="selectedSlot === s.time"
                      [class.rs-slot-taken]="s.taken"
                      [disabled]="s.taken"
                      (click)="selectedSlot = s.time">
                {{ s.time }}
              </button>
            }
          </div>
        }

        @if (!slotsLoading && !slotsError && selectedDate && slots.length === 0) {
          <div class="rs-no-slots">No slots available for this date. Try another day.</div>
        }

        @if (error) {
          <div class="rs-error">{{ error }}</div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close [disabled]="updating">Cancel</button>
        <button mat-flat-button color="primary"
                [disabled]="!selectedDate || !selectedSlot || updating"
                (click)="confirm()">
          @if (updating) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner> }
          Confirm Reschedule
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .rs-dialog   { min-width: 360px; max-width: 460px; }
    .rs-header   { display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 0; color: #0074ba; }
    .rs-title    { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
    .rs-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
    .rs-body     { padding: 16px 24px !important; }
    .rs-section-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;
                        letter-spacing: .5px; margin-bottom: 8px; }
    .rs-date-field { width: 100%; margin-bottom: 16px; }
    .rs-slots-loading { display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 13px;
                        padding: 12px 0; }
    .rs-slot-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .rs-slot { padding: 5px 12px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #fff;
               font-size: 13px; font-weight: 500; color: #334155; cursor: pointer;
               transition: border-color .15s, background .15s; }
    .rs-slot:hover:not(:disabled) { border-color: #0074ba; color: #0074ba; }
    .rs-slot-sel  { border-color: #0074ba !important; background: #0074ba !important; color: #fff !important; }
    .rs-slot-taken { opacity: .4; cursor: not-allowed; }
    .rs-no-slots { font-size: 13px; color: #94a3b8; padding: 8px 0; }
    .rs-error    { color: #c62828; font-size: 13px; margin-top: 8px; }
  `]
})
export class RescheduleDialog {
  dialogRef       = inject(MatDialogRef<RescheduleDialog>);
  data            = inject<Appointment>(MAT_DIALOG_DATA);
  private apptSvc = inject(AppointmentsService);

  minDate      = new Date();
  selectedDate: Date | null = null;
  selectedSlot: string | null = null;
  slots:        Slot[] = [];
  slotsLoading = false;
  slotsError   = '';
  updating     = false;
  error        = '';

  onDateChange(date: Date | null) {
    if (!date) return;
    this.selectedDate = date;
    this.selectedSlot = null;
    this.slots        = [];
    this.slotsError   = '';
    this.slotsLoading = true;
    const dateStr = format(date, 'yyyy-MM-dd');
    this.apptSvc.getSlots(dateStr, this.data.service_id, this.data.chair_id).subscribe({
      next:  r => { this.slots = r.slots ?? []; this.slotsLoading = false; },
      error: () => { this.slotsError = 'Could not load slots. Try again.'; this.slotsLoading = false; },
    });
  }

  confirm() {
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

// ── Detail Dialog ─────────────────────────────────────────────────────────────

@Component({
  selector: 'appt-detail-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, HasPermissionDirective],
  template: `
    <div class="appt-dialog">

      <!-- ── Header ── -->
      <div class="dialog-header">
        <div class="dialog-header-left">
          <h2 class="dialog-title">{{ data.patient_name }}</h2>
          <div class="dialog-subtitle">{{ data.service_name }}</div>
        </div>
        <span class="status-badge s-{{ data.status }}">{{ statusLabel[data.status] || data.status }}</span>
      </div>

      <!-- ── Detail view ── -->
      @if (view === 'detail') {
        <mat-dialog-content class="dialog-body">
          <div class="info-grid">
            <div class="info-item">
              <i-tabler name="clock" size="16"></i-tabler>
              <div>
                <div class="info-label">Scheduled</div>
                <div class="info-val">{{ scheduled }}</div>
              </div>
            </div>
            <div class="info-item">
              <i-tabler name="hourglass" size="16"></i-tabler>
              <div>
                <div class="info-label">Duration</div>
                <div class="info-val">{{ data.duration_minutes }} min</div>
              </div>
            </div>
            <div class="info-item">
              <i-tabler name="phone" size="16"></i-tabler>
              <div>
                <div class="info-label">Phone</div>
                <div class="info-val">{{ data.patient_phone }}</div>
              </div>
            </div>
            <div class="info-item">
              <i-tabler [name]="sourceIcon[data.booking_source] || 'dots'" size="16"></i-tabler>
              <div>
                <div class="info-label">Source</div>
                <div class="info-val">{{ data.booking_source }}</div>
              </div>
            </div>
          </div>

          @if (data.notes) {
            <div class="notes-block">
              <div class="info-label">Notes</div>
              <div class="notes-text">{{ data.notes }}</div>
            </div>
          }

          @if (data.cancel_reason) {
            <div class="notes-block cancel-reason-block">
              <div class="info-label">Cancellation Reason</div>
              <div class="notes-text">{{ data.cancel_reason }}</div>
            </div>
          }

          <!-- Status / reschedule / cancel — anyone who can view schedule or manage bookings -->
          <ng-container *hasPermission="['appointment.update_status', 'appointment.view', 'appointment.create']">
            @if (nonCancelActions.length) {
              <div class="action-row">
                @for (a of nonCancelActions; track a.next) {
                  <button mat-flat-button color="primary"
                          [disabled]="pendingKey === statusActionKey(a.next)"
                          (click)="doAction(a.next)">
                    @if (pendingKey === statusActionKey(a.next)) {
                      <mat-spinner diameter="18" class="btn-inline-spinner"></mat-spinner>
                    }
                    {{ a.label }}
                  </button>
                }
              </div>
            }
            <!-- Reschedule + Cancel row -->
            @if (canRescheduleOrCancel) {
              <div class="action-row-secondary">
                @if (canReschedule) {
                  <button mat-stroked-button
                          [disabled]="pendingKey === 'reschedule'"
                          (click)="openReschedule()">
                    @if (pendingKey === 'reschedule') {
                      <mat-spinner diameter="18" class="btn-inline-spinner"></mat-spinner>
                    }
                    <i-tabler name="calendar-event" size="15"></i-tabler>
                    Reschedule
                  </button>
                }
                @if (canCancel) {
                  <button mat-stroked-button color="warn"
                          [disabled]="pendingKey === 'reschedule'"
                          (click)="view = 'cancel'">
                    <i-tabler name="x-circle" size="15"></i-tabler>
                    Cancel Booking
                  </button>
                }
              </div>
            }
          </ng-container>

          @if (actionError) {
            <div class="dialog-error">{{ actionError }}</div>
          }
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <ng-container *hasPermission="'patient.update'">
            <button mat-stroked-button (click)="openEditPatient()" [disabled]="pendingKey === 'load_patient'">
              @if (pendingKey === 'load_patient') {
                <mat-spinner diameter="16" class="btn-inline-spinner"></mat-spinner>
              } @else {
                <i-tabler name="edit" size="16"></i-tabler>
              }
              Edit Patient
            </button>
          </ng-container>
          <ng-container *hasPermission="'patient.view'">
            <button mat-stroked-button (click)="openPatientRecord()">
              <i-tabler name="user-circle" size="16"></i-tabler>
              Patient Record
            </button>
          </ng-container>
          <ng-container *hasPermission="'prescription.create'">
            <button mat-stroked-button (click)="openPrescription()">
              <i-tabler name="prescription" size="16"></i-tabler>
              Prescription
            </button>
          </ng-container>
          @if (canStartTreatment) {
            <button mat-flat-button color="primary"
                    [disabled]="pendingKey === 'start_treatment'"
                    (click)="startTreatment()">
              @if (pendingKey === 'start_treatment') {
                <mat-spinner diameter="18" class="btn-inline-spinner"></mat-spinner>
              }
              <i-tabler name="stethoscope" size="15"></i-tabler>
              {{ data.status === 'in_treatment' ? 'Resume Treatment' : 'Start Treatment' }}
            </button>
          }
          <button mat-stroked-button mat-dialog-close>Close</button>
        </mat-dialog-actions>
      }

      <!-- ── Cancel confirmation view ── -->
      @if (view === 'cancel') {
        <mat-dialog-content class="dialog-body">
          <div class="cancel-confirm-box">
            <i-tabler name="alert-triangle" size="28" class="cancel-icon"></i-tabler>
            <p class="cancel-heading">Cancel this appointment?</p>
            <p class="cancel-sub">This will mark the booking as cancelled. This action cannot be undone.</p>
          </div>

          <mat-form-field appearance="outline" class="cancel-reason-field">
            <mat-label>Reason for cancellation (optional)</mat-label>
            <textarea matInput [(ngModel)]="cancelReason" rows="3"
                      placeholder="e.g. Patient requested, scheduling conflict…"></textarea>
          </mat-form-field>

          @if (actionError) {
            <div class="dialog-error">{{ actionError }}</div>
          }
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <button mat-stroked-button [disabled]="pendingKey === 'cancel_submit'" (click)="view = 'detail'">
            Back
          </button>
          <button mat-flat-button color="warn"
                  [disabled]="pendingKey === 'cancel_submit'"
                  (click)="confirmCancel()">
            @if (pendingKey === 'cancel_submit') {
              <mat-spinner diameter="18" class="btn-inline-spinner"></mat-spinner>
            }
            Yes, Cancel Booking
          </button>
        </mat-dialog-actions>
      }

      <!-- ── Edit Patient view ── -->
      @if (view === 'edit-patient') {
        <mat-dialog-content class="dialog-body">
          <div class="edit-form">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Full Name</mat-label>
              <input matInput type="text" [(ngModel)]="editPatient.name" required>
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Mobile Number</mat-label>
              <input matInput type="tel" inputmode="numeric" maxlength="10"
                     [(ngModel)]="editPatient.phone" required>
            </mat-form-field>
            <div class="edit-row">
              <mat-form-field appearance="outline" class="edit-half">
                <mat-label>Age</mat-label>
                <input matInput type="number" min="0" max="150"
                       [(ngModel)]="editPatient.age">
              </mat-form-field>
              <mat-form-field appearance="outline" class="edit-half">
                <mat-label>Gender</mat-label>
                <mat-select [(ngModel)]="editPatient.gender">
                  <mat-option value="male">Male</mat-option>
                  <mat-option value="female">Female</mat-option>
                  <mat-option value="other">Other</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="editPatient.email">
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Address</mat-label>
              <input matInput type="text" [(ngModel)]="editPatient.address">
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Clinical History</mat-label>
              <textarea matInput rows="3" [(ngModel)]="editPatient.clinical_history"></textarea>
            </mat-form-field>
          </div>

          @if (actionError) {
            <div class="dialog-error">{{ actionError }}</div>
          }
        </mat-dialog-content>

        <mat-dialog-actions align="end">
          <button mat-stroked-button [disabled]="pendingKey === 'save_patient'" (click)="view = 'detail'">
            Back
          </button>
          <button mat-flat-button color="primary"
                  [disabled]="pendingKey === 'save_patient' || !editPatient.name || !editPatient.phone"
                  (click)="savePatient()">
            @if (pendingKey === 'save_patient') {
              <mat-spinner diameter="18" class="btn-inline-spinner"></mat-spinner>
            }
            Save Changes
          </button>
        </mat-dialog-actions>
      }

    </div>
  `,
  styles: [`
    .appt-dialog        { min-width: 360px; max-width: 480px; }
    .dialog-header      { display: flex; justify-content: space-between; align-items: flex-start;
                          padding: 20px 24px 0; gap: 12px; }
    .dialog-header-left { flex: 1; }
    .dialog-title       { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.3; }
    .dialog-subtitle    { color: #666; font-size: 13px; margin-top: 2px; }
    .dialog-body        { padding: 16px 24px !important; }
    .info-grid          { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .info-item          { display: flex; gap: 10px; align-items: flex-start; color: #555; }
    .info-label         { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
    .info-val           { font-size: 14px; color: #333; margin-top: 2px; }
    .notes-block        { background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .cancel-reason-block { background: #fff8f8; border: 1px solid #fecaca; }
    .notes-text         { font-size: 14px; color: #444; margin-top: 4px; }
    .action-row         { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .action-row > button { min-width: 110px; }
    .action-row-secondary { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px;
                            padding-top: 14px; border-top: 1px solid #f1f5f9; }
    .action-row-secondary > button { min-width: 130px; }
    mat-dialog-actions { gap: 10px; padding: 12px 24px 16px !important;
                         border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
    mat-dialog-actions > button + button { margin-left: 0 !important; }
    mat-dialog-actions i-tabler { margin-right: 6px; }
    .dialog-error       { color: #c62828; font-size: 13px; margin-top: 8px; }
    .status-badge       { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
                          text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; flex-shrink: 0; }
    .s-booked           { background: #e3f2fd; color: #1565c0; }
    .s-confirmed        { background: #e8f5e9; color: #2e7d32; }
    .s-in_progress      { background: #fff8e1; color: #e65100; }
    .s-in_treatment     { background: #e8f4fd; color: #0074ba; }
    .s-done             { background: #e8f5e9; color: #1b5e20; }
    .s-no_show          { background: #fce4ec; color: #880e4f; }
    .s-cancelled        { background: #f5f5f5; color: #616161; }
    /* Cancel confirm */
    .cancel-confirm-box { text-align: center; padding: 8px 0 16px; }
    .cancel-icon        { color: #f59e0b; margin-bottom: 8px; }
    .cancel-heading     { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .cancel-sub         { font-size: 13px; color: #64748b; margin: 0; }
    .cancel-reason-field { width: 100%; margin-top: 8px; }
    .btn-inline-spinner { display: inline-block; vertical-align: middle; margin-right: 8px; }
    .edit-form          { display: flex; flex-direction: column; gap: 4px; }
    .edit-row           { display: flex; gap: 12px; }
    .edit-half          { flex: 1; }
    .w-100              { width: 100%; }
  `]
})
export class AppointmentDetailDialog {
  dialogRef           = inject(MatDialogRef<AppointmentDetailDialog>);
  data                = inject<Appointment>(MAT_DIALOG_DATA);
  private apptSvc     = inject(AppointmentsService);
  private patientsSvc = inject(PatientsService);
  private router      = inject(Router);
  private dialog      = inject(MatDialog);
  private sessionApi  = inject(SessionApiService);

  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;
  /** Which control is waiting on the server — only that row shows a spinner; others stay idle (still disabled while any request runs). */
  pendingKey: string | null = null;
  actionError = '';
  view: 'detail' | 'cancel' | 'edit-patient' = 'detail';
  cancelReason = '';

  editPatient: Partial<Patient> = {
    name: '', phone: '', email: '', age: undefined,
    gender: undefined, address: '', clinical_history: '',
  };

  statusActionKey(next: AppointmentStatus): string {
    return `status:${next}`;
  }

  get allActions() { return STATUS_ACTIONS[this.data.status] ?? []; }
  get nonCancelActions() { return this.allActions.filter(a => a.next !== 'cancelled'); }
  get canCancel()  { return this.allActions.some(a => a.next === 'cancelled'); }
  get canReschedule() { return this.data.status === 'booked' || this.data.status === 'confirmed'; }
  get canRescheduleOrCancel() { return this.canReschedule || this.canCancel; }
  get canStartTreatment() { return this.data.status === 'in_progress' || this.data.status === 'in_treatment'; }

  get scheduled(): string {
    try { return format(parseISO(this.data.scheduled_at.replace('Z', '')), 'EEE, d MMM yyyy · h:mm a'); }
    catch { return this.data.scheduled_at; }
  }

  doAction(next: AppointmentStatus) {
    this.pendingKey   = this.statusActionKey(next);
    this.actionError = '';
    this.apptSvc.updateStatus(this.data.id, next).subscribe({
      next: (res) => {
        this.pendingKey = null;
        const appt = appointmentFromPatchResponse(res);
        this.dialogRef.close(appt ? { reload: true as const, appointment: appt } : 'reload');
      },
      error: () => {
        this.pendingKey = null;
        this.actionError = 'Failed to update. Please try again.';
      },
    });
  }

  confirmCancel() {
    this.pendingKey   = 'cancel_submit';
    this.actionError = '';
    this.apptSvc.updateStatus(this.data.id, 'cancelled', this.cancelReason || undefined).subscribe({
      next: (res) => {
        this.pendingKey = null;
        const appt = appointmentFromPatchResponse(res);
        this.dialogRef.close(appt ? { reload: true as const, appointment: appt } : 'reload');
      },
      error: () => {
        this.pendingKey = null;
        this.actionError = 'Failed to cancel. Please try again.';
      },
    });
  }

  openReschedule() {
    this.pendingKey = 'reschedule';
    this.dialog.open(RescheduleDialog, {
      data:      this.data,
      width:     '460px',
      maxWidth:  '95vw',
      autoFocus: false,
    }).afterClosed().subscribe(r => {
      this.pendingKey = null;
      if (r && typeof r === 'object' && 'reload' in r && (r as { reload: boolean }).reload) {
        this.dialogRef.close(r);
      }
    });
  }

  openPrescription() {
    this.dialogRef.close();
    this.router.navigate(['/rx/new'], {
      queryParams: {
        appointment_id: this.data.id,
        patient_id:     this.data.patient_id,
        svc_id:         this.data.service_id,
        patient_name:   this.data.patient_name,
        label:          this.data.service_name,
      },
    });
  }

  openPatientRecord() {
    this.dialogRef.close();
    this.router.navigate(['/patients', this.data.patient_id]);
  }

  openEditPatient() {
    this.pendingKey  = 'load_patient';
    this.actionError = '';
    this.patientsSvc.getById(this.data.patient_id).subscribe({
      next: ({ patient }) => {
        this.editPatient = {
          name:             patient.name,
          phone:            patient.phone,
          email:            patient.email ?? '',
          age:              patient.age ?? undefined,
          gender:           patient.gender ?? undefined,
          address:          patient.address ?? '',
          clinical_history: patient.clinical_history ?? '',
        };
        this.pendingKey = null;
        this.view = 'edit-patient';
      },
      error: () => {
        this.pendingKey = null;
        this.actionError = 'Could not load patient. Please try again.';
      },
    });
  }

  savePatient() {
    const p = this.editPatient;
    if (!p.name || !p.phone) return;
    this.pendingKey  = 'save_patient';
    this.actionError = '';
    const payload: Partial<Patient> = {
      name:             p.name,
      phone:            p.phone,
      email:            p.email || undefined,
      age:              p.age != null ? Number(p.age) : undefined,
      gender:           p.gender || undefined,
      address:          p.address || undefined,
      clinical_history: p.clinical_history || undefined,
    };
    this.patientsSvc.update(this.data.patient_id, payload).subscribe({
      next: () => {
        this.pendingKey = null;
        this.dialogRef.close('reload');
      },
      error: (e) => {
        this.pendingKey = null;
        this.actionError = e?.error?.error ?? 'Failed to save patient. Please try again.';
      },
    });
  }

  startTreatment() {
    this.pendingKey  = 'start_treatment';
    this.actionError = '';
    this.sessionApi.startTreatment(this.data.id).subscribe({
      next: ({ session }) => {
        this.pendingKey = null;
        this.dialogRef.close();
        this.router.navigate(['/treatment', session.id]);
      },
      error: () => {
        this.pendingKey  = null;
        this.actionError = 'Failed to start treatment session. Please try again.';
      },
    });
  }
}

// ── Greeting helpers ──────────────────────────────────────────────────────────

interface GreetingParts { headline: string; mood: string; }

const GREETINGS: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: [
    'Ready to make smiles today?',
    'Your first patient is just around the corner.',
    'Coffee in hand, clipboard ready?',
    'A fresh day, a full schedule — let\'s go.',
    'Another day to change lives, one smile at a time.',
    'The chair is warmed up and waiting.',
    'Early bird gets the healthy teeth!',
  ],
  afternoon: [
    'Halfway through — keep the momentum going.',
    'Post-lunch focus mode: activated.',
    'Still lots to accomplish — you\'re doing great.',
    'Your patients are in the best hands.',
    'The afternoon rush starts now — you\'ve got this.',
    'Stay sharp, the day isn\'t done yet.',
    'Fuelled up and ready for the afternoon run.',
  ],
  evening: [
    'Wrapping up a great day?',
    'Almost there — finish strong.',
    'Late sessions take dedication. Respect.',
    'The clinic is in good hands tonight.',
    'Evening shift — bring it home.',
    'Not long now — one patient at a time.',
    'Evening calm, professional calm.',
  ],
  night: [
    'Burning the midnight oil? Impressive dedication.',
    'Still here — the clinic appreciates you.',
    'Late-night session in progress. Take care of yourself too.',
    'Night owl mode. The patients are lucky to have you.',
  ],
};

const GREETING_SESSION_KEY = 'df_greeting_shown';

function buildGreeting(firstName: string): GreetingParts {
  const h = new Date().getHours();
  let period: keyof typeof GREETINGS;
  let timeWord: string;
  if (h >= 5 && h < 12)  { period = 'morning';   timeWord = 'Good morning'; }
  else if (h < 17)        { period = 'afternoon';  timeWord = 'Good afternoon'; }
  else if (h < 22)        { period = 'evening';    timeWord = 'Good evening'; }
  else                    { period = 'night';       timeWord = 'Hey'; }

  const pool = GREETINGS[period];
  const mood = pool[Math.floor(Math.random() * pool.length)];
  const name = firstName ? `, ${firstName}` : '';
  return { headline: `${timeWord}${name}!`, mood };
}

// ── Schedule Page ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    TablerIconsModule,
    RescheduleDialog,
    AppointmentDetailDialog,
  ],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
})
export class ScheduleComponent implements OnInit, OnDestroy {
  private apptSvc        = inject(AppointmentsService);
  private svcSvc         = inject(ClinicServicesService);
  private chairsSvc      = inject(ChairsService);
  private authSvc        = inject(AuthService);
  private router         = inject(Router);
  private dialog         = inject(MatDialog);
  private cdr            = inject(ChangeDetectorRef);
  private releaseNotesSvc = inject(ReleaseNotesService);
  private scheduleEvents = inject(ScheduleEventsService);

  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;

  greeting: GreetingParts = buildGreeting(this.authSvc.getUser()?.first_name ?? '');
  showGreeting   = !sessionStorage.getItem(GREETING_SESSION_KEY);
  greetingExiting = false;

  selectedDate  = new Date();
  appointments: Appointment[] = [];
  columns:      ServiceColumn[] = [];
  chairs:       Chair[]         = [];

  loading        = true;
  columnsLoading = true;
  error          = '';

  selectedChairId: string = 'all';

  /** Filter driven by summary-strip pills (Total / Active / Done / Pending). */
  statFilter: ScheduleStatFilter = 'all';

  /** True once the user explicitly clicks any filter pill.
   *  Resets on every date change so the default board only shows active columns. */
  pillSelected = false;

  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Greeting: show for 2.4s then fade out over 0.9s
    const greetingTotalMs = this.showGreeting ? 3300 : 0;
    if (this.showGreeting) {
      sessionStorage.setItem(GREETING_SESSION_KEY, '1');
      setTimeout(() => {
        this.greetingExiting = true;
        this.cdr.markForCheck();
        setTimeout(() => {
          this.showGreeting = false;
          this.cdr.markForCheck();
        }, 900);
      }, 2400);
    }

    // Release notes: show after greeting finishes (or immediately if no greeting)
    setTimeout(() => this.checkReleaseNotes(), greetingTotalMs + 200);

    this.loadMeta();
    this.startPolling();
    this.watchServiceChanges();
  }

  private checkReleaseNotes(): void {
    this.releaseNotesSvc.getPending().subscribe({
      next: ({ note }) => {
        if (!note) return;
        const ref = this.dialog.open(ReleaseNotesDialogComponent, {
          data: note,
          width: '520px',
          disableClose: true,
          panelClass: 'rn-dialog-panel',
        });
        ref.afterClosed().subscribe(() => {
          this.releaseNotesSvc.ack(note.id).subscribe();
        });
      },
      error: () => { /* silently ignore — non-critical */ },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Meta (services + chairs) ──────────────────────────────────────────────

  private loadMeta() {
    this.columnsLoading = true;
    forkJoin({
      services: this.svcSvc.list(),
      chairs:   this.chairsSvc.list(),
    }).subscribe({
      next: ({ services: svcRes, chairs: chairRes }) => {
        const active = (svcRes.services ?? []).filter(s => s.is_active !== false);
        this.columns = active.map((s, i) => ({
          serviceId: s.id,
          label:     s.name,
          icon:      iconForService(s.name),
          headerBg:  COLOR_PALETTE[i % COLOR_PALETTE.length].bg,
          dotColor:  COLOR_PALETTE[i % COLOR_PALETTE.length].dot,
        }));
        this.chairs         = (chairRes.chairs ?? []).filter(c => c.is_active !== false);
        this.columnsLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.columnsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Service column sync ───────────────────────────────────────────────────
  // Reloads columns (1) every 5 min silently and (2) whenever the user
  // navigates back to /schedule from anywhere (e.g. after adding a service).

  private watchServiceChanges() {
    // Silent 5-minute refresh
    interval(300_000).pipe(takeUntil(this.destroy$)).subscribe(() => this.loadMeta());

    // Instant reload on route re-activation
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      filter(e => (e as NavigationEnd).urlAfterRedirects === '/schedule'),
      takeUntil(this.destroy$),
    ).subscribe(() => this.loadMeta());
  }

  // ── Date helpers ──────────────────────────────────────────────────────────

  get dateIso():   string { return format(this.selectedDate, 'yyyy-MM-dd'); }
  get dateLabel(): string {
    return isToday(this.selectedDate) ? 'Today' : format(this.selectedDate, 'EEE, d MMM yyyy');
  }

  prevDay() {
    this.statFilter = 'all';
    this.pillSelected = false;
    this.selectedDate = subDays(this.selectedDate, 1);
    this.triggerReload();
  }

  nextDay() {
    this.statFilter = 'all';
    this.pillSelected = false;
    this.selectedDate = addDays(this.selectedDate, 1);
    this.triggerReload();
  }

  goToday() {
    this.statFilter = 'all';
    this.pillSelected = false;
    this.selectedDate = new Date();
    this.triggerReload();
  }

  onDatePick(value: Date | null) {
    if (value) {
      this.statFilter = 'all';
      this.pillSelected = false;
      this.selectedDate = value;
      this.triggerReload();
    }
  }

  setStatFilter(f: ScheduleStatFilter) {
    this.statFilter = f;
    this.pillSelected = true;
    this.cdr.markForCheck();
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private startPolling() {
    // Event-driven refresh — no more 60s blind poll. We refetch when:
    //   1. The page mounts (initial spinner).
    //   2. Any mutation broadcasts a "schedule changed" pulse via
    //      ScheduleEventsService (booking, reschedule, status update, voice
    //      booking through Friday, patient edit, …).
    //   3. The browser tab becomes visible again after being hidden — covers
    //      the "I left this open for an hour" case without continuous polling.
    //   4. A long-interval safety net (5 minutes) catches anything an
    //      out-of-band mutation forgot to broadcast.
    merge(
      of<'initial' | 'event' | 'visibility' | 'safety'>('initial'),
      this.scheduleEvents.changes$.pipe(
        debounceTime(150),                         // coalesce bursts (book + redirect)
        map(() => 'event' as const),
      ),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
        map(() => 'visibility' as const),
      ),
      interval(300_000).pipe(map(() => 'safety' as const)),
    ).pipe(
      switchMap((kind) => {
        if (kind === 'initial') {
          this.loading = true;
          this.cdr.markForCheck();
        }
        return this.apptSvc.getSchedule(this.dateIso);
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (r) => {
        this.appointments = r.appointments ?? [];
        this.loading      = false;
        this.error        = '';
        this.cdr.markForCheck();
      },
      error: () => {
        this.error   = 'Could not load appointments.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Refetch the day. After reschedule/status changes, optional `mergeAppointment` patches the row from
   * the PATCH response so cards update even if GET returns a stale `scheduled_at` briefly.
   */
  triggerReload(options?: { mergeAppointment?: Appointment }) {
    this.appointments = [];
    this.loading      = true;
    this.error        = '';
    this.cdr.markForCheck();
    const merge = options?.mergeAppointment;
    this.apptSvc.getSchedule(this.dateIso).subscribe({
      next: (r) => {
        let list = [...(r.appointments ?? [])];
        if (merge) {
          const ix = list.findIndex(a => a.id === merge.id);
          if (ix >= 0) list[ix] = { ...list[ix], ...merge };
          else list = [...list, merge];
        }
        this.appointments = list;
        this.loading      = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error   = 'Could not load appointments.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  get filtered(): Appointment[] {
    const byChair =
      this.selectedChairId === 'all'
        ? this.appointments
        : this.appointments.filter(a => a.chair_id === this.selectedChairId);
    // Cancelled bookings stay in history/API but are hidden from the day board.
    return byChair.filter(a => a.status !== 'cancelled');
  }

  /**
   * Default board rows (Total / Active / Pending pills): exclude completed so finished visits
   * don’t clutter columns. The Done pill bypasses this and lists only `done` rows.
   */
  get boardEligible(): Appointment[] {
    return this.filtered.filter(a => a.status !== 'done');
  }

  /** Kanban columns after pill filter. */
  get displayedForBoard(): Appointment[] {
    switch (this.statFilter) {
      case 'done':
        return this.filtered.filter(a => a.status === 'done');
      case 'active':
        return this.boardEligible.filter(a => a.status === 'in_progress' || a.status === 'confirmed');
      case 'pending':
        return this.boardEligible.filter(a => a.status === 'booked');
      default:
        return this.boardEligible;
    }
  }

  /** Columns sorted by total day bookings (most → least).
   *  Visible set is scoped to the active pill filter so each column always has
   *  relevant cards. Without a pill the default shows only services with
   *  upcoming / in-progress work (booked | confirmed | in_progress). */
  get sortedColumns(): ServiceColumn[] {
    const counts = new Map<string, number>();
    for (const a of this.filtered) {
      counts.set(a.service_id, (counts.get(a.service_id) ?? 0) + 1);
    }

    let relevantIds: Set<string>;
    if (!this.pillSelected) {
      relevantIds = new Set(
        this.filtered
          .filter(a => a.status === 'booked' || a.status === 'confirmed' || a.status === 'in_progress')
          .map(a => a.service_id),
      );
    } else {
      switch (this.statFilter) {
        case 'active':
          relevantIds = new Set(
            this.filtered
              .filter(a => a.status === 'in_progress' || a.status === 'confirmed')
              .map(a => a.service_id),
          );
          break;
        case 'done':
          relevantIds = new Set(
            this.filtered.filter(a => a.status === 'done').map(a => a.service_id),
          );
          break;
        case 'pending':
          relevantIds = new Set(
            this.filtered.filter(a => a.status === 'booked').map(a => a.service_id),
          );
          break;
        default: // 'all' — Total pill: any non-cancelled appointment
          relevantIds = new Set(this.filtered.map(a => a.service_id));
          break;
      }
    }

    return [...this.columns]
      .filter(c => relevantIds.has(c.serviceId))
      .sort((a, b) => (counts.get(b.serviceId) ?? 0) - (counts.get(a.serviceId) ?? 0));
  }

  columnCards(serviceId: string): Appointment[] {
    return this.displayedForBoard.filter(a => a.service_id === serviceId);
  }

  overflowCount(serviceId: string): number {
    return Math.max(0, this.columnCards(serviceId).length - 4);
  }

  get totalCount():   number { return this.filtered.length; }
  get activeCount():  number { return this.filtered.filter(a => a.status === 'in_progress' || a.status === 'confirmed').length; }
  get doneCount():    number { return this.filtered.filter(a => a.status === 'done').length; }
  get pendingCount(): number { return this.filtered.filter(a => a.status === 'booked').length; }

  // ── Card helpers ──────────────────────────────────────────────────────────

  formatTime(iso: string): string {
    try { return format(parseISO(iso.replace('Z', '')), 'h:mm a'); } catch { return iso; }
  }

  openDetail(appt: Appointment) {
    const ref = this.dialog.open(AppointmentDetailDialog, {
      data:      appt,
      width:     '480px',
      maxWidth:  '95vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(result => this.applyScheduleReloadResult(result));
  }

  /** After status change / reschedule / cancel — refresh board; jump calendar day if reschedule moved the appointment. */
  private applyScheduleReloadResult(result: unknown) {
    if (result === 'reload') {
      this.triggerReload();
      return;
    }
    if (
      result &&
      typeof result === 'object' &&
      'reload' in result &&
      (result as { reload?: boolean }).reload
    ) {
      const appt = (result as { appointment?: Appointment }).appointment;
      if (appt?.scheduled_at) {
        try {
          const d = parseISO(appt.scheduled_at.replace('Z', ''));
          const dayIso = format(d, 'yyyy-MM-dd');
          if (dayIso !== this.dateIso) {
            this.selectedDate = d;
          }
        } catch {
          /* ignore parse errors */
        }
      }
      this.triggerReload(appt ? { mergeAppointment: appt } : undefined);
    }
  }

  trackByServiceId(_: number, c: ServiceColumn) { return c.serviceId; }
  trackById(_: number, a: Appointment)          { return a.id; }

  getChairName(chairId: string): string {
    return this.chairs.find(c => c.id === chairId)?.name ?? '';
  }

  colTotal(serviceId: string): number {
    return this.filtered.filter(a => a.service_id === serviceId).length;
  }

  colDonePct(serviceId: string): number {
    const total = this.colTotal(serviceId);
    if (!total) return 0;
    const done = this.filtered.filter(a => a.service_id === serviceId && a.status === 'done').length;
    return (done / total) * 100;
  }
}
