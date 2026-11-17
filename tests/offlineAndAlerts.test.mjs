import test from 'node:test';
import assert from 'node:assert/strict';
import { packSnapshot, parseSnapshot, queuedByTable, snapshotAge } from '../src/utils/offlineSnapshot.mjs';
import { dueReminders } from '../src/utils/waiterAlertLogic.mjs';
import { qrMatrix, qrSvg } from '../src/utils/qr.mjs';

test('la copia local se guarda y se recupera solo si es válida y reciente', () => {
  const now = 1_800_000_000_000;
  const raw = packSnapshot({ mesas: [{ id: 1 }], productos: [{ id: 2 }], pedidos: [], extras: [], config: { servicio_porcentaje: '10' } }, now);
  const back = parseSnapshot(raw, now + 5 * 60000);
  assert.equal(back.mesas.length, 1); assert.equal(back.config.servicio_porcentaje, '10'); assert.equal(back.at, now);
  assert.equal(parseSnapshot(raw, now + 19 * 3600000), null); // demasiado vieja
  assert.equal(parseSnapshot('{"v":1', now), null);
  assert.equal(parseSnapshot(JSON.stringify({ v: 99, at: now, mesas: [1], productos: [], pedidos: [], extras: [] }), now), null);
  assert.equal(parseSnapshot(JSON.stringify({ v: 1, at: now, mesas: [], productos: [], pedidos: [], extras: [] }), now), null);
  assert.equal(parseSnapshot(null, now), null);
  assert.throws(() => packSnapshot({ mesas: null, productos: [], pedidos: [] }));
  assert.equal(snapshotAge(now, now + 20000), 'hace un momento');
  assert.equal(snapshotAge(now, now + 5 * 60000), 'hace 5 min');
  assert.equal(snapshotAge(now, now + 125 * 60000), 'hace 2 h');
});

test('mesas con rondas sin enviar', () => {
  assert.deepEqual(queuedByTable({ a: { mesa_id: 4, items: [] }, b: { mesa_id: 4, items: [] }, c: { mesa_id: null, tipo: 'Para llevar', items: [] }, d: null }), { 4: 2 });
  assert.deepEqual(queuedByTable(undefined), {});
});

test('recordatorio de ronda lista: a los 3 min, cada 3 min, máximo 3 veces', () => {
  const t0 = 1_800_000_000_000, min = 60000;
  const entry = minutes => [{ round: { id: 9 }, pedido: { id: 1 }, minutes }];
  let r = dueReminders(entry(1), {}, t0);
  assert.equal(r.due.length, 0);
  r = dueReminders(entry(3), r.state, t0 + 2 * min);
  assert.equal(r.due.length, 1); assert.equal(r.state[9].count, 1);
  r = dueReminders(entry(4), r.state, t0 + 3 * min);
  assert.equal(r.due.length, 0); // aún no pasan 3 min desde el último aviso
  r = dueReminders(entry(6), r.state, t0 + 5 * min);
  assert.equal(r.due.length, 1);
  r = dueReminders(entry(9), r.state, t0 + 8 * min);
  assert.equal(r.due.length, 1); assert.equal(r.state[9].count, 3);
  r = dueReminders(entry(12), r.state, t0 + 11 * min);
  assert.equal(r.due.length, 0); // ya avisó 3 veces
  assert.deepEqual(dueReminders([], r.state, t0).state, {}); // entregada: se olvida
});

test('código QR: tamaño por versión, esquinas de posición y resultado estable', () => {
  const m = qrMatrix('https://restaurante-frontend.vercel.app/?menu=12-e02219f0a9');
  assert.equal(m.length, 33); // versión 4
  const finder = (x0, y0) => [0, 1, 2, 3, 4, 5, 6].every(i => m[y0][x0 + i] && m[y0 + 6][x0 + i] && m[y0 + i][x0] && m[y0 + i][x0 + 6]) && m[y0 + 3][x0 + 3] && !m[y0 + 1][x0 + 1];
  assert.ok(finder(0, 0) && finder(26, 0) && finder(0, 26));
  assert.ok(!m[7].slice(0, 8).some(Boolean)); // borde claro del patrón
  for (let i = 8; i < 25; i++) assert.equal(m[6][i], i % 2 === 0); // línea de sincronía
  assert.deepEqual(qrMatrix('HOLA'), qrMatrix('HOLA'));
  assert.equal(qrMatrix('HOLA').length, 21);
  assert.equal(qrMatrix('z'.repeat(200)).length, 57);
  assert.throws(() => qrMatrix('z'.repeat(400)), /largo/);
  assert.match(qrSvg('HOLA', { size: 120 }), /^<svg[^>]+width="120"[\s\S]+<path d="M/);
});
