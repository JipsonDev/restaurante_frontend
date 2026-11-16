import test from 'node:test';
import assert from 'node:assert/strict';
import { tablePayload, tableKey } from '../src/utils/adminTables.mjs';
const current = { id: 1, numero: 3, capacidad: 4, ubicacion_id: 1, estado: 'Ocupada', activo: 1 };
test('table metadata patches never replay a stale state or unchanged metadata', () => {
  assert.deepEqual(tablePayload({ ...current, capacidad: '6' }, current, [current], []), { capacidad: 6 });
  assert.deepEqual(tablePayload(current, current, [current], []), {});
  assert.deepEqual(tablePayload({ ...current, ubicacion_id: null }, current, [current], []), { ubicacion_id: null });
});
test('table forms validate capacity, duplicate active numbers and inactive locations', () => {
  for (const value of ['', '0', '-1', '2.5', '3e2', '2147483648']) assert.throws(() => tablePayload({ ...current, capacidad: value }, current, [], []));
  assert.throws(() => tablePayload({ ...current, numero: 8 }, current, [{ id: 2, numero: 8, activo: 1 }], []));
  assert.throws(() => tablePayload({ ...current, ubicacion_id: 2 }, current, [], [{ id: 2, activo: 0 }]));
  assert.deepEqual(tablePayload({ ...current, numero: 8 }, current, [{ id: 2, numero: 8, activo: 0 }], []), { numero: 8 });
  assert.equal(tableKey({ activo: 0, estado: 'Libre' }), 'inactive');
});
