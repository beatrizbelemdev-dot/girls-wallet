import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  allRecordsPage,
  deleteRecord,
  listRecords,
  saveRecords,
} from '../data/database';
import type { Card, Category, Expense, Goal, Settings, Statement, WalletRecord } from '../data/types';
import { sendBudgetAlert, syncRecords } from '../services/firebase';

interface WalletContextValue {
  expenses: Expense[];
  categories: Category[];
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
    const [nextExpenses, nextCategories, nextGoals, nextCards, nextStatements, nextSettings] = await Promise.all([
      listRecords<Expense>('expense', 0, PAGE_SIZE, scope),
      listRecords<Category>('category', 0, 100, scope),
      listRecords<Goal>('goal', 0, 100, scope),
      listRecords<Card>('card', 0, 100, scope),
      listRecords<Statement>('statement', 0, 100, scope),
      listRecords<Settings>('settings', 0, 1, scope),
    ]);
    setExpenses(nextExpenses);
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
    if (!settings?.pushEnabled) return;
    const changedExpenses = records.filter((record): record is Expense => record.kind === 'expense');
    const additions = new Map<string, number>();
    const replacedAmounts = new Map<string, number>();
    for (const expense of changedExpenses) {
      additions.set(expense.category, (additions.get(expense.category) ?? 0) + expense.amount);
      const prior = expenses.find((item) => item.id === expense.id);
      if (prior) replacedAmounts.set(expense.category, (replacedAmounts.get(expense.category) ?? 0) + prior.amount);
    }
    for (const [categoryName, amount] of additions) {
      const category = categories.find((item) => item.name === categoryName);
      if (!category || category.limit <= 0) continue;
      const previous = expenses.filter((item) => item.category === categoryName).reduce((sum, item) => sum + item.amount, 0);
      const projected = previous - (replacedAmounts.get(categoryName) ?? 0) + amount;
      if (previous > category.limit || projected <= category.limit) continue;
      const failures: string[] = [];
      try {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.granted) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Limite de ${category.name} ultrapassado`,
              body: `Você atingiu ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projected)} de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(category.limit)}.`,
            },
            trigger: null,
          });
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : 'A notificação local falhou.');
      }
      if (syncUid && !offline) {
        try {
          await sendBudgetAlert(category.name, projected, category.limit);
        } catch (error) {
          failures.push(error instanceof Error ? error.message : 'O alerta push falhou.');
        }
      }
      if (failures.length) setSyncError(`Gasto salvo; falha ao avisar sobre ${category.name}: ${failures.join(' ')}`);
    }
  }, [categories, expenses, offline, settings?.pushEnabled, syncUid]);

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
    categories,
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
  }), [cards, categories, expenses, goals, hasMoreExpenses, loadMoreExpenses, loading, offline, refresh, remove, save, saveMany, scope, settings, statements, syncError]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet precisa ser usado dentro de WalletProvider.');
  return value;
}
