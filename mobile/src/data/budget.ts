import type { Category, Expense } from './types';

/** Mês atual no formato AAAA-MM, no fuso do aparelho. */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Soma o gasto de cada categoria no mês (os limites são mensais). */
export function spentByCategory(expenses: Expense[], month = currentMonth()): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses) {
    if (!expense.date.startsWith(month)) continue;
    totals[expense.category] = (totals[expense.category] ?? 0) + expense.amount;
  }
  return totals;
}

/** Uma categoria só está acima do limite quando tem um limite definido (> 0). */
export function isOverLimit(category: Category, spent: number): boolean {
  return category.limit > 0 && spent > category.limit;
}
