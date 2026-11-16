import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshServiceAlerts } from '../src/utils/serviceAlerts.mjs';

test('one grouped notice contains only newly claimed alerts from this snapshot', async () => {
  let requested;
  const items=[{id:1,ronda_id:8,pedido_id:2,tipo:'espera',minutos:22,limite:20,avisada:false},{id:2,ronda_id:9,pedido_id:3,tipo:'lista',minutos:8,limite:5,avisada:true}];
  const result=await refreshServiceAlerts({get:async()=>({limits:{enabled:true,espera:20,lista:5},items}),claim:async ids=>{requested=ids;return {ids:[1,99]};}});
  assert.deepEqual(requested,[1]);
  assert.deepEqual(result.newItems.map(item=>item.id),[1]);
  assert.equal(result.items.length,2);
});
test('disabled alerts never send a claim and malformed responses fail visibly',async()=>{
  const result=await refreshServiceAlerts({get:async()=>({limits:{enabled:false,espera:20,lista:5},items:[]}),claim:()=>{throw new Error('Unexpected claim');}});
  assert.deepEqual(result.newItems,[]);
  await assert.rejects(refreshServiceAlerts({get:async()=>({items:{}})}),/respuesta/);
});
test('a failed claim preserves the actionable list but does not fabricate a notice',async()=>{
  const result=await refreshServiceAlerts({get:async()=>({limits:{enabled:true,espera:20,lista:5},items:[{id:1,tipo:'lista',ronda_id:2,pedido_id:3,minutos:8,limite:5,avisada:false}]}),claim:async()=>{throw new Error('offline');}});
  assert.equal(result.items.length,1);
  assert.equal(result.newItems.length,0);
  assert.match(result.error,/confirmar/);
});
