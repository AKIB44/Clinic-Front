import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PlatformStore } from '../../store/platform.store';
import { PlatformApiService } from '../../services/platform-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { SubscriptionPlan } from '../../models/plan.model';

@Component({
  selector: 'platform-plan-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './platform-plan-list.page.html',
  styleUrl: './platform-plan-list.page.scss',
})
export class PlatformPlanListPage implements OnInit {
  readonly store = inject(PlatformStore);
  private api    = inject(PlatformApiService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  ngOnInit(): void {
    this.store.loadPlans();
  }

  rupees(paise: number | null): string {
    if (paise == null) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  newPlan(): void {
    this.router.navigate(['/platform/plans/new']);
  }

  edit(plan: SubscriptionPlan): void {
    this.router.navigate(['/platform/plans', plan.id, 'edit']);
  }

  archive(plan: SubscriptionPlan): void {
    this.confirm.ask({
      title: `Archive "${plan.display_name}"?`,
      body: 'Existing subscriptions continue, but no new tenants can subscribe to this plan.',
      confirmLabel: 'Archive', confirmColor: 'warn', icon: 'archive',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.archivePlan(plan.id).subscribe({
        next: () => {
          this.store.remove(plan.id);
          this.toast.success(`${plan.display_name} archived.`);
        },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not archive plan.'),
      });
    });
  }
}
