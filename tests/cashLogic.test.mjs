import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptTotals } from '../src/utils/cashLogic.mjs';
import { receiptTotals as backendTotals } from '../../restaurante-backend/services/cashLogic.js';

test('cashier and server agree on receipts, including zero IVA, extras and stored service', () => {
  for (const percent of [0,15,'15,5']) for (const total of [10,11,11.33]) {
    const order = { total, items: [{ precio: 4, cantidad: 2, modificadores: [{ precio_extra: 1 }] }] };
    const receipt = receiptTotals(order,percent);
    assert.deepEqual(receipt,backendTotals(order,percent));
    assert.equal(Math.round((receipt.subtotal + receipt.tax + receipt.service) * 100),Math.round(total*100));
    if (percent === 0) assert.equal(receipt.tax,0);
  }
});
