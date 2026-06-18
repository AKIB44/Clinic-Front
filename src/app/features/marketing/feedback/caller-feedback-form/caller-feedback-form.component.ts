import { Component, Input, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { MarketingFeedbackStore } from '../../store/marketing-feedback.store';
import { ToastService } from '../../../../services/toast.service';
import { Sentiment, RejectionReason, REJECTION_REASON_LABELS, CallerFeedback } from '../../models/marketing.model';

@Component({
  selector: 'mkt-caller-feedback-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './caller-feedback-form.component.html',
  styleUrl: './caller-feedback-form.component.scss',
})
export class CallerFeedbackFormComponent {
  @Input({ required: true }) leadId!: string;
  @Output() saved = new EventEmitter<CallerFeedback>();

  private api   = inject(MarketingApiService);
  private store = inject(MarketingFeedbackStore);
  private toast = inject(ToastService);

  readonly sentiments: Sentiment[] = ['positive', 'neutral', 'negative'];
  readonly objections = Object.entries(REJECTION_REASON_LABELS) as [RejectionReason, string][];
  readonly saving = signal(false);

  feedbackText = '';
  sentiment: Sentiment = 'neutral';
  keyObjection: RejectionReason | '' = '';
  followUpNeeded = false;

  submit(): void {
    if (!this.feedbackText.trim()) { this.toast.error('Feedback text is required.'); return; }
    this.saving.set(true);
    this.api.createCallerFeedback(this.leadId, {
      sentiment: this.sentiment,
      feedback_text: this.feedbackText.trim(),
      key_objection: this.keyObjection || null,
      follow_up_needed: this.followUpNeeded,
    }).subscribe({
      next: (r) => {
        this.store.addCallerFeedback(this.leadId, r.data);
        this.feedbackText = '';
        this.keyObjection = '';
        this.followUpNeeded = false;
        this.sentiment = 'neutral';
        this.saving.set(false);
        this.toast.success('Caller feedback logged.');
        this.saved.emit(r.data);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(e?.error?.error ?? 'Could not save caller feedback.');
      },
    });
  }
}
