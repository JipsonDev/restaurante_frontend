// Comanda: piezas de la hoja de pedido del mesero (encabezado, líneas, rondas, barra de envío, cola).
// Todo se apoya en el kit «Suave» (comanda.js); aquí no se definen colores propios.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, TextInput, View, useWindowDimensions } from 'react-native';
import { Check, CloudOff, RefreshCw, Send, PencilLine, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import {
  BottomSheet, Button, Chip, EASE, Label, LeaderLine, Num, Perforation, Press, RollingNumber, Stamp, SwipeRow, Tally, T,
  TOUCH, TOUCH_MAIN, elevate, haptic, money, radius, space,
} from './comanda';
import { ProductArt } from './ProductArt';

const ND = false; // height/opacidad no se pueden animar en el hilo nativo

// Encabezado: insignia redondeada con el número de mesa, título y estado.
export function ComandaHeader({ number, title, subtitle, meta, stamp, stampColor, children }) {
  const { c } = useTheme();
  const small = useWindowDimensions().width < 400;
  const box = small ? 56 : 68;
  return <View style={{ paddingBottom: small ? space.sm : space.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {number != null ? <View accessibilityLabel={`Mesa ${number}`} style={{ width: box, height: box, borderRadius: small ? radius.lg : radius.xl, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <T size={11} weight="700" color={c.primaryText} style={{ lineHeight: 13 }}>Mesa</T>
        <Num size={small ? 24 : 28} weight="800" color={c.primaryText} style={{ lineHeight: small ? 27 : 32 }}>{number}</Num>
      </View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={small ? 19 : 22} weight="800" numberOfLines={1}>{title}</T>
        <T size={14} color={c.muted} numberOfLines={2}>{[meta, subtitle].filter(Boolean).join(' · ')}</T>
        {stamp ? <Stamp color={stampColor} style={{ marginTop: 6 }}>{stamp}</Stamp> : null}
      </View>
    </View>
    {children}
  </View>;
}

// Sección con título.
export function SectionLabel({ children, right }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
    <T size={17} weight="800">{children}</T>{right}
  </View>;
}

// Línea de la ronda nueva. Al quitarla se encoge (alto + opacidad, 200 ms) y luego avisa a onRemove.
export function OrderLine({ item, total, detail, image, product, expanded, onToggle, onQty, onRemove, locked, children }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  const [h, setH] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const remove = () => {
    if (leaving) return;
    haptic('warning'); setLeaving(true);
    Animated.timing(v, { toValue: 0, duration: 220, easing: EASE, useNativeDriver: ND }).start(() => onRemove?.());
  };
  const style = leaving && h ? { height: v.interpolate({ inputRange: [0, 1], outputRange: [0, h] }), opacity: v, overflow: 'hidden' } : { opacity: v };
  return <Animated.View style={style}>
    <View onLayout={e => !leaving && setH(e.nativeEvent.layout.height)} style={{ paddingBottom: space.sm }}>
    <SwipeRow direction="left" onSwipe={remove} label="Quitar" icon={Trash2} disabled={locked || leaving}>
    <View style={[{ padding: space.lg, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.isDark ? c.line : 'rgba(16,24,40,0.04)', opacity: locked ? 0.6 : 1 }, elevate(c, 1)]} pointerEvents={locked ? 'none' : 'auto'}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
        <View style={{ width: 56 }}><ProductArt product={product || item} radius={14} iconScale={0.42} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <LeaderLine left={<T size={16} weight="700" numberOfLines={2}>{item.nombre}</T>}
            right={<RollingNumber value={total} format={money} size={16} weight="800" />} />
          {detail ? <T size={14} color={c.muted} numberOfLines={3} style={{ marginTop: 2 }}>{detail}</T> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' }}>
        <Tally value={Number(item.cantidad) || 1} min={1} onChange={n => onQty(n - (Number(item.cantidad) || 1))} label={`Cantidad de ${item.nombre}`} />
        <View style={{ flex: 1 }} />
        <Button variant={expanded ? 'ink' : 'outline'} size="sm" icon={PencilLine} onPress={onToggle} accessibilityLabel={`Notas y extras de ${item.nombre}`}>{expanded ? 'Listo' : 'Notas'}</Button>
        <Press accessibilityRole="button" accessibilityLabel={`Quitar ${item.nombre}`} onPress={remove} hapticKind={null}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.surfaceAlt }}>
          <Trash2 size={18} color={c.muted} />
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
  const active = extra => (item.modificadores || []).some(m => m.nombre === extra.nombre);
  const priceOf = extra => Number(extra.precio_extra ?? extra.precio ?? 0);
  const input = { minHeight: TOUCH, borderWidth: 0, borderRadius: radius.md, backgroundColor: c.surface, color: c.text, paddingHorizontal: space.md, fontSize: 16 };
  return <View style={{ gap: space.md, padding: space.md, backgroundColor: c.surfaceAlt, borderRadius: radius.lg }}>
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
  const [open, setOpen] = useState(true); // los platos se ven sin tocar nada
  const [txt, tone] = ROUND_STAMP[round.estado] || [String(round.estado || '—'), 'muted'];
  const items = round.items || [];
  const count = items.reduce((n, it) => n + (Number(it.cantidad) || 0), 0);
  const sum = items.reduce((s, it) => s + (Number(it.subtotal) || (Number(it.precio) || 0) * (Number(it.cantidad) || 0)), 0);
  return <View style={{ borderRadius: radius.lg, backgroundColor: c.surfaceAlt, paddingHorizontal: space.md, marginBottom: space.sm }}>
    <Press accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Ronda ${index}, ${txt.toLowerCase()}`} onPress={() => setOpen(!open)}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
      <T size={16} weight="800" style={{ flex: 1 }} numberOfLines={1}>Ronda {index}{round.estado_cobro === 'PAGADO' ? ' · pagada' : ''}</T>
      {sum ? <Num size={15} color={c.muted}>{money(sum)}</Num> : null}
      <Stamp color={tone === 'muted' ? c.muted : c[tone]} size={12}>{txt}</Stamp>
    </Press>
    {open ? <View style={{ paddingBottom: space.md, gap: 4 }}>
      {items.map((it, i) => <View key={`${it.id || i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 }}>
        <View style={{ width: 40 }}><ProductArt product={it} radius={10} iconScale={0.46} /></View>
        <T size={15} style={{ flex: 1 }} numberOfLines={2}><Num size={15} weight="800">{it.cantidad}× </Num>{it.nombre}</T>
        {it.listo_at && round.estado !== 'LISTO' && round.estado !== 'ENTREGADO' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Check size={14} color={c.green} strokeWidth={3} /><T size={13} weight="800" color={c.green}>listo</T></View> : null}
        <Num size={15} color={c.muted}>{money((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}</Num>
      </View>)}
      {children}
      {action}
    </View> : null}
  </View>;
}

// Fila de totales: «Ronda nueva» separada del total de la mesa.
export function TotalsBlock({ rows = [], grand, grandLabel }) {
  const { c } = useTheme();
  return <View style={{ marginTop: space.lg, gap: 8, padding: space.lg, borderRadius: radius.xl, backgroundColor: c.surfaceAlt }}>
    {rows.map(([l, v]) => <LeaderLine key={l} left={<T size={15} color={c.muted}>{l}</T>} right={<Num size={15} weight="600" color={c.muted}>{money(v)}</Num>} />)}
    <View style={{ height: 1, backgroundColor: c.line, marginVertical: 2 }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T size={16} weight="800">{grandLabel}</T>
      <RollingNumber value={grand} format={money} size={28} weight="800" />
    </View>
  </View>;
}

// Barra fija «Enviar ronda (N) · $X». 56 px, achiote. Se arranca hacia arriba al enviar.
export function SendBar({ count, amount, onPress, sending, pending, offline, disabled, label }) {
  const { c } = useTheme();
  const text = label || (sending ? 'Enviando…' : pending ? (offline ? 'En cola · reintentar ahora' : 'Reintentar envío') : `Enviar ronda (${count})`);
  return <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 2, backgroundColor: 'transparent' }}>
    <Press accessibilityRole="button" accessibilityLabel={`${text}, ${money(amount)}`} accessibilityState={{ disabled: !!(disabled || sending), busy: !!sending }}
      onPress={onPress} disabled={disabled || sending} hapticKind="medium"
      style={[{ height: 54, borderRadius: radius.pill, backgroundColor: pending ? c.ink : c.primary, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: space.xl, gap: space.md, opacity: disabled ? 0.45 : 1, maxWidth: 760, width: '100%', alignSelf: 'center' },
        typeof document !== 'undefined' && !c.isDark && !pending ? { boxShadow: `0 10px 24px ${c.primary}55` } : elevate(c, 2)]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
        {pending ? <RefreshCw size={20} color={c.onInk} /> : <Send size={20} color={c.onPrimary} />}
      </View>
      <T size={17} weight="800" color={pending ? c.onInk : c.onPrimary} style={{ flex: 1 }} numberOfLines={1}>{text}</T>
      <Num size={18} weight="800" color={pending ? c.onInk : c.onPrimary}>{money(amount)}</Num>
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

// Bandeja de rondas en cola (sin conexión). Se reenvían solas al volver la red.
export function OfflineQueue({ entries = [], retrying, onRetry, nextIn }) {
  const { c } = useTheme();
  if (!entries.length) return null;
  return <View accessibilityLiveRegion="polite" style={{ marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: c.amberSoft, gap: space.sm }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <CloudOff size={18} color={c.amber} />
      <T size={15} weight="700" style={{ flex: 1 }}>{entries.length === 1 ? '1 ronda en cola' : `${entries.length} rondas en cola`}</T>
      <Button variant="ink" size="sm" icon={RefreshCw} loading={retrying} onPress={onRetry}>Reintentar</Button>
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
