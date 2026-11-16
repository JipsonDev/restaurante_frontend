import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { CalendarClock, ChevronLeft, ChevronRight, Minus, Phone, Plus, UsersRound } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, IconButton, PageHeader, Segmented, Skeleton, Tabs, space, type, radius, useToast } from '../components/admin/ui';
import {
  BLOCKING_STATES, DEFAULT_DURATION, RESERVATION_LABELS, addDays, dayOf, findConflict, interval, isLate, localStamp,
  minutesUntil, reservationPayload, suggestTables, timeOf, fromMinutes,
} from '../utils/reservationLogic.mjs';

const TONE = { PENDIENTE: 'warning', CONFIRMADA: 'info', LLEGO: 'success', NO_VINO: 'critical', CANCELADA: 'neutral' };
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

  const statusOf = r => isLate(r, now) ? <Badge tone="critical">Retrasada {Math.abs(minutesUntil(r, now))} min</Badge> : <Badge tone={TONE[r.estado]}>{RESERVATION_LABELS[r.estado]}</Badge>;
  const tableTag = r => r.mesa_id != null
    ? <Text numberOfLines={1} style={[type.body, type.num, { color: c.text }]}>Mesa {r.mesa_numero}{r.ubicacion_nombre && !phone ? <Text style={{ color: c.muted }}> · {r.ubicacion_nombre}</Text> : null}</Text>
    : <Badge tone="warning" progress="incomplete">Sin mesa</Badge>;
  const quick = r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && dayOf(r.fecha_hora) === today
    ? <View style={{ flexDirection: 'row', gap: space.xs }}>
        <Button size="sm" onPress={() => mark(r, 'LLEGO')}>Llegó</Button>
        {isLate(r, now) ? <Button size="sm" variant="tertiary" onPress={() => mark(r, 'NO_VINO')}>No vino</Button> : null}
      </View> : null;
  const hourCell = r => <View><Text style={[type.body, type.num, { color: c.text, fontWeight: '700' }]}>{timeOf(r.fecha_hora)}</Text><Text style={[type.small, type.num, { color: c.muted }]}>hasta {endTime(r)}</Text></View>;
  const nameCell = r => <View style={{ minWidth: 0 }}>
    <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', textDecorationLine: r.estado === 'CANCELADA' ? 'line-through' : 'none' }]}>{r.cliente_nombre}</Text>
    {r.telefono || r.notas ? <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{[r.telefono, r.notas].filter(Boolean).join(' · ')}</Text> : null}
  </View>;
  const columns = phone ? [
    { key: 'h', label: 'Hora', width: 58, render: hourCell },
    { key: 'n', label: 'Reserva', flex: 1, render: r => <View style={{ gap: 4, minWidth: 0 }}>{nameCell(r)}
      <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', alignItems: 'center' }}><Badge tone="neutral">{`${r.personas} p.`}</Badge>{tableTag(r)}{statusOf(r)}</View>{quick(r)}</View> },
  ] : [
    { key: 'h', label: 'Hora', width: 76, sortValue: r => r.fecha_hora, render: hourCell },
    { key: 'n', label: 'Cliente', flex: 1.6, sortValue: r => r.cliente_nombre, render: nameCell },
    { key: 'p', label: 'Personas', width: 80, align: 'center', sortValue: r => Number(r.personas), render: r => <Text style={[type.body, type.num, { color: c.text }]}>{r.personas}</Text> },
    { key: 'm', label: 'Mesa', flex: 1.1, render: tableTag },
    { key: 's', label: 'Estado', width: 150, render: statusOf },
    { key: 'x', label: '', width: 150, align: 'right', render: r => quick(r) },
  ];
  const toolbar = <View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingTop: space.sm }}>
      <IconButton icon={ChevronLeft} label="Semana anterior" size={28} onPress={() => setWeekStart(w => addDays(w, -7))} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Tabs value={day} onChange={setDay} options={week.map(d => ({ value: d, label: dayName(d, today), count: countFor(d) || undefined }))} />
      </View>
      <IconButton icon={ChevronRight} label="Semana siguiente" size={28} onPress={() => setWeekStart(w => addDays(w, 7))} />
      {day !== today ? <Button size="sm" variant="tertiary" onPress={() => { setDay(today); setWeekStart(addDays(today, -1)); }}>Hoy</Button> : null}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, flexWrap: 'wrap' }}>
      <Text style={[type.h3, { color: c.text }]}>{longDay(day)}</Text>
      <Segmented value={filter} onChange={setFilter} accessibilityLabel="Estado"
        options={[{ value: 'active', label: 'Activas', count: active.length }, { value: 'closed', label: 'Cerradas', count: ofDay.length - active.length }, { value: 'all', label: 'Todas', count: ofDay.length }]} />
    </View>
  </View>;

  const agenda = <View style={{ flex: 1, minWidth: 0, alignSelf: 'stretch' }}>
    {loading && !reservas.length ? <Card><View style={{ gap: space.sm }}>{[0, 1, 2].map(i => <Skeleton key={i} height={40} radius={8} />)}</View></Card>
      : <DataTable columns={columns} rows={shown} onRowPress={r => open(r)} selectedKey={dialog?.reserva?.id} toolbar={toolbar} defaultSort={{ key: 'h', dir: 1 }}
          empty={<EmptyState icon={CalendarClock} title={ofDay.length ? 'Nada en este filtro' : day < today ? 'Ese día no hubo reservas' : 'Sin reservas para este día'}
            description={ofDay.length ? 'Cambia el filtro para ver las demás.' : day < today ? 'Elige otro día.' : 'Cuando alguien reserve, regístralo aquí y la mesa quedará apartada en ese horario.'}
            action={day >= today && !ofDay.length ? <Button variant="primary" onPress={() => open()}>Crear reserva</Button> : null} />} />}
  </View>;

  const arrivals = <Card padded={false} style={{ width: wide ? 320 : undefined }}>
    <CardHeader title="Llegan pronto" description="Próximas 2 horas" />
    {upcoming.length ? upcoming.map(r => { const m = minutesUntil(r, now); const late = isLate(r, now);
      return <View key={r.id} style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: c.line, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', flex: 1 }]}>{r.cliente_nombre}</Text>
          {late ? <Badge tone="critical">{`${-m} min tarde`}</Badge> : <Text style={[type.body, type.num, { color: m <= 15 ? c.text : c.muted, fontWeight: m <= 15 ? '600' : '400' }]}>{m > 0 ? `en ${m} min` : 'ahora'}</Text>}
        </View>
        <Text style={[type.body, { color: c.muted }]}>{timeOf(r.fecha_hora)} · {r.personas} personas · {r.mesa_id != null ? `Mesa ${r.mesa_numero}` : 'sin mesa asignada'}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button size="sm" onPress={() => mark(r, 'LLEGO')}>Llegó</Button>
          {late ? <Button size="sm" variant="tertiary" onPress={() => mark(r, 'NO_VINO')}>No vino</Button> : <Button size="sm" variant="tertiary" onPress={() => open(r)}>Ver</Button>}
        </View>
      </View>; })
      : <Text style={[type.body, { color: c.muted, paddingHorizontal: space.lg, paddingBottom: space.lg }]}>Nadie en las próximas 2 horas.</Text>}
  </Card>;

  const title = dialog?.reserva ? 'Editar reserva' : 'Nueva reserva';
  const editingActive = dialog?.reserva && BLOCKING_STATES.includes(dialog.reserva.estado);
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Reservas" description={active.length ? `${dayName(day, today)}: ${active.length} ${active.length === 1 ? 'reserva' : 'reservas'} · ${people} personas${unassigned ? ` · ${unassigned} sin mesa` : ''}` : undefined}
        actions={<Button variant="primary" onPress={() => open()}>Crear reserva</Button>} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg, alignItems: wide ? 'flex-start' : 'stretch' }}>
        {!wide && upcoming.length ? arrivals : null}
        {agenda}
        {wide ? arrivals : null}
      </View>
    </ScrollView>

    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.reserva ? `Registrada por ${dialog.reserva.creado_por_nombre || 'el sistema'}` : 'La mesa queda apartada durante ese horario.'} maxWidth={620} close={close} busy={busy}
      footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        {editingActive ? <Button variant="plain" disabled={busy} onPress={() => mark(dialog.reserva, 'CANCELADA', { fromDialog: true })}><Text style={[type.body, { color: c.red, fontWeight: '600' }]}>Cancelar reserva</Text></Button> : null}
        {dialog?.reserva && !editingActive ? <Button variant="plain" disabled={busy} onPress={() => mark(dialog.reserva, 'CONFIRMADA', { fromDialog: true })}>Reactivar</Button> : null}
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
        <Text style={[type.body, { color: c.text }]}>Personas</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton icon={Minus} label="Una persona menos" disabled={form.personas <= 1} onPress={() => change('personas', Math.max(1, form.personas - 1))} />
          <Text style={[type.figure, { fontSize: 18, minWidth: 36, textAlign: 'center', color: c.text }]}>{form.personas}</Text>
          <IconButton icon={Plus} label="Una persona más" disabled={form.personas >= 50} onPress={() => change('personas', Math.min(50, form.personas + 1))} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[type.body, { color: c.text }]}>Día</Text>
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
          <Text style={[type.body, { color: c.text }]}>Duración</Text>
          <Segmented size="sm" value={Number(form.duracion_min)} onChange={v => change('duracion_min', v)} accessibilityLabel="Duración" options={DURATIONS.map(d => ({ value: d, label: d % 60 ? `${Math.floor(d / 60)} h ${d % 60}` : `${d / 60} h` }))} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[type.body, { color: c.text }]}>Mesa</Text>
        <Text style={[type.body, { color: c.muted }]}>{free.length ? `Libres para ${form.personas} ${Number(form.personas) === 1 ? 'persona' : 'personas'} de ${form.time} a ${timeOf(fromMinutes((interval(candidate)?.start || 0) + Number(form.duracion_min)))}` : 'No hay mesas libres con esa capacidad en ese horario.'}{busyTables ? ` · ${busyTables} ya reservadas` : ''}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          <MenuChip selected={form.mesa_id == null} onPress={() => change('mesa_id', null)}>Asignar después</MenuChip>
          {free.map(t => <MenuChip key={t.id} selected={Number(form.mesa_id) === Number(t.id)} onPress={() => change('mesa_id', t.id)}>{`Mesa ${t.numero} · ${t.capacidad}p${t.ubicacion_nombre ? ` · ${t.ubicacion_nombre}` : ''}`}</MenuChip>)}
        </View>
        {!chosenStillFree ? <Text style={[type.body, { color: c.red }]}>La mesa elegida ya no está libre en ese horario.</Text> : null}
      </View>
      <MenuField label="Notas (opcional)" value={form.notas} onChangeText={v => change('notas', v)} placeholder="Cumpleaños, silla para bebé, terraza si es posible…" multiline maxLength={300} />
    </MenuModal>
  </View>;
}
