// Clinic-level billing (a single clinic's revenue & expense). Wire = snake_case.

export interface BillingSummary {
  period_days: number;
  revenue_paise: number;
  expense_paise: number;
  expense_po_paise: number;
  expense_manual_paise: number;
  net_paise: number;
}

export type ExpenseCategory =
  | 'RENT' | 'SALARIES' | 'UTILITIES' | 'SUPPLIES' | 'EQUIPMENT'
  | 'MARKETING' | 'MAINTENANCE' | 'TAX' | 'OTHER';

export interface ClinicExpense {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount_paise: number;
  expense_date: string;
  vendor: string | null;
  created_at: string;
}

export interface ExpenseUpsert {
  category: ExpenseCategory;
  description?: string | null;
  amount_paise: number;
  expense_date?: string;
  vendor?: string | null;
}

export interface RevenueItem {
  id: string;
  service_name: string;
  final_charge: number;   // rupees
  charged_at: string;
  status: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'RENT', 'SALARIES', 'UTILITIES', 'SUPPLIES', 'EQUIPMENT',
  'MARKETING', 'MAINTENANCE', 'TAX', 'OTHER',
];
