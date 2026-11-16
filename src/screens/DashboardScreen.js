import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AlertTriangle, ArrowRight, ChefHat, ClipboardList, Package, Wallet } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, percentage, shortDate } from '../utils/reportLogic.mjs';
import { ago, AnimatedNumber, Button, Card, EASE_OUT, EmptyState, FadeIn, Metric, PageHeader, Press, Segmented, Skeleton, Status, money, radius, reduceMotion, space, toneColors, type } from '../components/admin/ui';

const WEB = Platform.OS === 'web';
const OPEN = o => !['PAGADO', 'CANCELADO'].includes(String(o.estado).toUpperCase());
const target = o => o.mesa_id ? `Mesa ${o.mesa_numero || o.mesa_id}` : o.tipo === 'Delivery' ? `Delivery #${o.id}` : `Para llevar #${o.id}`;
const stockOf = item => Number(item.stock_disponible ?? item.inventario_stock ?? item.stock ?? 0);
const minutesSince = v => Math.max(0, Math.round((Date.now() - new Date(String(v).replace(' ', 'T')).getTime()) / 60000));
const ORDER_STATE = { PENDIENTE: ['Pendiente', 'neutral'], PREPARANDO: ['En cocina', 'amber'], LISTO: ['Listo', 'green'], ENTREGADO: ['Entregado', 'sky'] };
const TABLE_STATE = { Libre: ['Libre', 'green'], Ocupada: ['Ocupada', 'amber'], Cuenta: ['Por cobrar', 'red'], Reservada: ['Reservada', 'purple'] };
const PERIODS = [{ value: 1, label: 'Hoy' }, { value: 7, label: '7 días' }, { value: 30, label: '30 días' }, { value: 90, label: '90 días' }];

function greeting(name) {
  const h = new Date().getHours();
  const first = String(name || '').split(' ')[0];
  return `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}${first ? `, ${first}` : ''}`;
}

// Barras de ventas: crecen al cargar, se resaltan al pasar el cursor y muestran el valor.
function SalesBars({ data, labelOf, valueOf, height = 168 }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(null);
  const grow = useRef(new Animated.Value(0)).current;
  const max = Math.max(...data.map(valueOf), 1);
  useEffect(() => {
    grow.setValue(reduceMotion() ? 1 : 0);
    if (!reduceMotion()) Animated.timing(grow, { toValue: 1, duration: 520, easing: EASE_OUT, useNativeDriver: false }).start();
  }, [data.length, max]);
  const step = data.length > 31 ? Math.ceil(data.length / 8) : data.length > 14 ? 3 : 1;
  return <View>
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: data.length > 40 ? 2 : 6 }}>
      {[0.25, 0.5, 0.75, 1].map(l => <View key={l} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: height * l, height: 1, backgroundColor: c.line, opacity: 0.7 }} />)}
      {data.map((d, i) => {
        const v = valueOf(d); const h = Math.max(v > 0 ? 3 : 0, (v / max) * (height - 28));
        const active = hover === i; const dim = hover != null && !active;
        return <Pressable key={i} accessibilityLabel={`${labelOf(d, true)}: ${money(v)}`} onHoverIn={() => setHover(i)} onHoverOut={() => setHover(null)} onPressIn={() => setHover(i)} onPressOut={() => setHover(null)}
          style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
          {active ? <View pointerEvents="none" style={{ position: 'absolute', bottom: h + 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: c.isDark ? c.softer : '#0E1726', zIndex: 2, minWidth: 74, alignItems: 'center' }}>
            <Text style={[type.micro, type.num, { color: '#F3F1EA', fontWeight: '700' }]}>{money(v)}</Text>
            <Text numberOfLines={1} style={[type.micro, { color: '#A8B3C7', fontSize: 11 }]}>{labelOf(d, true)}</Text>
          </View> : null}
          <Animated.View style={{ width: '100%', maxWidth: 34, height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), borderTopLeftRadius: 5, borderTopRightRadius: 5,
            backgroundColor: active ? c.primary : c.isDark ? '#2E4260' : '#C9D3E2', opacity: dim ? 0.55 : 1, ...(WEB ? { transition: 'background-color 120ms, opacity 120ms' } : {}) }} />
        </Pressable>;
      })}
    </View>
    <View style={{ flexDirection: 'row', marginTop: space.sm, gap: data.length > 40 ? 2 : 6 }}>
      {data.map((d, i) => <Text key={i} numberOfLines={1} style={[type.micro, { flex: 1, textAlign: 'center', color: hover === i ? c.text : c.faint, fontSize: 11 }]}>{i % step === 0 || i === data.length - 1 ? labelOf(d) : ''}</Text>)}
    </View>
  </View>;
}

function AttentionRow({ icon: Icon, tone, title, detail, action, onPress }) {
  const { c } = useTheme();
  const [, fg] = toneColors(c, tone);
  return <Press accessibilityRole="button" onPress={onPress} scaleTo={0.99}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.md, marginHorizontal: -space.md, borderRadius: radius.md }}
    hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    {({ hovered }) => <>
      <Icon size={17} color={fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.small, { color: c.text, fontWeight: '600' }]}>{title}</Text>
        <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{detail}</Text>
      </View>
      {action ? <Text style={[type.micro, type.num, { color: c.text, fontWeight: '600' }]}>{action}</Text> : null}
      <View style={{ transform: [{ translateX: hovered ? 2 : 0 }], ...(WEB ? { transition: 'transform 150ms' } : {}) }}><ArrowRight size={14} color={hovered ? c.text : c.faint} /></View>
    </>}
  </Press>;
}

function FloorMini({ mesas, onOpen }) {
  const { c } = useTheme();
  const active = mesas.filter(m => Number(m.activo) === 1).sort((a, b) => Number(a.numero) - Number(b.numero));
  const counts = Object.keys(TABLE_STATE).map(k => [k, active.filter(m => m.estado === k).length]);
  const busy = active.filter(m => ['Ocupada', 'Cuenta'].includes(m.estado)).length;
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space.lg }}>
      <Text style={[type.h2, { color: c.text }]}>Salón ahora</Text>
      <Text style={[type.small, type.num, { color: c.muted }]}>{busy} de {active.length} ocupadas</Text>
    </View>
    {active.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {active.map(m => { const [label, tone] = TABLE_STATE[m.estado] || TABLE_STATE.Libre; const [bg, fg, dot] = toneColors(c, tone);
        return <Press key={m.id} accessibilityRole="button" accessibilityLabel={`Mesa ${m.numero}, ${label}`} onPress={onOpen} scaleTo={0.94}
          {...(WEB ? { title: `Mesa ${m.numero} · ${label}${m.ubicacion_nombre ? ' · ' + m.ubicacion_nombre : ''}` } : {})}
          style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: m.estado === 'Libre' ? c.surface : bg, borderWidth: 1, borderColor: m.estado === 'Libre' ? c.line : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          hoverStyle={{ borderColor: dot }}>
          <Text style={[type.small, type.num, { color: m.estado === 'Libre' ? c.muted : fg, fontWeight: '700' }]}>{m.numero}</Text>
          {m.estado !== 'Libre' ? <View style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
        </Press>; })}
    </View> : <Text style={[type.small, { color: c.muted }]}>Aún no hay mesas activas.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.lg }}>
      {counts.map(([k, n]) => <Status key={k} tone={TABLE_STATE[k][1]}>{`${TABLE_STATE[k][0]} · ${n}`}</Status>)}
    </View>
  </Card>;
}

function OpenAccounts({ orders, onOpen }) {
  const { c } = useTheme();
  return <Card padded={false}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.xl, paddingBottom: space.md }}>
      <Text style={[type.h2, { color: c.text }]}>Cuentas abiertas</Text>
      <Button size="sm" variant="ghost" iconRight={ArrowRight} onPress={onOpen}>Ver pedidos</Button>
    </View>
    {orders.length ? orders.map((o, i) => { const [label, tone] = ORDER_STATE[String(o.estado).toUpperCase()] || ['Abierta', 'neutral'];
      const pending = Math.max(0, Number(o.total || 0) - Number(o.abonado || 0));
      return <Press key={o.id} accessibilityRole="button" onPress={onOpen} scaleTo={0.995}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line }}
        hoverStyle={{ backgroundColor: c.surfaceAlt }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.small, { color: c.text, fontWeight: '600' }]}>{target(o)}</Text>
          <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{o.mesero_nombre || 'Sin mesero'} · {ago(o.created_at)}</Text>
        </View>
        <View style={{ width: 100 }}><Status tone={tone}>{label}</Status></View>
        <Text style={[type.small, type.num, { color: c.text, fontWeight: '600', width: 84, textAlign: 'right' }]}>{money(pending)}</Text>
      </Press>; })
      : <EmptyState compact icon={ClipboardList} title="Sin cuentas abiertas" description="Cuando un mesero envíe un pedido aparecerá aquí." />}
  </Card>;
}

function Ranking({ title, rows, valueOf, labelOf, format, empty }) {
  const { c } = useTheme();
  const max = Math.max(...rows.map(valueOf), 1);
  return <Card style={{ flex: 1, minWidth: 280 }}>
    <Text style={[type.h2, { color: c.text, marginBottom: space.lg }]}>{title}</Text>
    {rows.length ? <View style={{ gap: space.md }}>
      {rows.map((r, i) => <View key={i} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Text numberOfLines={1} style={[type.small, { color: c.text, flex: 1 }]}>{labelOf(r)}</Text>
          <Text style={[type.small, type.num, { color: c.muted }]}>{format(r)}</Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.soft, overflow: 'hidden' }}>
          <FadeIn delay={i * 40} offset={0} style={{ height: 6 }}><View style={{ height: 6, width: `${Math.max(3, valueOf(r) / max * 100)}%`, borderRadius: 3, backgroundColor: i === 0 ? c.primary : c.isDark ? '#2E4260' : '#C9D3E2' }} /></FadeIn>
        </View>
      </View>)}
    </View> : <Text style={[type.small, { color: c.muted }]}>{empty}</Text>}
  </Card>;
}

function PaymentSplit({ methods }) {
  const { c } = useTheme();
  const total = methods.reduce((s, m) => s + Number(m.total || 0), 0);
  const tones = [c.text, c.primary, c.sky, c.purple, c.green];
  return <Card style={{ flex: 1, minWidth: 280 }}>
    <Text style={[type.h2, { color: c.text, marginBottom: space.lg }]}>Cómo pagan</Text>
    {methods.length ? <>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: space.lg }}>
        {methods.map((m, i) => <View key={m.nombre} style={{ flex: Number(m.total) || 0.0001, backgroundColor: tones[i % tones.length] }} />)}
      </View>
      <View style={{ gap: space.md }}>
        {methods.map((m, i) => <View key={m.nombre} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: tones[i % tones.length] }} />
          <Text style={[type.small, { color: c.text, flex: 1 }]}>{m.nombre}</Text>
          <Text style={[type.small, type.num, { color: c.muted, width: 48, textAlign: 'right' }]}>{Math.round(percentage(m.total, total))}%</Text>
          <Text style={[type.small, type.num, { color: c.text, width: 96, textAlign: 'right', fontWeight: '600' }]}>{money(m.total)}</Text>
        </View>)}
      </View>
    </> : <Text style={[type.small, { color: c.muted }]}>Sin cobros en este período.</Text>}
  </Card>;
}

export default function DashboardScreen({ setActiveTab }) {
  const { pedidos, productos, mesas, inventario, caja } = useAdmin();
  const { user } = useAuth();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1180, phone = width < 700;
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(0);
  const go = tab => setActiveTab?.(tab);

  useEffect(() => {
    const request = ++requestRef.current; const controller = new AbortController();
    setLoading(true); setError('');
    axios.get(`${BASE_URL}/dashboard/reports`, { params: { days }, signal: controller.signal, timeout: 15000 })
      .then(({ data }) => { if (request === requestRef.current) setReport(data); })
      .catch(e => { if (request === requestRef.current && e.code !== 'ERR_CANCELED') setError(e.response?.data?.message || 'No se pudieron cargar las ventas.'); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [days, retry]);

  const open = pedidos.filter(OPEN).sort((a, b) => Number(b.id) - Number(a.id));
  const pendingBalance = open.reduce((s, o) => s + Math.max(0, Number(o.total || 0) - Number(o.abonado || 0)), 0);
  const toCharge = open.filter(o => o.cuenta_solicitada_at || String(o.estado).toUpperCase() === 'ENTREGADO');
  const kitchen = open.filter(o => ['PENDIENTE', 'PREPARANDO'].includes(String(o.estado).toUpperCase()));
  const slow = kitchen.filter(o => minutesSince(o.created_at) > 20);
  const lowStock = inventario.filter(i => Number(i.stock_minimo) > 0 && stockOf(i) <= Number(i.stock_minimo));
  const summary = report?.summary || {};
  const timeline = useMemo(() => completeTimeline(report?.timeline, days), [report?.timeline, days]);
  const hours = useMemo(() => { const map = new Map((report?.hours || []).map(h => [Number(h.hora), Number(h.total || 0)])); return Array.from({ length: 16 }, (_, i) => ({ hora: i + 7, total: map.get(i + 7) || 0 })); }, [report?.hours]);
  const peak = bestHour(report?.hours || []);
  const change = Number(summary.change_percent || 0);
  const today = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

  const attention = [
    ...slow.map(o => ({ id: `s${o.id}`, icon: AlertTriangle, tone: 'red', title: `${target(o)} espera hace ${minutesSince(o.created_at)} min`, detail: `En cocina · ${o.mesero_nombre || 'sin mesero'}`, go: 'pedidos' })),
    ...(toCharge.length ? [{ id: 'charge', icon: Wallet, tone: 'amber', title: `${toCharge.length} ${toCharge.length === 1 ? 'cuenta lista' : 'cuentas listas'} para cobrar`, detail: toCharge.slice(0, 3).map(target).join(', '), action: money(toCharge.reduce((s, o) => s + Math.max(0, Number(o.total) - Number(o.abonado || 0)), 0)), go: 'caja' }] : []),
    ...(kitchen.length ? [{ id: 'kitchen', icon: ChefHat, tone: 'neutral', title: `${kitchen.length} en cocina`, detail: kitchen.slice(0, 3).map(target).join(', '), go: 'pedidos' }] : []),
    ...lowStock.slice(0, 3).map(i => ({ id: `i${i.id}`, icon: Package, tone: 'amber', title: `Queda poco ${i.nombre.toLowerCase()}`, detail: `${stockOf(i)} ${i.unidad || ''} · mínimo ${Number(i.stock_minimo)}`, go: 'inventario' })),
    ...(!caja?.caja ? [{ id: 'cash', icon: Wallet, tone: 'red', title: 'La caja está cerrada', detail: 'Ábrela para poder cobrar', go: 'caja' }] : []),
  ];

  const salesCard = <Card style={{ flex: wide ? 2 : undefined }}>
    <View style={{ flexDirection: phone ? 'column' : 'row', justifyContent: 'space-between', gap: space.xl, marginBottom: space.xl }}>
      {loading && !report ? <View style={{ gap: 10 }}><Skeleton width={110} height={14} /><Skeleton width={190} height={40} /><Skeleton width={150} height={12} /></View>
        : <Metric size="lg" label={days === 1 ? 'Ventas de hoy' : `Ventas de los últimos ${days} días`} value={Number(summary.net_sales || 0)} format={v => money(v)}
          note={change === 0 ? 'Igual que el período anterior' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% frente al período anterior`} noteTone={change > 0 ? 'green' : change < 0 ? 'red' : null} />}
      <View style={{ flexDirection: 'row', gap: phone ? space.xl : space.x3, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Metric size="sm" label="Pedidos cobrados" value={Number(summary.paid_orders || 0)} />
        <Metric size="sm" label="Ticket promedio" value={Number(summary.average_ticket || 0)} format={v => money(v)} />
        <Metric size="sm" label="Por cobrar ahora" value={pendingBalance} format={v => money(v)} />
      </View>
    </View>
    {error ? <View style={{ height: 168, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
      <Text style={[type.small, { color: c.red }]}>{error}</Text><Button size="sm" onPress={() => setRetry(r => r + 1)}>Reintentar</Button>
    </View> : loading && !report ? <Skeleton height={190} radius={10} />
      : days === 1 ? <SalesBars data={hours} valueOf={h => h.total} labelOf={(h, long) => long ? `${h.hora}:00 – ${h.hora + 1}:00` : `${h.hora}h`} />
        : <SalesBars data={timeline} valueOf={d => d.ventas} labelOf={(d, long) => long ? new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' }) : shortDate(d.fecha, days)} />}
    {peak && !loading ? <Text style={[type.micro, { color: c.faint, marginTop: space.md }]}>La hora más fuerte del período es de {peak.hora}:00 a {Number(peak.hora) + 1}:00.</Text> : null}
  </Card>;

  const attentionCard = <Card style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
      <Text style={[type.h2, { color: c.text }]}>Necesita atención</Text>
      {attention.length ? <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type.micro, type.num, { color: c.onPrimary, fontWeight: '700' }]}>{attention.length}</Text></View> : null}
    </View>
    {attention.length ? attention.slice(0, 7).map((a, i) => <FadeIn key={a.id} delay={i * 35}><AttentionRow {...a} onPress={() => go(a.go)} /></FadeIn>)
      : <EmptyState compact icon={ClipboardList} title="Todo en orden" description="Nada espera en cocina, caja ni inventario." />}
    <View style={{ marginTop: 'auto', paddingTop: space.lg, borderTopWidth: 1, borderTopColor: c.line, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Status tone={caja?.caja ? 'green' : 'red'}>{caja?.caja ? `Caja abierta · ${money(caja?.total_cobrado ?? caja?.totales_turno?.total ?? 0)} cobrados` : 'Caja cerrada'}</Status>
    </View>
  </Card>;

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title={greeting(user?.nombre)} description={`${today.charAt(0).toUpperCase() + today.slice(1)} · ${open.length} ${open.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`}
      actions={<Segmented options={PERIODS} value={days} onChange={setDays} accessibilityLabel="Período" />} />
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
      {salesCard}
      {attentionCard}
    </View>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg, marginTop: space.lg }}>
      <View style={{ flex: wide ? 1 : undefined }}><FloorMini mesas={mesas} onOpen={() => go('mesas')} /></View>
      <View style={{ flex: wide ? 2 : undefined }}><OpenAccounts orders={open.slice(0, 6)} onOpen={() => go('pedidos')} /></View>
    </View>
    <View style={{ flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.lg }}>
      <Ranking title="Lo más vendido" rows={(report?.products || []).slice(0, 5)} valueOf={r => Number(r.unidades || 0)} labelOf={r => r.nombre}
        format={r => `${Number(r.unidades || 0)} u · ${money(r.total)}`} empty="Sin ventas en este período." />
      <PaymentSplit methods={report?.methods || []} />
    </View>
  </ScrollView>;
}
