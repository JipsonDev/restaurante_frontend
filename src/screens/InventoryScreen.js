import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowDownUp, Check, CircleAlert, Edit3, Package, PackageCheck, PackageX, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { inventoryMovement, inventoryPayload, inventoryStock } from '../utils/inventoryLogic.mjs';

const row = { flexDirection: 'row', alignItems: 'center' };
const quantity = value => Number(value || 0).toLocaleString('es-EC', { maximumFractionDigits: 3 });
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const blank = () => ({ nombre: '', categoria: '', proveedor: '', unidad: 'unidad', stock: '0', stock_minimo: '0', costo_unitario: '0.00' });
const STATES = {
  all: { title: 'Insumos', icon: Package, tone: 'primary', label: 'Todos' },
  ok: { title: 'Stock suficiente', icon: PackageCheck, tone: 'green', label: 'Disponible' },
  low: { title: 'Por reponer', icon: CircleAlert, tone: 'amber', label: 'Stock bajo' },
  empty: { title: 'Sin disponible', icon: PackageX, tone: 'red', label: 'Sin disponible' },
};
const MOVES = { Entrada: { icon: ArrowDownLeft, hint: 'Suma unidades al stock físico. Úsalo al recibir una compra.' }, Salida: { icon: ArrowUpRight, hint: 'Resta unidades disponibles. Úsalo para mermas o retiros.' }, Ajuste: { icon: SlidersHorizontal, hint: 'Reemplaza el stock físico por la cantidad contada. No se suma ni se resta.' } };

export default function InventoryScreen() {
  const { c } = useTheme();
  const { inventario, loading, configuracion, createInventarioItem, updateInventarioItem, movimientoInventario, deleteInventarioItem } = useAdmin();
  const [width, setWidth] = useState(0);
  const compact = width < 850;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState(null);
  const [urgentFirst, setUrgentFirst] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(blank);
  const [movement, setMovement] = useState({ tipo: 'Entrada', cantidad: '', motivo: '' });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const money = n => `${configuracion?.simbolo_moneda || '$'}${Number(n || 0).toFixed(2)}`;
  const card = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' };
  const items = useMemo(() => inventario.map(item => ({ ...item, levels: inventoryStock(item) })), [inventario]);
  const categories = useMemo(() => [...new Set(items.map(i => i.categoria || 'Sin categoría'))].sort((a, b) => a.localeCompare(b, 'es')), [items]);
  const filtered = useMemo(() => items.filter(i => (status === 'all' || i.levels.status === status) && (!category || (i.categoria || 'Sin categoría') === category) && normalize(`${i.nombre} ${i.categoria || ''} ${i.proveedor || ''}`).includes(normalize(query).trim())).sort((a, b) => {
    const priority = { empty: 0, low: 1, ok: 2 };
    return (urgentFirst ? priority[a.levels.status] - priority[b.levels.status] : 0) || a.nombre.localeCompare(b.nombre, 'es');
  }), [items, status, category, query, urgentFirst]);
  const current = dialog?.item ? items.find(i => i.id === dialog.item.id) || dialog.item : null;
  let preview = null;
  if (dialog?.kind === 'movement' && movement.cantidad.trim()) {
    try { preview = inventoryMovement(current, movement); } catch (e) { preview = { error: e.message }; }
  }
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const close = () => { if (!busyRef.current) { setDialog(null); setError(''); } };
  const open = (kind, item = null) => {
    setError('');
    if (kind === 'edit') setForm(item ? { ...blank(), ...Object.fromEntries(Object.keys(blank()).map(key => [key, String(item[key] ?? '')])) } : blank());
    if (kind === 'movement') setMovement({ tipo: 'Entrada', cantidad: '', motivo: '' });
    setDialog({ kind, item });
  };
  async function submit() {
    if (!dialog || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (dialog.kind === 'movement') {
        await movimientoInventario(current.id, inventoryMovement(current, movement).payload);
        setNotice('Movimiento registrado. Existencias actualizadas.');
      } else if (dialog.kind === 'delete') {
        await deleteInventarioItem(current.id);
        setNotice('Insumo eliminado.');
      } else {
        const payload = inventoryPayload(form, !!dialog.item);
        if (dialog.item) await updateInventarioItem(dialog.item.id, payload);
        else await createInventarioItem(payload);
        setNotice(dialog.item ? 'Datos del insumo actualizados.' : 'Insumo creado.');
      }
      setDialog(null);
    } catch (e) { setError(e.response?.data?.message || e.response?.data?.error || e.message || 'No se pudo guardar. Inténtalo nuevamente.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const badge = item => {
    const meta = STATES[item.levels.status];
    return <View style={[row, { alignSelf: 'flex-start', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c[`${meta.tone}Soft`] }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c[meta.tone] }} /><Text style={{ fontSize: 11, fontWeight: '600', color: c[meta.tone] }}>{meta.label}</Text></View>;
  };
  const identity = item => <View style={[row, { gap: 10, flex: 1 }]}><View style={{ padding: 9, borderRadius: 9, backgroundColor: c.soft }}><Package size={19} color={c.primaryText} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 11 }}>{item.categoria || 'Sin categoría'} · {item.unidad}</Text><Text style={{ color: c.faint, fontSize: 11 }}>{item.proveedor || 'Sin proveedor'}</Text></View></View>;
  const actions = item => <View style={[row, { gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }]}><MenuButton icon={ArrowDownUp} label={`Registrar movimiento de ${item.nombre}`} onPress={() => open('movement', item)}>Movimiento</MenuButton><MenuButton icon={Edit3} label={`Editar ${item.nombre}`} onPress={() => open('edit', item)} /><MenuButton icon={Trash2} label={`Eliminar ${item.nombre}`} onPress={() => open('delete', item)} /></View>;
  const stat = (label, value, tone = c.text) => <View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.muted, fontSize: 10 }}>{label}</Text><Text style={{ color: tone, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{quantity(value)}</Text></View>;
  const fieldsRow = { flexDirection: compact ? 'column' : 'row', gap: 14 };
  const field = (key, label, props = {}) => <MenuField containerStyle={{ flex: 1 }} label={label} value={form[key]} onChangeText={v => change(key, v)} editable={!busy} {...props} />;
  const title = dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : dialog?.item ? 'Editar insumo' : 'Nuevo insumo';

  return <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
      <View style={[row, { justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }]}><View style={{ gap: 6, flexShrink: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 }}>CONTROL DE EXISTENCIAS</Text><Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 26 : 30, fontWeight: '700', letterSpacing: -0.6 }}>Inventario</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>Todo lo que necesitas para seguir sirviendo.</Text></View><MenuButton primary icon={Plus} onPress={() => open('edit')}>Nuevo insumo</MenuButton></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{Object.entries(STATES).map(([key, meta]) => {
        const Icon = meta.icon; const selected = key === status;
        return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Filtrar ${meta.title}`} accessibilityState={{ selected }} onPress={() => setStatus(key)} style={({ hovered }) => [card, { flexBasis: compact ? '45%' : '22%', flexGrow: 1, padding: 13, gap: 12, backgroundColor: selected ? c.primarySoft : hovered ? c.surfaceAlt : c.surface, borderColor: selected ? c.primary : c.line }]}><View style={[row, { justifyContent: 'space-between' }]}><Icon size={20} color={key === 'all' ? c.primaryText : c[meta.tone]} /><Text style={{ color: c.text, fontSize: 22, fontWeight: '600' }}>{key === 'all' ? items.length : items.filter(i => i.levels.status === key).length}</Text></View><Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>{meta.title}</Text></Pressable>;
      })}</View>
      {!!notice && <View style={[row, { padding: 10, backgroundColor: c.greenSoft, borderRadius: 8, gap: 8 }]}><Check size={17} color={c.green} /><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: c.green, fontSize: 12 }}>{notice}</Text><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice('')} /></View>}
      <View style={card}>
        <View style={{ padding: compact ? 14 : 18, gap: 12 }}>
          <View style={[row, { gap: 10, flexWrap: 'wrap' }]}><View style={[row, { flex: 1, minWidth: 190, paddingHorizontal: 12, gap: 8, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line, borderRadius: 8 }]}><Search size={18} color={c.muted} /><TextInput accessibilityLabel="Buscar inventario" value={query} onChangeText={setQuery} placeholder="Buscar insumo, categoría o proveedor…" placeholderTextColor={c.muted} style={{ flex: 1, minWidth: 0, minHeight: 44, fontSize: 13, color: c.text }} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={() => setQuery('')} style={{ padding: 8 }}><X size={16} color={c.muted} /></Pressable>}</View><MenuButton icon={ArrowDownUp} onPress={() => setUrgentFirst(v => !v)}>{urgentFirst ? 'Prioridad de stock' : 'Orden alfabético'}</MenuButton></View>
          {categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}><MenuChip selected={!category} onPress={() => setCategory(null)}>Todas las categorías</MenuChip>{categories.map(cat => <MenuChip key={cat} selected={category === cat} onPress={() => setCategory(cat)}>{cat}</MenuChip>)}</ScrollView>}
          <View style={[row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }]}><Text style={{ color: c.muted, fontSize: 12 }}>{filtered.length} de {items.length} insumos</Text><Text style={{ color: c.faint, fontSize: 11 }}>Disponible = físico − reservado</Text></View>
        </View>
        {!compact && <View style={[row, { backgroundColor: c.surfaceAlt, paddingHorizontal: 18, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }]}>{[['INSUMO', 2.1], ['EXISTENCIAS', 2], ['DISPONIBLE', 1.3], ['COSTO / UD.', 0.9]].map(([label, flex]) => <Text key={label} style={{ flex, color: c.faint, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>{label}</Text>)}<Text style={{ width: 212, textAlign: 'right', color: c.faint, fontSize: 10, fontWeight: '600' }}>ACCIONES</Text></View>}
        {loading && !items.length ? <ActivityIndicator color={c.primary} style={{ padding: 30 }} /> : filtered.map((item, index) => <View key={item.id} style={{ padding: compact ? 14 : 18, borderTopWidth: index || compact ? 1 : 0, borderColor: c.line, gap: 12 }}>
          {compact ? <><View style={[row, { gap: 8 }]}>{identity(item)}{badge(item)}</View><View style={[row, { padding: 12, borderRadius: 8, backgroundColor: c.surfaceAlt, gap: 8 }]}>{stat('Físico', item.levels.physical)}{stat('Reservado', item.levels.reserved)}{stat('Disponible', item.levels.available, c[STATES[item.levels.status].tone])}</View><View style={[row, { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }]}><Text style={{ color: c.muted, fontSize: 11 }}>Mínimo: {quantity(item.stock_minimo)} · Costo: {money(item.costo_unitario)}</Text>{actions(item)}</View></> : <View style={row}>
            <View style={{ flex: 2.1, paddingRight: 12 }}>{identity(item)}</View>
            <View style={{ flex: 2, gap: 7, paddingRight: 12 }}><Text style={{ color: c.text, fontSize: 12 }}>Físico {quantity(item.levels.physical)} · Reserva {quantity(item.levels.reserved)}</Text><Text style={{ color: c.faint, fontSize: 11 }}>Mínimo: {quantity(item.stock_minimo)} {item.unidad}</Text></View>
            <View style={{ flex: 1.3, gap: 6 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{quantity(item.levels.available)}</Text>{badge(item)}</View><Text style={{ flex: 0.9, color: c.text, fontSize: 13, fontWeight: '600' }}>{money(item.costo_unitario)}</Text><View style={{ width: 212 }}>{actions(item)}</View>
          </View>}
          {item.levels.shortage > 0 && <Text style={{ color: c.red, fontSize: 12 }}>Faltan {quantity(item.levels.shortage)} {item.unidad} para cubrir pedidos ya confirmados.</Text>}
        </View>)}
        {!loading && !filtered.length && <View style={{ padding: 32, alignItems: 'center', gap: 12 }}><Package size={32} color={c.muted} /><Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{items.length ? 'No hay insumos con estos filtros' : 'Tu almacén comienza aquí'}</Text><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{items.length ? 'Prueba con otra búsqueda o revisa todas las categorías.' : 'Registra tus insumos, sus unidades y el mínimo que necesitas mantener.'}</Text><MenuButton onPress={items.length ? () => { setQuery(''); setStatus('all'); setCategory(null); } : () => open('edit')}>{items.length ? 'Limpiar filtros' : 'Crear primer insumo'}</MenuButton></View>}
      </View>
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'edit' ? 'Configura los datos y niveles de reposición.' : current?.nombre} maxWidth={650} close={close} busy={busy} footer={<View style={[row, { justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton busy={busy} danger={dialog?.kind === 'delete'} primary={dialog?.kind !== 'delete'} onPress={submit}>{dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : 'Guardar insumo'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>Se eliminará permanentemente este insumo. El sistema impide borrar insumos vinculados a productos, recetas, reservas o movimientos.</MenuNotice> : dialog?.kind === 'movement' ? <>
        <View style={[row, { padding: 14, borderRadius: 8, backgroundColor: c.surfaceAlt, gap: 10 }]}>{stat(`Físico (${current.unidad})`, inventoryStock(current).physical)}{stat('Reservado', inventoryStock(current).reserved)}{stat('Disponible', inventoryStock(current).available)}</View>
        <View style={{ gap: 10 }}><View style={[row, { flexWrap: 'wrap', gap: 8 }]}>{Object.entries(MOVES).map(([type, meta]) => <MenuButton key={type} icon={meta.icon} disabled={busy} onPress={() => setMovement(m => ({ ...m, tipo: type }))} style={movement.tipo === type ? { backgroundColor: c.primarySoft, borderColor: c.primary } : null}>{type}</MenuButton>)}</View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>{MOVES[movement.tipo].hint}</Text></View>
        <MenuField label={movement.tipo === 'Ajuste' ? `Conteo físico final (${current.unidad})` : `Cantidad (${current.unidad})`} value={movement.cantidad} editable={!busy} onChangeText={v => setMovement(m => ({ ...m, cantidad: v }))} keyboardType="decimal-pad" placeholder="0" hint="Admite hasta 3 decimales." />
        <MenuField label="Motivo" value={movement.motivo} editable={!busy} onChangeText={v => setMovement(m => ({ ...m, motivo: v }))} placeholder="Ej. Compra, merma o conteo de cierre" maxLength={250} />
        {preview?.error ? <MenuNotice danger>{preview.error}</MenuNotice> : preview ? <View style={{ padding: 16, gap: 10, borderRadius: 8, backgroundColor: c.primarySoft }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>VISTA PREVIA DEL STOCK FÍSICO</Text><View style={[row, { gap: 12 }]}><Text style={{ color: c.muted, fontSize: 21 }}>{quantity(current.stock)}</Text><ArrowRight size={20} color={c.primaryText} /><Text style={{ color: c.text, fontSize: 23, fontWeight: '700' }}>{quantity(preview.next)} {current.unidad}</Text></View><Text style={{ color: c.muted, fontSize: 12 }}>Disponible después: {quantity(preview.available)}. Se valida de nuevo al guardar.</Text></View> : null}
      </> : <>
        {field('nombre', 'Nombre del insumo', { placeholder: 'Ej. Café en grano', maxLength: 120 })}
        <View style={fieldsRow}>{field('categoria', 'Categoría', { placeholder: 'Ej. Cafetería', maxLength: 80 })}{field('proveedor', 'Proveedor', { placeholder: 'Opcional', maxLength: 120 })}</View>
        <View style={fieldsRow}>{field('unidad', 'Unidad de medida', { placeholder: 'kg, litro, unidad…', maxLength: 30, hint: 'Usa la misma unidad que en las recetas.' })}{field('costo_unitario', 'Costo por unidad', { keyboardType: 'decimal-pad', hint: 'Costo de compra, no precio de venta.' })}</View>
        <View style={fieldsRow}>{!dialog?.item && field('stock', 'Stock físico inicial', { keyboardType: 'decimal-pad', hint: 'Cantidad real al registrar el insumo.' })}{field('stock_minimo', 'Stock mínimo disponible', { keyboardType: 'decimal-pad', hint: 'Se avisa cuando el disponible llega a este nivel.' })}</View>
        {!!dialog?.item && <MenuNotice>Para cambiar las existencias, usa Movimiento en la lista. Así la entrada, salida o ajuste queda registrado.</MenuNotice>}
      </>}
    </MenuModal>
  </View>;
}
