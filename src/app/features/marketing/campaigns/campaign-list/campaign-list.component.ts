import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingCampaignsStore } from '../../store/marketing-campaigns.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { Campaign, CampaignStatus } from '../../models/marketing.model';

@Component({
  selector: 'campaign-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './campaign-list.component.html',
  styleUrl: './campaign-list.component.scss',
})
export class CampaignListComponent implements OnInit {
  readonly store = inject(MarketingCampaignsStore);
  private api     = inject(MarketingApiService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  private perms   = inject(PermissionService);

  readonly statuses: CampaignStatus[] = ['draft', 'scheduled', 'active', 'completed', 'archived'];
  statusFilter = '';

  readonly canCreate = this.perms.has('marketing.campaign.create');
  readonly canEdit   = this.perms.has('marketing.campaign.edit');
  readonly canDelete = this.perms.has('marketing.campaign.delete');
  readonly canSend   = this.perms.has('marketing.campaign.send');

  ngOnInit(): void {
    this.store.load();
  }

  applyFilter(): void {
    this.store.setFilters(this.statusFilter ? { status: this.statusFilter } : {});
  }

  inr(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  newCampaign(): void {
    this.router.navigate(['/marketing/campaigns/new']);
  }

  edit(c: Campaign): void {
    this.router.navigate(['/marketing/campaigns', c.id, 'edit']);
  }

  send(c: Campaign): void {
    this.confirm.ask({
      title: `Send "${c.name}"?`,
      body: 'Resolves the linked segment (or all patients) and broadcasts via the WhatsApp Message Center.',
      confirmLabel: 'Send', confirmColor: 'primary', icon: 'send',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.sendCampaign(c.id).subscribe({
        next: (r) => {
          this.store.upsert(r.data);
          const msg = `${r.recipients} recipient${r.recipients === 1 ? '' : 's'} · ${r.sent} sent` +
            (r.dispatched ? '' : ' (demo mode)');
          r.dispatched ? this.toast.success(msg) : this.toast.info(msg);
        },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not send campaign.'),
      });
    });
  }

  remove(c: Campaign): void {
    this.confirm.ask({
      title: `Delete "${c.name}"?`,
      body: 'The campaign will be removed from the list. This cannot be undone.',
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deleteCampaign(c.id).subscribe({
        next: () => { this.store.remove(c.id); this.toast.success(`${c.name} deleted.`); },
        error: (e) => this.toast.error(e?.error?.error ?? 'Could not delete campaign.'),
      });
    });
  }
}
