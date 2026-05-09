import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { interval, Subject, forkJoin, merge, of } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { AppointmentsService, Appointment, AppointmentStatus, Slot } from '../../services/appointments.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { Chair } from '../../models/clinic.model';
import { HasPermissionDirective } from '../../core/rbac/has-permission.directive';

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
  booked:      'Booked',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  done:        'Done',
  no_show:     'No Show',
  cancelled:   'Cancelled',
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
    this.apptSvc.reschedule(this.data.id, { scheduled_at: `${dateStr}T${this.selectedSlot}:00` }).subscribe({
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
                          [disabled]="updating" (click)="doAction(a.next)">
                    {{ a.label }}
                  </button>
                }
              </div>
            }
            <!-- Reschedule + Cancel row -->
            @if (canRescheduleOrCancel) {
              <div class="action-row-secondary">
                @if (canReschedule) {
                  <button mat-stroked-button [disabled]="updating" (click)="openReschedule()">
                    <i-tabler name="calendar-event" size="15"></i-tabler>
                    Reschedule
                  </button>
                }
                @if (canCancel) {
                  <button mat-stroked-button color="warn" [disabled]="updating" (click)="view = 'cancel'">
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
          <button mat-stroked-button [disabled]="updating" (click)="view = 'detail'">
            Back
          </button>
          <button mat-flat-button color="warn" [disabled]="updating" (click)="confirmCancel()">
            @if (updating) { <mat-spinner diameter="16" style="display:inline-block;margin-right:6px"></mat-spinner> }
            Yes, Cancel Booking
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
    .action-row         { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .action-row-secondary { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;
                            padding-top: 8px; border-top: 1px solid #f1f5f9; }
    .dialog-error       { color: #c62828; font-size: 13px; margin-top: 8px; }
    .status-badge       { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
                          text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; flex-shrink: 0; }
    .s-booked           { background: #e3f2fd; color: #1565c0; }
    .s-confirmed        { background: #e8f5e9; color: #2e7d32; }
    .s-in_progress      { background: #fff8e1; color: #e65100; }
    .s-done             { background: #e8f5e9; color: #1b5e20; }
    .s-no_show          { background: #fce4ec; color: #880e4f; }
    .s-cancelled        { background: #f5f5f5; color: #616161; }
    /* Cancel confirm */
    .cancel-confirm-box { text-align: center; padding: 8px 0 16px; }
    .cancel-icon        { color: #f59e0b; margin-bottom: 8px; }
    .cancel-heading     { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .cancel-sub         { font-size: 13px; color: #64748b; margin: 0; }
    .cancel-reason-field { width: 100%; margin-top: 8px; }
  `]
})
export class AppointmentDetailDialog {
  dialogRef       = inject(MatDialogRef<AppointmentDetailDialog>);
  data            = inject<Appointment>(MAT_DIALOG_DATA);
  private apptSvc = inject(AppointmentsService);
  private router  = inject(Router);
  private dialog  = inject(MatDialog);

  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;
  updating    = false;
  actionError = '';
  view: 'detail' | 'cancel' = 'detail';
  cancelReason = '';

  get allActions() { return STATUS_ACTIONS[this.data.status] ?? []; }
  get nonCancelActions() { return this.allActions.filter(a => a.next !== 'cancelled'); }
  get canCancel()  { return this.allActions.some(a => a.next === 'cancelled'); }
  get canReschedule() { return this.data.status === 'booked' || this.data.status === 'confirmed'; }
  get canRescheduleOrCancel() { return this.canReschedule || this.canCancel; }

  get scheduled(): string {
    try { return format(parseISO(this.data.scheduled_at.replace('Z', '')), 'EEE, d MMM yyyy · h:mm a'); }
    catch { return this.data.scheduled_at; }
  }

  doAction(next: AppointmentStatus) {
    this.updating    = true;
    this.actionError = '';
    this.apptSvc.updateStatus(this.data.id, next).subscribe({
      next: (res) => {
        this.updating = false;
        const appt = appointmentFromPatchResponse(res);
        this.dialogRef.close(appt ? { reload: true as const, appointment: appt } : 'reload');
      },
      error: () => { this.updating = false; this.actionError = 'Failed to update. Please try again.'; },
    });
  }

  confirmCancel() {
    this.updating    = true;
    this.actionError = '';
    this.apptSvc.updateStatus(this.data.id, 'cancelled', this.cancelReason || undefined).subscribe({
      next: (res) => {
        this.updating = false;
        const appt = appointmentFromPatchResponse(res);
        this.dialogRef.close(appt ? { reload: true as const, appointment: appt } : 'reload');
      },
      error: () => { this.updating = false; this.actionError = 'Failed to cancel. Please try again.'; },
    });
  }

  openReschedule() {
    this.dialog.open(RescheduleDialog, {
      data:      this.data,
      width:     '460px',
      maxWidth:  '95vw',
      autoFocus: false,
    }).afterClosed().subscribe(r => {
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
  private apptSvc    = inject(AppointmentsService);
  private svcSvc     = inject(ClinicServicesService);
  private chairsSvc  = inject(ChairsService);
  private dialog     = inject(MatDialog);
  private cdr        = inject(ChangeDetectorRef);

  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;

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

  private destroy$ = new Subject<void>();

  ngOnInit() {
    this.loadMeta();
    this.startPolling();
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

  // ── Date helpers ──────────────────────────────────────────────────────────

  get dateIso():   string { return format(this.selectedDate, 'yyyy-MM-dd'); }
  get dateLabel(): string {
    return isToday(this.selectedDate) ? 'Today' : format(this.selectedDate, 'EEE, d MMM yyyy');
  }

  prevDay() {
    this.statFilter = 'all';
    this.selectedDate = subDays(this.selectedDate, 1);
    this.triggerReload();
  }

  nextDay() {
    this.statFilter = 'all';
    this.selectedDate = addDays(this.selectedDate, 1);
    this.triggerReload();
  }

  goToday() {
    this.statFilter = 'all';
    this.selectedDate = new Date();
    this.triggerReload();
  }

  onDatePick(value: Date | null) {
    if (value) {
      this.statFilter = 'all';
      this.selectedDate = value;
      this.triggerReload();
    }
  }

  setStatFilter(f: ScheduleStatFilter) {
    this.statFilter = f;
    this.cdr.markForCheck();
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private startPolling() {
    // First load shows spinner; later polls refresh silently so cards/CSS are not replaced by a loading shell every minute.
    merge(
      of<'initial' | 'poll'>('initial'),
      interval(60_000).pipe(map(() => 'poll' as const)),
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
        this.error   = 'Could not load appointments. Retrying in 60s.';
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

  /** Appointments rendered in kanban columns after pill filter (chair + not cancelled + stat). */
  get displayedForBoard(): Appointment[] {
    const rows = this.filtered;
    switch (this.statFilter) {
      case 'active':
        return rows.filter(a => a.status === 'in_progress' || a.status === 'confirmed');
      case 'done':
        return rows.filter(a => a.status === 'done');
      case 'pending':
        return rows.filter(a => a.status === 'booked');
      default:
        return rows;
    }
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
}
