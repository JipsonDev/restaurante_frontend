// Salón del mesero (marca blanca).
// Casillas de mesa con un solo estado en colores fijos: Lista (verde lleno) y Por cobrar (ámbar lleno) resaltan;
// el resto es neutro con el estado en texto e icono. Bandeja «Listo», acciones rápidas y transferir.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, TextInput, View } from 'react-native';
const WEB_RING = Platform.OS === 'web';
import axios from 'axios';
import { ArrowRightLeft, BellRing, CalendarClock, ChefHat, CheckCheck, Clock3, CloudOff, Lock, Phone, Receipt, Search, Users, UserCheck, Utensils, X } from 'lucide-react-native';
import { comandaTableMeta, meseroTableTone, useTheme } from '../../theme';
import { BASE_URL } from '../../context/AuthContext';
import { serviceDate, serviceDuration, serviceRounds } from '../../utils/serviceTiming.mjs';
import { RESERVATION_LABELS, addDays, dayOf, holdingReservation, isLate, localStamp, minutesUntil, nextByTable, timeOf } from '../../utils/reservationLogic.mjs';
import { REALTIME_EVENTS, subscribeRealtime } from '../../services/realtime';
import { Appear, BottomSheet, Button, Chip, EASE, EmptyState, IconButton, Label, Num, Perforation, Ping, Press, Stamp, SwipeRow, T, TOUCH, elevate, haptic, money, radius, space } from './kit';

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
// Devuelve la próxima por mesa (como antes) y además: .list (todas las de hoy), .now y .reload().
export function useTodayReservations(enabled = true) {
  const [list, setList] = useState([]);
  const [now, setNow] = useState(localStamp());
  const loadRef = useRef(() => {});
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = async () => {
      const today = dayOf(localStamp());
      try {
        const { data } = await axios.get(`${BASE_URL}/reservas`, { params: { desde: today, hasta: addDays(today, 0) } });
        if (alive && Array.isArray(data)) setList(data);
      } catch { /* sin reservas disponibles: el salón funciona igual */ }
      if (alive) setNow(localStamp());
    };
    loadRef.current = load;
    load();
    const t = setInterval(load, 60000);
    // Una reserva nueva, cambiada o marcada como «Llegó» en otro equipo se ve al instante.
    const off = subscribeRealtime(REALTIME_EVENTS.RESERVATION_UPDATED, load);
    return () => { alive = false; clearInterval(t); off?.(); };
  }, [enabled]);
  return useMemo(() => {
    const byTable = nextByTable(list, now);
    Object.defineProperties(byTable, {
      list: { value: list, enumerable: false }, now: { value: now, enumerable: false },
      reload: { value: () => loadRef.current(), enumerable: false },
      held: { value: mesaId => holdingReservation(list, mesaId, now), enumerable: false },
    });
    return byTable;
  }, [list, now]);
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
export function TableTile({ mesa, state, order, width, now, selected, ready, alert, reservation, held, queued, onPress, onLongPress }) {
  const { c } = useTheme();
  // Destello solo cuando cocina deja lista otra ronda (no por cambios que hizo el propio mesero).
  const prevReady = useRef(ready); const [pingKey, setPingKey] = useState(0);
  useEffect(() => { if (ready > prevReady.current) setPingKey(k => k + 1); prevReady.current = ready; }, [ready]);
  const balance = order ? Number(order.saldo_pendiente ?? Math.max(0, Number(order.total || 0) - Number(order.abonado || 0))) : 0;
  const resMinutes = reservation ? minutesUntil(reservation) : null;
  const rounds = order ? serviceRounds(order) : [];
  const cooking = rounds.some(r => ['PENDIENTE', 'PREPARANDO'].includes(r.estado));
  // Un solo estado por mesa, del más urgente al más tranquilo. Sin enviar manda sobre todo: cocina aún no la ve.
  const [kind, Icon, text] = queued ? ['queued', CloudOff, 'Sin enviar']
    : ready ? ['ready', CheckCheck, ready > 1 ? `${ready} listas` : 'Lista']
    : state === 'Cuenta' ? ['bill', Receipt, 'Por cobrar']
    : alert ? ['late', Clock3, `Espera ${alert.minutos} min`]
    : cooking ? ['kitchen', ChefHat, 'En cocina']
    : order ? ['eating', Utensils, 'Comiendo']
    : held ? ['reserved', Lock, `Reservada ${timeOf(held.fecha_hora)}`]
    : state === 'Reservada' || (reservation && resMinutes != null && resMinutes <= 90) ? ['reserved', CalendarClock, `Reserva ${timeOf(reservation?.fecha_hora) || ''}`.trim()]
    : ['free', Users, mesa.capacidad ? `Libre · ${mesa.capacidad}` : 'Libre'];
  // Todas las mesas son bloques de color sólido, sin bordes: libre gris claro, ocupada oscura, estados con su color.
  const tone = meseroTableTone(kind, c);
  const free = kind === 'free';
  const calm = free || kind === 'kitchen' || kind === 'eating';
  const filled = !calm;
  const fg = filled ? tone.fg : c.text;
  const label = `Mesa ${mesa.numero}, ${text}${order ? `, ${money(balance)}` : ''}`;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Toca para pedir; mantén presionado para más acciones" accessibilityState={{ selected }}
    onPress={() => onPress(mesa)} onLongPress={onLongPress ? () => onLongPress(mesa) : undefined} hapticKind="tap" scaleTo={0.96}
    style={[{ width, minHeight: 92, padding: 12, borderRadius: radius.lg, justifyContent: 'space-between', gap: 10, backgroundColor: tone.bg },
      selected ? (WEB_RING ? { boxShadow: `0 0 0 2px ${c.bg}, 0 0 0 4px ${c.text}` } : { opacity: 0.85 }) : null]}>
    <Ping trigger={pingKey} color={c.greenFill} radius={radius.lg} />
    <View>
      <Num size={28} weight="700" color={free ? c.muted : fg} style={{ lineHeight: 32 }}>{mesa.numero}</Num>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon size={15} color={filled ? fg : tone.fg} strokeWidth={2.4} />
      <T size={13} weight={filled ? '700' : '600'} color={filled ? fg : tone.fg} numberOfLines={1} style={{ flexShrink: 1 }}>{text}</T>
    </View>
  </Press>;
}

// ── Mesa apartada por una reserva ──────────────────────────────────────────
// Al tocar una mesa apartada se pregunta antes de abrir cuenta: ¿llegó la reserva o se usa igual?
export function ReservationHoldSheet({ hold, onClose, onSeat, onUseAnyway }) {
  const { c } = useTheme();
  const r = hold?.reserva;
  const minutes = r ? minutesUntil(r) : null;
  const when = minutes == null ? '' : minutes > 0 ? `llega en ${minutes} min` : minutes === 0 ? 'es ahora' : `hace ${-minutes} min`;
  return <BottomSheet visible={!!hold} onClose={onClose} title={hold ? `Mesa ${hold.mesa.numero} está reservada` : ''} subtitle={r ? `A las ${timeOf(r.fecha_hora)} · ${when}` : ''}>
    {r ? <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.purpleSoft }}>
        <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><CalendarClock size={22} color={c.purple} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={18} weight="800" numberOfLines={1}>{r.cliente_nombre}</T>
          <T size={14} color={c.muted}>{r.personas} {Number(r.personas) === 1 ? 'persona' : 'personas'}{r.notas ? ` · ${r.notas}` : ''}</T>
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <Button variant="primary" size="lg" full icon={UserCheck} onPress={onSeat}>Llegó la reserva: tomar pedido</Button>
        <Button variant="outline" size="lg" full onPress={onUseAnyway}>Usar la mesa para otro cliente</Button>
        <Button variant="ghost" full onPress={onClose}>Volver</Button>
      </View>
    </View> : null}
  </BottomSheet>;
}

// ── Reservas de hoy ────────────────────────────────────────────────────────
export function ReservationsTodaySheet({ open, onClose, reservations = [], now, onArrived, busyId }) {
  const { c } = useTheme();
  const sorted = [...reservations].sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)));
  const active = sorted.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado));
  return <BottomSheet visible={open} onClose={onClose} title="Reservas de hoy" subtitle={active.length ? `${active.length} por llegar` : sorted.length ? 'Ya llegaron todas' : null}>
    {!sorted.length ? <EmptyState icon={CalendarClock} title="Sin reservas para hoy" description="Las reservas se registran desde administración." />
      : <View style={{ gap: space.sm }}>
        {sorted.map(r => {
          const waiting = ['PENDIENTE', 'CONFIRMADA'].includes(r.estado);
          const minutes = minutesUntil(r, now);
          const late = isLate(r, now);
          const note = !waiting ? RESERVATION_LABELS[r.estado] : late ? `${-minutes} min tarde` : minutes != null && minutes <= 60 && minutes >= 0 ? `en ${minutes} min` : null;
          return <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt, opacity: waiting ? 1 : 0.6 }}>
            <View style={{ width: 58, alignItems: 'center' }}>
              <Num size={18} weight="800">{timeOf(r.fecha_hora)}</Num>
              {note ? <T size={12} weight="800" color={late ? c.red : waiting ? c.purple : c.muted} numberOfLines={1}>{note}</T> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} weight="800" numberOfLines={1}>{r.cliente_nombre}</T>
              <T size={14} color={c.muted} numberOfLines={1}>{r.personas} {Number(r.personas) === 1 ? 'persona' : 'personas'} · {r.mesa_id != null ? `Mesa ${r.mesa_numero}` : 'sin mesa'}{r.telefono ? ` · ${r.telefono}` : ''}</T>
            </View>
            {waiting ? <Button size="sm" variant="ink" icon={UserCheck} loading={busyId === r.id} onPress={() => onArrived(r)} accessibilityLabel={`Marcar que llegó ${r.cliente_nombre}`}>Llegó</Button> : null}
          </View>;
        })}
      </View>}
  </BottomSheet>;
}

// ── Aviso para activar las notificaciones de cocina ───────────────────────
export function AlertsBanner({ visible, onEnable, onDismiss }) {
  const { c } = useTheme();
  if (!visible) return null;
  return <Appear><View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6, paddingLeft: space.md, paddingRight: 2, marginBottom: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }}>
    <BellRing size={18} color={c.primaryText} />
    <T size={14} weight="700" style={{ flex: 1 }} numberOfLines={2}>Avisos de plato listo</T>
    <Button size="sm" variant="primary" onPress={onEnable} accessibilityLabel="Activar los avisos de plato listo">Activar</Button>
    <IconButton icon={X} label="Ahora no" onPress={onDismiss} size={40} />
  </View></Appear>;
}

// ── Atender ahora ──────────────────────────────────────────────────────────
// Fila de fichas con lo urgente: rondas listas, demoras y cuentas pedidas.
export function AttentionStrip({ items, onOpen }) {
  const { c } = useTheme();
  if (!items.length) return null;
  // Tarjetas cortas y deslizables con lo que necesita al mesero ya: rondas listas, esperas, cuentas y reservas.
  return <View style={{ marginBottom: space.lg }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.sm }}>
      <T size={17} weight="700" accessibilityRole="header">Atender ahora</T>
      <Num size={15} weight="600" color={c.muted}>{items.length}</Num>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -16 }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: 16 }}>
      {items.map(it => {
        const kind = it.tone === 'ready' ? 'ready' : it.tone === 'late' ? 'late' : it.tone === 'reserve' ? 'reserved' : 'bill';
        const tone = meseroTableTone(kind, c);
        const filled = kind === 'ready' || kind === 'bill';
        const Icon = kind === 'ready' ? CheckCheck : kind === 'late' ? Clock3 : kind === 'reserved' ? CalendarClock : Receipt;
        return <Press key={it.key} accessibilityRole="button" accessibilityLabel={`${it.title}, ${it.detail}`} onPress={() => onOpen(it)} hapticKind="tap" scaleTo={0.96}
          style={{ width: 172, minHeight: 64, padding: 12, borderRadius: radius.md, backgroundColor: filled ? tone.bg : c.surfaceAlt, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon size={16} color={filled ? tone.fg : tone.fg} strokeWidth={2.4} />
            <T size={15} weight="700" color={filled ? tone.fg : c.text} numberOfLines={1}>{it.title}</T>
          </View>
          <T size={13} weight="500" color={filled ? tone.fg : c.muted} numberOfLines={1}>{it.detail}</T>
        </Press>;
      })}
    </ScrollView>
  </View>;
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
    x.setValue(l.x); w.setValue(l.width);
  };
  useEffect(() => { move(value); }, [value]);
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 2, padding: 4, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
      {ready ? <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 4, bottom: 4, borderRadius: radius.md, backgroundColor: c.surface, left: x, width: w }, elevate(c, 1)]} /> : null}
      {zones.map(z => {
        const active = z === value;
        return <Press key={z} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(z)} hapticKind="select" scaleTo={0.96} sink={0}
          onLayout={e => { layouts.current[z] = e.nativeEvent.layout; if (active) { move(z, true); setReady(true); } }}
          style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
    <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.text} /></View>
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
export function ReadyTray({ open, onClose, ready, partial = [], alerts, activity, onDeliver, deliveringId, onOpen, clearActivity, now, alertsPrompt }) {
  const { c } = useTheme();
  const [tab, setTab] = useState('listo');
  const unread = activity.filter(a => !a.read).length;
  const late = alerts.items.filter(a => a.tipo !== 'lista');
  const placeOf = (pedido, item) => (pedido?.mesa_id || item?.mesa_id) ? `Mesa ${pedido?.mesa_numero || item?.mesa_numero || pedido?.mesa_id || item?.mesa_id}` : `${(pedido?.tipo || item?.origen) === 'Delivery' ? 'Delivery' : 'Para llevar'} #${pedido?.id || item?.pedido_id}`;
  const itemsText = round => (round.items || []).slice(0, 4).map(i => `${i.cantidad}× ${i.nombre || i.producto_nombre || 'Producto'}`).join(' · ');
  return <BottomSheet visible={open} onClose={onClose} title="Bandeja" subtitle={ready.length ? `${ready.length} ${ready.length === 1 ? 'ronda lista' : 'rondas listas'} para llevar a la mesa` : 'Nada esperando en el pase'}>
    {alertsPrompt?.visible ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
      <BellRing size={20} color={c.text} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="700">Avisos de plato listo</T>
        <T size={13} color={c.muted}>Suena y vibra aunque tengas el teléfono bloqueado.</T>
      </View>
      <Button size="sm" variant="ink" onPress={alertsPrompt.enable} accessibilityLabel="Activar los avisos de plato listo">Activar</Button>
    </View> : null}
    <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
      <Chip selected={tab === 'listo'} onPress={() => setTab('listo')} count={ready.length + partial.length}>Listo</Chip>
      <Chip selected={tab === 'demoras'} onPress={() => setTab('demoras')} count={late.length}>Demoras</Chip>
      <Chip selected={tab === 'actividad'} onPress={() => setTab('actividad')} count={unread}>Actividad</Chip>
    </View>
    {tab === 'listo' ? (ready.length ? <View style={{ gap: space.sm }}>
      {ready.map(({ round, pedido, minutes }) => <View key={round.id}>
        <SwipeRow direction="right" label="Entregado" icon={CheckCheck} disabled={deliveringId === round.id} onSwipe={() => onDeliver(round, pedido)}>
        <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.surfaceAlt, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T size={18} weight="700" style={{ flex: 1 }}>{placeOf(pedido)}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><CheckCheck size={15} color={c.green} strokeWidth={2.4} /><T size={14} weight="700" color={c.green}>Lista</T></View>
          </View>
          <Num size={13} color={minutes != null && minutes >= (alerts.limits?.lista || 5) ? c.red : c.muted}>{minutes ? `hace ${shortMinutes(minutes)}` : 'recién salida'}</Num>
          {itemsText(round) ? <T size={15} color={c.muted} numberOfLines={2}>{itemsText(round)}</T> : null}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4 }}>
            <Button variant="ink" icon={CheckCheck} loading={deliveringId === round.id} onPress={() => onDeliver(round, pedido)} hapticKind="tap">Entregado</Button>
            <Button variant="ghost" onPress={() => onOpen({ mesa_id: pedido.mesa_id, pedido_id: pedido.id, pedido })}>Ver</Button>
          </View>
        </View>
        </SwipeRow>
      </View>)}
    </View> : partial.length ? null : <EmptyState icon={CheckCheck} title="Pase vacío" description="Cuando cocina marque una ronda como lista aparecerá aquí, con vibración." />) : null}
    {tab === 'listo' && partial.length ? <View style={{ gap: space.sm }}>
      <T size={15} weight="700" style={{ marginTop: space.sm }}>Platos sueltos ya listos</T>
      {partial.map(({ round, pedido, items, total }) => <View key={round.id}>
        <Press accessibilityRole="button" accessibilityLabel={`${placeOf(pedido)}: ${items.map(it => it.nombre).join(', ')} listos`} onPress={() => onOpen({ mesa_id: pedido.mesa_id, pedido_id: pedido.id, pedido })} hapticKind="tap"
          style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.surfaceAlt, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T size={17} weight="800" style={{ flex: 1 }}>{placeOf(pedido)}</T>
            <Num size={13} weight="600" color={c.muted}>{items.length} de {total} listos</Num>
          </View>
          {items.map(it => <T key={it.id} size={15} weight="700" color={c.text}>✓ {it.cantidad}× {it.nombre}</T>)}
        </Press>
      </View>)}
    </View> : null}
    {tab === 'demoras' ? <View style={{ gap: space.sm }}>
      {alerts.error ? <View style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.amberSoft, gap: space.sm }}>
        <T size={15} weight="600" color={c.amber}>No se pudieron revisar las demoras.{alerts.items.length ? ' Se muestra la última consulta.' : ''}</T>
        <Button variant="outline" size="sm" onPress={alerts.refresh}>Reintentar</Button>
      </View> : null}
      {!alerts.error && !late.length ? <EmptyState icon={Clock3} title={alerts.limits?.enabled === false ? 'Avisos en pausa' : 'Sin demoras'} description={alerts.limits?.enabled === false ? 'Las alertas de demora están desactivadas en Ajustes.' : `Se avisa cuando cocina pasa de ${alerts.limits?.espera ?? 20} min.`} /> : null}
      {late.map(item => <Press key={item.id} accessibilityRole="button" onPress={() => onOpen(item)} hapticKind="tap"
        style={{ borderRadius: radius.lg, padding: space.lg, backgroundColor: c.surfaceAlt, gap: 4 }}>
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
  if (!open) return <IconButton icon={Search} label="Buscar mesa" onPress={() => { haptic('tap'); setOpen(true); }} filled />;
  return <Animated.View style={{ flex: 1, opacity: v, flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, borderRadius: radius.md, paddingLeft: 14, backgroundColor: c.surfaceAlt }}>
    <Search size={18} color={c.muted} />
    <TextInput autoFocus value={value} onChangeText={onChange} placeholder="Mesa o zona" placeholderTextColor={c.muted} accessibilityLabel="Buscar mesa por número o zona"
      style={{ flex: 1, minWidth: 0, fontSize: 16, color: c.text, paddingHorizontal: 8, paddingVertical: 10, ...(typeof document !== 'undefined' ? { outlineStyle: 'none' } : {}) }} />
    <IconButton icon={X} label="Cerrar búsqueda" onPress={() => { onChange(''); setOpen(false); }} />
  </Animated.View>;
}

export { haptic as salonHaptic } from './kit';
