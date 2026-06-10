import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SubscriptionPlan, ProvisionClinicPayload } from '../../models/plan.model';

@Component({
  selector: 'df-provision-clinic-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './df-provision-clinic-modal.component.html',
  styleUrl: './df-provision-clinic-modal.component.scss',
})
export class DfProvisionClinicModalComponent {
  readonly plans: SubscriptionPlan[];

  form = {
    clinic_name: '', phone: '', email: '', city: '', subdomain: '',
    owner_first_name: '', owner_last_name: '', owner_email: '', owner_password: '',
    plan_id: '',
  };

  constructor(
    private ref: MatDialogRef<DfProvisionClinicModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { plans: SubscriptionPlan[] },
  ) {
    this.plans = data.plans.filter((p) => p.is_active);
    this.form.plan_id = this.plans[0]?.id ?? '';
  }

  get valid(): boolean {
    const f = this.form;
    return !!(f.clinic_name.trim() && f.phone.trim() && f.email.trim()
      && f.owner_first_name.trim() && f.owner_email.trim()
      && f.owner_password.length >= 8 && f.plan_id);
  }

  save(): void {
    if (!this.valid) return;
    const f = this.form;
    const payload: ProvisionClinicPayload = {
      clinic_name: f.clinic_name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      city: f.city.trim() || undefined,
      subdomain: f.subdomain.trim() || undefined,
      owner_first_name: f.owner_first_name.trim(),
      owner_last_name: f.owner_last_name.trim() || undefined,
      owner_email: f.owner_email.trim(),
      owner_password: f.owner_password,
      plan_id: f.plan_id,
    };
    this.ref.close(payload);
  }

  cancel(): void { this.ref.close(null); }
}
