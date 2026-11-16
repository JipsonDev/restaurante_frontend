import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Check, CirclePlus, Edit3, Eye, EyeOff, MessageSquare, MinusCircle, Plus, Search, SlidersHorizontal, Tag, Thermometer, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { ActionMenu, Button, Card, DataTable, EmptyState, FadeIn, IconButton, PageHeader, SearchField, Segmented, Skeleton, Status, Switch as Toggle, Tag as Pill, space, type as typo, useToast } from '../components/admin/ui';
import { adminNumber } from '../utils/adminNumbers.mjs';

const TYPES = {
  EXTRA: { label: 'Adicional', plural: 'Adicionales', icon: CirclePlus, tone: 'primary', hint: 'Complementos como leche, queso o un shot de café.' },
  EXCLUSION: { label: 'Sin ingrediente', plural: 'Sin ingredientes', icon: MinusCircle, tone: 'sky', hint: 'Indicaciones para retirar ingredientes, como «Sin cebolla».' },
  TERMINO: { label: 'Preparación', plural: 'Preparación', icon: Thermometer, tone: 'amber', hint: 'Preferencias como término medio o bien cocido.' },
  NOTA: { label: 'Indicación', plural: 'Indicaciones', icon: MessageSquare, tone: 'purple', hint: 'Instrucciones habituales que acompañan al pedido.' },
};
const blank = () => ({ nombre: '', precio: '0.00', categoria: '', tipo: 'EXTRA', activo: true });
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const row = { flexDirection: 'row', alignItems: 'center' };
const errorMessage = e => e.response?.data?.message || e.response?.data?.error || e.message || 'No se pudo completar la operación.';

export default function ExtrasScreen() {
  const { c } = useTheme();
  const { extras, loading, createExtra, updateExtra, deleteExtra, configuracion } = useAdmin();
  const [availableWidth, setAvailableWidth] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const toast = useToast();
  React.useEffect(() => { if (notice) { toast.show(notice); setNotice(''); } }, [notice]);
  const compact = availableWidth < 760;
  const money = value => `${configuracion?.simbolo_moneda || '$'}${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const card = { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 10, overflow: 'hidden' };
  const activeCount = extras.filter(e => Number(e.activo) === 1).length;
  const filtered = useMemo(() => extras.filter(e =>
    (type === 'ALL' || e.tipo === type) &&
    (status === 'ALL' || Number(e.activo) === Number(status)) &&
    normalize(`${e.nombre} ${e.categoria} ${TYPES[e.tipo]?.label}`).includes(normalize(query).trim())
  ), [extras, query, type, status]);

  const close = () => { if (!busyRef.current) { setDialog(null); setError(''); } };
  const edit = (extra = null) => {
    setError('');
    setForm(extra ? { nombre: extra.nombre || '', precio: String(extra.precio ?? 0), categoria: extra.categoria || '', tipo: extra.tipo, activo: Number(extra.activo) === 1 } : blank());
    setDialog({ kind: 'edit', extra });
  };
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  async function submit() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (dialog.kind === 'delete') {
        await deleteExtra(dialog.extra.id);
        setNotice('Extra eliminado.');
      } else {
        if (!form.nombre.trim()) throw new Error('Escribe el nombre del extra.');
        const payload = { ...form, nombre: form.nombre.trim(), precio: adminNumber(form.precio, 'Precio'), categoria: form.categoria.trim() || null, activo: form.activo ? 1 : 0 };
        if (dialog.extra) await updateExtra(dialog.extra.id, payload);
        else await createExtra(payload);
        setNotice(dialog.extra ? 'Cambios guardados.' : 'Extra creado.');
      }
      setDialog(null);
    } catch (e) { setError(errorMessage(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const statePill = active => <View style={[row, { alignSelf: 'flex-start', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: active ? c.greenSoft : c.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? c.green : c.muted }} /><Text style={{ color: active ? c.green : c.muted, fontSize: 12, fontWeight: '600' }}>{active ? 'Activo' : 'Inactivo'}</Text></View>;
  const typeMark = extra => {
    const meta = TYPES[extra.tipo] || TYPES.EXTRA;
    const Icon = meta.icon;
    return <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c[`${meta.tone}Soft`], alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={meta.tone === 'primary' ? c.primaryText : c[meta.tone]} /></View>;
  };
  const actions = extra => <View style={[row, { gap: 2 }]}><IconButton icon={Edit3} label={`Editar ${extra.nombre}`} onPress={() => edit(extra)} /><IconButton icon={Trash2} tone="danger" label={`Eliminar ${extra.nombre}`} onPress={() => { setError(''); setDialog({ kind: 'delete', extra }); }} /></View>;

  const setActive = async (rows, active) => {
    const target = rows.filter(e => (Number(e.activo) === 1) !== active);
    if (!target.length) { toast.show(active ? 'Ya estaban activos.' : 'Ya estaban inactivos.'); return; }
    try {
      for (const e of target) await updateExtra(e.id, { ...e, activo: active ? 1 : 0 });
      toast.show(`${target.length === 1 ? target[0].nombre : `${target.length} extras`} ${active ? 'activado' : 'desactivado'}${target.length === 1 ? '' : 's'}`, 'green', 5000,
        { label: 'Deshacer', onPress: async () => { try { for (const e of target) await updateExtra(e.id, { ...e, activo: active ? 0 : 1 }); } catch (err) { toast.show(errorMessage(err), 'red'); } } });
    } catch (err) { toast.show(errorMessage(err), 'red'); }
  };
  const price = e => <Text style={[typo.body, typo.num, { color: Number(e.precio) > 0 ? c.text : c.muted }]}>{Number(e.precio) > 0 ? `+${money(e.precio)}` : 'Sin cargo'}</Text>;
  const rowMenu = e => <ActionMenu label={`Acciones de ${e.nombre}`} actions={[
    { label: 'Editar', icon: Edit3, onPress: () => edit(e) },
    { label: Number(e.activo) === 1 ? 'Desactivar' : 'Activar', icon: Number(e.activo) === 1 ? EyeOff : Eye, onPress: () => setActive([e], Number(e.activo) !== 1) },
    { divider: true },
    { label: 'Eliminar', icon: Trash2, tone: 'danger', onPress: () => { setError(''); setDialog({ kind: 'delete', extra: e }); } },
  ]} />;
  const toolbar = <View style={{ padding: space.sm, gap: space.sm }}>
    <Segmented value={type} onChange={setType} accessibilityLabel="Tipo"
      options={[{ value: 'ALL', label: 'Todos', count: extras.length }, ...Object.entries(TYPES).map(([key, meta]) => ({ value: key, label: meta.plural, count: extras.filter(e => e.tipo === key).length }))]} />
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.sm, alignItems: compact ? 'stretch' : 'center' }}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar extras" style={compact ? null : { flex: 1 }} />
      <View style={{ flexDirection: 'row', gap: space.xs }}>{[['ALL', 'Todos'], ['1', 'Activos'], ['0', 'Inactivos']].map(([v, l]) => <MenuChip key={v} selected={status === v} onPress={() => setStatus(v)}>{l}</MenuChip>)}</View>
    </View>
  </View>;

  return <View style={{ flex: 1 }} onLayout={e => setAvailableWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Extras" actions={<Button variant="primary" onPress={() => edit()}>Agregar extra</Button>} />
      {loading && !extras.length ? <Card padded={false}><View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={32} />)}</View></Card>
        : !extras.length ? <Card><EmptyState icon={SlidersHorizontal} title="Agrega opciones para personalizar pedidos" description="Adicionales con precio, ingredientes que se quitan, términos de cocción e indicaciones frecuentes."
          action={<Button variant="primary" onPress={() => edit()}>Agregar extra</Button>} /></Card>
        : <DataTable toolbar={toolbar} selectedKey={dialog?.extra?.id} rows={filtered} onRowPress={extra => edit(extra)} compact selectable={!compact}
          bulkActions={[{ label: 'Activar', onPress: rows => setActive(rows, true) }, { label: 'Desactivar', onPress: rows => setActive(rows, false) }]}
          columns={compact ? [
            { key: 'n', label: 'Extra', flex: 1, render: e => <View style={{ gap: 2 }}><Text style={[typo.body, { color: c.text, fontWeight: '600' }]}>{e.nombre}</Text><Text style={[typo.body, { color: c.muted }]}>{TYPES[e.tipo]?.label} · {e.categoria || 'Sin categoría'}{Number(e.activo) === 1 ? '' : ' · Inactivo'}</Text></View> },
            { key: 'p', label: 'Precio', width: 88, align: 'right', render: price },
          ] : [
            { key: 'n', label: 'Extra', flex: 2.4, sortValue: e => e.nombre, render: e => <Text numberOfLines={1} style={[typo.body, { color: c.text, fontWeight: '600' }]}>{e.nombre}</Text> },
            { key: 's', label: 'Estado', width: 100, sortValue: e => -Number(e.activo), render: e => <Status tone={Number(e.activo) === 1 ? 'green' : 'neutral'}>{Number(e.activo) === 1 ? 'Activo' : 'Inactivo'}</Status> },
            { key: 't', label: 'Tipo', flex: 1.3, sortValue: e => e.tipo, render: e => <Text numberOfLines={1} style={[typo.body, { color: c.text }]}>{TYPES[e.tipo]?.label || e.tipo}</Text> },
            { key: 'c', label: 'Categoría', flex: 1.2, sortValue: e => e.categoria || '', render: e => <Text numberOfLines={1} style={[typo.body, { color: c.text }]}>{e.categoria || '—'}</Text> },
            { key: 'p', label: 'Precio', width: 100, sortValue: e => Number(e.precio), align: 'right', render: price },
            { key: 'a', label: '', width: 40, actions: true, align: 'right', render: rowMenu },
          ]}
          empty={<EmptyState compact icon={Search} title="Sin coincidencias" description="Prueba con otro nombre, tipo o estado."
            action={<Button onPress={() => { setQuery(''); setStatus('ALL'); setType('ALL'); }}>Quitar filtros</Button>} />} />}
    </ScrollView>

    <MenuModal visible={!!dialog} title={dialog?.kind === 'delete' ? 'Eliminar extra' : dialog?.extra ? 'Editar extra' : 'Nuevo extra'} subtitle={dialog?.kind === 'delete' ? dialog.extra.nombre : 'Define cómo aparecerá esta opción al tomar pedidos.'} close={close} busy={busy} maxWidth={620} footer={<View style={[row, { justifyContent: 'flex-end', gap: 8 }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar definitivamente' : 'Guardar extra'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>Si solo quieres ocultarla al tomar pedidos, desactívala desde Editar.</MenuNotice> : <>
        <MenuField label="Nombre del extra" value={form.nombre} onChangeText={v => change('nombre', v)} maxLength={120} editable={!busy} placeholder="Ej. Shot de espresso" />
        <View style={{ gap: 6 }}><Text style={[typo.body, { color: c.text }]}>Tipo de opción</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(TYPES).map(([key, meta]) => <MenuChip key={key} selected={form.tipo === key} onPress={() => !busy && change('tipo', key)}>{meta.label}</MenuChip>)}</View><Text style={[typo.body, { color: c.muted }]}>{TYPES[form.tipo]?.hint}</Text></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label="Precio adicional" hint="Usa 0 para una opción sin cargo." value={form.precio} onChangeText={v => change('precio', v)} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" /><MenuField containerStyle={{ flex: 1 }} label="Categoría" hint="Agrupa opciones: Café, Comida, Bebidas…" value={form.categoria} onChangeText={v => change('categoria', v)} maxLength={80} editable={!busy} placeholder="Opcional" /></View>
        <View style={[row, { paddingVertical: 4, gap: 12 }]}><View style={{ flex: 1, gap: 2 }}><Text style={[typo.body, { color: c.text }]}>Disponible para pedidos</Text><Text style={[typo.body, { color: c.muted }]}>Desactívalo para ocultarlo de la selección de extras.</Text></View><Toggle label="Extra activo" showLabel={false} value={form.activo} disabled={busy} onValueChange={v => change('activo', v)} /></View>
      </>}
    </MenuModal>
  </View>;
}
