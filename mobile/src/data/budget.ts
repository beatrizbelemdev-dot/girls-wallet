import type { Category, Expense, Goal, Statement } from './types';

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

export function formatMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  const [year, monthNumber] = month.split('-').map(Number);
  const label = new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1);
}

export function expenseMonth(expense: Expense, statementPeriods: ReadonlyMap<string, string>): string {
  return expense.statementId
    ? statementPeriods.get(expense.statementId) ?? expense.date.slice(0, 7)
    : expense.date.slice(0, 7);
}

export function expensesForMonth(expenses: Expense[], statements: Statement[], month: string): Expense[] {
  const statementPeriods = new Map(statements.map((statement) => [statement.id, statement.period]));
  return expenses.filter((expense) => expenseMonth(expense, statementPeriods) === month);
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

/** Soma os gastos de crédito do mês da fatura (importados) ou da compra (manuais). */
export function creditSpentForMonth(
  expenses: Expense[],
  statements: Statement[],
  month = currentMonth(),
): number {
  const statementPeriods = new Map(statements.map((statement) => [statement.id, statement.period]));
  return expenses.reduce((total, expense) => {
    if (expense.payment !== 'Crédito' || expenseMonth(expense, statementPeriods) !== month) return total;
    return total + expense.amount;
  }, 0);
}

/** Uma categoria só está acima do limite quando tem um limite definido (> 0). */
export function isOverLimit(category: Category, spent: number): boolean {
  return category.limit > 0 && spent > category.limit;
}
