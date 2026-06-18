import { Component, Output, EventEmitter, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import {
  MarketingExpense, ExpenseCategory, PaymentMode, Campaign,
  EXPENSE_CATEGORY_LABELS,
} from '../../models/marketing.model';

@Component({
  selector: 'mkt-expense-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent implements OnInit {
  @Output() created = new EventEmitter<MarketingExpense>();
  @Output() cancelled = new EventEmitter<void>();

  private api   = inject(MarketingApiService);
  private toast = inject(ToastService);

  readonly categories = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];
  readonly paymentModes: PaymentMode[] = ['upi', 'card', 'cash', 'bank_transfer'];
  readonly campaigns = signal<Campaign[]>([]);
  readonly saving = signal(false);

  category: ExpenseCategory = 'ad_spend';
  vendor = '';
  amountRupees: number | null = null;
  spentOn = new Date().toISOString().slice(0, 10);
  paymentMode: PaymentMode | '' = '';
  campaignId = '';
  description = '';
  receipt: File | null = null;

  ngOnInit(): void {
    this.api.listCampaigns().subscribe({ next: (r) => this.campaigns.set(r.data), error: () => {} });
  }

  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.receipt = input.files?.[0] ?? null;
  }

  submit(): void {
    if (!this.amountRupees || this.amountRupees <= 0) { this.toast.error('Enter an amount.'); return; }
    const fd = new FormData();
    fd.append('category', this.category);
    fd.append('amount_paise', String(Math.round(this.amountRupees * 100)));
    fd.append('spent_on', this.spentOn);
    if (this.vendor.trim())      fd.append('vendor', this.vendor.trim());
    if (this.description.trim()) fd.append('description', this.description.trim());
    if (this.paymentMode)        fd.append('payment_mode', this.paymentMode);
    if (this.campaignId)         fd.append('campaign_id', this.campaignId);
    if (this.receipt)            fd.append('receipt', this.receipt);

    this.saving.set(true);
    this.api.createExpense(fd).subscribe({
      next: (r) => { this.saving.set(false); this.toast.success('Expense filed.'); this.created.emit(r.data); },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.error ?? 'Could not file expense.'); },
    });
  }
}
