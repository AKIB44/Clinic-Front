import { Component, Input, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { MarketingCallerStore } from '../../store/marketing-caller.store';
import { ToastService } from '../../../../services/toast.service';
import { CallOutcome, CALL_OUTCOME_LABELS, CallLog, PipelineLead } from '../../models/marketing.model';

@Component({
  selector: 'mkt-call-outcome-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './call-outcome-form.component.html',
  styleUrl: './call-outcome-form.component.scss',
})
export class CallOutcomeFormComponent {
  @Input({ required: true }) leadId!: string;
  @Output() saved = new EventEmitter<{ log: CallLog; lead: PipelineLead }>();

  private api   = inject(MarketingApiService);
  private store = inject(MarketingCallerStore);
  private toast = inject(ToastService);

  readonly outcomes = Object.entries(CALL_OUTCOME_LABELS) as [CallOutcome, string][];
  readonly saving = signal(false);

  outcome: CallOutcome = 'reached_interested';
  durationSecs: number | null = null;
  notes = '';
  callbackAt = '';

  get isCallback(): boolean { return this.outcome === 'reached_callback'; }

  submit(): void {
    if (this.isCallback && !this.callbackAt) {
      this.toast.error('Pick a callback date & time.');
      return;
    }
    this.saving.set(true);
    this.api.createCallLog({
      lead_id: this.leadId,
      outcome: this.outcome,
      notes: this.notes.trim() || null,
      duration_secs: this.durationSecs,
      callback_scheduled_for: this.isCallback ? new Date(this.callbackAt).toISOString() : null,
    }).subscribe({
      next: (r) => {
        this.store.addCallLog(this.leadId, r.data);
        if (r.callback) this.store.loadPendingCallbacks();
        this.notes = '';
        this.durationSecs = null;
        this.callbackAt = '';
        this.saving.set(false);
        this.toast.success(r.callback ? 'Outcome logged · callback scheduled.' : 'Call outcome logged.');
        this.saved.emit({ log: r.data, lead: r.lead });
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.error ?? 'Could not log call outcome.');
      },
    });
  }
}
