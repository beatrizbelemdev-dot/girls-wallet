import type { Category, Expense, Goal } from './types';

/** Uma meta está concluída quando o valor guardado já alcançou o valor desejado. */
export function isGoalComplete(goal: Goal): boolean {
  return goal.target > 0 && goal.saved >= goal.target;
}

/**
 * Reserva mensal para as metas: a soma do aporte mensal das metas ainda em andamento.
 * Metas concluídas deixam de reservar dinheiro. Enquanto não houver nenhuma meta cadastrada,
 * usa `fallback` (o valor digitado em "Salário e renda").
 */
export function monthlyGoalReserve(goals: Goal[], fallback = 0): number {
  if (!goals.length) return fallback;
  return goals
    .filter((goal) => !isGoalComplete(goal))
    .reduce((sum, goal) => sum + (Number.isFinite(goal.monthlyContribution) ? goal.monthlyContribution : 0), 0);
}

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
