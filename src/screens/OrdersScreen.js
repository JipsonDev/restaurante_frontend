import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ArrowDownUp, Check, ChefHat, ChevronDown, Coffee, ReceiptText, ShoppingBag, Truck, X } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuModal, MenuNotice } from '../components/MenuUI';
import { ActionMenu, Badge, Button, Card, CardSection, DataTable, EmptyState, FadeIn, IconButton, PageHeader, SearchField, Segmented, Skeleton, Tabs, ago, money, radius, space, type, useToast } from '../components/admin/ui';
import { ORDER_PAY, ORDER_PREP } from '../components/admin/states';
import { ORDER_LABELS as labels, orderChannel, orderDestination, preparationState, paymentState, orderBalance, ongoingOrder, nextRoundAction, orderDate, isOrderToday, orderMatches } from '../utils/adminOrders.mjs';

const dateText = value => orderDate(value)?.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || 'Fecha no disponible';
const errorText = error => error?.response?.data?.message || error?.message || 'No se pudo completar la operación.';
// Preparación y cobro al estilo admin: insignia con círculo de avance.
const PREP = Object.fromEntries(Object.entries(ORDER_PREP).map(([k, [label, tone, progress]]) => [k, [tone, progress, label]]));
const PAY = Object.fromEntries(Object.entries(ORDER_PAY).map(([k, [label, tone, progress]]) => [k, [tone, progress, label]]));
const ROUND = { PENDIENTE: 'warning', PREPARANDO: 'warning', LISTO: 'info', ENTREGADO: 'neutral', CANCELADO: 'neutral' };
const STATES = [['all', 'Cualquier estado'], ['PENDIENTE', 'Pendientes'], ['PREPARANDO', 'En preparación'], ['LISTO', 'Listos'], ['ENTREGADO', 'Entregados'], ['unpaid', 'Por cobrar'], ['CANCELADO', 'Cancelados']];
const CHANNEL_ICON = { Mesa: Coffee, Delivery: Truck, 'Para llevar': ShoppingBag };
const shortDate = value => { const d = orderDate(value); if (!d) return '—'; const t = new Date(); const same = d.toDateString() === t.toDateString();
  return same ? `Hoy, ${d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

function PrepStatus({ order }) { const s = preparationState(order); const [tone, progress, label] = PREP[s] || ['neutral', null, labels[s] || s]; return <Badge tone={tone} progress={progress}>{label}</Badge>; }
function PayStatus({ order }) { const s = paymentState(order); const [tone, progress, label] = PAY[s] || ['neutral', null, labels[s] || s]; return <Badge tone={tone} progress={progress}>{label}</Badge>; }

function ItemLines({ items = [] }) {
  const { c } = useTheme();
  return <View style={{ gap: space.md }}>{items.map((item, index) => <View key={item.id || index} style={{ flexDirection: 'row', gap: space.md }}>
    <Text style={[type.body, type.num, { color: c.muted, width: 28 }]}>{item.cantidad}×</Text>
    <View style={{ flex: 1 }}>
      <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{item.nombre}</Text>
      {(item.modificadores || []).map((mod, i) => <Text key={i} style={[type.micro, { color: c.muted, marginTop: 2 }]}>{mod.nombre}{Number(mod.precio_extra || 0) ? ` · +${money(mod.precio_extra)}` : ''}</Text>)}
      {!!item.notas && <Text style={[type.body, { color: c.amber, marginTop: 2 }]}>Nota: {item.notas}</Text>}
    </View>
    <Text style={[type.body, type.num, { color: c.text }]}>{money(Number(item.precio || 0) * Number(item.cantidad || 0))}</Text>
  </View>)}</View>;
}

// Métricas del día en una sola tarjeta, separadas por líneas verticales.
function Strip({ items, phone }) {
  const { c } = useTheme();
  return <Card padded={false} style={{ marginBottom: space.lg }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((it, i) => <View key={it.label} style={{ flexGrow: 1, flexBasis: phone ? '50%' : 0, paddingVertical: space.md, paddingHorizontal: space.lg, borderLeftWidth: i && !(phone && i % 2 === 0) ? 1 : 0, borderTopWidth: phone && i > 1 ? 1 : 0, borderColor: c.line }}>
        <Text style={[type.body, { color: c.muted }]}>{it.label}</Text>
        <Text style={[type.figure, { fontSize: 20, lineHeight: 28, color: c.text }]}>{it.value}</Text>
      </View>)}
    </View>
  </Card>;
}

export default function OrdersScreen({ onNavigate }) {
  const { c } = useTheme(); const { width } = useWindowDimensions(); const phone = width < 760;
  const toast = useToast();
  const { pedidos, loading, refreshAll } = useAdmin();
  const [scope, setScope] = useState('active'), [channel, setChannel] = useState('all'), [state, setState] = useState('all'), [query, setQuery] = useState(''), [oldest, setOldest] = useState(true);
  const [selectedId, setSelectedId] = useState(null), [confirmation, setConfirmation] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(new Date());
  const busyRef = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const selected = pedidos.find(p => Number(p.id) === Number(selectedId));
  const active = pedidos.filter(ongoingOrder), today = pedidos.filter(p => isOrderToday(p, now));
  const matches = useMemo(() => pedidos.filter(p => orderMatches(p, { scope, channel, state, query }, now)).sort((a, b) => (oldest ? 1 : -1) * ((orderDate(a.created_at)?.getTime() || 0) - (orderDate(b.created_at)?.getTime() || 0) || Number(a.id) - Number(b.id))), [pedidos, scope, channel, state, query, oldest, now]);
  const close = () => { if (busyRef.current) return; if (confirmation) setConfirmation(null); else setSelectedId(null); setError(''); };
  function askRound(round) { const action = nextRoundAction(selected, round); if (!action || busyRef.current) return; setError(''); setConfirmation({ title: `${action.label} · Ronda #${round.id}`, text: `Pedido #${selected.id}. Se actualizará únicamente esta ronda.`, label: action.label, path: `/pedidos/${selected.id}/rondas/${round.id}`, body: { estado: action.next } }); }
  function askCancel() { setError(''); setConfirmation({ title: `Cancelar pedido #${selected.id}`, text: 'Se cancelará la cuenta completa con sus rondas. Esta acción está sujeta a las validaciones de pagos e inventario.', label: 'Cancelar pedido', danger: true, path: `/pedidos/${selected.id}`, body: { estado: 'CANCELADO', expected_item_ids: (selected.items || []).map(i => i.id) } }); }
  async function execute() { if (busyRef.current || !confirmation) return; busyRef.current = true; setBusy(true); setError(''); try { await axios.put(`${BASE_URL}${confirmation.path}`, confirmation.body); await refreshAll(); setConfirmation(null); toast.show(confirmation.danger ? 'Pedido cancelado.' : 'Pedido actualizado.'); } catch (e) { setError(errorText(e)); } finally { busyRef.current = false; setBusy(false); } }
  const openDetail = order => { setSelectedId(order.id); setConfirmation(null); setError(''); };
  const goCash = () => { if (busyRef.current) return; setSelectedId(null); onNavigate('caja'); };
  const resetFilters = () => { setScope('active'); setState('all'); setChannel('all'); setQuery(''); };

  const destination = o => { const Icon = CHANNEL_ICON[orderChannel(o)] || ShoppingBag; return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}><Icon size={14} color={c.muted} /><Text numberOfLines={1} style={[type.body, { color: c.text, flexShrink: 1 }]}>{orderDestination(o)}</Text></View>; };
  const columns = phone ? [
    { key: 'p', label: 'Pedido', flex: 1, render: o => <View style={{ gap: 4, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Text style={[type.body, type.num, { color: c.text, fontWeight: '700' }]}>#{o.id}</Text>{destination(o)}</View>
      <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}><PrepStatus order={o} /><PayStatus order={o} /></View></View> },
    { key: 't', label: 'Total', width: 92, align: 'right', render: o => <View style={{ alignItems: 'flex-end' }}><Text style={[type.body, type.num, { color: c.text }]}>{money(o.total)}</Text><Text style={[type.small, { color: c.muted }]}>{ago(o.created_at)}</Text></View> },
  ] : [
    { key: 'id', label: 'Pedido', width: 72, sortValue: o => Number(o.id), render: o => <Text style={[type.body, type.num, { color: c.text, fontWeight: '700' }]}>#{o.id}</Text> },
    { key: 'f', label: 'Fecha', width: 130, sortValue: o => orderDate(o.created_at)?.getTime() || 0, render: o => <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{shortDate(o.created_at)}</Text> },
    { key: 'd', label: 'Destino', flex: 1.1, sortValue: o => orderDestination(o), render: destination },
    { key: 'r', label: 'Responsable', flex: 1.2, render: o => <Text numberOfLines={1} style={[type.body, { color: o.cliente_nombre || o.mesero_nombre ? c.text : c.muted }]}>{o.cliente_nombre || o.mesero_nombre || 'Sin responsable'}</Text> },
    { key: 'prep', label: 'Preparación', width: 140, render: o => <PrepStatus order={o} /> },
    { key: 'pay', label: 'Cobro', width: 140, render: o => <PayStatus order={o} /> },
    { key: 'total', label: 'Total', width: 100, sortValue: o => Number(o.total), align: 'right', render: o => <Text style={[type.body, type.num, { color: c.text }]}>{money(o.total)}</Text> },
  ];
  const stateLabel = (STATES.find(([k]) => k === state) || STATES[0])[1];
  const toolbar = <View>
    <View style={{ paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xs }}>
      <Tabs value={scope} onChange={setScope} options={[{ value: 'active', label: 'En curso', count: active.length }, { value: 'today', label: 'Creados hoy', count: today.length }, { value: 'all', label: 'Todos' }]} />
    </View>
    <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm }}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por número, mesa, cliente, mesero o producto" style={phone ? null : { flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Segmented value={channel} onChange={setChannel} accessibilityLabel="Canal" options={[{ value: 'all', label: 'Todos' }, { value: 'Mesa', label: 'Salón' }, { value: 'Para llevar', label: 'Llevar' }, { value: 'Delivery', label: 'Delivery' }]} style={phone ? { order: 3 } : null} />
        <ActionMenu label="Filtrar por estado" actions={STATES.map(([key, label]) => ({ label: key === state ? `✓ ${label}` : label, onPress: () => { setState(key); if (key === 'CANCELADO' && scope === 'active') setScope('all'); } }))}
          trigger={open => <Button size="sm" iconRight={ChevronDown} onPress={open}>{state === 'all' ? 'Estado' : stateLabel}</Button>} />
        <IconButton icon={ArrowDownUp} label={oldest ? 'Orden: primero los más antiguos' : 'Orden: primero los más recientes'} onPress={() => setOldest(v => !v)} />
      </View>
    </View>
  </View>;

  return <>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Pedidos" actions={phone ? null : <Button onPress={() => onNavigate('caja')}>Ir a Caja</Button>} />
      <Strip phone={phone} items={[
        { label: 'En curso', value: active.length },
        { label: 'En cocina', value: active.filter(p => ['PENDIENTE', 'PREPARANDO'].includes(preparationState(p))).length },
        { label: 'Rondas listas', value: active.filter(p => p.rondas?.some(r => r.estado === 'LISTO')).length },
        { label: 'Saldo por cobrar', value: money(pedidos.reduce((sum, p) => sum + orderBalance(p), 0)) },
      ]} />
      {loading && !pedidos.length ? <Card><View style={{ gap: space.sm }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={36} radius={8} />)}</View></Card>
        : <DataTable selectedKey={selectedId} columns={columns} rows={matches} onRowPress={openDetail} pageSize={25} toolbar={toolbar}
          empty={<EmptyState icon={ReceiptText} title="Ningún pedido coincide" description="Prueba con otro filtro o busca por número de mesa." action={<Button onPress={resetFilters}>Restablecer filtros</Button>} />} />}
      <Text style={[type.body, { color: c.muted, marginTop: space.md, textAlign: 'center' }]}>{matches.length} {matches.length === 1 ? 'pedido' : 'pedidos'} · Los cobros de días anteriores están en el historial de Caja.</Text>
    </ScrollView>

    <MenuModal visible={selectedId !== null} title={confirmation?.title || (selected ? `${orderDestination(selected)} · #${selected.id}` : `Pedido #${selectedId}`)} subtitle={confirmation?.text || (selected ? `${selected.mesero_nombre || 'Sin responsable'}${selected.cliente_nombre ? ` · ${selected.cliente_nombre}` : ''} · ${dateText(selected.created_at)}` : 'Este pedido ya no está en la lista actual.')}
      busy={busy} close={close} maxWidth={confirmation ? 480 : 720}
      footer={confirmation ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}><MenuButton disabled={busy} onPress={close}>Volver</MenuButton><MenuButton primary={!confirmation.danger} danger={confirmation.danger} busy={busy} onPress={execute}>{confirmation.label}</MenuButton></View>
        : selected && orderBalance(selected) > 0 && selected.estado !== 'CANCELADO' ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <Text style={[type.small, { color: c.muted }]}>Saldo pendiente <Text style={[type.num, { color: c.text, fontWeight: '700' }]}>{money(orderBalance(selected))}</Text></Text>
          <MenuButton primary onPress={goCash}>Cobrar en Caja</MenuButton></View> : null}>
      {confirmation ? (error ? <MenuNotice danger>{error}</MenuNotice> : null) : selected ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: c.line, borderRadius: radius.lg }}>
          {[['Preparación', <PrepStatus order={selected} />], ['Cobro', <PayStatus order={selected} />], ['Canal', <Text style={[type.body, { color: c.text }]}>{orderChannel(selected)}</Text>], ['Saldo', <Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{money(orderBalance(selected))}</Text>]].map(([label, node], i) =>
            <View key={label} style={{ flexGrow: 1, flexBasis: 120, padding: space.md, gap: 4, borderLeftWidth: i ? 1 : 0, borderColor: c.line }}><Text style={[type.body, { color: c.muted }]}>{label}</Text>{node}</View>)}
        </View>
        {orderChannel(selected) !== 'Mesa' && paymentState(selected) !== 'PAGADO' && selected.estado !== 'CANCELADO' && <MenuNotice>{preparationState(selected) === 'ENTREGADO' ? 'Este pedido figura entregado, pero mantiene un saldo pendiente. Revisa el cobro en Caja.' : 'Express debe estar pagado y listo antes de entregarse. Registra el cobro desde Caja.'}</MenuNotice>}
        {!!selected.notas && <MenuNotice>{selected.notas}</MenuNotice>}
        {selected.rondas?.length ? selected.rondas.map((round, index) => { const action = nextRoundAction(selected, round); return <View key={round.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
            <Text style={[type.h3, { color: c.text }]}>Ronda {index + 1} <Text style={{ color: c.muted, fontWeight: '400' }}>· {dateText(round.created_at)}</Text></Text>
            <Badge tone={ROUND[round.estado] || 'neutral'}>{labels[round.estado] || round.estado}</Badge>
          </View>
          <View style={{ padding: space.md, gap: space.md }}>
            <ItemLines items={round.items || selected.items?.filter(i => Number(i.ronda_id) === Number(round.id))} />
            {!!round.notas && round.notas !== selected.notas && <Text style={[type.small, { color: c.muted }]}>{round.notas}</Text>}
            {action && <View style={{ alignItems: 'flex-end' }}><MenuButton icon={action.next === 'ENTREGADO' ? Check : ChefHat} onPress={() => askRound(round)}>{action.label}</MenuButton></View>}
          </View>
        </View>; }) : <ItemLines items={selected.items} />}
        <View style={{ gap: space.sm, paddingTop: space.sm }}>
          {[['Total de la cuenta', selected.total], ['Abonado', selected.abonado]].map(([label, value]) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[type.small, { color: c.muted }]}>{label}</Text><Text style={[type.small, type.num, { color: c.text }]}>{money(value)}</Text></View>)}
        </View>
        {!['PAGADO', 'CANCELADO'].includes(selected.estado) && <View style={{ gap: space.sm, alignItems: 'flex-start', paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.line }}>
          <Button variant="plain" disabled={Number(selected.abonado) > 0} onPress={askCancel}><Text style={[type.body, { color: c.red, fontWeight: '600' }]}>Cancelar pedido</Text></Button>
          {Number(selected.abonado) > 0 && <Text style={[type.micro, { color: c.faint }]}>La cuenta tiene abonos. Revisa sus pagos en Caja antes de cancelar.</Text>}
        </View>}
      </> : <MenuNotice>Actualiza la lista para consultar su estado. No se realizarán cambios desde esta ventana.</MenuNotice>}
    </MenuModal>
  </>;
}
