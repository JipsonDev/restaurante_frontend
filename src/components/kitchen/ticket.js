// Ticket de cocina (KDS), marca blanca y compacto: bloque gris sin bordes, destino y tiempo arriba,
// platos que se tachan con un toque y un botón para el siguiente paso. El color aparece solo cuando
// pide acción: tiempo en ámbar (cerca del límite) o rojo (pasado), alergias en rojo. Se desliza a la derecha para avanzar.
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { AlertTriangle, BellRing, Check, ChefHat, Clock3, Printer, RotateCcw, ShoppingBag, StickyNote, Truck, Undo2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button, EASE, IconButton, Num, Press, SwipeRow, T, radius, reducedMotion, space } from '../waiter/kit';
import { isCriticalNote, stageMinutes, ticketUrgency, waitMinutes } from '../../utils/kitchenLogic.mjs';
// En cocina siempre en minutos: «0 min», «12 min», «1 h 05».
const mins = m => { const v = Math.max(0, Math.floor(Number(m) || 0)); return v < 60 ? `${v} min` : `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')}`; };

const ND = Platform.OS !== 'web';
const isPickup = r => !r?.mesa_id || ['Para llevar', 'Delivery'].includes(r?.tipo);
export const ticketTarget = r => isPickup(r)
  ? `${r?.tipo === 'Delivery' ? 'Delivery' : 'Llevar'}${r?.cliente_nombre ? ` · ${r.cliente_nombre}` : ` #${r?.pedido_id}`}`
  : `Mesa ${r?.mesa_numero || r?.mesa_id || '—'}`;

// Platos listos: vienen del servidor (listo_at), así se ven igual en todas las tablets.
export const itemDone = (item, optimistic = {}) => optimistic[item.id] !== undefined ? optimistic[item.id] : !!item.listo_at;

// Tiempo: texto gris en lo normal, ámbar cerca del límite y etiqueta roja sólida cuando se pasó (sin halos ni parpadeos).
function Timer({ minutes, urgency, label }) {
  const { c } = useTheme();
  const a11y = `${label || 'Tiempo'}: ${mins(minutes)}${urgency === 'late' ? ', con demora' : ''}`;
  if (urgency === 'late') return <View accessibilityLabel={a11y} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: c.redFill }}>
    <Clock3 size={15} color={c.onRed} strokeWidth={2.4} /><Num size={17} weight="800" color={c.onRed}>{mins(minutes)}</Num>
  </View>;
  const tone = urgency === 'warn' ? c.amber : c.muted;
  return <View accessibilityLabel={a11y} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 }}>
    <Clock3 size={15} color={tone} strokeWidth={2.4} /><Num size={17} weight={urgency === 'warn' ? '800' : '600'} color={tone}>{mins(minutes)}</Num>
  </View>;
}

function ItemLine({ item, done, onToggle, onLongPress, disabled }) {
  const { c } = useTheme();
  // Al tachar: solo el check aparece (120 ms, opacidad + escala mínima). Nunca se anima la fila ni el tachado.
  const v = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => { Animated.timing(v, { toValue: done ? 1 : 0, duration: reducedMotion() ? 0 : 120, easing: EASE, useNativeDriver: ND }).start(); }, [done]);
  const critical = isCriticalNote(item.notas);
  const mods = item.modificadores || [];
  return <Press accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${item.cantidad} ${item.nombre}${item.notas ? `, nota: ${item.notas}` : ''}`}
    onPress={onToggle} onLongPress={onLongPress} disabled={disabled} hapticKind="select" scaleTo={0.985}
    accessibilityHint="Toca para marcar el plato como listo; mantén presionado para marcar el producto como agotado"
    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 44, paddingVertical: 6 }}>
    <View style={{ minWidth: 32, height: 32, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: done ? c.greenFill : c.bg, alignItems: 'center', justifyContent: 'center' }}>
      {done ? <Animated.View style={{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}><Check size={18} color={c.onGreen} strokeWidth={3} /></Animated.View> : <Num size={17} weight="800">{item.cantidad}</Num>}
    </View>
    <View style={{ flex: 1, minWidth: 0, paddingTop: 4, gap: 2 }}>
      <T size={17} weight="600" color={done ? c.muted : c.text} style={done ? { textDecorationLine: 'line-through' } : null}>
        {done ? `${item.cantidad}× ` : ''}{item.nombre}
      </T>
      {mods.length ? <T size={14} color={c.muted}>{mods.map(m => `${m.tipo === 'EXCLUSION' ? 'Sin ' : m.tipo === 'EXTRA' ? '+ ' : ''}${m.nombre}`).join(' · ')}</T> : null}
      {item.notas ? critical
        ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: c.redFill }}>
          <AlertTriangle size={14} color={c.onRed} /><T size={14} weight="700" color={c.onRed}>{item.notas}</T>
        </View>
        : <T size={14} weight="700" color={c.amber}>{item.notas}</T> : null}
    </View>
  </Press>;
}

// action: { label, icon, variant, onPress } · secondary: [{ icon, label, onPress, text? }]
export const KitchenTicket = memo(function KitchenTicket({ round, items: itemsProp, now, limit = 20, listoLimit = 5, action, secondary = [], swipe, busy, isNew, animateIn, extraRound, optimistic = {}, onToggleItem, onLongPressItem, station }) {
  const { c } = useTheme();
  const state = String(round.estado || '').toUpperCase();
  const items = (itemsProp || round.items || []).filter(i => Number(i.cantidad || 0) > 0);
  const ready = state === 'LISTO' || (items.length > 0 && items.every(it => itemDone(it, optimistic)));
  const minutes = ready ? stageMinutes(round, now) : waitMinutes(round, now);
  const urgency = ready ? ticketUrgency(minutes, listoLimit) : ticketUrgency(minutes, limit);
  const doneCount = items.filter(it => itemDone(it, optimistic)).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const pickup = isPickup(round);
  const Target = pickup ? (round.tipo === 'Delivery' ? Truck : ShoppingBag) : null;
  // Llegada: aparece con opacidad y una escala mínima (sin rebote). Ocasional: una vez por ronda.
  // Solo la primera vez que aparece (no al cambiar de columna ni de vista).
  const enter = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  useEffect(() => { if (animateIn) Animated.timing(enter, { toValue: 1, duration: reducedMotion() ? 160 : 220, easing: EASE, useNativeDriver: ND }).start(); }, []);
  const firstName = String(round.mesero_nombre || '').split(' ')[0];
  const meta = [
    `#${round.ronda_id || round.id}`,
    pickup ? round.cliente_dato : (firstName && !/^admin/i.test(firstName) ? firstName : null),
    extraRound ? '2ª ronda' : null,
    doneCount > 0 && !allDone ? `${doneCount} de ${items.length} listos` : null,
    station,
  ].filter(Boolean).join(' · ');
  const card = <View style={{ backgroundColor: c.surfaceAlt, borderRadius: radius.lg, overflow: 'hidden' }}>
    {/* Cabecera: destino + tiempo */}
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.md }}>
      {Target ? <View style={{ paddingTop: 3 }}><Target size={18} color={c.text} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T size={20} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{ticketTarget(round)}</T>
          {isNew ? <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: c.primary }}><T size={12} weight="700" color={c.onPrimary}>Nueva</T></View> : null}
        </View>
        {meta ? <T size={13} color={c.muted} numberOfLines={1}>{meta}</T> : null}
      </View>
      <Timer minutes={minutes} urgency={urgency} label={ready ? 'Lista hace' : 'En cocina'} />
    </View>
    {/* Platos */}
    <View style={{ paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm }}>
      {state === 'LISTO'
        // Lista: todo está hecho; un resumen en una línea (las alergias siguen aparte, en rojo).
        ? <View style={{ gap: 4, paddingVertical: 4 }}>
          <T size={15} color={c.muted} numberOfLines={3}>{items.map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}</T>
          {items.filter(i => isCriticalNote(i.notas)).map(i => <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><AlertTriangle size={14} color={c.red} /><T size={14} weight="700" color={c.red}>{i.nombre}: {i.notas}</T></View>)}
        </View>
        : items.map((it, i) => <ItemLine key={it.id ?? i} item={it} done={itemDone(it, optimistic)} disabled={busy || !onToggleItem}
          onToggle={() => onToggleItem?.(round, it)} onLongPress={onLongPressItem ? () => onLongPressItem(it) : undefined} />)}
      {round.notas ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, alignItems: 'flex-start' }}>
        {isCriticalNote(round.notas) ? <AlertTriangle size={15} color={c.red} /> : <StickyNote size={15} color={c.amber} />}
        <T size={14} weight="700" color={isCriticalNote(round.notas) ? c.red : c.amber} style={{ flex: 1 }}>{round.notas}</T>
      </View> : null}
    </View>
    {/* Acciones */}
    {action || secondary.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md }}>
      {secondary.map(s => s.text
        ? <Button key={s.label} variant="outline" icon={s.icon} onPress={s.onPress} disabled={busy} accessibilityLabel={s.label} style={{ backgroundColor: c.bg }}>{s.text}</Button>
        : <View key={s.label} style={{ borderRadius: radius.md, backgroundColor: c.bg }}><IconButton icon={s.icon} label={s.label} onPress={s.onPress} size={48} disabled={busy} /></View>)}
      {action ? <Button variant={action.variant || 'primary'} icon={action.icon} onPress={action.onPress} disabled={busy} style={[{ flex: 1 }, action.style]}
        hapticKind={action.haptic || 'tap'} accessibilityLabel={`${action.label}: ${ticketTarget(round)}`}>{allDone && action.allDoneLabel ? action.allDoneLabel : action.label}</Button> : null}
    </View> : null}
  </View>;
  const animated = <Animated.View style={{ opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>{card}</Animated.View>;
  if (!swipe) return animated;
  return <SwipeRow direction="right" label={swipe.label} icon={swipe.icon} color={swipe.color} onSwipe={swipe.onSwipe} disabled={busy} radius={radius.lg}>{animated}</SwipeRow>;
});

export const KitchenIcons = { BellRing, Check, ChefHat, Printer, RotateCcw, Undo2 };
