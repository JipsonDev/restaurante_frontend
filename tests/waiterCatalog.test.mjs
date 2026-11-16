import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMenuProducts, isMenuPromotion } from '../src/utils/waiterCatalog.mjs';
const products = [
  { id: 1, nombre: 'Café', descripcion: 'Leche de avena', categoria_nombre: 'Bebidas', precio: 5, stock_disponible: 3 },
  { id: 2, nombre: 'Té', descripcion: 'No aplica promociones', categoria_nombre: 'Bebidas', precio: 2, stock_disponible: 0 },
  { id: 3, nombre: 'Pan', categoria_nombre: 'Panadería', precio: 3, stock_disponible: 2 },
];
test('catalog searches descriptions and categories without accents', () => {
  assert.deepEqual(filterMenuProducts(products, { query: 'avena' }).map(p => p.id), [1]);
  assert.deepEqual(filterMenuProducts(products, { query: 'panaderia' }).map(p => p.id), [3]);
});
test('a mention of promotions in a description never hides an ordinary product', () => {
  assert.equal(isMenuPromotion(products[1]), false);
  assert.equal(isMenuPromotion({ nombre: 'Promo desayuno' }), true);
  assert.equal(isMenuPromotion({ nombre: 'Combo', categoria_nombre: 'Promociones' }), true);
});
test('availability filter and price sort preserve the source collection', () => {
  assert.deepEqual(filterMenuProducts(products, { availableOnly: true, sort: 'price' }).map(p => p.id), [3, 1]);
  assert.deepEqual(products.map(p => p.id), [1, 2, 3]);
});
