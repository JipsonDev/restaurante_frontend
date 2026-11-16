import test from 'node:test';
import assert from 'node:assert/strict';
import { auditActionLabel, auditCustomer, auditGroup, auditStats, filterAuditRows } from '../src/utils/auditLogic.mjs';

const rows = [
  { id: 1, accion: 'caja.cobro_registrado', trabajador_id: 4, trabajador_nombre: 'Lucía', cliente_nombre: 'Ana Pérez', metadata: { monto: 18.5 }, created_at: '2026-09-15T10:00:00Z' },
  { id: 2, accion: 'pedido.creado', trabajador_id: 7, trabajador_nombre: 'Diego', mesero_nombre: 'Diego', pedido_id: 30, created_at: '2026-09-14T10:00:00Z' },
  { id: 3, accion: 'caja.pago_devuelto', trabajador_id: 1, trabajador_nombre: 'Admin', metadata: { monto: 4, motivo: 'Error' }, created_at: '2026-08-01T10:00:00Z' },
];

test('audit explains sales, customers and responsible users', () => {
  assert.equal(auditActionLabel(rows[0].accion), 'Venta cobrada');
  assert.equal(auditCustomer(rows[0]), 'Ana Pérez');
  assert.equal(auditGroup(rows[0]), 'VENTAS');
  assert.equal(auditGroup(rows[1]), 'PEDIDOS');
  assert.equal(auditGroup(rows[2]), 'REVERSOS');
});

test('audit filters by business context and date without losing accents', () => {
  const now = new Date('2026-09-15T18:00:00Z');
  assert.deepEqual(filterAuditRows(rows, { query: 'lucia', range: '30D', now }).map(row => row.id), [1]);
  assert.deepEqual(filterAuditRows(rows, { group: 'PEDIDOS', range: '7D', now }).map(row => row.id), [2]);
  assert.deepEqual(filterAuditRows(rows, { group: 'REVERSOS', range: '30D', now }), []);
});

test('audit totals only collected sales and counts distinct actors', () => {
  assert.deepEqual(auditStats(rows), { events: 3, sales: 18.5, users: 3, reversals: 1 });
});

