/**
 * Integração com a BrasilAPI (https://brasilapi.com.br), endpoint de bancos.
 * Não exige chave de acesso. Usada para escolher o banco emissor de um cartão e mostrar a logo.
 */

export interface Bank {
  /** Código compensado do banco (por exemplo, 260). */
  code: number;
  /** Nome curto, como vem da API (por exemplo, "NU PAGAMENTOS - IP"). */
  name: string;
  /** Nome completo da instituição. */
  fullName: string;
  /** Endereço da logo (SVG). */
  logoUrl: string;
}

const BANKS_URL = 'https://brasilapi.com.br/api/banks/v1';
// A lista tem centenas de instituições, então o limite é maior que o das taxas.
const TIMEOUT_MS = 15000;

let cache: Bank[] | undefined;

/**
 * Busca a lista de bancos na BrasilAPI e a guarda em memória, para não repetir a consulta
 * enquanto o app estiver aberto.
 *
 * @returns Bancos que têm código e logo, ordenados por nome.
 * @throws Error com mensagem em português quando não há conexão, a resposta demora demais,
 *   o servidor responde com erro ou o JSON não tem o formato esperado.
 */
export async function fetchBanks(): Promise<Bank[]> {
  if (cache) return cache;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(BANKS_URL, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A consulta dos bancos demorou demais. Tente novamente.');
    }
    throw new Error('Não foi possível consultar os bancos. Confira sua conexão com a internet.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) throw new Error(`O serviço de bancos respondeu com erro (HTTP ${response.status}).`);

  const payload: unknown = await response.json().catch(() => undefined);
  const banks = parseBanks(payload);
  if (!banks) throw new Error('O serviço de bancos retornou uma resposta inesperada.');
  cache = banks;
  return banks;
}

/**
 * Converte a resposta da API em {@link Bank}[]. Descarta instituições sem código ou sem logo
 * (por exemplo, sistemas como a Selic), porque não servem para escolher um cartão.
 *
 * @returns A lista ordenada por nome, ou `undefined` se a resposta não for uma lista.
 */
export function parseBanks(payload: unknown): Bank[] | undefined {
  if (!Array.isArray(payload)) return undefined;

  const banks: Bank[] = [];
  for (const item of payload) {
    if (typeof item !== 'object' || item === null) continue;
    const { code, name, fullName, logo_url: logoUrl } = item as Record<string, unknown>;
    if (typeof code !== 'number' || typeof name !== 'string' || typeof logoUrl !== 'string' || !logoUrl) continue;
    banks.push({ code, name, fullName: typeof fullName === 'string' ? fullName : name, logoUrl });
  }
  return banks.sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
}

/** Deixa o texto em minúsculas e sem acentos, para a busca não depender disso. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}

/**
 * Filtra os bancos pelo texto digitado, no nome, no nome completo ou no código.
 *
 * @param banks Lista completa.
 * @param query Texto da busca; vazio devolve a lista inteira.
 */
export function searchBanks(banks: Bank[], query: string): Bank[] {
  const text = normalize(query.trim());
  if (!text) return banks;
  return banks.filter((bank) => normalize(`${bank.name} ${bank.fullName}`).includes(text) || String(bank.code).startsWith(text));
}

// TODO: no cadastro de cartão (AddCardScreen), trocar o campo de nome por uma busca com
// `searchBanks` e guardar `bank.name` e `bank.logoUrl` no cartão. A lista é grande: renderize-a
// com FlatList, e não com um `map` dentro de um ScrollView.
