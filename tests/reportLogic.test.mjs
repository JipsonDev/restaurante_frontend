import assert from 'node:assert/strict';
import test from 'node:test';
import { bestHour, completeTimeline, percentage } from '../src/utils/reportLogic.mjs';

test('report timeline fills days without sales and keeps real values', () => {
  const rows = [{ fecha: '2026-09-13', ventas: '12.50', pedidos: '2' }, { fecha: '2026-09-15', ventas: 30, pedidos: 1 }];
  assert.deepEqual(completeTimeline(rows, 3, new Date('2026-09-15T12:00:00')), [
    { fecha: '2026-09-13', ventas: 12.5, pedidos: 2 },
    { fecha: '2026-09-14', ventas: 0, pedidos: 0 },
    { fecha: '2026-09-15', ventas: 30, pedidos: 1 },
  ]);
});

test('report percentages are bounded and peak hour uses collected total', () => {
  assert.equal(percentage(25, 100), 25);
  assert.equal(percentage(10, 0), 0);
  assert.equal(percentage(140, 100), 100);
  assert.equal(bestHour([{ hora: 9, total: 15 }, { hora: 13, total: 42 }]).hora, 13);
  assert.equal(bestHour([]), null);
});
