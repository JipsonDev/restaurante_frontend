import test from 'node:test';
import assert from 'node:assert/strict';
import { validHistoryDay, expressStage, filterExpressOrders } from '../src/utils/expressWorkspace.mjs';
test('history rejects incomplete dates and rolled-over calendar days before requesting data', () => {
  for (const day of ['2026-1', '2026-02-31', '2025-02-29', '2026-13-01', '']) assert.equal(validHistoryDay(day), false, day);
  assert.equal(validHistoryDay('2024-02-29'), true);
  assert.equal(validHistoryDay('2026-10-17'), true);
});
test('ready rounds remain visible on an Express with mixed preparation states', () => {
  const state = expressStage({ estado: 'PAGADO', estado_cocina: 'PREPARANDO', pendiente_entrega: true, rondas: [{ estado: 'PREPARANDO' }, { estado: 'LISTO' }] });
  assert.equal(state.canDeliver, true);
  assert.equal(state.kitchenLabel, 'Parte lista');
  assert.equal(state.group, 'ready');
});
test('partial payments show the remaining balance and never allow unpaid delivery', () => {
  const state = expressStage({ estado: 'LISTO', total: 20, abonado: 8, estado_cobro: 'PARCIAL' });
  assert.equal(state.balance, 12); assert.equal(state.canDeliver, false); assert.equal(state.group, 'payment');
  assert.equal(expressStage({ estado: 'ENTREGADO', total: 20 }).issue, true);
});
test('search, channel and operational filters work together without losing accents', () => {
  const orders = [{ id: 1, tipo: 'Delivery', cliente_nombre: 'José', estado: 'PAGADO', estado_cocina: 'LISTO' }, { id: 2, tipo: 'Para llevar', cliente_nombre: 'Ana', estado: 'PREPARANDO' }];
  assert.deepEqual(filterExpressOrders(orders, { query: 'jose', channel: 'Delivery', stage: 'ready' }).map(o => o.id), [1]);
  assert.deepEqual(filterExpressOrders(orders, { stage: 'payment' }).map(o => o.id), [2]);
});
test('kitchen filter includes unpaid preparation and mixed ready rounds', () => {
  const orders = [{ id: 1, estado: 'PREPARANDO', estado_cobro: 'PENDIENTE' }, { id: 2, estado: 'PAGADO', estado_cocina: 'PREPARANDO', rondas: [{ estado: 'LISTO' }, { estado: 'PREPARANDO' }] }];
  assert.deepEqual(filterExpressOrders(orders, { stage: 'preparing' }).map(o => o.id), [1, 2]);
});
