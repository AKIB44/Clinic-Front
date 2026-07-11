import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { PostopComplication, RecoveryVital } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';
import { formatApiError } from '../../../../utils/api-error';

@Component({
  selector: 'df-postop-record',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-postop-record.component.html',
  styleUrl: './df-postop-record.component.scss',
})
export class DfPostopRecordComponent {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  showForm = false;
  readonly saving    = signal(false);
  readonly saveError = signal<string | null>(null);

  // Complications
  complications: PostopComplication[] = [];
  newCompType     = '';
  newCompSeverity: 'mild' | 'moderate' | 'severe' = 'mild';
  newCompAction   = '';

  // Sutures
  sutureCount: number | null = null;
  readonly sutureCountDisplay = signal('');
  sutureType: 'resorbable' | 'non-resorbable' | '' = '';
  sutureRemovalDate = '';

  // Specimen
  specimenSent      = false;
  specimenLabId     = '';
  specimenSlipNo    = '';
  specimenReportDate = '';

  // Recovery vitals
  recoveryVitals: RecoveryVital[] = [];
  newVitalBpSys:  number | null = null;
  newVitalBpDia:  number | null = null;
  newVitalPulse:  number | null = null;
  newVitalSpo2:   number | null = null;

  // Post-op instructions
  instructionsGiven = false;
  instructionsText  = '';
  patientAcknowledgedAt = '';

  // Follow-up
  followUpDate  = '';
  followUpNotes = '';
  notes         = '';

  readonly postop = computed(() => this.store.postop());

  // Visible only when session has services with postop_required (or a postop already exists)
  readonly shouldShow = computed(() =>
    !!this.store.postop() || this.store.services().some(s => (s as any).postop_required)
  );

  openForm(): void {
    const p = this.postop();
    if (p) {
      this.complications      = [...(p.complications ?? [])];
      this.sutureCount        = p.suture_count;
      this.sutureCountDisplay.set(this.formatSutureCount(p.suture_count));
      this.sutureType         = (p.suture_type ?? '') as any;
      this.sutureRemovalDate  = p.suture_removal_date ?? '';
      this.specimenSent       = p.specimen_sent;
      this.specimenLabId      = p.specimen_lab_id ?? '';
      this.specimenSlipNo     = p.specimen_request_slip_no ?? '';
      this.specimenReportDate = p.specimen_expected_report_date ?? '';
      this.recoveryVitals     = [...(p.recovery_vitals ?? [])];
      this.instructionsGiven  = p.postop_instructions_given;
      this.instructionsText   = p.postop_instructions_text ?? '';
      this.patientAcknowledgedAt = this.sanitizeFutureDateTime(p.patient_acknowledged_at);
      this.followUpDate       = this.sanitizeFutureDate(p.follow_up_date);
      this.followUpNotes      = p.follow_up_notes ?? '';
      this.notes              = p.notes ?? '';
    } else {
      this.complications  = [];
      this.recoveryVitals = [];
      this.sutureCountDisplay.set('');
    }
    this.showForm = true;
    this.saveError.set(null);
  }

  closeForm(): void {
    this.showForm = false;
  }

  addComplication(): void {
    if (!this.newCompType.trim()) return;
    this.complications = [...this.complications, {
      type: this.newCompType.trim(),
      severity: this.newCompSeverity,
      action_taken: this.newCompAction.trim(),
    }];
    this.newCompType   = '';
    this.newCompAction = '';
    this.newCompSeverity = 'mild';
  }

  removeComplication(i: number): void {
    this.complications = this.complications.filter((_, idx) => idx !== i);
  }

  onSutureCountChange(value: string): void {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      this.sutureCount = null;
      this.sutureCountDisplay.set('');
      return;
    }
    const parsed = parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.sutureCount = null;
      this.sutureCountDisplay.set('');
      return;
    }
    this.sutureCount = parsed;
    this.sutureCountDisplay.set(String(parsed));
  }

  private formatSutureCount(count: number | null | undefined): string {
    return count && count > 0 ? String(count) : '';
  }

  get minFollowUpDate(): string {
    return this.formatDateInput(new Date());
  }

  get minAcknowledgedAt(): string {
    return this.nowDatetimeLocal();
  }

  onPatientAcknowledgedAtChange(value: string): void {
    if (!value) {
      this.patientAcknowledgedAt = '';
      return;
    }
    if (this.isPastDateTime(value)) {
      this.patientAcknowledgedAt = '';
      this.saveError.set('Patient acknowledgement time must be in the future.');
      return;
    }
    this.patientAcknowledgedAt = value;
    this.saveError.set(null);
  }

  onFollowUpDateChange(value: string): void {
    if (!value) {
      this.followUpDate = '';
      return;
    }
    if (this.isPastDate(value)) {
      this.followUpDate = '';
      this.saveError.set('Follow-up date cannot be in the past.');
      return;
    }
    this.followUpDate = value;
    this.saveError.set(null);
  }

  private formatDateInput(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private nowDatetimeLocal(): string {
    const date = new Date();
    date.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toDatetimeLocalValue(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 16);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
  }

  private sanitizeFutureDate(value: string | null | undefined): string {
    if (!value) return '';
    const dateOnly = value.slice(0, 10);
    return this.isPastDate(dateOnly) ? '' : dateOnly;
  }

  private sanitizeFutureDateTime(value: string | null | undefined): string {
    const local = this.toDatetimeLocalValue(value);
    if (!local) return '';
    return this.isPastDateTime(local) ? '' : local;
  }

  private isPastDate(value: string): boolean {
    return value < this.minFollowUpDate;
  }

  private isPastDateTime(value: string): boolean {
    return new Date(value) <= new Date();
  }

  addRecoveryVital(): void {
    const vals = [this.newVitalBpSys, this.newVitalBpDia, this.newVitalPulse, this.newVitalSpo2];
    if (vals.some(v => v != null && v < 0)) {
      this.saveError.set('Vitals cannot be negative.');
      return;
    }
    this.saveError.set(null);
    this.recoveryVitals = [...this.recoveryVitals, {
      time:   new Date().toISOString(),
      bp_sys: this.newVitalBpSys,
      bp_dia: this.newVitalBpDia,
      pulse:  this.newVitalPulse,
      spo2:   this.newVitalSpo2,
    }];
    this.newVitalBpSys = this.newVitalBpDia = this.newVitalPulse = this.newVitalSpo2 = null;
  }

  removeVital(i: number): void {
    this.recoveryVitals = this.recoveryVitals.filter((_, idx) => idx !== i);
  }

  save(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    if (this.sutureCount != null && this.sutureCount < 0) {
      this.saveError.set('Suture count cannot be negative.');
      return;
    }

    if (this.patientAcknowledgedAt && this.isPastDateTime(this.patientAcknowledgedAt)) {
      this.saveError.set('Patient acknowledgement time must be in the future.');
      return;
    }

    if (this.followUpDate && this.isPastDate(this.followUpDate)) {
      this.saveError.set('Follow-up date cannot be in the past.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    this.api.savePostop(sessionId, {
      complications:                 this.complications,
      suture_count:                  this.sutureCount && this.sutureCount > 0 ? this.sutureCount : undefined,
      suture_type:                   (this.sutureType || undefined) as any,
      suture_removal_date:           this.sutureRemovalDate || undefined,
      specimen_sent:                 this.specimenSent,
      specimen_lab_id:               this.specimenLabId || undefined,
      specimen_request_slip_no:      this.specimenSlipNo || undefined,
      specimen_expected_report_date: this.specimenReportDate || undefined,
      recovery_vitals:               this.recoveryVitals,
      postop_instructions_given:     this.instructionsGiven,
      postop_instructions_text:      this.instructionsText || undefined,
      patient_acknowledged_at:       this.patientAcknowledgedAt
        ? new Date(this.patientAcknowledgedAt).toISOString()
        : undefined,
      follow_up_date:                this.followUpDate || undefined,
      follow_up_notes:               this.followUpNotes || undefined,
      notes:                         this.notes || undefined,
    } as any).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ postop }) => {
        this.saving.set(false);
        this.store.setPostop(postop);
        this.closeForm();
        this.toast.success('Post-op record saved.');
      },
      error: (err) => {
        this.saving.set(false);
        const msg = formatApiError(err, 'Failed to save post-op record.');
        this.saveError.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
