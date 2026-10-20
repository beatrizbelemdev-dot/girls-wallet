/**
 * Projeção de metas com juros compostos. Funções puras, sem acesso a rede ou ao banco.
 */

/**
 * Converte uma taxa anual (%) na taxa mensal equivalente, também em fração (0,01 = 1%).
 *
 * @param annualRatePercent Taxa ao ano em percentual, por exemplo 13,65.
 */
export function monthlyRate(annualRatePercent: number): number {
  return Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;
}

/**
 * Calcula o valor acumulado ao fim de `months` meses, com aporte mensal no fim de cada mês.
 *
 * Com taxa zero o resultado é `saved + monthly * months`.
 *
 * @param saved Valor já guardado (R$).
 * @param monthly Aporte mensal (R$).
 * @param annualRatePercent Taxa de rendimento ao ano, em % (por exemplo, o CDI).
 * @param months Número de meses até a data desejada.
 * @returns Valor projetado em reais.
 */
export function projectGoal(saved: number, monthly: number, annualRatePercent: number, months: number): number {
  if (months <= 0) return saved;
  const i = monthlyRate(annualRatePercent);
  if (i === 0) return saved + monthly * months;
  const growth = Math.pow(1 + i, months);
  return saved * growth + monthly * ((growth - 1) / i);
}

/**
 * Meses inteiros entre `from` e a data desejada (AAAA-MM-DD). Nunca é negativo.
 *
 * @param dueDate Data desejada da meta, no formato AAAA-MM-DD.
 * @param from Data de referência; por padrão, hoje.
 */
export function monthsUntil(dueDate: string, from = new Date()): number {
  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const months = (due.getFullYear() - from.getFullYear()) * 12 + (due.getMonth() - from.getMonth());
  return Math.max(0, months);
}

// TODO: usar em GoalDetailScreen (ManagementScreens.tsx), por exemplo:
//   const months = monthsUntil(goal.dueDate);
//   const withYield = projectGoal(goal.saved, goal.monthlyContribution, rates.cdi, months);
//   const withoutYield = projectGoal(goal.saved, goal.monthlyContribution, 0, months);
