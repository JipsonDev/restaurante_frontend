import React, { useEffect, useState } from 'react';
import OrderTracking from './OrderTracking';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, ArrowUpRight } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { historyDay, validHistoryDay } from '../utils/expressWorkspace.mjs';
import { WText, WButton, waiterFont } from './WaiterUI';
const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpressHistory({ colors: c }) {
  const [date, setDate] = useState(() => historyDay(new Date()));
  const [input, setInput] = useState(date);
  const [dateError, setDateError] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(''); setSelected(null);
    axios.get(`${BASE_URL}/pedidos/express/historial`, { params: { fecha: date, page }, timeout: 10000, signal: controller.signal })
      .then(({ data: next }) => { if (!Array.isArray(next?.items)) throw new Error('El servidor devolvió un historial inválido.'); if (active) setData(next); })
      .catch(e => { if (active && !axios.isCancel(e)) setError(e.response?.data?.message || e.message || 'No se pudo cargar el historial.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [date, page, attempt]);
  const changeDate = next => { setDateError(''); setInput(next); setDate(next); setPage(0); };
  const apply = () => { if (!validHistoryDay(input)) { setDateError('Escribe una fecha válida en formato AAAA-MM-DD.'); return; } changeDate(input); setAttempt(n => n + 1); };
  const changeDay = delta => { const parsed = new Date(`${date}T12:00:00`); parsed.setDate(parsed.getDate() + delta); changeDate(historyDay(parsed)); };
  return <View style={{ gap: 14 }}>
    <WText style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Pagados y entregados, por fecha de cierre. Los pedidos con saldo siguen en Activos.</WText>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <WButton colors={c} label="Día anterior" Icon={ChevronLeft} onPress={() => changeDay(-1)} />
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 2, borderColor: dateError ? c.danger : 'transparent', backgroundColor: c.surfaceAlt || c.elevated, borderRadius: 999, paddingHorizontal: 14 }}><CalendarDays size={16} color={c.muted} /><TextInput accessibilityLabel="Fecha del historial" value={input} maxLength={10} placeholder="AAAA-MM-DD" placeholderTextColor={c.muted} onChangeText={value => { setInput(value); setDateError(''); }} onSubmitEditing={apply} style={{ ...waiterFont, flex: 1, minWidth: 0, minHeight: 44, color: c.ink, fontSize: 12 }} /></View>
      <WButton colors={c} label="Día siguiente" Icon={ChevronRight} onPress={() => changeDay(1)} />
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}><WButton colors={c} primary label="Consultar fecha del historial" onPress={apply}>Consultar</WButton><WButton colors={c} onPress={() => { changeDate(historyDay(new Date())); setAttempt(n => n + 1); }}>Hoy</WButton><WText style={{ marginLeft: 'auto', color: c.muted, alignSelf: 'center', fontSize: 11 }}>{date}</WText></View>
    {dateError ? <WText accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>{dateError}</WText> : null}
    {loading ? <View style={{ padding: 24, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.brand} /><WText style={{ color: c.muted, fontSize: 12 }}>Consultando historial…</WText></View> : error ? <View style={{ padding: 16, gap: 10 }}><WText accessibilityRole="alert" style={{ color: c.danger }}>{error}</WText><WButton colors={c} onPress={() => setAttempt(n => n + 1)}>Reintentar historial</WButton></View> : <>
      {!data.items.length ? <View style={{ padding: 24, gap: 8, borderRadius: 20, backgroundColor: c.surfaceAlt || c.elevated }}><WText style={{ color: c.ink, fontSize: 14 }}>Sin pedidos cerrados este día</WText><WText style={{ color: c.muted, fontSize: 12 }}>Al completar el pago y la entrega aparecerán aquí.</WText></View> : null}
      {data.items.map(order => <View key={order.id} style={{ borderRadius: 20, backgroundColor: c.surfaceAlt || c.elevated, overflow: 'hidden' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver historial Express ${order.id}`} accessibilityState={{ expanded: selected === order.id }} onPress={() => setSelected(selected === order.id ? null : order.id)} style={{ padding: 14, gap: 6, flexDirection: 'row', alignItems: 'center' }}><CheckCircle2 size={18} color={c.success} /><View style={{ flex: 1, minWidth: 0, gap: 5 }}><WText style={{ color: c.ink, fontSize: 14 }}>{order.cliente_nombre || 'Cliente'} · #{order.id}</WText><WText style={{ color: c.muted, fontSize: 12 }}>{order.tipo} · {money(order.total)} · pagado y entregado</WText></View><ArrowUpRight size={16} color={c.muted} /></Pressable>
        {selected === order.id ? <View style={{ padding: 14, paddingTop: 0, gap: 10 }}><WText style={{ color: c.muted, fontSize: 12 }}>Cierre: {order.cerrado_at && !Number.isNaN(new Date(order.cerrado_at).getTime()) ? new Date(order.cerrado_at).toLocaleString('es') : 'Sin fecha registrada'}</WText>{(order.items || []).map(item => <View key={item.id} style={{ gap: 3 }}><WText style={{ color: c.ink, fontSize: 12 }}>{item.cantidad} × {item.nombre}</WText>{item.notas ? <WText style={{ color: c.muted, fontSize: 11 }}>{item.notas}</WText> : null}</View>)}</View> : null}
        {selected===order.id?<View style={{paddingHorizontal:14}}><OrderTracking order={order} colors={c}/></View>:null}
      </View>)}
      {data.items.length > 0 || page > 0 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><WButton colors={c} disabled={page === 0} onPress={() => setPage(n => n - 1)}>Anterior</WButton><WText style={{ color: c.muted, fontSize: 12 }}>Página {page + 1}</WText><WButton colors={c} disabled={!data.hasMore} onPress={() => setPage(n => n + 1)}>Siguiente</WButton></View> : null}
    </>}
  </View>;
}
