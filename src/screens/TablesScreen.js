import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Armchair, ArrowRight, CalendarClock, Check, Edit3, EyeOff, LayoutGrid, MapPin, Plus, ReceiptText, Search, Trash2, Users, X } from 'lucide-react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Badge, Button, Card, EmptyState, FadeIn, IconButton, PageHeader, Press, SearchField, Segmented, Skeleton, Status, Tabs, radius, space, type, useToast } from '../components/admin/ui';
import { tableLayout } from '../utils/tableLayout.mjs';
import { tableDraft, tableKey, tablePayload } from '../utils/adminTables.mjs';
import { normalizeCatalogText as normalize } from '../utils/menuLogic.mjs';
import { TABLE_STATE } from '../components/admin/states';
import { localStamp, minutesUntil, nextByTable, timeOf } from '../utils/reservationLogic.mjs';

const LABEL = Object.fromEntries(Object.entries(TABLE_STATE).map(([k, [label]]) => [k, label]));
const STATUS_TONE = Object.fromEntries(Object.entries(TABLE_STATE).map(([k, [, tone]]) => [k, tone]));
const errorText = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'No se pudo completar la operación.';
function tone(key, c) {
  return [c.muted, c.surfaceAlt];
}
function TableDrawing({ table }) {
  const { c } = useTheme();
  const [color, soft] = tone(tableKey(table), c);
  const model = tableLayout(table.capacidad);
  return <Svg width="100%" height={112} viewBox={`0 0 ${model.viewWidth} ${model.viewHeight}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {model.seats.map((seat, index) => <G key={index} transform={`translate(${seat.x},${seat.y}) rotate(${seat.rotation})`}><Rect x={-10} y={-6} width={20} height={12} rx={4} fill={soft} stroke={color} strokeOpacity={0.55} /><Rect x={-10} y={-8} width={20} height={4} rx={2} fill={color} opacity={0.8} /></G>)}
    <Rect x={model.x} y={model.y + 4} width={model.width} height={model.height} rx={model.round ? 42 : 16} fill={c.line} opacity={0.45} />
    <Rect x={model.x} y={model.y} width={model.width} height={model.height} rx={model.round ? 42 : 16} fill={soft} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
    <SvgText x={model.x + model.width / 2} y={model.y + 48} fill={color} fontSize={24} fontWeight="600" textAnchor="middle">{table.numero}</SvgText>
  </Svg>;
}
export default function TablesScreen({ onNavigate }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 680;
  const { mesas, ubicaciones, reservas = [], loading, createMesa, updateMesa, deleteMesa, updateMesaEstado } = useAdmin();
  const nextRes = useMemo(() => nextByTable(reservas, localStamp()), [reservas]);
  const toast = useToast();
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [zone, setZone] = useState('all');
  const [limit, setLimit] = useState(48);
  const [form, setForm] = useState(null), [original, setOriginal] = useState(null), [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null), [confirmation, setConfirmation] = useState(null), [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const initialDraft = useRef(null);
  const [dialogError, setDialogError] = useState('');
  const active = mesas.filter(t => Number(t.activo) === 1);
  const counts = useMemo(() => mesas.reduce((acc, table) => { const key = tableKey(table); acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [mesas]);
  const visible = useMemo(() => mesas.filter(t => (filter === 'all' ? Number(t.activo) === 1 : tableKey(t) === filter) && (zone === 'all' || String(t.ubicacion_id || 'none') === zone) && normalize(`Mesa ${t.numero} ${t.ubicacion_nombre || 'Sin ubicación'}`).includes(normalize(query))).sort((a, b) => Number(a.numero) - Number(b.numero)), [mesas, filter, zone, query]);
  const locations = ubicaciones.filter(l => Number(l.activo) === 1 || mesas.some(t => Number(t.ubicacion_id) === Number(l.id)));
  const activeOrders = original ? Number(mesas.find(t => t.id === original.id)?.pedidos_activos || 0) > 0 : false;
  const dirty = form && JSON.stringify(form) !== JSON.stringify(initialDraft.current);
  const open = table => { if (busyRef.current) return; const draft = tableDraft(table, mesas); initialDraft.current = draft; setOriginal(table || null); setForm(draft); setFormError(''); setConfirmation(null); setDialogError(''); };
  const cancelConfirmation = () => { if (!busyRef.current) { setConfirmation(null); setDialogError(''); } };
  const close = () => {
    if (busyRef.current) return;
    if (dirty) { setDialogError(''); setConfirmation({ title: 'Descartar cambios', text: 'Los cambios de esta mesa todavía no se han guardado.', cancelLabel: 'Seguir editando', label: 'Descartar', run: async () => setForm(null) }); }
    else setForm(null);
  };
  async function perform(action, success, inForm = false) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError(''); setDialogError(''); setNotice(null);
    try { await action(); if (success) toast.show(success); setConfirmation(null); }
    catch (error) { if (inForm) setFormError(errorText(error)); else setDialogError(errorText(error)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function save() {
    let payload;
    try { payload = tablePayload(form, original, mesas, ubicaciones); }
    catch (error) { setFormError(error.message); return; }
    if (original && !Object.keys(payload).length) { setForm(null); return; }
    perform(async () => { if (original) await updateMesa(original.id, payload); else await createMesa(payload); setForm(null); }, original ? 'Cambios de mesa guardados.' : 'Mesa creada y disponible para atender.', true);
  }
  const ask = (table, title, text, label, action, danger = false) => { if (busyRef.current) return; setDialogError(''); setConfirmation({ title, text: `Mesa ${table.numero}. ${text}`, label, danger, run: async () => { await action(table); setForm(null); }, success: 'Mesa actualizada.' }); };
  const changeFilter = value => { setFilter(value); setLimit(48); };
  return <>
    <ScrollView contentContainerStyle={{ paddingBottom: space.x3 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <PageHeader title="Mesas" description={`${active.length} activas · ${active.reduce((sum, t) => sum + Number(t.capacidad || 0), 0)} sillas · ${(counts.Ocupada || 0) + (counts.Cuenta || 0)} en servicio`}
        actions={<>
          {onNavigate ? <Button onPress={() => onNavigate('reservas')}>Reservas</Button> : null}
          <Button variant="primary" onPress={() => open(null)} disabled={busy}>Agregar mesa</Button>
        </>} />
      <Card padded={false}>
        <View style={{ padding: space.sm, gap: space.sm, borderBottomWidth: 1, borderBottomColor: c.line }}>
          {locations.length > 1 ? <Tabs value={zone} onChange={value => { setZone(value); setLimit(48); }}
            options={[{ value: 'all', label: 'Todo el local' }, ...locations.map(l => ({ value: String(l.id), label: l.nombre, count: mesas.filter(t => Number(t.activo) === 1 && Number(t.ubicacion_id) === Number(l.id)).length })), ...(mesas.some(t => !t.ubicacion_id) ? [{ value: 'none', label: 'Sin zona' }] : [])]} /> : null}
          <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.sm, alignItems: phone ? 'stretch' : 'center' }}>
            <SearchField value={query} onChangeText={value => { setQuery(value); setLimit(48); }} placeholder="Buscar mesa o zona" style={phone ? null : { flex: 1, maxWidth: 320 }} />
            <Segmented value={filter} onChange={changeFilter} accessibilityLabel="Estado"
              options={[{ value: 'all', label: 'Activas', count: active.length }, ...Object.entries(LABEL).map(([key, label]) => ({ value: key, label, count: counts[key] || 0 }))]} />
          </View>
        </View>
        {loading && !mesas.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, padding: space.lg }}>{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width={168} height={128} radius={10} />)}</View>
          : !visible.length ? <EmptyState icon={LayoutGrid} title="No hay mesas en esta selección" description="Prueba otra zona o quita los filtros." action={<Button onPress={() => { setQuery(''); setFilter('all'); setZone('all'); }}>Quitar filtros</Button>} />
          : <FadeIn trigger={`${filter}-${zone}`}>{(() => {
            const shown = visible.slice(0, limit);
            const groups = [];
            shown.forEach(t => { const key = t.ubicacion_nombre || 'Sin zona'; let g = groups.find(x => x.key === key); if (!g) { g = { key, items: [] }; groups.push(g); } g.items.push(t); });
            return groups.map((g, gi) => <View key={g.key} style={{ padding: space.lg, borderTopWidth: gi ? 1 : 0, borderTopColor: c.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.md }}>
                <Text style={[type.h2, { color: c.text }]}>{g.key}</Text>
                <Text style={[type.body, type.num, { color: c.muted }]}>{g.items.length} {g.items.length === 1 ? 'mesa' : 'mesas'} · {g.items.reduce((s, t) => s + Number(t.capacidad || 0), 0)} sillas</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {g.items.map(table => {
                  const key = tableKey(table), orders = Number(table.pedidos_activos || 0);
                  const action = key === 'Libre' ? ['Reservar', () => ask(table, 'Reservar mesa', 'Quedará marcada como reservada.', 'Reservar', t => updateMesaEstado(t.id, 'Reservada'))]
                    : key === 'Reservada' ? ['Liberar', () => ask(table, 'Quitar reserva', 'Volverá a estar disponible.', 'Liberar', t => updateMesaEstado(t.id, 'Libre'))]
                    : key === 'Ocupada' ? ['Marcar cuenta', () => ask(table, 'Marcar cuenta solicitada', 'Se marcará que la mesa pidió la cuenta. Esto no registra un pago.', 'Marcar', t => updateMesaEstado(t.id, 'Cuenta'))]
                    : key === 'Cuenta' ? ['Seguir atendiendo', () => ask(table, 'Continuar atención', 'Se quitará la marca de cuenta solicitada y seguirá ocupada.', 'Continuar', t => updateMesaEstado(t.id, 'Ocupada'))]
                    : ['Reactivar', () => ask(table, 'Reactivar mesa', 'Volverá a aparecer en el salón.', 'Reactivar', t => updateMesa(t.id, { activo: 1 }))];
                  const r = nextRes[table.id]; const m = r ? minutesUntil(r) : null;
                  return <View key={table.id} style={{ width: phone ? '48.6%' : 172 }}>
                    <Press accessibilityRole="button" accessibilityLabel={`Editar mesa ${table.numero}, ${LABEL[key]}, ${table.capacidad} sillas`} onPress={() => open(table)} disabled={busy} scaleTo={0.99}
                      style={{ flexGrow: 1, minHeight: 132, padding: space.md, paddingBottom: 48, borderRadius: radius.md + 2, borderWidth: 1, borderColor: c.line,
                        backgroundColor: key === 'inactive' ? c.surfaceAlt : c.surface, opacity: key === 'inactive' ? 0.7 : 1, gap: 6 }}
                      hoverStyle={{ borderColor: c.lineStrong, backgroundColor: c.surfaceAlt }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[type.h2, type.num, { color: c.text, fontSize: 15 }]}>Mesa {table.numero}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Users size={13} color={c.muted} /><Text style={[type.body, type.num, { color: c.muted }]}>{table.capacidad}</Text></View>
                      </View>
                      <Badge tone={STATUS_TONE[key]}>{LABEL[key] || table.estado}</Badge>
                      <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{orders ? `${orders} ${orders === 1 ? 'pedido activo' : 'pedidos activos'}` : key === 'inactive' ? 'Fuera de servicio' : 'Sin pedidos'}</Text>
                      {r ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <CalendarClock size={13} color={m != null && m <= 30 ? c.text : c.muted} />
                        <Text numberOfLines={1} style={[type.body, type.num, { color: m != null && m <= 30 ? c.text : c.muted, fontWeight: m != null && m <= 30 ? '600' : '400', flexShrink: 1 }]}>Reserva {timeOf(r.fecha_hora)} · {r.personas}p</Text>
                      </View> : null}
                    </Press>
                    <View style={{ position: 'absolute', left: space.md, right: space.md, bottom: space.md }}>
                      <Button size="sm" full onPress={action[1]} disabled={busy} accessibilityLabel={`${action[0]} · Mesa ${table.numero}`}>{action[0]}</Button>
                    </View>
                  </View>;
                })}
              </View>
            </View>);
          })()}</FadeIn>}
        {visible.length > limit ? <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: c.line, alignItems: 'center' }}><Button variant="plain" onPress={() => setLimit(value => value + 48)}>Mostrar más mesas</Button></View> : null}
      </Card>
    </ScrollView>
    <MenuModal
      visible={!!(form || confirmation)}
      title={confirmation ? confirmation.title : original ? `Editar Mesa ${original.numero}` : 'Nueva mesa'}
      subtitle={confirmation ? confirmation.text : 'El estado cambia solo con la atención: pedidos, cuenta y cobro.'}
      close={confirmation ? cancelConfirmation : close}
      busy={busy}
      maxWidth={confirmation ? 460 : 560}
      tone={confirmation ? (confirmation.danger ? 'danger' : 'default') : 'default'}
      footer={confirmation
        ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><MenuButton disabled={busy} onPress={cancelConfirmation}>{confirmation.cancelLabel || 'Cancelar'}</MenuButton><MenuButton primary={!confirmation.danger} danger={confirmation.danger} busy={busy} onPress={() => perform(confirmation.run, confirmation.success)}>{confirmation.label}</MenuButton></View>
        : <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary icon={Check} busy={busy} onPress={save}>{original ? 'Guardar cambios' : 'Crear mesa'}</MenuButton></View>}
    >
      {confirmation ? (dialogError ? <MenuNotice danger>{dialogError}</MenuNotice> : null) : form && <>
        {!!formError && <MenuNotice danger>{formError}</MenuNotice>}
        {activeOrders && <MenuNotice>Esta mesa tiene pedidos activos. Puedes ajustar su capacidad y ubicación; su número y disponibilidad están protegidos hasta terminar la atención.</MenuNotice>}
        <View style={{ flexDirection: 'row', gap: space.md }}><MenuField label="Número de mesa" keyboardType="number-pad" value={form.numero} editable={!busy && !activeOrders} containerStyle={{ flex: 1 }} onChangeText={numero => setForm(value => ({ ...value, numero }))} /><MenuField label="Cantidad de sillas" keyboardType="number-pad" value={form.capacidad} editable={!busy} containerStyle={{ flex: 1 }} onChangeText={capacidad => setForm(value => ({ ...value, capacidad }))} /></View>
        <View style={{ gap: 6 }}><Text style={[type.body, { color: c.text }]}>Ubicación</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{[{ id: null, nombre: 'Sin ubicación' }, ...ubicaciones.filter(l => Number(l.activo) === 1 || Number(l.id) === Number(form.ubicacion_id))].map(l => <MenuChip key={l.id ?? 'none'} selected={l.id == null ? form.ubicacion_id == null : Number(form.ubicacion_id) === Number(l.id)} onPress={() => { if (!busy && !(l.id != null && Number(l.activo) === 0)) setForm(value => ({ ...value, ubicacion_id: l.id })); }}>{`${l.nombre}${Number(l.activo) === 0 ? ' (inactiva)' : ''}`}</MenuChip>)}</View></View>
        <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: space.md, gap: 4 }}><Text style={[type.body, { color: c.muted }]}>Distribución de sillas</Text><TableDrawing table={{ ...form, activo: original?.activo ?? 1, estado: original?.estado || 'Libre' }} /><Text style={[type.body, { color: c.muted, textAlign: 'center' }]}>{form.capacidad || '0'} sillas{Number(form.capacidad) > 16 ? ' · ilustración simplificada' : ''}</Text></View>
        {original && <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: space.lg, gap: space.sm }}><Text style={[type.h3, { color: c.text }]}>Disponibilidad e historial</Text><Text style={[type.body, { color: c.muted }]}>Desactivar oculta la mesa y conserva sus pedidos anteriores. Eliminar solo está permitido si nunca tuvo pedidos.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><MenuButton icon={EyeOff} disabled={busy || activeOrders || !!dirty} onPress={() => { ask(original, Number(original.activo) ? 'Desactivar mesa' : 'Reactivar mesa', Number(original.activo) ? 'Se ocultará del salón y se conservará su historial.' : 'Volverá a aparecer en el salón.', Number(original.activo) ? 'Desactivar' : 'Reactivar', t => updateMesa(t.id, { activo: Number(t.activo) ? 0 : 1 })); }}>{Number(original.activo) ? 'Desactivar mesa' : 'Reactivar mesa'}</MenuButton><MenuButton icon={Trash2} disabled={busy || activeOrders || !!dirty} onPress={() => { ask(original, `¿Eliminar la mesa ${original.numero}?`, 'Se eliminará permanentemente si no tiene pedidos históricos.', 'Eliminar mesa', t => deleteMesa(t.id), true); }}>Eliminar</MenuButton></View>{!!dirty && <Text style={[type.small, { color: c.muted }]}>Guarda o descarta los cambios antes de modificar la disponibilidad.</Text>}</View>}
      </>}
    </MenuModal>
  </>;
}

