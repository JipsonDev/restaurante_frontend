import test from 'node:test';
import assert from 'node:assert/strict';
import { adminNumber } from '../src/utils/adminNumbers.mjs';
test('admin accepts decimal comma without silently rounding recipe quantities', () => {
  assert.equal(adminNumber('1,25', 'Precio'), 1.25);
  assert.equal(adminNumber('0.125', 'Receta', 3), 0.125);
  assert.equal(adminNumber('0', 'Stock', 0), 0);
  for (const value of ['', ' ', null, '-1', 'abc', 'Infinity', '1,2,3', '0.001']) assert.throws(() => adminNumber(value, 'Precio'));
  assert.throws(() => adminNumber('1.5', 'Unidades', 0));
  assert.throws(() => adminNumber('0.0001', 'Receta', 3));
});
