import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { AlertTriangle, ChefHat, ChevronRight, ClipboardList, Package, Wallet } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, shortDate } from '../utils/reportLogic.mjs';
import { ago, Badge, Banner, Button, Card, DataTable, EmptyState, PageHeader, Press, Segmented, Skeleton, money, space, toneColors, type } from '../components/admin/ui';
import { ORDER_PREP, TABLE_STATE as TABLES } from '../components/admin/states';
import { BarChart, MetricsCard, RankList, SplitBar } from '../components/admin/analytics';

const OPEN = o => !['PAGADO', 'CANCELADO'].includes(String(o.estado).toUpperCase());
const target = o => o.mesa_id ? `Mesa ${o.mesa_numero || o.mesa_id}` : o.tipo === 'Delivery' ? `Delivery #${o.id}` : `Para llevar #${o.id}`;
const stockOf = item => Number(item.stock_disponible ?? item.inventario_stock ?? item.stock ?? 0);
const qty = n => Number(n || 0).toLocaleString('es-EC', { maximumFractionDigits: 3 });
const minutesSince = v => Math.max(0, Math.round((Date.now() - new Date(String(v).replace(' ', 'T')).getTime()) / 60000));
const ORDER_STATE = ORDER_PREP;
const TABLE_STATE = TABLES;
const PERIODS = [{ value: 1, label: 'Hoy' }, { value: 7, label: '7 días' }, { value: 30, label: '30 días' }, { value: 90, label: '90 días' }];

function greeting(name) {
  const h = new Date().getHours();
  const first = String(name || '').split(' ')[0];
  return `${h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'}${first ? `, ${first}` : ''}`;
}

// Fila de «Necesita atención»: icono del tono, texto y valor; toda la fila lleva a la sección.
function AttentionRow({ icon: Icon, tone, title, detail, action, onPress, first }) {
  const { c } = useTheme();
  const [, fg] = toneColors(c, tone);
  return <Press accessibilityRole="button" accessibilityLabel={title} onPress={onPress} scaleTo={1}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.lg, borderTopWidth: first ? 0 : 1, borderTopColor: c.line }}
    hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <Icon size={16} color={tone === 'neutral' ? c.muted : fg} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '500' }]}>{title}</Text>
      <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{detail}</Text>
    </View>
    {action ? <Text style={[type.body, type.num, { color: c.text }]}>{action}</Text> : null}
    <ChevronRight size={16} color={c.faint} />
  </Press>;
}

function FloorMini({ mesas, onOpen }) {
  const { c } = useTheme();
  const active = mesas.filter(m => Number(m.activo) === 1).sort((a, b) => Number(a.numero) - Number(b.numero));
  const busy = active.filter(m => ['Ocupada', 'Cuenta'].includes(m.estado)).length;
  const counts = Object.keys(TABLE_STATE).map(k => [k, active.filter(m => m.estado === k).length]).filter(([, n]) => n);
  return <Card title="Salón ahora" description={`${busy} de ${active.length} mesas ocupadas`} actions={<Button variant="plain" onPress={onOpen}>Ver mesas</Button>}>
    {active.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {active.map(m => { const [label, tone] = TABLE_STATE[m.estado] || TABLE_STATE.Libre; const [bg, fg] = toneColors(c, tone); const free = m.estado === 'Libre';
        return <Press key={m.id} accessibilityRole="button" accessibilityLabel={`Mesa ${m.numero}, ${label}`} onPress={onOpen} scaleTo={0.95}
          {...{ title: `Mesa ${m.numero} · ${label}${m.ubicacion_nombre ? ' · ' + m.ubicacion_nombre : ''}` }}
          style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: free ? c.surface : bg, borderWidth: 1, borderColor: free ? c.lineStrong : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          hoverStyle={{ borderColor: c.text }}>
          <Text style={[type.body, type.num, { color: free ? c.muted : fg, fontWeight: '600' }]}>{m.numero}</Text>
        </Press>; })}
    </View> : <Text style={[type.body, { color: c.muted }]}>Aún no hay mesas activas.</Text>}
    {counts.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
      {counts.map(([k, n]) => <Badge key={k} tone={TABLE_STATE[k][1]}>{`${TABLE_STATE[k][0]} ${n}`}</Badge>)}
    </View> : null}
  </Card>;
}

export default function DashboardScreen({ setActiveTab }) {
  const { pedidos, productos, mesas, inventario, caja } = useAdmin();
  const { user } = useAuth();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1080, phone = width < 700;
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
    ...lowStock.slice(0, 3).map(i => ({ id: `i${i.id}`, icon: Package, tone: 'amber', title: `Queda poco ${i.nombre.toLowerCase()}`, detail: `${qty(stockOf(i))} ${i.unidad || ''} · mínimo ${qty(i.stock_minimo)}`, go: 'inventario' })),
    ...(!caja?.caja ? [{ id: 'cash', icon: Wallet, tone: 'red', title: 'La caja está cerrada', detail: 'Ábrela para poder cobrar', go: 'caja' }] : []),
  ];

  const salesCard = <Card title="Ventas" description={days === 1 ? 'Por hora, hoy' : `Por día, últimos ${days} días`}
    actions={<Button variant="plain" onPress={() => go('reportes')}>Ver reportes</Button>}>
    {error ? <Banner tone="critical" action={<Button size="sm" onPress={() => setRetry(r => r + 1)}>Reintentar</Button>}>{error}</Banner>
      : loading && !report ? <Skeleton height={180} radius={8} />
      : days === 1 ? <BarChart data={hours} valueOf={h => h.total} labelOf={(h, long) => long ? `${h.hora}:00 – ${h.hora + 1}:00` : `${h.hora}`} />
        : <BarChart data={timeline} valueOf={d => d.ventas} labelOf={(d, long) => long ? new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' }) : shortDate(d.fecha, days)} />}
    {peak && !loading && !error ? <Text style={[type.body, { color: c.muted, marginTop: space.md }]}>Hora más fuerte: {peak.hora}:00 – {Number(peak.hora) + 1}:00 · {money(peak.total)}</Text> : null}
  </Card>;

  const attentionCard = <Card padded={false} title="Necesita atención" actions={attention.length ? <Badge tone="warning">{String(attention.length)}</Badge> : null}
    footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Badge tone={caja?.caja ? 'success' : 'critical'}>{caja?.caja ? 'Caja abierta' : 'Caja cerrada'}</Badge>
      {caja?.caja ? <Text style={[type.body, type.num, { color: c.muted }]}>{money(caja?.total_cobrado ?? caja?.totales_turno?.total ?? 0)} cobrados en el turno</Text> : null}
    </View>}>
    {attention.length ? attention.slice(0, 6).map((a, i) => <AttentionRow key={a.id} {...a} first={i === 0} onPress={() => go(a.go)} />)
      : <EmptyState compact icon={ClipboardList} title="Todo en orden" description="Nada espera en cocina, caja ni inventario." />}
    {attention.length > 6 ? <Text style={[type.body, { color: c.muted, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.line }]}>Y {attention.length - 6} más</Text> : null}
  </Card>;

  const accounts = open.slice(0, 6);
  const accountsCard = <Card padded={false} title="Cuentas abiertas" description={`${open.length} en curso · ${money(pendingBalance)} por cobrar`} actions={<Button variant="plain" onPress={() => go('pedidos')}>Ver pedidos</Button>}>
    <DataTable bare compact rows={accounts} onRowPress={() => go('pedidos')}
      columns={[
        { key: 'a', label: 'Cuenta', flex: 1.6, render: o => <View style={{ minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{target(o)}</Text>
          <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{o.mesero_nombre || 'Sin mesero'} · {ago(o.created_at)}</Text></View> },
        ...(phone ? [] : [{ key: 's', label: 'Estado', width: 110, render: o => { const [l, t] = ORDER_STATE[String(o.estado).toUpperCase()] || ['Abierta', 'neutral']; return <Badge tone={t}>{l}</Badge>; } }]),
        { key: 'p', label: 'Por cobrar', width: 100, align: 'right', render: o => <Text style={[type.body, type.num, { color: c.text }]}>{money(Math.max(0, Number(o.total || 0) - Number(o.abonado || 0)))}</Text> },
      ]}
      empty={<EmptyState compact icon={ClipboardList} title="Sin cuentas abiertas" description="Cuando un mesero envíe un pedido aparecerá aquí." />} />
  </Card>;

  const topCard = <Card title="Lo más vendido" description="Unidades en cuentas cobradas del período">
    {loading && !report ? <Skeleton height={120} radius={8} /> : <RankList rows={(report?.products || []).slice(0, 5)} labelOf={r => r.nombre} valueOf={r => Number(r.unidades || 0)}
      metaOf={r => `${Number(r.unidades || 0)} u`} amountOf={r => money(r.total)} empty="Sin ventas en este período." />}
  </Card>;
  const payCard = <Card title="Cómo pagan" description="Participación sobre lo cobrado">
    {loading && !report ? <Skeleton height={90} radius={8} /> : <SplitBar items={report?.methods || []} empty="Sin cobros en este período." />}
  </Card>;

  const metrics = [
    { label: days === 1 ? 'Ventas de hoy' : 'Ventas', value: Number(summary.net_sales || 0), format: money, onPress: () => go('reportes'),
      note: change === 0 ? 'Igual que el período anterior' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)}% vs. anterior`, noteTone: change > 0 ? 'green' : change < 0 ? 'red' : null },
    { label: 'Pedidos cobrados', value: Number(summary.paid_orders || 0), note: `${kitchen.length} en cocina ahora`, onPress: () => go('pedidos') },
    { label: 'Ticket promedio', value: Number(summary.average_ticket || 0), format: money, note: 'Por pedido cobrado' },
    { label: 'Por cobrar ahora', value: pendingBalance, format: money, note: `${toCharge.length} ${toCharge.length === 1 ? 'cuenta lista' : 'cuentas listas'}`, onPress: () => go('caja') },
  ];

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title={greeting(user?.nombre)} description={`${today.charAt(0).toUpperCase() + today.slice(1)} · ${open.length} ${open.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`}
      actions={<Segmented options={PERIODS} value={days} onChange={setDays} accessibilityLabel="Período" />} />
    <View style={{ gap: space.lg }}>
      <MetricsCard items={metrics} loading={loading && !report} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: wide ? 2 : undefined, alignSelf: 'stretch', gap: space.lg, minWidth: 0 }}>
          {salesCard}
          {accountsCard}
          {topCard}
        </View>
        <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: space.lg, minWidth: 0 }}>
          {attentionCard}
          <FloorMini mesas={mesas} onOpen={() => go('mesas')} />
          {payCard}
        </View>
      </View>
    </View>
  </ScrollView>;
}
