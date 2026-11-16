import test from 'node:test';
import assert from 'node:assert/strict';
import { kitchenColumn, pendingSignature, createRefreshQueue } from '../src/utils/kitchenLogic.mjs';

test('unfinished orders from yesterday stay on their kitchen board', () => {
  for (const estado of ['PENDIENTE', 'PREPARANDO', 'LISTO']) {
    assert.equal(kitchenColumn({ estado, created_at: '2020-01-01', items: [{ cantidad: 1 }] }), estado);
  }
  for (const estado of ['ENTREGADO', 'PAGADO', 'CANCELADO']) {
    assert.equal(kitchenColumn({ estado, items: [{ cantidad: 1 }] }), 'ENTREGADO');
  }
  assert.equal(kitchenColumn({ estado: 'PENDIENTE', items: [] }), null);
});

test('an additional round alerts even when the same order was already pending', () => {
  const before = { id: 1, items: [{ id: 1, cantidad: 1 }] };
  const after = { ...before, items: [...before.items, { id: 2, cantidad: 1 }] };
  assert.notEqual(pendingSignature(before), pendingSignature(after));
  assert.equal(pendingSignature(after), pendingSignature({ ...after, items: [...after.items].reverse() }));
});

test('events arriving during a refresh trigger a follow-up and cannot apply stale data', async () => {
  const resolvers = [];
  const applied = [];
  const queue = createRefreshQueue(() => new Promise((resolve) => resolvers.push(resolve)), (value) => applied.push(value), assert.fail);
  const first = queue.refresh();
  queue.refresh();
  queue.refresh();
  resolvers[0]('old');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resolvers.length, 2);
  assert.deepEqual(applied, []);
  resolvers[1]('new');
  await first;
  assert.deepEqual(applied, ['new']);
});

test('a stopped refresh never updates an unmounted kitchen', async () => {
  let resolve;
  const queue = createRefreshQueue(() => new Promise((done) => { resolve = done; }), assert.fail, assert.fail);
  const pending = queue.refresh();
  queue.stop();
  resolve([]);
  await pending;
});
