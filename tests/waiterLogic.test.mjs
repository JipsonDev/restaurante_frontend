import test from 'node:test';
import assert from 'node:assert/strict';
import { readyOrders, runExclusive } from '../src/utils/waiterLogic.mjs';

test('express pickup and delivery require readiness and full payment', () => {
  for (const tipo of ['Para llevar', 'Delivery']) {
    const pedido = { id: 1, tipo, estado: 'LISTO' };
    assert.deepEqual(readyOrders(pedido), []);
    const paid = { ...pedido, estado: 'PAGADO', estado_cocina: 'LISTO', estado_cobro: 'PAGADO' };
    assert.deepEqual(readyOrders(paid), [paid]);
    assert.deepEqual(readyOrders({ ...pedido, abonado: 5, estado_cobro: 'PARCIAL' }), []);
  }
  assert.deepEqual(readyOrders(null), []);
});

test('delivers only the ready orders on a table with mixed states', () => {
  const listo = { id: 3, estado: 'LISTO' };
  assert.deepEqual(readyOrders({ originalOrders: [
    { id: 1, estado: 'PREPARANDO' }, { id: 2, estado: 'ENTREGADO' }, listo,
  ] }), [listo]);
});

test('double taps create only one in-flight submission and allow later rounds', async () => {
  const lock = { current: false };
  let finish;
  let calls = 0;
  const action = () => { calls += 1; return new Promise((resolve) => { finish = resolve; }); };
  const first = runExclusive(lock, action);
  await runExclusive(lock, action);
  assert.equal(calls, 1);
  finish('ok');
  assert.equal(await first, 'ok');
  await runExclusive(lock, () => { calls += 1; });
  assert.equal(calls, 2);
});

test('a failed submission releases the lock for retry', async () => {
  const lock = { current: false };
  await assert.rejects(runExclusive(lock, () => { throw new Error('offline'); }), /offline/);
  assert.equal(lock.current, false);
  assert.equal(await runExclusive(lock, () => 'retried'), 'retried');
});
