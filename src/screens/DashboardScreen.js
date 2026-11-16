import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { AlertTriangle, ArrowUpRight, CalendarDays, ChefHat, ChevronRight, CircleDollarSign, Clock3, CreditCard, Package, ReceiptText, RefreshCw, ShoppingBag, TrendingDown, TrendingUp, WalletCards } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { bestHour, completeTimeline, percentage, shortDate } from '../utils/reportLogic.mjs';

const row = { flexDirection: 'row', alignItems: 'center' };
const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const integer = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 });
const stateLabels = { PENDIENTE: 'Pendientes', PREPARANDO: 'En cocina', LISTO: 'Listos', ENTREGADO: 'Entregados' };
const orderLocation = order => order.mesa_id ? `Mesa ${order.mesa_numero || order.mesa_id}` : order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar';
const stockOf = item => Number(item.stock_disponible ?? item.inventario_stock ?? item.stock ?? 0);

function Link({ children, onPress, icon: Icon = ChevronRight, label }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label || children} onPress={onPress} style={({ hovered }) => [row, { minHeight: 40, paddingHorizontal: 8, gap: 5, opacity: hovered ? 0.65 : 1 }]}><Text style={{ color: c.primaryText, fontSize: 11, fontWeight: '700' }}>{children}</Text><Icon size={14} color={c.primaryText} /></Pressable>;
}

function Panel({ title, subtitle, icon: Icon, action, children, style }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }, style]}>
    <View style={[row, { minHeight: 65, paddingHorizontal: 17, paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: c.line }]}>
      {Icon && <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Icon size={17} color={c.primaryText} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>{subtitle && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 10, marginTop: 4 }}>{subtitle}</Text>}</View>
      {action}
    </View>
    {children}
  </View>;
}

function Metric({ label, value, hint, icon: Icon, color, soft, width, trend, loading }) {
  const { c } = useTheme();
  const Trend = Number(trend) >= 0 ? TrendingUp : TrendingDown;
  return <View style={{ width, flexGrow: 1, minWidth: 0, minHeight: 108, padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 9 }}>
    <View style={[row, { justifyContent: 'space-between', gap: 8 }]}><Text style={{ flex: 1, color: c.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.25 }}>{label.toUpperCase()}</Text><View style={{ width: 29, height: 29, borderRadius: 7, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={color} /></View></View>
    {loading ? <ActivityIndicator color={c.primary} style={{ alignSelf: 'flex-start', marginTop: 15 }} /> : <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: c.text, fontSize: 23, fontWeight: '700', letterSpacing: -0.6, marginTop: 8, fontVariant: ['tabular-nums'] }}>{value}</Text>}
    {!loading && <View style={[row, { gap: 5, marginTop: 6 }]}>{trend != null && <Trend size={11} color={Number(trend) >= 0 ? c.green : c.red} />}<Text numberOfLines={1} style={{ flex: 1, color: trend == null ? c.faint : Number(trend) >= 0 ? c.green : c.red, fontSize: 9, fontWeight: '600' }}>{trend == null ? hint : `${Math.abs(Number(trend)).toFixed(1)}% ${hint}`}</Text></View>}
  </View>;
}

function TrendChart({ data, days }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 192, bottom = 164, top = 13;
  const chartWidth = Math.max(width, 280);
  const max = Math.max(...data.map(item => Number(item.ventas || 0)), 1);
  const points = data.map((item, index) => ({ ...item, x: data.length === 1 ? chartWidth / 2 : 10 + index * ((chartWidth - 20) / Math.max(1, data.length - 1)), y: bottom - Number(item.ventas || 0) / max * (bottom - top) }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = points.length ? `${line} L ${points.at(-1).x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z` : '';
  const labels = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  return <View accessibilityLabel={`Tendencia de ventas de ${days} días`} style={{ padding: 16, paddingTop: 12 }}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height }}>
      {!!width && <Svg width={width} height={height} viewBox={`0 0 ${chartWidth} ${height}`}>
        <Defs><LinearGradient id="dashboardSales" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={c.primary} stopOpacity="0.3" /><Stop offset="1" stopColor={c.primary} stopOpacity="0.015" /></LinearGradient></Defs>
        {[0, 0.34, 0.67, 1].map(level => <Line key={level} x1="0" y1={top + level * (bottom - top)} x2={chartWidth} y2={top + level * (bottom - top)} stroke={c.line} strokeWidth="1" />)}
        <Path d={area} fill="url(#dashboardSales)" />
        <Path d={line} fill="none" stroke={c.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.length <= 30 && points.map(point => <Circle key={point.fecha} cx={point.x} cy={point.y} r="3" fill={c.surface} stroke={c.primary} strokeWidth="2" />)}
      </Svg>}
    </View>
    <View style={[row, { justifyContent: 'space-between', marginTop: -18 }]}>{labels.map(index => <Text key={data[index]?.fecha || index} style={{ color: c.faint, fontSize: 9 }}>{shortDate(data[index]?.fecha, days)}</Text>)}</View>
  </View>;
}

function PaymentMix({ methods, total }) {
  const { c } = useTheme();
  const colors = [c.primary, c.sky, c.green, c.purple || '#7C3AED'];
  const circumference = 2 * Math.PI * 41;
  let offset = 0;
  return <View style={{ padding: 16, gap: 16 }}><View style={[row, { justifyContent: 'center', gap: 20, flexWrap: 'wrap' }]}>
    <View style={{ width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width="112" height="112" viewBox="0 0 112 112" style={{ position: 'absolute' }}><Circle cx="56" cy="56" r="41" fill="none" stroke={c.soft} strokeWidth="12" />{methods.map((item, index) => { const length = percentage(item.total, total) / 100 * circumference; const dashOffset = -offset; offset += length; return <Circle key={item.nombre} cx="56" cy="56" r="41" fill="none" stroke={colors[index % colors.length]} strokeWidth="12" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={dashOffset} transform="rotate(-90 56 56)" />; })}</Svg>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{money(total)}</Text><Text style={{ color: c.faint, fontSize: 8, marginTop: 3 }}>COBRADO</Text>
    </View>
    <View style={{ flex: 1, minWidth: 150, gap: 10 }}>{methods.length ? methods.slice(0, 4).map((item, index) => <View key={item.nombre} style={[row, { gap: 7 }]}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors[index % colors.length] }} /><Text numberOfLines={1} style={{ flex: 1, color: c.muted, fontSize: 10 }}>{item.nombre}</Text><Text style={{ color: c.text, fontSize: 10, fontWeight: '700' }}>{percentage(item.total, total).toFixed(0)}%</Text></View>) : <Text style={{ color: c.muted, fontSize: 10, lineHeight: 16 }}>Sin cobros en este período.</Text>}</View>
  </View></View>;
}

function Operation({ active, tables, caja, inventoryAlerts, navigate }) {
  const { c } = useTheme();
  const states = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO'];
  const occupied = tables.filter(table => ['Ocupada', 'Cuenta'].includes(table.estado)).length;
  const occupancy = tables.length ? occupied / tables.length * 100 : 0;
  const colors = { PENDIENTE: c.faint, PREPARANDO: c.amber, LISTO: c.green, ENTREGADO: c.sky };
  return <View style={{ padding: 16, gap: 17 }}>
    <View><View style={[row, { justifyContent: 'space-between', marginBottom: 10 }]}><Text style={{ color: c.muted, fontSize: 10 }}>Flujo de pedidos</Text><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{active.length} abiertos</Text></View><View style={[row, { gap: 5 }]}>{states.map(state => { const count = active.filter(order => String(order.estado).toUpperCase() === state).length; return <View key={state} accessibilityLabel={`${stateLabels[state]}: ${count}`} style={{ flex: 1, minWidth: 0, padding: 9, borderRadius: 7, backgroundColor: c.surfaceAlt, gap: 7 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors[state] }} /><Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{count}</Text><Text numberOfLines={1} style={{ color: c.faint, fontSize: 8 }}>{stateLabels[state]}</Text></View>; })}</View></View>
    <View><View style={[row, { justifyContent: 'space-between', marginBottom: 8 }]}><Text style={{ color: c.muted, fontSize: 10 }}>Ocupación del salón</Text><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{occupied} / {tables.length}</Text></View><View style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: c.soft }}><View style={{ height: 6, width: `${Math.min(100, occupancy)}%`, borderRadius: 3, backgroundColor: c.primary }} /></View></View>
    <Pressable accessibilityRole="button" onPress={() => navigate('caja')} style={({ hovered }) => [row, { padding: 11, gap: 10, borderRadius: 8, backgroundColor: hovered ? c.soft : c.surfaceAlt }]}><View style={{ width: 31, height: 31, borderRadius: 7, backgroundColor: caja?.caja ? c.greenSoft : c.soft, alignItems: 'center', justifyContent: 'center' }}><WalletCards size={16} color={caja?.caja ? c.green : c.muted} /></View><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{caja?.caja ? `Caja #${caja.caja.id} abierta` : 'Caja cerrada'}</Text><Text style={{ color: c.muted, fontSize: 9, marginTop: 3 }}>{caja?.caja ? 'Turno de cobros activo' : 'Requiere apertura para cobrar'}</Text></View><ChevronRight size={15} color={c.faint} /></Pressable>
    <Pressable accessibilityRole="button" onPress={() => navigate('inventario')} style={({ hovered }) => [row, { gap: 9, opacity: hovered ? 0.7 : 1 }]}>{inventoryAlerts.length ? <AlertTriangle size={15} color={c.amber} /> : <Package size={15} color={c.green} />}<Text style={{ flex: 1, color: inventoryAlerts.length ? c.amber : c.muted, fontSize: 10 }}>{inventoryAlerts.length ? `${inventoryAlerts.length} alertas de inventario` : 'Inventario sin alertas'}</Text><ChevronRight size={14} color={c.faint} /></Pressable>
  </View>;
}

export default function DashboardScreen({ setActiveTab }) {
  const { pedidos, productos, mesas, inventario, caja, loading, refreshAll } = useAdmin();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 700, wide = width >= 1120;
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestRef = useRef(0);
  const navigate = tab => setActiveTab?.(tab);

  useEffect(() => {
    const request = ++requestRef.current;
    const controller = new AbortController();
    setReportLoading(true); setError('');
    axios.get(`${BASE_URL}/dashboard/reports`, { params: { days }, signal: controller.signal, timeout: 15000 })
      .then(({ data }) => { if (request === requestRef.current) setReport(data); })
      .catch(error => { if (request === requestRef.current && error.code !== 'ERR_CANCELED') setError(error.response?.data?.message || 'No se pudieron cargar los indicadores financieros.'); })
      .finally(() => { if (request === requestRef.current) setReportLoading(false); });
    return () => controller.abort();
  }, [days, refreshKey]);

  const active = pedidos.filter(order => !['PAGADO', 'CANCELADO'].includes(String(order.estado).toUpperCase()));
  const pendingBalance = active.reduce((sum, order) => sum + Math.max(0, Number(order.total || 0) - Number(order.abonado || 0)), 0);
  const activeTables = mesas.filter(table => Number(table.activo) === 1);
  const lowInventory = inventario.filter(item => stockOf(item) <= Number(item.stock_minimo || 0));
  const unavailable = productos.filter(item => Number(item.disponible) === 1 && stockOf(item) <= 0);
  const inventoryAlerts = [...lowInventory, ...unavailable];
  const recent = [...active].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
  const summary = report?.summary || {};
  const timeline = useMemo(() => completeTimeline(report?.timeline, days), [report?.timeline, days]);
  const peak = bestHour(report?.hours || []);
  const totalMethods = (report?.methods || []).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const today = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  const refresh = () => { refreshAll(); setRefreshKey(value => value + 1); };

  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', justifyContent: 'space-between', gap: 14 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>VISIÓN GENERAL</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: phone ? 25 : 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 6 }}>Resumen ejecutivo</Text><View style={[row, { gap: 7, marginTop: 8 }]}><CalendarDays size={13} color={c.muted} /><Text style={{ color: c.muted, fontSize: 11 }}>{today}</Text><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: error ? c.red : c.green, marginLeft: 6 }} /><Text style={{ color: c.faint, fontSize: 10 }}>{error ? 'Sin conexión analítica' : 'Datos actualizados'}</Text></View></View>
      <View style={[row, { gap: 7, alignSelf: phone ? 'flex-start' : 'center' }]}><Pressable accessibilityRole="button" accessibilityLabel="Actualizar resumen" disabled={reportLoading} onPress={refresh} style={({ hovered }) => [row, { minHeight: 42, paddingHorizontal: 12, gap: 7, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: hovered ? c.soft : c.surface, opacity: reportLoading ? 0.6 : 1 }]}><RefreshCw size={15} color={c.primaryText} /><Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>Actualizar</Text></Pressable><Pressable accessibilityRole="button" onPress={() => navigate('reportes')} style={({ hovered }) => [row, { minHeight: 42, paddingHorizontal: 13, gap: 7, borderRadius: 8, backgroundColor: hovered ? c.primaryHover : c.primary }]}><Text style={{ color: c.onPrimary, fontSize: 11, fontWeight: '700' }}>Ver reportes</Text><ArrowUpRight size={14} color={c.onPrimary} /></Pressable></View>
    </View>

    <View style={[row, { minHeight: 50, paddingHorizontal: 10, gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 9 }]}><Clock3 size={15} color={c.muted} /><Text style={{ color: c.muted, fontSize: 10 }}>Período</Text>{[7, 30, 90].map(period => <Pressable key={period} accessibilityRole="button" accessibilityState={{ selected: days === period }} onPress={() => setDays(period)} style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, backgroundColor: days === period ? c.primary : 'transparent' }}><Text style={{ color: days === period ? c.onPrimary : c.muted, fontSize: 10, fontWeight: days === period ? '700' : '500' }}>{period} días</Text></Pressable>)}<View style={{ flex: 1 }} />{!phone && peak && <Text style={{ color: c.faint, fontSize: 10 }}>Hora de mayor venta: <Text style={{ color: c.text, fontWeight: '700' }}>{String(peak.hora).padStart(2, '0')}:00</Text></Text>}</View>

    {!!error && <View accessibilityRole="alert" style={[row, { padding: 12, gap: 9, borderRadius: 8, backgroundColor: c.redSoft }]}><AlertTriangle size={16} color={c.red} /><Text style={{ flex: 1, color: c.red, fontSize: 10 }}>{error}</Text><Link onPress={() => setRefreshKey(value => value + 1)}>Reintentar</Link></View>}

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Metric width={phone ? '47%' : '23%'} label="Ventas netas" value={money(summary.net_sales)} hint="vs. período anterior" trend={summary.change_percent} icon={CircleDollarSign} color={c.green} soft={c.greenSoft} loading={reportLoading && !report} />
      <Metric width={phone ? '47%' : '23%'} label="Pedidos cobrados" value={integer(summary.paid_orders)} hint={`${integer(summary.payments)} transacciones`} icon={ShoppingBag} color={c.primaryText} soft={c.primarySoft} loading={reportLoading && !report} />
      <Metric width={phone ? '47%' : '23%'} label="Ticket promedio" value={money(summary.average_ticket)} hint="por pedido cobrado" icon={ReceiptText} color={c.sky} soft={c.skySoft} loading={reportLoading && !report} />
      <Metric width={phone ? '47%' : '23%'} label="Por cobrar" value={money(pendingBalance)} hint={`${active.length} cuentas abiertas`} icon={CreditCard} color={c.pink || c.red} soft={c.pinkSoft || c.redSoft} loading={loading} />
    </View>

    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
      <Panel style={{ flex: wide ? 1.65 : undefined, minWidth: 0 }} title="Rendimiento de ventas" subtitle={`Cobros netos de los últimos ${days} días`} icon={TrendingUp} action={<Text style={{ color: c.green, fontSize: 13, fontWeight: '700' }}>{money(summary.net_sales)}</Text>}><TrendChart data={timeline} days={days} /><View style={[row, { justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderColor: c.line }]}><Text style={{ color: c.faint, fontSize: 9 }}>Solo pagos activos; excluye anulaciones y devoluciones</Text><Link onPress={() => navigate('reportes')}>Analizar</Link></View></Panel>
      <Panel style={{ flex: wide ? 1 : undefined, minWidth: 0 }} title="Operación en vivo" subtitle="Salón, cocina, caja e inventario" icon={ChefHat} action={<View style={[row, { gap: 5 }]}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.green }} /><Text style={{ color: c.green, fontSize: 9, fontWeight: '700' }}>EN VIVO</Text></View>}><Operation active={active} tables={activeTables} caja={caja} inventoryAlerts={inventoryAlerts} navigate={navigate} /></Panel>
    </View>

    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
      <Panel style={{ flex: wide ? 1.55 : undefined, minWidth: 0 }} title="Cuentas abiertas recientes" subtitle="Pendientes de completar o cobrar" icon={ShoppingBag} action={<Link onPress={() => navigate('pedidos')}>Ver pedidos</Link>}>
        {!phone && <View style={[row, { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.surfaceAlt }]}><Text style={{ flex: 1, color: c.faint, fontSize: 8, fontWeight: '700' }}>PEDIDO / DESTINO</Text><Text style={{ width: 105, color: c.faint, fontSize: 8, fontWeight: '700' }}>ESTADO</Text><Text style={{ width: 82, textAlign: 'right', color: c.faint, fontSize: 8, fontWeight: '700' }}>SALDO</Text></View>}
        {recent.map((order, index) => { const state = String(order.estado).toUpperCase(); const balance = Math.max(0, Number(order.total || 0) - Number(order.abonado || 0)); const stateColor = { PENDIENTE: c.faint, PREPARANDO: c.amber, LISTO: c.green, ENTREGADO: c.sky }[state] || c.muted; return <Pressable key={order.id} accessibilityRole="button" onPress={() => navigate('pedidos')} style={({ hovered }) => [row, { minHeight: 57, paddingHorizontal: 16, paddingVertical: 9, gap: 10, borderTopWidth: index || phone ? 1 : 0, borderColor: c.line, backgroundColor: hovered ? c.surfaceAlt : c.surface }]}><View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700' }}>#{order.id}</Text></View><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: c.text, fontSize: 11, fontWeight: '700' }}>{orderLocation(order)}</Text><Text numberOfLines={1} style={{ color: c.muted, fontSize: 9, marginTop: 3 }}>{order.cliente_nombre || order.mesero_nombre || 'Servicio del restaurante'}</Text>{phone && <Text style={{ color: stateColor, fontSize: 9, marginTop: 4 }}>{stateLabels[state] || state}</Text>}</View>{!phone && <View style={[row, { width: 105, gap: 5 }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: stateColor }} /><Text style={{ color: stateColor, fontSize: 9 }}>{stateLabels[state] || state}</Text></View>}<Text style={{ width: 82, textAlign: 'right', color: c.text, fontSize: 11, fontWeight: '700' }}>{money(balance)}</Text></Pressable>; })}
        {!recent.length && <View style={{ minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 }}><ShoppingBag size={25} color={c.faint} /><Text style={{ color: c.muted, fontSize: 11 }}>No hay cuentas abiertas.</Text></View>}
      </Panel>
      <Panel style={{ flex: wide ? 1 : undefined, minWidth: 0 }} title="Composición de cobros" subtitle={`Métodos usados en ${days} días`} icon={CreditCard}><PaymentMix methods={report?.methods || []} total={totalMethods} />{(report?.products || []).length > 0 && <View style={{ borderTopWidth: 1, borderColor: c.line, padding: 14, gap: 9 }}><Text style={{ color: c.faint, fontSize: 8, fontWeight: '700', letterSpacing: 0.7 }}>PRODUCTOS DESTACADOS</Text>{report.products.slice(0, 3).map((product, index) => <View key={product.id} style={[row, { gap: 8 }]}><Text style={{ width: 18, color: index === 0 ? c.primaryText : c.faint, fontSize: 10, fontWeight: '700' }}>{index + 1}</Text><Text numberOfLines={1} style={{ flex: 1, color: c.muted, fontSize: 10 }}>{product.nombre}</Text><Text style={{ color: c.text, fontSize: 10, fontWeight: '700' }}>{Number(product.unidades).toLocaleString('es-EC', { maximumFractionDigits: 2 })} u.</Text></View>)}</View>}</Panel>
    </View>

    <View style={[row, { justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingHorizontal: 2 }]}><Text style={{ color: c.faint, fontSize: 9 }}>Fuente financiera: pagos activos registrados en caja.</Text><Text style={{ color: c.faint, fontSize: 9 }}>{report?.generated_at ? `Actualizado ${new Date(report.generated_at).toLocaleString('es-EC')}` : ''}</Text></View>
  </ScrollView>;
}
