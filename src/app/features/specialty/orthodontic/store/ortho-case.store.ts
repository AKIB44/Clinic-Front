import { Injectable, signal, computed, inject } from '@angular/core';
import { OrthoCaseApiService } from '../services/ortho-case-api.service';
import type { OrthoArchwireLog, OrthoCaseDetail, OrthoRetentionPlan } from '../models/ortho-case.model';

@Injectable({ providedIn: 'root' })
export class OrthoCaseStore {
  private readonly api = inject(OrthoCaseApiService);

  readonly caseId       = signal<string | null>(null);
  readonly caseDetail   = signal<OrthoCaseDetail | null>(null);
  readonly archwires    = signal<OrthoArchwireLog[]>([]);
  readonly retentionPlan = signal<OrthoRetentionPlan | null>(null);
  readonly loading      = signal(false);
  readonly error        = signal<string | null>(null);

  readonly currentUpperWire = computed(() =>
    this.archwires().find(w => w.arch === 'UPPER' && !w.removedAt) ?? null);

  readonly currentLowerWire = computed(() =>
    this.archwires().find(w => w.arch === 'LOWER' && !w.removedAt) ?? null);

  readonly isAlignerCase = computed(() =>
    ['CLEAR_ALIGNERS', 'COMBINATION'].includes(this.caseDetail()?.applianceType ?? ''));

  readonly monthsInTreatment = computed(() => {
    const detail = this.caseDetail();
    if (!detail) return 0;
    return 0; // populated on loadCase with startedAt from specialty_case
  });

  async loadCase(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.api.getCase(id).toPromise() as Record<string, unknown>;
      this.caseId.set(id);
      if (data['archwires']) this.archwires.set(data['archwires'] as OrthoArchwireLog[]);
      if (data['retention_plan']) this.retentionPlan.set(data['retention_plan'] as OrthoRetentionPlan);
      const detail: OrthoCaseDetail = {
        caseId: id,
        applianceType: (data['appliance_type'] as string ?? 'METAL_BRACES') as OrthoCaseDetail['applianceType'],
        currentPhase: (data['current_phase'] as string ?? 'RECORDS') as OrthoCaseDetail['currentPhase'],
        slotSize: data['slot_size'] as string | null,
        angleClassMolar: data['angle_class_molar'] as string | null,
        angleClassCanine: data['angle_class_canine'] as string | null,
        overjetMm: data['overjet_mm'] as number | null,
        overbitemm: data['overbite_mm'] as number | null,
        openBite: data['open_bite'] as boolean ?? false,
        crowdingUpperMm: data['crowding_upper_mm'] as number | null,
        crowdingLowerMm: data['crowding_lower_mm'] as number | null,
        spacingUpperMm: data['spacing_upper_mm'] as number | null,
        spacingLowerMm: data['spacing_lower_mm'] as number | null,
        extractionPlan: data['extraction_plan'] as number[] | null,
        expectedDurationMonths: data['expected_duration_months'] as number | null,
        treatmentObjectives: data['treatment_objectives'] as string | null,
      };
      this.caseDetail.set(detail);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load case');
    } finally {
      this.loading.set(false);
    }
  }

  async transitionPhase(phase: string, reason?: string): Promise<void> {
    const id = this.caseId();
    if (!id) return;
    await this.api.transitionPhase(id, phase, reason).toPromise();
    const detail = this.caseDetail();
    if (detail) this.caseDetail.set({ ...detail, currentPhase: phase as OrthoCaseDetail['currentPhase'] });
  }
}
