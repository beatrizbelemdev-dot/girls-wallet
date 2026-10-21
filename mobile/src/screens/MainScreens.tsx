import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import {
  Bell,
  ClipboardList,
  ChevronRight,
  CircleDollarSign,
  FileUp,
  HeartPulse,
  House,
  Lock,
  Pencil,
  Plus,
  ShoppingBag,
  Utensils,
  Wallet,
  CarFront,
  Trash2,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, CardBox, Field, Header, Notice, PageTitle, ProgressBar, Screen, SectionTitle, styles as ui } from '../components/ui';
import { GoalIcon } from '../components/GoalIcon';
import { monthlyGoalReserve } from '../data/budget';
import { useWallet } from '../contexts/WalletContext';
import type { Expense } from '../data/types';
import type { RootStackParamList } from '../navigation';
import { useDisplayName } from '../services/firebase';
import { colors, formatCurrency, formatDate } from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function CategoryIcon({ name, color = colors.primary }: { name: string; color?: string }) {
  const props = { size: 18, color };
  switch (name) {
    case 'Moradia': return <House {...props} />;
    case 'Alimentação': return <Utensils {...props} />;
    case 'Transporte': return <CarFront {...props} />;
    case 'Compras': return <ShoppingBag {...props} />;
    case 'Saúde': return <HeartPulse {...props} />;
    default: return <CircleDollarSign {...props} />;
  }
}

/** Despesas manuais abrem para edição; as importadas de fatura PDF (com `statementId`) ficam somente leitura. */
function openExpense(navigation: Navigation, expense: Expense) {
  if (expense.statementId) {
    Alert.alert('Despesa de fatura', 'Compras importadas de uma fatura PDF não podem ser editadas. Se precisar, exclua a compra e registre-a manualmente.');
    return;
  }
  navigation.navigate('ExpenseForm', { id: expense.id });
}

function ExpenseRow({ expense, onPress, onDelete }: { expense: Expense; onPress: () => void; onDelete?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ backgroundColor: colors.roseLight, width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
        <CategoryIcon name={expense.category} />
      </View>
      <Pressable style={{ flex: 1, gap: 4 }} onPress={onPress}>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>{expense.description}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{expense.category} · {expense.payment} · {formatDate(expense.date)}{expense.statementId ? ' · Fatura' : ''}</Text>
      </Pressable>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(expense.amount)}</Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={expense.statementId ? 'Despesa de fatura, não editável' : 'Editar despesa'}>
        {expense.statementId ? <Lock size={16} color={colors.muted} /> : <Pencil size={16} color={colors.primary} />}
      </Pressable>
      {onDelete ? <Pressable onPress={onDelete} hitSlop={8}><Trash2 size={17} color={colors.muted} /></Pressable> : null}
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const { settings, goals, expenses, offline, syncError, demoMode } = useWallet();
  const accountName = useDisplayName();
  const income = settings?.monthlyIncome ?? 0;
  const fixed = settings?.fixedExpenses ?? 0;
  const credit = expenses.filter((expense) => expense.payment === 'Crédito').reduce((sum, expense) => sum + expense.amount, 0);
  const variable = expenses.filter((expense) => expense.payment !== 'Crédito' && !expense.recurring).reduce((sum, expense) => sum + expense.amount, 0);
  const savings = monthlyGoalReserve(goals, settings?.monthlySavings ?? 0);
  const available = Math.max(0, income - fixed - credit - Math.min(variable, 400) - savings);

  return (
    <Screen>
      <Header action={<Pressable accessibilityLabel="Notificações" onPress={() => navigation.navigate('Notifications')}><Bell size={21} color={colors.ink} /></Pressable>} />
      <PageTitle title={`Olá, ${settings?.nickname || (settings?.name || accountName)?.split(' ')[0] || 'por aqui'} ☀️`} subtitle="Outubro de 2026 · Seu mês em equilíbrio" />
      {demoMode ? <Notice tone="amber">Modo local de demonstração. Estes são dados de exemplo; ficam neste aparelho e não são sincronizados com sua conta.</Notice> : null}
      {offline ? <Notice tone="amber">Sem conexão. Seus dados estão salvos neste dispositivo e serão sincronizados quando você voltar à internet.</Notice> : null}
      {syncError ? <Notice tone="amber">Falha na sincronização: {syncError}</Notice> : null}
      {!demoMode && settings?.nickname === undefined ? <Pressable onPress={() => navigation.navigate('ProfileEdit')}><Notice>Quer ser chamada por um apelido? Toque aqui para escolher como prefere ser chamada.</Notice></Pressable> : null}
      {!settings?.monthlyIncome ? <Pressable onPress={() => navigation.navigate('Income')}><Notice>Comece pelo seu orçamento: adicione sua renda mensal e os valores que deseja reservar.</Notice></Pressable> : null}
      <CardBox style={{ backgroundColor: colors.rose, borderWidth: 0 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Você ainda pode gastar</Text>
        <Text style={{ color: colors.ink, fontSize: 38, fontWeight: '700' }}>{formatCurrency(available)}</Text>
        <Text style={{ color: colors.ink, fontSize: 12 }}>Suas contas e o aporte da meta já estão reservados.</Text>
        <Pressable onPress={() => navigation.navigate('Budget')} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Quanto posso gastar?</Text><ChevronRight size={15} color={colors.primary} />
        </Pressable>
      </CardBox>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Registrar gasto" icon={<Plus size={18} color="white" />} onPress={() => navigation.navigate('ExpenseForm')} /></View>
        <View style={{ flex: 1 }}><Button title="Importar fatura" variant="secondary" icon={<FileUp size={18} color={colors.primary} />} onPress={() => navigation.navigate('ImportStatement')} /></View>
      </View>
      <CardBox>
        <SectionTitle>Seu orçamento do mês</SectionTitle>
        <BudgetRow label="Salário líquido" value={formatCurrency(income)} />
        <BudgetRow label="Gastos fixos" value={`− ${formatCurrency(fixed)}`} />
        <BudgetRow label="Cartão de crédito" value={`− ${formatCurrency(credit)}`} />
        <BudgetRow label="PIX e variáveis" value={`− ${formatCurrency(Math.min(variable, 400))}`} />
        <BudgetRow label="Reserva para as metas" value={`− ${formatCurrency(savings)}`} />
        <Pressable onPress={() => navigation.navigate('FixedExpenses')}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Ver gastos fixos e detalhes</Text></Pressable>
      </CardBox>
      <CardBox>
        <SectionTitle>Atividade recente</SectionTitle>
        {expenses.slice(0, 3).map((expense) => <ExpenseRow key={expense.id} expense={expense} onPress={() => openExpense(navigation, expense)} />)}
      </CardBox>
    </Screen>
  );
}

function BudgetRow({ label, value }: { label: string; value: string }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>{value}</Text></View>;
}

export function ExpenseListScreen() {
  const navigation = useNavigation<Navigation>();
  const { expenses, loadMoreExpenses, hasMoreExpenses, remove } = useWallet();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const filtered = useMemo(() => expenses.filter((expense) => {
    const matchesFilter = filter === 'Todas' || (filter === 'Fixas' ? expense.recurring : !expense.recurring);
    const matchesQuery = `${expense.description} ${expense.category}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'));
    return matchesFilter && matchesQuery;
  }), [expenses, filter, query]);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  function confirmDelete(expense: Expense) {
    Alert.alert('Excluir despesa?', `${expense.description} será removida deste dispositivo.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        void remove(expense.id).catch((error: unknown) => {
          Alert.alert('Falha ao excluir', error instanceof Error ? error.message : 'A despesa não foi excluída.');
        });
      } },
    ]);
  }

  return (
    <Screen>
      <Header action={<Pressable onPress={() => navigation.navigate('Notifications')}><Bell size={21} color={colors.ink} /></Pressable>} />
      <PageTitle title="Seus gastos, de perto." subtitle="Outubro de 2026" />
      <CardBox style={{ backgroundColor: colors.roseLight, borderWidth: 0 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Despesas do mês · fixas + cartão + variáveis</Text>
        <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700' }}>{formatCurrency(total)}</Text>
      </CardBox>
      <Field label="Pesquisar despesas" value={query} onChangeText={setQuery} placeholder="Buscar descrição ou categoria" />
      <View style={ui.choiceRow}>
        {['Todas', 'Fixas', 'Variáveis'].map((choice) => (
          <Pressable key={choice} onPress={() => setFilter(choice)} style={[ui.choice, filter === choice ? ui.choiceSelected : null]}>
            <Text style={[ui.choiceText, filter === choice ? ui.choiceSelectedText : null]}>{choice}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => navigation.navigate('FixedExpenses')} style={[ui.choice, { marginLeft: 'auto' }]}>
          <Text style={ui.choiceText}>Gastos fixos</Text>
        </Pressable>
      </View>
      {filtered.length ? (
        <CardBox>
          {filtered.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onPress={() => openExpense(navigation, expense)}
              onDelete={() => confirmDelete(expense)}
            />
          ))}
        </CardBox>
      ) : <Notice>Nenhuma despesa corresponde à busca.</Notice>}
      {hasMoreExpenses ? <Button title="Carregar mais" variant="secondary" onPress={() => void loadMoreExpenses()} /> : null}
      <Button title="Adicionar despesa" icon={<Plus size={18} color="white" />} onPress={() => navigation.navigate('ExpenseForm')} />
      <Button title="Categorias e limites" variant="secondary" onPress={() => navigation.navigate('Categories')} />
      <Button title="Cartões e faturas" variant="secondary" onPress={() => navigation.navigate('Cards')} />
    </Screen>
  );
}

export function GoalsScreen() {
  const navigation = useNavigation<Navigation>();
  const { goals } = useWallet();
  return (
    <Screen>
      <Header />
      <PageTitle title="Seus planos ganham forma." subtitle="Metas para o futuro que você escolheu." />
      {goals.map((goal) => (
        <Pressable key={goal.id} onPress={() => navigation.navigate('GoalDetail', { id: goal.id })}>
          <CardBox style={{ backgroundColor: colors.lavender, borderWidth: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 17 }}>{goal.name}</Text><GoalIcon name={goal.icon} /></View>
            <Text style={{ color: colors.muted }}>{formatCurrency(goal.saved)} guardados de {formatCurrency(goal.target)}</Text>
            <ProgressBar value={goal.saved / goal.target} />
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>{Math.round((goal.saved / goal.target) * 100)}% concluído · {formatCurrency(goal.monthlyContribution)}/mês</Text>
          </CardBox>
        </Pressable>
      ))}
      {!goals.length ? <Notice>Você ainda não criou uma meta. Comece com um plano que faça sentido para você.</Notice> : null}
      <Button title="Criar uma meta" icon={<Plus size={18} color="white" />} onPress={() => navigation.navigate('GoalForm')} />
    </Screen>
  );
}

export function ReportsScreen() {
  const { expenses, categories } = useWallet();
  const categoryTotals = categories.map((category) => ({
    ...category,
    amount: expenses.filter((expense) => expense.category === category.name).reduce((sum, expense) => sum + expense.amount, 0),
  })).sort((first, second) => second.amount - first.amount);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const highest = Math.max(1, ...categoryTotals.map((item) => item.amount));
  const byMonth = expenses.reduce<Record<string, number>>((totals, expense) => {
    const month = expense.date.slice(0, 7);
    totals[month] = (totals[month] ?? 0) + expense.amount;
    return totals;
  }, {});
  const latestMonth = Object.keys(byMonth).sort().at(-1) ?? '2026-10';
  const [latestYear, latestMonthNumber] = latestMonth.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_unused, index) => {
    const date = new Date(latestYear, latestMonthNumber - 1 - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: date.toLocaleDateString('pt-BR', { month: 'short' }), value: byMonth[key] ?? 0 };
  });
  const largestMonth = Math.max(1, ...months.map((month) => month.value));

  return (
    <Screen>
      <Header />
      <PageTitle title="Seu mês em perspectiva." subtitle="Outubro de 2026 · Análises dos seus gastos" />
      <CardBox style={{ backgroundColor: colors.rose, borderWidth: 0 }}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>Total de despesas registradas</Text>
        <Text style={{ color: colors.ink, fontSize: 31, fontWeight: '700' }}>{formatCurrency(total)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{expenses.length} lançamentos · dados armazenados no aparelho</Text>
      </CardBox>
      <CardBox>
        <SectionTitle>Gastos por categoria</SectionTitle>
        {categoryTotals.map((category) => (
          <View key={category.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><CategoryIcon name={category.name} /><Text style={{ color: colors.ink }}>{category.name}</Text></View>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{formatCurrency(category.amount)}</Text>
            </View>
            <ProgressBar value={category.amount / highest} danger={category.amount > category.limit} />
          </View>
        ))}
      </CardBox>
      <CardBox>
        <SectionTitle>Evolução dos últimos meses</SectionTitle>
        <View style={{ height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 8, paddingTop: 10 }}>
          {months.map((month) => (
            <View key={month.label} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={{ width: '65%', height: `${Math.max(4, (month.value / largestMonth) * 100)}%`, minHeight: 4, backgroundColor: month.value ? colors.primary : colors.track, borderRadius: 7 }} />
              <Text style={{ color: colors.muted, fontSize: 10 }}>{month.label}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Meses sem lançamentos aparecem sem valor registrado.</Text>
      </CardBox>
      <Notice>Os relatórios usam os lançamentos salvos no app. Importe e revise sua fatura para completar os dados do mês.</Notice>
    </Screen>
  );
}

export function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const { settings, offline, syncError } = useWallet();
  const accountName = useDisplayName();
  return (
    <Screen>
      <Header />
      <PageTitle title="Seu espaço, do seu jeito." subtitle="Conta e configurações" />
      <CardBox style={{ backgroundColor: colors.roseLight, borderWidth: 0, alignItems: 'center', paddingVertical: 25 }}>
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.rose, justifyContent: 'center', alignItems: 'center' }}><Wallet size={26} color={colors.primary} /></View>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>{settings?.name || accountName || 'Sua conta'}</Text>
        <Text style={{ color: colors.muted }}>{settings?.nickname ? `Chamada de ${settings.nickname}` : 'Conta pessoal'}</Text>
      </CardBox>
      <ProfileLink title="Editar perfil" subtitle="Nome e como prefere ser chamada" icon={<Pencil size={19} color={colors.primary} />} onPress={() => navigation.navigate('ProfileEdit')} />
      {offline ? <Notice tone="amber">Modo offline: você pode consultar e editar seus dados. A sincronização será retomada quando houver conexão.</Notice> : null}
      {syncError ? <Notice tone="amber">Não foi possível sincronizar: {syncError}</Notice> : null}
      <ProfileLink title="Salário e renda" subtitle="Atualize sua renda mensal" icon={<CircleDollarSign size={19} color={colors.primary} />} onPress={() => navigation.navigate('Income')} />
      <ProfileLink title="Cartões e faturas" subtitle="Gerencie cartões e importações" icon={<Wallet size={19} color={colors.primary} />} onPress={() => navigation.navigate('Cards')} />
      <ProfileLink title="Gastos fixos" subtitle="Contas que se repetem" icon={<ClipboardList size={19} color={colors.primary} />} onPress={() => navigation.navigate('FixedExpenses')} />
      <ProfileLink title="Notificações" subtitle="Limites e avisos de orçamento" icon={<Bell size={19} color={colors.primary} />} onPress={() => navigation.navigate('Notifications')} />
      <ProfileLink title="Configurações e privacidade" subtitle="Sincronização, notificações e conta" icon={<ChevronRight size={19} color={colors.primary} />} onPress={() => navigation.navigate('Settings')} />
    </Screen>
  );
}

function ProfileLink({ title, subtitle, icon, onPress }: { title: string; subtitle: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <CardBox style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon}
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '600' }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text></View>
        <ChevronRight size={17} color={colors.muted} />
      </CardBox>
    </Pressable>
  );
}
