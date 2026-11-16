import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, capacityError, findConflict, isLate, minutesUntil, nextByTable, reservationInputError,
  reservationPayload, suggestTables, toMinutes, transitionError,
} from '../src/utils/reservationLogic.mjs';

test('toMinutes acepta fecha local y rechaza fechas imposibles', () => {
  assert.equal(toMinutes('2026-11-16 19:30') - toMinutes('2026-11-16 19:00'), 30);
  assert.equal(toMinutes('2026-11-16T19:30:00') - toMinutes('2026-11-16 19:00'), 30);
  assert.equal(toMinutes('2026-02-31 19:00'), null);
  assert.equal(toMinutes('mañana'), null);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('payload normaliza y valida', () => {
  const p = reservationPayload({ cliente_nombre: '  Ana   Pérez ', telefono: ' ', personas: '4', fecha_hora: '2026-11-20T20:00', mesa_id: '' });
  assert.deepEqual(p, { cliente_nombre: 'Ana Pérez', telefono: null, personas: 4, fecha_hora: '2026-11-20 20:00', duracion_min: 90, mesa_id: null, notas: null });
  assert.throws(() => reservationPayload({ cliente_nombre: 'A', personas: 2, fecha_hora: '2026-11-20 20:00' }), /nombre/);
  assert.match(reservationInputError({ cliente_nombre: 'Ana', personas: 0, fecha_hora: '2026-11-20 20:00' }, { creating: true }), /personas/);
  assert.match(reservationInputError({ telefono: 'abc123' }), /teléfono/);
  assert.equal(reservationInputError({ telefono: '+593 99 123 4567' }), null);
  assert.match(reservationInputError({ duracion_min: 10 }), /duración/);
});

test('detecta choques solo en la misma mesa y con estados activos', () => {
  const existing = [
    { id: 1, mesa_id: 3, fecha_hora: '2026-11-20 19:00', duracion_min: 90, estado: 'CONFIRMADA' },
    { id: 2, mesa_id: 3, fecha_hora: '2026-11-20 22:00', duracion_min: 60, estado: 'CANCELADA' },
  ];
  assert.equal(findConflict({ mesa_id: 3, fecha_hora: '2026-11-20 20:00', duracion_min: 60 }, existing)?.id, 1);
  assert.equal(findConflict({ mesa_id: 3, fecha_hora: '2026-11-20 20:30', duracion_min: 60 }, existing), null, 'termina justo cuando empieza');
  assert.equal(findConflict({ mesa_id: 4, fecha_hora: '2026-11-20 19:30', duracion_min: 60 }, existing), null);
  assert.equal(findConflict({ mesa_id: 3, fecha_hora: '2026-11-20 22:15', duracion_min: 60 }, existing), null, 'la cancelada no bloquea');
  assert.equal(findConflict({ id: 1, mesa_id: 3, fecha_hora: '2026-11-20 19:15', duracion_min: 90 }, existing), null, 'no choca consigo misma');
  assert.equal(findConflict({ mesa_id: null, fecha_hora: '2026-11-20 19:15' }, existing), null);
});

test('capacidad, transiciones y sugerencias', () => {
  assert.match(capacityError(6, { numero: 2, capacidad: 4, activo: 1 }), /para 4/);
  assert.match(capacityError(2, { numero: 2, capacidad: 4, activo: 0 }), /inactiva/);
  assert.equal(capacityError(4, { numero: 2, capacidad: 4, activo: 1 }), null);
  assert.equal(transitionError('PENDIENTE', 'LLEGO'), null);
  assert.match(transitionError('LLEGO', 'LLEGO'), /ya está/);
  assert.match(transitionError('LLEGO', 'OTRO'), /no es válido/);
  const tables = [{ id: 1, numero: 1, capacidad: 6 }, { id: 2, numero: 2, capacidad: 4 }, { id: 3, numero: 3, capacidad: 2 }, { id: 4, numero: 4, capacidad: 4, activo: 0 }];
  const reservations = [{ id: 9, mesa_id: 2, fecha_hora: '2026-11-20 19:00', duracion_min: 90, estado: 'PENDIENTE' }];
  assert.deepEqual(suggestTables(tables, reservations, { personas: 3, fecha_hora: '2026-11-20 19:30', duracion_min: 90 }).map(t => t.id), [1]);
  assert.deepEqual(suggestTables(tables, reservations, { personas: 2, fecha_hora: '2026-11-20 21:00', duracion_min: 90 }).map(t => t.id), [3, 2, 1]);
});

test('retrasos y próxima reserva por mesa', () => {
  const r = { mesa_id: 5, fecha_hora: '2026-11-20 19:00', estado: 'CONFIRMADA' };
  assert.equal(isLate(r, '2026-11-20 19:10'), false);
  assert.equal(isLate(r, '2026-11-20 19:20'), true);
  assert.equal(isLate({ ...r, estado: 'LLEGO' }, '2026-11-20 19:20'), false);
  assert.equal(minutesUntil(r, '2026-11-20 18:15'), 45);
  const next = nextByTable([r, { ...r, fecha_hora: '2026-11-20 21:00' }, { ...r, mesa_id: 6, fecha_hora: '2026-11-21 13:00' }], '2026-11-20 18:00');
  assert.equal(next[5].fecha_hora, '2026-11-20 19:00');
  assert.equal(next[6], undefined, 'mañana no cuenta como próxima de hoy');
});
