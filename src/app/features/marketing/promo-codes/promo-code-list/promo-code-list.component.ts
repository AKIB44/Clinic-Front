import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { PromoCode, PromoRedemption, DiscountType } from '../../models/marketing.model';

@Component({
  selector: 'mkt-promo-code-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './promo-code-list.component.html',
  styleUrl: './promo-code-list.component.scss',
})
export class PromoCodeListComponent implements OnInit {
  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);
  private perms = inject(PermissionService);

  readonly codes = signal<PromoCode[]>([]);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly expandedId = signal<string | null>(null);
  readonly redemptions = signal<Record<string, PromoRedemption[]>>({});

  readonly canCreate = this.perms.has('marketing.promocode.create');
  readonly canEdit   = this.perms.has('marketing.promocode.edit');

  // create form
  code = '';
  discountType: DiscountType = 'percent';
  discountValue: number | null = null;
  maxRedemptions: number | null = null;
  validFrom = '';
  validUntil = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.listPromoCodes().subscribe({
      next: (r) => { this.codes.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  format(p: PromoCode): string {
    return p.discount_type === 'percent' ? `${p.discount_value}% off` : `₹${p.discount_value} off`;
  }

  save(): void {
    if (!this.code.trim() || !this.discountValue) { this.toast.error('Code and discount are required.'); return; }
    this.api.createPromoCode({
      code: this.code.trim().toUpperCase(),
      discount_type: this.discountType,
      discount_value: this.discountValue,
      max_redemptions: this.maxRedemptions ?? null,
      valid_from: this.validFrom || null,
      valid_until: this.validUntil || null,
    }).subscribe({
      next: (r) => {
        this.codes.set([r.data, ...this.codes()]);
        this.showForm.set(false);
        this.code = ''; this.discountValue = null; this.maxRedemptions = null; this.validFrom = ''; this.validUntil = '';
        this.toast.success('Promo code created.');
      },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not create code.'),
    });
  }

  toggleActive(p: PromoCode): void {
    this.api.updatePromoCode(p.id, { active: !p.active }).subscribe({
      next: (r) => { this.codes.set(this.codes().map((c) => (c.id === p.id ? r.data : c))); },
      error: (e) => this.toast.error(e?.error?.error ?? 'Could not update.'),
    });
  }

  toggleRedemptions(p: PromoCode): void {
    if (this.expandedId() === p.id) { this.expandedId.set(null); return; }
    this.expandedId.set(p.id);
    if (!this.redemptions()[p.id]) {
      this.api.promoRedemptions(p.id).subscribe({
        next: (r) => this.redemptions.set({ ...this.redemptions(), [p.id]: r.data }),
        error: () => {},
      });
    }
  }
}
