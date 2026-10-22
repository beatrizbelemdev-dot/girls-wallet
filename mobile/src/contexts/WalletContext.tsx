/**
 * Mantém os dados locais da carteira disponíveis para as telas e coordena paginação,
 * alertas de orçamento e sincronização quando uma conta autenticada está online.
 */
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { creditSpentForMonth, currentMonth, isOverLimit, spentByCategory } from '../data/budget';
import {
  allRecordsPage,
  deleteRecord,
  listAllExpenses,
  listAllStatements,
  listRecords,
  saveRecords,
} from '../data/database';
import type { Card, Category, Expense, Goal, Settings, Statement, WalletRecord } from '../data/types';
import { sendBudgetAlert, syncRecords } from '../services/firebase';

interface WalletContextValue {
  expenses: Expense[];
  allExpenses: Expense[];
  categories: Category[];
  /** Gasto do mês atual por nome de categoria, somando todas as despesas (não só a página carregada). */
  monthlySpent: Record<string, number>;
  /** Gastos de crédito do mês atual, usando o período da fatura para compras importadas. */
  monthlyCreditSpent: number;
  goals: Goal[];
  cards: Card[];
  statements: Statement[];
  settings: Settings | undefined;
  loading: boolean;
  offline: boolean;
  syncError: string;
  hasMoreExpenses: boolean;
  refresh: () => Promise<void>;
  loadMoreExpenses: () => Promise<void>;
  save: (record: WalletRecord) => Promise<void>;
  saveMany: (records: WalletRecord[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setSyncIdentity: (uid?: string) => void;
  clearSyncError: () => void;
  demoMode: boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const PAGE_SIZE = 20;

export function WalletProvider({ children, scope = 'demo' }: React.PropsWithChildren<{ scope?: string }>) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [monthlySpent, setMonthlySpent] = useState<Record<string, number>>({});
  const [monthlyCreditSpent, setMonthlyCreditSpent] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [hasMoreExpenses, setHasMoreExpenses] = useState(true);
  const [syncUid, setSyncUid] = useState<string>();

  const refresh = useCallback(async () => {
    const [nextExpenses, allExpensesFromDb, allStatements, nextCategories, nextGoals, nextCards, nextStatements, nextSettings] = await Promise.all([
      listRecords<Expense>('expense', 0, PAGE_SIZE, scope),
      listAllExpenses(scope),
      listAllStatements(scope),
      listRecords<Category>('category', 0, 100, scope),
      listRecords<Goal>('goal', 0, 100, scope),
      listRecords<Card>('card', 0, 100, scope),
      listRecords<Statement>('statement', 0, 100, scope),
      listRecords<Settings>('settings', 0, 1, scope),
    ]);
    setExpenses(nextExpenses);
    setAllExpenses(allExpensesFromDb.sort((first, second) => second.date.localeCompare(first.date) || second.updatedAt - first.updatedAt));
    setMonthlySpent(spentByCategory(allExpensesFromDb));
    setMonthlyCreditSpent(creditSpentForMonth(allExpensesFromDb, allStatements));
    setCategories(nextCategories);
    setGoals(nextGoals);
    setCards(nextCards);
    setStatements(nextStatements);
    setSettings(nextSettings[0]);
    setHasMoreExpenses(nextExpenses.length === PAGE_SIZE);
  }, [scope]);

  const syncNow = useCallback(async () => {
    if (!syncUid || offline) return;
    try {
      await syncRecords(syncUid);
      setSyncError('');
      await refresh();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível sincronizar seus dados.');
    }
  }, [offline, refresh, syncUid]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await refresh();
        if (mounted) setLoading(false);
      } catch (error) {
        if (mounted) {
          setSyncError(error instanceof Error ? error.message : 'Não foi possível abrir os dados locais.');
          setLoading(false);
        }
      }
    })();
    void Network.getNetworkStateAsync().then((state) => {
      if (mounted) setOffline(!state.isConnected);
    });
    const subscription = Network.addNetworkStateListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    if (syncUid && !offline) void syncNow();
  }, [offline, syncNow, syncUid]);

  const loadMoreExpenses = useCallback(async () => {
    if (!hasMoreExpenses) return;
    const page = Math.ceil(expenses.length / PAGE_SIZE);
    const nextPage = await allRecordsPage(page, PAGE_SIZE, scope);
    setExpenses((current) => {
      const knownIds = new Set(current.map((expense) => expense.id));
      return [...current, ...nextPage.filter((expense) => !knownIds.has(expense.id))];
    });
    setHasMoreExpenses(nextPage.length === PAGE_SIZE);
  }, [expenses.length, hasMoreExpenses, scope]);

  const notifyBudgetChanges = useCallback(async (records: WalletRecord[]) => {
    // Categorias tocadas por esta gravação: despesas do mês atual e categorias criadas ou editadas
    // (assim, definir ou baixar um limite que já foi ultrapassado também avisa).
    const month = currentMonth();
    const touched = new Set<string>();
    for (const record of records) {
      if (record.kind === 'expense' && record.date.startsWith(month)) touched.add(record.category);
      if (record.kind === 'category') touched.add(record.name);
    }
    if (!touched.size) return;

    // Lê o estado já gravado, sem depender da página de despesas carregada na tela.
    const [allExpenses, savedCategories] = await Promise.all([
      listAllExpenses(scope),
      listRecords<Category>('category', 0, 100, scope),
    ]);
    const spent = spentByCategory(allExpenses, month);
    const exceeded = savedCategories.filter((category) => touched.has(category.name) && isOverLimit(category, spent[category.name] ?? 0));
    if (!exceeded.length) return;

    const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const lines = exceeded.map((category) => `${category.name}: ${money.format(spent[category.name] ?? 0)} de ${money.format(category.limit)}`);
    // Aviso dentro do app: aparece sempre, sem depender de permissão de notificação.
    Alert.alert(exceeded.length > 1 ? 'Limites ultrapassados' : `Limite de ${exceeded[0].name} ultrapassado`, lines.join('\n'));

    if (!settings?.pushEnabled) return; // notificações do sistema e push seguem a preferência da pessoa
    for (const category of exceeded) {
      const total = spent[category.name] ?? 0;
      const failures: string[] = [];
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.granted) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Limite de ${category.name} ultrapassado`,
              body: `Você atingiu ${money.format(total)} de ${money.format(category.limit)} neste mês.`,
            },
            trigger: null,
          });
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'A notificação local falhou.');
      }
      if (syncUid && !offline) {
        try {
          await sendBudgetAlert(category.name, total, category.limit);
        } catch (error) {
          failures.push(error instanceof Error ? error.message : 'O alerta push falhou.');
        }
      }
      if (failures.length) setSyncError(`Gasto salvo; falha ao avisar sobre ${category.name}: ${failures.join(' ')}`);
    }
  }, [offline, scope, settings?.pushEnabled, syncUid]);

  const saveMany = useCallback(async (records: WalletRecord[]) => {
    await saveRecords(records, scope);
    await refresh();
    await notifyBudgetChanges(records);
    if (syncUid && !offline) void syncNow();
  }, [notifyBudgetChanges, offline, refresh, scope, syncNow, syncUid]);

  const save = useCallback(async (record: WalletRecord) => saveMany([record]), [saveMany]);

  const remove = useCallback(async (id: string) => {
    await deleteRecord(id, scope);
    await refresh();
    if (syncUid && !offline) void syncNow();
  }, [offline, refresh, scope, syncNow, syncUid]);

  const value = useMemo<WalletContextValue>(() => ({
    expenses,
    allExpenses,
    categories,
    monthlySpent,
    monthlyCreditSpent,
    goals,
    cards,
    statements,
    settings,
    loading,
    offline,
    syncError,
    hasMoreExpenses,
    refresh,
    loadMoreExpenses,
    save,
    saveMany,
    remove,
    setSyncIdentity: setSyncUid,
    clearSyncError: () => setSyncError(''),
    demoMode: scope === 'demo',
  }), [allExpenses, cards, categories, expenses, monthlyCreditSpent, monthlySpent, goals, hasMoreExpenses, loadMoreExpenses, loading, offline, refresh, remove, save, saveMany, scope, settings, statements, syncError]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet precisa ser usado dentro de WalletProvider.');
  return value;
}
