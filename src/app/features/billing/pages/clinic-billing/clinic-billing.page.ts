import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { BillingStore } from '../../store/billing.store';
import { BillingApiService } from '../../services/billing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { DfExpenseModalComponent } from '../../components/df-expense-modal/df-expense-modal.component';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { ClinicExpense, ExpenseUpsert } from '../../models/billing.model';

@Component({
  selector: 'clinic-billing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './clinic-billing.page.html',
  styleUrl: './clinic-billing.page.scss',
})
export class ClinicBillingPage implements OnInit {
  readonly store = inject(BillingStore);
  private api    = inject(BillingApiService);
  private dialog  = inject(MatDialog);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);

  readonly periods = [
    { days: 30,  label: '30 days' },
    { days: 90,  label: '90 days' },
    { days: 365, label: '1 year' },
  ];

  ngOnInit(): void {
    this.store.load();
  }

  setPeriod(days: number): void {
    this.store.load(days);
  }

  inr(paise: number | null | undefined): string {
    return `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  inrRupees(rupees: number): string {
    return `₹${Number(rupees || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  addExpense(): void {
    this.openModal(null);
  }
  editExpense(e: ClinicExpense): void {
    this.openModal(e);
  }

  private openModal(expense: ClinicExpense | null): void {
    const ref = this.dialog.open(DfExpenseModalComponent, { data: { expense }, width: '520px' });
    ref.afterClosed().subscribe((payload: ExpenseUpsert | null) => {
      if (!payload) return;
      const req$ = expense
        ? this.api.updateExpense(expense.id, payload)
        : this.api.createExpense(payload);
      req$.subscribe({
        next: () => { this.toast.success(expense ? 'Expense updated.' : 'Expense added.'); this.store.load(); },
        error: (er) => this.toast.error(er?.error?.error ?? 'Could not save expense.'),
      });
    });
  }

  deleteExpense(e: ClinicExpense): void {
    this.confirm.ask({
      title: 'Delete expense?',
      body: `This removes the ${e.category.toLowerCase()} entry of ${this.inr(e.amount_paise)} from the ledger.`,
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deleteExpense(e.id).subscribe({
        next: () => { this.toast.success('Expense deleted.'); this.store.load(); },
        error: (er) => this.toast.error(er?.error?.error ?? 'Could not delete expense.'),
      });
    });
  }
}
