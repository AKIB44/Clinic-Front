import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingScheduledCallsStore } from '../../store/marketing-scheduled-calls.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { ScheduledCallFormComponent } from '../scheduled-call-form/scheduled-call-form.component';
import { SlotPickerComponent } from '../slot-picker/slot-picker.component';
import { ScheduledCall, ScheduledCallStatus } from '../../models/marketing.model';

@Component({
  selector: 'mkt-scheduled-calls-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ScheduledCallFormComponent, SlotPickerComponent],
  templateUrl: './scheduled-calls-view.component.html',
  styleUrl: './scheduled-calls-view.component.scss',
})
export class ScheduledCallsViewComponent implements OnInit {
  readonly store = inject(MarketingScheduledCallsStore);
  private api    = inject(MarketingApiService);
  private toast  = inject(ToastService);
  private perms  = inject(PermissionService);

  readonly statuses: ScheduledCallStatus[] = ['upcoming', 'completed', 'no_show', 'rescheduled'];
  statusFilter: string = 'upcoming';

  readonly canCreate = this.perms.has('marketing.scheduled_calls.create');
  readonly showForm = signal(false);
  readonly showSlots = signal(false);

  ngOnInit(): void {
    this.store.loadStatus();
    this.reload();
  }

  reload(): void {
    this.store.load(this.statusFilter ? { status: this.statusFilter } : {});
  }

  onCreated(call: ScheduledCall): void {
    this.showForm.set(false);
    this.store.upsert(call);
    this.reload();
  }

  setStatus(call: ScheduledCall, status: ScheduledCallStatus): void {
    this.api.patchScheduledCall(call.id, { status }).subscribe({
      next: (r) => { this.store.upsert(r.data); this.toast.success('Updated.'); this.reload(); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not update.'),
    });
  }

  assigneeName(c: ScheduledCall): string {
    return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unassigned';
  }
}
