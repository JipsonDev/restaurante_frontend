// Comanda: piezas de la hoja de pedido del mesero (encabezado, líneas, rondas, barra de envío, cola).
// Todo se apoya en el kit del mesero (kit.js); aquí no se definen colores propios.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowLeft, Check, ChevronDown, CloudOff, RefreshCw, Send, PencilLine, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import {
  BottomSheet, Button, Chip, EASE, IconButton, Label, LeaderLine, Num, Perforation, Press, RollingNumber, Stamp, SwipeRow, Tally, T,
  TOUCH, TOUCH_MAIN, elevate, haptic, money, radius, space,
} from './kit';
import { ProductArt } from './ProductArt';

const ND = false; // height/opacidad no se pueden animar en el hilo nativo

// Encabezado de la cuenta: volver al menú, la mesa y su estado.
export function ComandaHeader({ number, title, subtitle, meta, stamp, stampColor, children, onBack }) {
  const { c } = useTheme();
  return <View style={{ paddingBottom: space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {onBack ? <View style={{ marginLeft: -10 }}><IconButton icon={ArrowLeft} label="Volver al menú" onPress={onBack} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={24} weight="700" numberOfLines={1} accessibilityRole="header">{title}</T>
        {[meta, subtitle].filter(Boolean).length ? <T size={14} color={c.muted} numberOfLines={2}>{[meta, subtitle].filter(Boolean).join(' · ')}</T> : null}
      </View>
      {stamp ? <Stamp color={stampColor}>{stamp}</Stamp> : null}
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

// Línea de la ronda nueva, como en un carrito: foto, nombre, notas, precio y − n + (en 1, la papelera quita).
// Al quitarla se encoge (alto + opacidad, 200 ms) y luego avisa a onRemove. También se puede deslizar a la izquierda.
export function OrderLine({ item, total, detail, image, product, expanded, onToggle, onQty, onRemove, locked, children }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const [h, setH] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const remove = () => {
    if (leaving) return;
    haptic('warning'); setLeaving(true);
    Animated.timing(v, { toValue: 0, duration: 200, easing: EASE, useNativeDriver: ND }).start(() => onRemove?.());
  };
  const qty = Number(item.cantidad) || 1;
  const style = leaving && h ? { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), opacity: v, overflow: 'hidden' } : { opacity: v };
  return <Animated.View style={style}>
    <View onLayout={e => !leaving && setH(e.nativeEvent.layout.height)}>
    <SwipeRow direction="left" onSwipe={remove} label="Quitar" icon={Trash2} disabled={locked || leaving} radius={0}>
    <View style={{ paddingVertical: space.md, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.line, opacity: locked ? 0.6 : 1 }} pointerEvents={locked ? 'none' : 'auto'}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View style={{ width: 56 }}><ProductArt product={product || item} radius={12} iconScale={0.42} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <LeaderLine left={<T size={16} weight="600" numberOfLines={2}>{item.nombre}</T>}
            right={<RollingNumber value={total} format={money} size={16} weight="700" />} />
          {detail ? <T size={14} color={c.muted} numberOfLines={3}>{detail}</T> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 }}>
            <Tally value={qty} size="sm" removable onChange={n => n <= 0 ? remove() : onQty(n - qty)} label={`Cantidad de ${item.nombre}`} />
            <Press accessibilityRole="button" accessibilityState={{ expanded: !!expanded }} accessibilityLabel={`Notas y extras de ${item.nombre}`} onPress={onToggle} hapticKind="tap"
              style={{ minHeight: 38, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: expanded ? c.ink : c.surfaceAlt }}>
              <PencilLine size={15} color={expanded ? c.onInk : c.text} />
              <T size={14} weight="600" color={expanded ? c.onInk : c.text}>{expanded ? 'Listo' : 'Notas'}</T>
            </Press>
          </View>
        </View>
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
  const active = extra => (item.modificadores || []).some(m => m.nombre === extra.nombre);
  const priceOf = extra => Number(extra.precio_extra ?? extra.precio ?? 0);
  const input = { minHeight: TOUCH, borderWidth: 0, borderRadius: radius.md, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 };
  return <View style={{ gap: space.md, padding: space.md, backgroundColor: c.surfaceAlt, borderRadius: radius.lg }}>
    <View><Label style={{ marginBottom: 6 }}>Nota para cocina</Label>
      <TextInput value={item.notas || ''} onChangeText={onNote} placeholder="Ej. sin cebolla, poco picante" placeholderTextColor={c.muted} multiline accessibilityLabel={`Notas para ${item.nombre}`} style={[input, { paddingVertical: 10 }]} /></View>
    {exclusions.length ? <View><Label style={{ marginBottom: 6 }}>Sin / opciones</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{exclusions.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre}{priceOf(x) ? ` +${money(priceOf(x))}` : ''}</Chip>)}</View></View> : null}
    {paid.length ? <View><Label style={{ marginBottom: 6 }}>Extras con costo</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{paid.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre} +{money(priceOf(x))}</Chip>)}</View></View> : null}
    <View><Label style={{ marginBottom: 6 }}>Otro extra</Label>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput value={custom.nombre || ''} onChangeText={nombre => onCustomChange({ nombre })} placeholder="Nombre" placeholderTextColor={c.muted} accessibilityLabel="Nombre del extra personalizado" style={[input, { flex: 1 }]} />
        <TextInput value={custom.precio || ''} onChangeText={precio => onCustomChange({ precio })} placeholder="0,00" placeholderTextColor={c.muted} keyboardType="decimal-pad" accessibilityLabel="Precio del extra personalizado" style={[input, { width: 84, textAlign: 'right' }]} />
        <Button variant="ink" onPress={onCustomAdd} disabled={!String(custom.nombre || '').trim()} accessibilityLabel="Añadir extra personalizado">Añadir</Button>
      </View></View>
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

const clockOf = value => { const d = value ? new Date(String(value).replace(' ', 'T')) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : ''; };
// Ronda ya pedida: hora, seguimiento de cocina y sus platos (se pliega al tocar el encabezado).
export function PastRound({ round, index, children, action }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(round.estado !== 'ENTREGADO');
  const items = round.items || [];
  const sum = items.reduce((s, it) => s + (Number(it.subtotal) || (Number(it.precio) || 0) * (Number(it.cantidad) || 0)), 0);
  const time = clockOf(round.created_at);
  return <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: space.lg, marginBottom: space.sm }}>
    <Press accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Ronda ${index}${time ? `, ${time}` : ''}`} onPress={() => setOpen(!open)} scaleTo={0.99}
      style={{ paddingTop: space.md, paddingBottom: open ? space.sm : space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T size={16} weight="700" style={{ flex: 1 }} numberOfLines={1}>Ronda {index}{time ? <T size={14} color={c.muted}>{`  ·  ${time}`}</T> : null}{round.estado_cobro === 'PAGADO' ? <T size={14} color={c.green} weight="600">{'  ·  pagada'}</T> : null}</T>
        {sum ? <Num size={15} weight="600">{money(sum)}</Num> : null}
        <ChevronDown size={18} color={c.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </View>
      <RoundTracker estado={round.estado} />
    </Press>
    {open ? <View style={{ paddingBottom: space.md, gap: 2 }}>
      {items.map((it, i) => <View key={`${it.id || i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 5 }}>
        <View style={{ width: 36 }}><ProductArt product={it} radius={8} iconScale={0.46} /></View>
        <T size={15} style={{ flex: 1 }} numberOfLines={2}><Num size={15} weight="700">{it.cantidad}× </Num>{it.nombre}</T>
        {it.listo_at && round.estado !== 'LISTO' && round.estado !== 'ENTREGADO' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Check size={14} color={c.green} strokeWidth={3} /><T size={13} weight="700" color={c.green}>lista</T></View> : null}
        <Num size={15} color={c.muted}>{money((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}</Num>
      </View>)}
      {children}
      {action}
    </View> : null}
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
      onPress={onPress} disabled={disabled || sending} hapticKind="medium" scaleTo={0.98}
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
