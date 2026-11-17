import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { BarChart3, Download } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useTheme } from '../theme';
import { bestHour, monthRange, rangeError, rangeTimeline, reportCsv, REPORT_PERIODS, shortDate, todayISO, weekdayTotals } from '../utils/reportLogic.mjs';
import { Avatar, Badge, Banner, Button, Card, EmptyState, FadeIn, Input, PageHeader, Segmented, Skeleton, space, type, useToast } from '../components/admin/ui';
import { BarChart, LineChart, MetricsCard, RankList, SplitBar } from '../components/admin/analytics';

const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const integer = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 });
const reportError = error => error.response?.data?.message || error.message || 'No se pudo cargar el reporte.';
const niceDay = day => new Date(`${day}T12:00:00`).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' }).replace('.', '');

// Encabezado de tarjeta de gráfico: título, cifra principal y nota.
function ChartCard({ title, figure, note, noteTone, children, style, actions }) {
  const { c } = useTheme();
  return <Card style={style}>
    <View style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.h2, { color: c.text }]}>{title}</Text>
        {figure != null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
          <Text style={[type.figure, { fontSize: 20, lineHeight: 28, color: c.text }]}>{figure}</Text>
          {note ? (noteTone ? <Badge tone={noteTone}>{note}</Badge> : <Text style={[type.body, { color: c.muted }]}>{note}</Text>) : null}
        </View> : note ? <Text style={[type.body, { color: c.muted, marginTop: 2 }]}>{note}</Text> : null}
      </View>
      {actions}
    </View>
    {children}
  </Card>;
}

// Rendimiento por mesero: ventas, cuentas, ticket promedio y propinas, con su parte del total.
function WaiterTable({ rows, total, phone }) {
  const { c } = useTheme();
  if (!rows.length) return <Text style={[type.body, { color: c.muted, paddingVertical: space.md }]}>Todavía no hay cuentas cobradas en este periodo.</Text>;
  const max = Math.max(...rows.map(r => r.total), 1);
  const head = (label, width, align = 'right') => <Text style={[type.small, { color: c.muted, fontWeight: '600', width, textAlign: align }]}>{label}</Text>;
  return <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: 6 }}>
      <Text style={[type.small, { color: c.muted, fontWeight: '600', flex: 1 }]}>Mesero</Text>
      {!phone ? head('Cuentas', 64) : null}{!phone ? head('Ticket', 80) : null}{head('Propinas', 80)}{head('Ventas', 96)}
    </View>
    {rows.map((r, i) => <View key={`${r.mesero_id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line }}>
      <Avatar name={r.nombre} size={32} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: i === 0 ? '600' : '400' }]}>{r.nombre}{phone ? <Text style={{ color: c.muted, fontWeight: '400' }}>{`  ·  ${integer(r.cuentas)} cuentas`}</Text> : null}</Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: c.soft }}><View style={{ height: 4, borderRadius: 2, width: `${Math.max(2, r.total / max * 100)}%`, backgroundColor: c.skyBright }} /></View>
      </View>
      {!phone ? <Text style={[type.body, type.num, { color: c.muted, width: 64, textAlign: 'right' }]}>{integer(r.cuentas)}</Text> : null}
      {!phone ? <Text style={[type.body, type.num, { color: c.muted, width: 80, textAlign: 'right' }]}>{money(r.ticket)}</Text> : null}
      <Text style={[type.body, type.num, { color: r.propinas ? c.green : c.faint, width: 80, textAlign: 'right' }]}>{r.propinas ? money(r.propinas) : '—'}</Text>
      <View style={{ width: 96, alignItems: 'flex-end' }}>
        <Text style={[type.body, type.num, { color: c.text, fontWeight: '500' }]}>{money(r.total)}</Text>
        <Text style={[type.small, type.num, { color: c.muted }]}>{total ? Math.round(r.total / total * 100) : 0}%</Text>
      </View>
    </View>)}
  </View>;
}

export default function ReportsScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const phone = width < 700, wide = width >= 1120;
  const today = todayISO();
  const [days, setDays] = useState(7); // 1, 7, 30, 90 o 'custom'
  const [range, setRange] = useState(() => monthRange(today)); // rango propio aplicado
  const [draft, setDraft] = useState(() => monthRange(today));  // lo que se está escribiendo
  const [rangeIssue, setRangeIssue] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [hourMetric, setHourMetric] = useState('ventas');
  const [allProducts, setAllProducts] = useState(false);
  const requestRef = useRef(0);
  const custom = days === 'custom';
  const queryKey = custom ? `${range.desde}_${range.hasta}` : String(days);

  // Al cambiar de periodo se muestra la carga; las actualizaciones de fondo (cada 60 s) son silenciosas.
  const lastKeyRef = useRef(queryKey);
  useEffect(() => {
    const request = ++requestRef.current;
    const controller = new AbortController();
    const silent = lastKeyRef.current === queryKey && !!report;
    lastKeyRef.current = queryKey;
    if (!silent) { setLoading(true); setError(''); }
    axios.get(`${BASE_URL}/dashboard/reports`, { params: custom ? { desde: range.desde, hasta: range.hasta } : { days }, signal: controller.signal, timeout: 15000 })
      .then(({ data }) => { if (request === requestRef.current) { setReport(data); setError(''); } })
      .catch(error => { if (request === requestRef.current && error.code !== 'ERR_CANCELED' && !silent) setError(reportError(error)); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [queryKey, refreshKey]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setRefreshKey(v => v + 1);
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  const applyRange = next => {
    const issue = rangeError(next.desde, next.hasta, today);
    setDraft(next); setRangeIssue(issue || '');
    if (!issue) setRange(next);
  };

  const period = report?.period || {};
  const spanDays = Number(period.days || (custom ? 0 : days) || 1);
  const timeline = useMemo(() => period.from && period.to ? rangeTimeline(report?.timeline, period.from, period.to) : [], [report?.timeline, period.from, period.to]);
  const weekdays = useMemo(() => weekdayTotals(timeline), [timeline]);
  const bestWeekday = weekdays.reduce((best, d) => d.promedio > (best?.promedio || 0) ? d : best, null);
  const summary = report?.summary || {};
  const peak = bestHour(report?.hours || []);
  const totalMethodSales = (report?.methods || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const periodLabel = custom ? (period.from ? `${niceDay(period.from)} – ${niceDay(period.to)}` : 'Rango propio')
    : days === 1 ? 'Hoy' : `Últimos ${REPORT_PERIODS.find(item => item.days === days)?.label || `${days} días`}`;

  const products = report?.products || [];
  const shownProducts = allProducts ? products : products.slice(0, 8);
  const waiters = report?.waiters || [];
  const change = Number(summary.change_percent || 0);
  const changeText = `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const hours = Array.from({ length: 17 }, (_, i) => i + 7).map(h => (report?.hours || []).find(it => Number(it.hora) === h) || { hora: h, total: 0, pedidos: 0 });
  const updated = report?.generated_at ? new Date(report.generated_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : null;
  const longDay = d => new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });
  const cardW = wide ? { flex: 1, minWidth: 0 } : null;
  const tipRate = Number(summary.net_sales) > 0 ? Number(summary.tips || 0) / Number(summary.net_sales) * 100 : 0;

  const exportCsv = () => {
    if (!report) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') { toast.show('La descarga está disponible en la versión web.', 'amber'); return; }
    const blob = new Blob([reportCsv({ ...report, timeline })], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `reporte-ventas-${period.from}_${period.to}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    toast.show('Reporte descargado. Ábrelo con Excel.', 'green');
  };

  return <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title="Reportes" description={`${periodLabel}${updated ? ` · actualizado ${updated}` : ''}`}
      actions={<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Segmented value={days} onChange={setDays} accessibilityLabel="Periodo" options={[...REPORT_PERIODS.map(p => ({ value: p.days, label: p.label })), { value: 'custom', label: 'Fechas' }]} />
        <Button icon={Download} onPress={exportCsv} disabled={!report}>{phone ? 'Excel' : 'Descargar para Excel'}</Button>
      </View>} />

    {custom ? <Card style={{ marginBottom: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' }}>
        <View style={{ gap: 4 }}><Text style={[type.body, { color: c.text }]}>Desde</Text>
          <Input value={draft.desde} onChangeText={v => setDraft(d => ({ ...d, desde: v.replace(/[^\d-]/g, '').slice(0, 10) }))} placeholder="AAAA-MM-DD" maxLength={10} accessibilityLabel="Fecha inicial" error={!!rangeIssue} style={{ width: 132 }} onSubmitEditing={() => applyRange(draft)} /></View>
        <View style={{ gap: 4 }}><Text style={[type.body, { color: c.text }]}>Hasta</Text>
          <Input value={draft.hasta} onChangeText={v => setDraft(d => ({ ...d, hasta: v.replace(/[^\d-]/g, '').slice(0, 10) }))} placeholder="AAAA-MM-DD" maxLength={10} accessibilityLabel="Fecha final" error={!!rangeIssue} style={{ width: 132 }} onSubmitEditing={() => applyRange(draft)} /></View>
        <Button variant="primary" onPress={() => applyRange(draft)}>Ver</Button>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button variant="tertiary" onPress={() => applyRange(monthRange(today))}>Este mes</Button>
          <Button variant="tertiary" onPress={() => applyRange(monthRange(today, -1))}>Mes pasado</Button>
        </View>
      </View>
      {rangeIssue ? <Text accessibilityRole="alert" style={[type.body, { color: c.red, marginTop: space.sm }]}>{rangeIssue}</Text> : null}
    </Card> : null}

    {!!error && <Banner tone="critical" style={{ marginBottom: space.lg }} action={<Button size="sm" onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button>}>{error}</Banner>}
    {loading && !report ? <View style={{ gap: space.lg }}><Skeleton height={84} radius={12} /><View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}><Skeleton height={300} radius={12} style={wide ? { flex: 1.6 } : null} /><Skeleton height={300} radius={12} style={wide ? { flex: 1 } : null} /></View></View>
      : !report ? <Card><EmptyState icon={BarChart3} title="Sin datos para mostrar" description="No pudimos cargar el reporte de este periodo." action={<Button onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button>} /></Card>
      : <FadeIn trigger={queryKey}><View style={{ gap: space.lg, opacity: loading ? 0.6 : 1 }}>
        <MetricsCard items={[
          { label: 'Ventas netas', value: Number(summary.net_sales || 0), format: money, note: change === 0 ? 'Igual que el periodo anterior' : `${changeText} frente al periodo anterior`, noteTone: change > 0 ? 'green' : change < 0 ? 'red' : null },
          { label: 'Cuentas cobradas', value: Number(summary.paid_orders || 0), format: integer, note: `${integer(summary.payments)} pagos` },
          { label: 'Ticket promedio', value: Number(summary.average_ticket || 0), format: money, note: 'Por cuenta cobrada' },
          { label: 'Propinas', value: Number(summary.tips || 0), format: money, note: Number(summary.tips) ? `${tipRate.toLocaleString('es-EC', { maximumFractionDigits: 1 })}% de las ventas · ${money(summary.tips_cash)} en efectivo` : 'Sin propinas registradas' },
        ]} />
        <MetricsCard items={[
          { label: 'Descuentos', value: Number(summary.discounts || 0), format: money, note: `${integer(summary.discount_count)} ${Number(summary.discount_count) === 1 ? 'vez' : 'veces'}` },
          { label: 'Cortesías', value: Number(summary.comps || 0), format: money, note: `${integer(summary.comp_count)} ${Number(summary.comp_count) === 1 ? 'vez' : 'veces'}` },
          { label: 'Cuentas canceladas', value: Number(summary.cancelled_orders || 0), format: integer, note: Number(summary.cancelled_orders) ? 'Revísalas en Auditoría' : 'Ninguna', noteTone: Number(summary.cancelled_orders) ? 'red' : null },
          { label: 'Pagos anulados', value: Number(summary.reversed_amount || 0), format: money, note: 'No cuentan en las ventas' },
        ]} />

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <ChartCard style={wide ? { flex: 1.6, minWidth: 0 } : null} title={spanDays === 1 ? 'Ventas del día por hora' : 'Ventas por día'} figure={money(summary.net_sales)}
            note={change === 0 ? null : changeText} noteTone={change > 0 ? 'success' : 'critical'}>
            {spanDays === 1 ? <BarChart data={hours} valueOf={h => Number(h.total || 0)} labelOf={(h, long) => long ? `${h.hora}:00 – ${h.hora + 1}:00` : `${h.hora}`} />
              : <LineChart data={timeline} valueOf={d => Number(d.ventas || 0)} labelOf={(d, long) => long ? longDay(d) : shortDate(d.fecha, spanDays)} />}
          </ChartCard>
          <ChartCard style={cardW} title="Ventas por hora" figure={peak ? `${String(peak.hora).padStart(2, '0')}:00` : '—'} note={peak ? `hora más fuerte · ${money(peak.total)}` : 'sin ventas'}
            actions={<Segmented value={hourMetric} onChange={setHourMetric} accessibilityLabel="Qué mostrar" options={[{ value: 'ventas', label: '$' }, { value: 'cuentas', label: 'Cuentas' }]} />}>
            <BarChart data={hours} valueOf={h => Number(hourMetric === 'ventas' ? h.total : h.pedidos) || 0} format={hourMetric === 'ventas' ? money : v => `${integer(v)} cuentas`}
              labelOf={(h, long) => long ? `${String(h.hora).padStart(2, '0')}:00 · ${hourMetric === 'ventas' ? `${integer(h.pedidos)} cuentas` : money(h.total)}` : `${h.hora}`} />
          </ChartCard>
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <ChartCard style={wide ? { flex: 1.6, minWidth: 0 } : null} title="Meseros" figure={waiters.length ? waiters[0].nombre : null}
            note={waiters.length ? `el que más vendió · ${money(waiters[0].total)}` : 'Ventas, ticket promedio y propinas de cada uno'}>
            <WaiterTable rows={waiters} total={Number(summary.net_sales || 0)} phone={phone} />
          </ChartCard>
          {spanDays >= 7 ? <ChartCard style={cardW} title="Día de la semana" figure={bestWeekday?.promedio ? bestWeekday.nombre : '—'} note={bestWeekday?.promedio ? `el mejor día · ${money(bestWeekday.promedio)} en promedio` : 'sin ventas'}>
            <BarChart data={weekdays} valueOf={d => d.promedio} labelOf={(d, long) => long ? `${d.nombre} · ${d.dias} ${d.dias === 1 ? 'día' : 'días'} · total ${money(d.total)}` : d.nombre} />
          </ChartCard>
            : <ChartCard style={cardW} title="Cómo pagan" figure={money(totalMethodSales)} note={`${(report?.methods || []).length} métodos`}>
              <SplitBar items={report?.methods || []} total={totalMethodSales} empty="Todavía no hay pagos en este periodo." />
            </ChartCard>}
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <ChartCard style={wide ? { flex: 1.6, minWidth: 0 } : null} title="Lo más vendido" figure={products.length ? integer(products.reduce((s, p) => s + Number(p.unidades || 0), 0)) : null} note="unidades"
            actions={products.length > 8 ? <Button size="sm" variant="tertiary" onPress={() => setAllProducts(v => !v)}>{allProducts ? 'Ver menos' : `Ver los ${products.length}`}</Button> : null}>
            <RankList rows={shownProducts} labelOf={p => p.categoria ? `${p.nombre}  ·  ${p.categoria}` : p.nombre} valueOf={p => Number(p.unidades || 0)} metaOf={p => `${integer(p.unidades)} u`} amountOf={p => money(p.total)} empty="Aún no hay productos vendidos en este periodo." />
          </ChartCard>
          <View style={[cardW, { gap: space.lg }]}>
            <ChartCard title="Por categoría" figure={(report?.categories || [])[0]?.nombre || null} note={(report?.categories || []).length ? 'la que más vende' : null}>
              <SplitBar items={report?.categories || []} empty="Sin ventas por categoría en este periodo." />
            </ChartCard>
            {spanDays >= 7 ? <ChartCard title="Cómo pagan" figure={money(totalMethodSales)} note={`${(report?.methods || []).length} métodos`}>
              <SplitBar items={report?.methods || []} total={totalMethodSales} empty="Todavía no hay pagos en este periodo." />
            </ChartCard> : null}
            <ChartCard title="Por canal" figure={money(summary.net_sales)} note={`${(report?.channels || []).length} canales`}>
              <SplitBar items={report?.channels || []} total={Number(summary.net_sales || 0)} empty="Sin ventas por canal en este periodo." />
            </ChartCard>
          </View>
        </View>
      </View></FadeIn>}
  </ScrollView>;
}
