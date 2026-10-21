import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CircleAlert,
  FileCheck2,
  FileText,
  Pencil,
  Plus,
  WifiOff,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Button, CardBox, CardChoiceRow, ChoiceRow, DateField, Field, Header, MonthField, Notice, PageTitle, ProgressBar, Screen, SectionTitle } from '../components/ui';
import { useWallet } from '../contexts/WalletContext';
import { currentMonth, isOverLimit, monthlyGoalReserve } from '../data/budget';
import type { Category, Expense, Statement } from '../data/types';
import type { RootStackParamList } from '../navigation';
import { colors, formatCurrency, formatDate, parseCurrencyInput } from '../theme';
import { updateAccountName, useDisplayName } from '../services/firebase';
import { analyzeInvoice, chooseInvoicePdf, type InvoiceTransaction } from '../services/statements';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BudgetScreen() {
  const navigation = useNavigation<Navigation>();
  const { settings, expenses, goals, categories, monthlySpent } = useWallet();
  const income = settings?.monthlyIncome ?? 0;
  const fixed = settings?.fixedExpenses ?? 0;
  const credit = expenses.filter((item) => item.payment === 'Crédito').reduce((sum, item) => sum + item.amount, 0);
  const variable = expenses.filter((item) => item.payment !== 'Crédito' && !item.recurring).reduce((sum, item) => sum + item.amount, 0);
  const reserve = monthlyGoalReserve(goals, settings?.monthlySavings ?? 0);
  const available = Math.max(0, income - fixed - credit - Math.min(variable, 400) - reserve);

  return (
    <Screen>
      <Header back />
      <PageTitle title="Quanto posso gastar?" subtitle="Outubro de 2026 · Cada real com um destino." />
      <CardBox style={{ backgroundColor: colors.rose, borderWidth: 0 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Saldo disponível para você</Text>
        <Text style={{ color: colors.ink, fontSize: 36, fontWeight: '700' }}>{formatCurrency(available)}</Text>
        <Text style={{ color: colors.ink, fontSize: 12 }}>Pode usar sem comprometer as contas previstas e o aporte da sua meta.</Text>
      </CardBox>
      <CardBox>
        <SectionTitle>A conta, sem mistério</SectionTitle>
        <MoneyRow label="Salário líquido" amount={income} sign="+" />
        <MoneyRow label="Gastos fixos" amount={fixed} sign="−" />
        <MoneyRow label="Cartão de crédito" amount={credit} sign="−" />
        <MoneyRow label="PIX e variáveis" amount={Math.min(variable, 400)} sign="−" />
        <MoneyRow label="Economia mensal para as metas" amount={reserve} sign="−" />
        <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>= Disponível</Text><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 18 }}>{formatCurrency(available)}</Text>
        </View>
      </CardBox>
      <Notice tone="green">Dinheiro comprometido: {formatCurrency(income - available)}. O valor disponível é uma previsão do mês, não o saldo da sua conta bancária.</Notice>
      <CardBox>
        <SectionTitle>Limites por categoria</SectionTitle>
        {categories.slice(0, 3).map((category) => {
          const spent = monthlySpent[category.name] ?? 0;
          return <MoneyRow key={category.id} label={category.name} amount={spent} suffix={`de ${formatCurrency(category.limit)}`} />;
        })}
      </CardBox>
      <Button title="Registrar uma despesa" icon={<Plus size={18} color="white" />} onPress={() => navigation.navigate('ExpenseForm')} />
    </Screen>
  );
}

function MoneyRow({ label, amount, sign, suffix }: { label: string; amount: number; sign?: string; suffix?: string }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 }}><Text style={{ color: colors.muted, flex: 1 }}>{label}</Text><Text style={{ color: colors.ink, fontWeight: '600' }}>{sign ? `${sign} ` : ''}{formatCurrency(amount)}{suffix ? ` ${suffix}` : ''}</Text></View>;
}

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const { categories, monthlySpent, statements } = useWallet();
  const [filter, setFilter] = useState('Todas');
  const overLimit = categories.filter((category) => isOverLimit(category, monthlySpent[category.name] ?? 0));
  const notifications = [
    ...overLimit.map((category) => ({
      id: category.id,
      title: `Orçamento ultrapassado · ${category.name}`,
      body: `${category.name} passou do limite de ${formatCurrency(category.limit)}. Revise suas despesas para ajustar o plano.`,
      tone: 'rose' as const,
      action: () => navigation.navigate('Categories'),
      label: 'Revisar categoria',
    })),
    ...statements.filter((statement) => statement.status === 'saved').slice(0, 1).map((statement) => ({
      id: statement.id,
      title: 'Fatura importada',
      body: `${formatCurrency(statement.total)} foi revisado e salvo no período ${statement.period}.`,
      tone: 'green' as const,
      action: () => navigation.navigate('Cards'),
      label: 'Ver faturas',
    })),
  ];
  const visible = filter === 'Não lidas' ? notifications.slice(0, 2) : notifications;

  return (
    <Screen>
      <Header back />
      <View style={{ alignItems: 'flex-end' }}><Bell size={20} color={colors.primary} /></View>
      <PageTitle title="Um cuidado a mais" subtitle="Alertas para ajustar o plano, sem sustos." />
      <ChoiceRow choices={['Todas', 'Não lidas']} value={filter} onChange={setFilter} />
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>HOJE · 15 DE OUTUBRO DE 2026</Text>
      {visible.map((item) => (
        <CardBox key={item.id} style={{ backgroundColor: item.tone === 'green' ? colors.green : colors.amber, borderWidth: 0 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {item.tone === 'green' ? <FileCheck2 size={20} color={colors.greenInk} /> : <CircleAlert size={20} color={colors.primary} />}
            <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700', flex: 1 }}>{item.title}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>{item.body}</Text>
          <Pressable onPress={item.action} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{item.label}</Text><ArrowUpRight size={15} color={colors.primary} /></Pressable>
        </CardBox>
      ))}
      {!visible.length ? <Notice>Você está em dia. Quando um limite se aproximar, o aviso aparecerá aqui.</Notice> : null}
      <Button title="Registrar despesa" onPress={() => navigation.navigate('ExpenseForm')} />
    </Screen>
  );
}

export function ExpenseFormScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'ExpenseForm'>>();
  const { expenses, categories, save, offline } = useWallet();
  const original = expenses.find((expense) => expense.id === route.params?.id);
  const [description, setDescription] = useState(original?.description ?? '');
  const [amount, setAmount] = useState(original ? String(original.amount).replace('.', ',') : '');
  const [category, setCategory] = useState(original?.category ?? categories[0]?.name ?? 'Outros');
  const [date, setDate] = useState(original?.date ?? new Date().toISOString().slice(0, 10));
  const [payment, setPayment] = useState<Expense['payment']>(original?.payment ?? 'PIX');
  const [recurring, setRecurring] = useState(original?.recurring ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (original?.statementId) {
      setError('Compras importadas de fatura PDF não podem ser editadas.');
      return;
    }
    const value = parseCurrencyInput(amount);
    const parsedDate = new Date(`${date}T12:00:00`);
    if (!description.trim() || !Number.isFinite(value) || value <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      setError('Preencha a descrição, um valor maior que zero e uma data no formato AAAA-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      await save({
        id: original?.id ?? makeId('expense'),
        kind: 'expense',
        description: description.trim(),
        amount: value,
        category,
        date,
        payment,
        recurring,
        updatedAt: Date.now(),
      });
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a despesa.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title={original ? 'Editar despesa' : 'Registrar despesa'} subtitle="Pequenos registros. Mais clareza no mês." />
      {offline ? <Notice tone="amber"><WifiOff size={15} /> Sem conexão · será sincronizada quando você se conectar.</Notice> : null}
      <Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: Mercado" />
      <Field label="Valor em reais" value={amount} onChangeText={setAmount} placeholder="R$ 0,00" keyboardType="decimal-pad" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>Categoria</Text>
        <ChoiceRow choices={categories.map((item) => item.name)} value={category} onChange={setCategory} />
        <Pressable onPress={() => navigation.navigate('Categories')}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>+ Criar ou editar categoria</Text></Pressable>
      </View>
      <DateField label="Data da despesa" value={date} onChange={setDate} />
      <View style={{ gap: 8 }}><Text style={{ color: colors.ink, fontWeight: '600', fontSize: 12 }}>Meio de pagamento</Text><ChoiceRow choices={['PIX', 'Débito', 'Dinheiro', 'Transferência', 'Crédito']} value={payment} onChange={(value) => setPayment(value as Expense['payment'])} /></View>
      <Pressable onPress={() => setRecurring((current) => !current)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18 }}>
        <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>Repetir todo mês</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{recurring ? 'Ativado · despesa fixa' : 'Desativado · despesa variável'}</Text></View>
        <View style={{ width: 42, height: 25, borderRadius: 20, backgroundColor: recurring ? colors.primary : colors.track, justifyContent: 'center', padding: 3 }}><View style={{ alignSelf: recurring ? 'flex-end' : 'flex-start', width: 19, height: 19, backgroundColor: 'white', borderRadius: 10 }} /></View>
      </Pressable>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title={original ? 'Salvar alterações' : 'Salvar despesa'} onPress={() => void submit()} loading={busy} />
      <Text style={{ color: colors.muted, fontSize: 11 }}>Este gasto ficará em {category} no orçamento do mês.</Text>
    </Screen>
  );
}

export function FixedExpensesScreen() {
  const navigation = useNavigation<Navigation>();
  const { expenses } = useWallet();
  const fixed = expenses.filter((expense) => expense.recurring);
  const total = fixed.reduce((sum, expense) => sum + expense.amount, 0);
  return (
    <Screen>
      <Header back />
      <PageTitle title="Gastos fixos" subtitle="Contas que se repetem e ajudam a planejar seu mês." />
      <CardBox style={{ backgroundColor: colors.rose, borderWidth: 0 }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Total mensal</Text><Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700' }}>{formatCurrency(total)}</Text></CardBox>
      <CardBox>
        <SectionTitle>Suas despesas recorrentes</SectionTitle>
        {fixed.map((expense) => <View key={expense.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}><View><Text style={{ color: colors.ink, fontWeight: '600' }}>{expense.description}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{expense.category} · mensal</Text></View><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatCurrency(expense.amount)}</Text></View>)}
        {!fixed.length ? <Notice>Nenhum gasto recorrente cadastrado. Marque uma despesa como mensal ao registrá-la.</Notice> : null}
      </CardBox>
      <Button title="Adicionar gasto fixo" icon={<Plus size={18} color="white" />} onPress={() => navigation.navigate('ExpenseForm')} />
    </Screen>
  );
}

export function CategoriesScreen() {
  const { categories, monthlySpent, save } = useWallet();
  const [editing, setEditing] = useState('');
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [error, setError] = useState('');

  function beginEdit(category: Category) {
    setEditing(category.id);
    setName(category.name);
    setLimit(String(category.limit));
  }
  async function saveEdit(category: Category) {
    const amount = parseCurrencyInput(limit);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Informe um nome e um limite maior que zero.');
      return;
    }
    try {
      await save({ ...category, name: name.trim(), limit: amount, updatedAt: Date.now() });
      setEditing('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a categoria.');
    }
  }
  async function createCategory() {
    const amount = parseCurrencyInput(newLimit);
    if (!newName.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Preencha o nome da categoria e um limite maior que zero.');
      return;
    }
    if (categories.some((category) => category.name.toLocaleLowerCase() === newName.trim().toLocaleLowerCase())) {
      setError('Já existe uma categoria com esse nome.');
      return;
    }
    try {
      await save({ id: makeId('category'), kind: 'category', name: newName.trim(), limit: amount, icon: 'CircleDollarSign', updatedAt: Date.now() });
      setNewName('');
      setNewLimit('');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a categoria.');
    }
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title="Do seu jeito" subtitle="Categorias e limites · Outubro de 2026" />
      <Notice>Os limites ajudam a distribuir seu orçamento. Ultrapassar uma categoria não significa ficar sem saldo no mês.</Notice>
      <CardBox>
        {categories.map((category) => {
          const spent = monthlySpent[category.name] ?? 0;
          const danger = isOverLimit(category, spent);
          return (
            <View key={category.id} style={{ gap: 8, paddingVertical: 6 }}>
              {editing === category.id ? (
                <>
                  <Field label="Nome" value={name} onChangeText={setName} />
                  <Field label="Limite mensal" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
                  <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Button title="Salvar" onPress={() => void saveEdit(category)} /></View><View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => setEditing('')} /></View></View>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                    <Text style={{ color: colors.ink, flex: 1, fontWeight: '700' }}>{category.name}</Text>
                    <Pressable accessibilityLabel={`Editar ${category.name}`} onPress={() => beginEdit(category)}><Pencil size={18} color={colors.primary} /></Pressable>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{formatCurrency(spent)} de {formatCurrency(category.limit)}</Text>
                  <ProgressBar value={category.limit > 0 ? spent / category.limit : 0} danger={danger} />
                  {danger ? <Text style={{ color: colors.red, fontSize: 11 }}>{formatCurrency(spent - category.limit)} acima do limite</Text> : null}
                </>
              )}
            </View>
          );
        })}
      </CardBox>
      <CardBox>
        <SectionTitle>Criar categoria</SectionTitle>
        <Field label="Nome" value={newName} onChangeText={setNewName} placeholder="Ex.: Educação" />
        <Field label="Limite mensal" value={newLimit} onChangeText={setNewLimit} placeholder="R$ 0,00" keyboardType="decimal-pad" />
        {error ? <Notice tone="amber">{error}</Notice> : null}
        <Button title="Criar categoria" icon={<Plus size={18} color="white" />} onPress={() => void createCategory()} />
      </CardBox>
    </Screen>
  );
}

export function ImportStatementScreen() {
  const navigation = useNavigation<Navigation>();
  const { cards, categories } = useWallet();
  const [cardId, setCardId] = useState(cards[0]?.id ?? '');
  const [period, setPeriod] = useState(currentMonth());
  const [file, setFile] = useState<Awaited<ReturnType<typeof chooseInvoicePdf>>>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pickFile() {
    try {
      setError('');
      setFile(await chooseInvoicePdf());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir os arquivos do dispositivo.');
    }
  }

  async function analyze() {
    if (!file) {
      setError('Selecione uma fatura em PDF antes de iniciar a análise.');
      return;
    }
    const card = cards.find((item) => item.id === cardId);
    if (!card) {
      setError('Cadastre e selecione um cartão para associar à fatura.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await analyzeInvoice(file, card.name, period, categories);
      navigation.navigate('ImportReview', { transactions: result.transactions, fileName: file.name, cardId, period });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'O arquivo não pôde ser analisado. Revise o PDF e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title="Menos digitação. Mais tempo." subtitle="Importe faturas PDF e revise as compras antes de salvar." />
      <ChoiceRow choices={['Fatura PDF']} value="Fatura PDF" onChange={() => undefined} />
      <SectionTitle>Cartões cadastrados</SectionTitle>
      {cards.length ? <CardChoiceRow cards={cards} value={cardId} onChange={setCardId} /> : <Notice>Cadastre um cartão antes de importar a fatura.</Notice>}
      <Button title="Adicionar cartão" variant="secondary" onPress={() => navigation.navigate('AddCard')} />
      <MonthField label="Período da fatura" value={period} onChange={setPeriod} />
      <CardBox style={{ backgroundColor: colors.roseLight, borderStyle: 'dashed', borderColor: colors.primary }}>
        <View style={{ alignItems: 'center', gap: 8 }}><FileText size={27} color={colors.primary} /><Text style={{ color: colors.ink, fontWeight: '700' }}>{file?.name ?? 'Nenhum arquivo selecionado'}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{file ? `${Math.round((file.size ?? 0) / 1024)} KB · PDF` : 'Selecione um PDF digital com texto selecionável.'}</Text></View>
        <Button title={file ? 'Selecionar outro arquivo' : 'Selecionar arquivo PDF'} variant="secondary" onPress={() => void pickFile()} />
      </CardBox>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <CardBox>
        <Text style={{ color: colors.ink, fontWeight: '700' }}>Análise automática</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Extraímos compras e sugerimos categorias. Depois, você revisa cada lançamento antes de confirmar.</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Faturas protegidas por senha, digitalizadas ou com formato não reconhecido não são salvas.</Text>
      </CardBox>
      <Button title="Analisar novo arquivo" onPress={() => void analyze()} loading={busy} disabled={!file || !cards.length} />
    </Screen>
  );
}

export function ImportReviewScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'ImportReview'>>();
  const { expenses, cards, saveMany } = useWallet();
  const [transactions, setTransactions] = useState(route.params.transactions);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cardName = cards.find((card) => card.id === route.params.cardId)?.name ?? 'Cartão';
  const statementId = useMemo(() => makeId('statement'), []);
  const duplicates = transactions.filter((item) => expenses.some((expense) =>
    expense.description.trim().toLocaleLowerCase() === item.description.trim().toLocaleLowerCase()
    && Math.abs(expense.amount - item.amount) < 0.01
    && expense.date === item.date,
  ));
  const total = transactions.reduce((sum, item) => sum + item.amount, 0);

  function updateTransaction(id: string, patch: Partial<InvoiceTransaction>) {
    setTransactions((current) => current.map((transaction) => transaction.id === id ? { ...transaction, ...patch } : transaction));
  }

  async function confirm() {
    if (!transactions.length || transactions.some((item) => !Number.isFinite(item.amount) || item.amount <= 0 || !item.description.trim())) {
      setError('Revise os lançamentos: a lista não pode ficar vazia e cada compra precisa de descrição e valor positivo.');
      return;
    }
    if (duplicates.length === transactions.length) {
      setError('Nenhuma compra nova: todas já estão salvas, então esta fatura já foi importada. Remova ou edite lançamentos, ou escolha outro arquivo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const now = Date.now();
      const statement: Statement = {
        id: statementId,
        kind: 'statement',
        fileName: route.params.fileName,
        cardId: route.params.cardId,
        period: route.params.period,
        total,
        importedAt: new Date().toISOString(),
        status: 'saved',
        updatedAt: now,
      };
      const records: Array<Expense | Statement> = [statement];
      for (const transaction of transactions) {
        if (duplicates.some((duplicate) =>
          duplicate.description.trim().toLocaleLowerCase() === transaction.description.trim().toLocaleLowerCase()
          && Math.abs(duplicate.amount - transaction.amount) < 0.01
          && duplicate.date === transaction.date,
        )) continue;
        const expense: Expense = {
          ...transaction,
          kind: 'expense',
          payment: 'Crédito',
          recurring: false,
          cardId: route.params.cardId,
          statementId,
          updatedAt: now,
        };
        records.push(expense);
      }
      await saveMany(records);
      const added = transactions.length - duplicates.length;
      const skipped = duplicates.length ? ` ${duplicates.length} já existia${duplicates.length > 1 ? 'm' : ''} e não ${duplicates.length > 1 ? 'foram' : 'foi'} repetida${duplicates.length > 1 ? 's' : ''}.` : '';
      Alert.alert('Fatura salva', `${added} compra${added > 1 ? 's' : ''} adicionada${added > 1 ? 's' : ''}.${skipped}`, [{ text: 'Concluído', onPress: () => navigation.popToTop() }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a fatura.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title="Revise antes de salvar" subtitle={`${route.params.fileName} · ${cardName}`} />
      <CardBox style={{ backgroundColor: colors.rose, borderWidth: 0 }}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{transactions.length} compras extraídas · {route.params.period}</Text>
        <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '700' }}>{formatCurrency(total)}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Toque nos campos para corrigir descrições, valores e categorias antes de confirmar.</Text>
      </CardBox>
      <CardBox>
        {transactions.map((transaction) => {
          const isDuplicate = duplicates.some((duplicate) => duplicate.id === transaction.id);
          return (
            <View key={transaction.id} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
              {isDuplicate ? <Text style={{ color: colors.amberInk, fontSize: 11 }}>Possível duplicidade · não será salva novamente</Text> : null}
              <TextInput value={transaction.description} onChangeText={(description) => updateTransaction(transaction.id, { description })} style={{ color: colors.ink, fontWeight: '600', borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6 }} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={String(transaction.amount).replace('.', ',')} onChangeText={(value) => updateTransaction(transaction.id, { amount: parseCurrencyInput(value) })} keyboardType="decimal-pad" style={{ flex: 1, color: colors.ink, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6 }} />
                <TextInput value={transaction.category} onChangeText={(category) => updateTransaction(transaction.id, { category })} style={{ flex: 1, color: colors.primary, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 6 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDate(transaction.date)}</Text>
                <Pressable onPress={() => setTransactions((current) => current.filter((item) => item.id !== transaction.id))}><Text style={{ color: colors.red, fontSize: 12 }}>Remover</Text></Pressable>
              </View>
            </View>
          );
        })}
      </CardBox>
      {duplicates.length ? <Notice tone="green">{duplicates.length} possível(is) duplicidade(s) identificada(s). Lançamentos já salvos não serão adicionados de novo.</Notice> : null}
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title={`Confirmar ${transactions.length} compras no ${cardName}`} onPress={() => void confirm()} loading={busy} />
      <Button title="Escolher outro arquivo" variant="secondary" onPress={() => navigation.navigate('ImportStatement')} />
    </Screen>
  );
}

export function ProfileEditScreen() {
  const { settings, save } = useWallet();
  const navigation = useNavigation<Navigation>();
  const accountName = useDisplayName();
  const [name, setName] = useState(settings?.name || accountName || '');
  const [nickname, setNickname] = useState(settings?.nickname ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      setError('Informe seu nome.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await save({
        monthlyIncome: 0,
        fixedExpenses: 0,
        monthlySavings: 0,
        ...settings,
        id: settings?.id ?? 'settings',
        kind: 'settings',
        name: name.trim(),
        nickname: nickname.trim(),
        updatedAt: Date.now(),
      });
      await updateAccountName(name).catch(() => undefined); // o nome local já foi salvo; a conta é atualizada quando possível
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o perfil.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header back />
      <PageTitle title="Editar perfil" subtitle="Do jeito que você gosta de ser chamada." />
      <Field label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Como prefere ser chamada? (opcional)" value={nickname} onChangeText={setNickname} placeholder="Apelido" autoCapitalize="words" />
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Salvar perfil" onPress={() => void submit()} loading={busy} />
    </Screen>
  );
}

export function IncomeScreen() {
  const { settings, save } = useWallet();
  const navigation = useNavigation<Navigation>();
  const [name, setName] = useState(settings?.name ?? '');
  const [income, setIncome] = useState(String(settings?.monthlyIncome ?? ''));
  const [fixed, setFixed] = useState(String(settings?.fixedExpenses ?? ''));
  const [savings, setSavings] = useState(String(settings?.monthlySavings ?? ''));
  const [error, setError] = useState('');
  async function submit() {
    const monthlyIncome = parseCurrencyInput(income);
    const fixedExpenses = parseCurrencyInput(fixed);
    const monthlySavings = parseCurrencyInput(savings);
    if (!name.trim() || ![monthlyIncome, fixedExpenses, monthlySavings].every((value) => Number.isFinite(value) && value >= 0)) {
      setError('Confira seu nome e os valores informados.');
      return;
    }
    try {
      await save({ ...settings, id: settings?.id ?? 'settings', kind: 'settings', name: name.trim(), monthlyIncome, fixedExpenses, monthlySavings, updatedAt: Date.now() });
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as informações financeiras.');
    }
  }
  return (
    <Screen>
      <Header back />
      <PageTitle title="Salário e renda" subtitle="Seu orçamento começa pelo que entra e pelo que já tem destino." />
      <Field label="Nome" value={name} onChangeText={setName} />
      <Field label="Salário líquido mensal" value={income} onChangeText={setIncome} keyboardType="decimal-pad" />
      <Field label="Gastos fixos mensais" value={fixed} onChangeText={setFixed} keyboardType="decimal-pad" />
      <Field label="Reserva mensal para metas (só se você ainda não tiver metas)" value={savings} onChangeText={setSavings} keyboardType="decimal-pad" />
      <Text style={{ color: colors.muted, fontSize: 11 }}>Com metas cadastradas, o app soma o aporte mensal de todas elas e ignora este valor.</Text>
      {error ? <Notice tone="amber">{error}</Notice> : null}
      <Button title="Salvar renda" onPress={() => void submit()} />
    </Screen>
  );
}
