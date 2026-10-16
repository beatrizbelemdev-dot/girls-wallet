export type RecordKind = 'expense' | 'category' | 'goal' | 'card' | 'statement' | 'settings';

export interface BaseRecord {
  id: string;
  kind: RecordKind;
  updatedAt: number;
}

export interface Expense extends BaseRecord {
  kind: 'expense';
  description: string;
  amount: number;
  category: string;
  date: string;
  payment: 'PIX' | 'Débito' | 'Dinheiro' | 'Transferência' | 'Crédito';
  recurring: boolean;
  cardId?: string;
  statementId?: string;
  syncStatus?: 'local' | 'synced';
}

export interface Category extends BaseRecord {
  kind: 'category';
  name: string;
  limit: number;
  icon: string;
}

export interface Goal extends BaseRecord {
  kind: 'goal';
  name: string;
  target: number;
  saved: number;
  monthlyContribution: number;
  dueDate: string;
  icon: string;
}

export interface Card extends BaseRecord {
  kind: 'card';
  name: string;
  lastFour: string;
  closingDay: number;
  dueDay: number;
}

export interface Statement extends BaseRecord {
  kind: 'statement';
  fileName: string;
  cardId: string;
  period: string;
  total: number;
  importedAt: string;
  status: 'review' | 'saved';
}

export interface Settings extends BaseRecord {
  kind: 'settings';
  name: string;
  monthlyIncome: number;
  fixedExpenses: number;
  monthlySavings: number;
  pushEnabled?: boolean;
}

export type WalletRecord = Expense | Category | Goal | Card | Statement | Settings;
