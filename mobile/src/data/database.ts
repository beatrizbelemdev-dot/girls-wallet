import * as SQLite from 'expo-sqlite';
import type { WalletRecord } from './types';

const databasePromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();

const seedRecords: WalletRecord[] = [
  { id: 'category-housing', kind: 'category', name: 'Moradia', limit: 1200, icon: 'House', updatedAt: 1 },
  { id: 'category-food', kind: 'category', name: 'Alimentação', limit: 700, icon: 'Utensils', updatedAt: 1 },
  { id: 'category-transport', kind: 'category', name: 'Transporte', limit: 300, icon: 'CarFront', updatedAt: 1 },
  { id: 'category-shopping', kind: 'category', name: 'Compras', limit: 550, icon: 'ShoppingBag', updatedAt: 1 },
  { id: 'category-health', kind: 'category', name: 'Saúde', limit: 250, icon: 'HeartPulse', updatedAt: 1 },
  { id: 'expense-uber', kind: 'expense', description: 'Uber', amount: 25, category: 'Transporte', date: '2026-10-14', payment: 'PIX', recurring: false, updatedAt: 1 },
  { id: 'expense-ifood', kind: 'expense', description: 'iFood', amount: 54.9, category: 'Alimentação', date: '2026-10-14', payment: 'Débito', recurring: false, updatedAt: 1 },
  { id: 'expense-shopee', kind: 'expense', description: 'Shopee', amount: 89.9, category: 'Compras', date: '2026-10-13', payment: 'PIX', recurring: false, updatedAt: 1 },
  { id: 'expense-pharmacy', kind: 'expense', description: 'Farmácia', amount: 37, category: 'Saúde', date: '2026-10-13', payment: 'Débito', recurring: false, updatedAt: 1 },
  { id: 'expense-market', kind: 'expense', description: 'Mercado', amount: 420, category: 'Alimentação', date: '2026-10-10', payment: 'Crédito', recurring: false, updatedAt: 1 },
  { id: 'expense-restaurant', kind: 'expense', description: 'Restaurante', amount: 180, category: 'Alimentação', date: '2026-10-11', payment: 'Crédito', recurring: false, updatedAt: 1 },
  { id: 'expense-mobility', kind: 'expense', description: 'Mobilidade', amount: 180, category: 'Transporte', date: '2026-10-12', payment: 'Crédito', recurring: false, updatedAt: 1 },
  { id: 'expense-digital-shop', kind: 'expense', description: 'Loja digital', amount: 260, category: 'Compras', date: '2026-10-12', payment: 'Crédito', recurring: false, updatedAt: 1 },
  { id: 'expense-streaming', kind: 'expense', description: 'Serviço digital', amount: 40, category: 'Compras', date: '2026-10-13', payment: 'Crédito', recurring: true, updatedAt: 1 },
  { id: 'expense-subscription', kind: 'expense', description: 'Assinatura', amount: 20, category: 'Compras', date: '2026-10-13', payment: 'Crédito', recurring: true, updatedAt: 1 },
  { id: 'expense-shopping-extra', kind: 'expense', description: 'Compras do mês', amount: 193.2, category: 'Compras', date: '2026-10-12', payment: 'PIX', recurring: false, updatedAt: 1 },
  { id: 'expense-rent', kind: 'expense', description: 'Aluguel', amount: 1000, category: 'Moradia', date: '2026-10-05', payment: 'Transferência', recurring: true, updatedAt: 1 },
  { id: 'expense-energy', kind: 'expense', description: 'Energia elétrica', amount: 350, category: 'Moradia', date: '2026-10-06', payment: 'Débito', recurring: true, updatedAt: 1 },
  { id: 'expense-internet', kind: 'expense', description: 'Internet', amount: 220, category: 'Moradia', date: '2026-10-07', payment: 'Débito', recurring: true, updatedAt: 1 },
  { id: 'goal-trip', kind: 'goal', name: 'Viagem', target: 3000, saved: 1000, monthlyContribution: 500, dueDate: '2027-04-01', icon: 'Plane', updatedAt: 1 },
  { id: 'card-inter', kind: 'card', name: 'Inter', lastFour: '4821', closingDay: 14, dueDay: 20, updatedAt: 1 },
  { id: 'card-nubank', kind: 'card', name: 'Nubank', lastFour: '1038', closingDay: 9, dueDay: 16, updatedAt: 1 },
  { id: 'settings', kind: 'settings', name: 'Marina Silva', monthlyIncome: 5574, fixedExpenses: 1570, monthlySavings: 500, updatedAt: 1 },
];

async function database(scope = 'demo'): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromises.has(scope)) {
    const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, '_');
    const promise = SQLite.openDatabaseAsync(`girls-wallet-${safeScope}.db`).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS wallet_records (
          id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
      `);
      const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM wallet_records');
      if (scope !== 'demo') {
        // Conta real: começa com as categorias padrão, uma única vez (linhas apagadas também contam,
        // para não recriar o que a pessoa removeu). Os ids fixos evitam duplicar entre aparelhos.
        const categories = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM wallet_records WHERE kind = 'category'",
        );
        if (categories?.count === 0) {
          await db.withTransactionAsync(async () => {
            for (const record of seedRecords.filter((item) => item.kind === 'category')) {
              await db.runAsync(
                'INSERT OR IGNORE INTO wallet_records (id, kind, payload, updated_at) VALUES (?, ?, ?, ?)',
                record.id,
                record.kind,
                JSON.stringify(record),
                record.updatedAt,
              );
            }
          });
        }
      }
      if (scope === 'demo' && result?.count === 0) {
        await db.withTransactionAsync(async () => {
          for (const record of seedRecords) {
            await db.runAsync(
              'INSERT OR IGNORE INTO wallet_records (id, kind, payload, updated_at) VALUES (?, ?, ?, ?)',
              record.id,
              record.kind,
              JSON.stringify(record),
              record.updatedAt,
            );
          }
        });
      }
      return db;
    });
    databasePromises.set(scope, promise);
  }
  const promise = databasePromises.get(scope);
  if (!promise) throw new Error('Não foi possível abrir o banco local.');
  return promise;
}

export async function listRecords<T extends WalletRecord>(kind: T['kind'], page = 0, pageSize = 100, scope = 'demo'): Promise<T[]> {
  const db = await database(scope);
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM wallet_records WHERE kind = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?',
    kind,
    pageSize,
    page * pageSize,
  );
  return rows
    .map((row) => JSON.parse(row.payload) as T)
    .sort((first, second) => {
      if ('date' in first && 'date' in second) return second.date.localeCompare(first.date);
      return second.updatedAt - first.updatedAt;
    });
}

/** Todas as despesas ativas (sem paginação), para somar limites por categoria. */
export async function listAllExpenses(scope = 'demo'): Promise<import('./types').Expense[]> {
  const db = await database(scope);
  const rows = await db.getAllAsync<{ payload: string }>(
    "SELECT payload FROM wallet_records WHERE kind = 'expense' AND deleted_at IS NULL",
  );
  return rows.map((row) => JSON.parse(row.payload) as import('./types').Expense);
}

export async function getAllRecords(scope = 'demo'): Promise<Array<{ record: WalletRecord; deletedAt: number | null }>> {
  const db = await database(scope);
  const rows = await db.getAllAsync<{ payload: string; deleted_at: number | null }>(
    'SELECT payload, deleted_at FROM wallet_records',
  );
  return rows.map((row) => ({
    record: JSON.parse(row.payload) as WalletRecord,
    deletedAt: row.deleted_at,
  }));
}

export async function saveRecord<T extends WalletRecord>(record: T, scope = 'demo'): Promise<void> {
  await saveRecords([record], scope);
}

export async function saveRecords(records: WalletRecord[], scope = 'demo'): Promise<void> {
  if (!records.length) return;
  const db = await database(scope);
  await db.withTransactionAsync(async () => {
    for (const record of records) {
      const updated = { ...record, updatedAt: Date.now() };
      await db.runAsync(
        `INSERT INTO wallet_records (id, kind, payload, updated_at, deleted_at) VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload,
           updated_at = excluded.updated_at, deleted_at = NULL`,
        updated.id,
        updated.kind,
        JSON.stringify(updated),
        updated.updatedAt,
      );
    }
  });
}

export async function saveSyncedRecord(record: WalletRecord, deletedAt: number | null, scope = 'demo'): Promise<void> {
  const db = await database(scope);
  await db.runAsync(
    `INSERT INTO wallet_records (id, kind, payload, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, payload = excluded.payload,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
    record.id,
    record.kind,
    JSON.stringify(record),
    record.updatedAt,
    deletedAt,
  );
}

export async function deleteRecord(id: string, scope = 'demo'): Promise<void> {
  const db = await database(scope);
  const now = Date.now();
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM wallet_records WHERE id = ?', id);
  if (!row) throw new Error('O registro não foi encontrado para exclusão.');
  const record = JSON.parse(row.payload) as WalletRecord;
  await db.runAsync(
    'UPDATE wallet_records SET payload = ?, deleted_at = ?, updated_at = ? WHERE id = ?',
    JSON.stringify({ ...record, updatedAt: now }),
    now,
    now,
    id,
  );
}

export async function allRecordsPage(page: number, pageSize: number, scope = 'demo'): Promise<import('./types').Expense[]> {
  const db = await database(scope);
  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM wallet_records
     WHERE kind = 'expense' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    pageSize,
    page * pageSize,
  );
  return rows.map((row) => JSON.parse(row.payload) as import('./types').Expense)
    .sort((first, second) => second.date.localeCompare(first.date));
}
