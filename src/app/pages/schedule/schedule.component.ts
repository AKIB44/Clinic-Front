import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription, interval } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';
import { format } from 'date-fns';
import {
  AppointmentsService,
  Appointment,
} from '../../services/appointments.service';

type ChairFilter = 'all' | '1' | '2';

const STATUS_BADGE: Record<Appointment['status'], string> = {
  booked: 'badge-primary',
  confirmed: 'badge-success',
  in_progress: 'badge-warning',
  done: 'badge-secondary',
  no_show: 'badge-error',
  cancelled: 'badge-light',
};

const SERVICE_LABELS: Record<string, string> = {
  'SVC-01': 'Oral Prophylaxis',
  'SVC-02': 'Restoration',
  'SVC-03': 'Root Canal',
  'SVC-04': 'Extraction',
  'SVC-05': 'Orthodontics',
  'SVC-06': 'Implant',
  'SVC-07': 'Pulpectomy',
};

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule, TablerIconsModule],
  templateUrl: './schedule.component.html',
})
export class ScheduleComponent implements OnInit, OnDestroy {
  today = format(new Date(), 'yyyy-MM-dd');
  appointments: Appointment[] = [];
  loading = true;
  error = '';
  chairFilter: ChairFilter = 'all';
  statusBadge = STATUS_BADGE;
  serviceLabels = SERVICE_LABELS;

  private sub = new Subscription();

  constructor(private apptService: AppointmentsService) {}

  ngOnInit() {
    this.sub.add(
      interval(60_000)
        .pipe(
          startWith(0),
          switchMap(() => this.apptService.getTodaySchedule(this.today))
        )
        .subscribe({
          next: (r) => {
            this.appointments = r.appointments ?? [];
            this.loading = false;
            this.error = '';
          },
          error: () => {
            this.error = 'Failed to load schedule. Retrying in 60s.';
            this.loading = false;
          },
        })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  get filtered(): Appointment[] {
    if (this.chairFilter === 'all') return this.appointments;
    return this.appointments.filter(
      (a) => String(a.chair_id) === this.chairFilter
    );
  }

  setChair(chair: ChairFilter) {
    this.chairFilter = chair;
  }

  formatTime(iso: string): string {
    return format(new Date(iso), 'h:mm a');
  }
}
