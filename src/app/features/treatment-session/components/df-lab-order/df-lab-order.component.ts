import {
  Component, input, computed, signal, inject, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ServicePerformed, LabOrderStatus } from '../../models/session.model';

export const LAB_STATUS_LABELS: Record<LabOrderStatus, string> = {
  created:         'Created',
  picked_up:       'Picked Up',
  in_progress:     'In Progress',
  delivered:       'Delivered',
  trial_returned:  'Trial Returned',
  completed:       'Completed',
  cancelled:       'Cancelled',
};

@Component({
  selector: 'df-lab-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TablerIconsModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './df-lab-order.component.html',
  styleUrl: './df-lab-order.component.scss',
})
export class DfLabOrderComponent {
  readonly service = input.required<ServicePerformed>();

  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  readonly labOrder = computed(() =>
    this.store.labOrders().find(lo => lo.service_id === this.service().id) ?? null
  );

  readonly statusLabels = LAB_STATUS_LABELS;
  readonly statusOptions = Object.entries(LAB_STATUS_LABELS) as [LabOrderStatus, string][];

  // ── Create form ───────────────────────────────────────────────────────────
  showCreateForm = false;
  newShade          = '';
  newExpectedDate: Date | null = null;
  newNotes          = '';

  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  // ── Update ────────────────────────────────────────────────────────────────
  readonly updating = signal(false);

  openCreateForm(): void {
    this.showCreateForm = true;
    this.newShade       = '';
    this.newExpectedDate = null;
    this.newNotes       = '';
    this.createError.set(null);
  }

  cancelCreateForm(): void {
    this.showCreateForm = false;
  }

  saveLabOrder(): void {
    this.creating.set(true);
    this.createError.set(null);

    this.api.addLabOrder(this.service().id, {
      shade:                  this.newShade.trim() || undefined,
      expected_delivery_date: this.formatExpectedDate(this.newExpectedDate),
      notes:                  this.newNotes.trim() || undefined,
    }).pipe(finalize(() => this.creating.set(false))).subscribe({
      next: ({ lab_order }) => {
        this.store.addLabOrder(lab_order);
        this.showCreateForm = false;
        this.toast.success('Lab order created.');
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to create lab order.';
        this.createError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  private formatExpectedDate(date: Date | null): string | undefined {
    if (!date) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  changeStatus(newStatus: LabOrderStatus): void {
    const lo = this.labOrder();
    if (!lo || lo.status === newStatus) return;

    this.updating.set(true);
    this.api.updateLabOrder(lo.id, { status: newStatus })
      .pipe(finalize(() => this.updating.set(false)))
      .subscribe({
        next: ({ lab_order }) => {
          this.store.updateLabOrder(lab_order);
          if (newStatus === 'cancelled') {
            this.toast.warn('Lab order cancelled.');
          } else {
            this.toast.success(`Lab order → ${LAB_STATUS_LABELS[newStatus]}.`);
          }
        },
        error: () => this.toast.error('Could not update lab order status.'),
      });
  }
}
