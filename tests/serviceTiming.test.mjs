import test from 'node:test';
import assert from 'node:assert/strict';
import * as timing from '../src/utils/serviceTiming.mjs';

const now = Date.parse('2026-10-18T01:10:00Z');
const sent = '2026-10-18T00:40:00Z';
const ready = '2026-10-18T01:03:00Z';
const round = (id, estado, extra = {}) => ({ id, estado, created_at: sent, ...extra });

test('a table waits for its oldest undelivered round across paid and unpaid accounts', () => {
  const summary = timing.serviceSummary({ originalOrders: [
    { id: 1, estado: 'PAGADO', rondas: [round(1, 'LISTO', { listo_at: ready })] },
    { id: 2, estado: 'PREPARANDO', rondas: [round(2, 'PREPARANDO', { created_at: '2026-10-18T00:55:00Z' }), round(3, 'ENTREGADO', { created_at: '2026-10-17T22:00:00Z' })] },
    { id: 3, estado: 'CANCELADO', rondas: [round(4, 'LISTO', { created_at: '2026-10-17T20:00:00Z' })] },
  ] }, now);
  assert.equal(summary.waitMinutes, 30);
  assert.equal(summary.readyMinutes, 7);
  assert.equal(summary.pendingCount, 2);
  assert.equal(summary.readyCount, 1);
});

test('each round uses its own sent and ready dates and delivery freezes both durations', () => {
  assert.equal(timing.roundTiming(round(1, 'PREPARANDO'), now).waitMinutes, 30);
  const delivered = round(2, 'ENTREGADO', { listo_at: ready, entregado_at: '2026-10-18T01:07:00Z' });
  for (const current of [now, now + 3600000]) {
    const result = timing.roundTiming(delivered, current);
    assert.equal(result.waitMinutes, 27);
    assert.equal(result.readyMinutes, 4);
  }
  const summary = timing.serviceSummary({ rondas: [delivered] }, now);
  assert.equal(summary.pendingCount, 0);
  assert.equal(summary.waitMinutes, null);
  assert.equal(summary.readyMinutes, null);
});

test('additional rounds do not inherit earlier account dates or delivered waiting time', () => {
  const order = { created_at: '2026-10-17T12:00:00Z', listo_at: sent, rondas: [
    round(1, 'ENTREGADO'), round(2, 'PENDIENTE', { created_at: '2026-10-18T01:08:00Z' }),
  ] };
  assert.equal(timing.serviceSummary(order, now).waitMinutes, 2);
  assert.equal(timing.roundTiming(timing.serviceRounds(order)[1], now).readyMinutes, null);
});

test('missing, invalid, reversed and future dates never invent a service time', () => {
  for (const value of [null, '', 'invalid', '2026-02-30T10:00:00Z', '2026-10-18T25:00:00Z']) assert.equal(timing.serviceDate(value), null);
  const result = timing.roundTiming(round(1, 'LISTO', { listo_at: null }), now);
  assert.equal(result.waitMinutes, 30);
  assert.equal(result.readyMinutes, null);
  assert.equal(timing.roundTiming(round(1, 'LISTO', { listo_at: '2026-10-18T01:30:00Z' }), now).readyMinutes, null);
  assert.equal(timing.roundTiming(round(1, 'LISTO', { listo_at: '2026-10-18T00:30:00Z' }), now).readyMinutes, null);
  const summary = timing.serviceSummary({ rondas: [round(1, 'PENDIENTE', { created_at: null }), round(2, 'PREPARANDO')] }, now);
  assert.equal(summary.waitMinutes, null);
  assert.equal(summary.unknownWaitCount, 1);
});

test('legacy accounts use only their stored dates, and cancelled rounds never count', () => {
  assert.equal(timing.serviceSummary({ id: 1, estado: 'LISTO', created_at: sent, listo_at: ready }, now).readyMinutes, 7);
  assert.equal(timing.serviceRounds({ estado: 'CANCELADO', rondas: [round(1, 'PENDIENTE')] }).length, 0);
  assert.equal(timing.serviceSummary({ rondas: [round(1, 'CANCELADO')] }, now).pendingCount, 0);
  assert.equal(timing.serviceRounds(null).length, 0);
});

test('duration labels distinguish a fresh send, hours, and waits spanning days', () => {
  assert.equal(timing.serviceDuration(0), 'Menos de 1 min');
  assert.equal(timing.serviceDuration(59), '59 min');
  assert.equal(timing.serviceDuration(65), '1 h 5 min');
  assert.equal(timing.serviceDuration(1502), '1 d 1 h 2 min');
  assert.equal(timing.serviceDuration(null), 'Sin hora registrada');
});

test('future completion dates are flagged as missing rather than frozen as a real delivery', () => {
  const result = timing.roundTiming(round(1, 'ENTREGADO', { listo_at: ready, entregado_at: '2026-10-18T01:30:00Z' }), now);
  assert.equal(result.deliveredAt, null);
  assert.equal(result.waitMinutes, null);
  assert.equal(result.readyMinutes, null);
  assert.equal(timing.roundTiming(round(2, 'LISTO', { listo_at: '2026-10-18T01:30:00Z' }), now).readyAt, null);
});
