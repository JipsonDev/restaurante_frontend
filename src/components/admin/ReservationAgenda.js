// Agenda del día por hora: una fila por mesa y las reservas como bloques sobre la línea del tiempo.
// Tocar un bloque abre la reserva; tocar un hueco crea una en esa mesa y a esa hora.
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { BLOCKING_STATES, HOLD_BEFORE_MIN, agendaRange, dayOf, interval, isLate, timeOf, toMinutes } from '../../utils/reservationLogic.mjs';
import { radius, space, toneColors, type } from './ui';

const TONE = { PENDIENTE: 'warning', CONFIRMADA: 'info', LLEGO: 'success', NO_VINO: 'critical', CANCELADA: 'neutral' };
const ROW = 52, HEAD = 32;
const pad = n => String(n).padStart(2, '0');

export default function ReservationAgenda({ day, now, reservations = [], tables = [], phone, onOpen, onCreate, selectedId }) {
  const { c } = useTheme();
  const scroller = useRef(null);
  const HOUR = phone ? 76 : 104, LABEL = phone ? 76 : 108;
  const ofDay = useMemo(() => reservations.filter(r => dayOf(r.fecha_hora) === day && r.estado !== 'CANCELADA'), [reservations, day]);
  const { from, to } = useMemo(() => agendaRange(ofDay, day), [ofDay, day]);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const dayStart = toMinutes(`${day} ${pad(from)}:00`);
  const x = minutes => (minutes - dayStart) / 60 * HOUR;
  const unassigned = ofDay.filter(r => r.mesa_id == null);
  const rows = [
    ...(unassigned.length ? [{ key: 'none', label: 'Sin mesa', sub: `${unassigned.length} por asignar`, items: unassigned, table: null }] : []),
    ...[...tables].sort((a, b) => Number(a.numero) - Number(b.numero)).map(t => ({ key: `t${t.id}`, label: `Mesa ${t.numero}`, sub: `${t.capacidad} ${Number(t.capacidad) === 1 ? 'puesto' : 'puestos'}`, items: ofDay.filter(r => Number(r.mesa_id) === Number(t.id)), table: t })),
  ];
  const isToday = dayOf(now) === day;
  const nowX = isToday ? x(toMinutes(now)) : null;
  const width = hours.length * HOUR;

  // Al abrir hoy, la agenda se coloca en la hora actual.
  useEffect(() => {
    if (nowX == null || !scroller.current) return;
    const target = Math.max(0, nowX - HOUR * 1.2);
    const t = setTimeout(() => scroller.current?.scrollTo?.({ x: target, animated: false }), 50);
    return () => clearTimeout(t);
  }, [day, isToday]);

  const createAt = (row, event) => {
    if (!onCreate) return;
    const offset = event?.nativeEvent?.locationX ?? event?.nativeEvent?.offsetX ?? 0;
    const minutes = Math.max(0, Math.min((to - from) * 60 - 30, Math.round(offset / HOUR * 2) * 30));
    onCreate({ mesa_id: row.table?.id ?? null, time: `${pad(from + Math.floor(minutes / 60))}:${pad(minutes % 60)}` });
  };

  return <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, backgroundColor: c.surface, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row' }}>
      {/* Columna fija con las mesas */}
      <View style={{ width: LABEL, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.surface, zIndex: 2 }}>
        <View style={{ height: HEAD, borderBottomWidth: 1, borderBottomColor: c.line }} />
        {rows.map(row => <View key={row.key} style={{ height: ROW, justifyContent: 'center', paddingHorizontal: phone ? space.sm : space.md, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Text numberOfLines={1} style={[type.body, type.num, { color: row.table ? c.text : c.amber, fontWeight: '600' }]}>{row.label}</Text>
          {!phone ? <Text numberOfLines={1} style={[type.small, { color: c.muted }]}>{row.sub}</Text> : null}
        </View>)}
      </View>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} style={{ flex: 1 }}>
        <View style={{ width }}>
          {/* Cabecera de horas */}
          <View style={{ height: HEAD, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line }}>
            {hours.map(h => <View key={h} style={{ width: HOUR, justifyContent: 'center', paddingLeft: 6, borderLeftWidth: h === from ? 0 : 1, borderLeftColor: c.line }}>
              <Text style={[type.small, type.num, { color: c.muted, fontWeight: '600' }]}>{pad(h)}:00</Text>
            </View>)}
          </View>
          {rows.map(row => <Pressable key={row.key} accessibilityLabel={`Crear reserva en ${row.label}`} onPress={e => createAt(row, e)}
            style={({ hovered }) => ({ height: ROW, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: hovered ? c.softer : 'transparent', cursor: 'cell' })}>
            {hours.map(h => h === from ? null : <View key={h} pointerEvents="none" style={{ position: 'absolute', left: (h - from) * HOUR, top: 0, bottom: 0, width: 1, backgroundColor: c.line, opacity: 0.6 }} />)}
            {row.items.map(r => {
              const span = interval(r); if (!span) return null;
              const [bg, fg, solid] = toneColors(c, isLate(r, now) ? 'critical' : TONE[r.estado]);
              const left = x(span.start), w = Math.max(44, (span.end - span.start) / 60 * HOUR - 3);
              const waiting = ['PENDIENTE', 'CONFIRMADA'].includes(r.estado);
              return <React.Fragment key={r.id}>
                {/* Tiempo en que la mesa queda apartada antes de la hora */}
                {waiting && row.table ? <View pointerEvents="none" style={{ position: 'absolute', left: left - HOLD_BEFORE_MIN / 60 * HOUR, width: HOLD_BEFORE_MIN / 60 * HOUR, top: 10, bottom: 10, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, backgroundColor: bg, opacity: 0.55, borderWidth: 1, borderRightWidth: 0, borderStyle: 'dashed', borderColor: solid }} /> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Reserva de ${r.cliente_nombre}, ${timeOf(r.fecha_hora)}, ${r.personas} personas`} onPress={e => { e.stopPropagation?.(); onOpen(r); }}
                  style={({ hovered }) => ({ position: 'absolute', left, width: w, top: 6, bottom: 6, borderRadius: 8, paddingHorizontal: 8, justifyContent: 'center', backgroundColor: bg,
                    borderLeftWidth: 3, borderLeftColor: solid, opacity: BLOCKING_STATES.includes(r.estado) ? 1 : 0.6, cursor: 'pointer',
                    ...(Number(selectedId) === Number(r.id) || hovered ? { borderWidth: 1, borderColor: solid, borderLeftWidth: 3 } : null) })}>
                  <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{r.cliente_nombre}</Text>
                  <Text numberOfLines={1} style={[type.small, type.num, { color: fg }]}>{timeOf(r.fecha_hora)} · {r.personas} p.{r.estado === 'LLEGO' ? ' · llegó' : r.estado === 'NO_VINO' ? ' · no vino' : r.estado === 'PENDIENTE' ? ' · por confirmar' : ''}</Text>
                </Pressable>
              </React.Fragment>;
            })}
          </Pressable>)}
          {nowX != null && nowX >= 0 && nowX <= width ? <View pointerEvents="none" style={{ position: 'absolute', left: nowX - 1, top: HEAD - 6, bottom: 0, width: 2, backgroundColor: c.red }}>
            <View style={{ position: 'absolute', top: 0, left: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: c.red }} />
          </View> : null}
        </View>
      </ScrollView>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.line }}>
      {[['info', 'Confirmada'], ['warning', 'Por confirmar'], ['success', 'Llegó'], ['critical', 'Retrasada o no vino']].map(([tone, label]) => {
        const [bg, , solid] = toneColors(c, tone);
        return <View key={tone} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: bg, borderLeftWidth: 3, borderLeftColor: solid }} />
          <Text style={[type.small, { color: c.muted }]}>{label}</Text>
        </View>;
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 16, height: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.muted, borderRadius: 3 }} />
        <Text style={[type.small, { color: c.muted }]}>Mesa apartada {HOLD_BEFORE_MIN} min antes</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[type.small, { color: c.muted }]}>Toca un hueco para reservar esa mesa a esa hora.</Text>
    </View>
  </View>;
}
