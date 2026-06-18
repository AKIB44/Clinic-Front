import { Component, Input, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { MarketingFeedbackStore } from '../../store/marketing-feedback.store';
import { ToastService } from '../../../../services/toast.service';
import { Disposition, DISPOSITION_LABELS, LeadFeedback } from '../../models/marketing.model';

@Component({
  selector: 'mkt-lead-feedback-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './lead-feedback-form.component.html',
  styleUrl: './lead-feedback-form.component.scss',
})
export class LeadFeedbackFormComponent {
  @Input({ required: true }) leadId!: string;
  @Output() saved = new EventEmitter<LeadFeedback>();

  private api   = inject(MarketingApiService);
  private store = inject(MarketingFeedbackStore);
  private toast = inject(ToastService);

  readonly dispositions = Object.entries(DISPOSITION_LABELS) as [Disposition, string][];
  readonly saving = signal(false);

  feedbackText = '';
  disposition: Disposition = 'interested';
  rejectionNotes = '';

  get showNotes(): boolean { return this.disposition === 'other'; }

  submit(): void {
    if (!this.feedbackText.trim()) { this.toast.error('Feedback text is required.'); return; }
    this.saving.set(true);
    this.api.createLeadFeedback(this.leadId, {
      feedback_text: this.feedbackText.trim(),
      disposition: this.disposition,
      rejection_notes: this.showNotes ? (this.rejectionNotes.trim() || null) : null,
    }).subscribe({
      next: (r) => {
        this.store.addLeadFeedback(this.leadId, r.data);
        this.feedbackText = '';
        this.rejectionNotes = '';
        this.disposition = 'interested';
        this.saving.set(false);
        this.toast.success('Feedback logged.');
        this.saved.emit(r.data);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.error ?? 'Could not save feedback.');
      },
    });
  }
}
