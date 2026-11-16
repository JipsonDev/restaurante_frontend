import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Armchair, ArrowRight, CalendarClock, Check, Edit3, EyeOff, LayoutGrid, MapPin, Plus, ReceiptText, Search, Trash2, Users, X } from 'lucide-react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { tableLayout } from '../utils/tableLayout.mjs';
import { tableDraft, tableKey, tablePayload } from '../utils/adminTables.mjs';
import { normalizeCatalogText as normalize } from '../utils/menuLogic.mjs';

const LABEL = { Libre: 'Disponible', Ocupada: 'Ocupada', Cuenta: 'Cuenta solicitada', Reservada: 'Reservada', inactive: 'Inactiva' };
const errorText = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'No se pudo completar la operación.';
function tone(key, c) {
  return { Libre: [c.green, c.greenSoft], Ocupada: [c.amber, c.amberSoft], Cuenta: [c.pink, c.pinkSoft], Reservada: [c.sky, c.skySoft], inactive: [c.muted, c.soft] }[key] || [c.muted, c.soft];
}
function TableDrawing({ table }) {
  const { c } = useTheme();
  const [color, soft] = tone(tableKey(table), c);
  const model = tableLayout(table.capacidad);
  return <Svg width="100%" height={112} viewBox={`0 0 ${model.viewWidth} ${model.viewHeight}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {model.seats.map((seat, index) => <G key={index} transform={`translate(${seat.x},${seat.y}) rotate(${seat.rotation})`}><Rect x={-10} y={-6} width={20} height={12} rx={4} fill={soft} stroke={color} strokeOpacity={0.55} /><Rect x={-10} y={-8} width={20} height={4} rx={2} fill={color} opacity={0.8} /></G>)}
    <Rect x={model.x} y={model.y + 4} width={model.width} height={model.height} rx={model.round ? 42 : 16} fill={c.line} opacity={0.45} />
    <Rect x={model.x} y={model.y} width={model.width} height={model.height} rx={model.round ? 42 : 16} fill={soft} stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
    <SvgText x={model.x + model.width / 2} y={model.y + 48} fill={color} fontSize={24} fontFamily="sans-serif" fontWeight="700" textAnchor="middle">{table.numero}</SvgText>
  </Svg>;
}
export default function TablesScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 680;
  const { mesas, ubicaciones, loading, createMesa, updateMesa, deleteMesa, updateMesaEstado } = useAdmin();
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [zone, setZone] = useState('all');
  const [gridWidth, setGridWidth] = useState(0), [limit, setLimit] = useState(24);
  const [form, setForm] = useState(null), [original, setOriginal] = useState(null), [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null), [confirmation, setConfirmation] = useState(null), [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const initialDraft = useRef(null);
  const [dialogError, setDialogError] = useState('');
  const active = mesas.filter(t => Number(t.activo) === 1);
  const counts = useMemo(() => mesas.reduce((acc, table) => { const key = tableKey(table); acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [mesas]);
  const visible = useMemo(() => mesas.filter(t => (filter === 'all' ? Number(t.activo) === 1 : tableKey(t) === filter) && (zone === 'all' || String(t.ubicacion_id || 'none') === zone) && normalize(`Mesa ${t.numero} ${t.ubicacion_nombre || 'Sin ubicación'}`).includes(normalize(query))).sort((a, b) => Number(a.numero) - Number(b.numero)), [mesas, filter, zone, query]);
  const columns = gridWidth >= 1120 ? 4 : gridWidth >= 810 ? 3 : gridWidth >= 520 ? 2 : 1;
  const cardWidth = gridWidth ? Math.floor((gridWidth - 14 * (columns - 1) - 2) / columns) : '100%';
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
    try { await action(); if (success) setNotice({ text: success }); setConfirmation(null); }
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
  const changeFilter = value => { setFilter(value); setLimit(24); };
  return <>
    <ScrollView contentContainerStyle={{ gap: phone ? 14 : 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, minWidth: 200 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.8 }}>OPERACIÓN · SALÓN</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: phone ? 27 : 32, fontWeight: '700', marginTop: 5 }}>Mesas y espacios</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>Organiza tu salón y consulta su disponibilidad en tiempo real.</Text></View>
        <MenuButton primary icon={Plus} onPress={() => open(null)} disabled={busy}>Nueva mesa</MenuButton>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[{ label: 'Mesas activas', value: active.length, icon: LayoutGrid, color: c.primaryText, soft: c.primarySoft }, { label: 'Disponibles', value: counts.Libre || 0, icon: Check, color: c.green, soft: c.greenSoft }, { label: 'En servicio', value: (counts.Ocupada || 0) + (counts.Cuenta || 0), icon: ReceiptText, color: c.amber, soft: c.amberSoft }, { label: 'Sillas habilitadas', value: active.reduce((sum, t) => sum + Number(t.capacidad || 0), 0), icon: Armchair, color: c.sky, soft: c.skySoft }].map(({ label, value, icon: Icon, color, soft }) => <View key={label} style={{ flexGrow: 1, flexBasis: phone ? '45%' : 170, padding: 16, borderWidth: 1, borderColor: c.line, borderRadius: 10, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ backgroundColor: soft, padding: 10, borderRadius: 10 }}><Icon size={20} color={color} /></View><View><Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: c.text, fontSize: 25, fontWeight: '700', marginTop: 2 }}>{value}</Text></View></View>)}
      </View>
      {notice && <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><MenuNotice danger={notice.danger}>{notice.text}</MenuNotice></View><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice(null)} /></View>}
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 13 }}><Search size={18} color={c.muted} /><TextInput accessibilityLabel="Buscar mesas" placeholder="Buscar por número o ubicación…" placeholderTextColor={c.muted} value={query} onChangeText={value => { setQuery(value); setLimit(24); }} style={{ flex: 1, minWidth: 0, minHeight: 46, color: c.text, fontSize: 13 }} />{!!query && <MenuButton icon={X} label="Limpiar búsqueda" onPress={() => setQuery('')} />}</View>
        <ScrollView horizontal={phone} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: phone ? 'nowrap' : 'wrap', gap: 8 }}><MenuChip selected={filter === 'all'} onPress={() => changeFilter('all')}>Activas · {active.length}</MenuChip>{Object.entries(LABEL).map(([key, label]) => <MenuChip key={key} selected={filter === key} color={tone(key, c)[0]} background={tone(key, c)[1]} onPress={() => changeFilter(key)}>{label} · {counts[key] || 0}</MenuChip>)}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 8 }}><MapPin size={16} color={c.muted} />{[{ id: 'all', nombre: 'Todas las ubicaciones' }, { id: 'none', nombre: 'Sin ubicación' }, ...locations].map(location => <Pressable key={location.id} accessibilityRole="button" accessibilityState={{ selected: zone === String(location.id) }} onPress={() => { setZone(String(location.id)); setLimit(24); }} style={{ paddingVertical: 10, paddingHorizontal: 10, borderRadius: 6, backgroundColor: zone === String(location.id) ? c.soft : 'transparent' }}><Text style={{ color: zone === String(location.id) ? c.text : c.muted, fontWeight: zone === String(location.id) ? '600' : '400', fontSize: 12 }}>{location.nombre}</Text></Pressable>)}</ScrollView>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{visible.length} {visible.length === 1 ? 'mesa' : 'mesas'}{filter === 'inactive' ? ' inactivas' : ' en tu salón'}</Text><Text style={{ color: c.muted, fontSize: 11 }}>Las sillas indican capacidad</Text></View>
      <View onLayout={event => setGridWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {visible.slice(0, limit).map(table => {
          const key = tableKey(table), [color, soft] = tone(key, c), orders = Number(table.pedidos_activos || 0);
          return <View key={table.id} style={{ width: cardWidth, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 12, overflow: 'hidden' }}>
            <View style={{ padding: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>Mesa {table.numero}</Text><View style={{ backgroundColor: soft, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}><Text style={{ color, fontSize: 10, fontWeight: '600' }}>{LABEL[key] || table.estado}</Text></View></View>
            <View style={{ paddingHorizontal: 24, backgroundColor: c.surface }}><TableDrawing table={table} /></View>
            <View style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><MapPin size={14} color={c.muted} /><Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, flex: 1 }}>{table.ubicacion_nombre || 'Sin ubicación'}</Text><Users size={14} color={c.muted} /><Text style={{ color: c.text, fontSize: 12 }}>{table.capacidad} sillas</Text></View>
              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: orders ? color : c.faint }} /><Text style={{ color: c.muted, fontSize: 11 }}>{orders ? `${orders} ${orders === 1 ? 'pedido activo' : 'pedidos activos'}` : key === 'inactive' ? 'Fuera del salón de atención' : key === 'Reservada' ? 'Apartada para próxima atención' : 'Sin pedidos activos'}</Text></View>
              <View style={{ flexDirection: 'row', gap: 8 }}><MenuButton icon={Edit3} label={`Editar Mesa ${table.numero}`} onPress={() => open(table)} disabled={busy} style={{ flex: 1 }}>Editar</MenuButton>
                {key === 'Libre' && <MenuButton icon={CalendarClock} disabled={busy} onPress={() => ask(table, 'Reservar mesa', 'Quedará marcada como reservada.', 'Reservar', t => updateMesaEstado(t.id, 'Reservada'))}>Reservar</MenuButton>}
                {key === 'Reservada' && <MenuButton icon={Check} disabled={busy} onPress={() => ask(table, 'Quitar reserva', 'Volverá a estar disponible.', 'Liberar', t => updateMesaEstado(t.id, 'Libre'))}>Liberar</MenuButton>}
                {key === 'Ocupada' && <MenuButton icon={ReceiptText} disabled={busy} onPress={() => ask(table, 'Solicitar cuenta', 'Se marcará la cuenta como solicitada. Esto no registra un pago.', 'Solicitar cuenta', t => updateMesaEstado(t.id, 'Cuenta'))}>Cuenta</MenuButton>}
                {key === 'Cuenta' && <MenuButton disabled={busy} onPress={() => ask(table, 'Continuar atención', 'Se quitará la marca de cuenta solicitada y seguirá ocupada.', 'Continuar atención', t => updateMesaEstado(t.id, 'Ocupada'))}>Atender</MenuButton>}
                {key === 'inactive' && <MenuButton icon={ArrowRight} disabled={busy} onPress={() => ask(table, 'Reactivar mesa', 'Volverá a aparecer en el salón.', 'Reactivar', t => updateMesa(t.id, { activo: 1 }))}>Reactivar</MenuButton>}
              </View>
            </View>
          </View>;
        })}
      </View>
      {loading && !mesas.length ? <ActivityIndicator color={c.primary} /> : !visible.length && <View style={{ padding: 32, backgroundColor: c.surface, alignItems: 'center', gap: 12, borderRadius: 10 }}><LayoutGrid size={32} color={c.faint} /><Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>No hay mesas para esta selección</Text><Text style={{ color: c.muted, textAlign: 'center' }}>Prueba otra ubicación o cambia los filtros.</Text><MenuButton onPress={() => { setQuery(''); setFilter('all'); setZone('all'); }}>Limpiar filtros</MenuButton></View>}
      {visible.length > limit && <MenuButton onPress={() => setLimit(value => value + 24)}>Mostrar más mesas</MenuButton>}
    </ScrollView>
    <MenuModal
      visible={!!(form || confirmation)}
      title={confirmation ? confirmation.title : original ? `Editar Mesa ${original.numero}` : 'Nueva mesa'}
      subtitle={confirmation ? confirmation.text : 'Configura el espacio y su capacidad. El estado se actualiza con la atención.'}
      close={confirmation ? cancelConfirmation : close}
      busy={busy}
      maxWidth={confirmation ? 460 : 620}
      footer={confirmation
        ? <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><MenuButton disabled={busy} onPress={cancelConfirmation}>{confirmation.cancelLabel || 'Cancelar'}</MenuButton><MenuButton primary={!confirmation.danger} danger={confirmation.danger} busy={busy} onPress={() => perform(confirmation.run, confirmation.success)}>{confirmation.label}</MenuButton></View>
        : <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary icon={Check} busy={busy} onPress={save}>{original ? 'Guardar cambios' : 'Crear mesa'}</MenuButton></View>}
    >
      {confirmation ? (dialogError ? <MenuNotice danger>{dialogError}</MenuNotice> : null) : form && <>
        {!!formError && <MenuNotice danger>{formError}</MenuNotice>}
        {activeOrders && <MenuNotice>Esta mesa tiene pedidos activos. Puedes ajustar su capacidad y ubicación; su número y disponibilidad están protegidos hasta terminar la atención.</MenuNotice>}
        <View style={{ flexDirection: 'row', gap: 14 }}><MenuField label="Número de mesa" keyboardType="number-pad" value={form.numero} editable={!busy && !activeOrders} containerStyle={{ flex: 1 }} onChangeText={numero => setForm(value => ({ ...value, numero }))} /><MenuField label="Cantidad de sillas" keyboardType="number-pad" value={form.capacidad} editable={!busy} containerStyle={{ flex: 1 }} onChangeText={capacidad => setForm(value => ({ ...value, capacidad }))} /></View>
        <View style={{ gap: 10 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Ubicación</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[{ id: null, nombre: 'Sin ubicación' }, ...ubicaciones.filter(l => Number(l.activo) === 1 || Number(l.id) === Number(form.ubicacion_id))].map(l => <MenuButton key={l.id ?? 'none'} disabled={busy || (l.id != null && Number(l.activo) === 0)} primary={Number(form.ubicacion_id) === Number(l.id)} onPress={() => setForm(value => ({ ...value, ubicacion_id: l.id }))}>{l.nombre}{Number(l.activo) === 0 ? ' (inactiva)' : ''}</MenuButton>)}</View></View>
        <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 10, padding: 14, gap: 8 }}><Text style={{ color: c.muted, fontSize: 11 }}>VISTA PREVIA · CAPACIDAD CONFIGURADA</Text><TableDrawing table={{ ...form, activo: original?.activo ?? 1, estado: original?.estado || 'Libre' }} /><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{form.capacidad || '0'} sillas · {Number(form.capacidad) > 16 ? 'Ilustración simplificada' : 'Distribución ilustrativa'}</Text></View>
        {original && <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16, gap: 12 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Disponibilidad e historial</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Desactivar oculta la mesa y conserva sus pedidos anteriores. Eliminar solo está permitido si nunca tuvo pedidos.</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><MenuButton icon={EyeOff} disabled={busy || activeOrders || !!dirty} onPress={() => { ask(original, Number(original.activo) ? 'Desactivar mesa' : 'Reactivar mesa', Number(original.activo) ? 'Se ocultará del salón y se conservará su historial.' : 'Volverá a aparecer en el salón.', Number(original.activo) ? 'Desactivar' : 'Reactivar', t => updateMesa(t.id, { activo: Number(t.activo) ? 0 : 1 })); }}>{Number(original.activo) ? 'Desactivar mesa' : 'Reactivar mesa'}</MenuButton><MenuButton danger icon={Trash2} disabled={busy || activeOrders || !!dirty} onPress={() => { ask(original, 'Eliminar mesa', 'Se eliminará permanentemente si no tiene pedidos históricos.', 'Eliminar definitivamente', t => deleteMesa(t.id), true); }}>Eliminar</MenuButton></View>{!!dirty && <Text style={{ color: c.muted, fontSize: 11 }}>Guarda o descarta los cambios antes de modificar la disponibilidad.</Text>}</View>}
      </>}
    </MenuModal>
  </>;
}

