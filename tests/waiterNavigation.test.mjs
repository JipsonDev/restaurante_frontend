import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogContext } from '../src/utils/waiterNavigation.mjs';

test('catalog remains available without inventing a table or an express account', () => {
  assert.equal(catalogContext({}).reason, 'no-table');
  assert.equal(catalogContext({ table: { numero: 1, activo: 0 } }).editable, false);
  assert.equal(catalogContext({ table: { numero: 1, activo: 1 } }).editable, true);
});
test('viewing a sent express cannot append items that create a separate account', () => {
  assert.equal(catalogContext({ express: true, savedExpressId: 9 }).editable, false);
  assert.equal(catalogContext({ express: true }).editable, true);
});
test('table advances are protected but a fully paid table can start another order', () => {
  const table = { numero: 1, activo: 1 };
  assert.equal(catalogContext({ table, order: { abonado: 10, estado_cobro: 'PARCIAL' } }).editable, false);
  assert.equal(catalogContext({ table, order: { abonado: 10, estado_cobro: 'PAGADO' } }).editable, true);
});
