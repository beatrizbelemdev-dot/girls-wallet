/**
 * Integração com a API externa BrasilAPI (https://brasilapi.com.br), endpoint de taxas.
 * Não exige chave de acesso. Os valores são percentuais ao ano.
 */

export interface Rates {
  /** Taxa Selic, em % ao ano. */
  selic: number;
  /** Taxa CDI, em % ao ano. */
  cdi: number;
  /** IPCA acumulado, em % ao ano. */
  ipca: number;
}

const RATES_URL = 'https://brasilapi.com.br/api/taxas/v1';
const TIMEOUT_MS = 8000;

/**
 * Busca as taxas atuais na BrasilAPI.
 *
 * @returns Selic, CDI e IPCA em % ao ano.
 * @throws Error com mensagem em português quando não há conexão, a resposta demora
 *   mais que o limite, o servidor responde com erro ou o JSON não tem o formato esperado.
 */
export async function fetchRates(): Promise<Rates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(RATES_URL, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A consulta das taxas demorou demais. Tente novamente.');
    }
    throw new Error('Não foi possível consultar as taxas. Confira sua conexão com a internet.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(`O serviço de taxas respondeu com erro (HTTP ${response.status}).`);

  const payload: unknown = await response.json().catch(() => undefined);
  const rates = parseRates(payload);
  if (!rates) throw new Error('O serviço de taxas retornou uma resposta inesperada.');
  return rates;
}

/**
 * Converte a resposta da API, no formato `[{ nome: 'Selic', valor: 13.75 }, ...]`, em {@link Rates}.
 *
 * @returns As taxas, ou `undefined` se faltar alguma delas ou algum valor não for um número.
 */
export function parseRates(payload: unknown): Rates | undefined {
  if (!Array.isArray(payload)) return undefined;

  const byName = new Map<string, number>();
  for (const item of payload) {
    if (typeof item !== 'object' || item === null) continue;
    const { nome, valor } = item as { nome?: unknown; valor?: unknown };
    if (typeof nome === 'string' && typeof valor === 'number' && Number.isFinite(valor)) {
      byName.set(nome.toLowerCase(), valor);
    }
  }

  const selic = byName.get('selic');
  const cdi = byName.get('cdi');
  const ipca = byName.get('ipca');
  if (selic === undefined || cdi === undefined || ipca === undefined) return undefined;
  return { selic, cdi, ipca };
}

// TODO (opcional): guardar a última taxa lida no aparelho, com a data da consulta, para
// mostrar um valor mesmo sem internet (o app precisa funcionar offline).
