import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../material.module';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ClinicExpense, ExpenseCategory, ExpenseUpsert, EXPENSE_CATEGORIES } from '../../models/billing.model';

@Component({
  selector: 'df-expense-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './df-expense-modal.component.html',
  styleUrl: './df-expense-modal.component.scss',
})
export class DfExpenseModalComponent {
  readonly categories = EXPENSE_CATEGORIES;
  readonly isEdit: boolean;

  form: {
    category: ExpenseCategory;
    amount_rupees: number | null;
    expense_date: string;
    vendor: string;
    description: string;
  };

  constructor(
    private ref: MatDialogRef<DfExpenseModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { expense: ClinicExpense | null },
  ) {
    const e = data?.expense ?? null;
    this.isEdit = !!e;
    this.form = {
      category:      e?.category ?? 'OTHER',
      amount_rupees: e ? e.amount_paise / 100 : null,
      expense_date:  e?.expense_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      vendor:        e?.vendor ?? '',
      description:   e?.description ?? '',
    };
  }

  get valid(): boolean {
    return this.form.amount_rupees != null && this.form.amount_rupees >= 0;
  }

  save(): void {
    if (!this.valid) return;
    const payload: ExpenseUpsert = {
      category: this.form.category,
      amount_paise: Math.round((this.form.amount_rupees ?? 0) * 100),
      expense_date: this.form.expense_date,
      vendor: this.form.vendor.trim() || null,
      description: this.form.description.trim() || null,
    };
    this.ref.close(payload);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
