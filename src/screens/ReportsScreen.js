import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, REPORT_PERIODS, shortDate } from '../utils/reportLogic.mjs';
import { Badge, Banner, Button, Card, EmptyState, FadeIn, PageHeader, Segmented, Skeleton, space, type } from '../components/admin/ui';
import { BarChart, LineChart, MetricsCard, RankList, SplitBar } from '../components/admin/analytics';

const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const integer = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 });
const reportError = error => error.response?.data?.message || error.message || 'No se pudo cargar el reporte.';

// Encabezado de tarjeta de gráfico: título, cifra principal y nota.
function ChartCard({ title, figure, note, noteTone, children, style }) {
  const { c } = useTheme();
  return <Card style={style}>
    <View style={{ marginBottom: space.md }}>
      <Text style={[type.h2, { color: c.text }]}>{title}</Text>
      {figure != null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', marginTop: 2 }}>
        <Text style={[type.figure, { fontSize: 20, lineHeight: 28, color: c.text }]}>{figure}</Text>
        {note ? (noteTone ? <Badge tone={noteTone}>{note}</Badge> : <Text style={[type.body, { color: c.muted }]}>{note}</Text>) : null}
      </View> : null}
    </View>
    {children}
  </Card>;
}

export default function ReportsScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 700, wide = width >= 1120;
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef(0);

  // Al cambiar de periodo se muestra la carga; las actualizaciones de fondo (cada 60 s) son silenciosas.
  const lastDaysRef = useRef(days);
  useEffect(() => {
    const request = ++requestRef.current;
    const controller = new AbortController();
    const silent = lastDaysRef.current === days && !!report;
    lastDaysRef.current = days;
    if (!silent) { setLoading(true); setError(''); }
    axios.get(`${BASE_URL}/dashboard/reports`, { params: { days }, signal: controller.signal, timeout: 15000 })
      .then(({ data }) => { if (request === requestRef.current) { setReport(data); setError(''); } })
      .catch(error => { if (request === requestRef.current && error.code !== 'ERR_CANCELED' && !silent) setError(reportError(error)); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [days, refreshKey]);
  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') setRefreshKey(v => v + 1);
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  const timeline = useMemo(() => completeTimeline(report?.timeline, days), [report?.timeline, days]);
  const summary = report?.summary || {};
  const peak = bestHour(report?.hours || []);
  const totalMethodSales = (report?.methods || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const periodLabel = REPORT_PERIODS.find(item => item.days === days)?.label || `${days} días`;

  const products = report?.products || [];
  const change = Number(summary.change_percent || 0);
  const hours = Array.from({ length: 16 }, (_, i) => i + 7).map(h => (report?.hours || []).find(it => Number(it.hora) === h) || { hora: h, total: 0, pedidos: 0 });
  const updated = report?.generated_at ? new Date(report.generated_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : null;
  const longDay = d => new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' });
  const cardW = wide ? { flex: 1, minWidth: 0 } : null;

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title="Reportes" description={`${periodLabel === 'Hoy' ? 'Hoy' : `Últimos ${periodLabel}`}${updated ? ` · actualizado ${updated}` : ''}`}
      actions={<Segmented value={days} onChange={setDays} accessibilityLabel="Periodo" options={REPORT_PERIODS.map(p => ({ value: p.days, label: p.label }))} />} />
    {!!error && <Banner tone="critical" style={{ marginBottom: space.lg }} action={<Button size="sm" onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button>}>{error}</Banner>}
    {loading && !report ? <View style={{ gap: space.lg }}><Skeleton height={84} radius={12} /><View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}><Skeleton height={300} radius={12} style={{ flex: 1 }} /><Skeleton height={300} radius={12} style={{ flex: 1 }} /></View></View>
      : !report ? <Card><EmptyState icon={BarChart3} title="Sin datos para mostrar" description="No pudimos cargar el reporte de este periodo." action={<Button onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button>} /></Card>
      : <FadeIn trigger={days}><View style={{ gap: space.lg }}>
        <MetricsCard items={[
          { label: 'Ventas netas', value: Number(summary.net_sales || 0), format: money, note: change === 0 ? 'Igual que el período anterior' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% vs. anterior`, noteTone: change > 0 ? 'green' : change < 0 ? 'red' : null },
          { label: 'Pedidos cobrados', value: Number(summary.paid_orders || 0), format: integer, note: `${integer(summary.payments)} transacciones` },
          { label: 'Ticket promedio', value: Number(summary.average_ticket || 0), format: money, note: 'Por pedido cobrado' },
          { label: 'Cancelaciones', value: Number(summary.cancelled_orders || 0), format: integer, note: `${money(summary.reversed_amount)} revertido`, noteTone: Number(summary.cancelled_orders) ? 'red' : null },
        ]} />
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <ChartCard style={wide ? { flex: 1.6, minWidth: 0 } : null} title="Ventas a lo largo del tiempo" figure={money(summary.net_sales)}
            note={change === 0 ? null : `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} noteTone={change > 0 ? 'success' : change < 0 ? 'critical' : null}>
            {days === 1 ? <BarChart data={hours} valueOf={h => Number(h.total || 0)} labelOf={(h, long) => long ? `${h.hora}:00 – ${h.hora + 1}:00` : `${h.hora}`} />
              : <LineChart data={timeline} valueOf={d => Number(d.ventas || 0)} labelOf={(d, long) => long ? longDay(d) : shortDate(d.fecha, days)} />}
          </ChartCard>
          <ChartCard style={cardW} title="Demanda por hora" figure={peak ? `${String(peak.hora).padStart(2, '0')}:00` : '—'} note={peak ? `hora pico · ${money(peak.total)}` : 'sin hora pico'}>
            <BarChart data={hours} valueOf={h => Number(h.pedidos || 0)} format={v => `${integer(v)} pedidos`}
              labelOf={(h, long) => long ? `${String(h.hora).padStart(2, '0')}:00 · ${money(h.total)}` : `${h.hora}`} />
          </ChartCard>
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <ChartCard style={wide ? { flex: 1.6, minWidth: 0 } : null} title="Lo más vendido" figure={products.length ? integer(products.reduce((s, p) => s + Number(p.unidades || 0), 0)) : null} note="unidades en el top">
            <RankList rows={products} labelOf={p => p.nombre} valueOf={p => Number(p.unidades || 0)} metaOf={p => `${integer(p.unidades)} u`} amountOf={p => money(p.total)} empty="Aún no hay productos cobrados en este periodo." />
          </ChartCard>
          <View style={[cardW, { gap: space.lg }]}>
            <ChartCard title="Cómo pagan" figure={money(totalMethodSales)} note={`${(report?.methods || []).length} métodos`}>
              <SplitBar items={report?.methods || []} total={totalMethodSales} empty="Todavía no hay pagos en este periodo." />
            </ChartCard>
            <ChartCard title="Por canal" figure={money(summary.net_sales)} note={`${(report?.channels || []).length} canales`}>
              <SplitBar items={report?.channels || []} total={Number(summary.net_sales || 0)} empty="Sin ventas por canal en este periodo." />
            </ChartCard>
          </View>
        </View>
      </View></FadeIn>}
  </ScrollView>;
}
