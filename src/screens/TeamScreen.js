import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Banknote, Check, ChefHat, Edit3, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { ActionMenu, Avatar, Badge, Banner, Button, Checkbox, DataTable, EmptyState, FadeIn, PageHeader, SearchField, Segmented, Skeleton, Switch as Toggle, Tabs, space, type, useToast } from '../components/admin/ui';
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
  const roleLabel = worker => (ROLES[worker.rol] || ROLES.mesero).label;
  const isMe = w => Number(w.id) === Number(user?.id);
  async function bulkActive(rows, activo) {
    const targets = rows.filter(w => Number(w.activo) !== activo && !(activo === 0 && isMe(w)));
    if (!targets.length) { toast.show(activo ? 'Las personas elegidas ya están activas.' : 'No hay personas que desactivar (tu propio usuario no se puede desactivar).', 'neutral'); return; }
    try {
      for (const w of targets) await updateTrabajador(w.id, { activo });
      toast.show(`${targets.length} ${targets.length === 1 ? 'usuario' : 'usuarios'} ${activo ? 'activados' : 'desactivados'}.`);
    } catch (e) { toast.show(e.response?.data?.message || e.message || 'No se pudo actualizar.', 'red'); }
  }
  const menu = w => <ActionMenu label={`Acciones de ${w.nombre}`} actions={[
    { label: 'Editar', icon: Edit3, onPress: () => open('edit', w) },
    { label: Number(w.activo) === 1 ? 'Desactivar' : 'Activar', icon: UserRound, disabled: isMe(w), onPress: () => bulkActive([w], Number(w.activo) === 1 ? 0 : 1) },
    { divider: true },
    { label: 'Eliminar', icon: Trash2, tone: 'danger', disabled: isMe(w), onPress: () => open('delete', w) },
  ]} />;
  const person = (w, sub) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}><Avatar name={w.nombre} size={32} />
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{w.nombre}{isMe(w) ? <Text style={{ color: c.muted, fontWeight: '400' }}> (tú)</Text> : null}</Text>
      {sub}
    </View></View>;
  const title = dialog?.kind === 'delete' ? `¿Eliminar a ${current?.nombre}?` : current ? 'Editar usuario' : 'Nuevo usuario';

  return <View style={{ flex: 1 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Equipo" description={`${activeCount} personas activas · ${pinCount} con PIN rápido`}
        actions={<Button variant="primary" onPress={() => open('edit', null, groupFilter !== 'all' ? GROUPS[groupFilter].roles[0] : 'mesero')}>Agregar usuario</Button>} />
      {loading && !trabajadores.length ? <View style={{ gap: space.sm }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={52} radius={10} />)}</View>
        : <DataTable selectedKey={dialog?.worker?.id} rows={filtered} onRowPress={w => open('edit', w)} selectable={!compact}
          bulkActions={[{ label: 'Activar', onPress: rows => bulkActive(rows, 1) }, { label: 'Desactivar', onPress: rows => bulkActive(rows, 0) }]}
          toolbar={<View style={{ padding: space.sm, gap: space.sm }}>
            <Tabs value={groupFilter} onChange={setGroupFilter}
              options={[{ value: 'all', label: 'Todos', count: trabajadores.length }, ...Object.entries(GROUPS).map(([key, g]) => ({ value: key, label: g.label, count: trabajadores.filter(w => teamGroup(w.rol) === key).length }))]} />
            <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.sm, alignItems: compact ? 'stretch' : 'center' }}>
              <SearchField value={query} onChangeText={setQuery} placeholder="Buscar por nombre o correo" style={compact ? null : { flex: 1, maxWidth: 360 }} />
              <Segmented value={statusFilter} onChange={setStatusFilter} accessibilityLabel="Estado" options={[{ value: 'all', label: 'Todos' }, { value: '1', label: 'Activos' }, { value: '0', label: 'Inactivos' }]} />
            </View>
          </View>}
          columns={compact ? [
            { key: 'p', label: 'Persona', flex: 1, render: w => person(w, <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}><Badge>{roleLabel(w)}</Badge>{Number(w.activo) !== 1 ? <Badge>Inactivo</Badge> : null}</View>) },
            { key: 'x', label: '', width: 40, align: 'right', render: menu },
          ] : [
            { key: 'p', label: 'Persona', flex: 2.4, sortValue: w => w.nombre, render: w => person(w, <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{w.correo}</Text>) },
            { key: 'r', label: 'Rol', flex: 1.1, sortValue: w => roleLabel(w), render: w => <Text style={[type.body, { color: c.text }]}>{roleLabel(w)}</Text> },
            { key: 'a', label: 'Acceso', flex: 1.2, sortValue: w => Number(w.pin_configurado), render: w => <Text style={[type.body, { color: c.muted }]}>{Number(w.pin_configurado) === 1 ? 'Contraseña y PIN' : 'Solo contraseña'}</Text> },
            { key: 's', label: 'Estado', width: 96, sortValue: w => Number(w.activo), render: w => <Badge tone={Number(w.activo) === 1 ? 'green' : 'neutral'}>{Number(w.activo) === 1 ? 'Activo' : 'Inactivo'}</Badge> },
            { key: 'x', label: '', width: 40, align: 'right', render: menu },
          ]}
          empty={<EmptyState icon={Users} title="No hay personas en esta vista" description={trabajadores.length ? 'Cambia los filtros o la búsqueda.' : 'Crea el primer usuario para comenzar.'}
            action={<Button onPress={trabajadores.length ? () => { setQuery(''); setStatusFilter('all'); setGroupFilter('all'); } : () => open('edit')}>{trabajadores.length ? 'Quitar filtros' : 'Crear usuario'}</Button>} />} />}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} tone={dialog?.kind === 'delete' ? 'danger' : 'default'}
      subtitle={dialog?.kind === 'delete' ? (isSelf ? 'No puedes eliminar el usuario con el que estás conectado.' : 'Si tiene pedidos o turnos de caja, el sistema conserva su historial y te pedirá desactivarlo en lugar de borrarlo.') : null}
      close={close} busy={busy} maxWidth={dialog?.kind === 'delete' ? 460 : 620}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, flexWrap: 'wrap' }}>
        <MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton>
        <MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={dialog?.kind === 'delete' && isSelf} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar usuario' : current ? 'Guardar' : 'Crear usuario'}</MenuButton>
      </View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? null : <>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md }}>
          <MenuField containerStyle={{ flex: 1 }} label="Nombre completo" value={form.nombre} onChangeText={value => change('nombre', value)} editable={!busy} placeholder="Ej. María González" maxLength={120} />
          <MenuField containerStyle={{ flex: 1 }} label="Correo de acceso" value={form.correo} onChangeText={value => change('correo', value)} editable={!busy} placeholder="nombre@cafeteria.com" autoCapitalize="none" keyboardType="email-address" maxLength={160} />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={[type.body, { color: c.text }]}>Rol</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{Object.entries(ROLES).map(([key, role]) => <MenuChip key={key} selected={form.rol === key} onPress={() => { if (!busy && !(isSelf && key !== 'admin')) change('rol', key); }}>{role.label}</MenuChip>)}</View>
          <Text style={[type.body, { color: c.muted }]}>{ROLES[form.rol]?.hint}</Text>
        </View>
        <View style={{ gap: space.md, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: c.line }}>
          <Text style={[type.h3, { color: c.text }]}>Acceso</Text>
          <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md }}>
            <MenuField containerStyle={{ flex: 1 }} label={current ? 'Nueva contraseña' : 'Contraseña'} hint={current ? 'Déjala vacía para conservar la actual.' : 'Mínimo 6 caracteres.'} value={form.password} onChangeText={value => change('password', value)} editable={!busy} secureTextEntry placeholder={current ? 'Sin cambios' : ''} />
            <MenuField containerStyle={{ flex: 1 }} label="PIN rápido (opcional)" hint={form.pin_configurado && !form.clearPin ? 'Déjalo vacío para conservar el actual.' : 'Exactamente 4 dígitos.'} value={form.pin} onChangeText={value => change('pin', value.replace(/\D/g, '').slice(0, 4))} editable={!busy && !form.clearPin} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder={form.pin_configurado ? '••••' : ''} />
          </View>
          {current && form.pin_configurado ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Checkbox checked={form.clearPin} disabled={busy} label="Quitar el PIN rápido actual" onChange={() => setForm(previous => ({ ...previous, clearPin: !previous.clearPin, pin: '' }))} />
            <Text style={[type.body, { color: c.text }]}>Quitar el PIN rápido actual</Text>
          </View> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: c.line }}>
          <View style={{ flex: 1 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>Usuario activo</Text><Text style={[type.body, { color: c.muted }]}>{isSelf ? 'Tu sesión de administrador debe permanecer activa.' : 'Puede iniciar sesión y usar su módulo.'}</Text></View>
          <Toggle label="Usuario activo" showLabel={false} value={form.activo} disabled={isSelf} onValueChange={value => change('activo', value)} />
        </View>
      </>}
    </MenuModal>
  </View>;
}
