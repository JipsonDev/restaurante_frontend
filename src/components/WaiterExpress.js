// Express (para llevar y delivery) en dirección «Suave»: cada pedido es una tarjeta redondeada con
// el cliente, píldoras de cocina y cobro, y el total. Misma lógica que antes.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { CheckCheck, ChefHat, CreditCard, Plus, ShoppingBag, Truck } from 'lucide-react-native';
import ExpressHistory from './ExpressHistory';
import ExpressDraftList from './ExpressDraftList';
import { expressStage, filterExpressOrders } from '../utils/expressWorkspace.mjs';
import { serviceSummaryLabel } from '../utils/serviceTiming.mjs';
import { useTheme } from '../theme';
import { Appear, Button, Chip, EmptyState, Field, Num, Press, T, elevate, money, radius, space } from './waiter/kit';

// Un solo estado por pedido, del más urgente al más tranquilo.
function expressStatus(state, order, c) {
  if (state.issue) return { text: 'Entregado sin cobrar', color: c.red, soft: c.redSoft, icon: CreditCard };
  if (state.canDeliver) return { text: 'Listo para entregar', color: c.green, soft: c.greenSoft, icon: CheckCheck };
  if (state.ready) return { text: 'Listo · falta cobrar', color: c.amber, soft: c.amberSoft, icon: CreditCard };
  if (state.preparing) return { text: state.paid ? 'En cocina · pagado' : 'En cocina', color: c.sky, soft: c.skySoft, icon: ChefHat };
  return { text: state.paid ? 'Pagado' : 'Por cobrar', color: state.paid ? c.green : c.amber, soft: state.paid ? c.greenSoft : c.amberSoft, icon: CreditCard };
}

function ExpressRow({ order, onOpen, now, index }) {
  const { c } = useTheme();
  const state = expressStage(order);
  const delivery = order.tipo === 'Delivery';
  const items = (order.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const status = expressStatus(state, order, c);
  const StatusIcon = status.icon;
  const detail = delivery ? order.delivery_direccion : order.cliente_dato;
  return <Appear delay={Math.min(index, 8) * 30}>
    <Press accessibilityRole="button" accessibilityLabel={`Abrir pedido ${order.id} de ${order.cliente_nombre || 'cliente'}, ${status.text}, ${money(order.total)}, ${serviceSummaryLabel(order, now)}`}
      onPress={() => onOpen(order)} hapticKind="tap"
      style={{ padding: space.md, gap: space.md, backgroundColor: state.canDeliver ? c.greenSoft : c.surfaceAlt, borderRadius: radius.lg }} hoverStyle={{ backgroundColor: c.soft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          {delivery ? <Truck size={22} color={c.text} /> : <ShoppingBag size={22} color={c.text} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="700" numberOfLines={1}>{order.cliente_nombre || 'Cliente sin nombre'}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <StatusIcon size={14} color={status.color} strokeWidth={2.4} />
            <T size={14} weight="600" color={status.color} numberOfLines={1}>{status.text}</T>
          </View>
        </View>
        <Num size={17} weight="700">{money(order.total)}</Num>
      </View>
    </Press>
  </Appear>;
}

export default function WaiterExpress({ width, orders, view, setView, drafts, openDraft, discardDraft, query, setQuery, stage, setStage, setChannel, startOrder, openOrder, refresh, loading, loadError, now, colors }) {
  const { c } = useTheme();
  const padding = width < 768 ? 12 : width >= 1024 ? 28 : 20;
  const wide = width >= 850;
  const counts = useMemo(() => orders.reduce((r, o) => { const s = expressStage(o); if (!s.paid) r.payment++; if (s.canDeliver) r.ready++; if (s.preparing) r.preparing++; return r; }, { payment: 0, ready: 0, preparing: 0 }), [orders]);
  const filtered = useMemo(() => filterExpressOrders(orders, { query, channel: 'Todos', stage }), [orders, query, stage]);
  const draftCount = Object.keys(drafts.expressDrafts).length;
  const clear = () => { setQuery(''); setChannel?.('Todos'); setStage('all'); };
  const stages = [['all', 'Todos', orders.length], ['ready', 'Para entregar', counts.ready], ['payment', 'Por cobrar', counts.payment], ['preparing', 'En cocina', counts.preparing]];
  return <View style={{ padding, paddingTop: space.md, gap: space.lg, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
    <View>
      <T size={width < 600 ? 26 : 30} weight="700" accessibilityRole="header">Express</T>
      <T size={14} color={c.muted}>Para llevar y delivery</T>
    </View>
    {/* Empezar un pedido: el botón principal (para llevar) y delivery al lado. */}
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button variant="primary" size="lg" icon={Plus} onPress={() => startOrder('Para llevar')} accessibilityLabel="Nuevo pedido para llevar" style={{ flex: 1 }}>Para llevar</Button>
      <Button variant="outline" size="lg" icon={Truck} onPress={() => startOrder('Delivery')} accessibilityLabel="Nuevo pedido delivery" style={{ flex: 1 }}>Delivery</Button>
    </View>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {[['active', 'En curso', orders.length], ['drafts', 'Guardados', draftCount], ['history', 'Historial', null]].map(([key, label, count]) =>
        <Chip key={key} selected={view === key} onPress={() => setView(key)} count={count} accessibilityLabel={key === 'active' ? 'Express en curso' : key === 'drafts' ? 'Pedidos Express guardados' : 'Historial Express por día'}>{label}</Chip>)}
    </View>
    {view === 'history' ? <ExpressHistory colors={colors} /> : view === 'drafts' ? <ExpressDraftList drafts={drafts} onOpen={openDraft} onDiscard={discardDraft} /> : <>
      {loadError ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T size={14} weight="600" color={c.red} style={{ flex: 1 }}>No se pudieron actualizar los pedidos.</T><Button size="sm" onPress={refresh} loading={loading}>Reintentar</Button>
      </View> : null}
      {orders.length > 4 ? <Field value={query} onChangeText={setQuery} placeholder="Buscar cliente, teléfono o dirección" accessibilityLabel="Buscar pedidos Express" /> : null}
      {orders.length > 1 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {stages.filter(([key, , n]) => key === 'all' || key === stage || n > 0).map(([key, label, n]) =>
          <Chip key={key} selected={stage === key} onPress={() => setStage(key)} count={n}>{label}</Chip>)}
      </View> : null}
      {filtered.length ? <View style={{ gap: space.md, flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap' }}>
        {filtered.map((order, i) => <View key={order.id} style={wide ? { width: '48.8%' } : null}><ExpressRow order={order} onOpen={openOrder} now={now} index={i} /></View>)}
      </View>
        : <EmptyState icon={ShoppingBag} title={orders.length ? 'Nada con estos filtros' : 'Sin pedidos Express en curso'}
          description={orders.length ? null : 'Toca «Para llevar» o «Delivery» para empezar uno.'}
          action={orders.length ? <Button onPress={clear}>Quitar filtros</Button> : null} />}
    </>}
  </View>;
}
