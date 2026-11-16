import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowUpRight, ChefHat, CreditCard, Plus, RefreshCw, ShoppingBag, Truck } from 'lucide-react-native';
import { WText, WButton, WSearch, WFilters } from './WaiterUI';
import ExpressHistory from './ExpressHistory';
import ExpressDraftList from './ExpressDraftList';
import { expressStage, filterExpressOrders } from '../utils/expressWorkspace.mjs';
import { ServiceWait } from './ServiceTiming';
import { serviceSummaryLabel } from '../utils/serviceTiming.mjs';

function Status({ colors: c, text, color, Icon }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon size={13} color={color} /><WText style={{ color, fontSize: 11, flexShrink: 1, lineHeight: 16 }}>{text}</WText></View>;
}
function ExpressRow({ order, colors: c, wide, onOpen, now, alerts }) {
  const state = expressStage(order);
  const detail = order.tipo === 'Delivery' ? [order.delivery_telefono, order.delivery_direccion].filter(Boolean).join(' · ') : order.cliente_dato;
  const Kitchen = <Status colors={c} Icon={ChefHat} color={state.ready ? c.success : c.muted} text={state.kitchenLabel} />;
  const Payment = <Status colors={c} Icon={CreditCard} color={state.paid ? c.success : state.issue ? c.danger : c.warning} text={state.paid ? 'Pagado' : Number(order.abonado || 0) > 0 ? `Saldo $${state.balance.toFixed(2)}` : 'Por cobrar'} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir Express ${order.id}, ${order.cliente_nombre || 'Cliente'}, ${state.kitchenLabel}, ${state.paid ? 'pagado' : `saldo ${state.balance.toFixed(2)}`}, ${serviceSummaryLabel(order, now)}`} onPress={() => onOpen(order)} style={({ pressed, hovered }) => ({ padding: 14, backgroundColor: pressed || hovered ? c.elevated : c.surface, borderBottomWidth: 1, borderBottomColor: c.line, gap: 9 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: wide ? 2 : 1, minWidth: 0, gap: 4 }}><WText numberOfLines={2} style={{ color: c.ink, fontSize: 14 }}>{order.cliente_nombre || 'Cliente sin nombre'}</WText><View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>{order.tipo === 'Delivery' ? <Truck size={12} color={c.muted} /> : <ShoppingBag size={12} color={c.muted} />}<WText style={{ color: c.muted, fontSize: 11 }}>#{order.id} · {order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar'}</WText></View></View>
      {wide ? <><View style={{ flex: 1, minWidth: 0 }}>{Kitchen}</View><View style={{ flex: 1, minWidth: 0 }}>{Payment}</View></> : null}
      <View style={{ width: wide ? 100 : 80, alignItems: 'flex-end', gap: 4 }}><WText style={{ color: c.ink, fontSize: 16, fontVariant: ['tabular-nums'] }}>${Number(order.total || 0).toFixed(2)}</WText><WText style={{ color: c.muted, fontSize: 10 }}>{(order.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0)} artículos</WText></View><ArrowUpRight size={16} color={c.muted} />
    </View>
    {!wide ? <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>{Kitchen}{Payment}</View> : null}
    <ServiceWait order={order} now={now} colors={c} compact alerts={alerts} />
    {state.issue ? <WText style={{ color: c.danger, fontSize: 11 }}>Entrega registrada con cobro pendiente. Revisa el saldo en caja.</WText> : state.ready && !state.paid ? <WText style={{ color: c.warning, fontSize: 11 }}>Cocina lista · registra el pago antes de entregar.</WText> : state.canDeliver ? <WText style={{ color: c.success, fontSize: 11 }}>Pagado y listo para entregar.</WText> : null}
    {detail ? <WText numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{detail}</WText> : null}
  </Pressable>;
}
export default function WaiterExpress({ colors: c, width, orders, view, setView, drafts, openDraft, discardDraft, query, setQuery, channel, setChannel, stage, setStage, startOrder, openOrder, refresh, loading, loadError, now, alerts }) {
  const padding = width < 768 ? 16 : width >= 1024 ? 32 : 24;
  const wide = width >= 850;
  const counts = useMemo(() => orders.reduce((result, order) => { const state = expressStage(order); if (!state.paid) result.payment++; if (state.canDeliver) result.ready++; if (state.preparing) result.preparing++; return result; }, { payment: 0, ready: 0, preparing: 0 }), [orders]);
  const filtered = useMemo(() => filterExpressOrders(orders, { query, channel, stage }), [orders, query, channel, stage]);
  const clear = () => { setQuery(''); setChannel('Todos'); setStage('all'); };
  return <View style={{ padding, paddingTop: 20, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}><WText style={{ color: c.ink, fontSize: 25 }}>Express</WText><WText style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Pedidos para llevar y delivery</WText></View><WButton colors={c} label="Actualizar Express" Icon={RefreshCw} onPress={refresh} disabled={loading} /></View>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><WButton colors={c} primary Icon={Plus} label="Nuevo pedido para llevar" onPress={() => startOrder('Para llevar')} style={{ flex: 1 }}>Para llevar</WButton><WButton colors={c} Icon={Truck} label="Nuevo pedido delivery" onPress={() => startOrder('Delivery')} style={{ flex: 1 }}>Delivery</WButton></View>
    <ScrollView horizontal style={{ flexGrow: 0, borderBottomWidth: 1, borderColor: c.line }} contentContainerStyle={{ gap: 20 }} showsHorizontalScrollIndicator={false}>{[['active', `Activos · ${orders.length}`], ['drafts', `Borradores · ${Object.keys(drafts.expressDrafts).length}`], ['history', 'Historial por día']].map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === 'active' ? 'Express activos' : key === 'drafts' ? 'Borradores Express' : 'Historial Express por día'} accessibilityState={{ selected: view === key }} onPress={() => setView(key)} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: view === key ? c.brand : 'transparent' }}><WText style={{ color: view === key ? c.ink : c.muted, fontSize: 13 }}>{label}</WText></Pressable>)}</ScrollView>
    {view === 'history' ? <ExpressHistory colors={c} /> : view === 'drafts' ? <ExpressDraftList drafts={drafts} colors={c} onOpen={openDraft} onDiscard={discardDraft} /> : <>
      {loadError ? <WText accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>No se pudieron actualizar los pedidos. Pulsa actualizar para reintentar.</WText> : null}
      <WText style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}>Para entregar: pago completo y cocina lista. Después pasa al historial.</WText>
      <WFilters colors={c} label="Estado de Express" value={stage} onChange={setStage} items={[[ 'all', 'Todos', orders.length ], ['payment', 'Por cobrar', counts.payment], ['ready', 'Por entregar', counts.ready], ['preparing', 'En cocina', counts.preparing]]} />
      <View style={{ gap: 10, marginTop: -10 }}><WSearch colors={c} label="Buscar pedidos Express" placeholder="Cliente, pedido, teléfono o dirección" value={query} onChangeText={setQuery} /><WFilters colors={c} label="Tipo de pedido Express" items={[[ 'Todos', 'Todos los tipos' ], ['Express', 'Para llevar'], ['Delivery', 'Solo delivery']]} value={channel} onChange={setChannel} /></View>
      {filtered.length ? <View style={{ borderWidth: 1, borderColor: c.line, borderBottomWidth: 0, borderRadius: 6, overflow: 'hidden' }}>{wide ? <View style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 12, backgroundColor: c.field, borderBottomWidth: 1, borderBottomColor: c.line }}><WText style={{ flex: 2, color: c.muted, fontSize: 11 }}>Cliente / pedido</WText><WText style={{ flex: 1, color: c.muted, fontSize: 11 }}>Cocina</WText><WText style={{ flex: 1, color: c.muted, fontSize: 11 }}>Cobro</WText><WText style={{ width: 128, color: c.muted, fontSize: 11, textAlign: 'right' }}>Total</WText></View> : null}{filtered.map(order => <ExpressRow key={order.id} order={order} colors={c} wide={wide} onOpen={openOrder} now={now} alerts={alerts} />)}</View> : <View style={{ paddingVertical: 30, alignItems: 'center', gap: 12 }}><ShoppingBag size={28} color={c.muted} /><WText style={{ color: c.ink, fontSize: 14 }}>{orders.length ? 'No hay pedidos con estos filtros' : 'No hay pedidos Express activos'}</WText>{orders.length ? <WButton colors={c} onPress={clear}>Limpiar filtros de Express</WButton> : <WText style={{ color: c.muted, fontSize: 12 }}>Crea un pedido para llevar o delivery para comenzar.</WText>}</View>}
    </>}
  </View>;
}
