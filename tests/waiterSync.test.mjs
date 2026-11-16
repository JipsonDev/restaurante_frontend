import test from 'node:test';
import assert from 'node:assert/strict';
import { draftDeliveryStatus, connectionState, trackingEvents, confirmedOrder } from '../src/utils/waiterSync.mjs';

test('a pending request remains unconfirmed even if the connection is healthy or storage failed',()=>{
  assert.equal(draftDeliveryStatus({pending:true,hasDraft:true}).key,'pending');
  assert.equal(draftDeliveryStatus({pending:true,error:'Disk full',hasDraft:true}).key,'pending');
  assert.equal(draftDeliveryStatus({pending:true,sending:true,hasDraft:true}).key,'sending');
});
test('optimistic changes cannot be labelled as saved before storage succeeds',()=>{
  assert.equal(draftDeliveryStatus({hasDraft:true,saving:true}).key,'saving');
  assert.equal(draftDeliveryStatus({hasDraft:true,error:'Disk full'}).key,'unsaved');
  assert.equal(draftDeliveryStatus({hasDraft:true}).key,'local');
  assert.equal(draftDeliveryStatus({order:{id:3}}).key,'sent');
  assert.equal(draftDeliveryStatus({}).key,'empty');
});
test('a live socket alone does not claim that data was synchronized',()=>{
  assert.equal(connectionState({connection:'connected'}).key,'never');
  assert.equal(connectionState({connection:'connected',lastSyncAt:1000}).key,'live');
  assert.equal(connectionState({connection:'connected',lastSyncAt:1000,error:true}).key,'error');
  assert.equal(connectionState({connection:'disconnected',lastSyncAt:1000}).key,'disconnected');
  assert.equal(connectionState({connection:'connected',lastSyncAt:1000,syncing:true}).key,'syncing');
});
test('tracking merges grouped accounts chronologically, without duplicates or private audit metadata',()=>{
  const data=[{pedido_id:1,events:[{id:'a',tipo:'pedido_tomado',at:'2026-10-17T10:00:00Z',actor:{id:2,nombre:'Ana'}}]}, {pedido_id:2,events:[{id:'b',tipo:'cobro',at:'2026-10-17T09:00:00Z',actor:{id:3,nombre:'Caja'},monto:5}]}];
  const events=trackingEvents([...data,data[0]]);
  assert.equal(events.length,2);assert.equal(events[0].pedido_id,2);assert.equal(events[1].actor.nombre,'Ana');
  assert.throws(()=>trackingEvents([{pedido_id:1,events:{}}]));
  assert.throws(()=>trackingEvents([{pedido_id:1,events:[{id:'a'}]}]));
});

test('a malformed or unrelated acknowledgement cannot erase a pending request',()=>{
  const good={id:3,mesa_id:2,items:[],rondas:[{id:9}]};
  assert.equal(confirmedOrder({pedido:good},{mesa_id:2}),good);
  for(const response of [{}, {id:3}, {pedido:{...good,id:null}}, {pedido:{...good,rondas:[]}}])assert.throws(()=>confirmedOrder(response,{mesa_id:2}));
  assert.throws(()=>confirmedOrder({pedido:good},{mesa_id:1}));
  assert.throws(()=>confirmedOrder({pedido:good},{pedido_id:4,mesa_id:2}));
});
