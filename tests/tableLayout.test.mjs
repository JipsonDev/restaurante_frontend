import test from 'node:test';
import assert from 'node:assert/strict';
import { tableCapacity, tableLayout } from '../src/utils/tableLayout.mjs';

test('table seating preserves configured capacity, including odd and large tables', () => {
  for (let capacity = 1; capacity <= 100; capacity++) {
    const layout = tableLayout(String(capacity));
    assert.equal(layout.seats.length + layout.overflow, capacity);
    assert.ok(layout.seats.length <= 16);
    assert.equal(new Set(layout.seats.map(seat => `${seat.x},${seat.y}`)).size, layout.seats.length);
    for (const seat of layout.seats) {
      assert.ok(seat.x >= 8 && seat.x <= layout.viewWidth - 8);
      assert.ok(seat.y >= 8 && seat.y <= layout.viewHeight - 8);
    }
  }
});

test('unknown or invalid capacity does not invent chairs', () => {
  for (const capacity of [null, undefined, '', 0, -1, 2.5, 'invalid', Infinity]) {
    assert.equal(tableCapacity(capacity), null);
    assert.equal(tableLayout(capacity).seats.length, 0);
  }
});
