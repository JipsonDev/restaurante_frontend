import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { CalendarClock, ChevronLeft, ChevronRight, Minus, Phone, Plus, UsersRound } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Button, EmptyState, FadeIn, IconButton, PageHeader, Press, Segmented, Skeleton, Status, space, type, radius, useToast } from '../components/admin/ui';
import {
  BLOCKING_STATES, DEFAULT_DURATION, RESERVATION_LABELS, addDays, dayOf, findConflict, interval, isLate, localStamp,
  minutesUntil, reservationPayload, suggestTables, timeOf, fromMinutes,
} from '../utils/reservationLogic.mjs';

const TONE = { PENDIENTE: 'amber', CONFIRMADA: 'sky', LLEGO: 'green', NO_VINO: 'red', CANCELADA: 'neutral' };
const DURATIONS = [60, 90, 120, 150];
const QUICK_TIMES = ['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
const errorText = e => e?.response?.data?.message || e?.message || 'No se pudo guardar la reserva.';
const dateOf = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d); };
function dayName(day, today) {
  if (day === today) return 'Hoy';
  if (day === addDays(today, 1)) return 'Mañana';
  if (day === addDays(today, -1)) return 'Ayer';
  const s = dateOf(day).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const longDay = day => { const s = dateOf(day).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const endTime = r => { const span = interval(r); return span ? timeOf(fromMinutes(span.end)) : ''; };
const blank = day => ({ cliente_nombre: '', telefono: '', personas: 2, day, time: '19:00', duracion_min: DEFAULT_DURATION, mesa_id: null, notas: '' });

export default function ReservationsScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 700, wide = width >= 1180;
  const { reservas, mesas, loading, fetchReservas, createReserva, updateReserva, setReservaEstado } = useAdmin();
  const toast = useToast();
  const [now, setNow] = useState(localStamp());
  useEffect(() => { const t = setInterval(() => setNow(localStamp()), 30000); return () => clearInterval(t); }, []);
  const today = dayOf(now);
  const [day, setDay] = useState(today);
  const [weekStart, setWeekStart] = useState(addDays(today, -1));
  const [filter, setFilter] = useState('active');
  const [dialog, setDialog] = useState(null); // { reserva? }
  const [form, setForm] = useState(blank(today));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');

  // Pide los días que se ven si están fuera de lo que el panel ya tiene.
  useEffect(() => { fetchReservas({ desde: weekStart, hasta: addDays(weekStart, 13) }); }, [weekStart]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const countFor = d => reservas.filter(r => dayOf(r.fecha_hora) === d && BLOCKING_STATES.includes(r.estado)).length;
  const ofDay = useMemo(() => reservas.filter(r => dayOf(r.fecha_hora) === day), [reservas, day]);
  const shown = useMemo(() => ofDay.filter(r => filter === 'all' || (filter === 'active' ? BLOCKING_STATES.includes(r.estado) : !BLOCKING_STATES.includes(r.estado))), [ofDay, filter]);
  const active = ofDay.filter(r => BLOCKING_STATES.includes(r.estado));
  const people = active.reduce((s, r) => s + Number(r.personas || 0), 0);
  const unassigned = active.filter(r => r.mesa_id == null).length;
  const upcoming = useMemo(() => reservas.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && dayOf(r.fecha_hora) === today)
    .filter(r => { const m = minutesUntil(r, now); return m != null && m <= 120 && m >= -90; }), [reservas, now, today]);

  const tables = useMemo(() => mesas.filter(m => Number(m.activo ?? 1) === 1), [mesas]);
  const candidate = { id: dialog?.reserva?.id, personas: Number(form.personas), fecha_hora: `${form.day} ${form.time}`, duracion_min: Number(form.duracion_min) };
  const free = useMemo(() => dialog ? suggestTables(tables, reservas, candidate) : [], [dialog, tables, reservas, form.personas, form.day, form.time, form.duracion_min]);
  const busyTables = dialog ? tables.filter(t => Number(t.capacidad) >= Number(form.personas) && findConflict({ ...candidate, mesa_id: t.id }, reservas)).length : 0;
  const chosenStillFree = form.mesa_id == null || free.some(t => Number(t.id) === Number(form.mesa_id));

  const change = (key, value) => { setError(''); setForm(f => ({ ...f, [key]: value })); };
  const open = (reserva = null) => {
    setError('');
    setForm(reserva ? { cliente_nombre: reserva.cliente_nombre, telefono: reserva.telefono || '', personas: Number(reserva.personas), day: dayOf(reserva.fecha_hora), time: timeOf(reserva.fecha_hora),
      duracion_min: Number(reserva.duracion_min) || DEFAULT_DURATION, mesa_id: reserva.mesa_id, notas: reserva.notas || '' } : blank(day < today ? today : day));
    setDialog({ reserva });
  };
  const close = () => { if (!busyRef.current) setDialog(null); };

  async function save() {
    if (busyRef.current) return;
    if (!chosenStillFree) { setError('La mesa elegida ya no está libre en ese horario. Elige otra o deja la reserva sin mesa.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const payload = reservationPayload({ ...form, fecha_hora: `${form.day} ${form.time}` });
      const saved = dialog.reserva ? await updateReserva(dialog.reserva.id, payload) : await createReserva(payload);
      setDialog(null); setDay(dayOf(saved.fecha_hora));
      toast.show(dialog.reserva ? 'Reserva actualizada.' : `Reserva de ${saved.cliente_nombre} para ${dayName(dayOf(saved.fecha_hora), today).toLowerCase()} a las ${timeOf(saved.fecha_hora)}.`);
    } catch (e) { setError(errorText(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function mark(r, estado, { fromDialog } = {}) {
    const before = r.estado;
    try {
      await setReservaEstado(r.id, estado);
      if (fromDialog) setDialog(null);
      toast.show(`${r.cliente_nombre}: ${RESERVATION_LABELS[estado].toLowerCase()}.`, 'green', 5000,
        { label: 'Deshacer', onPress: () => setReservaEstado(r.id, before).catch(e => toast.show(errorText(e), 'red')) });
    } catch (e) { fromDialog ? setError(errorText(e)) : toast.show(errorText(e), 'red'); }
  }

  const statusOf = r => isLate(r, now) ? <Status tone="red">Retrasada {Math.abs(minutesUntil(r, now))} min</Status> : <Status tone={TONE[r.estado]}>{RESERVATION_LABELS[r.estado]}</Status>;
  const tableTag = r => r.mesa_id != null
    ? <View style={{ paddingHorizontal: 8, height: 24, borderRadius: radius.sm, backgroundColor: c.soft, justifyContent: 'center' }}><Text style={[type.small, type.num, { color: c.text, fontWeight: '600' }]}>Mesa {r.mesa_numero}</Text></View>
    : <View style={{ paddingHorizontal: 8, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: c.amber, borderStyle: 'dashed', justifyContent: 'center' }}><Text style={[type.small, { color: c.amber, fontWeight: '600' }]}>Sin mesa</Text></View>;
  const quick = r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && dayOf(r.fecha_hora) === today
    ? <View style={{ flexDirection: 'row', gap: space.xs }}>
        <Button size="sm" variant="secondary" onPress={() => mark(r, 'LLEGO')}>Llegó</Button>
        {isLate(r, now) ? <Button size="sm" variant="ghost" onPress={() => mark(r, 'NO_VINO')}>No vino</Button> : null}
      </View> : null;

  // La fila abre la reserva; las acciones rápidas van al lado (no dentro) para no anidar botones.
  const row = (r, i) => <View key={r.id} style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: BLOCKING_STATES.includes(r.estado) ? 1 : 0.6 }}>
    <Press onPress={() => open(r)} scaleTo={0.995} accessibilityRole="button" accessibilityLabel={`${timeOf(r.fecha_hora)}, ${r.cliente_nombre}, ${r.personas} personas. Abrir reserva`}
      style={({ hovered }) => ({ flex: phone ? undefined : 1, minWidth: 0, flexDirection: 'row', alignItems: phone ? 'flex-start' : 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: hovered ? c.surfaceAlt : 'transparent' })}>
      <View style={{ width: 54 }}>
        <Text style={[type.figure, { fontSize: 20, lineHeight: 24, color: c.text }]}>{timeOf(r.fecha_hora)}</Text>
        <Text style={[type.micro, type.num, { color: c.faint }]}>hasta {endTime(r)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', textDecorationLine: r.estado === 'CANCELADA' ? 'line-through' : 'none' }]}>{r.cliente_nombre}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><UsersRound size={13} color={c.faint} /><Text style={[type.small, type.num, { color: c.muted }]}>{r.personas}</Text></View>
          {r.telefono ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Phone size={13} color={c.faint} /><Text style={[type.small, type.num, { color: c.muted }]}>{r.telefono}</Text></View> : null}
          {phone ? tableTag(r) : null}
          {phone ? statusOf(r) : null}
        </View>
        {r.notas ? <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{r.notas}</Text> : null}
      </View>
      {!phone ? <View style={{ width: 110 }}>{tableTag(r)}</View> : null}
      {!phone ? <View style={{ width: 150 }}>{statusOf(r)}</View> : null}
    </Press>
    {quick(r) ? <View style={{ width: phone ? undefined : 160, alignItems: phone ? 'flex-start' : 'flex-end', paddingHorizontal: space.lg, paddingBottom: phone ? space.md : 0, paddingLeft: phone ? space.lg + 54 + space.lg : space.lg }}>{quick(r)}</View>
      : !phone ? <View style={{ width: 160 }} /> : null}
  </View>;

  const agenda = <View style={{ flex: 1, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, marginBottom: space.md, flexWrap: 'wrap' }}>
      <Text style={[type.h2, { color: c.text }]}>{longDay(day)}</Text>
      <Segmented size="sm" value={filter} onChange={setFilter} accessibilityLabel="Estado"
        options={[{ value: 'active', label: 'Activas', count: active.length }, { value: 'closed', label: 'Cerradas', count: ofDay.length - active.length }, { value: 'all', label: 'Todas', count: ofDay.length }]} />
    </View>
    {loading && !reservas.length ? <View style={{ gap: space.sm }}>{[0, 1, 2].map(i => <Skeleton key={i} height={64} radius={10} />)}</View>
      : shown.length ? <FadeIn trigger={`${day}-${filter}`} duration={180} offset={4}><View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, backgroundColor: c.surface, overflow: 'hidden' }}>
          {shown.map((r, i) => row(r, i))}
        </View></FadeIn>
      : <EmptyState icon={CalendarClock} title={ofDay.length ? 'Nada en este filtro' : day < today ? 'Ese día no hubo reservas' : 'Sin reservas para este día'}
          description={ofDay.length ? 'Cambia el filtro para ver las demás.' : day < today ? 'Elige otro día en la franja de arriba.' : 'Cuando alguien llame o escriba para reservar, regístralo aquí y la mesa quedará apartada en ese horario.'}
          action={day >= today ? <Button variant="primary" icon={Plus} onPress={() => open()}>Nueva reserva</Button> : null} />}
  </View>;

  const arrivals = <View style={{ width: wide ? 320 : undefined, gap: space.md }}>
    <Text style={[type.h3, { color: c.text }]}>Llegan pronto</Text>
    {upcoming.length ? upcoming.map(r => { const m = minutesUntil(r, now); const late = isLate(r, now);
      return <View key={r.id} style={{ padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: late ? c.red : c.line, backgroundColor: c.surface, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', flex: 1 }]}>{r.cliente_nombre}</Text>
          <Text style={[type.small, type.num, { color: late ? c.red : m <= 15 ? c.text : c.muted, fontWeight: '600' }]}>{m > 0 ? `en ${m} min` : late ? `${-m} min tarde` : 'ahora'}</Text>
        </View>
        <Text style={[type.small, { color: c.muted }]}>{timeOf(r.fecha_hora)} · {r.personas} personas · {r.mesa_id != null ? `Mesa ${r.mesa_numero}` : 'sin mesa asignada'}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 2 }}>
          <Button size="sm" variant="primary" onPress={() => mark(r, 'LLEGO')}>Llegó</Button>
          {late ? <Button size="sm" variant="secondary" onPress={() => mark(r, 'NO_VINO')}>No vino</Button> : <Button size="sm" variant="ghost" onPress={() => open(r)}>Ver</Button>}
        </View>
      </View>; })
      : <Text style={[type.small, { color: c.faint }]}>Nadie en las próximas 2 horas.</Text>}
  </View>;

  const title = dialog?.reserva ? 'Editar reserva' : 'Nueva reserva';
  const editingActive = dialog?.reserva && BLOCKING_STATES.includes(dialog.reserva.estado);
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Reservas" description={active.length ? `${dayName(day, today)}: ${active.length} ${active.length === 1 ? 'reserva' : 'reservas'} · ${people} personas${unassigned ? ` · ${unassigned} sin mesa` : ''}` : `${dayName(day, today)}: sin reservas activas`}
        actions={<Button variant="primary" icon={Plus} onPress={() => open()}>Nueva reserva</Button>} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xl }}>
        <IconButton icon={ChevronLeft} label="Semana anterior" onPress={() => setWeekStart(w => addDays(w, -7))} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ flex: 1 }}>
          {week.map(d => { const n = countFor(d); const sel = d === day;
            return <Press key={d} onPress={() => setDay(d)} scaleTo={0.96} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={`${longDay(d)}, ${n} reservas`}
              style={{ minWidth: phone ? 64 : 92, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: sel ? c.primary : c.line, backgroundColor: sel ? c.primarySoft : c.surface, alignItems: 'center', gap: 2 }}
              hoverStyle={sel ? null : { borderColor: c.lineStrong }}>
              <Text style={[type.small, { color: sel || d === today ? c.text : c.muted, fontWeight: sel || d === today ? '600' : '500' }]}>{dayName(d, today)}</Text>
              <Text style={[type.micro, type.num, { color: n ? c.text : c.faint }]}>{n ? `${n} ${n === 1 ? 'reserva' : 'reservas'}` : '—'}</Text>
            </Press>; })}
        </ScrollView>
        <IconButton icon={ChevronRight} label="Semana siguiente" onPress={() => setWeekStart(w => addDays(w, 7))} />
        {day !== today ? <Button size="sm" variant="ghost" onPress={() => { setDay(today); setWeekStart(addDays(today, -1)); }}>Hoy</Button> : null}
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.xl, alignItems: 'flex-start' }}>
        {!wide && upcoming.length ? <View style={{ alignSelf: 'stretch' }}>{arrivals}</View> : null}
        {agenda}
        {wide ? arrivals : null}
      </View>
    </ScrollView>

    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.reserva ? `Registrada por ${dialog.reserva.creado_por_nombre || 'el sistema'}` : 'La mesa queda apartada durante ese horario.'} maxWidth={620} close={close} busy={busy}
      footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        {editingActive ? <Button variant="ghost" disabled={busy} onPress={() => mark(dialog.reserva, 'CANCELADA', { fromDialog: true })}><Text style={[type.small, { color: c.red, fontWeight: '600' }]}>Cancelar reserva</Text></Button> : null}
        {dialog?.reserva && !editingActive ? <Button variant="ghost" disabled={busy} onPress={() => mark(dialog.reserva, 'CONFIRMADA', { fromDialog: true })}>Reactivar</Button> : null}
        <View style={{ flex: 1 }} />
        <MenuButton disabled={busy} onPress={close}>Cerrar</MenuButton>
        <MenuButton primary busy={busy} onPress={save}>{dialog?.reserva ? 'Guardar cambios' : 'Reservar'}</MenuButton>
      </View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.lg }}>
        <MenuField containerStyle={{ flex: 1.4 }} label="Nombre" value={form.cliente_nombre} onChangeText={v => change('cliente_nombre', v)} placeholder="Ej. Ana Pérez" maxLength={120} autoFocus={!dialog?.reserva} />
        <MenuField containerStyle={{ flex: 1 }} label="Teléfono (opcional)" value={form.telefono} onChangeText={v => change('telefono', v.replace(/[^\d+\s-]/g, ''))} placeholder="099 123 4567" keyboardType="phone-pad" maxLength={30} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Personas</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton icon={Minus} label="Una persona menos" disabled={form.personas <= 1} onPress={() => change('personas', Math.max(1, form.personas - 1))} />
          <Text style={[type.figure, { fontSize: 22, minWidth: 36, textAlign: 'center', color: c.text }]}>{form.personas}</Text>
          <IconButton icon={Plus} label="Una persona más" disabled={form.personas >= 50} onPress={() => change('personas', Math.min(50, form.personas + 1))} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Día</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {Array.from({ length: 14 }, (_, i) => addDays(today, i)).map(d => <MenuChip key={d} selected={form.day === d} onPress={() => change('day', d)}>{dayName(d, today)}</MenuChip>)}
        </ScrollView>
      </View>
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.lg }}>
        <View style={{ flex: 1, gap: 6 }}>
          <MenuField label="Hora" value={form.time} onChangeText={v => change('time', v.replace(/[^\d:]/g, '').slice(0, 5))} placeholder="19:30" keyboardType="numbers-and-punctuation" maxLength={5} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {QUICK_TIMES.map(t => <MenuChip key={t} selected={form.time === t} onPress={() => change('time', t)}>{t}</MenuChip>)}
          </ScrollView>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Duración</Text>
          <Segmented size="sm" value={Number(form.duracion_min)} onChange={v => change('duracion_min', v)} accessibilityLabel="Duración" options={DURATIONS.map(d => ({ value: d, label: d % 60 ? `${Math.floor(d / 60)} h ${d % 60}` : `${d / 60} h` }))} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Mesa</Text>
        <Text style={[type.micro, { color: c.faint }]}>{free.length ? `Libres para ${form.personas} ${Number(form.personas) === 1 ? 'persona' : 'personas'} de ${form.time} a ${timeOf(fromMinutes((interval(candidate)?.start || 0) + Number(form.duracion_min)))}` : 'No hay mesas libres con esa capacidad en ese horario.'}{busyTables ? ` · ${busyTables} ya reservadas` : ''}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <MenuChip selected={form.mesa_id == null} onPress={() => change('mesa_id', null)}>Asignar después</MenuChip>
          {free.map(t => <MenuChip key={t.id} selected={Number(form.mesa_id) === Number(t.id)} onPress={() => change('mesa_id', t.id)}>{`Mesa ${t.numero} · ${t.capacidad}p${t.ubicacion_nombre ? ` · ${t.ubicacion_nombre}` : ''}`}</MenuChip>)}
        </View>
        {!chosenStillFree ? <Text style={[type.small, { color: c.red }]}>La mesa elegida ya no está libre en ese horario.</Text> : null}
      </View>
      <MenuField label="Notas (opcional)" value={form.notas} onChangeText={v => change('notas', v)} placeholder="Cumpleaños, silla para bebé, terraza si es posible…" multiline maxLength={300} />
    </MenuModal>
  </View>;
}
