import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubscriptionPlan, ClinicSubscriptionRow } from '../../models/plan.model';

@Component({
  selector: 'df-assign-plan-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './df-assign-plan-modal.component.html',
  styleUrl: './df-assign-plan-modal.component.scss',
})
export class DfAssignPlanModalComponent {
  planId: string | null;
  readonly plans: SubscriptionPlan[];
  readonly row: ClinicSubscriptionRow;

  constructor(
    private ref: MatDialogRef<DfAssignPlanModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { row: ClinicSubscriptionRow; plans: SubscriptionPlan[] },
  ) {
    this.row    = data.row;
    this.plans  = data.plans.filter((p) => p.is_active);
    this.planId = data.row.plan_id ?? null;
  }

  inr(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  }

  confirm(): void {
    if (this.planId) this.ref.close(this.planId);
  }
  cancel(): void { this.ref.close(null); }
}
