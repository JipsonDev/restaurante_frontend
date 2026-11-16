import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { AlertTriangle, BarChart3 } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, percentage, REPORT_PERIODS, shortDate } from '../utils/reportLogic.mjs';
import { Button, Card, EmptyState, FadeIn, Metric, PageHeader, SectionTitle, Segmented, Skeleton, space, type } from '../components/admin/ui';

const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const integer = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 });
const reportError = error => error.response?.data?.message || error.message || 'No se pudo cargar el reporte.';
const WEB = Platform.OS === 'web';

// Línea de ventas con lectura al pasar el cursor o el dedo: muestra el día y su monto.
function SalesLineChart({ data, days }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const height = 220;
  const max = Math.max(...data.map(item => Number(item.ventas || 0)), 1);
  const w = Math.max(width, 280);
  const top = 12, bottom = height - 8;
  const points = data.map((item, index) => ({
    x: data.length === 1 ? w / 2 : 4 + index * ((w - 8) / Math.max(data.length - 1, 1)),
    y: bottom - (Number(item.ventas || 0) / max) * (bottom - top), ...item,
  }));
  const line = points.map((pt, i) => `${i ? 'L' : 'M'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z` : '';
  const pick = x => { if (!points.length) return; let best = 0; points.forEach((pt, i) => { if (Math.abs(pt.x - x) < Math.abs(points[best].x - x)) best = i; }); setHover(best); };
  const hp = hover != null ? points[hover] : null;
  const labels = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const handlers = WEB ? { onMouseMove: e => pick(e.nativeEvent.offsetX ?? e.nativeEvent.locationX), onMouseLeave: () => setHover(null) }
    : { onStartShouldSetResponder: () => true, onResponderMove: e => pick(e.nativeEvent.locationX), onResponderGrant: e => pick(e.nativeEvent.locationX), onResponderRelease: () => setHover(null) };
  return <View accessibilityLabel={`Gráfico de ventas de ${days} días`}>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{ height }} {...handlers}>
      {!!width && <Svg width={width} height={height} viewBox={`0 0 ${w} ${height}`} style={{ pointerEvents: 'none' }}>
        <Defs><LinearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity="0.22" /><Stop offset="1" stopColor={c.primary} stopOpacity="0" /></LinearGradient></Defs>
        {[0, 0.5, 1].map(v => <Line key={v} x1="0" y1={top + v * (bottom - top)} x2={w} y2={top + v * (bottom - top)} stroke={c.line} strokeWidth="1" strokeDasharray={v === 1 ? undefined : '3 4'} />)}
        {!!area && <Path d={area} fill="url(#salesFill)" />}
        {!!line && <Path d={line} fill="none" stroke={c.primary} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>}
      {hp ? <>
        <View pointerEvents="none" style={{ position: 'absolute', left: hp.x, top: 0, bottom: 0, width: 1, backgroundColor: c.lineStrong }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: hp.x - 5, top: hp.y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: c.surface, borderWidth: 2, borderColor: c.primary }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: Math.min(Math.max(hp.x - 70, 0), Math.max(width - 140, 0)), width: 140, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: c.ink }}>
          <Text style={[type.micro, { color: c.onInk, opacity: 0.7 }]}>{shortDate(hp.fecha, Math.min(days, 30))}</Text>
          <Text style={[type.body, type.num, { color: c.onInk, fontWeight: '600' }]}>{money(hp.ventas)}</Text>
          {hp.pedidos != null ? <Text style={[type.micro, { color: c.onInk, opacity: 0.7 }]}>{integer(hp.pedidos)} pedidos</Text> : null}
        </View>
      </> : null}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>{labels.map(i => <Text key={data[i]?.fecha || i} style={[type.micro, { color: c.faint }]}>{shortDate(data[i]?.fecha, days)}</Text>)}</View>
  </View>;
}

// Reparto: una barra apilada y una fila por elemento, con su participación.
function Distribution({ items, total, empty }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(null);
  const colors = [c.primary, c.sky, c.green, c.purple, c.pink];
  if (!items.length) return <Text style={[type.small, { color: c.faint, paddingVertical: space.lg }]}>{empty}</Text>;
  return <View style={{ gap: space.md }}>
    <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
      {items.map((item, i) => <View key={item.nombre} style={{ flex: Math.max(Number(item.total || 0), 0.0001), backgroundColor: colors[i % colors.length], opacity: focus == null || focus === i ? 1 : 0.3 }} />)}
    </View>
    {items.map((item, i) => <View key={item.nombre} onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(null)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 2, opacity: focus == null || focus === i ? 1 : 0.55 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
      <Text numberOfLines={1} style={[type.body, { flex: 1, color: c.text }]}>{item.nombre}</Text>
      <Text style={[type.small, type.num, { color: c.faint, width: 48, textAlign: 'right' }]}>{percentage(item.total, total)}%</Text>
      <Text style={[type.body, type.num, { color: c.text, fontWeight: '600', width: 96, textAlign: 'right' }]}>{money(item.total)}</Text>
    </View>)}
  </View>;
}

// Pedidos por hora (7:00–22:00); la hora pico va en dorado, el resto neutro.
function HourChart({ items, peak }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(null);
  const hours = Array.from({ length: 16 }, (_, i) => i + 7).map(h => items.find(it => Number(it.hora) === h) || { hora: h, total: 0, pedidos: 0 });
  const max = Math.max(...hours.map(it => Number(it.pedidos || 0)), 1);
  const shown = hover != null ? hours[hover] : null;
  return <View>
    <Text style={[type.small, type.num, { color: c.muted, height: 18 }]}>{shown ? `${String(shown.hora).padStart(2, '0')}:00 · ${integer(shown.pedidos)} pedidos · ${money(shown.total)}` : ' '}</Text>
    <View style={{ flexDirection: 'row', height: 140, gap: 3, alignItems: 'flex-end', marginTop: space.sm }}>
      {hours.map((it, i) => {
        const isPeak = peak && Number(peak.hora) === it.hora;
        return <View key={it.hora} accessibilityLabel={`${it.hora}:00, ${it.pedidos} pedidos`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
          style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
          <View style={{ height: `${Math.max(3, Number(it.pedidos || 0) / max * 100)}%`, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: isPeak ? c.primary : hover === i ? c.text : c.lineStrong }} />
        </View>;
      })}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>{['07', '11', '15', '19', '22'].map(h => <Text key={h} style={[type.micro, type.num, { color: c.faint }]}>{h}:00</Text>)}</View>
  </View>;
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
  const topUnits = Math.max(...products.map(p => Number(p.unidades || 0)), 1);
  const change = Number(summary.change_percent || 0);

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title="Reportes" description={`Ventas cobradas, pedidos y demanda · ${periodLabel}`}
      actions={<Segmented value={days} onChange={setDays} accessibilityLabel="Periodo" options={REPORT_PERIODS.map(p => ({ value: p.days, label: p.label }))} />} />
    {!!error && <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg, backgroundColor: c.redSoft, borderColor: 'transparent' }} padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, flex: 1 }} accessibilityRole="alert"><AlertTriangle size={17} color={c.red} /><Text style={[type.small, { flex: 1, color: c.red }]}>{error}</Text><Button size="sm" variant="ghost" onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button></View>
    </Card>}
    {loading && !report ? <View style={{ gap: space.lg }}><Skeleton height={120} radius={14} /><View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}><Skeleton height={280} radius={14} style={{ flex: 1.7 }} /><Skeleton height={280} radius={14} style={{ flex: 1 }} /></View></View>
      : !report ? <EmptyState icon={BarChart3} title="Sin datos para mostrar" description="No pudimos cargar el reporte de este periodo." action={<Button onPress={() => setRefreshKey(v => v + 1)}>Reintentar</Button>} />
      : <FadeIn trigger={days} duration={220} offset={4}><View style={{ gap: space.lg }}>
        <Card>
          <View style={{ flexDirection: phone ? 'column' : 'row', gap: phone ? space.lg : space.x3, marginBottom: space.xl }}>
            <Metric size="lg" label="Ventas netas" value={Number(summary.net_sales || 0)} format={money} note={`${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}% frente al periodo anterior`} noteTone={change >= 0 ? 'green' : 'red'} />
            <View style={{ flexDirection: 'row', flex: 1, flexWrap: 'wrap', gap: space.xl, justifyContent: phone ? 'flex-start' : 'flex-end', alignItems: 'flex-end' }}>
              <Metric size="sm" label="Pedidos cobrados" value={Number(summary.paid_orders || 0)} format={integer} note={`${integer(summary.payments)} transacciones`} />
              <Metric size="sm" label="Ticket promedio" value={Number(summary.average_ticket || 0)} format={money} note="por pedido cobrado" />
              <Metric size="sm" label="Cancelaciones" value={Number(summary.cancelled_orders || 0)} format={integer} note={`${money(summary.reversed_amount)} revertido`} noteTone={Number(summary.cancelled_orders) ? 'red' : undefined} />
            </View>
          </View>
          <SalesLineChart data={timeline} days={days} />
        </Card>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <Card style={{ flex: wide ? 1.25 : undefined, minWidth: 0 }}>
            <SectionTitle title="Lo más vendido" description="Unidades en cuentas cobradas del periodo" />
            {products.length ? products.map((p, i) => <View key={p.id ?? p.nombre} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text style={[type.small, type.num, { width: 20, color: i < 3 ? c.text : c.faint, fontWeight: i < 3 ? '700' : '400' }]}>{i + 1}</Text>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Text numberOfLines={1} style={[type.body, { color: c.text }]}>{p.nombre}</Text>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: c.soft }}><View style={{ height: 4, borderRadius: 2, width: `${Number(p.unidades || 0) / topUnits * 100}%`, backgroundColor: i === 0 ? c.primary : c.lineStrong }} /></View>
              </View>
              <Text style={[type.small, type.num, { color: c.muted, width: 56, textAlign: 'right' }]}>{integer(p.unidades)} ud.</Text>
              <Text style={[type.body, type.num, { color: c.text, fontWeight: '600', width: 92, textAlign: 'right' }]}>{money(p.total)}</Text>
            </View>) : <Text style={[type.small, { color: c.faint }]}>Aún no hay productos cobrados en este periodo.</Text>}
          </Card>
          <Card style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
            <SectionTitle title="Demanda por hora" description={peak ? `Hora pico ${String(peak.hora).padStart(2, '0')}:00 · ${money(peak.total)}` : 'Sin hora pico registrada'} />
            <HourChart items={report?.hours || []} peak={peak} />
          </Card>
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg }}>
          <Card style={{ flex: 1, minWidth: 0 }}><SectionTitle title="Cómo pagan" description="Participación sobre las ventas netas" /><Distribution items={report?.methods || []} total={totalMethodSales} empty="Todavía no hay pagos en este periodo." /></Card>
          <Card style={{ flex: 1, minWidth: 0 }}><SectionTitle title="Por canal" description="De dónde vienen los ingresos" /><Distribution items={report?.channels || []} total={Number(summary.net_sales || 0)} empty="Sin ventas por canal en este periodo." /></Card>
        </View>
        <Text style={[type.micro, { color: c.faint }]}>Fuente: pagos activos, pedidos y detalle de productos.{report?.generated_at ? ` Actualizado ${new Date(report.generated_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}.` : ''}</Text>
      </View></FadeIn>}
  </ScrollView>;
}
