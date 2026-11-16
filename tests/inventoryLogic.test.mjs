import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryStock, inventoryPayload, inventoryMovement } from '../src/utils/inventoryLogic.mjs';

test('inventory alerts use unreserved stock and distinguish shortages', () => {
  assert.deepEqual(inventoryStock({ stock: 8, stock_reservado: 10, stock_minimo: 2 }), {
    physical: 8, reserved: 10, available: 0, minimum: 2, shortage: 2, status: 'empty',
  });
  assert.equal(inventoryStock({ stock: 8, stock_reservado: 6, stock_minimo: 2 }).status, 'low');
  assert.equal(inventoryStock({ stock: 0.8, stock_reservado: 0.6, stock_minimo: 0.2 }).status, 'low');
});
test('editing inventory metadata never overwrites stock and keeps quantity precision', () => {
  const form = { nombre: ' Café ', categoria: '', proveedor: '', unidad: 'kg', stock: '99', stock_minimo: '0,125', costo_unitario: '2,50' };
  assert.equal(inventoryPayload(form, true).stock, undefined);
  assert.equal(inventoryPayload(form).stock_minimo, 0.125);
  assert.throws(() => inventoryPayload({ ...form, stock: '-1' }));
});
test('movements distinguish absolute counts, reject reserved withdrawals and allow replenishment', () => {
  const item = { stock: 8, stock_reservado: 6 };
  const move = (tipo, cantidad) => ({ tipo, cantidad, motivo: '' });
  assert.equal(inventoryMovement(item, move('Entrada', '0,125')).next, 8.125);
  assert.equal(inventoryMovement(item, move('Ajuste', '7')).next, 7);
  assert.throws(() => inventoryMovement(item, move('Salida', '3')));
  assert.throws(() => inventoryMovement(item, move('Entrada', '0')));
  assert.equal(inventoryMovement({ stock: 8, stock_reservado: 10 }, move('Entrada', '1')).next, 9);
  assert.equal(inventoryMovement({ stock: 2 }, move('Ajuste', '0')).next, 0);
});
