import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ArrowRight, Edit3, LayoutGrid, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { ActionMenu, Badge, Banner, Button, DataTable, EmptyState, PageHeader, SearchField, Skeleton, Switch as Toggle, Tabs, radius, space, type, useToast } from '../components/admin/ui';

const row = { flexDirection: 'row', alignItems: 'center' };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const tableStatus = table => Number(table.activo) !== 1 ? { label: 'Inactiva', tone: 'neutral' } : ({
  Libre: { label: 'Disponible', tone: 'green' },
  Ocupada: { label: 'Ocupada', tone: 'sky' },
  Cuenta: { label: 'Pidió la cuenta', tone: 'amber' },
  Reservada: { label: 'Reservada', tone: 'purple' },
}[table.estado] || { label: table.estado || 'Sin estado', tone: 'neutral' });

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
  async function bulkActive(rows, activo) {
    const targets = rows.filter(z => Number(z.activo) !== activo);
    if (!targets.length) { toast.show(activo ? 'Las zonas elegidas ya están activas.' : 'Las zonas elegidas ya están inactivas.', 'neutral'); return; }
    try {
      for (const z of targets) await updateUbicacion(z.id, { activo });
      toast.show(`${targets.length} ${targets.length === 1 ? 'zona' : 'zonas'} ${activo ? 'activadas' : 'desactivadas'}.`);
    } catch (e) { toast.show(e.response?.data?.message || e.message || 'No se pudo actualizar.', 'red'); }
  }
  const title = dialog?.kind === 'detail' ? current?.nombre : dialog?.kind === 'delete' ? `¿Eliminar ${current?.nombre}?` : current ? 'Editar ubicación' : 'Nueva ubicación';
  const cannotDelete = dialog?.kind === 'delete' && (current?.tables.length > 0 || Number(current?.mesas_activas) > 0);
  const tableDots = z => z.tables.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{z.tables.slice(0, 12).map(t => { const st = tableStatus(t);
      return <View key={t.id} accessibilityLabel={`Mesa ${t.numero}: ${st.label}`} {...({ title: `Mesa ${t.numero} · ${st.label}` })}
        style={{ minWidth: 26, height: 22, paddingHorizontal: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line, backgroundColor: Number(t.activo) === 1 ? c.surface : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type.small, type.num, { color: Number(t.activo) === 1 ? c.text : c.faint }]}>{t.numero}</Text></View>; })}
      {z.tables.length > 12 ? <Text style={[type.small, { color: c.muted, alignSelf: 'center' }]}>+{z.tables.length - 12}</Text> : null}
    </View> : <Text style={[type.body, { color: c.faint }]}>Sin mesas</Text>;
  const menu = z => <ActionMenu label={`Acciones de ${z.nombre}`} actions={[
    { label: 'Ver mesas', icon: LayoutGrid, onPress: () => open('detail', z) },
    { label: 'Editar', icon: Edit3, onPress: () => open('edit', z) },
    { divider: true },
    { label: 'Eliminar', icon: Trash2, tone: 'danger', onPress: () => open('delete', z) },
  ]} />;
  const activeCount = zones.filter(z => Number(z.activo) === 1).length;

  return <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Ubicaciones" description={`${activeCount} zonas activas · ${zones.reduce((n, z) => n + z.active.length, 0)} mesas · ${zones.reduce((n, z) => n + z.capacity, 0)} sillas`}
        actions={<><Button onPress={() => onNavigate('mesas')}>Ir a mesas</Button><Button variant="primary" onPress={() => open('edit')}>Agregar ubicación</Button></>} />
      {unassigned > 0 && <Banner tone="warning" style={{ marginBottom: space.lg }} action={<Button size="sm" onPress={() => onNavigate('mesas')}>Asignar en Mesas</Button>}>
        {`${unassigned} ${unassigned === 1 ? 'mesa activa no tiene zona' : 'mesas activas no tienen zona'} y no aparece agrupada en el salón.`}
      </Banner>}
      {loading && !zones.length ? <View style={{ gap: space.sm }}>{[0, 1, 2].map(i => <Skeleton key={i} height={52} radius={10} />)}</View>
        : <DataTable rows={filtered} onRowPress={zone => open('detail', zone)} selectable={!compact}
          bulkActions={[{ label: 'Activar', onPress: rows => bulkActive(rows, 1) }, { label: 'Desactivar', onPress: rows => bulkActive(rows, 0) }]}
          toolbar={<View style={{ padding: space.sm, gap: space.sm }}>
            <Tabs value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas', count: zones.length }, { value: '1', label: 'Activas', count: activeCount }, { value: '0', label: 'Inactivas', count: zones.length - activeCount }]} />
            <SearchField value={query} onChangeText={setQuery} placeholder="Buscar zona" style={compact ? null : { maxWidth: 360 }} />
          </View>}
          columns={compact ? [
            { key: 'z', label: 'Zona', flex: 1, render: z => <View style={{ gap: 2, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{z.nombre}</Text>{Number(z.activo) !== 1 ? <Badge>Inactiva</Badge> : null}</View>
              <Text style={[type.body, type.num, { color: c.muted }]}>{z.active.length} mesas · {z.capacity} sillas · {z.free} libres</Text></View> },
            { key: 'a', label: '', width: 40, align: 'right', render: menu },
          ] : [
            { key: 'z', label: 'Zona', flex: 2, sortValue: z => z.nombre, render: z => <View style={{ minWidth: 0 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{z.nombre}</Text><Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{z.descripcion || 'Sin descripción'}</Text></View> },
            { key: 't', label: 'Mesas', flex: 2.4, render: tableDots },
            { key: 'c', label: 'Sillas', width: 64, sortValue: z => z.capacity, align: 'right', render: z => <Text style={[type.body, type.num, { color: c.text }]}>{z.capacity}</Text> },
            { key: 'f', label: 'Libres ahora', width: 96, sortValue: z => z.free, align: 'right', render: z => <Text style={[type.body, type.num, { color: c.text }]}>{z.free}</Text> },
            { key: 's', label: 'Estado', width: 96, render: z => <Badge tone={Number(z.activo) === 1 ? 'green' : 'neutral'}>{Number(z.activo) === 1 ? 'Activa' : 'Inactiva'}</Badge> },
            { key: 'a', label: '', width: 40, align: 'right', render: menu },
          ]}
          empty={<EmptyState icon={MapPin} title={zones.length ? 'Ninguna zona coincide' : 'Organiza tu primera zona'} description={zones.length ? 'Busca otro nombre o cambia el estado.' : 'Crea espacios como Salón, Terraza o Barra y asigna sus mesas.'}
            action={!zones.length ? <Button variant="primary" icon={Plus} onPress={() => open('edit')}>Crear ubicación</Button> : <Button onPress={() => { setQuery(''); setFilter('all'); }}>Quitar filtros</Button>} />} />}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} tone={dialog?.kind === 'delete' ? 'danger' : 'default'}
      subtitle={dialog?.kind === 'detail' ? current?.descripcion || `${current?.active.length || 0} mesas activas · ${current?.capacity || 0} sillas` : dialog?.kind === 'delete' ? (cannotDelete ? 'Esta ubicación tiene mesas asignadas, incluidas las inactivas. Reasígnalas desde Mesas antes de eliminarla.' : 'Se eliminará la zona. Si solo quieres dejar de usarla, desactívala desde Editar.') : null}
      close={close} busy={busy} maxWidth={dialog?.kind === 'detail' ? 560 : 520}
      footer={<View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <MenuButton disabled={busy} onPress={close}>{dialog?.kind === 'detail' ? 'Cerrar' : 'Cancelar'}</MenuButton>
        {dialog?.kind === 'detail' ? <MenuButton primary icon={ArrowRight} onPress={() => { close(); onNavigate('mesas'); }}>Gestionar mesas</MenuButton>
          : <MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={cannotDelete} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar ubicación' : current ? 'Guardar' : 'Crear ubicación'}</MenuButton>}
      </View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'detail' ? (current.tables.length ? <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.md, overflow: 'hidden' }}>
          {current.tables.map((table, i) => { const state = tableStatus(table); return <View key={table.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Text style={[type.body, type.num, { color: c.text, fontWeight: '600', flex: 1 }]}>Mesa {table.numero}</Text>
            <Text style={[type.body, type.num, { color: c.muted }]}>{table.capacidad} sillas</Text>
            <Badge tone={state.tone}>{state.label}</Badge>
          </View>; })}
        </View> : <Banner tone="info">Esta ubicación no tiene mesas. Asígnalas desde Mesas.</Banner>)
      : dialog?.kind === 'delete' ? null : <>
        <MenuField label="Nombre" value={form.nombre} onChangeText={nombre => setForm(f => ({ ...f, nombre }))} editable={!busy} placeholder="Ej. Terraza" maxLength={80} />
        <MenuField label="Descripción (opcional)" value={form.descripcion} onChangeText={descripcion => setForm(f => ({ ...f, descripcion }))} editable={!busy} placeholder="Ej. Área exterior junto al jardín" multiline maxLength={250} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.line }}>
          <View style={{ flex: 1 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>Ubicación activa</Text><Text style={[type.body, { color: c.muted }]}>Se puede elegir al asignar mesas.</Text></View>
          <Toggle label="Ubicación activa" showLabel={false} disabled={busy} value={form.activo} onValueChange={activo => setForm(f => ({ ...f, activo }))} />
        </View>
        {!form.activo && !!current?.tables.length && <MenuNotice>Desactivar la zona no desactiva ni desasigna sus mesas.</MenuNotice>}
      </>}
    </MenuModal>
  </View>;
}
