import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { AlertTriangle, BarChart3, CalendarRange, CircleDollarSign, Clock3, CreditCard, PackageOpen, ReceiptText, RefreshCw, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, percentage, REPORT_PERIODS, shortDate } from '../utils/reportLogic.mjs';

const row = { flexDirection: 'row', alignItems: 'center' };
const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const integer = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 });
const reportError = error => error.response?.data?.message || error.message || 'No se pudo cargar el reporte.';

function Panel({ title, subtitle, icon: Icon, action, children, style }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }, style]}>
    <View style={[row, { minHeight: 67, paddingHorizontal: 17, paddingVertical: 13, gap: 11, borderBottomWidth: 1, borderBottomColor: c.line }]}>
      {Icon && <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={c.primaryText} strokeWidth={1.8} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>{subtitle && <Text style={{ color: c.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }}>{subtitle}</Text>}</View>
      {action}
    </View>
    {children}
  </View>;
}

function Metric({ label, value, hint, icon: Icon, tone, soft, width, trend }) {
  const { c } = useTheme();
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
  return <View style={{ width, flexGrow: 1, minWidth: 0, minHeight: 108, padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 9 }}>
    <View style={[row, { justifyContent: 'space-between', gap: 8 }]}><Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text><View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={tone} /></View></View>
    <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: c.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.5, marginTop: 8, fontVariant: ['tabular-nums'] }}>{value}</Text>
    <View style={[row, { gap: 5, marginTop: 6 }]}>{trend != null && <TrendIcon size={12} color={trend >= 0 ? c.green : c.red} />}<Text numberOfLines={1} style={{ flex: 1, color: trend == null ? c.faint : trend >= 0 ? c.green : c.red, fontSize: 9, fontWeight: '600' }}>{trend == null ? hint : `${Math.abs(trend).toFixed(1)}% ${hint}`}</Text></View>
  </View>;
}

function SalesLineChart({ data, days }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 218;
  const max = Math.max(...data.map(item => Number(item.ventas || 0)), 1);
  const chartWidth = Math.max(width, 280);
  const plotTop = 15, plotBottom = height - 28;
  const points = data.map((item, index) => ({
    x: data.length === 1 ? chartWidth / 2 : 12 + index * ((chartWidth - 24) / Math.max(data.length - 1, 1)),
    y: plotBottom - (Number(item.ventas || 0) / max) * (plotBottom - plotTop),
    ...item,
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x.toFixed(1)} ${plotBottom} L ${points[0].x.toFixed(1)} ${plotBottom} Z` : '';
  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  return <View accessibilityLabel={`Gráfico de ventas de ${days} días`} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
      {!!width && <Svg width={width} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs><LinearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity="0.34" /><Stop offset="1" stopColor={c.primary} stopOpacity="0.02" /></LinearGradient></Defs>
        {[0, 0.33, 0.66, 1].map(value => <Line key={value} x1="0" y1={plotTop + value * (plotBottom - plotTop)} x2={chartWidth} y2={plotTop + value * (plotBottom - plotTop)} stroke={c.line} strokeWidth="1" />)}
        {!!area && <Path d={area} fill="url(#salesFill)" />}
        {!!line && <Path d={line} fill="none" stroke={c.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {points.length <= 30 && points.map(point => <Circle key={point.fecha} cx={point.x} cy={point.y} r="3.5" fill={c.surface} stroke={c.primary} strokeWidth="2" />)}
      </Svg>}
    </View>
    <View style={[row, { justifyContent: 'space-between', marginTop: -19 }]}>{labelIndexes.map(index => <Text key={data[index]?.fecha || index} style={{ color: c.faint, fontSize: 9 }}>{shortDate(data[index]?.fecha, days)}</Text>)}</View>
    <View style={[row, { justifyContent: 'space-between', marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderColor: c.line }]}><Text style={{ color: c.muted, fontSize: 10 }}>Máximo diario</Text><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{money(max === 1 && !data.some(item => item.ventas) ? 0 : max)}</Text></View>
  </View>;
}

function Distribution({ items, total }) {
  const { c } = useTheme();
  const colors = [c.primary, c.sky, c.green, c.purple || '#7C3AED', c.pink || '#BE185D'];
  if (!items.length) return <Empty text="Todavía no hay pagos registrados en este período." />;
  return <View style={{ padding: 16, gap: 14 }}>{items.map((item, index) => {
    const share = percentage(item.total, total);
    return <View key={item.nombre} style={{ gap: 7 }}><View style={[row, { justifyContent: 'space-between', gap: 10 }]}><View style={[row, { gap: 7, flex: 1 }]}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors[index % colors.length] }} /><Text numberOfLines={1} style={{ color: c.text, fontSize: 11, fontWeight: '600', flex: 1 }}>{item.nombre}</Text></View><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{money(item.total)}</Text><Text style={{ width: 38, textAlign: 'right', color: c.muted, fontSize: 10 }}>{share.toFixed(0)}%</Text></View><View style={{ height: 5, borderRadius: 3, backgroundColor: c.soft, overflow: 'hidden' }}><View style={{ width: `${share}%`, height: 5, borderRadius: 3, backgroundColor: colors[index % colors.length] }} /></View></View>;
  })}</View>;
}

function HourChart({ items }) {
  const { c } = useTheme();
  const hours = Array.from({ length: 16 }, (_, index) => index + 7).map(hour => items.find(item => Number(item.hora) === hour) || { hora: hour, total: 0, pedidos: 0 });
  const max = Math.max(...hours.map(item => item.pedidos), 1);
  return <View style={{ padding: 16 }}><View style={[row, { height: 146, gap: 4, alignItems: 'flex-end', borderBottomWidth: 1, borderColor: c.line }]}>{hours.map(item => <View key={item.hora} accessibilityLabel={`${item.hora}:00, ${item.pedidos} pedidos`} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}><View style={{ width: '72%', minWidth: 5, height: item.pedidos ? Math.max(8, item.pedidos / max * 126) : 3, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: item.pedidos ? c.sky : c.soft }} /></View>)}</View><View style={[row, { justifyContent: 'space-between', marginTop: 8 }]}>{[7, 10, 13, 16, 19, 22].map(hour => <Text key={hour} style={{ color: c.faint, fontSize: 9 }}>{hour}:00</Text>)}</View></View>;
}

function Empty({ text }) {
  const { c } = useTheme();
  return <View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 22 }}><BarChart3 size={27} color={c.faint} /><Text style={{ color: c.muted, fontSize: 11, textAlign: 'center', lineHeight: 17 }}>{text}</Text></View>;
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

  useEffect(() => {
    const request = ++requestRef.current;
    const controller = new AbortController();
    setLoading(true); setError('');
    axios.get(`${BASE_URL}/dashboard/reports`, { params: { days }, signal: controller.signal, timeout: 15000 })
      .then(({ data }) => { if (request === requestRef.current) setReport(data); })
      .catch(error => { if (request === requestRef.current && error.code !== 'ERR_CANCELED') setError(reportError(error)); })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [days, refreshKey]);

  const timeline = useMemo(() => completeTimeline(report?.timeline, days), [report?.timeline, days]);
  const summary = report?.summary || {};
  const peak = bestHour(report?.hours || []);
  const totalMethodSales = (report?.methods || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const periodLabel = REPORT_PERIODS.find(item => item.days === days)?.label || `${days} días`;

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', justifyContent: 'space-between', gap: 14 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>ANÁLISIS DEL NEGOCIO</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: phone ? 25 : 30, fontWeight: '700', letterSpacing: -0.7 }}>Reportes</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Ventas cobradas, demanda y rendimiento a partir de los movimientos reales.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Actualizar reporte" disabled={loading} onPress={() => setRefreshKey(value => value + 1)} style={({ hovered }) => [row, { alignSelf: phone ? 'flex-start' : 'center', minHeight: 42, paddingHorizontal: 13, gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 8, backgroundColor: hovered ? c.soft : c.surface, opacity: loading ? 0.6 : 1 }]}><RefreshCw size={16} color={c.primaryText} /><Text style={{ color: c.text, fontSize: 11, fontWeight: '600' }}>Actualizar</Text></Pressable>
    </View>

    <View style={[row, { minHeight: 54, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 9, paddingHorizontal: 10, gap: 8 }]}><CalendarRange size={17} color={c.muted} /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, maxHeight: 52 }} contentContainerStyle={{ height: 52, alignItems: 'center', gap: 6 }}>{REPORT_PERIODS.map(period => <Pressable key={period.days} accessibilityRole="button" accessibilityState={{ selected: days === period.days }} onPress={() => setDays(period.days)} style={{ minHeight: 34, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 7, backgroundColor: days === period.days ? c.primary : 'transparent' }}><Text style={{ color: days === period.days ? c.onPrimary : c.muted, fontSize: 11, fontWeight: days === period.days ? '700' : '500' }}>{period.label}</Text></Pressable>)}</ScrollView><View style={{ flex: 1 }} />{!phone && <View style={[row, { gap: 6 }]}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: error ? c.red : c.green }} /><Text style={{ color: c.faint, fontSize: 10 }}>{error ? 'Datos no disponibles' : `Datos reales · ${periodLabel}`}</Text></View>}</View>

    {!!error && <View accessibilityRole="alert" style={[row, { padding: 13, gap: 10, borderRadius: 8, backgroundColor: c.redSoft }]}><AlertTriangle size={17} color={c.red} /><Text style={{ flex: 1, color: c.red, fontSize: 11 }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRefreshKey(value => value + 1)} style={{ padding: 8 }}><Text style={{ color: c.red, fontWeight: '700', fontSize: 11 }}>Reintentar</Text></Pressable></View>}

    {loading && !report ? <View style={{ minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color={c.primary} /><Text style={{ color: c.muted, fontSize: 12 }}>Calculando indicadores…</Text></View> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, opacity: loading ? 0.65 : 1 }}>
        <Metric width={phone ? '47%' : '23%'} label="Ventas netas" value={money(summary.net_sales)} hint="vs. período anterior" trend={Number(summary.change_percent || 0)} icon={CircleDollarSign} tone={c.green} soft={c.greenSoft} />
        <Metric width={phone ? '47%' : '23%'} label="Pedidos cobrados" value={integer(summary.paid_orders)} hint={`${integer(summary.payments)} transacciones`} icon={ShoppingBag} tone={c.primaryText} soft={c.primarySoft} />
        <Metric width={phone ? '47%' : '23%'} label="Ticket promedio" value={money(summary.average_ticket)} hint="por pedido con cobro" icon={ReceiptText} tone={c.sky} soft={c.skySoft} />
        <Metric width={phone ? '47%' : '23%'} label="Cancelaciones" value={integer(summary.cancelled_orders)} hint={`${money(summary.reversed_amount)} revertido`} icon={AlertTriangle} tone={c.red} soft={c.redSoft} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
        <Panel style={{ flex: wide ? 1.7 : undefined, minWidth: 0 }} icon={TrendingUp} title="Evolución de ventas" subtitle={`Ingresos efectivamente cobrados · ${periodLabel}`} action={<Text style={{ color: c.green, fontSize: 13, fontWeight: '700' }}>{money(summary.net_sales)}</Text>}><SalesLineChart data={timeline} days={days} /></Panel>
        <Panel style={{ flex: wide ? 1 : undefined, minWidth: 0 }} icon={CreditCard} title="Métodos de pago" subtitle="Participación sobre las ventas netas"><Distribution items={report?.methods || []} total={totalMethodSales} /></Panel>
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
        <Panel style={{ flex: wide ? 1.25 : undefined, minWidth: 0 }} icon={PackageOpen} title="Productos más vendidos" subtitle="Unidades incluidas en cuentas con cobros del período">
          {(report?.products || []).length ? <View>{!phone && <View style={[row, { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: c.surfaceAlt }]}><Text style={{ flex: 1, color: c.faint, fontSize: 9, fontWeight: '700' }}>PRODUCTO</Text><Text style={{ width: 75, textAlign: 'right', color: c.faint, fontSize: 9, fontWeight: '700' }}>UNIDADES</Text><Text style={{ width: 92, textAlign: 'right', color: c.faint, fontSize: 9, fontWeight: '700' }}>VALOR</Text></View>}{report.products.map((product, index) => <View key={product.id} style={[row, { minHeight: 51, paddingHorizontal: 16, paddingVertical: 9, borderTopWidth: index || phone ? 1 : 0, borderColor: c.line }]}><View style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: index < 3 ? c.primarySoft : c.soft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}><Text style={{ color: index < 3 ? c.primaryText : c.muted, fontSize: 10, fontWeight: '700' }}>{index + 1}</Text></View><Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.text, fontSize: 11, fontWeight: '600' }}>{product.nombre}</Text><Text style={{ width: 75, textAlign: 'right', color: c.muted, fontSize: 11 }}>{Number(product.unidades).toLocaleString('es-EC', { maximumFractionDigits: 2 })}</Text><Text style={{ width: 92, textAlign: 'right', color: c.text, fontSize: 11, fontWeight: '700' }}>{money(product.total)}</Text></View>)}</View> : <Empty text="No hay productos asociados a cobros en este período." />}
        </Panel>
        <Panel style={{ flex: wide ? 1 : undefined, minWidth: 0 }} icon={Clock3} title="Demanda por hora" subtitle={peak ? `Mayor venta a las ${String(peak.hora).padStart(2, '0')}:00 · ${money(peak.total)}` : 'Sin una hora pico registrada'}><HourChart items={report?.hours || []} /></Panel>
      </View>

      <Panel icon={BarChart3} title="Ventas por canal" subtitle="Origen de los ingresos cobrados">
        <Distribution items={report?.channels || []} total={Number(summary.net_sales || 0)} />
      </Panel>

      <View style={[row, { justifyContent: 'space-between', gap: 12, paddingHorizontal: 2, flexWrap: 'wrap' }]}><Text style={{ color: c.faint, fontSize: 9 }}>Fuente: pagos activos, pedidos y detalle de productos del sistema.</Text><Text style={{ color: c.faint, fontSize: 9 }}>{report?.generated_at ? `Actualizado ${new Date(report.generated_at).toLocaleString('es-EC')}` : ''}</Text></View>
    </>}
  </ScrollView>;
}
