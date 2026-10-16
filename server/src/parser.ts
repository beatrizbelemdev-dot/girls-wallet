export interface ParsedTransaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export interface StatementResult {
  transactions: ParsedTransaction[];
  total: number;
  currency: 'BRL';
}

const ignoredLine = /\b(total|subtotal|saldo|pagamento|vencimento|limite|resumo|encargos|juros|anuidade|fatura|parcelamento|melhor data|data de fechamento|valor total|valor mínimo|valor minimo)\b/i;
const datePattern = /\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/;
const amountPattern = /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2})\s*$/;

function parseAmount(value: string): number {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  return Number(normalized);
}

function categoryFor(description: string, allowedCategories: string[]): string {
  const normalized = description.toLocaleLowerCase('pt-BR');
  const suggestions: Array<[RegExp, string]> = [
    [/\b(uber|99|taxi|táxi|posto|combust|estacion|pedagio|pedágio)\b/, 'Transporte'],
    [/\b(ifood|restaurante|mercado|supermercado|padaria|cafe|café|food)\b/, 'Alimentação'],
    [/\b(farmacia|farmácia|drogaria|clinica|clínica|hospital|saude|saúde)\b/, 'Saúde'],
    [/\b(aluguel|condominio|condomínio|luz|energia|agua|água|internet|moradia)\b/, 'Moradia'],
    [/\b(shopee|shein|amazon|loja|compra|shopping|varejo)\b/, 'Compras'],
  ];
  const suggestion = suggestions.find(([pattern]) => pattern.test(normalized))?.[1];
  if (suggestion && allowedCategories.includes(suggestion)) return suggestion;
  return allowedCategories.includes('Compras') ? 'Compras' : allowedCategories[0] ?? 'Outros';
}

function transactionDate(raw: string | undefined, period: string): string {
  const [yearFromPeriod, monthFromPeriod] = period.split('-');
  if (!raw) return `${yearFromPeriod}-${monthFromPeriod}-01`;
  const match = raw.match(datePattern);
  if (!match) return `${yearFromPeriod}-${monthFromPeriod}-01`;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearPart = match[3];
  const year = yearPart ? Number(yearPart.length === 2 ? `20${yearPart}` : yearPart) : Number(yearFromPeriod);
  if (month < 1 || month > 12 || day < 1 || day > 31) return `${yearFromPeriod}-${monthFromPeriod}-01`;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseStatementText(text: string, period: string, allowedCategories: string[]): StatementResult {
  const normalizedPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : '';
  if (!normalizedPeriod) throw new Error('Período inválido. Use o formato AAAA-MM.');
  const categories = allowedCategories.filter((category) => typeof category === 'string' && category.trim()).map((category) => category.trim());
  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line.length < 5 || ignoredLine.test(line)) continue;
    const amountMatch = line.match(amountPattern);
    if (!amountMatch) continue;
    const amount = parseAmount(amountMatch[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const dateMatch = line.match(datePattern);
    const description = line
      .replace(amountPattern, '')
      .replace(datePattern, '')
      .replace(/^\s*(?:\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\-|]+|[\s\-|]+$/g, '')
      .trim();
    if (description.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(description) || ignoredLine.test(description)) continue;
    const date = transactionDate(dateMatch?.[0], normalizedPeriod);
    const key = `${description.toLocaleLowerCase('pt-BR')}|${date}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    transactions.push({
      id: `statement-${transactions.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
      description,
      amount: Math.round(amount * 100) / 100,
      category: categoryFor(description, categories),
      date,
    });
  }

  if (!transactions.length) {
    throw new Error('Nenhuma compra foi reconhecida. Use um PDF digital com texto selecionável; faturas escaneadas, protegidas por senha ou em formato incompatível não têm suporte.');
  }
  return {
    transactions,
    total: Math.round(transactions.reduce((sum, transaction) => sum + transaction.amount, 0) * 100) / 100,
    currency: 'BRL',
  };
}
