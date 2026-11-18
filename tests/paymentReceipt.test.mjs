import test from 'node:test';
import assert from 'node:assert/strict';
import { savedPaymentText } from '../src/utils/paymentReceipt.mjs';
import { combineAccounts } from '../src/utils/accountLogic.mjs';
test('saved receipt distinguishes this payment from the complete account and preserves original identity',()=>{
  const snapshot={version:1,created_at:'2026-06-10T12:00:00Z',comprobante_numero:'TCK-001',pedido:{id:1,items:[{nombre:'Cafe',cantidad:1,precio:10}]},totales:{subtotal:10,tax:0,service:1,total:11},monto:5,abonado_anterior:2,saldo_pendiente:4,desglose:[{metodo:'Efectivo',monto:2},{metodo:'Tarjeta',monto:3}],efectivo_recibido:5,cambio:3};
  const text=savedPaymentText(snapshot,{estado:'ANULADO',motivo_anulacion:'Error de metodo'});
  assert.match(text,/COMPROBANTE DE ABONO/);assert.match(text,/TCK-001/);assert.match(text,/COBRADO EN ESTE COMPROBANTE +\$5.00/);assert.match(text,/Saldo al emitir +\$4.00/);assert.match(text,/Cambio +\$3.00/);assert.ok(text.split('\n').every(l=>l.length<=42));assert.doesNotMatch(text,/Morena/i);assert.match(text,/ESTADO: ANULADO/);assert.match(text,/Error de metodo/);
});
test('grouped pending accounts subtract advances without losing the original item totals',()=>{
  const combined=combineAccounts([{id:1,estado:'LISTO',total:11,abonado:4,saldo_pendiente:7,items:[]},{id:2,estado:'PENDIENTE',total:5,items:[]}]);
  assert.equal(combined.total,16);assert.equal(combined.abonado,4);assert.equal(combined.saldo_pendiente,12);assert.equal(combined.estado_cobro,'PARCIAL');
});
