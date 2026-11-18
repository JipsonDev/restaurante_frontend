// Comanda: piezas de la hoja de pedido del mesero (encabezado, líneas, rondas, barra de envío, cola).
// Todo se apoya en el kit del mesero (kit.js); aquí no se definen colores propios.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Plus, Check, ChevronDown, CloudOff, RefreshCw, Send, PencilLine, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import {
  BottomSheet, Button, Chip, EASE, EASE_IN_OUT, reducedMotion, Appear, IconButton, Label, LeaderLine, QtyControl, Num, Perforation, Press, RollingNumber, Stamp, SwipeRow, Tally, T,
  TOUCH, TOUCH_MAIN, elevate, haptic, money, radius, space,
} from './kit';

const ND = false; // height/opacidad no se pueden animar en el hilo nativo

// Encabezado de la cuenta: volver al menú, la mesa y su estado.
export function ComandaHeader({ number, title, subtitle, meta, stamp, stampColor, children, onBack, action }) {
  const { c } = useTheme();
  return <View style={{ paddingBottom: space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {onBack ? <View style={{ marginLeft: -10 }}><IconButton icon={ArrowLeft} label="Volver al menú" onPress={onBack} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={24} weight="700" numberOfLines={1} accessibilityRole="header">{title}</T>
        {[meta, subtitle].filter(Boolean).length ? <T size={14} color={c.muted} numberOfLines={2}>{[meta, subtitle].filter(Boolean).join(' · ')}</T> : null}
      </View>
      {stamp ? <Stamp color={stampColor}>{stamp}</Stamp> : null}
      {action}
    </View>
    {children}
  </View>;
}

// Sección con título.
export function SectionLabel({ children, right }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
    <T size={17} weight="700" accessibilityRole="header">{children}</T>{right}
  </View>;
}

// Línea de la ronda nueva: [cantidad] nombre · precio; debajo, la nota (o «Añadir nota»). Tocar el texto abre notas y extras.
// Al quitarla se encoge (alto + opacidad, 200 ms) y luego avisa a onRemove. También se puede deslizar a la izquierda.
export function OrderLine({ item, total, detail, expanded, onToggle, onQty, onRemove, locked, children }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const [h, setH] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const remove = (fromSwipe = false) => {
    if (leaving) return;
    if (!fromSwipe) haptic('medium');
    setLeaving(true);
    Animated.timing(v, { toValue: 0, duration: reducedMotion() ? 120 : 180, easing: EASE, useNativeDriver: ND }).start(() => onRemove?.());
  };
  const qty = Number(item.cantidad) || 1;
  const style = leaving && h ? { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), opacity: v, overflow: 'hidden' } : { opacity: v };
  return <Animated.View style={style}>
    <View onLayout={e => !leaving && setH(e.nativeEvent.layout.height)}>
    <SwipeRow direction="left" onSwipe={() => remove(true)} label="Quitar" icon={Trash2} disabled={locked || leaving} radius={0}>
    <View style={{ paddingVertical: space.md, backgroundColor: c.bg, opacity: locked ? 0.6 : 1 }} pointerEvents={locked ? 'none' : 'auto'}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <QtyControl value={qty} label={item.nombre} onInc={() => onQty(1)} onDec={() => qty <= 1 ? remove() : onQty(-1)} />
        <Press accessibilityRole="button" accessibilityState={{ expanded: !!expanded }} accessibilityLabel={`${item.nombre}. Notas y extras`} onPress={onToggle} scaleTo={0.99}
          style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', gap: 2 }}>
          <LeaderLine left={<T size={16} weight="600" numberOfLines={2}>{item.nombre}</T>}
            right={<RollingNumber value={total} format={money} size={16} weight="600" />} />
          {detail ? <T size={14} color={c.muted} numberOfLines={2}>{detail}</T>
            : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><PencilLine size={13} color={c.muted} /><T size={14} color={c.muted}>{expanded ? 'Cerrar' : 'Añadir nota'}</T></View>}
        </Press>
      </View>
      {expanded ? <View style={{ marginTop: space.md }}>{children}</View> : null}
    </View>
    </SwipeRow>
    </View>
  </Animated.View>;
}

// Panel de personalización por línea: notas, exclusiones, extras con costo y extra libre.
export function LineCustomizer({ item, exclusions = [], paid = [], custom = {}, onNote, onToggle, onCustomChange, onCustomAdd }) {
  const { c } = useTheme();
  const [showCustom, setShowCustom] = useState(false);
  const active = extra => (item.modificadores || []).some(m => m.nombre === extra.nombre);
  const priceOf = extra => Number(extra.precio_extra ?? extra.precio ?? 0);
  const input = { minHeight: TOUCH, borderRadius: radius.md, backgroundColor: c.surfaceAlt, color: c.text, paddingHorizontal: space.md, fontSize: 16, minWidth: 0 };
  return <View style={{ gap: space.md, marginLeft: 34 + space.md }}>
    <View><Label style={{ marginBottom: 6 }}>Nota para cocina</Label>
      <TextInput value={item.notas || ''} onChangeText={onNote} placeholder="Ej. sin cebolla, poco picante" placeholderTextColor={c.muted} multiline accessibilityLabel={`Notas para ${item.nombre}`} style={[input, { paddingVertical: 10 }]} /></View>
    {exclusions.length ? <View><Label style={{ marginBottom: 6 }}>Sin / opciones</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{exclusions.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre}{priceOf(x) ? ` +${money(priceOf(x))}` : ''}</Chip>)}</View></View> : null}
    {paid.length ? <View><Label style={{ marginBottom: 6 }}>Extras con costo</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{paid.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre} +{money(priceOf(x))}</Chip>)}</View></View> : null}
    {showCustom || custom.nombre ? <View><Label style={{ marginBottom: 6 }}>Otro extra</Label>
      <TextInput value={custom.nombre || ''} onChangeText={nombre => onCustomChange({ nombre })} placeholder="Nombre" placeholderTextColor={c.muted} accessibilityLabel="Nombre del extra personalizado" style={input} />
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <TextInput value={custom.precio || ''} onChangeText={precio => onCustomChange({ precio })} placeholder="0,00" placeholderTextColor={c.muted} keyboardType="decimal-pad" accessibilityLabel="Precio del extra personalizado" style={[input, { flex: 1, textAlign: 'right' }]} />
        <Button variant="ink" onPress={onCustomAdd} disabled={!String(custom.nombre || '').trim()} accessibilityLabel="Añadir extra personalizado">Añadir</Button>
      </View></View> : <Press accessibilityRole="button" onPress={() => setShowCustom(true)} scaleTo={0.99} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      <Plus size={16} color={c.text} strokeWidth={2.4} /><T size={14} weight="600">Extra con precio</T>
    </Press>}
  </View>;
}

// Seguimiento de una ronda, como el de un pedido a domicilio: Enviada → En cocina → Lista → Entregada.
const ROUND_STEP = { PENDIENTE: 0, EN_PREPARACION: 1, PREPARANDO: 1, LISTO: 2, ENTREGADO: 3 };
const STEPS = ['Enviada', 'En cocina', 'Lista', 'Entregada'];
export function RoundTracker({ estado }) {
  const { c } = useTheme();
  if (estado === 'CANCELADO') return <Stamp color={c.red}>Anulada</Stamp>;
  const at = ROUND_STEP[estado] ?? 0;
  return <View accessibilityLabel={`Estado: ${STEPS[at]}`} style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= at ? (at === 2 ? c.greenFill : at === 3 ? c.muted : c.sky) : c.soft }} />)}
    </View>
    <View style={{ flexDirection: 'row' }}>
      {STEPS.map((label, i) => <T key={label} size={12} weight={i === at ? '700' : '500'} color={i === at ? (at === 2 ? c.green : c.text) : c.muted} style={{ flex: 1 }} numberOfLines={1}>{label}</T>)}
    </View>
  </View>;
}

// Estado de la ronda en una palabra; solo «Lista» lleva color (es lo único que pide acción).
export function RoundStatus({ estado }) {
  const { c } = useTheme();
  const step = ROUND_STEP[estado] ?? 0;
  const [text, color] = estado === 'CANCELADO' ? ['Anulada', c.red] : step === 2 ? ['Lista', c.green] : step === 3 ? ['Entregada', c.muted] : step === 1 ? ['En cocina', c.muted] : ['Enviada', c.muted];
  return <T size={14} weight={step === 2 ? '700' : '500'} color={color}>{text}</T>;
}

const clockOf = value => { const d = value ? new Date(String(value).replace(' ', 'T')) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''; };
// Ronda ya pedida: hora, seguimiento de cocina y sus platos (se pliega al tocar el encabezado).
export function PastRound({ round, index, children, action }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const toggle = () => { const next = !open; setOpen(next); if (reducedMotion()) turn.setValue(next ? 1 : 0); else Animated.timing(turn, { toValue: next ? 1 : 0, duration: 180, easing: EASE_IN_OUT, useNativeDriver: ND }).start(); };
  const items = round.items || [];
  const sum = items.reduce((s, it) => s + (Number(it.subtotal) || (Number(it.precio) || 0) * (Number(it.cantidad) || 0)), 0);
  const time = clockOf(round.created_at);
  return <View style={{ borderTopWidth: index > 1 ? 1 : 0, borderTopColor: c.line, marginBottom: space.xs }}>
    <Press accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Ronda ${index}${time ? `, ${time}` : ''}`} onPress={toggle} scaleTo={0.99}
      style={{ paddingTop: space.md, paddingBottom: open ? space.sm : space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T size={16} weight="600" style={{ flex: 1 }} numberOfLines={1}>Ronda {index}{time ? <T size={14} color={c.muted}>{`  ·  ${time}`}</T> : null}</T>
        <RoundStatus estado={round.estado} />
        {sum ? <Num size={15} weight="600">{money(sum)}</Num> : null}
        <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><ChevronDown size={18} color={c.muted} /></Animated.View>
      </View>
    </Press>
    {open ? <Appear offset={0} style={{ paddingBottom: space.md, gap: 2 }}>
      {items.map((it, i) => <View key={`${it.id || i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 5 }}>
        <T size={15} style={{ flex: 1 }} numberOfLines={2}><Num size={15} weight="700">{it.cantidad}× </Num>{it.nombre}</T>
        {it.listo_at && round.estado !== 'LISTO' && round.estado !== 'ENTREGADO' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Check size={14} color={c.green} strokeWidth={3} /><T size={13} weight="700" color={c.green}>lista</T></View> : null}
        <Num size={15} color={c.muted}>{money((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}</Num>
      </View>)}
      {children}
      {action}
    </Appear> : null}
  </View>;
}

// Totales: filas discretas; el importe que manda vive en el botón de enviar.
export function TotalsBlock({ rows = [], grand, grandLabel }) {
  const { c } = useTheme();
  return <View style={{ marginTop: space.lg, gap: 8, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: c.line }}>
    {rows.map(([l, v]) => <LeaderLine key={l} left={<T size={15} color={c.muted}>{l}</T>} right={<Num size={15} weight="500" color={c.muted}>{money(v)}</Num>} />)}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
      <T size={17} weight="700">{grandLabel}</T>
      <RollingNumber value={grand} format={money} size={18} weight="700" />
    </View>
  </View>;
}

// Botón fijo «Enviar a cocina · N · $X» en el color del local.
export function SendBar({ count, amount, onPress, sending, pending, offline, disabled, label }) {
  const { c } = useTheme();
  const text = label || (sending ? 'Enviando…' : pending ? (offline ? 'Sin enviar · reintentar ahora' : 'Reintentar envío') : 'Enviar a cocina');
  const fg = pending ? c.onInk : c.onPrimary;
  return <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 6, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
    <Press accessibilityRole="button" accessibilityLabel={`${text}${!pending && count ? `, ${count} ${count === 1 ? 'producto' : 'productos'}` : ''}, ${money(amount)}`} accessibilityState={{ disabled: !!(disabled || sending), busy: !!sending }}
      onPress={onPress} disabled={disabled || sending} scaleTo={0.98}
      style={{ minHeight: 56, borderRadius: radius.md, backgroundColor: pending ? c.ink : c.primary, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: space.lg, gap: space.md, opacity: disabled ? 0.4 : 1, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <View style={{ minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 9, backgroundColor: c.brandIsLight && !pending ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
        {pending ? <RefreshCw size={18} color={fg} /> : sending ? <Send size={18} color={fg} /> : <Num size={16} weight="800" color={fg}>{count}</Num>}
      </View>
      <T size={17} weight="700" color={fg} style={{ flex: 1 }} numberOfLines={1}>{text}</T>
      <Num size={17} weight="700" color={fg}>{money(amount)}</Num>
    </Press>
  </View>;
}

// Envoltura que «arranca» la hoja al enviar: sube 24 px y se desvanece (240 ms), luego vuelve.
export function TearAway({ tearing, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!tearing) { v.setValue(0); return; }
    Animated.timing(v, { toValue: 1, duration: 240, easing: EASE, useNativeDriver: ND }).start();
  }, [tearing]);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] }]}>{children}</Animated.View>;
}

// Estado de la conexión y rondas guardadas sin enviar. Siempre a la vista, arriba de todas las pantallas.
//  · Sin internet y nada pendiente: una línea tranquila («sigue tomando pedidos»).
//  · Rondas sin enviar: cuáles son, desde cuándo esperan y un botón para reintentar.
const hhmm = value => { const d = value ? new Date(value) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''; };
export function OfflineQueue({ entries = [], retrying, onRetry, nextIn, offline, savedLabel }) {
  const { c } = useTheme();
  if (!entries.length && !offline) return null;
  const count = entries.length;
  const title = count ? (count === 1 ? '1 ronda sin enviar a cocina' : `${count} rondas sin enviar a cocina`) : 'Sin internet';
  const detail = count
    ? (offline ? 'Están guardadas en este teléfono. Se envían solas al volver el internet.' : `Reintentando${nextIn ? ` en ${Math.ceil(nextIn / 1000)} s` : '…'} No se duplican.`)
    : `Puedes seguir tomando pedidos: se guardan aquí y se envían al volver el internet.${savedLabel ? ` Mesas y menú de ${savedLabel}.` : ''}`;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ marginHorizontal: space.md, marginTop: space.sm, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.lg, backgroundColor: c.amberSoft, gap: space.sm }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <CloudOff size={20} color={c.amber} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="800">{title}</T>
        <T size={13} color={c.muted}>{detail}</T>
      </View>
      {count ? <Button variant="ink" size="sm" icon={RefreshCw} loading={retrying} onPress={onRetry} accessibilityLabel="Reintentar el envío ahora">Reintentar</Button> : null}
    </View>
    {count ? <View style={{ gap: 4 }}>
      {entries.map(e => <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.amber }} />
        <T size={15} weight="700" style={{ flex: 1 }} numberOfLines={1}>{e.label}</T>
        <T size={13} color={c.muted}>{e.items} {e.items === 1 ? 'producto' : 'productos'}{hhmm(e.since) ? ` · ${hhmm(e.since)}` : ''}</T>
        <Num size={15} weight="700">{money(e.total)}</Num>
      </View>)}
    </View> : null}
  </View>;
}

export function PriceChangesSheet({ visible, diffs = [], message, onAccept, onClose, busy }) {
  const { c } = useTheme();
  return <BottomSheet visible={visible} onClose={onClose} busy={busy} title="Cambiaron los precios" subtitle={message || 'Revisa antes de enviar la ronda.'}
    footer={<View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button variant="ghost" onPress={onClose} style={{ flex: 1 }}>Revisar</Button>
      <Button variant="primary" onPress={onAccept} loading={busy} style={{ flex: 2 }} disabled={diffs.some(d => d.after == null)}>Aceptar y enviar</Button>
    </View>}>
    <View style={{ gap: space.sm }}>
      {diffs.length ? diffs.map(d => <LeaderLine key={d.name} left={<T size={16}>{d.name}</T>} right={d.after == null
        ? <Stamp color={c.red} size={12}>NO DISPONIBLE</Stamp>
        : <T size={16}><Num size={16} color={c.muted} style={{ textDecorationLine: 'line-through' }}>{money(d.before)}</Num>  <Num size={16} weight="700">{money(d.after)}</Num></T>} />)
        : <T size={15} color={c.muted}>El porcentaje de servicio cambió. Se recalcula el total al enviar.</T>}
      {diffs.some(d => d.after == null) ? <T size={14} color={c.red}>Quita los productos no disponibles para poder enviar.</T> : null}
    </View>
  </BottomSheet>;
}

// Aviso simple como hoja inferior (reemplaza el modal centrado).
export function NoticeSheet({ notice, onClose }) {
  return <BottomSheet visible={!!notice} onClose={onClose} title={notice?.title} subtitle={notice?.message}
    footer={<Button variant="ink" full onPress={onClose}>Entendido</Button>}>{null}</BottomSheet>;
}
