import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { interval, Subject } from 'rxjs';
import { startWith, switchMap, takeUntil } from 'rxjs/operators';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { AppointmentsService, Appointment } from '../../services/appointments.service';

export interface ServiceColumn {
  serviceId: string;
  label: string;
  icon: string;
  headerBg: string;
  dotColor: string;
}

export const SERVICE_COLUMNS: ServiceColumn[] = [
  { serviceId: 'SVC-01', label: 'Oral Prophylaxis', icon: 'tooth',         headerBg: '#e3f2fd', dotColor: '#1976d2' },
  { serviceId: 'SVC-02', label: 'Restoration',       icon: 'puzzle',        headerBg: '#e8f5e9', dotColor: '#388e3c' },
  { serviceId: 'SVC-03', label: 'Root Canal',         icon: 'needle',        headerBg: '#fff8e1', dotColor: '#f57c00' },
  { serviceId: 'SVC-04', label: 'Extraction',         icon: 'scissors',      headerBg: '#fce4ec', dotColor: '#c62828' },
  { serviceId: 'SVC-05', label: 'Orthodontics',       icon: 'align-center',  headerBg: '#f3e5f5', dotColor: '#7b1fa2' },
  { serviceId: 'SVC-06', label: 'Implant',            icon: 'bolt',          headerBg: '#e0f2f1', dotColor: '#00796b' },
  { serviceId: 'SVC-07', label: 'Pulpectomy',         icon: 'baby-carriage', headerBg: '#fff3e0', dotColor: '#e65100' },
];

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

@Component({
  selector: 'app-schedule',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
})
export class ScheduleComponent implements OnInit, OnDestroy {
  columns     = SERVICE_COLUMNS;
  statusLabel = STATUS_LABEL;
  sourceIcon  = BOOKING_SOURCE_ICON;

  selectedDate = new Date();
  appointments: Appointment[] = [];
  loading  = true;
  error    = '';
  chairFilter: 'all' | '1' | '2' = 'all';
  expandedCard: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private apptService: AppointmentsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() { this.startPolling(); }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Date helpers ─────────────────────────────────────────────────────────────

  get dateIso(): string { return format(this.selectedDate, 'yyyy-MM-dd'); }

  get dateLabel(): string {
    if (isToday(this.selectedDate)) return 'Today';
    return format(this.selectedDate, 'EEE, d MMM yyyy');
  }

  prevDay()  { this.selectedDate = subDays(this.selectedDate, 1); this.triggerReload(); }
  nextDay()  { this.selectedDate = addDays(this.selectedDate, 1); this.triggerReload(); }
  goToday()  { this.selectedDate = new Date(); this.triggerReload(); }

  onDatePick(value: Date | null) {
    if (value) { this.selectedDate = value; this.triggerReload(); }
  }

  // ── Polling ──────────────────────────────────────────────────────────────────

  private startPolling() {
    interval(60_000).pipe(
      startWith(0),
      switchMap(() => {
        this.loading = true;
        this.cdr.markForCheck();
        return this.apptService.getTodaySchedule(this.dateIso);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (r) => {
        this.appointments = r.appointments ?? [];
        this.loading = false;
        this.error   = '';
        this.cdr.markForCheck();
      },
      error: () => {
        this.error   = 'Could not load appointments. Retrying in 60s.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private triggerReload() {
    this.appointments = [];
    this.loading = true;
    this.error   = '';
    this.cdr.markForCheck();
    this.apptService.getTodaySchedule(this.dateIso).subscribe({
      next: (r) => {
        this.appointments = r.appointments ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error   = 'Could not load appointments.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  get filtered(): Appointment[] {
    if (this.chairFilter === 'all') return this.appointments;
    return this.appointments.filter((a) => String(a.chair_id) === this.chairFilter);
  }

  columnCards(serviceId: string): Appointment[] {
    return this.filtered.filter((a) => a.service_id === serviceId);
  }

  get totalCount():   number { return this.filtered.length; }
  get activeCount():  number { return this.filtered.filter(a => a.status === 'in_progress' || a.status === 'confirmed').length; }
  get doneCount():    number { return this.filtered.filter(a => a.status === 'done').length; }
  get pendingCount(): number { return this.filtered.filter(a => a.status === 'booked').length; }

  // ── Card helpers ─────────────────────────────────────────────────────────────

  formatTime(iso: string): string {
    try { return format(parseISO(iso), 'h:mm a'); } catch { return iso; }
  }

  toggleCard(id: string) {
    this.expandedCard = this.expandedCard === id ? null : id;
  }

  trackByServiceId(_: number, c: ServiceColumn) { return c.serviceId; }
  trackById(_: number, a: Appointment)          { return a.id; }
}
