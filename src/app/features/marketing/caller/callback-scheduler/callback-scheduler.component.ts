import { Component, Input, Output, EventEmitter, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { Callback } from '../../models/marketing.model';

/** One pending callback with mark-called / reschedule / cancel actions. */
@Component({
  selector: 'mkt-callback-scheduler',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule, TablerIconsModule],
  templateUrl: './callback-scheduler.component.html',
  styleUrl: './callback-scheduler.component.scss',
})
export class CallbackSchedulerComponent {
  @Input({ required: true }) callback!: Callback;
  @Input() overdue = false;
  /** Emitted after any change so the parent can refresh the queue + callbacks. */
  @Output() changed = new EventEmitter<void>();

  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);

  readonly rescheduling = signal(false);
  readonly busy = signal(false);
  newTime = '';

  markCalled(): void {
    this.patch({ status: 'called' }, 'Marked as called.');
  }

  cancel(): void {
    this.patch({ status: 'cancelled' }, 'Callback cancelled.');
  }

  startReschedule(): void {
    this.newTime = '';
    this.rescheduling.set(true);
  }

  saveReschedule(): void {
    if (!this.newTime) { this.toast.error('Pick a new date & time.'); return; }
    // Keep it pending at the new time so it stays on the queue.
    this.patch({ scheduled_for: new Date(this.newTime).toISOString() }, 'Callback rescheduled.');
  }

  private patch(body: { status?: string; scheduled_for?: string }, msg: string): void {
    this.busy.set(true);
    this.api.patchCallback(this.callback.id, body).subscribe({
      next: () => {
        this.busy.set(false);
        this.rescheduling.set(false);
        this.toast.success(msg);
        this.changed.emit();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.error(e?.error?.error ?? 'Could not update callback.');
      },
    });
  }
}
