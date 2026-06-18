import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingCallerStore } from '../../store/marketing-caller.store';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { CallOutcomeFormComponent } from '../call-outcome-form/call-outcome-form.component';
import { CallbackSchedulerComponent } from '../callback-scheduler/callback-scheduler.component';
import { CallerQueueEntry, Callback, CALL_OUTCOME_LABELS } from '../../models/marketing.model';

@Component({
  selector: 'mkt-caller-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MaterialModule, TablerIconsModule, CallOutcomeFormComponent, CallbackSchedulerComponent],
  templateUrl: './caller-dashboard.component.html',
  styleUrl: './caller-dashboard.component.scss',
})
export class CallerDashboardComponent implements OnInit {
  readonly store = inject(MarketingCallerStore);
  private perms  = inject(PermissionService);

  readonly outcomeLabels = CALL_OUTCOME_LABELS;
  readonly canViewAll = this.perms.has('marketing.callqueue.view_all');
  readonly canLogOutcome = this.perms.has('marketing.calloutcome.create');
  readonly canScheduleCallback = this.perms.has('marketing.callback.schedule');

  readonly expandedId = signal<string | null>(null);

  ngOnInit(): void {
    this.store.loadQueue(false);
    if (this.canScheduleCallback) this.store.loadPendingCallbacks();
  }

  isOverdue(c: Callback): boolean {
    return new Date(c.scheduled_for) < new Date();
  }

  onCallbackChanged(): void {
    this.store.loadPendingCallbacks();
    this.store.loadQueue(this.store.viewAll());
  }

  toggleScope(all: boolean): void {
    this.store.loadQueue(all);
  }

  toggle(lead: CallerQueueEntry): void {
    this.expandedId.set(this.expandedId() === lead.id ? null : lead.id);
  }

  onLogged(): void {
    this.expandedId.set(null);
    this.store.loadQueue(this.store.viewAll());
  }
}
