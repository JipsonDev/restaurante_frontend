import test from 'node:test';
import assert from 'node:assert/strict';
import { extrasForProduct, extraAppliesTo, lastRoundItems, topProducts, unitPrice } from '../src/utils/waiterFavorites.mjs';
import { addCustomizedProduct, addLines } from '../src/utils/waiterCart.mjs';

const extras = [
  { nombre: 'Sin azucar', tipo: 'EXCLUSION', categoria: 'Bebidas' }, { nombre: 'Extra leche', tipo: 'EXTRA', categoria: 'Cafe', precio: 0.3 },
  { nombre: 'Extra queso', tipo: 'EXTRA', categoria: 'Comida', precio: 1 }, { nombre: 'Sin cebolla', tipo: 'EXCLUSION', categoria: 'Comida' },
  { nombre: 'Para compartir', tipo: 'NOTA', categoria: null }, { nombre: 'Inactivo', tipo: 'NOTA', activo: 0 },
];
const names = p => extrasForProduct(extras, p).map(e => e.nombre);

test('los extras se filtran por la categoría del producto', () => {
  assert.deepEqual(names({ categoria_nombre: 'Bebidas' }), ['Sin azucar', 'Para compartir'], 'un agua no ofrece «Sin cebolla»');
  assert.deepEqual(names({ categoria_nombre: 'Cafetería' }), ['Sin azucar', 'Extra leche', 'Para compartir']);
  assert.deepEqual(names({ categoria_nombre: 'Platos fuertes' }), ['Extra queso', 'Sin cebolla', 'Para compartir']);
  assert.deepEqual(names({ categoria_nombre: 'Postres' }), ['Para compartir']);
  assert.equal(extraAppliesTo({ categoria: 'ENTRADAS' }, { categoria_nombre: 'Entradas' }), true);
});

test('lo más pedido hoy suma cantidades, ignora cancelados y productos fuera de venta', () => {
  const now = new Date(2026, 10, 16, 15);
  const orders = [
    { estado: 'PAGADO', created_at: '2026-11-16 10:00:00', items: [{ producto_id: 1, nombre: 'Café', cantidad: 2 }, { producto_id: 2, nombre: 'Agua', cantidad: 1 }] },
    { estado: 'ABIERTO', created_at: '2026-11-16 12:00:00', items: [{ producto_id: 2, nombre: 'Agua', cantidad: 4 }, { producto_id: 3, nombre: 'Viejo', cantidad: 9 }] },
    { estado: 'CANCELADO', created_at: '2026-11-16 12:00:00', items: [{ producto_id: 1, nombre: 'Café', cantidad: 50 }] },
    { estado: 'PAGADO', created_at: '2026-11-10 12:00:00', items: [{ producto_id: 1, nombre: 'Café', cantidad: 99 }] },
  ];
  const products = [{ id: 1, nombre: 'Café' }, { id: 2, nombre: 'Agua' }, { id: 3, nombre: 'Viejo', disponible: 0 }];
  assert.deepEqual(topProducts(orders, { now, products }).map(x => [x.producto_id, x.cantidad]), [[2, 5], [1, 2]]);
  assert.deepEqual(topProducts(orders.slice(3), { now }).map(x => x.producto_id), [1], 'sin pedidos de hoy usa lo cargado');
});

test('repetir toma la última ronda no cancelada', () => {
  const order = { rondas: [
    { id: 1, estado: 'ENTREGADO', created_at: '2026-11-16 10:00:00', items: [{ producto_id: 1, nombre: 'Café', cantidad: 1 }] },
    { id: 2, estado: 'LISTO', created_at: '2026-11-16 11:00:00', items: [{ producto_id: 2, nombre: 'Agua', cantidad: 2, notas: 'fría', modificadores: [{ nombre: 'Sin azucar', tipo: 'EXCLUSION', precio_extra: 0 }] }] },
    { id: 3, estado: 'CANCELADO', created_at: '2026-11-16 12:00:00', items: [{ producto_id: 9, cantidad: 1 }] },
  ] };
  assert.deepEqual(lastRoundItems(order), [{ producto_id: 2, nombre: 'Agua', cantidad: 2, notas: 'fría', modificadores: [{ nombre: 'Sin azucar', tipo: 'EXCLUSION', precio_extra: 0 }] }]);
  assert.deepEqual(lastRoundItems({}), []);
});

test('personalizar al añadir separa líneas distintas y respeta el stock', () => {
  const p = { id: 7, nombre: 'Café', precio: 1.5, stock_disponible: 5 };
  let r = addCustomizedProduct([], p, { cantidad: 2, modificadores: [{ nombre: 'Extra leche', precio: 0.3 }] }, 'a');
  r = addCustomizedProduct(r.items, p, { cantidad: 1 }, 'b');
  r = addCustomizedProduct(r.items, p, { cantidad: 1, modificadores: [{ nombre: 'Extra leche', precio: 0.3 }] }, 'c');
  assert.deepEqual(r.items.map(i => [i.localId, i.cantidad, i.modificadores.length]), [['a', 3, 1], ['b', 1, 0]]);
  assert.equal(addCustomizedProduct(r.items, p, { cantidad: 2 }).error, 'stock');
  assert.equal(unitPrice(p, r.items[0].modificadores), 1.8);
  const rep = addLines([], [{ producto_id: 7, nombre: 'Café', cantidad: 1 }, { producto_id: 99, nombre: 'Fuera', cantidad: 1 }], [p]);
  assert.equal(rep.items.length, 1); assert.deepEqual(rep.skipped, ['Fuera']);
});
