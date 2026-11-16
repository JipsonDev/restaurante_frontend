import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Check, CirclePlus, Edit3, MessageSquare, MinusCircle, Plus, Search, SlidersHorizontal, Tag, Thermometer, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
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
  const compact = availableWidth < 760;
  const money = value => `${configuracion?.simbolo_moneda || '$'}${Number(value || 0).toFixed(2)}`;
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
  const statePill = active => <View style={[row, { alignSelf: 'flex-start', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: active ? c.greenSoft : c.soft }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? c.green : c.muted }} /><Text style={{ color: active ? c.green : c.muted, fontSize: 11, fontWeight: '600' }}>{active ? 'Activo' : 'Inactivo'}</Text></View>;
  const typeMark = extra => {
    const meta = TYPES[extra.tipo] || TYPES.EXTRA;
    const Icon = meta.icon;
    return <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: c[`${meta.tone}Soft`], alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={meta.tone === 'primary' ? c.primaryText : c[meta.tone]} /></View>;
  };
  const actions = extra => <View style={[row, { gap: 7 }]}><MenuButton icon={Edit3} label={`Editar ${extra.nombre}`} onPress={() => edit(extra)} /><MenuButton icon={Trash2} label={`Eliminar ${extra.nombre}`} onPress={() => { setError(''); setDialog({ kind: 'delete', extra }); }} /></View>;

  return <View style={{ flex: 1 }} onLayout={e => setAvailableWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
      <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }]}>
        <View style={{ gap: 6, flexShrink: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>CATÁLOGO · PERSONALIZACIÓN</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 26 : 30, fontWeight: '700', letterSpacing: -0.6 }}>Extras y preferencias</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>Cada pedido, al gusto del cliente.</Text></View>
        <MenuButton primary icon={Plus} onPress={() => edit()}>Nuevo extra</MenuButton>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(TYPES).map(([key, meta]) => {
          const Icon = meta.icon; const selected = type === key;
          const tone = meta.tone === 'primary' ? c.primaryText : c[meta.tone];
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Filtrar ${meta.plural}`} accessibilityState={{ selected }} onPress={() => setType(selected ? 'ALL' : key)} style={({ hovered }) => [card, { flexGrow: 1, flexBasis: compact ? '45%' : '22%', padding: 13, gap: 12, borderColor: selected ? c.primary : c.line, backgroundColor: selected ? c.primarySoft : hovered ? c.surfaceAlt : c.surface }]}>
            <View style={[row, { justifyContent: 'space-between' }]}><Icon size={20} color={tone} /><Text style={{ color: c.text, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{extras.filter(e => e.tipo === key).length}</Text></View>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>{meta.plural}</Text>
          </Pressable>;
        })}
      </View>
      {!!notice && <View style={[row, { backgroundColor: c.greenSoft, borderRadius: 8, padding: 10, gap: 9 }]}><Check size={16} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ color: c.green, flex: 1, fontSize: 12 }}>{notice}</Text><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice('')} /></View>}

      <View style={card}>
        <View style={{ padding: compact ? 14 : 18, gap: 14 }}>
          <View style={[row, { gap: 10, flexWrap: 'wrap' }]}>
            <View style={[row, { flexGrow: 1, flexBasis: 270, minWidth: 0, paddingHorizontal: 12, gap: 9, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, borderRadius: 8 }]}><Search size={18} color={c.muted} /><TextInput accessibilityLabel="Buscar extras" placeholder="Buscar por nombre o categoría…" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ flex: 1, minWidth: 0, minHeight: 44, color: c.text, fontSize: 13 }} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')} style={{ padding: 8 }}><X size={16} color={c.muted} /></Pressable>}</View>
            <View style={[row, { gap: 6 }]}>{[['ALL', 'Todos'], ['1', 'Activos'], ['0', 'Inactivos']].map(([key, label]) => <MenuChip key={key} selected={status === key} onPress={() => setStatus(key)}>{label}</MenuChip>)}</View>
          </View>
          <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }]}><Text style={{ color: c.muted, fontSize: 12 }}>{filtered.length} de {extras.length} opciones · {activeCount} activas</Text>{type !== 'ALL' ? <MenuButton icon={X} onPress={() => setType('ALL')}>{TYPES[type].plural}</MenuButton> : <Text style={{ color: c.faint, fontSize: 11 }}>El precio se suma por unidad</Text>}</View>
        </View>
        {!compact && <View style={[row, { paddingHorizontal: 18, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt }]}>{[['OPCIÓN', 2.2], ['TIPO', 1.2], ['CATEGORÍA', 1], ['PRECIO', 0.7], ['ESTADO', 0.8]].map(([label, flex]) => <Text key={label} style={{ flex, color: c.faint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6 }}>{label}</Text>)}<Text style={{ width: 91, textAlign: 'right', color: c.faint, fontSize: 10, fontWeight: '600' }}>ACCIONES</Text></View>}
        {loading && !extras.length ? <ActivityIndicator style={{ padding: 30 }} color={c.primary} /> : filtered.map((extra, index) => <View key={extra.id} style={{ paddingHorizontal: compact ? 14 : 18, paddingVertical: 13, borderTopWidth: index || compact ? 1 : 0, borderTopColor: c.line }}>
          {compact ? <View style={{ gap: 12 }}><View style={[row, { gap: 10 }]}>{typeMark(extra)}<View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{extra.nombre}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{TYPES[extra.tipo]?.label} · {extra.categoria || 'Sin categoría'}</Text></View><Text style={{ color: Number(extra.precio) > 0 ? c.primaryText : c.muted, fontWeight: '700', fontSize: 14 }}>{Number(extra.precio) > 0 ? `+${money(extra.precio)}` : 'Sin cargo'}</Text></View><View style={[row, { justifyContent: 'space-between' }]}>{statePill(Number(extra.activo) === 1)}{actions(extra)}</View></View> : <View style={row}>
            <View style={[row, { flex: 2.2, gap: 10, paddingRight: 12 }]}>{typeMark(extra)}<Text style={{ flex: 1, color: c.text, fontSize: 13, fontWeight: '600' }}>{extra.nombre}</Text></View>
            <Text style={{ flex: 1.2, color: c.muted, fontSize: 12 }}>{TYPES[extra.tipo]?.label || extra.tipo}</Text>
            <Text style={{ flex: 1, color: c.muted, fontSize: 12, paddingRight: 10 }}>{extra.categoria || 'Sin categoría'}</Text>
            <Text style={{ flex: 0.7, color: Number(extra.precio) > 0 ? c.primaryText : c.muted, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{Number(extra.precio) > 0 ? `+${money(extra.precio)}` : 'Sin cargo'}</Text>
            <View style={{ flex: 0.8 }}>{statePill(Number(extra.activo) === 1)}</View>{actions(extra)}
          </View>}
        </View>)}
        {!loading && !filtered.length && <View style={{ padding: 36, alignItems: 'center', gap: 12 }}><SlidersHorizontal size={30} color={c.muted} /><Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{extras.length ? 'No hay coincidencias' : 'Personaliza tu primer pedido'}</Text><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{extras.length ? 'Prueba con otro nombre, tipo o estado.' : 'Crea adicionales e indicaciones para que el equipo pueda seleccionarlos.'}</Text><MenuButton onPress={extras.length ? () => { setQuery(''); setStatus('ALL'); setType('ALL'); } : () => edit()}>{extras.length ? 'Limpiar filtros' : 'Crear extra'}</MenuButton></View>}
      </View>
    </ScrollView>

    <MenuModal visible={!!dialog} title={dialog?.kind === 'delete' ? 'Eliminar extra' : dialog?.extra ? 'Editar extra' : 'Nuevo extra'} subtitle={dialog?.kind === 'delete' ? dialog.extra.nombre : 'Define cómo aparecerá esta opción al tomar pedidos.'} close={close} busy={busy} maxWidth={620} footer={<View style={[row, { justifyContent: 'flex-end', gap: 8 }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton primary={dialog?.kind !== 'delete'} danger={dialog?.kind === 'delete'} busy={busy} onPress={submit}>{dialog?.kind === 'delete' ? 'Eliminar definitivamente' : 'Guardar extra'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>Esta acción elimina permanentemente la opción. Puedes desactivarla desde Editar si quieres conservarla para usarla después.</MenuNotice> : <>
        <MenuField label="Nombre del extra" value={form.nombre} onChangeText={v => change('nombre', v)} maxLength={120} editable={!busy} placeholder="Ej. Shot de espresso" />
        <View style={{ gap: 9 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Tipo de opción</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(TYPES).map(([key, meta]) => <MenuButton key={key} icon={meta.icon} disabled={busy} onPress={() => change('tipo', key)} style={form.tipo === key ? { borderColor: c.primary, backgroundColor: c.primarySoft } : null}>{meta.label}</MenuButton>)}</View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{TYPES[form.tipo]?.hint}</Text></View>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14 }}><MenuField containerStyle={{ flex: 1 }} label="Precio adicional" hint="Usa 0 para una opción sin cargo." value={form.precio} onChangeText={v => change('precio', v)} editable={!busy} keyboardType="decimal-pad" placeholder="0.00" /><MenuField containerStyle={{ flex: 1 }} label="Categoría" hint="Agrupa opciones: Café, Comida, Bebidas…" value={form.categoria} onChangeText={v => change('categoria', v)} maxLength={80} editable={!busy} placeholder="Opcional" /></View>
        <View style={[row, { padding: 14, backgroundColor: c.surfaceAlt, borderRadius: 8, gap: 12 }]}><View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Disponible para pedidos</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Desactívalo para ocultarlo de la selección de extras.</Text></View><Switch accessibilityLabel="Extra activo" value={form.activo} disabled={busy} onValueChange={v => change('activo', v)} trackColor={{ false: c.line, true: c.green }} /></View>
        <View style={[row, { borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 14, gap: 10 }]}><Tag size={19} color={c.primaryText} /><View style={{ flex: 1 }}><Text style={{ color: c.faint, fontSize: 10, marginBottom: 5 }}>VISTA PREVIA</Text><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{form.nombre.trim() || 'Nombre del extra'}</Text></View><Text style={{ color: c.primaryText, fontWeight: '600' }}>{Number.isFinite(Number(form.precio.replace(',', '.'))) && Number(form.precio.replace(',', '.')) >= 0 ? Number(form.precio.replace(',', '.')) === 0 ? 'Sin cargo' : `+${money(form.precio.replace(',', '.'))}` : '—'}</Text></View>
      </>}
    </MenuModal>
  </View>;
}
