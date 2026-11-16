import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDrafts, parseDrafts, validateDraft, completedDraft, newExpressDraft, patchExpressDraft } from '../src/utils/orderDrafts.mjs';
import { catalogContext } from '../src/utils/waiterNavigation.mjs';

test('drafts preserve destinations, notes, customer and the exact request across reloads', () => {
  let data = newExpressDraft(emptyDrafts(), 'express-draft:ana');
  data = patchExpressDraft(data, 'express-draft:ana', { expressInfo: { nombre: 'Ana' } });
  data.carritos = { 1: [{ producto_id: 2, cantidad: 1 }], 'express-draft:ana': [{ producto_id: 3, cantidad: 2 }] };
  data.orderNotes[1] = 'Sin sal';
  data.pending[1] = { request_id: 'original_request_123', items: data.carritos[1], mesa_id: 1 };
  assert.deepEqual(parseDrafts(JSON.stringify(data)), data);
  const next = completedDraft(data, '1');
  assert.deepEqual(next.carritos[1], []);
  assert.equal(next.pending[1], undefined);
  assert.deepEqual(next.carritos['express-draft:ana'], data.carritos['express-draft:ana']);
  assert.equal(data.carritos[1].length, 1);
});
test('invalid saved data is reported instead of silently erasing pending orders', () => {
  for (const raw of ['{', 'null', '{"version":3}', JSON.stringify({ ...emptyDrafts(), pending: { 1: {} } })]) assert.throws(() => parseDrafts(raw));
});
test('restored lines use current prices and aggregate stock across variants', () => {
  const product = { id: 1, nombre: 'Cafe', precio: 5, disponible: 1, stock: 2 };
  const item = { producto_id: 1, nombre: 'Cafe', precio: 4, cantidad: 1 };
  const checked = validateDraft([item], [product]);
  assert.deepEqual(checked.changes, ['Cafe']);
  assert.equal(checked.items[0].precio, 5);
  assert.equal(item.precio, 4);
  assert.match(validateDraft([item, { ...item, cantidad: 2 }], [product]).error, /existencias/);
  assert.match(validateDraft([item], [{ ...product, disponible: 0 }]).error, /disponible/);
  assert.match(validateDraft([item], [{ ...product, stock: 50, stock_disponible: 0 }]).error, /existencias/);
  assert.equal(validateDraft([item], [{ ...product, stock: 0, stock_disponible: 1 }]).error, undefined);
  assert.match(validateDraft([{ ...item, cantidad: 0.5 }], [product]).error, /Cantidad/);
});
test('open Express accepts another round; payment or cancellation blocks editing', () => {
  const context = order => catalogContext({ express: true, savedExpressId: 12, order });
  assert.equal(context({ estado: 'PREPARANDO' }).editable, true);
  assert.equal(context({ estado: 'ENTREGADO' }).editable, true);
  for (const order of [{ estado: 'PAGADO' }, { estado: 'CANCELADO' }, { estado: 'LISTO', abonado: 1 }]) assert.equal(context(order).editable, false);
});
