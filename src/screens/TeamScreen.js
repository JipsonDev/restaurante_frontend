import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Banknote, Check, ChefHat, Edit3, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
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
    const RoleIcon = role.icon;
    return <View style={[row, { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, gap: 5, borderRadius: 6, backgroundColor: c[`${group.tone}Soft`] }]}><RoleIcon size={13} color={c[group.tone]} /><Text style={{ color: c[group.tone], fontSize: 10, fontWeight: '600' }}>{role.label}</Text></View>;
  };
  const statusBadge = worker => <View style={[row, { gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: Number(worker.activo) === 1 ? c.greenSoft : c.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Number(worker.activo) === 1 ? c.green : c.muted }} /><Text style={{ color: Number(worker.activo) === 1 ? c.green : c.muted, fontSize: 10, fontWeight: '600' }}>{Number(worker.activo) === 1 ? 'Activo' : 'Inactivo'}</Text></View>;
  const accessBadge = worker => <View style={[row, { gap: 5 }]}><KeyRound size={13} color={Number(worker.pin_configurado) === 1 ? c.sky : c.faint} /><Text style={{ color: Number(worker.pin_configurado) === 1 ? c.sky : c.muted, fontSize: 11, fontWeight: '600' }}>{Number(worker.pin_configurado) === 1 ? 'PIN configurado' : 'Solo contraseña'}</Text></View>;
  const actions = worker => <View style={[row, { gap: 6, justifyContent: 'flex-end' }]}><MenuButton icon={Edit3} label={`Editar ${worker.nombre}`} onPress={() => open('edit', worker)} /><MenuButton icon={Trash2} label={`Eliminar ${worker.nombre}`} disabled={Number(worker.id) === Number(user?.id)} onPress={() => open('delete', worker)} /></View>;
  const identity = worker => <View style={[row, { gap: 10, minWidth: 0 }]}><View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 12 }}>{initials(worker.nombre)}</Text></View><View style={{ flex: 1, minWidth: 0, gap: 3 }}><View style={[row, { gap: 6 }]}><Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{worker.nombre}</Text>{Number(worker.id) === Number(user?.id) && <Text style={{ color: c.primaryText, fontSize: 9, fontWeight: '700' }}>TÚ</Text>}</View><Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{worker.correo}</Text></View></View>;
  const mobileWorker = worker => <View key={worker.id} style={{ padding: 13, borderTopWidth: 1, borderColor: c.line, gap: 11 }}><View style={[row, { gap: 10 }]}><View style={{ flex: 1 }}>{identity(worker)}</View>{statusBadge(worker)}</View><View style={[row, { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }]}><View style={[row, { gap: 7, flexWrap: 'wrap' }]}>{roleBadge(worker)}{accessBadge(worker)}</View>{actions(worker)}</View></View>;
  const selectedGroup = groupFilter === 'all' ? null : GROUPS[groupFilter];
  const title = dialog?.kind === 'delete' ? 'Eliminar usuario' : current ? 'Editar usuario' : 'Nuevo usuario';

  return <View style={{ flex: 1 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
      <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }]}><View style={{ gap: 6, flexShrink: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>PERSONAL Y ACCESOS</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 26 : 30, fontWeight: '700', letterSpacing: -0.6 }}>Equipo</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>Cada persona, con las herramientas de su puesto.</Text></View><MenuButton primary icon={Plus} onPress={() => open('edit')}>Nuevo usuario</MenuButton></View>
      {!!notice && <View style={[row, { backgroundColor: c.greenSoft, borderRadius: 8, padding: 10, gap: 8 }]}><Check size={17} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ color: c.green, flex: 1, fontSize: 12 }}>{notice}</Text><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice('')} /></View>}
      <View style={[card, { flexDirection: compact ? 'column' : 'row', minHeight: compact ? 0 : 470 }]}>
        {compact ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 58, maxHeight: 58, borderBottomWidth: 1, borderColor: c.line }} contentContainerStyle={{ height: 58, paddingHorizontal: 10, gap: 7, alignItems: 'center' }}><MenuChip selected={groupFilter === 'all'} onPress={() => setGroupFilter('all')}>Todo el equipo · {trabajadores.length}</MenuChip>{Object.entries(GROUPS).map(([key, group]) => <MenuChip key={key} selected={groupFilter === key} onPress={() => setGroupFilter(key)}>{group.label} · {trabajadores.filter(worker => teamGroup(worker.rol) === key).length}</MenuChip>)}</ScrollView> : <View style={{ width: 225, padding: 12, gap: 5, borderRightWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt }}>
          <Text style={{ color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginHorizontal: 10, marginVertical: 8 }}>ÁREAS DEL EQUIPO</Text>
          {[['all', { label: 'Todo el equipo', icon: Users, tone: 'primary' }], ...Object.entries(GROUPS)].map(([key, group]) => { const Icon = group.icon; const selected = groupFilter === key; const members = key === 'all' ? trabajadores : trabajadores.filter(worker => teamGroup(worker.rol) === key); return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Ver ${group.label}`} accessibilityState={{ selected }} onPress={() => setGroupFilter(key)} style={({ hovered }) => [row, { minHeight: 48, paddingHorizontal: 10, gap: 9, borderRadius: 8, backgroundColor: selected ? c.surface : hovered ? c.soft : 'transparent', borderWidth: selected ? 1 : 0, borderColor: c.line }]}><View style={{ width: 30, height: 30, borderRadius: 7, backgroundColor: c[`${group.tone}Soft`], alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={key === 'all' ? c.primaryText : c[group.tone]} /></View><Text style={{ flex: 1, color: selected ? c.text : c.muted, fontSize: 12, fontWeight: selected ? '600' : '500' }}>{group.label}</Text><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{members.length}</Text></Pressable>; })}
          <View style={{ marginTop: 'auto', padding: 11, borderTopWidth: 1, borderColor: c.line, gap: 6 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{activeCount}</Text><Text style={{ color: c.muted, fontSize: 10 }}>usuarios activos</Text><Text style={{ color: c.faint, fontSize: 10 }}>{pinCount} con PIN rápido</Text></View>
        </View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ padding: compact ? 12 : 16, gap: 12 }}><View style={[row, { justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }]}><View style={{ gap: 3 }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{selectedGroup?.title || 'Directorio del equipo'}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{selectedGroup?.hint || 'Usuarios, accesos y responsabilidades del restaurante.'}</Text></View><Text style={{ color: c.faint, fontSize: 11 }}>{filtered.length} {filtered.length === 1 ? 'persona' : 'personas'}</Text></View><View style={[row, { gap: 8, flexWrap: 'wrap' }]}><View style={[row, { flexGrow: 1, flexBasis: 250, minWidth: 0, paddingHorizontal: 11, gap: 8, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line, borderRadius: 8 }]}><Search size={17} color={c.muted} /><TextInput accessibilityLabel="Buscar equipo" placeholder="Buscar nombre o correo…" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ flex: 1, minWidth: 0, minHeight: 42, color: c.text, fontSize: 12 }} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')} style={{ padding: 7 }}><X size={15} color={c.muted} /></Pressable>}</View><View style={[row, { gap: 5 }]}>{[['all', 'Todos'], ['1', 'Activos'], ['0', 'Inactivos']].map(([key, label]) => <MenuChip key={key} selected={statusFilter === key} onPress={() => setStatusFilter(key)}>{label}</MenuChip>)}</View></View></View>
          {!compact && <View style={[row, { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.surfaceAlt, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }]}><Text style={{ flex: 2.2, color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>PERSONA</Text><Text style={{ flex: 1.1, color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ROL</Text><Text style={{ flex: 1.2, color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ACCESO</Text><Text style={{ flex: 0.8, color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ESTADO</Text><Text style={{ width: 90, textAlign: 'right', color: c.faint, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>ACCIONES</Text></View>}
          {loading && !trabajadores.length ? <ActivityIndicator color={c.primary} style={{ padding: 30 }} /> : compact ? filtered.map(mobileWorker) : filtered.map((worker, index) => <View key={worker.id} style={[row, { minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: index ? 1 : 0, borderColor: c.line }]}><View style={{ flex: 2.2, paddingRight: 12 }}>{identity(worker)}</View><View style={{ flex: 1.1 }}>{roleBadge(worker)}</View><View style={{ flex: 1.2 }}>{accessBadge(worker)}</View><View style={{ flex: 0.8 }}>{statusBadge(worker)}</View><View style={{ width: 90 }}>{actions(worker)}</View></View>)}
          {!loading && !filtered.length && <View style={{ padding: 36, alignItems: 'center', gap: 11 }}><Users size={30} color={c.muted} /><Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>No hay personas en esta vista</Text><Text style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>{trabajadores.length ? 'Cambia los filtros o la búsqueda.' : 'Crea el primer usuario para comenzar.'}</Text><MenuButton onPress={trabajadores.length ? () => { setQuery(''); setStatusFilter('all'); } : () => open('edit', null, selectedGroup?.roles[0] || 'mesero')}>{trabajadores.length ? 'Limpiar filtros' : 'Crear usuario'}</MenuButton></View>}
        </View>
      </View>
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'delete' ? current?.nombre : current ? 'Actualiza sus datos, acceso y responsabilidades.' : 'Crea el acceso y asigna las responsabilidades del puesto.'} close={close} busy={busy} maxWidth={690} footer={<View style={[row, { justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} disabled={dialog?.kind === 'delete' && isSelf} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar usuario' : 'Guardar usuario'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>{isSelf ? 'No puedes eliminar el usuario con el que estás conectado.' : 'Se eliminará permanentemente este usuario. Si tiene pedidos o turnos de caja históricos, el sistema conservará el registro y te pedirá desactivarlo.'}</MenuNotice> : <>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label="Nombre completo" value={form.nombre} onChangeText={value => change('nombre', value)} editable={!busy} placeholder="Ej. María González" maxLength={120} /><MenuField containerStyle={{ flex: 1 }} label="Correo de acceso" value={form.correo} onChangeText={value => change('correo', value)} editable={!busy} placeholder="nombre@cafeteria.com" autoCapitalize="none" keyboardType="email-address" maxLength={160} /></View>
        <View style={{ gap: 9 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Área y permisos</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(ROLES).map(([key, role]) => <MenuButton key={key} icon={role.icon} disabled={busy || (isSelf && key !== 'admin')} onPress={() => change('rol', key)} style={form.rol === key ? { backgroundColor: c.primarySoft, borderColor: c.primary } : null}>{role.label}</MenuButton>)}</View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ROLES[form.rol]?.hint}</Text></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label={current ? 'Nueva contraseña' : 'Contraseña'} hint={current ? 'Déjala vacía para conservar la actual.' : 'Mínimo 6 caracteres.'} value={form.password} onChangeText={value => change('password', value)} editable={!busy} secureTextEntry placeholder={current ? 'Sin cambios' : 'Crear contraseña'} /><MenuField containerStyle={{ flex: 1 }} label="PIN rápido" hint={form.pin_configurado && !form.clearPin ? 'Déjalo vacío para conservar el actual.' : 'Opcional · exactamente 4 dígitos.'} value={form.pin} onChangeText={value => change('pin', value.replace(/\D/g, '').slice(0, 4))} editable={!busy && !form.clearPin} secureTextEntry keyboardType="number-pad" maxLength={4} placeholder={form.pin_configurado ? 'PIN configurado' : 'Ej. 1234'} /></View>
        {current && form.pin_configurado && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.clearPin }} disabled={busy} onPress={() => setForm(previous => ({ ...previous, clearPin: !previous.clearPin, pin: '' }))} style={[row, { alignSelf: 'flex-start', gap: 8 }]}><View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: form.clearPin ? c.red : c.line, backgroundColor: form.clearPin ? c.redSoft : c.surface, alignItems: 'center', justifyContent: 'center' }}>{form.clearPin && <X size={13} color={c.red} />}</View><Text style={{ color: form.clearPin ? c.red : c.muted, fontSize: 12 }}>Eliminar el PIN rápido actual</Text></Pressable>}
        <View style={[row, { padding: 14, backgroundColor: c.surfaceAlt, borderRadius: 8, gap: 10 }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Usuario activo</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{isSelf ? 'Tu sesión de administrador debe permanecer activa.' : 'Puede iniciar sesión y usar su módulo asignado.'}</Text></View><Switch accessibilityLabel="Usuario activo" value={form.activo} disabled={busy || isSelf} onValueChange={value => change('activo', value)} trackColor={{ false: c.line, true: c.green }} /></View>
        <View style={[row, { borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 14, gap: 11 }]}><View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>{initials(form.nombre)}</Text></View><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.faint, fontSize: 10 }}>VISTA PREVIA</Text><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{form.nombre.trim() || 'Nombre del trabajador'}</Text><View style={[row, { gap: 6 }]}><Mail size={12} color={c.muted} /><Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, flex: 1 }}>{form.correo.trim().toLowerCase() || 'correo@cafeteria.com'}</Text></View></View>{roleBadge({ rol: form.rol })}</View>
      </>}
    </MenuModal>
  </View>;
}
