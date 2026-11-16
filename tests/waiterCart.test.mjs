import test from 'node:test';
import assert from 'node:assert/strict';
import { addDraftProduct, changeDraftQuantity } from '../src/utils/waiterCart.mjs';

const product = { id: 1, nombre: 'Café', precio: 3, stock_disponible: 5 };
const plain = { localId: 'plain', producto_id: 1, cantidad: 1, notas: '', modificadores: [], stock: 5, promo: false };
const custom = { ...plain, localId: 'custom', notas: 'Sin azúcar', modificadores: [{ nombre: 'Leche', precio_extra: 1 }] };

test('adding a plain product changes only the unmodified line, preserving extras and notes', () => {
  const original = [plain, custom];
  const result = addDraftProduct(original, product);
  assert.deepEqual(result.items.map(i => i.cantidad), [2, 1]);
  assert.equal(result.items[1], custom);
  assert.equal(original[0].cantidad, 1);
});
test('adding a product with only customized lines creates a clean line', () => {
  const result = addDraftProduct([custom], product, false, 'new');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0], custom);
  assert.deepEqual(result.items[1].modificadores, []);
  assert.equal(result.items[1].notas, '');
});
test('stock is checked across all variants and current catalog stock', () => {
  assert.equal(changeDraftQuantity([plain, { ...custom, cantidad: 4 }], plain, 1, product).error, 'stock');
  assert.equal(changeDraftQuantity([plain, custom], plain, 1, { ...product, stock_disponible: 2 }).error, 'stock');
  assert.equal(addDraftProduct([plain, { ...custom, cantidad: 4 }], product).error, 'stock');
});
test('a lower current stock does not prevent decrementing an existing line', () => {
  assert.equal(changeDraftQuantity([{ ...plain, cantidad: 3 }, custom], plain, -1, { ...product, stock_disponible: 1 }).items[0].cantidad, 2);
  assert.deepEqual(changeDraftQuantity([plain], plain, -1, product).items, []);
});
test('a product removed from the current catalog can be reduced but cannot be increased', () => {
  assert.equal(changeDraftQuantity([plain], plain, 1, null).error, 'stock');
  assert.deepEqual(changeDraftQuantity([plain], plain, -1, null).items, []);
});
test('promotions and ordinary lines do not merge, but consume the same stock', () => {
  const promo = addDraftProduct([], product, true, 'promo').items[0];
  assert.equal(addDraftProduct([promo], product, false, 'normal').items.length, 2);
  assert.equal(addDraftProduct([promo], product, true).items[0].cantidad, 2);
  assert.equal(addDraftProduct([{ ...promo, cantidad: 5 }], product).error, 'stock');
});
