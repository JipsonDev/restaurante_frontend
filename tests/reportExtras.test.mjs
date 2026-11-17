import test from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, rangeError, rangeTimeline, reportCsv, weekdayTotals } from '../src/utils/reportLogic.mjs';

test('rangos: este mes, mes pasado y validación', () => {
  assert.deepEqual(monthRange('2026-11-17'), { desde: '2026-11-01', hasta: '2026-11-17' });
  assert.deepEqual(monthRange('2026-11-17', -1), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(monthRange('2026-01-10', -1), { desde: '2025-12-01', hasta: '2025-12-31' });
  assert.equal(rangeError('2026-11-01', '2026-11-17', '2026-11-17'), null);
  assert.match(rangeError('2026-11-1', '2026-11-17', '2026-11-17'), /AAAA-MM-DD/);
  assert.match(rangeError('2026-11-10', '2026-11-01', '2026-11-17'), /anterior/);
  assert.match(rangeError('2026-11-10', '2026-11-18', '2026-11-17'), /hoy/);
  assert.match(rangeError('2025-01-01', '2026-11-17', '2026-11-17'), /año/);
});

test('línea de tiempo del rango rellena los días sin ventas', () => {
  const t = rangeTimeline([{ fecha: '2026-11-02', ventas: '10.5', pedidos: 2 }], '2026-11-01', '2026-11-03');
  assert.deepEqual(t, [{ fecha: '2026-11-01', ventas: 0, pedidos: 0 }, { fecha: '2026-11-02', ventas: 10.5, pedidos: 2 }, { fecha: '2026-11-03', ventas: 0, pedidos: 0 }]);
  assert.deepEqual(rangeTimeline([], '2026-11-03', '2026-11-01'), []);
});

test('ventas por día de la semana con promedio', () => {
  const w = weekdayTotals([{ fecha: '2026-11-16', ventas: 100, pedidos: 4 }, { fecha: '2026-11-09', ventas: 50, pedidos: 2 }, { fecha: '2026-11-15', ventas: 30, pedidos: 1 }]);
  assert.deepEqual(w[0], { nombre: 'Lun', total: 150, pedidos: 6, dias: 2, promedio: 75 });
  assert.equal(w[6].nombre, 'Dom'); assert.equal(w[6].total, 30);
  assert.equal(w[2].total, 0);
});

test('exportación CSV para Excel', () => {
  const csv = reportCsv({ period: { from: '2026-11-01', to: '2026-11-17' }, summary: { net_sales: 1234.5, paid_orders: 30, average_ticket: 41.15, tips: 20 },
    timeline: [{ fecha: '2026-11-01', ventas: 10, pedidos: 1 }], hours: [{ hora: 9, total: 10, pedidos: 1 }],
    waiters: [{ nombre: 'María; "la jefa"', cuentas: 3, total: 100, ticket: 33.33, propinas: 5 }], products: [{ nombre: 'Café', categoria: 'Bebidas', unidades: 4, total: 6 }], methods: [{ nombre: 'Efectivo', total: 10, transacciones: 1 }] });
  assert.ok(csv.startsWith('﻿Reporte de ventas;2026-11-01 a 2026-11-17'));
  assert.match(csv, /Ventas netas;1234,50/);
  assert.match(csv, /"María; ""la jefa""";3;100,00;33,33;5,00/);
  assert.match(csv, /09:00;10,00;1/);
  assert.match(csv, /Café;Bebidas;4;6,00/);
});
