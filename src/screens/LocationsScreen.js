import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Armchair, ArrowRight, Check, Edit3, LayoutGrid, MapPin, Plus, Search, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Button, DataTable, EmptyState, IconButton, PageHeader, SearchField, Segmented, Skeleton, Status, Switch as Toggle, space, type, useToast } from '../components/admin/ui';

const row = { flexDirection: 'row', alignItems: 'center' };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const tableStatus = table => Number(table.activo) !== 1 ? { label: 'Inactiva', tone: 'muted', soft: 'soft' } : ({
  Libre: { label: 'Disponible', tone: 'green', soft: 'greenSoft' },
  Ocupada: { label: 'Ocupada', tone: 'amber', soft: 'amberSoft' },
  Cuenta: { label: 'Por cobrar', tone: 'red', soft: 'redSoft' },
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
  const toast = useToast();
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
        toast.show('Ubicación eliminada.');
      } else {
        const nombre = form.nombre.trim();
        if (!nombre) throw new Error('Escribe el nombre de la ubicación.');
        if (zones.some(z => Number(z.id) !== Number(current?.id) && Number(z.activo) === 1 && normalize(z.nombre) === normalize(nombre))) throw new Error('Ya existe una ubicación activa con ese nombre.');
        await (current ? updateUbicacion(current.id, { nombre, descripcion: form.descripcion.trim() || null, activo: form.activo ? 1 : 0 }) : createUbicacion({ nombre, descripcion: form.descripcion.trim() || null, activo: form.activo ? 1 : 0 }));
        toast.show(current ? 'Ubicación actualizada.' : 'Ubicación creada.');
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
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Ubicaciones" description={`${zones.filter(z => Number(z.activo) === 1).length} zonas activas · ${zones.reduce((n, z) => n + z.active.length, 0)} mesas · ${zones.reduce((n, z) => n + z.capacity, 0)} sillas`}
        actions={<><Button icon={LayoutGrid} onPress={() => onNavigate('mesas')}>Ir a mesas</Button><Button variant="primary" icon={Plus} onPress={() => open('edit')}>Nueva ubicación</Button></>} />
      {unassigned > 0 && <View style={{ marginBottom: space.lg }}><MenuNotice>{`${unassigned} ${unassigned === 1 ? 'mesa activa no tiene zona' : 'mesas activas no tienen zona'}. Asígnalas desde Mesas para verlas agrupadas.`}</MenuNotice></View>}
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md, marginBottom: space.lg }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar zona…" style={compact ? null : { flex: 1, maxWidth: 360 }} />
        <Segmented size="sm" value={filter} onChange={setFilter} accessibilityLabel="Estado" options={[{ value: 'all', label: 'Todas' }, { value: '1', label: 'Activas' }, { value: '0', label: 'Inactivas' }]} style={{ alignSelf: compact ? 'flex-start' : 'center' }} />
      </View>
      {loading && !zones.length ? <View style={{ gap: space.sm }}>{[0, 1, 2].map(i => <Skeleton key={i} height={64} radius={10} />)}</View>
        : <DataTable rows={filtered} onRowPress={zone => open('detail', zone)}
          columns={compact ? [
            { key: 'z', label: 'Zona', flex: 1, render: z => <View style={{ gap: 4 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{z.nombre}</Text><Text style={[type.micro, type.num, { color: c.faint }]}>{z.active.length} mesas · {z.capacity} sillas · {z.free} libres</Text></View> },
            { key: 'a', label: '', width: 84, actions: true, align: 'right', render: z => <View style={{ flexDirection: 'row' }}><IconButton icon={Edit3} label={`Editar ${z.nombre}`} onPress={() => open('edit', z)} /><IconButton icon={Trash2} tone="danger" label={`Eliminar ${z.nombre}`} onPress={() => open('delete', z)} /></View> },
          ] : [
            { key: 'z', label: 'Zona', flex: 2, sortValue: z => z.nombre, render: z => <View style={{ gap: 2, minWidth: 0 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{z.nombre}</Text><Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{z.descripcion || 'Sin descripción'}</Text></View> },
            { key: 't', label: 'Mesas', flex: 2.4, render: z => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{z.tables.slice(0, 10).map(t => { const st = tableStatus(t); return <View key={t.id} accessibilityLabel={`Mesa ${t.numero}: ${st.label}`} {...({ title: `Mesa ${t.numero} · ${st.label}` })} style={{ minWidth: 28, height: 24, paddingHorizontal: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: t.estado === 'Libre' && Number(t.activo) === 1 ? c.surfaceAlt : c[st.soft], borderWidth: 1, borderColor: c.line }}><Text style={[type.micro, type.num, { color: t.estado === 'Libre' ? c.muted : c[st.tone], fontWeight: '600' }]}>{t.numero}</Text></View>; })}{z.tables.length > 10 ? <Text style={[type.micro, { color: c.faint, alignSelf: 'center' }]}>+{z.tables.length - 10}</Text> : null}{!z.tables.length ? <Text style={[type.micro, { color: c.faint }]}>Sin mesas</Text> : null}</View> },
            { key: 'c', label: 'Sillas', width: 70, sortValue: z => z.capacity, align: 'right', render: z => <Text style={[type.body, type.num, { color: c.text }]}>{z.capacity}</Text> },
            { key: 'f', label: 'Libres', width: 70, sortValue: z => z.free, align: 'right', render: z => <Text style={[type.body, type.num, { color: z.free ? c.green : c.faint }]}>{z.free}</Text> },
            { key: 's', label: 'Estado', width: 96, render: z => <Status tone={Number(z.activo) === 1 ? 'green' : 'neutral'}>{Number(z.activo) === 1 ? 'Activa' : 'Inactiva'}</Status> },
            { key: 'a', label: '', width: 84, actions: true, align: 'right', render: z => <View style={{ flexDirection: 'row' }}><IconButton icon={Edit3} label={`Editar ${z.nombre}`} onPress={() => open('edit', z)} /><IconButton icon={Trash2} tone="danger" label={`Eliminar ${z.nombre}`} onPress={() => open('delete', z)} /></View> },
          ]}
          empty={<EmptyState icon={MapPin} title={zones.length ? 'Ninguna zona coincide' : 'Organiza tu primera zona'} description={zones.length ? 'Busca otro nombre o cambia el estado.' : 'Crea espacios como Salón, Terraza o Barra y asigna sus mesas.'} action={!zones.length ? <Button variant="primary" icon={Plus} onPress={() => open('edit')}>Nueva ubicación</Button> : null} />} />}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'detail' ? 'Mesas asignadas y disponibilidad actual.' : dialog?.kind === 'delete' ? current?.nombre : 'Define una zona para organizar las mesas.'} close={close} busy={busy} maxWidth={620} footer={<View style={[row, { gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }]}><MenuButton disabled={busy} onPress={close}>{dialog?.kind === 'detail' ? 'Cerrar' : 'Cancelar'}</MenuButton>{dialog?.kind === 'detail' ? <MenuButton primary icon={ArrowRight} onPress={() => { close(); onNavigate('mesas'); }}>Gestionar mesas</MenuButton> : <MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={cannotDelete} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar ubicación' : 'Guardar ubicación'}</MenuButton>}</View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'detail' ? <>
        {zoneMetrics(current)}
        {!!current.descripcion && <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{current.descripcion}</Text>}
        {current.tables.map(table => { const state = tableStatus(table); return <View key={table.id} style={[row, { gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }]}><LayoutGrid size={19} color={c.muted} /><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Mesa {table.numero}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{table.capacidad} sillas</Text></View><Text style={{ color: c[state.tone], fontSize: 12 }}>{state.label}</Text></View>; })}
        {!current.tables.length && <MenuNotice>Esta ubicación no tiene mesas. Puedes asignarlas desde Gestionar mesas.</MenuNotice>}
      </> : dialog?.kind === 'delete' ? <MenuNotice>{cannotDelete ? 'Esta ubicación tiene mesas asignadas, incluidas las inactivas. Reasígnalas desde Mesas antes de eliminar la zona.' : 'Si solo quieres dejar de usarla, desactívala desde Editar.'}</MenuNotice> : <>
        <MenuField label="Nombre de la ubicación" value={form.nombre} onChangeText={nombre => setForm(f => ({ ...f, nombre }))} editable={!busy} placeholder="Ej. Terraza" maxLength={80} />
        <MenuField label="Descripción" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} editable={!busy} placeholder="Ej. Área exterior junto al jardín" multiline maxLength={250} hint="Una referencia breve para el equipo. Opcional." />
        <View style={[row, { padding: 14, backgroundColor: c.surfaceAlt, borderRadius: 8, gap: 10 }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Ubicación activa</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Permite seleccionarla al asignar mesas.</Text></View><Toggle label="Ubicación activa" showLabel={false} disabled={busy} value={form.activo} onValueChange={activo => setForm(f => ({ ...f, activo }))} /></View>
        {!form.activo && !!current?.tables.length && <MenuNotice>Desactivar la zona no desactiva ni desasigna sus mesas. Revisa su disponibilidad desde Mesas.</MenuNotice>}
        <View style={[row, { padding: 15, gap: 12, borderWidth: 1, borderColor: c.line, borderRadius: 8 }]}><MapPin size={24} color={c.primaryText} /><View style={{ flex: 1, gap: 5 }}><Text style={[type.micro, { color: c.faint }]}>Vista previa</Text><Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{form.nombre.trim() || 'Nombre de la zona'}</Text></View>{badge({ activo: form.activo ? 1 : 0 })}</View>
      </>}
    </MenuModal>
  </View>;
}
