import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SessionStore } from '../../store/session.store';
import { SessionApiService } from '../../services/session-api.service';
import { PreopRecord } from '../../models/session.model';
import { ToastService } from '../../../../services/toast.service';

@Component({
  selector: 'df-preop-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './df-preop-checklist.component.html',
  styleUrl: './df-preop-checklist.component.scss',
})
export class DfPreopChecklistComponent {
  readonly store = inject(SessionStore);
  private api    = inject(SessionApiService);
  private toast  = inject(ToastService);

  showForm = false;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  // Form model (mirrors PreopRecord fields)
  bpSystolic:   number | null = null;
  bpDiastolic:  number | null = null;
  pulse:        number | null = null;
  spo2:         number | null = null;
  temperature:  number | null = null;
  bloodSugar:   number | null = null;
  inrValue:     number | null = null;
  allergiesConfirmed = false;
  antibioticGiven    = false;
  antibioticDrug     = '';
  antibioticDose     = '';
  npoHours:     number | null = null;
  anaesthesiaPlan: 'local' | 'sedation' | 'ga' = 'local';
  anaesthesiaAgent = '';
  anaesthesiaDose  = '';
  surgicalSiteMarked = false;
  overrideReason     = '';
  isComplete         = false;
  notes              = '';

  readonly preop = computed(() => this.store.preop());

  // Out-of-range vitals flags
  readonly vitalWarnings = computed(() => {
    const w: string[] = [];
    if (this.bpSystolic !== null && (this.bpSystolic < 90 || this.bpSystolic > 180)) w.push('BP systolic out of range');
    if (this.bpDiastolic !== null && (this.bpDiastolic < 60 || this.bpDiastolic > 110)) w.push('BP diastolic out of range');
    if (this.pulse !== null && (this.pulse < 50 || this.pulse > 120)) w.push('Pulse out of range');
    if (this.spo2 !== null && this.spo2 < 95) w.push('SpO₂ low');
    if (this.temperature !== null && (this.temperature < 36 || this.temperature > 38)) w.push('Temperature out of range');
    return w;
  });

  openForm(): void {
    const p = this.preop();
    if (p) {
      this.bpSystolic        = p.bp_systolic;
      this.bpDiastolic       = p.bp_diastolic;
      this.pulse             = p.pulse;
      this.spo2              = p.spo2;
      this.temperature       = p.temperature;
      this.bloodSugar        = p.blood_sugar;
      this.inrValue          = p.inr_value;
      this.allergiesConfirmed = !!p.allergies_confirmed_at;
      this.antibioticGiven   = p.antibiotic_prophylaxis_given;
      this.antibioticDrug    = p.antibiotic_drug ?? '';
      this.antibioticDose    = p.antibiotic_dose ?? '';
      this.npoHours          = p.npo_hours;
      this.anaesthesiaPlan   = p.anaesthesia_plan;
      this.anaesthesiaAgent  = p.anaesthesia_agent ?? '';
      this.anaesthesiaDose   = p.anaesthesia_dose ?? '';
      this.surgicalSiteMarked = p.surgical_site_marked;
      this.overrideReason    = p.override_reason ?? '';
      this.isComplete        = p.is_complete;
      this.notes             = p.notes ?? '';
    }
    this.showForm = true;
    this.saveError.set(null);
  }

  closeForm(): void {
    this.showForm = false;
  }

  save(): void {
    const sessionId = this.store.sessionId();
    if (!sessionId) return;

    // Vitals can never be negative — hard block (not overridable).
    const numeric = [this.bpSystolic, this.bpDiastolic, this.pulse, this.spo2,
                     this.temperature, this.bloodSugar, this.inrValue, this.npoHours];
    if (numeric.some(v => v != null && v < 0)) {
      this.saveError.set('Vitals cannot be negative.');
      return;
    }

    const hasWarnings = this.vitalWarnings().length > 0;
    if (hasWarnings && !this.overrideReason.trim()) {
      this.saveError.set('Out-of-range vitals detected — please provide an override reason.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    this.api.savePreop(sessionId, {
      bp_systolic:                  this.bpSystolic ?? undefined,
      bp_diastolic:                 this.bpDiastolic ?? undefined,
      pulse:                        this.pulse ?? undefined,
      spo2:                         this.spo2 ?? undefined,
      temperature:                  this.temperature ?? undefined,
      blood_sugar:                  this.bloodSugar ?? undefined,
      inr_value:                    this.inrValue ?? undefined,
      allergies_confirmed_at:       this.allergiesConfirmed ? new Date().toISOString() : undefined,
      antibiotic_prophylaxis_given: this.antibioticGiven,
      antibiotic_drug:              this.antibioticDrug || undefined,
      antibiotic_dose:              this.antibioticDose || undefined,
      npo_hours:                    this.npoHours ?? undefined,
      anaesthesia_plan:             this.anaesthesiaPlan,
      anaesthesia_agent:            this.anaesthesiaAgent || undefined,
      anaesthesia_dose:             this.anaesthesiaDose || undefined,
      surgical_site_marked:         this.surgicalSiteMarked,
      override_reason:              this.overrideReason || undefined,
      is_complete:                  this.isComplete,
      notes:                        this.notes || undefined,
    } as Partial<PreopRecord>).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ preop }) => {
        this.saving.set(false);
        this.store.setPreop(preop);
        this.closeForm();
        this.toast.success(preop.is_complete ? 'Pre-op checklist completed.' : 'Pre-op record saved.');
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.error ?? 'Failed to save pre-op record.';
        this.saveError.set(msg);
        this.toast.error(msg);
      },
    });
  }
}
