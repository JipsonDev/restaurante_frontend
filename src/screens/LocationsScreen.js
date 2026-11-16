import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Armchair, ArrowRight, Check, Edit3, LayoutGrid, MapPin, Plus, Search, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';

const row = { flexDirection: 'row', alignItems: 'center' };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const tableStatus = table => Number(table.activo) !== 1 ? { label: 'Inactiva', tone: 'muted', soft: 'soft' } : ({
  Libre: { label: 'Disponible', tone: 'green', soft: 'greenSoft' },
  Ocupada: { label: 'Ocupada', tone: 'amber', soft: 'amberSoft' },
  Cuenta: { label: 'Por cobrar', tone: 'pink', soft: 'pinkSoft' },
  Reservada: { label: 'Reservada', tone: 'purple', soft: 'purpleSoft' },
}[table.estado] || { label: table.estado || 'Sin estado', tone: 'muted', soft: 'soft' });

export default function LocationsScreen({ onNavigate }) {
  const { c } = useTheme();
  const { ubicaciones, mesas, loading, createUbicacion, updateUbicacion, deleteUbicacion } = useAdmin();
  const [width, setWidth] = useState(0);
  const compact = width < 700;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', activo: true });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const zones = useMemo(() => ubicaciones.map(zone => {
    const tables = mesas.filter(t => Number(t.ubicacion_id) === Number(zone.id)).sort((a, b) => Number(a.numero) - Number(b.numero));
    const active = tables.filter(t => Number(t.activo) === 1);
    return { ...zone, tables, active, free: active.filter(t => t.estado === 'Libre').length, capacity: active.reduce((sum, t) => sum + Number(t.capacidad || 0), 0) };
  }), [ubicaciones, mesas]);
  const filtered = zones.filter(zone => (filter === 'all' || Number(zone.activo) === Number(filter)) && normalize(`${zone.nombre} ${zone.descripcion || ''}`).includes(normalize(query)));
  const current = dialog?.zone ? zones.find(z => z.id === dialog.zone.id) || dialog.zone : null;
  const unassigned = mesas.filter(t => Number(t.activo) === 1 && !ubicaciones.some(z => Number(z.id) === Number(t.ubicacion_id))).length;
  const card = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' };
  const open = (kind, zone = null) => {
    setError('');
    if (kind === 'edit') setForm({ nombre: zone?.nombre || '', descripcion: zone?.descripcion || '', activo: zone ? Number(zone.activo) === 1 : true });
    setDialog({ kind, zone });
  };
  const close = () => { if (!busyRef.current) { setDialog(null); setError(''); } };
  async function submit() {
    if (!dialog || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (dialog.kind === 'delete') {
        if (current.tables.length || Number(current.mesas_activas) > 0) throw new Error('Esta zona tiene mesas asignadas. Reasígnalas desde Mesas antes de eliminarla.');
        await deleteUbicacion(current.id);
        setNotice('Ubicación eliminada.');
      } else {
        const nombre = form.nombre.trim();
        if (!nombre) throw new Error('Escribe el nombre de la ubicación.');
        if (zones.some(z => Number(z.id) !== Number(current?.id) && Number(z.activo) === 1 && normalize(z.nombre) === normalize(nombre))) throw new Error('Ya existe una ubicación activa con ese nombre.');
        await (current ? updateUbicacion(current.id, { nombre, descripcion: form.descripcion.trim() || null, activo: form.activo ? 1 : 0 }) : createUbicacion({ nombre, descripcion: form.descripcion.trim() || null, activo: form.activo ? 1 : 0 }));
        setNotice(current ? 'Ubicación actualizada.' : 'Ubicación creada.');
      }
      setDialog(null);
    } catch (e) { setError(e.response?.data?.message || e.response?.data?.error || e.message || 'No se pudo completar la operación.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const badge = zone => <View style={[row, { alignSelf: 'flex-start', gap: 6, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 6, backgroundColor: Number(zone.activo) === 1 ? c.greenSoft : c.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Number(zone.activo) === 1 ? c.green : c.muted }} /><Text style={{ fontSize: 11, fontWeight: '600', color: Number(zone.activo) === 1 ? c.green : c.muted }}>{Number(zone.activo) === 1 ? 'Activa' : 'Inactiva'}</Text></View>;
  const tableChip = table => {
    const state = tableStatus(table);
    return <View key={table.id} accessibilityLabel={`Mesa ${table.numero}: ${state.label}`} style={[row, { paddingVertical: 7, paddingHorizontal: 9, borderRadius: 7, gap: 6, backgroundColor: c[state.soft] }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c[state.tone] }} /><Text style={{ color: c[state.tone], fontSize: 11, fontWeight: '600' }}>Mesa {table.numero}{Number(table.activo) !== 1 ? ' · inactiva' : ''}</Text></View>;
  };
  const zoneMetrics = zone => <View style={[row, { backgroundColor: c.surfaceAlt, paddingVertical: 13, borderRadius: 8 }]}>{[
    [LayoutGrid, zone.active.length, 'Mesas activas', c.text], [Armchair, zone.capacity, 'Sillas', c.text], [Check, zone.free, 'Disponibles', c.green],
  ].map(([Icon, value, label, color], index) => <View key={label} style={{ flex: 1, gap: 6, paddingHorizontal: 12, borderLeftWidth: index ? 1 : 0, borderColor: c.line }}><View style={[row, { gap: 6 }]}><Icon size={14} color={color} /><Text style={{ color, fontSize: 20, fontWeight: '600' }}>{value}</Text></View><Text style={{ color: c.muted, fontSize: 10 }}>{label}</Text></View>)}</View>;
  const title = dialog?.kind === 'detail' ? current?.nombre : dialog?.kind === 'delete' ? 'Eliminar ubicación' : current ? 'Editar ubicación' : 'Nueva ubicación';
  const cannotDelete = dialog?.kind === 'delete' && (current?.tables.length > 0 || Number(current?.mesas_activas) > 0);

  return <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
      <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }]}><View style={{ gap: 6, flexShrink: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>ORGANIZACIÓN DEL SALÓN</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 26 : 30, fontWeight: '700', letterSpacing: -0.6 }}>Ubicaciones</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>Cada zona, sus mesas y su capacidad.</Text></View><View style={[row, { gap: 8, flexWrap: 'wrap' }]}><MenuButton icon={LayoutGrid} onPress={() => onNavigate('mesas')}>Gestionar mesas</MenuButton><MenuButton primary icon={Plus} onPress={() => open('edit')}>Nueva ubicación</MenuButton></View></View>
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>{[
        [MapPin, zones.filter(z => Number(z.activo) === 1).length, 'Zonas activas', c.primaryText, c.primarySoft],
        [LayoutGrid, zones.reduce((n, z) => n + z.active.length, 0), 'Mesas activas asignadas', c.sky, c.skySoft],
        [Armchair, zones.reduce((n, z) => n + z.capacity, 0), 'Sillas en mesas activas', c.green, c.greenSoft],
      ].map(([Icon, value, label, color, soft]) => <View key={label} style={[card, row, { flexBasis: '30%', flexGrow: 1, padding: compact ? 10 : 14, gap: compact ? 8 : 12, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center' }]}><View style={{ padding: 10, backgroundColor: soft, borderRadius: 9 }}><Icon size={20} color={color} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.muted, fontSize: 11 }}>{label}</Text><Text style={{ color: c.text, fontSize: 24, fontWeight: '600' }}>{value}</Text></View></View>)}</View>
      {!!notice && <View style={[row, { padding: 10, backgroundColor: c.greenSoft, borderRadius: 8, gap: 8 }]}><Check size={17} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ color: c.green, flex: 1, fontSize: 12 }}>{notice}</Text><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice('')} /></View>}
      {unassigned > 0 && <View style={[row, { padding: 12, backgroundColor: c.primarySoft, borderRadius: 8, gap: 10, flexWrap: 'wrap' }]}><Text style={{ color: c.primaryText, flex: 1, minWidth: 160, fontSize: 12 }}>{unassigned} {unassigned === 1 ? 'mesa activa sin ubicación' : 'mesas activas sin ubicación'}. Puedes asignarlas desde Mesas.</Text><MenuButton onPress={() => onNavigate('mesas')} icon={ArrowRight}>Asignar mesas</MenuButton></View>}
      <View style={[card, { padding: 14, gap: 12 }]}><View style={[row, { gap: 10, flexWrap: 'wrap' }]}><View style={[row, { flexGrow: 1, flexBasis: 260, minWidth: 0, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, borderRadius: 8 }]}><Search size={18} color={c.muted} /><TextInput accessibilityLabel="Buscar ubicaciones" placeholder="Buscar zona o descripción…" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ flex: 1, minWidth: 0, minHeight: 44, color: c.text, fontSize: 13 }} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')} style={{ padding: 8 }}><X size={16} color={c.muted} /></Pressable>}</View><View style={[row, { gap: 6 }]}>{[['all', 'Todas'], ['1', 'Activas'], ['0', 'Inactivas']].map(([key, label]) => <MenuChip key={key} selected={filter === key} onPress={() => setFilter(key)}>{label}</MenuChip>)}</View></View><Text style={{ color: c.muted, fontSize: 12 }}>{filtered.length} de {zones.length} ubicaciones</Text></View>
      {loading && !zones.length ? <ActivityIndicator color={c.primary} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{filtered.map(zone => <View key={zone.id} style={[card, { width: compact ? '100%' : (width - 14) / 2 }]}>
        <View style={{ padding: 18, gap: 16, flex: 1 }}>
          <View style={[row, { gap: 10, alignItems: 'flex-start' }]}><View style={{ padding: 10, backgroundColor: c.primarySoft, borderRadius: 9 }}><MapPin size={21} color={c.primaryText} /></View><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontSize: 20, fontWeight: '600' }}>{zone.nombre}</Text><Text numberOfLines={2} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{zone.descripcion || 'Sin descripción de la zona.'}</Text></View>{badge(zone)}</View>
          {zoneMetrics(zone)}
          <View style={{ gap: 9 }}><Text style={{ color: c.faint, fontSize: 10, fontWeight: '600', letterSpacing: 0.8 }}>MESAS ASIGNADAS</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{zone.tables.slice(0, 6).map(tableChip)}{zone.tables.length > 6 && <Text style={{ color: c.muted, padding: 7, fontSize: 11 }}>+{zone.tables.length - 6} más</Text>}{!zone.tables.length && <Text style={{ color: c.muted, fontSize: 12, lineHeight: 20 }}>Aún no hay mesas en esta zona.</Text>}</View></View>
        </View>
        <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', padding: 12, borderTopWidth: 1, borderColor: c.line, gap: 8 }]}><MenuButton icon={LayoutGrid} label={`Ver mesas de ${zone.nombre}`} onPress={() => open('detail', zone)}>Ver mesas</MenuButton><View style={[row, { gap: 6 }]}><MenuButton icon={Edit3} label={`Editar ${zone.nombre}`} onPress={() => open('edit', zone)}>Editar</MenuButton><MenuButton icon={Trash2} label={`Eliminar ${zone.nombre}`} onPress={() => open('delete', zone)} /></View></View>
      </View>)}</View>}
      {!loading && !filtered.length && <View style={[card, { padding: 30, alignItems: 'center', gap: 12 }]}><MapPin size={32} color={c.muted} /><Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{zones.length ? 'No hay zonas con estos filtros' : 'Organiza tu primera zona'}</Text><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{zones.length ? 'Busca otro nombre o cambia el estado.' : 'Crea espacios como Salón, Terraza o Barra y asigna sus mesas.'}</Text><MenuButton onPress={zones.length ? () => { setQuery(''); setFilter('all'); } : () => open('edit')}>{zones.length ? 'Limpiar filtros' : 'Crear ubicación'}</MenuButton></View>}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'detail' ? 'Mesas asignadas y disponibilidad actual.' : dialog?.kind === 'delete' ? current?.nombre : 'Define una zona para organizar las mesas.'} close={close} busy={busy} maxWidth={620} footer={<View style={[row, { gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }]}><MenuButton disabled={busy} onPress={close}>{dialog?.kind === 'detail' ? 'Cerrar' : 'Cancelar'}</MenuButton>{dialog?.kind === 'detail' ? <MenuButton primary icon={ArrowRight} onPress={() => { close(); onNavigate('mesas'); }}>Gestionar mesas</MenuButton> : <MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={cannotDelete} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar ubicación' : 'Guardar ubicación'}</MenuButton>}</View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'detail' ? <>
        {zoneMetrics(current)}
        {!!current.descripcion && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{current.descripcion}</Text>}
        {current.tables.map(table => { const state = tableStatus(table); return <View key={table.id} style={[row, { gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }]}><LayoutGrid size={19} color={c.muted} /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Mesa {table.numero}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{table.capacidad} sillas</Text></View><Text style={{ color: c[state.tone], fontSize: 12 }}>{state.label}</Text></View>; })}
        {!current.tables.length && <MenuNotice>Esta ubicación no tiene mesas. Puedes asignarlas desde Gestionar mesas.</MenuNotice>}
      </> : dialog?.kind === 'delete' ? <MenuNotice>{cannotDelete ? 'Esta ubicación tiene mesas asignadas, incluidas las inactivas. Reasígnalas desde Mesas antes de eliminar la zona.' : 'Se eliminará permanentemente esta ubicación. Puedes cancelar y desactivarla desde Editar si quieres conservarla.'}</MenuNotice> : <>
        <MenuField label="Nombre de la ubicación" value={form.nombre} onChangeText={nombre => setForm(f => ({ ...f, nombre }))} editable={!busy} placeholder="Ej. Terraza" maxLength={80} />
        <MenuField label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} editable={!busy} placeholder="Ej. Área exterior junto al jardín" multiline maxLength={250} hint="Una referencia breve para el equipo. Opcional." />
        <View style={[row, { padding: 14, backgroundColor: c.surfaceAlt, borderRadius: 8, gap: 10 }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Ubicación activa</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Permite seleccionarla al asignar mesas.</Text></View><Switch accessibilityLabel="Ubicación activa" disabled={busy} value={form.activo} onValueChange={activo => setForm(f => ({ ...f, activo }))} trackColor={{ false: c.line, true: c.green }} /></View>
        {!form.activo && !!current?.tables.length && <MenuNotice>Desactivar la zona no desactiva ni desasigna sus mesas. Revisa su disponibilidad desde Mesas.</MenuNotice>}
        <View style={[row, { padding: 15, gap: 12, borderWidth: 1, borderColor: c.line, borderRadius: 8 }]}><MapPin size={24} color={c.primaryText} /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.faint, fontSize: 10 }}>VISTA PREVIA</Text><Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{form.nombre.trim() || 'Nombre de la zona'}</Text></View>{badge({ activo: form.activo ? 1 : 0 })}</View>
      </>}
    </MenuModal>
  </View>;
}
