import React, { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CreditCard, FileText, Pencil, Plane, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Button, CardBox, Field, Header, Notice, PageTitle, Screen, SectionTitle } from '../components/ui';
import { useWallet } from '../contexts/WalletContext';
import type { Card, Goal } from '../data/types';
import type { RootStackParamList } from '../navigation';
import { colors, formatCurrency, formatDate, parseCurrencyInput } from '../theme';
import { auth, signOutUser } from '../services/firebase';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CardsScreen() {
  const navigation = useNavigation<Navigation>();
  const { cards, statements, expenses, remove } = useWallet();
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id ?? '');
  const selectedCard = cards.find((card) => card.id === selectedCardId) ?? cards[0];
  const cardStatements = statements.filter((statement) => statement.cardId === selectedCard?.id);
  const selectedStatement = cardStatements[0];
  const statementExpenses = expenses.filter((expense) => expense.statementId === selectedStatement?.id);

  function deleteCard(card: Card) {
    Alert.alert('Excluir cartão?', `${card.name} e a configuração local do cartão serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        void remove(card.id).catch((error: unknown) => {
          Alert.alert('Falha ao excluir', error instanceof Error ? error.message : 'O cartão não foi excluído.');
        });
      } },
    ]);
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title="Cartões e faturas" subtitle="Gerencie cartões, importe faturas e acompanhe cada conta separadamente." />
      <SectionTitle>Meus cartões</SectionTitle>
      {cards.map((card) => (
        <Pressable key={card.id} onPress={() => setSelectedCardId(card.id)}>
          <CardBox style={{ borderColor: selectedCard?.id === card.id ? colors.primary : colors.border, backgroundColor: selectedCard?.id === card.id ? colors.roseLight : colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <CreditCard size={20} color={colors.primary} />
              <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{card.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>•••• {card.lastFour} · fecha dia {card.closingDay} · vence dia {card.dueDay}</Text></View>
              <Pressable onPress={() => navigation.navigate('AddCard', { id: card.id })}><Pencil size={17} color={colors.primary} /></Pressable>
              <Pressable onPress={() => deleteCard(card)}><Trash2 size={17} color={colors.muted} /></Pressable>
            </View>
          </CardBox>
        </Pressable>
      ))}
      <Button title="Novo cartão" variant="secondary" icon={<Plus size={17} color={colors.primary} />} onPress={() => navigation.navigate('AddCard')} />
      <SectionTitle action={<Button title="Importar fatura" onPress={() => navigation.navigate('ImportStatement')} />}>Faturas de {selectedCard?.name ?? 'cartão'}</SectionTitle>
      {cardStatements.map((statement) => (
        <CardBox key={statement.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><FileText size={19} color={colors.primary} /><Text style={{ color: colors.ink, fontWeight: '700', flex: 1, marginLeft: 9 }}>{statement.period}</Text><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(statement.total)}</Text></View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{statement.fileName} · importada em {formatDate(statement.importedAt.slice(0, 10))}</Text>
        </CardBox>
      ))}
      {!selectedCard ? <Notice>Cadastre um cartão para relacionar e acompanhar suas faturas.</Notice> : null}
      {selectedCard && !cardStatements.length ? <Notice>Nenhuma fatura importada para este cartão.</Notice> : null}
      {selectedStatement ? (
        <CardBox>
          <SectionTitle>Lançamentos da fatura</SectionTitle>
          {statementExpenses.map((expense) => <View key={expense.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}><View><Text style={{ color: colors.ink, fontWeight: '600' }}>{expense.description}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{expense.category} · {formatDate(expense.date)}</Text></View><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(expense.amount)}</Text></View>)}
          <Text style={{ color: colors.muted, fontSize: 11 }}>{statementExpenses.length} de {statementExpenses.length} lançamentos · {formatCurrency(selectedStatement.total)}</Text>
        </CardBox>
      ) : null}
    </Screen>
  );
}

export function AddCardScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddCard'>>();
  const { cards, save } = useWallet();
  const original = cards.find((card) => card.id === route.params?.id);
  const [name, setName] = useState(original?.name ?? '');
  const [lastFour, setLastFour] = useState(original?.lastFour ?? '');
  const [closingDay, setClosingDay] = useState(String(original?.closingDay ?? ''));
  const [dueDay, setDueDay] = useState(String(original?.dueDay ?? ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    const close = Number(closingDay);
    const due = Number(dueDay);
    if (!name.trim() || !/^\d{4}$/.test(lastFour) || !Number.isInteger(close) || close < 1 || close > 31 || !Number.isInteger(due) || due < 1 || due > 31) {
      setError('Informe o nome, os 4 últimos dígitos e dias válidos de fechamento e vencimento.');
      return;
    }
    const card: Card = { id: original?.id ?? makeId('card'), kind: 'card', name: name.trim(), lastFour, closingDay: close, dueDay: due, updatedAt: Date.now() };
    setBusy(true);
    try {
      await save(card);
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o cartão.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Header back />
      <PageTitle title={original ? 'Editar cartão' : 'Adicionar cartão'} subtitle="Os dados do cartão ficam apenas neste dispositivo." />
      <Field label="Nome do cartão" value={name} onChangeText={setName} placeholder="Ex.: Inter" />
      <Field label="Últimos 4 dígitos" value={lastFour} onChangeText={(value) => setLastFour(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
      <Field label="Dia de fechamento da fatura" value={closingDay} onChangeText={setClosingDay} keyboardType="number-pad" />
      <Field label="Dia de vencimento" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
      <Notice>Não informe número completo do cartão, CVV ou senha. O Girls Wallet precisa apenas de um nome e dos últimos quatro dígitos.</Notice>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title={original ? 'Salvar cartão' : 'Adicionar cartão'} onPress={() => void submit()} loading={busy} />
    </Screen>
  );
}

export function GoalDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'GoalDetail'>>();
  const { goals } = useWallet();
  const goal = goals.find((item) => item.id === route.params.id);
  const progress = goal ? Math.min(1, goal.saved / goal.target) : 0;
  if (!goal) return <Screen><Header back /><Notice>Esta meta não foi encontrada. Ela pode ter sido removida.</Notice></Screen>;
  return (
    <Screen>
      <Header back />
      <PageTitle title={goal.name} subtitle="Um passo de cada vez. Seu plano continua." />
      <CardBox style={{ backgroundColor: colors.lavender, borderWidth: 0, minHeight: 190, justifyContent: 'center', alignItems: 'center' }}>
        <Plane size={42} color={colors.primary} />
        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '700' }}>{Math.round(progress * 100)}%</Text>
        <Text style={{ color: colors.muted }}>{formatCurrency(goal.saved)} guardados de {formatCurrency(goal.target)}</Text>
        <View style={{ width: '100%', height: 7, backgroundColor: colors.surface, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${progress * 100}%`, height: 7, backgroundColor: colors.primary }} /></View>
      </CardBox>
      <CardBox>
        <SectionTitle>Seu plano</SectionTitle>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Aporte mensal</Text><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(goal.monthlyContribution)}</Text></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Falta guardar</Text><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(Math.max(0, goal.target - goal.saved))}</Text></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Data desejada</Text><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatDate(goal.dueDate)}</Text></View>
      </CardBox>
      <Button title="Editar meta" icon={<Pencil size={17} color="white" />} onPress={() => navigation.navigate('GoalForm', { id: goal.id })} />
    </Screen>
  );
}

export function GoalFormScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'GoalForm'>>();
  const { goals, save, remove } = useWallet();
  const original = useMemo(() => goals.find((item) => item.id === route.params?.id), [goals, route.params?.id]);
  const [name, setName] = useState(original?.name ?? '');
  const [target, setTarget] = useState(String(original?.target ?? ''));
  const [saved, setSaved] = useState(String(original?.saved ?? '0'));
  const [monthly, setMonthly] = useState(String(original?.monthlyContribution ?? ''));
  const [dueDate, setDueDate] = useState(original?.dueDate ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    const targetValue = parseCurrencyInput(target);
    const savedValue = parseCurrencyInput(saved);
    const monthlyValue = parseCurrencyInput(monthly);
    const parsedDate = new Date(`${dueDate}T12:00:00`);
    if (!name.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(savedValue) || savedValue < 0 || savedValue > targetValue || !Number.isFinite(monthlyValue) || monthlyValue < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate) {
      setError('Confira nome, valores e a data desejada (AAAA-MM-DD).');
      return;
    }
    const goal: Goal = { id: original?.id ?? makeId('goal'), kind: 'goal', name: name.trim(), target: targetValue, saved: savedValue, monthlyContribution: monthlyValue, dueDate, icon: 'Plane', updatedAt: Date.now() };
    setBusy(true);
    try {
      await save(goal);
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a meta.');
    } finally {
      setBusy(false);
    }
  }
  function confirmDelete() {
    if (!original) return;
    Alert.alert('Excluir meta?', `${original.name} será removida.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        void remove(original.id)
          .then(() => navigation.popToTop())
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a meta.'));
      } },
    ]);
  }
  return (
    <Screen>
      <Header back />
      <PageTitle title={original ? 'Editar meta' : 'Criar uma meta'} subtitle="Escolha um objetivo e um ritmo que caiba na sua vida." />
      <Field label="Nome da meta" value={name} onChangeText={setName} placeholder="Ex.: Viagem" />
      <Field label="Valor desejado" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label="Já guardado" value={saved} onChangeText={setSaved} keyboardType="decimal-pad" />
      <Field label="Aporte mensal" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" />
      <Field label="Data desejada (AAAA-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2027-04-01" />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Salvar meta" onPress={() => void submit()} loading={busy} />
      {original ? <Button title="Excluir meta" variant="secondary" icon={<Trash2 size={17} color={colors.red} />} onPress={confirmDelete} /> : null}
    </Screen>
  );
}

export function SettingsScreen({ leaveLocalMode }: { leaveLocalMode: () => void }) {
  const { settings, save } = useWallet();
  const [error, setError] = useState('');
  const enabled = Boolean(settings?.pushEnabled);
  async function toggleNotifications() {
    if (!settings) {
      setError('Configure primeiro seu perfil financeiro para salvar esta preferência.');
      return;
    }
    try {
      if (enabled) {
        await save({ ...settings, pushEnabled: false, updatedAt: Date.now() });
        setError('');
        return;
      }
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Permissão de notificações negada. Ative-a nas configurações do dispositivo.');
        return;
      }
      let remoteMessage = '';
      if (Platform.OS !== 'web') {
        const token = await Notifications.getDevicePushTokenAsync();
        const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
        const uid = auth?.currentUser?.uid;
        if (apiUrl && uid) {
          const currentUser = auth?.currentUser;
          if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente para registrar as notificações.');
          const idToken = await currentUser.getIdToken();
          const response = await fetch(`${apiUrl}/api/push/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ uid, token: token.data, platform: Platform.OS }),
          });
          if (!response.ok) {
            const payload: unknown = await response.json().catch(() => undefined);
            const message = typeof payload === 'object' && payload !== null && 'message' in payload
              ? String(payload.message)
              : 'O servidor não conseguiu registrar o dispositivo para notificações push.';
            throw new Error(message);
          }
        } else {
          remoteMessage = ' Alertas locais foram ativados; notificações FCM exigem login Firebase, API e credenciais do projeto.';
        }
      }
      await save({ ...settings, pushEnabled: true, updatedAt: Date.now() });
      if (remoteMessage) setError(remoteMessage.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível ativar as notificações neste dispositivo.');
    }
  }
  return (
    <Screen>
      <Header back />
      <PageTitle title="Configurações e privacidade" subtitle="Você decide como e onde os seus dados ficam." />
      <CardBox>
        <SectionTitle>Notificações de orçamento</SectionTitle>
        <Text style={{ color: colors.muted, lineHeight: 19 }}>Receba alertas quando uma categoria estiver perto do limite ou ultrapassar o orçamento.</Text>
        <Button title={enabled ? 'Desativar notificações' : 'Ativar notificações'} variant={enabled ? 'secondary' : 'primary'} onPress={() => void toggleNotifications()} />
      </CardBox>
      <Notice tone="green">As despesas ficam no SQLite do aparelho para consulta e edição offline. Com Firebase configurado, os dados são sincronizados quando a conexão volta.</Notice>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Sair da conta / modo local" variant="secondary" onPress={() => {
        void signOutUser()
          .then(leaveLocalMode)
          .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível encerrar a sessão.'));
      }} />
    </Screen>
  );
}
