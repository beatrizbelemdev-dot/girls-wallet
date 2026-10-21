import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Wallet } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Card } from '../data/types';
import type { RootStackParamList } from '../navigation';
import { BankLogo } from './BankLogo';
import { colors, spacing } from '../theme';

export function Screen({ children, scroll = true, contentContainerStyle, ...props }: ScrollViewProps & { scroll?: boolean }) {
  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.fill, contentContainerStyle]}>{children}</View>
  );
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>{content}</SafeAreaView>;
}

export function Header({ title, back = false, action }: { title?: string; back?: boolean; action?: React.ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.header}>
      <View style={styles.headerStart}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => navigation.goBack()} hitSlop={10}>
            <ArrowLeft color={colors.ink} size={23} />
          </Pressable>
        ) : null}
        {!title ? (
          <View style={styles.brand}>
            <Wallet color={colors.primary} size={20} />
            <Text style={styles.brandText}>Girls Wallet</Text>
          </View>
        ) : null}
      </View>
      {title ? (
        <View style={styles.headerTitleRow}>
          {back ? <View style={styles.headerTitleSpacer} /> : null}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
      ) : null}
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.pageTitle}>
      <Text style={styles.h1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function CardBox({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.primaryButton : null,
        variant === 'secondary' ? styles.secondaryButton : null,
        variant === 'text' ? styles.textButton : null,
        pressed && !disabled ? styles.pressed : null,
        (disabled || loading) ? styles.disabled : null,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.primary} /> : icon}
      <Text style={[styles.buttonText, variant === 'primary' ? styles.primaryButtonText : null, variant === 'text' ? styles.textButtonText : null]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline ? styles.multilineInput : null, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function isoToDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dateToIso(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Seletor de data nativo; `value` e `onChange` usam o formato AAAA-MM-DD. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const date = isoToDate(value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <DateTimePicker
            value={date}
            mode="date"
            display="compact"
            locale="pt-BR"
            accentColor={colors.primary}
            onValueChange={(_event, selected) => onChange(dateToIso(selected))}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => DateTimePickerAndroid.open({
            value: date,
            mode: 'date',
            onValueChange: (_event, selected) => onChange(dateToIso(selected)),
          })}
          style={styles.input}
        >
          <Text style={{ color: colors.ink }}>{date.toLocaleDateString('pt-BR')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Move um mês no formato AAAA-MM; `step` pode ser negativo. */
function shiftMonth(value: string, step: number): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + step, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Seletor de mês e ano com setas para voltar e avançar, no lugar de digitar `AAAA-MM`.
 *
 * @param value Mês selecionado, no formato AAAA-MM.
 * @param onChange Recebe o novo mês, no mesmo formato.
 */
export function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [year, month] = /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const current = `${year}-${String(month).padStart(2, '0')}`;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" hitSlop={10} onPress={() => onChange(shiftMonth(current, -1))}>
          <ChevronLeft size={22} color={colors.primary} />
        </Pressable>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>{MONTH_NAMES[month - 1]} de {year}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" hitSlop={10} onPress={() => onChange(shiftMonth(current, 1))}>
          <ChevronRight size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export function Notice({ children, tone = 'rose' }: { children: React.ReactNode; tone?: 'rose' | 'green' | 'amber' }) {
  return (
    <View style={[styles.notice, tone === 'green' ? styles.greenNotice : null, tone === 'amber' ? styles.amberNotice : null]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionTitleText}>{children}</Text>{action}</View>;
}

export function ProgressBar({ value, danger = false }: { value: number; danger?: boolean }) {
  return <View style={{ height: 6, backgroundColor: colors.track, borderRadius: 6, overflow: 'hidden' }}><View style={{ height: 6, width: `${Math.min(100, Math.max(1, value * 100))}%`, backgroundColor: danger ? colors.red : colors.primary, borderRadius: 6 }} /></View>;
}

export function ChoiceRow({ choices, value, onChange }: { choices: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.choiceRow}>
      {choices.map((choice) => (
        <Pressable key={choice} onPress={() => onChange(choice)} style={[styles.choice, value === choice ? styles.choiceSelected : null]}>
          <Text style={[styles.choiceText, value === choice ? styles.choiceSelectedText : null]}>{choice}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Escolha de cartão em forma de "chips" com a logo do banco (quando o cartão tem uma).
 * Seleciona por `id`, e não pelo nome, então dois cartões com o mesmo nome não se confundem.
 *
 * @param cards Cartões cadastrados.
 * @param value `id` do cartão selecionado.
 * @param onChange Recebe o `id` do cartão tocado.
 */
export function CardChoiceRow({ cards, value, onChange }: { cards: Card[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={styles.choiceRow}>
      {cards.map((card) => {
        const selected = card.id === value;
        return (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(card.id)}
            style={[styles.choice, selected ? styles.choiceSelected : null, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingLeft: 8 }]}
          >
            <BankLogo uri={card.logoUrl} size={26} />
            <Text style={[styles.choiceText, selected ? styles.choiceSelectedText : null]}>{card.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingHorizontal: spacing.page, paddingTop: 8, paddingBottom: 34, gap: 18 },
  fill: { flex: 1 },
  header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  headerStart: { minWidth: 32, flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 1 },
  headerTitleRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  headerTitleSpacer: { height: 1 },
  headerTitle: { color: colors.primary, fontWeight: '700', fontSize: 19 },
  headerAction: { zIndex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: colors.primary, fontSize: 19, fontWeight: '700' },
  pageTitle: { gap: 4, marginTop: 12 },
  h1: { color: colors.ink, fontSize: 28, fontWeight: '400', lineHeight: 35 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: spacing.card, gap: 12 },
  button: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  primaryButton: { backgroundColor: colors.primary },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  textButton: { minHeight: 40, paddingHorizontal: 0 },
  buttonText: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  primaryButtonText: { color: colors.surface },
  textButtonText: { color: colors.primary },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.56 },
  field: { gap: 8 },
  label: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, color: colors.ink, fontSize: 14 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  inputError: { borderColor: colors.red },
  errorText: { color: colors.red, fontSize: 12 },
  notice: { padding: 14, backgroundColor: colors.roseLight, borderRadius: 16 },
  greenNotice: { backgroundColor: colors.green },
  amberNotice: { backgroundColor: colors.amber },
  noticeText: { color: colors.ink, fontSize: 12, lineHeight: 18 },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitleText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderRadius: 30, borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: colors.surface },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 12 },
  choiceSelectedText: { color: colors.surface },
});
