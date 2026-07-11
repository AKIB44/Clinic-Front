import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { TpaStatus } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';
import { formatApiError } from '../../../../utils/api-error';

@Component({
  selector: 'df-tpa-block',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-tpa-block.component.html',
  styleUrl: './df-tpa-block.component.scss',
})
export class DfTpaBlockComponent {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  showForm = false;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  // Form fields
  insurerName     = '';
  policyNumber    = '';
  preauthNumber   = '';
  approvedAmount: number | null = null;
  copayPct        = 0;
  copayFlat       = 0;
  status: TpaStatus = 'PENDING';
  notes           = '';

  readonly statusOptions: { value: TpaStatus; label: string }[] = [
    { value: 'PENDING',             label: 'Pending' },
    { value: 'APPROVED',            label: 'Approved' },
    { value: 'PARTIALLY_APPROVED',  label: 'Partially Approved' },
    { value: 'REJECTED',            label: 'Rejected' },
    { value: 'CANCELLED',           label: 'Cancelled' },
  ];

  openForm(): void {
    this.insurerName   = '';
    this.policyNumber  = '';
    this.preauthNumber = '';
    this.approvedAmount = null;
    this.copayPct = 0;
    this.copayFlat = 0;
    this.status = 'PENDING';
    this.notes = '';
    this.saveError.set(null);
    this.showForm = true;
  }

  closeForm(): void { this.showForm = false; }

  save(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId || !this.insurerName.trim()) return;

    this.saving.set(true);
    this.saveError.set(null);

    this.api.addTpa(sessionId, {
      insurer_name:    this.insurerName.trim(),
      policy_number:   this.policyNumber || undefined,
      preauth_number:  this.preauthNumber || undefined,
      approved_amount: this.approvedAmount ?? undefined,
      copay_pct:       this.copayPct || 0,
      copay_flat:      this.copayFlat || 0,
      status:          this.status,
      notes:           this.notes || undefined,
    }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ tpa }) => {
        this.saving.set(false);
        this.store.addTpa(tpa);
        this.closeForm();
        this.toast.success('TPA record added.');
      },
      error: (err) => {
        this.saving.set(false);
        const msg = formatApiError(err, 'Failed to save TPA record.');
        this.saveError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  updateStatus(tpaId: string, newStatus: TpaStatus): void {
    this.api.updateTpa(tpaId, { status: newStatus }).subscribe({
      next: ({ tpa }) => {
        this.store.updateTpa(tpa);
        if (newStatus === 'CANCELLED' || newStatus === 'REJECTED') {
          this.toast.warn(`TPA ${newStatus === 'CANCELLED' ? 'cancelled' : 'rejected'}.`);
        } else {
          this.toast.success('TPA status updated.');
        }
      },
      error: () => this.toast.error('Could not update TPA status.'),
    });
  }

  statusClass(status: TpaStatus): string {
    const map: Record<TpaStatus, string> = {
      PENDING: 'pending', APPROVED: 'approved',
      PARTIALLY_APPROVED: 'partial', REJECTED: 'rejected', CANCELLED: 'cancelled',
    };
    return map[status] ?? '';
  }
}
