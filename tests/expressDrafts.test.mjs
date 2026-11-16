import test from 'node:test';
import assert from 'node:assert/strict';
import * as drafts from '../src/utils/orderDrafts.mjs';
const a = 'express-draft:ana', b = 'express-draft:luis';
const item = { producto_id: 1, cantidad: 2, notas: 'Sin azúcar', modificadores: [{ nombre: 'Leche', precio_extra: 1 }] };
test('two customers retain separate items, notes, type and delivery details after reload', () => {
  let state = drafts.newExpressDraft(drafts.emptyDrafts(), a, 'Para llevar', '2026-10-17T12:00:00Z');
  state = drafts.patchExpressDraft(state, a, { expressInfo: { nombre: 'Ana' } });
  state = { ...state, carritos: { ...state.carritos, [a]: [item] }, orderNotes: { [a]: 'Todo junto' } };
  state = drafts.newExpressDraft(state, b, 'Delivery', '2026-10-17T12:01:00Z');
  state = drafts.patchExpressDraft(state, b, { expressInfo: { nombre: 'Luis', telefono: '099123', direccion: 'Calle 1', referencia: 'Puerta azul' } });
  const restored = drafts.parseDrafts(JSON.stringify(state));
  assert.deepEqual(restored.carritos[a], [item]); assert.deepEqual(restored.carritos[b], []);
  assert.equal(restored.expressDrafts[a].expressInfo.nombre, 'Ana');
  assert.equal(restored.expressDrafts[a].pickupType, 'Para llevar');
  assert.equal(restored.expressDrafts[b].expressInfo.direccion, 'Calle 1');
  assert.equal(restored.expressDrafts[b].pickupType, 'Delivery');
  assert.equal(restored.orderNotes[a], 'Todo junto');
});
test('legacy Express migrates deterministically and preserves its exact pending request', () => {
  const request = { request_id: 'same-request-id', tipo: 'Delivery', cliente_nombre: 'Ana', items: [item] };
  const legacy = { version: 1, carritos: { 'express-pickup': [item], 'express-45': [item], 7: [item] }, orderNotes: { 'express-pickup': 'Llamar antes' }, pending: { 'express-pickup': request }, pickupType: 'Delivery', expressInfo: { nombre: 'Ana', telefono: '123', direccion: 'Calle A' } };
  const state = drafts.parseDrafts(JSON.stringify(legacy));
  const keys = Object.keys(state.expressDrafts);
  assert.equal(keys.length, 1);
  assert.deepEqual(state.pending[keys[0]], request);
  assert.equal(state.expressDrafts[keys[0]].expressInfo.nombre, 'Ana');
  assert.equal(state.orderNotes[keys[0]], 'Llamar antes');
  assert.deepEqual(state.carritos['express-45'], [item]); assert.deepEqual(state.carritos[7], [item]);
  assert.deepEqual(drafts.parseDrafts(JSON.stringify(state)), state);
  assert.deepEqual(drafts.parseDrafts(JSON.stringify(legacy)), state);
});
test('pending delivery cannot be renamed, changed or discarded; another draft remains editable', () => {
  let state = drafts.newExpressDraft(drafts.newExpressDraft(drafts.emptyDrafts(), a, 'Delivery'), b, 'Para llevar');
  state.pending[a] = { request_id: 'retry-this-only', items: [item], cliente_nombre: 'Ana' };
  assert.equal(drafts.patchExpressDraft(state, a, { pickupType: 'Para llevar', expressInfo: { nombre: 'Wrong' } }), state);
  assert.throws(() => drafts.discardExpressDraft(state, a), /envío/i);
  const next = drafts.patchExpressDraft(state, b, { expressInfo: { nombre: 'Luis' } });
  assert.equal(next.expressDrafts[b].expressInfo.nombre, 'Luis');
  assert.deepEqual(next.pending[a], state.pending[a]);
});
test('completing one Express removes only that draft and leaves other customers intact', () => {
  let state = drafts.newExpressDraft(drafts.newExpressDraft(drafts.emptyDrafts(), a), b);
  state.carritos[a] = [item]; state.carritos[b] = [item];
  state.pending[a] = { request_id: 'a-id', items: [item] };
  state.pending[b] = { request_id: 'b-id', items: [item] };
  const next = drafts.completedDraft(state, a);
  assert.equal(next.expressDrafts[a], undefined); assert.equal(next.pending[a], undefined); assert.equal(next.carritos[a], undefined);
  assert.deepEqual(next.expressDrafts[b], state.expressDrafts[b]);
  assert.deepEqual(next.carritos[b], [item]); assert.deepEqual(next.pending[b], state.pending[b]);
  assert.ok(state.expressDrafts[a]);
});
test('blank drafts remain recoverable, cannot collide with existing keys, and can be discarded', () => {
  const state = drafts.newExpressDraft(drafts.emptyDrafts(), a);
  assert.ok(drafts.savedDraftKeys(state).includes(a));
  assert.throws(() => drafts.newExpressDraft(state, a), /existe/i);
  assert.equal(drafts.savedDraftKeys(drafts.discardExpressDraft(state, a)).length, 0);
});
test('invalid persisted customer data is rejected without silently replacing it', () => {
  const state = drafts.newExpressDraft(drafts.emptyDrafts(), a);
  state.expressDrafts[a].expressInfo.nombre = { broken: true };
  assert.throws(() => drafts.parseDrafts(JSON.stringify(state)), /cliente/i);
});
test('migration displays the frozen customer when a legacy request is pending', () => {
  const state = drafts.parseDrafts(JSON.stringify({ version: 1, carritos: {}, orderNotes: {}, pending: { 'express-pickup': { request_id: 'frozen', items: [item], tipo: 'Delivery', cliente_nombre: 'Confirmado', delivery_direccion: 'Dirección enviada' } }, pickupType: 'Para llevar', expressInfo: { nombre: 'Otro nombre', direccion: 'Otra dirección' } }));
  const meta = Object.values(state.expressDrafts)[0];
  assert.equal(meta.expressInfo.nombre, 'Confirmado');
  assert.equal(meta.expressInfo.direccion, 'Dirección enviada');
  assert.equal(meta.pickupType, 'Delivery');
});
