// Express (para llevar y delivery) en dirección «Suave»: cada pedido es una tarjeta redondeada con
// el cliente, píldoras de cocina y cobro, y el total. Misma lógica que antes.
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ChefHat, CreditCard, RefreshCw, ShoppingBag, Truck } from 'lucide-react-native';
import ExpressHistory from './ExpressHistory';
import ExpressDraftList from './ExpressDraftList';
import { expressStage, filterExpressOrders } from '../utils/expressWorkspace.mjs';
import { ServiceWait } from './ServiceTiming';
import { serviceSummaryLabel } from '../utils/serviceTiming.mjs';
import { useTheme } from '../theme';
import { Appear, Button, Chip, EmptyState, Field, IconButton, Label, Num, Perforation, Press, Stamp, T, elevate, money, radius, space } from './waiter/comanda';

function ExpressRow({ order, wide, onOpen, now, alerts, colors, index }) {
  const { c } = useTheme();
  const state = expressStage(order);
  const delivery = order.tipo === 'Delivery';
  const detail = delivery ? [order.delivery_telefono, order.delivery_direccion].filter(Boolean).join(' · ') : order.cliente_dato;
  const items = (order.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const note = state.issue ? ['Se entregó sin cobrar todo: revisa el saldo en caja.', c.red]
    : state.ready && !state.paid ? ['Cocina lista · cobra antes de entregar.', c.amber]
    : state.canDeliver ? ['Pagado y listo para entregar.', c.green] : null;
  return <Appear delay={Math.min(index, 8) * 30}>
    <Press accessibilityRole="button" accessibilityLabel={`Abrir Express ${order.id}, ${order.cliente_nombre || 'Cliente'}, ${state.kitchenLabel}, ${state.paid ? 'pagado' : `saldo ${state.balance.toFixed(2)}`}, ${serviceSummaryLabel(order, now)}`}
      onPress={() => onOpen(order)} hapticKind="tap"
      style={[{ padding: space.lg, gap: space.sm, backgroundColor: c.surface, borderWidth: 2, borderColor: state.canDeliver ? c.greenDot : (c.isDark ? c.line : 'rgba(16,24,40,0.04)'), borderRadius: radius.xl }, elevate(c, 1)]} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: delivery ? c.skySoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          {delivery ? <Truck size={20} color={c.sky} /> : <ShoppingBag size={20} color={c.primaryText} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={17} weight="800" numberOfLines={1}>{order.cliente_nombre || 'Cliente sin nombre'}</T>
          <T size={14} color={c.muted}>#{order.id} · {delivery ? 'Delivery' : 'Para llevar'} · {items} {items === 1 ? 'artículo' : 'artículos'}</T>
        </View>
        <Num size={18} weight="800">{money(order.total)}</Num>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
        <Stamp color={state.ready ? c.green : c.muted} size={12}>{state.kitchenLabel}</Stamp>
        <Stamp color={state.paid ? c.green : state.issue ? c.red : c.amber} size={12}>{state.paid ? 'Pagado' : Number(order.abonado || 0) > 0 ? `Saldo ${money(state.balance)}` : 'Por cobrar'}</Stamp>
      </View>
      <ServiceWait order={order} now={now} colors={colors} compact alerts={alerts} />
      {note ? <View style={{ borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: note[1] === c.red ? c.redSoft : note[1] === c.amber ? c.amberSoft : c.greenSoft }}><T size={14} weight="700" color={note[1]}>{note[0]}</T></View> : null}
      {detail ? <T size={14} color={c.muted} numberOfLines={1}>{detail}</T> : null}
    </Press>
  </Appear>;
}

export default function WaiterExpress({ colors, width, orders, view, setView, drafts, openDraft, discardDraft, query, setQuery, channel, setChannel, stage, setStage, startOrder, openOrder, refresh, loading, loadError, now, alerts }) {
  const { c } = useTheme();
  const padding = width < 768 ? 12 : width >= 1024 ? 28 : 20;
  const wide = width >= 850;
  const counts = useMemo(() => orders.reduce((r, o) => { const s = expressStage(o); if (!s.paid) r.payment++; if (s.canDeliver) r.ready++; if (s.preparing) r.preparing++; return r; }, { payment: 0, ready: 0, preparing: 0 }), [orders]);
  const filtered = useMemo(() => filterExpressOrders(orders, { query, channel, stage }), [orders, query, channel, stage]);
  const draftCount = Object.keys(drafts.expressDrafts).length;
  const clear = () => { setQuery(''); setChannel('Todos'); setStage('all'); };
  return <View style={{ padding, paddingTop: space.lg, gap: space.lg, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ flex: 1 }}><T size={28} weight="800" accessibilityRole="header">Express</T><T size={15} color={c.muted}>Para llevar y delivery</T></View>
      <IconButton icon={RefreshCw} label="Actualizar Express" onPress={refresh} disabled={loading} />
    </View>
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button variant="outline" size="lg" icon={ShoppingBag} onPress={() => startOrder('Para llevar')} style={{ flex: 1 }} accessibilityLabel="Nuevo pedido para llevar">Para llevar</Button>
      <Button variant="outline" size="lg" icon={Truck} onPress={() => startOrder('Delivery')} style={{ flex: 1 }} accessibilityLabel="Nuevo pedido delivery">Delivery</Button>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {[['active', 'Activos', orders.length], ['drafts', 'Borradores', draftCount], ['history', 'Historial', null]].map(([key, label, count]) =>
        <Chip key={key} selected={view === key} onPress={() => setView(key)} count={count} accessibilityLabel={key === 'active' ? 'Express activos' : key === 'drafts' ? 'Borradores Express' : 'Historial Express por día'}>{label}</Chip>)}
    </ScrollView>
    {view === 'history' ? <ExpressHistory colors={colors} /> : view === 'drafts' ? <ExpressDraftList drafts={drafts} colors={colors} onOpen={openDraft} onDiscard={discardDraft} /> : <>
      {loadError ? <T accessibilityRole="alert" size={15} weight="600" color={c.red}>No se pudieron actualizar los pedidos. Toca actualizar para reintentar.</T> : null}
      <Field value={query} onChangeText={setQuery} placeholder="Buscar cliente, pedido, teléfono o dirección" accessibilityLabel="Buscar pedidos Express" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {[['all', 'Todos', orders.length], ['payment', 'Por cobrar', counts.payment], ['ready', 'Por entregar', counts.ready], ['preparing', 'En cocina', counts.preparing]].map(([key, label, n]) =>
          <Chip key={key} selected={stage === key} onPress={() => setStage(key)} count={n}>{label}</Chip>)}
        <View style={{ width: 1, backgroundColor: c.line, marginHorizontal: 4 }} />
        {[['Todos', 'Todo tipo'], ['Express', 'Para llevar'], ['Delivery', 'Delivery']].map(([key, label]) =>
          <Chip key={key} selected={channel === key} onPress={() => setChannel(key)}>{label}</Chip>)}
      </ScrollView>
      <T size={14} color={c.muted}>Para entregar: pago completo y cocina lista. Después pasa al historial.</T>
      {filtered.length ? <View style={{ gap: space.md, flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap' }}>
        {filtered.map((order, i) => <View key={order.id} style={wide ? { width: '48.8%' } : null}><ExpressRow order={order} wide={wide} onOpen={openOrder} now={now} alerts={alerts} colors={colors} index={i} /></View>)}
      </View>
        : <EmptyState icon={ShoppingBag} title={orders.length ? 'Nada con estos filtros' : 'Sin pedidos Express activos'}
          description={orders.length ? null : 'Crea un pedido para llevar o delivery para comenzar.'}
          action={orders.length ? <Button onPress={clear}>Quitar filtros</Button> : null} />}
    </>}
  </View>;
}
