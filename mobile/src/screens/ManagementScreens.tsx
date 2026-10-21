import React, { useMemo, useState, useEffect } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { CreditCard, FileText, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Button, CardBox, DateField, Field, Header, IconChoiceRow, Notice, PageTitle, Screen, SectionTitle } from '../components/ui';
import { useWallet } from '../contexts/WalletContext';
import type { Card, Goal } from '../data/types';
import type { RootStackParamList } from '../navigation';
import { colors, formatCurrency, formatDate, parseCurrencyInput } from '../theme';
import { auth, signOutUser } from '../services/firebase';
import { projectGoal, monthsUntil } from '../data/projection';
import { fetchRates, type Rates } from '../services/rates';
import { fetchBanks, searchBanks, type Bank } from '../services/banks';
import { BankLogo } from '../components/BankLogo';
import { GoalIcon } from '../components/GoalIcon';
import { DEFAULT_GOAL_ICON, goalTypeOf, GOAL_TYPES, ICON_CHOICES, OTHER_GOAL } from '../data/goalTypes';

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
              <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{card.name}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{card.lastFour ? `•••• ${card.lastFour} · ` : ''}fecha dia {card.closingDay} · vence dia {card.dueDay}</Text></View>
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
  const [closingDay, setClosingDay] = useState(String(original?.closingDay ?? ''));
  const [dueDay, setDueDay] = useState(String(original?.dueDay ?? ''));
  const [logoUrl, setLogoUrl] = useState(original?.logoUrl);
  // Escolher o banco é um atalho opcional: o nome continua podendo ser digitado, e o cadastro
  // funciona sem internet. A lista só é consultada quando a pessoa abre o seletor.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>();
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState('');
  const [bankQuery, setBankQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function togglePicker() {
    if (pickerOpen) {
      setPickerOpen(false);
      return;
    }
    setPickerOpen(true);
    if (banks) return;
    setBanksLoading(true);
    setBanksError('');
    try {
      setBanks(await fetchBanks());
    } catch (reason) {
      setBanksError(reason instanceof Error ? reason.message : 'Não foi possível carregar a lista de bancos.');
    } finally {
      setBanksLoading(false);
    }
  }

  function chooseBank(bank: Bank) {
    setName(bank.name);
    setLogoUrl(bank.logoUrl);
    setPickerOpen(false);
    setBankQuery('');
  }

  async function submit() {
    const close = Number(closingDay);
    const due = Number(dueDay);
    if (!name.trim() || !Number.isInteger(close) || close < 1 || close > 31 || !Number.isInteger(due) || due < 1 || due > 31) {
      setError('Informe o nome e dias válidos de fechamento e vencimento.');
      return;
    }
    const card: Card = { id: original?.id ?? makeId('card'), kind: 'card', name: name.trim(), ...(original?.lastFour ? { lastFour: original.lastFour } : {}), closingDay: close, dueDay: due, logoUrl, updatedAt: Date.now() };
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
      <PageTitle title={original ? 'Editar cartão' : 'Adicionar cartão'} subtitle="Informe o nome do cartão e os dias de fechamento e vencimento da fatura. Com uma conta, eles são sincronizados com a nuvem; no modo demonstração, ficam só neste aparelho." />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>Banco (opcional)</Text>
        {logoUrl ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BankLogo uri={logoUrl} />
            <Text style={{ flex: 1, color: colors.ink, fontWeight: '600' }}>{name}</Text>
            <Pressable onPress={() => setLogoUrl(undefined)} hitSlop={8}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Remover</Text></Pressable>
          </View>
        ) : null}
        <Button title={pickerOpen ? 'Fechar lista de bancos' : 'Escolher um banco da lista'} variant="secondary" onPress={() => void togglePicker()} />
        {pickerOpen ? (
          <CardBox>
            <Field label="Buscar banco" value={bankQuery} onChangeText={setBankQuery} placeholder="Ex.: Nubank, Itaú, Inter" autoCapitalize="none" />
            {banksLoading ? <Text style={{ color: colors.muted }}>Carregando bancos...</Text> : null}
            {banksError ? <Notice tone="amber">{banksError} Você ainda pode digitar o nome do cartão abaixo.</Notice> : null}
            {banks ? (
              <>
                {searchBanks(banks, bankQuery).slice(0, 8).map((bank) => (
                  <Pressable key={bank.code} onPress={() => chooseBank(bank)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <BankLogo uri={bank.logoUrl} size={32} />
                    <Text style={{ flex: 1, color: colors.ink }}>{bank.name}</Text>
                  </Pressable>
                ))}
                {!searchBanks(banks, bankQuery).length ? <Text style={{ color: colors.muted }}>Nenhum banco encontrado.</Text> : null}
                <Text style={{ color: colors.muted, fontSize: 11 }}>Mostrando até 8 resultados. Digite para refinar a busca.</Text>
              </>
            ) : null}
          </CardBox>
        ) : null}
      </View>
      <Field label="Nome do cartão" value={name} onChangeText={setName} placeholder="Ex.: Inter" />
      <Field label="Dia de fechamento da fatura" value={closingDay} onChangeText={setClosingDay} keyboardType="number-pad" />
      <Field label="Dia de vencimento" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
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

  const [taxas, setTaxas] = useState<Rates>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  useEffect(() => {
    fetchRates()
        .then(setTaxas)
        .catch((reason: unknown) => setErro(reason instanceof Error ? reason.message : 'Não foi possível consultar a taxa.'))
        .finally(() => setCarregando(false));
  }, []);
  if (!goal) return <Screen><Header back /><Notice>Esta meta não foi encontrada. Ela pode ter sido removida.</Notice></Screen>;
  const meses = monthsUntil(goal.dueDate);
  const semRendimento = projectGoal(goal.saved, goal.monthlyContribution, 0, meses);
  const comRendimento = taxas ? projectGoal(goal.saved, goal.monthlyContribution, taxas.cdi, meses) : semRendimento;
  return (
    <Screen>
      <Header back />
      <PageTitle title={goal.name} subtitle="Um passo de cada vez. Seu plano continua." />
      <CardBox style={{ backgroundColor: colors.lavender, borderWidth: 0, minHeight: 190, justifyContent: 'center', alignItems: 'center' }}>
        <GoalIcon name={goal.icon} size={42} />
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
      <CardBox>
        <SectionTitle>Rendimento projetado</SectionTitle>
        {carregando ? <Text>Consultando a taxa...</Text> : null}
        {erro ? <Notice tone="amber">{erro}</Notice> : null}
        {taxas ? (
            <>
              <Text>Taxa CDI: {taxas.cdi}% ao ano (BrasilAPI)</Text>
              <Text>Sem rendimento: {formatCurrency(semRendimento)}</Text>
              <Text>Com rendimento: {formatCurrency(comRendimento)}</Text>
            </>
        ) : null}
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
  const [name, setName] = useState(original?.name ?? GOAL_TYPES[0].label);
  // O tipo vem da lista (já com ícone) ou é "Outra": aí a pessoa escreve o nome e escolhe o ícone.
  const [type, setType] = useState(original ? goalTypeOf(original.name, original.icon) : GOAL_TYPES[0].label);
  const [icon, setIcon] = useState(original?.icon ?? GOAL_TYPES[0].icon);
  const [target, setTarget] = useState(String(original?.target ?? ''));
  const [saved, setSaved] = useState(String(original?.saved ?? '0'));
  const [monthly, setMonthly] = useState(String(original?.monthlyContribution ?? ''));
  const [dueDate, setDueDate] = useState(original?.dueDate ?? new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  /** Ao trocar o tipo, ajusta o ícone e só troca o nome se ele ainda for o sugerido (ou estiver vazio). */
  function chooseType(key: string) {
    const nameIsSuggestion = !name.trim() || GOAL_TYPES.some((item) => item.label === name.trim());
    setType(key);
    if (key === OTHER_GOAL) {
      setIcon(ICON_CHOICES.includes(icon) ? icon : DEFAULT_GOAL_ICON);
      if (nameIsSuggestion) setName('');
      return;
    }
    const chosen = GOAL_TYPES.find((item) => item.label === key);
    if (!chosen) return;
    setIcon(chosen.icon);
    if (nameIsSuggestion) setName(chosen.label);
  }

  async function submit() {
    const targetValue = parseCurrencyInput(target);
    const savedValue = parseCurrencyInput(saved);
    const monthlyValue = parseCurrencyInput(monthly);
    const parsedDate = new Date(`${dueDate}T12:00:00`);
    if (!name.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(savedValue) || savedValue < 0 || savedValue > targetValue || !Number.isFinite(monthlyValue) || monthlyValue < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate) {
      setError('Confira nome, valores e a data desejada (AAAA-MM-DD).');
      return;
    }
    const goal: Goal = { id: original?.id ?? makeId('goal'), kind: 'goal', name: name.trim(), target: targetValue, saved: savedValue, monthlyContribution: monthlyValue, dueDate, icon, updatedAt: Date.now() };
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
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>Tipo de meta</Text>
        <IconChoiceRow
          choices={[...GOAL_TYPES.map((item) => ({ key: item.label, icon: item.icon, label: item.label })), { key: OTHER_GOAL, icon: DEFAULT_GOAL_ICON, label: OTHER_GOAL }]}
          value={type}
          onChange={chooseType}
        />
      </View>
      {type === OTHER_GOAL ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>Ícone da meta</Text>
          <IconChoiceRow choices={ICON_CHOICES.map((item) => ({ key: item, icon: item }))} value={icon} onChange={setIcon} />
        </View>
      ) : null}
      <Field label="Nome da meta" value={name} onChangeText={setName} placeholder={type === OTHER_GOAL ? 'Ex.: Curso de inglês' : 'Ex.: Viagem'} />
      <Field label="Valor desejado" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label="Já guardado" value={saved} onChangeText={setSaved} keyboardType="decimal-pad" />
      <Field label="Aporte mensal" value={monthly} onChangeText={setMonthly} keyboardType="decimal-pad" />
      <DateField label="Data desejada" value={dueDate} onChange={setDueDate} />
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
