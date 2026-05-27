import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'df-end-treatment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-end-treatment-modal.component.html',
  styleUrl: './df-end-treatment-modal.component.scss',
})
export class DfEndTreatmentModalComponent {
  readonly store    = inject(SessionStore);
  private api       = inject(SessionApiService);
  private dialogRef = inject(MatDialogRef<DfEndTreatmentModalComponent>);
  private router    = inject(Router);
  private toast     = inject(ToastService);

  readonly sealing  = signal(false);
  readonly error    = signal<string | null>(null);

  readonly failures = signal(this.store.validateSealPublic());

  readonly completedCount = signal(
    this.store.services().filter(s => s.status === 'COMPLETED' || s.status === 'PARTIAL').length
  );

  // Soft warning: services performed but no diagnoses recorded
  readonly noDiagnosisWarning = computed(() =>
    this.store.services().length > 0 && this.store.diagnoses().length === 0
  );

  seal(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    this.sealing.set(true);
    this.error.set(null);

    this.api.endTreatment(sessionId).subscribe({
      next: ({ session }) => {
        this.sealing.set(false);
        this.store.sealedAt.set(session.sealed_at);
        this.store.status.set(session.status);
        this.dialogRef.close({ sealed: true });
        this.toast.success('Treatment session sealed successfully.');
        this.router.navigate(['/schedule']);
      },
      error: (err) => {
        this.sealing.set(false);
        const msg = err?.error?.error ?? 'Failed to seal session. Please try again.';
        this.error.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
