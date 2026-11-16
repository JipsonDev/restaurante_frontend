import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Banknote, Check, ChefHat, Edit3, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Avatar, Button, DataTable, EmptyState, FadeIn, IconButton, PageHeader, SearchField, Segmented, Skeleton, Status, Switch as Toggle, Tabs, Tag as Pill, space, type, useToast } from '../components/admin/ui';
import { teamGroup, teamPayload } from '../utils/teamLogic.mjs';

const row = { flexDirection: 'row', alignItems: 'center' };
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const GROUPS = {
  administracion: { label: 'Administración', title: 'Administración y supervisión', icon: ShieldCheck, tone: 'purple', roles: ['admin', 'supervisor'], hint: 'Configuración, supervisión y control del negocio.' },
  mesero: { label: 'Meseros', title: 'Equipo de salón', icon: UserRound, tone: 'sky', roles: ['mesero'], hint: 'Mesas, pedidos y atención al cliente.' },
  cocina: { label: 'Cocina', title: 'Equipo de cocina', icon: ChefHat, tone: 'amber', roles: ['cocina'], hint: 'Preparación y actualización de comandas.' },
  caja: { label: 'Caja', title: 'Equipo de caja', icon: Banknote, tone: 'green', roles: ['caja'], hint: 'Cobros, turnos y movimientos de caja.' },
};
const ROLES = {
  admin: { label: 'Administrador', icon: ShieldCheck, group: 'administracion', hint: 'Acceso completo al panel, usuarios y configuración.' },
  supervisor: { label: 'Supervisor', icon: Users, group: 'administracion', hint: 'Supervisa la operación y autoriza acciones controladas.' },
  mesero: { label: 'Mesero', icon: UserRound, group: 'mesero', hint: 'Gestiona mesas, pedidos y entregas del salón.' },
  cocina: { label: 'Cocina', icon: ChefHat, group: 'cocina', hint: 'Recibe comandas y actualiza su preparación.' },
  caja: { label: 'Caja', icon: Banknote, group: 'caja', hint: 'Cobra cuentas y administra turnos de caja.' },
};
const emptyForm = () => ({ nombre: '', correo: '', password: '', pin: '', rol: 'mesero', activo: true, pin_configurado: false, clearPin: false });
const initials = name => String(name || 'U').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

export default function TeamScreen() {
  const { c } = useTheme();
  const { user } = useAuth();
  const { trabajadores, loading, createTrabajador, updateTrabajador, deleteTrabajador } = useAdmin();
  const [width, setWidth] = useState(0);
  const compact = width < 760;
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const toast = useToast();
  React.useEffect(() => { if (notice) { toast.show(notice); setNotice(''); } }, [notice]);
  const card = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' };
  const filtered = useMemo(() => trabajadores.filter(worker =>
    (groupFilter === 'all' || teamGroup(worker.rol) === groupFilter) &&
    (statusFilter === 'all' || Number(worker.activo) === Number(statusFilter)) &&
    normalize(`${worker.nombre} ${worker.correo} ${ROLES[worker.rol]?.label || worker.rol}`).includes(normalize(query))
  ), [trabajadores, groupFilter, statusFilter, query]);
  const activeCount = trabajadores.filter(worker => Number(worker.activo) === 1).length;
  const pinCount = trabajadores.filter(worker => Number(worker.pin_configurado) === 1).length;
  const current = dialog?.worker ? trabajadores.find(worker => Number(worker.id) === Number(dialog.worker.id)) || dialog.worker : null;
  const isSelf = current && Number(current.id) === Number(user?.id);
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const close = () => { if (!busyRef.current) { setDialog(null); setError(''); } };
  const open = (kind, worker = null, defaultRole = 'mesero') => {
    setError('');
    if (kind === 'edit') setForm(worker ? {
      nombre: worker.nombre || '', correo: worker.correo || '', password: '', pin: '', rol: worker.rol || 'mesero', activo: Number(worker.activo) === 1,
      pin_configurado: Number(worker.pin_configurado) === 1, clearPin: false,
    } : { ...emptyForm(), rol: defaultRole });
    setDialog({ kind, worker });
  };
  async function submit() {
    if (!dialog || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (dialog.kind === 'delete') {
        if (isSelf) throw new Error('No puedes eliminar tu propio usuario mientras estás conectado.');
        await deleteTrabajador(current.id);
        setNotice('Usuario eliminado.');
      } else {
        const payload = teamPayload(form, { editing: !!current, workers: trabajadores, workerId: current?.id, currentUserId: user?.id });
        if (current) await updateTrabajador(current.id, payload);
        else await createTrabajador(payload);
        setNotice(current ? 'Usuario actualizado.' : 'Usuario creado y listo para iniciar sesión.');
      }
      setDialog(null);
    } catch (e) { setError(e.response?.data?.message || e.response?.data?.error || e.message || 'No se pudo completar la operación.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const roleBadge = worker => {
    const role = ROLES[worker.rol] || ROLES.mesero;
    const group = GROUPS[role.group];
    return <Pill tone="neutral">{role.label}</Pill>;
  };
  const statusBadge = worker => <View style={[row, { gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: Number(worker.activo) === 1 ? c.greenSoft : c.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Number(worker.activo) === 1 ? c.green : c.muted }} /><Text style={{ color: Number(worker.activo) === 1 ? c.green : c.muted, fontSize: 10, fontWeight: '600' }}>{Number(worker.activo) === 1 ? 'Activo' : 'Inactivo'}</Text></View>;
  const accessBadge = worker => <View style={[row, { gap: 5 }]}><KeyRound size={13} color={Number(worker.pin_configurado) === 1 ? c.sky : c.faint} /><Text style={{ color: Number(worker.pin_configurado) === 1 ? c.sky : c.muted, fontSize: 11, fontWeight: '600' }}>{Number(worker.pin_configurado) === 1 ? 'PIN configurado' : 'Solo contraseña'}</Text></View>;
  const actions = worker => <View style={[row, { gap: 2, justifyContent: 'flex-end' }]}><IconButton icon={Edit3} label={`Editar ${worker.nombre}`} onPress={() => open('edit', worker)} /><IconButton icon={Trash2} tone="danger" label={`Eliminar ${worker.nombre}`} disabled={Number(worker.id) === Number(user?.id)} onPress={() => open('delete', worker)} /></View>;
  const identity = worker => <View style={[row, { gap: 10, minWidth: 0 }]}><View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 12 }}>{initials(worker.nombre)}</Text></View><View style={{ flex: 1, minWidth: 0, gap: 3 }}><View style={[row, { gap: 6 }]}><Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{worker.nombre}</Text>{Number(worker.id) === Number(user?.id) && <Text style={{ color: c.primaryText, fontSize: 9, fontWeight: '700' }}>TÚ</Text>}</View><Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{worker.correo}</Text></View></View>;
  const mobileWorker = worker => <View key={worker.id} style={{ padding: 13, borderTopWidth: 1, borderColor: c.line, gap: 11 }}><View style={[row, { gap: 10 }]}><View style={{ flex: 1 }}>{identity(worker)}</View>{statusBadge(worker)}</View><View style={[row, { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }]}><View style={[row, { gap: 7, flexWrap: 'wrap' }]}>{roleBadge(worker)}{accessBadge(worker)}</View>{actions(worker)}</View></View>;
  const selectedGroup = groupFilter === 'all' ? null : GROUPS[groupFilter];
  const title = dialog?.kind === 'delete' ? 'Eliminar usuario' : current ? 'Editar usuario' : 'Nuevo usuario';

  return <View style={{ flex: 1 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Equipo" description={`${activeCount} personas activas · ${pinCount} con PIN rápido`}
        actions={<Button variant="primary" icon={Plus} onPress={() => open('edit', null, groupFilter !== 'all' ? GROUPS[groupFilter].roles[0] : 'mesero')}>Nuevo usuario</Button>} />
      <Tabs value={groupFilter} onChange={setGroupFilter} style={{ marginBottom: space.lg }}
        options={[{ value: 'all', label: 'Todo el equipo', count: trabajadores.length }, ...Object.entries(GROUPS).map(([key, g]) => ({ value: key, label: g.label, count: trabajadores.filter(w => teamGroup(w.rol) === key).length }))]} />
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md, marginBottom: space.lg, alignItems: compact ? 'stretch' : 'center' }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por nombre o correo…" style={compact ? null : { flex: 1, minWidth: 260, maxWidth: 380 }} />
        <Segmented size="sm" value={statusFilter} onChange={setStatusFilter} accessibilityLabel="Estado" options={[{ value: 'all', label: 'Todos' }, { value: '1', label: 'Activos' }, { value: '0', label: 'Inactivos' }]} />
        {selectedGroup ? <Text style={[type.small, { color: c.faint, flex: 1 }]}>{selectedGroup.hint}</Text> : null}
      </View>
      {loading && !trabajadores.length ? <View style={{ gap: space.sm }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={60} radius={10} />)}</View>
        : <FadeIn trigger={`${groupFilter}-${statusFilter}`} duration={180} offset={4}><DataTable selectedKey={dialog?.worker?.id} rows={filtered} onRowPress={w => open('edit', w)}
          columns={compact ? [
            { key: 'p', label: 'Persona', flex: 1, render: w => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}><Avatar name={w.nombre} size={36} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{w.nombre}{Number(w.id) === Number(user?.id) ? <Text style={{ color: c.faint, fontWeight: '400' }}> · tú</Text> : null}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>{roleBadge(w)}<Status tone={Number(w.activo) === 1 ? 'green' : 'neutral'}>{Number(w.activo) === 1 ? 'Activo' : 'Inactivo'}</Status></View></View></View> },
          ] : [
            { key: 'p', label: 'Persona', flex: 2.4, sortValue: w => w.nombre, render: w => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}><Avatar name={w.nombre} size={36} />
              <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{w.nombre}{Number(w.id) === Number(user?.id) ? <Text style={{ color: c.faint, fontWeight: '400' }}> · tú</Text> : null}</Text>
                <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{w.correo}</Text></View></View> },
            { key: 'r', label: 'Rol', flex: 1.2, sortValue: w => w.rol, render: w => roleBadge(w) },
            { key: 'a', label: 'Acceso', flex: 1.2, render: w => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><KeyRound size={14} color={Number(w.pin_configurado) === 1 ? c.text : c.faint} /><Text style={[type.small, { color: Number(w.pin_configurado) === 1 ? c.text : c.faint }]}>{Number(w.pin_configurado) === 1 ? 'PIN y contraseña' : 'Solo contraseña'}</Text></View> },
            { key: 's', label: 'Estado', width: 100, render: w => <Status tone={Number(w.activo) === 1 ? 'green' : 'neutral'}>{Number(w.activo) === 1 ? 'Activo' : 'Inactivo'}</Status> },
            { key: 'x', label: '', width: 84, actions: true, align: 'right', render: w => actions(w) },
          ]}
          empty={<EmptyState icon={Users} title="No hay personas en esta vista" description={trabajadores.length ? 'Cambia los filtros o la búsqueda.' : 'Crea el primer usuario para comenzar.'}
            action={<Button onPress={trabajadores.length ? () => { setQuery(''); setStatusFilter('all'); setGroupFilter('all'); } : () => open('edit')}>{trabajadores.length ? 'Quitar filtros' : 'Crear usuario'}</Button>} />} /></FadeIn>}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'delete' ? current?.nombre : current ? 'Actualiza sus datos, acceso y responsabilidades.' : 'Crea el acceso y asigna las responsabilidades del puesto.'} close={close} busy={busy} maxWidth={690} footer={<View style={[row, { justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={dialog?.kind === 'delete' && isSelf} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar usuario' : 'Guardar usuario'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>{isSelf ? 'No puedes eliminar el usuario con el que estás conectado.' : 'Si tiene pedidos o turnos de caja, el sistema conserva su historial y te pedirá desactivarlo en lugar de borrarlo.'}</MenuNotice> : <>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label="Nombre completo" value={form.nombre} onChangeText={value => change('nombre', value)} editable={!busy} placeholder="Ej. María González" maxLength={120} /><MenuField containerStyle={{ flex: 1 }} label="Correo de acceso" value={form.correo} onChangeText={value => change('correo', value)} editable={!busy} placeholder="nombre@cafeteria.com" autoCapitalize="none" keyboardType="email-address" maxLength={160} /></View>
        <View style={{ gap: 9 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Área y permisos</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(ROLES).map(([key, role]) => <MenuButton key={key} icon={role.icon} disabled={busy || (isSelf && key !== 'admin')} onPress={() => change('rol', key)} style={form.rol === key ? { backgroundColor: c.primarySoft, borderColor: c.primary } : null}>{role.label}</MenuButton>)}</View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ROLES[form.rol]?.hint}</Text></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label={current ? 'Nueva contraseña' : 'Contraseña'} hint={current ? 'Déjala vacía para conservar la actual.' : 'Mínimo 6 caracteres.'} value={form.password} onChangeText={value => change('password', value)} editable={!busy} secureTextEntry placeholder={current ? 'Sin cambios' : 'Crear contraseña'} /><MenuField containerStyle={{ flex: 1 }} label="PIN rápido" hint={form.pin_configurado && !form.clearPin ? 'Déjalo vacío para conservar el actual.' : 'Opcional · exactamente 4 dígitos.'} value={form.pin} onChangeText={value => change('pin', value.replace(/\D/g, '').slice(0, 4))} editable={!busy && !form.clearPin} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder={form.pin_configurado ? 'PIN configurado' : 'Ej. 1234'} /></View>
        {current && form.pin_configurado && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.clearPin }} disabled={busy} onPress={() => setForm(previous => ({ ...previous, clearPin: !previous.clearPin, pin: '' }))} style={[row, { alignSelf: 'flex-start', gap: 8 }]}><View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: form.clearPin ? c.red : c.line, backgroundColor: form.clearPin ? c.redSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>{form.clearPin && <X size={13} color={c.red} />}</View><Text style={{ color: form.clearPin ? c.red : c.muted, fontSize: 12 }}>Eliminar el PIN rápido actual</Text></Pressable>}
        <View style={[row, { padding: 14, backgroundColor: c.surfaceAlt, borderRadius: 8, gap: 10 }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Usuario activo</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{isSelf ? 'Tu sesión de administrador debe permanecer activa.' : 'Puede iniciar sesión y usar su módulo asignado.'}</Text></View><Toggle label="Usuario activo" showLabel={false} value={form.activo} onValueChange={value => change('activo', value)} /></View>
        <View style={[row, { borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 14, gap: 11 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>{initials(form.nombre)}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.faint, fontSize: 10 }}>VISTA PREVIA</Text><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{form.nombre.trim() || 'Nombre del trabajador'}</Text><View style={[row, { gap: 6 }]}><Mail size={12} color={c.muted} /><Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, flex: 1 }}>{form.correo.trim().toLowerCase() || 'correo@cafeteria.com'}</Text></View></View>{roleBadge({ rol: form.rol })}</View>
      </>}
    </MenuModal>
  </View>;
}
