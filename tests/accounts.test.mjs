import test from 'node:test';
import assert from 'node:assert/strict';
import { combineAccounts, accountRounds, operationalOrder, groupUnpaidAccounts, splitCents } from '../src/utils/accountLogic.mjs';
import { kitchenRounds, kitchenColumn } from '../src/utils/kitchenLogic.mjs';

const paid = { id: 1, mesa_id: 5, total: 20, estado: 'PAGADO', estado_cobro: 'PAGADO', pendiente_entrega: true, items: [{ id: 1 }], rondas: [{ id: 7, estado: 'LISTO', items: [{ id: 1, cantidad: 1 }] }] };
const unpaid = { id: 2, mesa_id: 5, total: 4.1, estado: 'PENDIENTE', items: [{ id: 2 }], rondas: [{ id: 8, estado: 'PENDIENTE', items: [{ id: 2, cantidad: 1 }] }] };

test('waiter keeps paid food visible until delivery and excludes cancelled accounts', () => {
  assert.equal(operationalOrder(paid), true);
  assert.equal(operationalOrder({ ...paid, pendiente_entrega: false }), false);
  assert.equal(operationalOrder({ ...paid, estado: 'CANCELADO' }), false);
});

test('one table bill excludes already paid amounts while retaining all delivery rounds', () => {
  const combined = combineAccounts([paid, unpaid]);
  assert.equal(combined.id, 2);
  assert.equal(combined.total, 4.1);
  assert.deepEqual(combined.items.map((i) => i.id), [2]);
  assert.deepEqual(accountRounds(combined).map((r) => [r.id, r.pedido_id]), [[7,1],[8,2]]);
});

test('cashier groups all unpaid table orders and keeps express accounts separate', () => {
  const grouped = groupUnpaidAccounts([paid, unpaid, { ...unpaid, id: 3, total: 10.2 }, { ...unpaid, id: 4, mesa_id: null }, { ...unpaid, id: 5, mesa_id: null }]);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].total, 14.3);
  assert.equal(grouped[0].items.length, 2);
});

test('kitchen shows paid and unpaid rounds in their own columns with original timestamps', () => {
  const rows = kitchenRounds([{ ...paid, created_at: 'old', rondas: [{ ...paid.rondas[0], created_at: 'new' }] }, unpaid]);
  assert.deepEqual(rows.map((r) => [r.id, r.pedido_id, kitchenColumn(r)]), [[7,1,'LISTO'], [8,2,'PENDIENTE']]);
  assert.equal(rows[0].created_at, 'new');
  assert.equal(rows[0].estado_cobro, 'PAGADO');
});

test('division preview shows each remainder cent and uses the stored service total', () => {
  assert.deepEqual(splitCents(13.21, [1,1,1]), [4.41,4.4,4.4]);
  assert.deepEqual(splitCents(13.21, [1000,200]), [11.01,2.2]);
});
