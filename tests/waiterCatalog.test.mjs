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

test('menu search finds a product by its number and by words in any order', async () => {
  const { filterMenuProducts, menuQueryCode } = await import('../src/utils/waiterCatalog.mjs');
  const products = [
    { id: 12, nombre: 'Batido de mora', descripcion: 'Con leche entera', categoria_nombre: 'Bebidas', precio: 2.8, stock: 10 },
    { id: 7, nombre: 'Café americano', categoria_nombre: 'Cafetería', precio: 1.5, stock: 10 },
    { id: 120, nombre: 'Bolón mixto 12 piezas', categoria_nombre: 'Entradas', precio: 3.75, stock: 10 },
  ];
  assert.equal(menuQueryCode('12'), 12);
  assert.equal(menuQueryCode('#12'), 12);
  assert.equal(menuQueryCode('número 12'), 12);
  assert.equal(menuQueryCode('café'), null);
  assert.deepEqual(filterMenuProducts(products, { query: '12' }).map(p => p.id), [12]);
  assert.deepEqual(filterMenuProducts(products, { query: 'mora batido' }).map(p => p.id), [12]);
  assert.deepEqual(filterMenuProducts(products, { query: 'cafe' }).map(p => p.id), [7]);
  assert.deepEqual(filterMenuProducts(products, { query: 'un batido de mora' }).map(p => p.id), [12]);
});

test('a product sold out by the kitchen stays in the menu, last, with no stock', async () => {
  const { filterMenuProducts, menuStock } = await import('../src/utils/waiterCatalog.mjs');
  const list = [{ id: 1, nombre: 'Agua', precio: 1, stock: 10, agotado: 1 }, { id: 2, nombre: 'Batido', precio: 2, stock: 10 }];
  assert.equal(menuStock(list[0]), 0);
  assert.deepEqual(filterMenuProducts(list).map(p => p.id), [2, 1]);
  assert.deepEqual(filterMenuProducts(list, { availableOnly: true }).map(p => p.id), [2]);
});
