// Comanda: piezas de la hoja de pedido del mesero (encabezado, líneas, rondas, barra de envío, cola).
// Todo se apoya en el kit «Comanda» (comanda.js); aquí no se definen colores propios.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, TextInput, View } from 'react-native';
import { CloudOff, RefreshCw, Send, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import {
  BottomSheet, Button, Chip, EASE, Label, LeaderLine, Num, Perforation, Press, RollingNumber, Stamp, Tally, T,
  TOUCH, TOUCH_MAIN, haptic, money, radius, space,
} from './comanda';

const ND = false; // height/opacidad no se pueden animar en el hilo nativo

// Encabezado de la hoja: número grande en mono, zona y minutos.
export function ComandaHeader({ number, title, subtitle, meta, stamp, stampColor, children }) {
  const { c } = useTheme();
  return <View style={{ paddingBottom: space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
      {number != null ? <Num size={52} weight="700" style={{ lineHeight: 56, letterSpacing: -1 }} accessibilityLabel={`Mesa ${number}`}>{String(number).padStart(2, '0')}</Num> : null}
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 6 }}>
        <Label>{meta}</Label>
        <T size={20} weight="700" numberOfLines={1}>{title}</T>
        {subtitle ? <T size={14} color={c.muted} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {stamp ? <View style={{ paddingBottom: 10 }}><Stamp color={stampColor}>{stamp}</Stamp></View> : null}
    </View>
    {children}
    <Perforation style={{ marginTop: space.md }} />
  </View>;
}

// Sección rotulada de la libreta.
export function SectionLabel({ children, right }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
    <Label>{children}</Label>{right}
  </View>;
}

// Línea de la ronda nueva. Al quitarla se encoge (alto + opacidad, 200 ms) y luego avisa a onRemove.
export function OrderLine({ item, total, detail, image, expanded, onToggle, onQty, onRemove, locked, children }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const [h, setH] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const remove = () => {
    if (leaving) return;
    haptic('warning'); setLeaving(true);
    Animated.timing(v, { toValue: 0, duration: 200, easing: EASE, useNativeDriver: ND }).start(() => onRemove?.());
  };
  const style = leaving && h ? { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), opacity: v, overflow: 'hidden' } : { opacity: v };
  return <Animated.View style={style}>
    <View onLayout={e => !leaving && setH(e.nativeEvent.layout.height)} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: c.line, opacity: locked ? 0.6 : 1 }} pointerEvents={locked ? 'none' : 'auto'}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        {image ? <Image source={{ uri: image }} style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.soft }} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <LeaderLine left={<T size={16} weight="600" numberOfLines={2}><Num size={16} weight="700">{item.cantidad}× </Num>{item.nombre}</T>}
            right={<RollingNumber value={total} format={money} size={16} weight="600" />} />
          {detail ? <T size={14} color={c.muted} numberOfLines={3} style={{ marginTop: 2 }}>{detail}</T> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
        <Tally value={Number(item.cantidad) || 1} min={1} onChange={n => onQty(n - (Number(item.cantidad) || 1))} label={`Cantidad de ${item.nombre}`} />
        <View style={{ flex: 1 }} />
        <Button variant={expanded ? 'ink' : 'ghost'} icon={SlidersHorizontal} onPress={onToggle} accessibilityLabel={`Notas y extras de ${item.nombre}`}>{expanded ? 'Listo' : 'Notas'}</Button>
        <Press accessibilityRole="button" accessibilityLabel={`Quitar ${item.nombre}`} onPress={remove} hapticKind={null}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md }}>
          <Trash2 size={20} color={c.red} />
        </Press>
      </View>
      {expanded ? <View style={{ marginTop: space.md }}>{children}</View> : null}
    </View>
  </Animated.View>;
}

// Panel de personalización por línea: notas, exclusiones, extras con costo y extra libre.
export function LineCustomizer({ item, exclusions = [], paid = [], custom = {}, onNote, onToggle, onCustomChange, onCustomAdd }) {
  const { c } = useTheme();
  const active = extra => (item.modificadores || []).some(m => m.nombre === extra.nombre);
  const priceOf = extra => Number(extra.precio_extra ?? extra.precio ?? 0);
  const input = { minHeight: TOUCH, borderWidth: 1.5, borderColor: c.line, borderRadius: radius.md, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 };
  return <View style={{ gap: space.md, padding: space.md, backgroundColor: c.soft, borderRadius: radius.md }}>
    <View><Label style={{ marginBottom: 6 }}>Nota para cocina</Label>
      <TextInput value={item.notas || ''} onChangeText={onNote} placeholder="Ej. sin cebolla, poco picante" placeholderTextColor={c.faint} multiline accessibilityLabel={`Notas para ${item.nombre}`} style={[input, { paddingVertical: 10 }]} /></View>
    {exclusions.length ? <View><Label style={{ marginBottom: 6 }}>Sin / opciones</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{exclusions.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre}{priceOf(x) ? ` +${money(priceOf(x))}` : ''}</Chip>)}</View></View> : null}
    {paid.length ? <View><Label style={{ marginBottom: 6 }}>Extras con costo</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{paid.map(x => <Chip key={x.nombre} selected={active(x)} onPress={() => onToggle(x)} accessibilityLabel={`Extra ${x.nombre}`}>{x.nombre} +{money(priceOf(x))}</Chip>)}</View></View> : null}
    <View><Label style={{ marginBottom: 6 }}>Otro extra</Label>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <TextInput value={custom.nombre || ''} onChangeText={nombre => onCustomChange({ nombre })} placeholder="Nombre" placeholderTextColor={c.faint} accessibilityLabel="Nombre del extra personalizado" style={[input, { flex: 1 }]} />
        <TextInput value={custom.precio || ''} onChangeText={precio => onCustomChange({ precio })} placeholder="0,00" placeholderTextColor={c.faint} keyboardType="decimal-pad" accessibilityLabel="Precio del extra personalizado" style={[input, { width: 84, textAlign: 'right', fontFamily: undefined }]} />
        <Button variant="ink" onPress={onCustomAdd} disabled={!String(custom.nombre || '').trim()} accessibilityLabel="Añadir extra personalizado">Añadir</Button>
      </View></View>
  </View>;
}

const ROUND_STAMP = {
  PENDIENTE: ['EN COLA', 'amber'], EN_PREPARACION: ['EN COCINA', 'amber'], PREPARANDO: ['EN COCINA', 'amber'],
  LISTO: ['LISTO', 'green'], ENTREGADO: ['ENTREGADO', 'muted'], CANCELADO: ['ANULADO', 'red'],
};
// Ronda anterior plegada: «Ronda 2 · 3 art. · $8,40» con sello de cocina; se despliega al tocar.
export function PastRound({ round, index, children, action }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(round.estado === 'LISTO');
  const [txt, tone] = ROUND_STAMP[round.estado] || [String(round.estado || '—'), 'muted'];
  const items = round.items || [];
  const count = items.reduce((n, it) => n + (Number(it.cantidad) || 0), 0);
  const sum = items.reduce((s, it) => s + (Number(it.subtotal) || (Number(it.precio) || 0) * (Number(it.cantidad) || 0)), 0);
  return <View style={{ borderBottomWidth: 1, borderColor: c.line }}>
    <Press accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Ronda ${index}, ${txt.toLowerCase()}`} onPress={() => setOpen(!open)} sink={0}
      style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
      <Num size={15} weight="700" color={c.muted}>R{index}</Num>
      <T size={15} style={{ flex: 1 }} numberOfLines={1}>{count} art.{round.estado_cobro === 'PAGADO' ? ' · pagada' : ''}</T>
      {sum ? <Num size={15} color={c.muted}>{money(sum)}</Num> : null}
      <Stamp color={tone === 'muted' ? c.muted : c[tone]} size={12}>{txt}</Stamp>
    </Press>
    {open ? <View style={{ paddingBottom: space.md, gap: 4 }}>
      {items.map((it, i) => <LeaderLine key={`${it.id || i}`} dim left={<T size={15} color={c.muted}><Num size={15} color={c.muted}>{it.cantidad}× </Num>{it.nombre}</T>} right={<Num size={15} color={c.muted}>{money((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}</Num>} />)}
      {children}
      {action}
    </View> : null}
  </View>;
}

// Fila de totales: «Ronda nueva» separada del total de la mesa.
export function TotalsBlock({ rows = [], grand, grandLabel }) {
  const { c } = useTheme();
  return <View style={{ marginTop: space.lg, gap: 6 }}>
    {rows.map(([l, v]) => <LeaderLine key={l} dim left={<T size={15} color={c.muted}>{l}</T>} right={<Num size={15} color={c.muted}>{money(v)}</Num>} />)}
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm, borderTopWidth: 2, borderColor: c.ink, marginTop: 4 }}>
      <Label color={c.text} size={14}>{grandLabel}</Label>
      <RollingNumber value={grand} format={money} size={26} weight="700" />
    </View>
  </View>;
}

// Barra fija «Enviar ronda (N) · $X». 56 px, achiote. Se arranca hacia arriba al enviar.
export function SendBar({ count, amount, onPress, sending, pending, offline, disabled, label }) {
  const { c } = useTheme();
  const text = label || (sending ? 'Enviando…' : pending ? (offline ? 'En cola · reintentar ahora' : 'Reintentar envío') : `Enviar ronda (${count})`);
  return <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: c.bg, borderTopWidth: 1, borderColor: c.line }}>
    <Press accessibilityRole="button" accessibilityLabel={`${text}, ${money(amount)}`} accessibilityState={{ disabled: !!(disabled || sending), busy: !!sending }}
      onPress={onPress} disabled={disabled || sending} hapticKind="medium"
      style={{ height: TOUCH_MAIN, borderRadius: radius.md, backgroundColor: pending ? c.ink : c.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.md, opacity: disabled ? 0.45 : 1 }}>
      {pending ? <RefreshCw size={20} color={c.onInk} /> : <Send size={20} color={c.onPrimary} />}
      <T size={17} weight="700" color={pending ? c.onInk : c.onPrimary} style={{ flex: 1 }} numberOfLines={1}>{text}</T>
      <Num size={17} weight="700" color={pending ? c.onInk : c.onPrimary}>{money(amount)}</Num>
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
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -24] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-1deg'] }) }] }]}>{children}</Animated.View>;
}

// Bandeja de rondas en cola (sin conexión). Se reenvían solas al volver la red.
export function OfflineQueue({ entries = [], retrying, onRetry, nextIn }) {
  const { c } = useTheme();
  if (!entries.length) return null;
  return <View accessibilityLiveRegion="polite" style={{ marginHorizontal: space.lg, marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.amber, backgroundColor: c.amberSoft, gap: space.sm }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <CloudOff size={18} color={c.amber} />
      <T size={15} weight="700" style={{ flex: 1 }}>{entries.length === 1 ? '1 ronda en cola' : `${entries.length} rondas en cola`}</T>
      <Button variant="outline" icon={RefreshCw} loading={retrying} onPress={onRetry}>Reintentar</Button>
    </View>
    <T size={14} color={c.muted}>Sin confirmar del servidor. Se enviarán solas al volver la conexión{nextIn ? ` (próximo intento en ${Math.ceil(nextIn / 1000)} s)` : ''}. No se duplican.</T>
    {entries.map(e => <LeaderLine key={e.key} dim left={<T size={15}>{e.label} · <Num size={15}>{e.items}</Num> art.</T>} right={<Num size={15}>{money(e.total)}</Num>} />)}
  </View>;
}

// Hoja de cambios de precio: muestra antes → ahora y permite aceptar y reenviar.
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
