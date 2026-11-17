import test from 'node:test';
import assert from 'node:assert/strict';
import { allDayItems, isCriticalNote, kitchenBoard, shortDuration, stageMinutes, ticketUrgency, waitMinutes } from '../src/utils/kitchenLogic.mjs';

const now = new Date('2026-11-16T20:00:00').getTime();
const round = (id, estado, created, extra = {}) => ({ id, estado, created_at: created, items: [{ id: id * 10, nombre: 'Seco de pollo', producto_id: 39, cantidad: 2 }], ...extra });

test('urgency follows the configured limit', () => {
  assert.equal(ticketUrgency(5, 20), 'ok');
  assert.equal(ticketUrgency(12, 20), 'warn');
  assert.equal(ticketUrgency(20, 20), 'late');
  assert.equal(ticketUrgency(4, 6), 'warn');
});

test('stage and wait minutes use the right timestamps', () => {
  const r = round(1, 'PREPARANDO', '2026-11-16 19:40:00', { preparando_at: '2026-11-16 19:52:00' });
  assert.equal(waitMinutes(r, now), 20);
  assert.equal(stageMinutes(r, now), 8);
  assert.equal(stageMinutes({ ...r, estado: 'LISTO', listo_at: '2026-11-16 19:58:30' }, now), 1);
});

test('short duration is readable', () => {
  assert.equal(shortDuration(0), 'ahora');
  assert.equal(shortDuration(8), '8 min');
  assert.equal(shortDuration(65), '1 h 05');
});

test('board groups by column, oldest first, and skips empty rounds', () => {
  const b = kitchenBoard([
    round(1, 'PENDIENTE', '2026-11-16 19:50:00'), round(2, 'PENDIENTE', '2026-11-16 19:40:00'),
    round(3, 'LISTO', '2026-11-16 19:30:00'), round(4, 'PAGADO', '2026-11-16 18:00:00'),
    { id: 5, estado: 'PENDIENTE', created_at: '2026-11-16 19:00:00', items: [] },
  ]);
  assert.deepEqual(b.PENDIENTE.map(r => r.id), [2, 1]);
  assert.deepEqual(b.LISTO.map(r => r.id), [3]);
  assert.deepEqual(b.ENTREGADO.map(r => r.id), [4]);
});

test('all-day totals join the same dish across tables and keep notes apart', () => {
  const rows = allDayItems([
    round(1, 'PENDIENTE', '2026-11-16 19:50:00', { mesa_numero: 5 }),
    round(2, 'PREPARANDO', '2026-11-16 19:40:00', { mesa_numero: 7 }),
    { ...round(3, 'PENDIENTE', '2026-11-16 19:45:00', { mesa_numero: 8 }), items: [{ nombre: 'Seco de pollo', producto_id: 39, cantidad: 1, notas: 'Sin cebolla' }] },
    round(4, 'LISTO', '2026-11-16 19:30:00', { mesa_numero: 9 }),
  ]);
  assert.equal(rows[0].cantidad, 4);
  assert.equal(rows[0].nuevas, 2);
  assert.deepEqual(rows[0].destinos.map(d => d.nombre), ['Mesa 5', 'Mesa 7']);
  assert.equal(rows[1].notas, 'Sin cebolla');
});

test('critical notes are detected', () => {
  assert.ok(isCriticalNote('Uno sin maní (alergia)'));
  assert.ok(isCriticalNote('celíaco'));
  assert.ok(!isCriticalNote('Bien cocido'));
});
