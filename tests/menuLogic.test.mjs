import test from 'node:test';
import assert from 'node:assert/strict';
import { productPayload, productStatus, productStock, recipeEstimate, normalizeCatalogText } from '../src/utils/menuLogic.mjs';
const categories = [{ id: 1, nombre: 'Café', activo: 1 }, { id: 2, activo: 0 }];
const inventory = [{ id: 5, nombre: 'Café', unidad: 'kg', stock: 2, stock_reservado: 0.5, costo_unitario: 12, activo: 1 }];
const form = { nombre: 'Café', descripcion: '', precio: '2,50', stock: '0', categoria_id: 1, mode: 'own', disponible: true, receta: [] };

test('catalog distinguishes hidden products from exhausted published stock, including disabled categories', () => {
  assert.equal(productStatus({ disponible: 1, stock_disponible: 0 }), 'empty');
  assert.equal(productStatus({ disponible: 0, stock_disponible: 15 }), 'hidden');
  assert.equal(productStatus({ disponible: 1, stock_disponible: 15, categoria_activa: 0 }), 'hidden');
  assert.equal(productStatus({ disponible: 1, stock: 15, categoria_activa: null }), 'available');
  assert.equal(productStock({ stock: 5, stock_reservado: 2 }), 3);
  assert.equal(normalizeCatalogText('  CAFÉ  '), 'cafe');
});
test('new products do not invent stock and stale unchanged quantities are not sent back', () => {
  assert.equal(productPayload(form, categories, inventory).stock, 0);
  const payload = productPayload({ ...form, id: 7, stock: '10', originalStock: 10, originalMode: 'own' }, categories, inventory);
  assert.equal('stock' in payload, false);
  assert.throws(() => productPayload({ ...form, id: 7, stock: '1', originalStock: 10, reserved: 3 }, categories, inventory), /reservadas/);
});
test('changing stock source clears the unused recipe or direct link and uses inventory units', () => {
  const recipe = productPayload({ ...form, mode: 'recipe', inventario_item_id: 5, receta: [{ inventario_item_id: 5, cantidad: '0,020', unidad: 'g' }] }, categories, inventory);
  assert.equal(recipe.inventario_item_id, null);
  assert.deepEqual(recipe.receta, [{ inventario_item_id: 5, cantidad: 0.02, unidad: 'kg' }]);
  const linked = productPayload({ ...form, mode: 'linked', inventario_item_id: 5, receta: recipe.receta }, categories, inventory);
  assert.deepEqual(linked.receta, []);
  assert.equal(linked.inventario_item_id, 5);
});
test('rejects nonexistent or inactive categories, empty recipes and invalid ingredients', () => {
  assert.throws(() => productPayload(form, [], inventory), /categoría existente/);
  assert.throws(() => productPayload({ ...form, categoria_id: 2 }, categories, inventory), /activa/);
  assert.throws(() => productPayload({ ...form, mode: 'recipe' }, categories, inventory), /al menos/);
  assert.throws(() => productPayload({ ...form, mode: 'linked', inventario_item_id: 99 }, categories, inventory), /insumos/);
  assert.throws(() => productPayload({ ...form, mode: 'recipe', receta: [{ inventario_item_id: 5, cantidad: 0 }] }, categories, inventory), /mayor/);
});
test('recipe estimate subtracts reservations and flags unknown costs rather than claiming profit', () => {
  const recipe = { mode: 'recipe', receta: [{ inventario_item_id: 5, cantidad: '0,020' }] };
  assert.deepEqual(recipeEstimate(recipe, inventory), { portions: 75, cost: 0.24, completeCost: true });
  assert.equal(recipeEstimate(recipe, [{ ...inventory[0], costo_unitario: 0 }]).completeCost, false);
  assert.equal(recipeEstimate({ ...recipe, receta: [{ inventario_item_id: 5, cantidad: 0 }] }, inventory), null);
});
