import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, nextDelay, queueSummary, roundTotal, priceDiffs } from '../src/utils/sendQueue.mjs';

test('classifies send errors so offline rounds are kept and real rejections are not retried', () => {
  assert.equal(classifyError(new Error('Network Error')), 'offline');
  assert.equal(classifyError({ code: 'ECONNABORTED' }), 'offline');
  assert.equal(classifyError({ response: { status: 409, data: { error: 'Cambio el precio de Café. Actualiza el pedido.' } } }), 'changed');
  assert.equal(classifyError({ response: { status: 409, data: { error: 'Cambio el porcentaje de servicio' } } }), 'changed');
  assert.equal(classifyError({ response: { status: 409, data: { error: 'La mesa no existe o esta inactiva.' } } }), 'rejected');
  assert.equal(classifyError({ response: { status: 409, data: { code: 'REQUEST_CONFLICT' } } }), 'retry');
  assert.equal(classifyError({ response: { status: 503 } }), 'retry');
  assert.equal(classifyError({ response: { status: 429 } }), 'retry');
});
test('backoff grows from 2s and caps at 60s', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(a => nextDelay(a)), [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
  assert.equal(nextDelay(0, 1), 2500);
  assert.equal(nextDelay(-3), 2000);
});
test('queue summary labels tables and express orders oldest first', () => {
  const pending = {
    5: { mesa_id: 5, total: 12.5, items: [{ cantidad: 2 }, { cantidad: 1 }], prepared_at: '2026-11-16T10:05:00Z' },
    'express-draft:a': { tipo: 'DELIVERY', cliente_nombre: 'Ana', total: 8, items: [{ cantidad: 1 }], prepared_at: '2026-11-16T10:00:00Z' },
    broken: { total: 3 },
  };
  const out = queueSummary(pending, [{ id: 5, numero: 7 }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].label, 'Delivery · Ana');
  assert.deepEqual(out[1], { key: '5', label: 'Mesa 7', items: 3, total: 12.5, since: '2026-11-16T10:05:00Z' });
});
test('round total includes paid modifiers and price diffs flag changed or missing products', () => {
  assert.equal(roundTotal([{ precio: 2.5, cantidad: 2, modificadores: [{ precio: 0.5 }] }, { precio: 1.1, cantidad: 1 }]), 7.1);
  const diffs = priceDiffs([{ producto_id: 1, nombre: 'Café', precio: 2 }, { producto_id: 2, nombre: 'Té', precio: 1 }, { producto_id: 9, nombre: 'X', precio: 4 }], [{ id: 1, precio: 2.25 }, { id: 2, precio: 1 }]);
  assert.deepEqual(diffs, [{ name: 'Café', before: 2, after: 2.25 }, { name: 'X', before: 4, after: null }]);
});
import { reusableExpressDraft } from '../src/utils/sendQueue.mjs';
test('reuses the newest blank Express draft and ignores drafts with items, data or pending sends', () => {
  const info = { nombre: '', dato: '', telefono: '', direccion: '', referencia: '' };
  const state = {
    expressDrafts: { a: { expressInfo: info, createdAt: '1' }, b: { expressInfo: info, createdAt: '3' }, c: { expressInfo: { ...info, nombre: 'Ana' }, createdAt: '4' }, d: { expressInfo: info, createdAt: '5' }, e: { expressInfo: info, createdAt: '6' } },
    carritos: { d: [{ id: 1 }] }, pending: { e: { items: [] } }, orderNotes: {},
  };
  assert.equal(reusableExpressDraft(state), 'b');
  assert.equal(reusableExpressDraft({ expressDrafts: {} }), null);
});
