export const colors = {
  background: '#FCF8F8',
  surface: '#FFFFFF',
  ink: '#3B3038',
  muted: '#8B7D86',
  border: '#EADFE3',
  primary: '#984766',
  primaryDark: '#803B57',
  rose: '#F5DDE5',
  roseLight: '#FAEEF2',
  lavender: '#F0EDF8',
  green: '#E8F3EE',
  greenInk: '#3F7867',
  amber: '#FBF0DD',
  amberInk: '#91602B',
  red: '#C04458',
  track: '#EEE3E7',
};

export const spacing = {
  page: 22,
  card: 18,
  section: 22,
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

export function parseCurrencyInput(value: string): number {
  const clean = value.replace(/[^\d,.-]/g, '');
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  return Number(normalized);
}
