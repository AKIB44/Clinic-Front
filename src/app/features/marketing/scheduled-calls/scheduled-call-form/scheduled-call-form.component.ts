import { Component, Output, EventEmitter, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ScheduledCall, CallerOption } from '../../models/marketing.model';

@Component({
  selector: 'mkt-scheduled-call-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './scheduled-call-form.component.html',
  styleUrl: './scheduled-call-form.component.scss',
})
export class ScheduledCallFormComponent implements OnInit {
  @Output() created = new EventEmitter<ScheduledCall>();
  @Output() cancelled = new EventEmitter<void>();

  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);

  readonly saving = signal(false);
  readonly assignees = signal<CallerOption[]>([]);

  clinicName = '';
  contactName = '';
  contactPhone = '';
  scheduledFor = '';
  durationMinutes = 30;
  assignedToId = '';

  ngOnInit(): void {
    this.api.callers().subscribe({ next: (r) => this.assignees.set(r.data), error: () => {} });
  }

  submit(): void {
    if (!this.scheduledFor) { this.toast.error('Pick a date & time.'); return; }
    this.saving.set(true);
    this.api.createScheduledCall({
      clinic_name: this.clinicName.trim() || null,
      contact_name: this.contactName.trim() || null,
      contact_phone: this.contactPhone.trim() || null,
      scheduled_for: new Date(this.scheduledFor).toISOString(),
      duration_minutes: this.durationMinutes,
      assigned_to_id: this.assignedToId || null,
    }).subscribe({
      next: (r) => { this.saving.set(false); this.toast.success('Meeting scheduled.'); this.created.emit(r.data); },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.error ?? 'Could not schedule meeting.'); },
    });
  }
}
