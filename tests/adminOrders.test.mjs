import test from 'node:test';
import assert from 'node:assert/strict';
import { ongoingOrder, preparationState, orderBalance, nextRoundAction, orderDestination, orderMatches } from '../src/utils/adminOrders.mjs';
const paid = {id:1,estado:'PAGADO',tipo:'Para llevar',mesa_id:null,total:10,abonado:10,rondas:[{id:2,estado:'LISTO'}],created_at:'2026-09-13T12:00:00'};
test('paid food remains in active admin orders until delivery',()=>{
 assert.equal(ongoingOrder(paid),true);assert.equal(preparationState(paid),'LISTO');assert.equal(orderBalance(paid),0);
 assert.equal(ongoingOrder({...paid,rondas:[{estado:'ENTREGADO'}]}),false);
 assert.equal(ongoingOrder({...paid,estado:'CANCELADO'}),false);
});
test('admin actions advance individual rounds and enforce prepaid Express delivery',()=>{
 assert.equal(nextRoundAction({...paid,estado:'LISTO',abonado:0},paid.rondas[0]),null);
 assert.equal(nextRoundAction(paid,paid.rondas[0]).next,'ENTREGADO');
 assert.equal(nextRoundAction({...paid,estado:'LISTO',tipo:'Mesa',mesa_id:4},paid.rondas[0]).next,'ENTREGADO');
 assert.equal(nextRoundAction(paid,{estado:'PENDIENTE'}).next,'PREPARANDO');
 assert.equal(nextRoundAction({...paid,estado:'CANCELADO'},{estado:'PENDIENTE'}),null);
});
test('filters keep older open orders, distinguish channels and subtract partial payments',()=>{
 const order={...paid,estado:'ENTREGADO',abonado:3,total:10,cliente_nombre:'José',rondas:[{estado:'ENTREGADO'}]};
 assert.equal(orderBalance(order),7);assert.equal(orderDestination(order),'Para llevar');
 assert.equal(orderMatches(order,{scope:'active',state:'unpaid',query:'jose'}),true);
 assert.equal(orderMatches(order,{scope:'today'},new Date('2026-09-14T12:00:00')),false);
 assert.equal(orderMatches(order,{channel:'Mesa'}),false);
 assert.equal(orderMatches({...order,estado:'CANCELADO'},{scope:'active'}),false);
});
test('mixed rounds match each kitchen filter without treating a cancelled order as ready',()=>{
 const mixed={...paid,estado:'PREPARANDO',rondas:[{estado:'PREPARANDO'},{estado:'LISTO'}]};
 assert.equal(preparationState(mixed),'PREPARANDO');
 assert.equal(orderMatches(mixed,{state:'LISTO'}),true);
 assert.equal(orderMatches(mixed,{state:'PREPARANDO'}),true);
 assert.equal(orderMatches({...mixed,estado:'CANCELADO'},{scope:'all',state:'LISTO'}),false);
});
