// Ticket de cocina (KDS) en el kit «Suave»: tarjeta redondeada con destino grande, temporizador
// por semáforo (según el límite configurado), platos que se tachan con un toque, notas resaltadas
// (alergias en rojo) y un botón grande para el siguiente paso. Se desliza a la derecha para avanzar.
import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform, View } from 'react-native';
import { AlertTriangle, BellRing, Check, ChefHat, Clock3, Flame, Printer, RotateCcw, ShoppingBag, StickyNote, Truck, Undo2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { Button, IconButton, Num, Press, SwipeRow, T, elevate, haptic, radius, space } from '../waiter/comanda';
import { isCriticalNote, stageMinutes, ticketUrgency, waitMinutes } from '../../utils/kitchenLogic.mjs';
// En cocina siempre en minutos: «0 min», «12 min», «1 h 05».
const mins = m => { const v = Math.max(0, Math.floor(Number(m) || 0)); return v < 60 ? `${v} min` : `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')}`; };

const WEB = Platform.OS === 'web';
const isPickup = r => !r?.mesa_id || ['Para llevar', 'Delivery'].includes(r?.tipo);
export const ticketTarget = r => isPickup(r)
  ? `${r?.tipo === 'Delivery' ? 'Delivery' : 'Llevar'}${r?.cliente_nombre ? ` · ${r.cliente_nombre}` : ` #${r?.pedido_id}`}`
  : `Mesa ${r?.mesa_numero || r?.mesa_id || '—'}`;

// Platos tachados: se guardan en este equipo por ronda (sobreviven a recargas).
const doneKey = id => `mm-kds-done-${id}`;
function useDoneItems(roundId) {
  const [done, setDone] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(doneKey(roundId)) || '[]')); } catch { return new Set(); } });
  const toggle = itemKey => setDone(prev => {
    const next = new Set(prev);
    if (next.has(itemKey)) next.delete(itemKey); else next.add(itemKey);
    try { if (next.size) localStorage.setItem(doneKey(roundId), JSON.stringify([...next])); else localStorage.removeItem(doneKey(roundId)); } catch {}
    return next;
  });
  return [done, toggle];
}
export function clearDoneItems(roundId) { try { localStorage.removeItem(doneKey(roundId)); } catch {} }

// Píldora del temporizador. En «tarde» late suavemente un halo (no parpadea toda la tarjeta).
function TimerPill({ minutes, urgency, label }) {
  const { c } = useTheme();
  const tone = urgency === 'late' ? c.primary : urgency === 'warn' ? c.amber : c.green;
  const soft = urgency === 'late' ? c.primary : urgency === 'warn' ? c.amberSoft : c.greenSoft;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (urgency !== 'late') { v.stopAnimation(); v.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, useNativeDriver: !WEB }));
    loop.start(); return () => loop.stop();
  }, [urgency]);
  return <View accessibilityLabel={`${label || 'Tiempo'}: ${mins(minutes)}${urgency === 'late' ? ', con demora' : ''}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
    {urgency === 'late' ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.pill, backgroundColor: tone,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }} /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: radius.pill, backgroundColor: soft }}>
      {urgency === 'late' ? <Flame size={18} color="#FFFFFF" /> : <Clock3 size={17} color={tone} />}
      <Num size={19} weight="800" color={urgency === 'late' ? '#FFFFFF' : tone}>{mins(minutes)}</Num>
    </View>
  </View>;
}

function ItemLine({ item, done, onToggle, big }) {
  const { c } = useTheme();
  const critical = isCriticalNote(item.notas);
  const mods = item.modificadores || [];
  return <Press accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`${item.cantidad} ${item.nombre}${item.notas ? `, nota: ${item.notas}` : ''}`}
    onPress={onToggle} hapticKind="select" scaleTo={0.98}
    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: radius.md, opacity: done ? 0.75 : 1 }}
    hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ minWidth: big ? 46 : 40, height: big ? 46 : 40, paddingHorizontal: 6, borderRadius: 14, backgroundColor: done ? c.greenSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Num size={big ? 24 : 21} weight="800" color={done ? c.green : c.text} style={done ? { textDecorationLine: 'line-through' } : null}>{item.cantidad}</Num>
      {done ? <View style={{ position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: c.greenDot, alignItems: 'center', justifyContent: 'center' }}><Check size={13} color="#FFFFFF" strokeWidth={3.5} /></View> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0, paddingTop: big ? 7 : 6, gap: 3 }}>
      <T size={big ? 22 : 19} weight="800" color={done ? c.muted : c.text} style={done ? { textDecorationLine: 'line-through' } : null}>{item.nombre}</T>
      {mods.length ? <T size={big ? 16 : 15} weight="600" color={c.muted}>{mods.map(m => `${m.tipo === 'EXCLUSION' ? 'Sin ' : m.tipo === 'EXTRA' ? '+ ' : ''}${m.nombre}`).join(' · ')}</T> : null}
      {item.notas ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: critical ? c.red : c.amberSoft }}>
        {critical ? <AlertTriangle size={14} color="#FFFFFF" /> : null}
        <T size={big ? 16 : 15} weight="800" color={critical ? '#FFFFFF' : c.amber}>{item.notas}</T>
      </View> : null}
    </View>
  </Press>;
}

// action: { label, icon, variant, onPress } · secondary: [{ icon, label, onPress }]
export const KitchenTicket = memo(function KitchenTicket({ round, now, limit = 20, listoLimit = 5, action, secondary = [], swipe, busy, isNew, extraRound, compact }) {
  const { c } = useTheme();
  const [done, toggle] = useDoneItems(round.id);
  const state = String(round.estado || '').toUpperCase();
  const ready = state === 'LISTO';
  const items = (round.items || []).filter(i => Number(i.cantidad || 0) > 0);
  const minutes = ready ? stageMinutes(round, now) : waitMinutes(round, now);
  const urgency = ready ? ticketUrgency(minutes, listoLimit) : ticketUrgency(minutes, limit);
  const allDone = items.length > 0 && items.every((it, i) => done.has(`${it.id ?? i}`));
  const pickup = isPickup(round);
  const Target = pickup ? (round.tipo === 'Delivery' ? Truck : ShoppingBag) : null;
  // Llegada: aparece con un pequeño rebote y un halo rojo de marca.
  const enter = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  useEffect(() => { if (isNew) Animated.spring(enter, { toValue: 1, speed: 12, bounciness: 10, useNativeDriver: !WEB }).start(); }, [isNew]);
  const strip = urgency === 'late' ? c.primary : urgency === 'warn' ? c.amber : c.greenDot;
  const firstName = String(round.mesero_nombre || '').split(' ')[0];
  const meta = [`#${round.ronda_id || round.id}`, pickup ? round.cliente_dato : (firstName && !/^admin/i.test(firstName) ? firstName : null)].filter(Boolean).join(' · ');
  const card = <View style={[{ backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 2,
      borderColor: urgency === 'late' ? c.primary : isNew ? c.primary : (c.isDark ? c.line : 'rgba(16,24,40,0.05)'), overflow: 'hidden' }, elevate(c, 1)]}>
    {/* Franja de semáforo a la izquierda: se lee de lejos */}
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, backgroundColor: strip }} />
    {/* Cabecera: destino grande + temporizador */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.lg + 4, paddingRight: space.md, paddingTop: space.md, paddingBottom: space.sm }}>
      {Target ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: round.tipo === 'Delivery' ? c.skySoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Target size={18} color={round.tipo === 'Delivery' ? c.sky : c.primaryText} />
      </View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={compact ? 24 : 30} weight="800" numberOfLines={1} style={{ lineHeight: compact ? 30 : 36 }}>{ticketTarget(round)}</T>
        {meta ? <T size={13} weight="600" color={c.muted} numberOfLines={1}>{meta}</T> : null}
      </View>
      <TimerPill minutes={minutes} urgency={urgency} label={ready ? 'Lista hace' : 'En cocina'} />
    </View>
    {extraRound || isNew ? <View style={{ flexDirection: 'row', gap: 6, paddingLeft: space.lg + 4, marginBottom: 4 }}>
      {isNew ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: c.primary }}><T size={11} weight="800" color={c.onPrimary}>Nueva</T></View> : null}
      {extraRound ? <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: c.purpleSoft }}><T size={11} weight="800" color={c.purple}>Ronda adicional</T></View> : null}
    </View> : null}
    {/* Platos */}
    <View style={{ paddingLeft: space.lg + 4, paddingRight: space.lg, paddingBottom: space.sm }}>
      {items.map((it, i) => <ItemLine key={it.id ?? i} item={it} big={!compact} done={done.has(`${it.id ?? i}`)} onToggle={() => toggle(`${it.id ?? i}`)} />)}
      {round.notas ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, padding: 10, borderRadius: radius.md, backgroundColor: isCriticalNote(round.notas) ? c.redSoft : c.amberSoft }}>
        <StickyNote size={16} color={isCriticalNote(round.notas) ? c.red : c.amber} />
        <T size={14} weight="700" color={isCriticalNote(round.notas) ? c.red : c.text} style={{ flex: 1 }}>{round.notas}</T>
      </View> : null}
    </View>
    {/* Acciones */}
    {action || secondary.length ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingLeft: space.md + 4, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.line }}>
      {secondary.map(s => s.text
        ? <Button key={s.label} variant="outline" size="lg" icon={s.icon} onPress={s.onPress} disabled={busy} accessibilityLabel={s.label}>{s.text}</Button>
        : <IconButton key={s.label} icon={s.icon} label={s.label} onPress={s.onPress} filled size={52} disabled={busy} />)}
      {action ? <Button variant={action.variant || 'primary'} size="lg" icon={action.icon} onPress={action.onPress} loading={busy} style={{ flex: 1 }}
        hapticKind={action.haptic || 'medium'} accessibilityLabel={`${action.label}: ${ticketTarget(round)}`}>{allDone && action.allDoneLabel ? action.allDoneLabel : action.label}</Button> : null}
    </View> : null}
  </View>;
  const animated = <Animated.View style={{ opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>{card}</Animated.View>;
  if (!swipe) return animated;
  return <SwipeRow direction="right" label={swipe.label} icon={swipe.icon} color={swipe.color} onSwipe={swipe.onSwipe} disabled={busy} radius={radius.xl}>{animated}</SwipeRow>;
});

export const KitchenIcons = { BellRing, Check, ChefHat, Printer, RotateCcw, Undo2 };
