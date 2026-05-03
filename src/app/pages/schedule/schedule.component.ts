import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { interval, Subject, forkJoin } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { AppointmentsService, Appointment, AppointmentStatus } from '../../services/appointments.service';
import { ClinicServicesService } from '../../services/clinic-services.service';
import { ChairsService } from '../../services/chairs.service';
import { Chair } from '../../models/clinic.model';

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

// ── Detail Dialog ─────────────────────────────────────────────────────────────

@Component({
  selector: 'appt-detail-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  template: `
    <div class="appt-dialog">
      <div class="dialog-header">
        <div class="dialog-header-left">
          <h2 class="dialog-title">{{ data.patient_name }}</h2>
          <div class="dialog-subtitle">{{ data.service_name }}</div>
        </div>
        <span class="status-badge s-{{ data.status }}">{{ statusLabel[data.status] || data.status }}</span>
      </div>

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

        @if (actions.length) {
          <div class="action-row">
            @for (a of actions; track a.next) {
              <button mat-flat-button [color]="a.color === 'primary' ? 'primary' : 'warn'"
                      [disabled]="updating" (click)="doAction(a.next)">
                {{ a.label }}
              </button>
            }
          </div>
        }

        @if (actionError) {
          <div class="dialog-error">{{ actionError }}</div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .appt-dialog       { min-width: 360px; max-width: 480px; }
    .dialog-header     { display: flex; justify-content: space-between; align-items: flex-start;
                         padding: 20px 24px 0; gap: 12px; }
    .dialog-header-left { flex: 1; }
    .dialog-title      { margin: 0; font-size: 18px; font-weight: 600; line-height: 1.3; }
    .dialog-subtitle   { color: #666; font-size: 13px; margin-top: 2px; }
    .dialog-body       { padding: 16px 24px !important; }
    .info-grid         { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .info-item         { display: flex; gap: 10px; align-items: flex-start; color: #555; }
    .info-label        { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .5px; }
    .info-val          { font-size: 14px; color: #333; margin-top: 2px; }
    .notes-block       { background: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
    .notes-text        { font-size: 14px; color: #444; margin-top: 4px; }
    .action-row        { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .dialog-error      { color: #c62828; font-size: 13px; margin-top: 8px; }
    .status-badge      { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
                         text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; flex-shrink: 0; }
    .s-booked          { background: #e3f2fd; color: #1565c0; }
    .s-confirmed       { background: #e8f5e9; color: #2e7d32; }
    .s-in_progress     { background: #fff8e1; color: #e65100; }
    .s-done            { background: #e8f5e9; color: #1b5e20; }
    .s-no_show         { background: #fce4ec; color: #880e4f; }
    .s-cancelled       { background: #f5f5f5; color: #616161; }
  `]
})
export class AppointmentDetailDialog {
  dialogRef       = inject(MatDialogRef<AppointmentDetailDialog>);
  data            = inject<Appointment>(MAT_DIALOG_DATA);
  private apptSvc = inject(AppointmentsService);

  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;
  updating    = false;
  actionError = '';

  get actions() { return STATUS_ACTIONS[this.data.status] ?? []; }

  get scheduled(): string {
    try { return format(parseISO(this.data.scheduled_at.replace('Z', '')), 'EEE, d MMM yyyy · h:mm a'); }
    catch { return this.data.scheduled_at; }
  }

  doAction(next: AppointmentStatus) {
    this.updating    = true;
    this.actionError = '';
    this.apptSvc.updateStatus(this.data.id, next).subscribe({
      next:  () => { this.updating = false; this.dialogRef.close('reload'); },
      error: () => { this.updating = false; this.actionError = 'Failed to update. Please try again.'; },
    });
  }
}

// ── Schedule Page ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
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

  prevDay() { this.selectedDate = subDays(this.selectedDate, 1); this.triggerReload(); }
  nextDay() { this.selectedDate = addDays(this.selectedDate, 1); this.triggerReload(); }
  goToday() { this.selectedDate = new Date();                    this.triggerReload(); }

  onDatePick(value: Date | null) {
    if (value) { this.selectedDate = value; this.triggerReload(); }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  private startPolling() {
    interval(60_000).pipe(
      startWith(0),
      switchMap(() => {
        this.loading = true;
        this.cdr.markForCheck();
        return this.apptSvc.getSchedule(this.dateIso);
      }),
      takeUntil(this.destroy$)
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

  triggerReload() {
    this.appointments = [];
    this.loading      = true;
    this.error        = '';
    this.cdr.markForCheck();
    this.apptSvc.getSchedule(this.dateIso).subscribe({
      next: (r) => {
        this.appointments = r.appointments ?? [];
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
    if (this.selectedChairId === 'all') return this.appointments;
    return this.appointments.filter(a => a.chair_id === this.selectedChairId);
  }

  columnCards(serviceId: string): Appointment[] {
    return this.filtered.filter(a => a.service_id === serviceId);
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
    ref.afterClosed().subscribe(result => {
      if (result === 'reload') this.triggerReload();
    });
  }

  trackByServiceId(_: number, c: ServiceColumn) { return c.serviceId; }
  trackById(_: number, a: Appointment)          { return a.id; }
}
