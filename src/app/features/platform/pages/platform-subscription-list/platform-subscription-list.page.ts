import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { PlatformStore } from '../../store/platform.store';
import { PlatformApiService } from '../../services/platform-api.service';
import { ToastService } from '../../../../services/toast.service';
import { DfAssignPlanModalComponent } from '../../components/df-assign-plan-modal/df-assign-plan-modal.component';
import { DfProvisionClinicModalComponent } from '../../components/df-provision-clinic-modal/df-provision-clinic-modal.component';
import { ClinicSubscriptionRow, ProvisionClinicPayload } from '../../models/plan.model';

@Component({
  selector: 'platform-subscription-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './platform-subscription-list.page.html',
  styleUrl: './platform-subscription-list.page.scss',
})
export class PlatformSubscriptionListPage implements OnInit {
  readonly store = inject(PlatformStore);
  private api    = inject(PlatformApiService);
  private dialog = inject(MatDialog);
  private toast  = inject(ToastService);
  private router = inject(Router);

  view(clinicId: string): void {
    this.router.navigate(['/platform/tenants', clinicId]);
  }

  ngOnInit(): void {
    this.store.loadSubscriptions();
    if (this.store.plans().length === 0) this.store.loadPlans();
  }

  inr(paise: number | null): string {
    if (paise == null) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  provisionClinic(): void {
    const ref = this.dialog.open(DfProvisionClinicModalComponent, {
      data: { plans: this.store.plans() },
      width: '560px',
    });
    ref.afterClosed().subscribe((payload: ProvisionClinicPayload | null) => {
      if (!payload) return;
      this.api.provisionClinic(payload).subscribe({
        next: () => { this.toast.success(`${payload.clinic_name} provisioned on a trial.`); this.store.loadSubscriptions(); },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not provision clinic.'),
      });
    });
  }

  assign(row: ClinicSubscriptionRow): void {
    const ref = this.dialog.open(DfAssignPlanModalComponent, {
      data: { row, plans: this.store.plans() },
      width: '460px',
    });
    ref.afterClosed().subscribe((planId: string | null) => {
      if (!planId) return;
      this.api.assignPlan(row.clinic_id, planId).subscribe({
        next: () => { this.toast.success(`Plan assigned to ${row.clinic_name}.`); this.store.loadSubscriptions(); },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not assign plan.'),
      });
    });
  }
}
