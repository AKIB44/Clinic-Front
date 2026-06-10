import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { PlatformApiService } from '../../services/platform-api.service';
import { ToastService } from '../../../../services/toast.service';
import { DfTenantActionModalComponent } from '../../components/df-tenant-action-modal/df-tenant-action-modal.component';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { TenantDetail } from '../../models/plan.model';

@Component({
  selector: 'platform-tenant-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './platform-tenant-detail.page.html',
  styleUrl: './platform-tenant-detail.page.scss',
})
export class PlatformTenantDetailPage implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(PlatformApiService);
  private dialog  = inject(MatDialog);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly detail  = signal<TenantDetail | null>(null);
  readonly loading = signal(false);
  readonly busy    = signal(false);
  private clinicId = '';

  ngOnInit(): void {
    this.clinicId = this.route.snapshot.paramMap.get('clinicId') ?? '';
    this.load();
  }

  private load(): void {
    if (!this.clinicId) return;
    this.loading.set(true);
    this.api.tenantDetail(this.clinicId).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: (e) => { this.toast.error(e?.error?.error ?? 'Failed to load tenant.'); this.loading.set(false); },
    });
  }

  back(): void { this.router.navigate(['/platform/subscriptions']); }

  inr(paise: number | null | undefined): string {
    return paise == null ? '—' : `₹${(paise / 100).toLocaleString('en-IN')}`;
  }
  usagePct(count: number, max: number | null): number {
    if (!max) return 0;
    return Math.min(100, Math.round((count / max) * 100));
  }

  private run(obs: any, msg: string): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => { this.busy.set(false); this.toast.success(msg); this.load(); },
      error: (e: any) => { this.busy.set(false); this.toast.error(e?.error?.error ?? 'Action failed.'); },
    });
  }

  suspend(): void {
    this.confirm.ask({
      title: 'Suspend clinic?',
      body: 'This clinic drops to read-only until reactivated. Staff can view data but cannot make changes.',
      confirmLabel: 'Suspend', confirmColor: 'warn', icon: 'player-pause',
    }).subscribe((ok) => {
      if (ok) this.run(this.api.suspendTenant(this.clinicId), 'Clinic suspended.');
    });
  }
  reactivate(): void {
    this.run(this.api.reactivateTenant(this.clinicId), 'Clinic reactivated.');
  }
  extend(): void {
    const ref = this.dialog.open(DfTenantActionModalComponent, {
      data: { action: 'extend', clinicName: this.detail()?.clinic.name ?? '' }, width: '420px',
    });
    ref.afterClosed().subscribe((r: { days: number } | null) => {
      if (r) this.run(this.api.extendTrial(this.clinicId, r.days), `Trial extended by ${r.days} days.`);
    });
  }
  revoke(): void {
    const ref = this.dialog.open(DfTenantActionModalComponent, {
      data: { action: 'revoke', clinicName: this.detail()?.clinic.name ?? '' }, width: '440px',
    });
    ref.afterClosed().subscribe((r: { reason: string } | null) => {
      if (r) this.run(this.api.revokeTenant(this.clinicId, r.reason), 'Access revoked.');
    });
  }
}
