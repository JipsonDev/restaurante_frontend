// Salón del mesero — dirección «Suave».
// Tarjetas de mesa redondeadas con sombra suave y píldora de estado (punto + texto);
// «Por cobrar» se rellena con el rojo de la marca. Bandeja «Listo», acciones rápidas y transferir.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, TextInput, View } from 'react-native';
import axios from 'axios';
import { ArrowRightLeft, BellRing, CalendarClock, ChefHat, CheckCheck, Clock3, Receipt, Search, Users, Utensils, X } from 'lucide-react-native';
import { comandaTableMeta, useTheme } from '../../theme';
import { BASE_URL } from '../../context/AuthContext';
import { serviceDate, serviceDuration, serviceRounds } from '../../utils/serviceTiming.mjs';
import { addDays, dayOf, localStamp, minutesUntil, nextByTable, timeOf } from '../../utils/reservationLogic.mjs';
import { Appear, BottomSheet, Button, Chip, EASE, EmptyState, IconButton, Label, Num, Perforation, Ping, Press, Stamp, SwipeRow, T, TOUCH, elevate, haptic, money, radius, space } from './comanda';

// Minutos desde una fecha (o null).
export function minutesSince(value, now = Date.now()) {
  const d = serviceDate(value);
  const n = serviceDate(now);
  if (!d || !n || d > n) return null;
  return Math.floor((n - d) / 60000);
}
// Compacto para la casilla: 7' · 1h05 · 3 d (una cuenta olvidada no rompe la cuadrícula).
// Un solo formato de tiempo en todas las mesas: «8 min», «1 h 05», «+1 día».
const shortMinutes = m => m == null ? '' : m >= 1440 ? `+${Math.floor(m / 1440)} ${Math.floor(m / 1440) === 1 ? 'día' : 'días'}` : m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${Math.max(1, m)} min`;

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

// Platos listos sueltos: rondas que siguen en preparación pero con algún plato ya listo («Listo» parcial de cocina).
export function readyItems(pedidos = []) {
  return pedidos
    .filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()))
    .flatMap(p => serviceRounds(p).filter(r => String(r.estado).toUpperCase() === 'PREPARANDO')
      .map(r => ({ round: r, pedido: p, items: (r.items || []).filter(i => i.listo_at && Number(i.cantidad || 0) > 0), total: (r.items || []).filter(i => Number(i.cantidad || 0) > 0).length })))
    .filter(x => x.items.length);
}

// ── Casilla de mesa ────────────────────────────────────────────────────────
export function TableTile({ mesa, state, order, width, now, selected, ready, alert, reservation, onPress, onLongPress }) {
  const { c } = useTheme();
  const meta = comandaTableMeta(state, c);
  const filled = meta.shape === 'filled';
  const free = state === 'Libre';
  const balance = order ? Number(order.saldo_pendiente ?? Math.max(0, Number(order.total || 0) - Number(order.abonado || 0))) : 0;
  const resMinutes = reservation ? minutesUntil(reservation) : null;
  const rounds = order ? serviceRounds(order) : [];
  const cooking = rounds.some(r => ['PENDIENTE', 'PREPARANDO'].includes(r.estado));
  // Un solo estado por mesa, del más urgente al más tranquilo.
  const status = ready ? { icon: CheckCheck, text: ready > 1 ? `${ready} listas` : 'Lista', color: filled ? c.onPrimary : c.green, soft: filled ? 'rgba(255,255,255,0.18)' : c.greenSoft }
    : state === 'Cuenta' ? { icon: Receipt, text: 'Cobrar', color: c.onPrimary, soft: 'rgba(255,255,255,0.18)' }
    : alert ? { icon: Clock3, text: `${alert.minutos} min`, color: c.red, soft: c.redSoft }
    : cooking ? { icon: ChefHat, text: 'En cocina', color: c.sky, soft: c.skySoft }
    : order ? { icon: Utensils, text: 'Comiendo', color: c.muted, soft: c.surfaceAlt }
    : state === 'Reservada' || (reservation && resMinutes != null && resMinutes <= 90) ? { icon: CalendarClock, text: timeOf(reservation?.fecha_hora) || 'Reserva', color: c.purple, soft: c.purpleSoft }
    : { icon: Users, text: 'Libre', color: c.green, soft: c.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' };
  const Icon = status.icon;
  const label = `Mesa ${mesa.numero}, ${status.text}${order ? `, ${money(balance)}` : ''}`;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Toca para pedir; mantén presionado para más acciones" accessibilityState={{ selected }}
    onPress={() => onPress(mesa)} onLongPress={onLongPress ? () => onLongPress(mesa) : undefined} hapticKind="tap" scaleTo={0.95}
    style={[{ width, minHeight: 112, padding: 12, borderRadius: radius.lg, justifyContent: 'space-between', gap: 8, borderWidth: 2,
      backgroundColor: filled ? c.primary : free ? c.surfaceAlt : c.surface, borderColor: selected ? c.ink : filled ? c.primary : free ? c.surfaceAlt : (c.isDark ? c.line : 'rgba(16,24,40,0.05)') },
      free ? null : elevate(c, filled ? 2 : 1)]}>
    <Ping trigger={`${state}-${ready}`} color={filled ? c.primary : status.color} radius={radius.lg} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <Num size={32} weight="800" color={filled ? c.onPrimary : c.text} style={{ lineHeight: 36 }}>{mesa.numero}</Num>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: status.soft }}>
        <Icon size={16} color={status.color} strokeWidth={2.4} />
      </View>
    </View>
    <View style={{ gap: 1 }}>
      <T size={13} weight="800" color={status.color} numberOfLines={1}>{status.text}</T>
      {order ? <Num size={16} weight="800" color={filled ? c.onPrimary : c.text}>{money(balance)}</Num> : null}
    </View>
  </Press>;
}

// ── Atender ahora ──────────────────────────────────────────────────────────
// Fila de fichas con lo urgente: rondas listas, demoras y cuentas pedidas.
export function AttentionStrip({ items, onOpen }) {
  const { c } = useTheme();
  if (!items.length) return null;
  // Una sola línea por ficha: «● Mesa 1 · Pidió la cuenta». Ocupa poco alto en pantallas chicas.
  return <Appear>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: space.sm, marginHorizontal: -12 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: 12, paddingVertical: 2, alignItems: 'center' }}>
      <View accessibilityRole="header" accessibilityLabel={`Atender ahora: ${items.length}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
        <T size={13} weight="800" color={c.primaryText}>Ahora</T>
      </View>
      {items.map(it => {
        const tone = it.tone === 'ready' ? c.green : it.tone === 'late' ? c.red : it.tone === 'reserve' ? c.purple : c.primaryText;
        const soft = it.tone === 'ready' ? c.greenSoft : it.tone === 'late' ? c.redSoft : it.tone === 'reserve' ? c.purpleSoft : c.primarySoft;
        return <Press key={it.key} accessibilityRole="button" accessibilityLabel={`${it.title}, ${it.detail}`} onPress={() => onOpen(it)} hapticKind="tap" scaleTo={0.95}
          style={{ minHeight: 40, maxWidth: 280, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: soft, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={14} weight="800" numberOfLines={1} style={{ flexShrink: 0 }}>{it.title}</T>
          <T size={13} weight="700" color={tone} numberOfLines={1} style={{ flexShrink: 1 }}>{it.detail}</T>
        </Press>;
      })}
    </ScrollView>
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
    Animated.parallel([Animated.spring(x, { toValue: l.x, speed: 16, bounciness: 6, useNativeDriver: false }), Animated.spring(w, { toValue: l.width, speed: 16, bounciness: 6, useNativeDriver: false })]).start();
  };
  useEffect(() => { move(value); }, [value]);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 2, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
      {ready ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: c.surface, left: x, width: w }, elevate(c, 1)]} /> : null}
      {zones.map(z => {
        const active = z === value;
        return <Press key={z} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(z)} hapticKind="select" scaleTo={0.96} sink={0}
          onLayout={e => { layouts.current[z] = e.nativeEvent.layout; if (active) { move(z, true); setReady(true); } }}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={14} weight={active ? '800' : '600'} color={active ? c.text : c.muted}>{z === 'Todas' ? 'Todo' : z}</T>
          {counts[z] != null ? <Num size={12} weight="700" color={c.faint}>{counts[z]}</Num> : null}
        </Press>;
      })}
    </View>
  </ScrollView>;
}

// ── Acciones rápidas de mesa (mantener presionada) ────────────────────────
export function TableActionsSheet({ mesa, state, order, onClose, actions }) {
  const { c } = useTheme();
  const meta = mesa ? comandaTableMeta(state, c) : null;
  const balance = order ? Number(order.saldo_pendiente ?? Math.max(0, Number(order.total || 0) - Number(order.abonado || 0))) : 0;
  const row = (Icon, label, detail, onPress, disabled) => <Press key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { onClose(); onPress(); }} hapticKind="tap"
    style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: radius.md, opacity: disabled ? 0.4 : 1 }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.text} /></View>
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
          style={{ width: '31%', minWidth: 96, minHeight: 76, padding: 12, borderRadius: radius.lg, backgroundColor: meta.shape === 'filled' ? meta.bg : free ? c.greenSoft : c.surfaceAlt, justifyContent: 'space-between' }}>
          <Num size={22} weight="800" color={meta.shape === 'filled' ? c.onPrimary : c.text}>{m.numero}</Num>
          <T size={13} weight="700" color={meta.shape === 'filled' ? c.onPrimary : free ? c.green : c.text}>{free ? 'Mover aquí' : 'Unir'}</T>
        </Press>;
      })}
    </View>
  </BottomSheet>;
}

// ── Bandeja «Listo» ────────────────────────────────────────────────────────
// Rondas listas con «Entregado» en un toque, demoras y actividad reciente.
export function ReadyTray({ open, onClose, ready, partial = [], alerts, activity, onDeliver, deliveringId, onOpen, clearActivity, now }) {
  const { c } = useTheme();
  const [tab, setTab] = useState('listo');
  const unread = activity.filter(a => !a.read).length;
  const late = alerts.items.filter(a => a.tipo !== 'lista');
  const placeOf = (pedido, item) => (pedido?.mesa_id || item?.mesa_id) ? `Mesa ${pedido?.mesa_numero || item?.mesa_numero || pedido?.mesa_id || item?.mesa_id}` : `${(pedido?.tipo || item?.origen) === 'Delivery' ? 'Delivery' : 'Para llevar'} #${pedido?.id || item?.pedido_id}`;
  const itemsText = round => (round.items || []).slice(0, 4).map(i => `${i.cantidad}× ${i.nombre || i.producto_nombre || 'Producto'}`).join(' · ');
  return <BottomSheet visible={open} onClose={onClose} title="Bandeja" subtitle={ready.length ? `${ready.length} ${ready.length === 1 ? 'ronda lista' : 'rondas listas'} para llevar a la mesa` : 'Nada esperando en el pase'}>
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      <Chip selected={tab === 'listo'} onPress={() => setTab('listo')} count={ready.length + partial.length}>Listo</Chip>
      <Chip selected={tab === 'demoras'} onPress={() => setTab('demoras')} count={late.length}>Demoras</Chip>
      <Chip selected={tab === 'actividad'} onPress={() => setTab('actividad')} count={unread}>Actividad</Chip>
    </View>
    {tab === 'listo' ? (ready.length ? <View style={{ gap: space.sm }}>
      <T size={13} color={c.muted}>Desliza una ronda hacia la derecha para marcarla como entregada.</T>
      {ready.map(({ round, pedido, minutes }, i) => <Appear key={round.id} delay={i * 40}>
        <SwipeRow direction="right" label="Entregado" icon={CheckCheck} disabled={deliveringId === round.id} onSwipe={() => onDeliver(round, pedido)}>
        <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.isDark ? c.surfaceAlt : '#F2FAF5', borderWidth: 1, borderColor: c.isDark ? c.line : '#D7EFDF', gap: 6 }}>
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
        </SwipeRow>
      </Appear>)}
    </View> : partial.length ? null : <EmptyState icon={CheckCheck} title="Pase vacío" description="Cuando cocina marque una ronda como lista aparecerá aquí, con vibración." />) : null}
    {tab === 'listo' && partial.length ? <View style={{ gap: space.sm }}>
      <T size={15} weight="800">Platos listos de rondas en preparación</T>
      <T size={13} color={c.muted}>Cocina ya sacó estos platos; el resto de la ronda sigue en preparación.</T>
      {partial.map(({ round, pedido, items, total }, i) => <Appear key={round.id} delay={i * 40}>
        <Press accessibilityRole="button" accessibilityLabel={`${placeOf(pedido)}: ${items.map(it => it.nombre).join(', ')} listos`} onPress={() => onOpen({ mesa_id: pedido.mesa_id, pedido_id: pedido.id, pedido })} hapticKind="tap"
          style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.skySoft, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T size={17} weight="800" style={{ flex: 1 }}>{placeOf(pedido)}</T>
            <Num size={13} weight="800" color={c.sky}>{items.length} de {total} listos</Num>
          </View>
          {items.map(it => <T key={it.id} size={15} weight="700" color={c.text}>✓ {it.cantidad}× {it.nombre}</T>)}
        </Press>
      </Appear>)}
    </View> : null}
    {tab === 'demoras' ? <View style={{ gap: space.sm }}>
      {alerts.error ? <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.amberSoft, gap: space.sm }}>
        <T size={15} weight="600" color={c.amber}>No se pudieron revisar las demoras.{alerts.items.length ? ' Se muestra la última consulta.' : ''}</T>
        <Button variant="outline" size="sm" onPress={alerts.refresh}>Reintentar</Button>
      </View> : null}
      {!alerts.error && !late.length ? <EmptyState icon={Clock3} title={alerts.limits?.enabled === false ? 'Avisos en pausa' : 'Sin demoras'} description={alerts.limits?.enabled === false ? 'Las alertas de demora están desactivadas en Ajustes.' : `Se avisa cuando cocina pasa de ${alerts.limits?.espera ?? 20} min.`} /> : null}
      {late.map(item => <Press key={item.id} accessibilityRole="button" onPress={() => onOpen(item)} hapticKind="tap"
        style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.redSoft, gap: 4 }}>
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
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.read ? c.softer : c.primary }} />
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
  return <Animated.View style={{ flex: 1, opacity: v, flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, borderRadius: radius.pill, paddingLeft: 16, backgroundColor: c.surfaceAlt }}>
    <Search size={18} color={c.muted} />
    <TextInput autoFocus value={value} onChangeText={onChange} placeholder="Mesa o zona" placeholderTextColor={c.faint} accessibilityLabel="Buscar mesa por número o zona"
      style={{ flex: 1, minWidth: 0, fontSize: 16, color: c.text, paddingHorizontal: 8, paddingVertical: 10, ...(typeof document !== 'undefined' ? { outlineStyle: 'none' } : {}) }} />
    <IconButton icon={X} label="Cerrar búsqueda" onPress={() => { onChange(''); setOpen(false); }} />
  </Animated.View>;
}

export { haptic as salonHaptic } from './comanda';
