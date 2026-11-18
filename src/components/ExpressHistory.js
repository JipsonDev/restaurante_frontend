// Historial Express (dirección «Suave»): selector de fecha tipo píldora («Lun 16 nov», con «Hoy»),
// flechas para el día anterior/siguiente y consulta automática al cambiar. Tarjetas como en Activos.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ShoppingBag, Truck } from 'lucide-react-native';
import axios from 'axios';
import OrderTracking from './OrderTracking';
import { BASE_URL } from '../context/AuthContext';
import { historyDay, validHistoryDay } from '../utils/expressWorkspace.mjs';
import { useTheme } from '../theme';
import { Appear, BottomSheet, Button, Chip, EmptyState, Field, IconButton, Num, Press, Stamp, T, elevate, money, radius, space } from './waiter/kit';

const parseDay = day => new Date(`${day}T12:00:00`);
const shiftDay = (day, delta) => { const d = parseDay(day); d.setDate(d.getDate() + delta); return historyDay(d); };
// «Lun 16 nov» (o «Hoy · Lun 16 nov» / «Ayer · …»).
export function readableDay(day, today = historyDay(new Date())) {
  const d = parseDay(day);
  if (Number.isNaN(d.getTime())) return day;
  const wd = d.toLocaleDateString('es-EC', { weekday: 'short' }).replace('.', '');
  const mo = d.toLocaleDateString('es-EC', { month: 'short' }).replace('.', '');
  const text = `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${d.getDate()} ${mo}`;
  if (day === today) return `Hoy · ${text}`;
  if (day === shiftDay(today, -1)) return `Ayer · ${text}`;
  return text;
}

function DayPicker({ open, onClose, value, onPick }) {
  const today = historyDay(new Date());
  const [typed, setTyped] = useState(value);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setTyped(value); setError(''); } }, [open, value]);
  const recent = useMemo(() => Array.from({ length: 14 }, (_, i) => shiftDay(today, -i)), [today]);
  const apply = () => { if (!validHistoryDay(typed) || typed > today) { setError('Escribe una fecha válida (AAAA-MM-DD) que no sea futura.'); return; } onPick(typed); };
  return <BottomSheet visible={open} onClose={onClose} title="Elegir día" subtitle="Pedidos Express pagados y entregados ese día.">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {recent.map(day => <Chip key={day} selected={day === value} onPress={() => onPick(day)}>{day === today ? 'Hoy' : day === shiftDay(today, -1) ? 'Ayer' : readableDay(day, today)}</Chip>)}
    </View>
    <Field label="Otra fecha" value={typed} onChangeText={v => { setTyped(v); setError(''); }} placeholder="AAAA-MM-DD" maxLength={10} error={error} onSubmitEditing={apply} accessibilityLabel="Fecha del historial" />
    <Button variant="ink" full onPress={apply}>Ver ese día</Button>
  </BottomSheet>;
}

function HistoryCard({ order, open, onToggle, colors, index }) {
  const { c } = useTheme();
  const delivery = order.tipo === 'Delivery';
  const items = (order.items || []).reduce((n, it) => n + Number(it.cantidad || 0), 0);
  const closed = order.cerrado_at && !Number.isNaN(new Date(order.cerrado_at).getTime()) ? new Date(order.cerrado_at) : null;
  return <Appear delay={Math.min(index, 8) * 30}>
    <View style={{ borderRadius: radius.lg, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
      <Press accessibilityRole="button" accessibilityLabel={`Ver historial Express ${order.id}`} accessibilityState={{ expanded: open }} onPress={onToggle} hapticKind="tap"
        style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          {delivery ? <Truck size={19} color={c.text} /> : <ShoppingBag size={19} color={c.text} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="800" numberOfLines={1}>{order.cliente_nombre || 'Cliente'}</T>
          <T size={13} color={c.muted} numberOfLines={1}>#{order.id} · {delivery ? 'Delivery' : 'Para llevar'}{items ? ` · ${items} art.` : ''}{closed ? ` · ${closed.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : ''}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Num size={16} weight="800">{money(order.total)}</Num>
          <Stamp color={c.green} size={11}>Cerrado</Stamp>
        </View>
      </Press>
      {open ? <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: 6 }}>
        <View style={{ height: 1, backgroundColor: c.line, marginBottom: 6 }} />
        {(order.items || []).map(item => <View key={item.id} style={{ flexDirection: 'row', gap: 8 }}>
          <Num size={14} weight="700" color={c.muted}>{item.cantidad}×</Num>
          <View style={{ flex: 1 }}><T size={14}>{item.nombre}</T>{item.notas ? <T size={13} color={c.muted}>{item.notas}</T> : null}</View>
        </View>)}
        <View style={{ marginTop: 6 }}><OrderTracking order={order} colors={colors} /></View>
      </View> : null}
    </View>
  </Appear>;
}

export default function ExpressHistory({ colors }) {
  const { c } = useTheme();
  const today = historyDay(new Date());
  const [date, setDate] = useState(today);
  const [picker, setPicker] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  // Consulta automática al cambiar de día o de página.
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
  const go = next => { if (next > today) return; setDate(next); setPage(0); setPicker(false); };
  const total = data.items.reduce((s, o) => s + Number(o.total || 0), 0);
  return <View style={{ gap: space.md }}>
    {/* Selector de día: ‹ [Hoy · Lun 16 nov ▾] › */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
      <IconButton icon={ChevronLeft} label="Día anterior" onPress={() => go(shiftDay(date, -1))} size={44} />
      <Press accessibilityRole="button" accessibilityLabel={`Día: ${readableDay(date, today)}. Elegir otro día`} onPress={() => setPicker(true)} hapticKind="tap"
        style={[{ flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }, elevate(c, 1)]}>
        <CalendarDays size={17} color={c.primaryText} />
        <T size={15} weight="800" numberOfLines={1}>{readableDay(date, today)}</T>
        <ChevronDown size={16} color={c.muted} />
      </Press>
      <IconButton icon={ChevronRight} label="Día siguiente" onPress={() => go(shiftDay(date, 1))} size={44} disabled={date >= today} />
    </View>
    {date !== today ? <Button variant="ghost" size="sm" onPress={() => go(today)} style={{ alignSelf: 'center' }}>Volver a hoy</Button> : null}
    {loading ? <View style={{ padding: space.x3, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.primary} /><T size={14} color={c.muted}>Consultando historial…</T></View>
      : error ? <View style={{ padding: space.lg, gap: space.sm, borderRadius: radius.lg, backgroundColor: c.redSoft }}>
        <T accessibilityRole="alert" size={14} weight="700" color={c.red}>{error}</T>
        <Button variant="ink" size="sm" onPress={() => setAttempt(n => n + 1)}>Reintentar</Button>
      </View>
      : <>
        {data.items.length ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <T size={14} weight="700" color={c.muted}>{data.items.length} {data.items.length === 1 ? 'pedido cerrado' : 'pedidos cerrados'}{data.hasMore || page ? ` · página ${page + 1}` : ''}</T>
          <Num size={14} weight="800" color={c.muted}>{money(total)}</Num>
        </View> : null}
        {!data.items.length ? <EmptyState icon={CheckCircle2} title="Sin pedidos cerrados este día" description="Al completar el pago y la entrega aparecerán aquí." /> : null}
        {data.items.map((order, i) => <HistoryCard key={order.id} order={order} index={i} colors={colors} open={selected === order.id} onToggle={() => setSelected(selected === order.id ? null : order.id)} />)}
        {data.items.length > 0 && (data.hasMore || page > 0) ? <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
          <Button size="sm" icon={ChevronLeft} disabled={page === 0} onPress={() => setPage(n => n - 1)}>Anterior</Button>
          <Button size="sm" iconRight={ChevronRight} disabled={!data.hasMore} onPress={() => setPage(n => n + 1)}>Siguiente</Button>
        </View> : null}
      </>}
    <DayPicker open={picker} onClose={() => setPicker(false)} value={date} onPick={go} />
  </View>;
}
