import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { Category } from '../data/types';
import { auth } from './firebase';

export interface InvoiceTransaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export interface ParsedStatement {
  transactions: InvoiceTransaction[];
  total: number;
  currency: string;
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const ANALYZE_TIMEOUT_MS = 30000;

export async function chooseInvoicePdf(): Promise<DocumentPicker.DocumentPickerAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  return result.canceled ? null : result.assets[0] ?? null;
}

export async function analyzeInvoice(
  asset: DocumentPicker.DocumentPickerAsset,
  cardName: string,
  period: string,
  categories: Category[],
): Promise<ParsedStatement> {
  if (!apiUrl) throw new Error('O serviço de leitura de faturas não está configurado. Defina EXPO_PUBLIC_API_URL e inicie a API Node.');
  // Sem conta (modo demonstração) a requisição segue sem token; a API só a aceita em modo de desenvolvimento.
  const currentUser = auth?.currentUser;
  const form = new FormData();
  const file = new File(asset.uri);
  form.append('file', file, asset.name);
  form.append('cardName', cardName);
  form.append('period', period);
  form.append('categories', JSON.stringify(categories.map(({ name }) => name)));

  // Sem limite de tempo, um servidor inalcançável (IP errado, firewall) deixa a tela "carregando"
  // por mais de um minuto, até o sistema desistir.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/statements/analyze`, {
      method: 'POST',
      headers: currentUser ? { Authorization: `Bearer ${await currentUser.getIdToken()}` } : {},
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A API de faturas não respondeu a tempo. Confira se o servidor está rodando e se o IP em EXPO_PUBLIC_API_URL é o do seu computador.');
    }
    throw new Error('Não foi possível conectar à API de faturas. Confira a conexão e EXPO_PUBLIC_API_URL.');
  } finally {
    clearTimeout(timer);
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String(payload.message)
      : `A análise da fatura falhou (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!isParsedStatement(payload)) throw new Error('A API retornou uma análise inválida. Nenhuma compra foi salva.');
  return payload;
}

function isParsedStatement(value: unknown): value is ParsedStatement {
  if (!value || typeof value !== 'object') return false;
  const statement = value as Partial<ParsedStatement>;
  return Number.isFinite(statement.total)
    && Array.isArray(statement.transactions)
    && statement.transactions.every((transaction) =>
      typeof transaction.id === 'string'
      && typeof transaction.description === 'string'
      && Number.isFinite(transaction.amount)
      && typeof transaction.category === 'string'
      && typeof transaction.date === 'string',
    );
}
