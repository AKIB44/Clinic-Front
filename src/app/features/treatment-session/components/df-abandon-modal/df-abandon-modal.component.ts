import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';
import { formatApiError } from '../../../../utils/api-error';

const REASONS: { value: string; label: string }[] = [
  { value: 'patient_request',    label: 'Patient request' },
  { value: 'medical',            label: 'Medical emergency' },
  { value: 'equipment_failure',  label: 'Equipment failure' },
  { value: 'time',               label: 'Time constraint' },
  { value: 'other',              label: 'Other' },
];

@Component({
  selector: 'df-abandon-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-abandon-modal.component.html',
  styleUrl: './df-abandon-modal.component.scss',
})
export class DfAbandonModalComponent {
  readonly store     = inject(SessionStore);
  private api        = inject(SessionApiService);
  private dialogRef  = inject(MatDialogRef<DfAbandonModalComponent>);
  private router     = inject(Router);
  private toast      = inject(ToastService);

  readonly reasons   = REASONS;
  endReason          = '';
  notes              = '';
  forceAbandon       = false;

  readonly abandoning   = signal(false);
  readonly error        = signal<string | null>(null);
  readonly inProgressCount = signal(this.store.inProgressServices().length);

  abandon(): void {
    if (!this.endReason) return;
    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    this.abandoning.set(true);
    this.error.set(null);

    this.api.abandonSession(sessionId, {
      end_reason: this.endReason,
      notes:      this.notes || undefined,
      force:      this.inProgressCount() > 0 ? true : undefined,
    }).pipe(finalize(() => this.abandoning.set(false))).subscribe({
      next: ({ session }) => {
        this.abandoning.set(false);
        this.store.status.set(session.status);
        this.store.sealedAt.set(null);
        this.dialogRef.close({ abandoned: true });
        this.toast.warn('Session abandoned.');
        this.router.navigate(['/schedule']);
      },
      error: (err) => {
        this.abandoning.set(false);
        const msg = formatApiError(err, 'Failed to abandon session.');
        this.error.set(msg);
      },
    });
  }
}
