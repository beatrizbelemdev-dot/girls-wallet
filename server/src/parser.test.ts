import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatementText } from './parser.js';

const categories = ['Moradia', 'Alimentação', 'Transporte', 'Compras', 'Saúde'];

test('extracts Brazilian statement entries, infers categories, and totals BRL amounts', () => {
  const result = parseStatementText(
    [
      '13/10 Uber*Trip R$ 25,00',
      '14/10 iFood Restaurante 54,90',
      '14/10 Loja digital 1.234,56',
      'Valor total da fatura R$ 1.314,46',
    ].join('\n'),
    '2026-10',
    categories,
  );

  assert.equal(result.transactions.length, 3);
  assert.deepEqual(
    result.transactions.map(({ description, amount, category, date }) => ({ description, amount, category, date })),
    [
      { description: 'Uber*Trip', amount: 25, category: 'Transporte', date: '2026-10-13' },
      { description: 'iFood Restaurante', amount: 54.9, category: 'Alimentação', date: '2026-10-14' },
      { description: 'Loja digital', amount: 1234.56, category: 'Compras', date: '2026-10-14' },
    ],
  );
  assert.equal(result.total, 1314.46);
});

test('removes duplicate lines and rejects PDFs without recognizable purchases', () => {
  const result = parseStatementText(
    '13/10 Shopee 89,90\n13/10 Shopee 89,90\nTotal da fatura 89,90',
    '2026-10',
    categories,
  );
  assert.equal(result.transactions.length, 1);

  assert.throws(
    () => parseStatementText('Seu saldo é R$ 100,00', '2026-10', categories),
    /Nenhuma compra foi reconhecida/,
  );
});

test('rejects invalid statement periods', () => {
  assert.throws(() => parseStatementText('15/10 Mercado 10,00', '2026-13', categories), /Período inválido/);
});
