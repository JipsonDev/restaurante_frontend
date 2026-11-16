// Salón del mesero — dirección «Comanda».
// Casillas de mesa con el estado por FORMA (discontinuo = libre, tinta sólida = ocupada,
// relleno achiote = por cobrar, sello = reservada), bandeja «Listo», acciones rápidas y transferir.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, TextInput, View } from 'react-native';
import axios from 'axios';
import { ArrowRightLeft, BellRing, CheckCheck, Clock3, Receipt, Search, Utensils, X } from 'lucide-react-native';
import { comandaTableMeta, useTheme } from '../../theme';
import { BASE_URL } from '../../context/AuthContext';
import { serviceDate, serviceDuration, serviceRounds } from '../../utils/serviceTiming.mjs';
import { addDays, dayOf, localStamp, minutesUntil, nextByTable, timeOf } from '../../utils/reservationLogic.mjs';
import { Appear, BottomSheet, Button, Chip, EASE, EmptyState, IconButton, Label, Num, Perforation, Ping, Press, Stamp, T, TOUCH, haptic, money, radius, space } from './comanda';

// Minutos desde una fecha (o null).
export function minutesSince(value, now = Date.now()) {
  const d = serviceDate(value);
  const n = serviceDate(now);
  if (!d || !n || d > n) return null;
  return Math.floor((n - d) / 60000);
}
// Compacto para la casilla: 7' · 1h05 · 3 d (una cuenta olvidada no rompe la cuadrícula).
const shortMinutes = m => m == null ? '' : m >= 1440 ? `${Math.floor(m / 1440)} d` : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}'`;

// Reservas de hoy (el mesero solo necesita la próxima de cada mesa). Se refresca cada minuto.
export function useTodayReservations(enabled = true) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = async () => {
      const today = dayOf(localStamp());
      try {
        const { data } = await axios.get(`${BASE_URL}/reservas`, { params: { desde: today, hasta: addDays(today, 0) } });
        if (alive && Array.isArray(data)) setList(data);
      } catch { /* sin reservas disponibles: el salón funciona igual */ }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);
  return useMemo(() => nextByTable(list, localStamp()), [list]);
}

// Rondas listas para entregar, de la más antigua a la más reciente.
export function readyRounds(pedidos = [], now = Date.now()) {
  return pedidos
    .filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()))
    .flatMap(p => serviceRounds(p).filter(r => r.estado === 'LISTO').map(r => ({ round: r, pedido: p, minutes: minutesSince(r.listo_at || r.created_at, now) })))
    .sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));
}

// ── Casilla de mesa ────────────────────────────────────────────────────────
export function TableTile({ mesa, state, order, width, now, selected, ready, alert, reservation, onPress, onLongPress }) {
  const { c } = useTheme();
  const meta = comandaTableMeta(state, c);
  const filled = meta.shape === 'filled';
  const balance = order ? Number(order.saldo_pendiente ?? Math.max(0, Number(order.total || 0) - Number(order.abonado || 0))) : 0;
  const opened = order ? minutesSince(order.created_at, now) : null;
  const late = !!alert;
  const resMinutes = reservation ? minutesUntil(reservation) : null;
  const muted = filled ? c.onPrimary : c.muted;
  const label = `Mesa ${mesa.numero}, ${meta.label}${order ? `, saldo ${money(balance)}, abierta hace ${opened ?? 0} minutos` : ''}${ready ? `, ${ready} ${ready === 1 ? 'ronda lista' : 'rondas listas'}` : ''}${reservation ? `, reserva ${timeOf(reservation.fecha_hora)}` : ''}`;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Toca para abrir la mesa; mantén presionado para acciones rápidas" accessibilityState={{ selected }}
    onPress={() => onPress(mesa)} onLongPress={onLongPress ? () => onLongPress(mesa) : undefined} hapticKind="tap"
    style={{ width, minHeight: 92, padding: 10, borderRadius: radius.sm, backgroundColor: filled ? meta.bg : state === 'Libre' ? 'transparent' : c.surface,
      borderWidth: state === 'Ocupada' ? 1.5 : filled ? 1.5 : 1.5, borderStyle: meta.shape === 'dashed' ? 'dashed' : 'solid',
      borderColor: selected ? c.primary : meta.border, justifyContent: 'space-between', gap: 4 }}>
    <Ping trigger={state} color={filled ? c.primary : c.ink} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
      <Num size={24} weight="700" color={meta.number} style={{ lineHeight: 28 }}>{String(mesa.numero).padStart(2, '0')}</Num>
      {order && opened != null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {late ? <Clock3 size={13} color={filled ? c.onPrimary : c.red} /> : null}
        <Num size={13} weight={late ? '700' : '500'} color={late && !filled ? c.red : muted} numberOfLines={1}>{shortMinutes(opened)}</Num>
      </View> : null}
    </View>
    {ready ? <Stamp color={filled ? c.onPrimary : c.green} rotate={-4} size={12}>{ready > 1 ? `${ready} listas` : 'Lista'}</Stamp> : null}
    {state === 'Reservada' || (state === 'Libre' && reservation && resMinutes != null && resMinutes <= 90) ? <Stamp color={c.purple} rotate={-5} size={12}>{`R ${timeOf(reservation?.fecha_hora) || ''}`.trim()}</Stamp> : null}
    {order ? <Num size={15} weight="700" color={filled ? c.onPrimary : c.text} style={{ textAlign: 'right' }}>{money(balance)}</Num>
      : <T size={14} weight="600" color={state === 'Libre' ? c.green : meta.text}>{state === 'Libre' ? `Libre · ${mesa.capacidad || '—'} p.` : meta.label}</T>}
  </Press>;
}

// ── Atender ahora ──────────────────────────────────────────────────────────
// Fila de fichas con lo urgente: rondas listas, demoras y cuentas pedidas.
export function AttentionStrip({ items, onOpen }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return <Appear>
    <View style={{ marginBottom: space.md }}>
      <Label style={{ marginBottom: 6 }} color={c.primary}>Atender ahora · {items.length}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {items.map(it => <Press key={it.key} accessibilityRole="button" accessibilityLabel={`${it.title}, ${it.detail}`} onPress={() => onOpen(it)} hapticKind="tap"
          style={{ minHeight: TOUCH, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1.5, borderColor: it.tone === 'ready' ? c.green : it.tone === 'late' ? c.red : c.primary,
            backgroundColor: c.surface, justifyContent: 'center' }}>
          <T size={15} weight="700">{it.title}</T>
          <T size={13} weight="600" color={it.tone === 'ready' ? c.green : it.tone === 'late' ? c.red : c.primary}>{it.detail}</T>
        </Press>)}
      </ScrollView>
    </View>
  </Appear>;
}

// ── Pestañas de zona con subrayado que se desliza ─────────────────────────
export function ZoneTabs({ zones, value, onChange, counts = {} }) {
  const { c } = useTheme();
  const layouts = useRef({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const move = (key, instant) => {
    const l = layouts.current[key]; if (!l) return;
    if (instant) { x.setValue(l.x); w.setValue(l.width); return; }
    Animated.parallel([Animated.timing(x, { toValue: l.x, duration: 180, easing: EASE, useNativeDriver: false }), Animated.timing(w, { toValue: l.width, duration: 180, easing: EASE, useNativeDriver: false })]).start();
  };
  useEffect(() => { move(value); }, [value]);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: c.line }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.lg }}>
      {zones.map(z => {
        const active = z === value;
        return <Press key={z} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(z)} hapticKind="select" scaleTo={0.96} sink={0}
          onLayout={e => { layouts.current[z] = e.nativeEvent.layout; if (active) { move(z, true); setReady(true); } }}
          style={{ minHeight: TOUCH, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Label size={14} color={active ? c.text : c.muted}>{z === 'Todas' ? 'Todo el salón' : z}</Label>
          {counts[z] != null ? <Num size={12} color={c.faint}>{counts[z]}</Num> : null}
        </Press>;
      })}
      {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, height: 3, borderRadius: 2, backgroundColor: c.ink, left: x, width: w }} /> : null}
    </View>
  </ScrollView>;
}

// ── Acciones rápidas de mesa (mantener presionada) ────────────────────────
export function TableActionsSheet({ mesa, state, order, onClose, actions }) {
  const { c } = useTheme();
  const meta = mesa ? comandaTableMeta(state, c) : null;
  const balance = order ? Number(order.saldo_pendiente ?? Math.max(0, Number(order.total || 0) - Number(order.abonado || 0))) : 0;
  const row = (Icon, label, detail, onPress, disabled) => <Press key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { onClose(); onPress(); }} hapticKind="tap"
    style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: radius.md, opacity: disabled ? 0.4 : 1 }} hoverStyle={{ backgroundColor: c.soft }}>
    <Icon size={22} color={c.text} />
    <View style={{ flex: 1 }}><T size={17} weight="600">{label}</T>{detail ? <T size={14} color={c.muted}>{detail}</T> : null}</View>
  </Press>;
  return <BottomSheet visible={!!mesa} onClose={onClose} title={mesa ? `Mesa ${mesa.numero}` : ''} subtitle={mesa ? `${meta.label}${order ? ` · saldo ${money(balance)}` : ''}${mesa.capacidad ? ` · ${mesa.capacidad} puestos` : ''}` : ''}>
    {mesa ? <View>
      {row(Utensils, order ? 'Añadir a la comanda' : 'Tomar pedido', 'Abre el menú para esta mesa', actions.order)}
      {order ? row(Receipt, 'Ver comanda', 'Rondas, entregas y cuenta', actions.view) : null}
      {order ? row(BellRing, 'Pedir la cuenta', state === 'Cuenta' ? 'Ya está marcada como por cobrar' : 'Avisa a caja que esta mesa quiere pagar', actions.bill, state === 'Cuenta') : null}
      {order ? row(ArrowRightLeft, 'Transferir o unir', 'Mueve la cuenta a otra mesa', actions.transfer) : null}
    </View> : null}
  </BottomSheet>;
}

// ── Transferir o unir ──────────────────────────────────────────────────────
export function TransferSheet({ open, from, mesas, stateFor, onPick, onClose, busy }) {
  const { c } = useTheme();
  const options = mesas.filter(m => Number(m.id) !== Number(from?.id));
  return <BottomSheet visible={open} onClose={onClose} busy={busy} title="Transferir o unir" subtitle={from ? `Desde la mesa ${from.numero}. Libre = se mueve la cuenta; ocupada = se unen.` : ''}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map(m => {
        const state = stateFor(m);
        const free = state === 'Libre';
        const meta = comandaTableMeta(state, c);
        return <Press key={m.id} accessibilityRole="button" accessibilityLabel={`${free ? 'Transferir a' : 'Unir con'} mesa ${m.numero}`} disabled={busy} onPress={() => onPick(m)} hapticKind="medium"
          style={{ width: '31%', minWidth: 96, minHeight: 72, padding: 10, borderRadius: radius.sm, borderWidth: 1.5, borderStyle: meta.shape === 'dashed' ? 'dashed' : 'solid',
            borderColor: meta.shape === 'filled' ? c.primary : meta.border, backgroundColor: c.surface, justifyContent: 'space-between' }}>
          <Num size={20} weight="700">{String(m.numero).padStart(2, '0')}</Num>
          <T size={13} weight="700" color={free ? c.green : c.text}>{free ? 'Mover aquí' : 'Unir'}</T>
        </Press>;
      })}
    </View>
  </BottomSheet>;
}

// ── Bandeja «Listo» ────────────────────────────────────────────────────────
// Rondas listas con «Entregado» en un toque, demoras y actividad reciente.
export function ReadyTray({ open, onClose, ready, alerts, activity, onDeliver, deliveringId, onOpen, clearActivity, now }) {
  const { c } = useTheme();
  const [tab, setTab] = useState('listo');
  const unread = activity.filter(a => !a.read).length;
  const late = alerts.items.filter(a => a.tipo !== 'lista');
  const placeOf = (pedido, item) => (pedido?.mesa_id || item?.mesa_id) ? `Mesa ${pedido?.mesa_numero || item?.mesa_numero || pedido?.mesa_id || item?.mesa_id}` : `${(pedido?.tipo || item?.origen) === 'Delivery' ? 'Delivery' : 'Para llevar'} #${pedido?.id || item?.pedido_id}`;
  const itemsText = round => (round.items || []).slice(0, 4).map(i => `${i.cantidad}× ${i.nombre || i.producto_nombre || 'Producto'}`).join(' · ');
  return <BottomSheet visible={open} onClose={onClose} title="Bandeja" subtitle={ready.length ? `${ready.length} ${ready.length === 1 ? 'ronda lista' : 'rondas listas'} para llevar a la mesa` : 'Nada esperando en el pase'}>
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      <Chip selected={tab === 'listo'} onPress={() => setTab('listo')} count={ready.length}>Listo</Chip>
      <Chip selected={tab === 'demoras'} onPress={() => setTab('demoras')} count={late.length}>Demoras</Chip>
      <Chip selected={tab === 'actividad'} onPress={() => setTab('actividad')} count={unread}>Actividad</Chip>
    </View>
    {tab === 'listo' ? (ready.length ? <View style={{ gap: space.sm }}>
      {ready.map(({ round, pedido, minutes }, i) => <Appear key={round.id} delay={i * 40}>
        <View style={{ borderWidth: 1.5, borderColor: c.green, borderRadius: radius.sm, padding: space.md, backgroundColor: c.surface, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T size={18} weight="700" style={{ flex: 1 }}>{placeOf(pedido)}</T>
            <Num size={14} weight="700" color={minutes != null && minutes >= (alerts.limits?.lista || 5) ? c.red : c.green}>{minutes ? `lista hace ${shortMinutes(minutes)}` : 'recién lista'}</Num>
          </View>
          {itemsText(round) ? <T size={15} color={c.muted} numberOfLines={2}>{itemsText(round)}</T> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4 }}>
            <Button variant="ink" icon={CheckCheck} loading={deliveringId === round.id} onPress={() => onDeliver(round, pedido)} hapticKind="success">Entregado</Button>
            <Button variant="ghost" onPress={() => onOpen({ mesa_id: pedido.mesa_id, pedido_id: pedido.id, pedido })}>Ver</Button>
          </View>
        </View>
      </Appear>)}
    </View> : <EmptyState icon={CheckCheck} title="Pase vacío" description="Cuando cocina marque una ronda como lista aparecerá aquí, con vibración." />) : null}
    {tab === 'demoras' ? <View style={{ gap: space.sm }}>
      {alerts.error ? <View style={{ borderWidth: 1.5, borderColor: c.amber, borderRadius: radius.sm, padding: space.md, gap: space.sm }}>
        <T size={15} weight="600" color={c.amber}>No se pudieron revisar las demoras.{alerts.items.length ? ' Se muestra la última consulta.' : ''}</T>
        <Button variant="outline" size="sm" onPress={alerts.refresh}>Reintentar</Button>
      </View> : null}
      {!alerts.error && !late.length ? <EmptyState icon={Clock3} title={alerts.limits?.enabled === false ? 'Avisos en pausa' : 'Sin demoras'} description={alerts.limits?.enabled === false ? 'Las alertas de demora están desactivadas en Ajustes.' : `Se avisa cuando cocina pasa de ${alerts.limits?.espera ?? 20} min.`} /> : null}
      {late.map(item => <Press key={item.id} accessibilityRole="button" onPress={() => onOpen(item)} hapticKind="tap"
        style={{ borderWidth: 1.5, borderColor: c.red, borderRadius: radius.sm, padding: space.md, backgroundColor: c.surface, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <T size={17} weight="700" style={{ flex: 1 }}>{placeOf(null, item)}</T>
          <Num size={15} weight="700" color={c.red}>{serviceDuration(item.minutos)}</Num>
        </View>
        <T size={14} color={c.muted}>Esperando en cocina · ronda #{item.ronda_id} · límite {item.limite} min</T>
      </Press>)}
    </View> : null}
    {tab === 'actividad' ? <View>
      {activity.length ? <View style={{ alignItems: 'flex-end' }}><Button variant="ghost" size="sm" onPress={clearActivity}>Limpiar</Button></View> : null}
      {!activity.length ? <EmptyState icon={BellRing} title="Sin actividad reciente" /> : null}
      {activity.map((item, i) => <View key={item.id}>
        {i ? <Perforation /> : null}
        <Press accessibilityRole="button" onPress={() => onOpen(item)} hapticKind="tap" style={{ minHeight: 56, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.read ? c.line : c.green }} />
          <View style={{ flex: 1 }}>
            <T size={15} weight={item.read ? '400' : '700'}>{item.title}</T>
            {item.body ? <T size={13} color={c.muted} numberOfLines={2}>{item.body}</T> : null}
          </View>
          {item.createdAt ? <Num size={12} color={c.faint}>{new Date(item.createdAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</Num> : null}
        </Press>
      </View>)}
    </View> : null}
  </BottomSheet>;
}

// Botón de búsqueda que se despliega en un campo.
export function SearchToggle({ value, onChange }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(!!value);
  const v = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: open ? 1 : 0, duration: 180, easing: EASE, useNativeDriver: false }).start(); }, [open]);
  if (!open) return <IconButton icon={Search} label="Buscar mesa" onPress={() => { haptic('tap'); setOpen(true); }} />;
  return <Animated.View style={{ flex: 1, opacity: v, flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, borderWidth: 1.5, borderColor: c.ink, borderRadius: radius.md, paddingLeft: 12, backgroundColor: c.surface }}>
    <Search size={18} color={c.muted} />
    <TextInput autoFocus value={value} onChangeText={onChange} placeholder="Mesa o zona" placeholderTextColor={c.faint} accessibilityLabel="Buscar mesa por número o zona"
      style={{ flex: 1, minWidth: 0, fontSize: 16, color: c.text, paddingHorizontal: 8, paddingVertical: 10, ...(typeof document !== 'undefined' ? { outlineStyle: 'none' } : {}) }} />
    <IconButton icon={X} label="Cerrar búsqueda" onPress={() => { onChange(''); setOpen(false); }} />
  </Animated.View>;
}

export { haptic as salonHaptic } from './comanda';
