import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MaterialModule } from '../../../../material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MarketingExpensesStore } from '../../store/marketing-expenses.store';
import { MarketingApiService } from '../../services/marketing-api.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../core/ui/confirm.service';
import { PermissionService } from '../../../../core/rbac/permission.service';
import { MarketingExpense, ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '../../models/marketing.model';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';

@Component({
  selector: 'mkt-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, MaterialModule, TablerIconsModule, ExpenseFormComponent],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.scss',
})
export class ExpenseListComponent implements OnInit {
  readonly store = inject(MarketingExpensesStore);
  private api     = inject(MarketingApiService);
  private toast   = inject(ToastService);
  private confirm = inject(ConfirmService);
  private perms   = inject(PermissionService);

  readonly categories = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];
  readonly categoryLabels = EXPENSE_CATEGORY_LABELS;
  categoryFilter = '';

  readonly canCreate = this.perms.has('marketing.expense.create');
  readonly canEdit   = this.perms.has('marketing.expense.edit');
  readonly showForm  = signal(false);

  ngOnInit(): void {
    this.store.load();
  }

  applyFilter(): void {
    this.store.setFilters(this.categoryFilter ? { category: this.categoryFilter } : {});
  }

  inr(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  onCreated(e: MarketingExpense): void {
    this.showForm.set(false);
    this.store.prepend(e);
  }

  viewReceipt(e: MarketingExpense): void {
    this.api.expenseReceiptUrl(e.id).subscribe({
      next: (r) => window.open(r.data.url, '_blank'),
      error: (err) => this.toast.error(err?.error?.error ?? 'Receipt unavailable.'),
    });
  }

  remove(e: MarketingExpense): void {
    this.confirm.ask({
      title: 'Delete this expense?',
      body: `${this.categoryLabels[e.category]} · ${this.inr(e.amount_paise)} will be removed.`,
      confirmLabel: 'Delete', confirmColor: 'warn', icon: 'trash',
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deleteExpense(e.id).subscribe({
        next: () => { this.store.remove(e.id); this.toast.success('Expense deleted.'); },
        error: (err) => this.toast.error(err?.error?.error ?? 'Could not delete.'),
      });
    });
  }
}
