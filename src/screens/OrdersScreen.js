import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ArrowDownUp, Check, ChefHat, ChevronRight, Coffee, ReceiptText, ShoppingBag, Truck, X } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuModal, MenuNotice } from '../components/MenuUI';
import { Button, DataTable, EmptyState, FadeIn, IconButton, PageHeader, Press, SearchField, Segmented, Skeleton, Status, Tabs, ago, money, radius, space, type, useToast } from '../components/admin/ui';
import { ORDER_LABELS as labels, orderChannel, orderDestination, preparationState, paymentState, orderBalance, ongoingOrder, nextRoundAction, orderDate, isOrderToday, orderMatches } from '../utils/adminOrders.mjs';

const dateText = value => orderDate(value)?.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) || 'Fecha no disponible';
const errorText = error => error?.response?.data?.message || error?.message || 'No se pudo completar la operación.';
const TONE = { PENDIENTE: 'neutral', PREPARANDO: 'amber', LISTO: 'green', ENTREGADO: 'sky', PAGADO: 'green', CANCELADO: 'red', PARCIAL: 'purple' };
const CHANNEL_ICON = { Mesa: Coffee, Delivery: Truck, 'Para llevar': ShoppingBag };

function PrepStatus({ order }) { const s = preparationState(order); return <Status tone={TONE[s]}>{labels[s] || s}</Status>; }
function PayStatus({ order }) { const s = paymentState(order); return <Status tone={s === 'PENDIENTE' ? 'amber' : TONE[s]}>{s === 'PENDIENTE' ? 'Por cobrar' : labels[s] || s}</Status>; }

function ItemLines({ items = [] }) {
  const { c } = useTheme();
  return <View style={{ gap: space.md }}>{items.map((item, index) => <View key={item.id || index} style={{ flexDirection: 'row', gap: space.md }}>
    <Text style={[type.small, type.num, { color: c.muted, width: 26, fontWeight: '600' }]}>{item.cantidad}×</Text>
    <View style={{ flex: 1 }}>
      <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>{item.nombre}</Text>
      {(item.modificadores || []).map((mod, i) => <Text key={i} style={[type.micro, { color: c.muted, marginTop: 2 }]}>{mod.nombre}{Number(mod.precio_extra || 0) ? ` · +${money(mod.precio_extra)}` : ''}</Text>)}
      {!!item.notas && <Text style={[type.micro, { color: c.amber, marginTop: 2 }]}>Nota: {item.notas}</Text>}
    </View>
    <Text style={[type.small, type.num, { color: c.muted }]}>{money(Number(item.precio || 0) * Number(item.cantidad || 0))}</Text>
  </View>)}</View>;
}

// Franja de cifras en línea (sin tarjetas): se lee como una frase.
function Strip({ items }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, marginBottom: space.xl }}>
    {items.map((it, i) => <View key={it.label} style={{ flexGrow: 1, flexBasis: 160, paddingVertical: space.lg, paddingHorizontal: space.xl, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.line, gap: 2 }}>
      <Text style={[type.small, { color: c.muted }]}>{it.label}</Text>
      <Text style={[type.figure, { fontSize: 22, lineHeight: 28, color: it.tone ? c[it.tone] : c.text }]}>{it.value}</Text>
    </View>)}
  </View>;
}

export default function OrdersScreen({ onNavigate }) {
  const { c } = useTheme(); const { width } = useWindowDimensions(); const phone = width < 760;
  const toast = useToast();
  const { pedidos, loading, refreshAll } = useAdmin();
  const [scope, setScope] = useState('active'), [channel, setChannel] = useState('all'), [state, setState] = useState('all'), [query, setQuery] = useState(''), [oldest, setOldest] = useState(true), [limit, setLimit] = useState(30);
  const [selectedId, setSelectedId] = useState(null), [confirmation, setConfirmation] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(new Date());
  const busyRef = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => setLimit(30), [scope, channel, state, query]);
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

  const columns = phone ? [
    { key: 'p', label: 'Pedido', flex: 1, render: o => { const Icon = CHANNEL_ICON[orderChannel(o)] || ShoppingBag; return <View style={{ gap: 6, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Icon size={15} color={c.muted} /><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', flexShrink: 1 }]}>{orderDestination(o)}</Text><Text style={[type.micro, { color: c.faint }]}>#{o.id}</Text></View>
      <View style={{ flexDirection: 'row', gap: space.lg }}><PrepStatus order={o} /><PayStatus order={o} /></View></View>; } },
    { key: 't', label: 'Total', width: 90, align: 'right', render: o => <View style={{ alignItems: 'flex-end' }}><Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{money(o.total)}</Text><Text style={[type.micro, { color: c.faint }]}>{ago(o.created_at)}</Text></View> },
  ] : [
    { key: 'p', label: 'Pedido', flex: 2.2, sortValue: o => Number(o.id), render: o => { const Icon = CHANNEL_ICON[orderChannel(o)] || ShoppingBag; return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={c.muted} /></View>
      <View style={{ minWidth: 0, flexShrink: 1 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{orderDestination(o)} <Text style={{ color: c.faint, fontWeight: '400' }}>#{o.id}</Text></Text>
        <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{o.cliente_nombre || o.mesero_nombre || 'Sin responsable'} · {ago(o.created_at)}</Text></View></View>; } },
    { key: 'prep', label: 'Preparación', flex: 1.1, render: o => <View style={{ gap: 3 }}><PrepStatus order={o} />{o.rondas?.some(r => r.estado === 'LISTO') && preparationState(o) !== 'LISTO' && o.estado !== 'CANCELADO' ? <Text style={[type.micro, { color: c.green }]}>Una ronda lista</Text> : null}</View> },
    { key: 'pay', label: 'Cobro', flex: 1.1, render: o => <View style={{ gap: 3 }}><PayStatus order={o} />{orderBalance(o) > 0 ? <Text style={[type.micro, type.num, { color: c.faint }]}>{money(orderBalance(o))} pendiente</Text> : null}</View> },
    { key: 'total', label: 'Total', width: 110, sortValue: o => Number(o.total), align: 'right', render: o => <Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{money(o.total)}</Text> },
    { key: 'go', label: '', width: 18, render: () => <ChevronRight size={16} color={c.faint} /> },
  ];

  return <>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Pedidos" description="Preparación, entrega y cobro de cada cuenta en tiempo real." />
      <Strip items={[
        { label: 'En curso', value: active.length },
        { label: 'En cocina', value: active.filter(p => ['PENDIENTE', 'PREPARANDO'].includes(preparationState(p))).length },
        { label: 'Con rondas listas', value: active.filter(p => p.rondas?.some(r => r.estado === 'LISTO')).length },
        { label: 'Saldo por cobrar', value: money(pedidos.reduce((sum, p) => sum + orderBalance(p), 0)) },
      ]} />
      <Tabs value={scope} onChange={setScope} style={{ marginBottom: space.lg }} options={[{ value: 'active', label: 'En curso', count: active.length }, { value: 'today', label: 'Creados hoy', count: today.length }, { value: 'all', label: 'Todos' }]} />
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.md, marginBottom: space.md }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por mesa, cliente, mesero o producto…" style={phone ? null : { flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Segmented size="sm" value={channel} onChange={setChannel} accessibilityLabel="Canal" options={[{ value: 'all', label: 'Todos' }, { value: 'Mesa', label: 'Salón' }, { value: 'Para llevar', label: 'Llevar' }, { value: 'Delivery', label: 'Delivery' }]} style={{ alignSelf: 'center' }} />
          <IconButton icon={ArrowDownUp} label={oldest ? 'Primero los más antiguos' : 'Primero los más recientes'} active onPress={() => setOldest(v => !v)} size={40} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        {[['all', 'Cualquier estado'], ['PENDIENTE', 'Pendientes'], ['PREPARANDO', 'En preparación'], ['LISTO', 'Listos'], ['ENTREGADO', 'Entregados'], ['unpaid', 'Por cobrar'], ['CANCELADO', 'Cancelados']].map(([key, label]) =>
          <Press key={key} accessibilityRole="button" accessibilityState={{ selected: state === key }} scaleTo={0.96} onPress={() => { setState(key); if (key === 'CANCELADO' && scope === 'active') setScope('all'); }}
            style={{ height: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: state === key ? c.text : c.line, backgroundColor: state === key ? c.text : c.surface }}
            hoverStyle={state === key ? null : { borderColor: c.lineStrong }}>
            <Text style={[type.small, { color: state === key ? c.bg : c.muted, fontWeight: state === key ? '600' : '500' }]}>{label}</Text>
          </Press>)}
      </ScrollView>
      <FadeIn trigger={`${scope}-${channel}-${state}`} duration={180} offset={4}>
        {loading && !pedidos.length ? <View style={{ gap: space.sm }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={56} radius={10} />)}</View>
          : <DataTable selectedKey={selectedId} columns={columns} rows={matches.slice(0, limit)} onRowPress={openDetail}
            empty={<EmptyState icon={ReceiptText} title="Ningún pedido coincide" description="Prueba con otro filtro o busca por número de mesa." action={<Button size="sm" onPress={resetFilters}>Restablecer filtros</Button>} />} />}
      </FadeIn>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, gap: space.md }}>
        <Text style={[type.micro, { color: c.faint, flex: 1 }]}>{matches.length} {matches.length === 1 ? 'pedido' : 'pedidos'}. Los cobros de días anteriores están en el historial de Caja.</Text>
        {matches.length > limit ? <Button size="sm" onPress={() => setLimit(v => v + 30)}>Mostrar más</Button> : null}
      </View>
    </ScrollView>

    <MenuModal visible={selectedId !== null} title={confirmation?.title || (selected ? `${orderDestination(selected)} · #${selected.id}` : `Pedido #${selectedId}`)} subtitle={confirmation?.text || (selected ? `${selected.mesero_nombre || 'Sin responsable'}${selected.cliente_nombre ? ` · ${selected.cliente_nombre}` : ''} · ${dateText(selected.created_at)}` : 'Este pedido ya no está en la lista actual.')}
      busy={busy} close={close} maxWidth={confirmation ? 480 : 720}
      footer={confirmation ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}><MenuButton disabled={busy} onPress={close}>Volver</MenuButton><MenuButton primary={!confirmation.danger} danger={confirmation.danger} busy={busy} onPress={execute}>{confirmation.label}</MenuButton></View>
        : selected && orderBalance(selected) > 0 && selected.estado !== 'CANCELADO' ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
          <Text style={[type.small, { color: c.muted }]}>Saldo pendiente <Text style={[type.num, { color: c.text, fontWeight: '700' }]}>{money(orderBalance(selected))}</Text></Text>
          <MenuButton primary onPress={goCash}>Cobrar en Caja</MenuButton></View> : null}>
      {confirmation ? (error ? <MenuNotice danger>{error}</MenuNotice> : null) : selected ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xxl }}>
          <View style={{ gap: 6 }}><Text style={[type.micro, { color: c.faint }]}>Preparación</Text><PrepStatus order={selected} /></View>
          <View style={{ gap: 6 }}><Text style={[type.micro, { color: c.faint }]}>Cobro</Text><PayStatus order={selected} /></View>
          <View style={{ gap: 6 }}><Text style={[type.micro, { color: c.faint }]}>Canal</Text><Text style={[type.small, { color: c.text }]}>{orderChannel(selected)}</Text></View>
        </View>
        {orderChannel(selected) !== 'Mesa' && paymentState(selected) !== 'PAGADO' && selected.estado !== 'CANCELADO' && <MenuNotice>{preparationState(selected) === 'ENTREGADO' ? 'Este pedido figura entregado, pero mantiene un saldo pendiente. Revisa el cobro en Caja.' : 'Express debe estar pagado y listo antes de entregarse. Registra el cobro desde Caja.'}</MenuNotice>}
        {!!selected.notas && <MenuNotice>{selected.notas}</MenuNotice>}
        {selected.rondas?.length ? selected.rondas.map((round, index) => { const action = nextRoundAction(selected, round); return <View key={round.id} style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.md, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: c.surfaceAlt, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
            <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Ronda {index + 1} <Text style={{ color: c.faint, fontWeight: '400' }}>· {dateText(round.created_at)}</Text></Text>
            <Status tone={TONE[round.estado]}>{labels[round.estado] || round.estado}</Status>
          </View>
          <View style={{ padding: space.lg, gap: space.md }}>
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
          <Button variant="danger" size="sm" icon={X} disabled={Number(selected.abonado) > 0} onPress={askCancel}>Cancelar pedido</Button>
          {Number(selected.abonado) > 0 && <Text style={[type.micro, { color: c.faint }]}>La cuenta tiene abonos. Revisa sus pagos en Caja antes de cancelar.</Text>}
        </View>}
      </> : <MenuNotice>Actualiza la lista para consultar su estado. No se realizarán cambios desde esta ventana.</MenuNotice>}
    </MenuModal>
  </>;
}
