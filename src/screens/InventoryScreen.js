import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowDownUp, Check, CircleAlert, Edit3, Package, PackageCheck, PackageX, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { Button, DataTable, EmptyState, FadeIn, IconButton, PageHeader, SearchField, Segmented, Skeleton, Status, space, type, useToast } from '../components/admin/ui';
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

// Barra de nivel: disponible frente al doble del mínimo, con marca del mínimo.
const unitLabel = u => (u === 'l' ? 'L' : u);
function Meter({ item, c, width }) {
  const min = Number(item.stock_minimo || 0), avail = Math.max(0, Number(item.levels.available || 0));
  const scale = Math.max(min * 2, avail, 1);
  const tone = { ok: c.green, low: c.amberBright || c.amber, empty: c.red }[item.levels.status] || c.muted;
  return <View style={{ height: 6, borderRadius: 3, backgroundColor: c.soft, width: width || '100%', maxWidth: 260 }}>
    <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, avail / scale * 100)}%`, backgroundColor: tone }} />
    {min > 0 ? <View style={{ position: 'absolute', top: -3, height: 12, width: 2, borderRadius: 1, left: `${Math.min(100, min / scale * 100)}%`, backgroundColor: c.text, opacity: 0.55 }} /> : null}
  </View>;
}

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
  const toast = useToast();
  React.useEffect(() => { if (notice) { toast.show(notice); setNotice(''); } }, [notice]);
  const money = n => `${configuracion?.simbolo_moneda || '$'}${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const levelStatus = item => { const meta = STATES[item.levels.status]; return <Status tone={meta.tone === 'primary' ? 'neutral' : meta.tone}>{item.levels.shortage > 0 ? `Faltan ${quantity(item.levels.shortage)}` : meta.label}</Status>; };
  const fieldsRow = { flexDirection: compact ? 'column' : 'row', gap: 14 };
  const field = (key, label, props = {}) => <MenuField containerStyle={{ flex: 1 }} label={label} value={form[key]} onChangeText={v => change(key, v)} editable={!busy} {...props} />;
  const title = dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : dialog?.item ? 'Editar insumo' : 'Nuevo insumo';

  return <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Inventario" description={`${items.length} insumos · ${items.filter(i => i.levels.status === 'low').length} por reponer · ${items.filter(i => i.levels.status === 'empty').length} sin disponible. Disponible = físico − reservado por pedidos.`}
        actions={<Button variant="primary" icon={Plus} onPress={() => open('edit')}>Nuevo insumo</Button>} />
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md, marginBottom: space.md, alignItems: compact ? 'stretch' : 'center' }}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Buscar insumo, categoría o proveedor…" style={compact ? null : { flex: 1, minWidth: 260, maxWidth: 380 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><Segmented size="sm" value={status} onChange={setStatus} accessibilityLabel="Estado"
          options={Object.entries(STATES).map(([key, meta]) => ({ value: key, label: key === 'all' ? 'Todos' : meta.title, count: key === 'all' ? items.length : items.filter(i => i.levels.status === key).length }))} /></ScrollView>
        <Button size="sm" variant="ghost" icon={ArrowDownUp} onPress={() => setUrgentFirst(v => !v)}>{urgentFirst ? 'Urgentes primero' : 'A–Z'}</Button>
      </View>
      {categories.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}>
        <MenuChip selected={!category} onPress={() => setCategory(null)}>Todas</MenuChip>{categories.map(cat => <MenuChip key={cat} selected={category === cat} onPress={() => setCategory(cat)}>{cat}</MenuChip>)}
      </ScrollView> : <View style={{ height: space.sm }} />}
      {loading && !items.length ? <View style={{ gap: space.sm }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={60} radius={10} />)}</View>
        : <FadeIn trigger={`${status}-${category}`} duration={180} offset={4}><DataTable selectedKey={dialog?.item?.id} rows={filtered} onRowPress={item => open('movement', item)}
          columns={compact ? [
            { key: 'n', label: 'Insumo', flex: 1, render: i => <View style={{ gap: 6, minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{i.nombre}</Text><Meter item={i} c={c} width={96} /></View> },
            { key: 'q', label: 'Disponible', width: 100, align: 'right', render: i => <View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{quantity(i.levels.available)} <Text style={{ color: c.faint, fontWeight: '400' }}>{unitLabel(i.unidad)}</Text></Text>{levelStatus(i)}</View> },
          ] : [
            { key: 'n', label: 'Insumo', flex: 2.2, sortValue: i => i.nombre, render: i => <View style={{ minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{i.nombre}</Text><Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{i.categoria || 'Sin categoría'} · {i.proveedor || 'Sin proveedor'}</Text></View> },
            { key: 'm', label: 'Nivel frente al mínimo', flex: 2.2, render: i => <View style={{ gap: 4, width: '100%', paddingRight: space.lg }}><Meter item={i} c={c} /><Text style={[type.micro, type.num, { color: c.faint }]}>Mínimo {quantity(i.stock_minimo)} {unitLabel(i.unidad)}{Number(i.levels.reserved) ? ` · reservado ${quantity(i.levels.reserved)}` : ''}</Text></View> },
            { key: 'q', label: 'Disponible', width: 120, sortValue: i => Number(i.levels.available), align: 'right', render: i => <Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{quantity(i.levels.available)} <Text style={{ color: c.faint, fontWeight: '400' }}>{unitLabel(i.unidad)}</Text></Text> },
            { key: 's', label: 'Estado', width: 130, sortValue: i => ({ empty: 0, low: 1, ok: 2 })[i.levels.status], render: i => levelStatus(i) },
            { key: 'c', label: 'Costo / ud.', width: 96, sortValue: i => Number(i.costo_unitario), align: 'right', render: i => <Text style={[type.small, type.num, { color: c.muted }]}>{money(i.costo_unitario)}</Text> },
            { key: 'a', label: '', width: 92, actions: true, align: 'right', render: i => <View style={{ flexDirection: 'row' }}><IconButton icon={Edit3} label={`Editar ${i.nombre}`} onPress={() => open('edit', i)} /><IconButton icon={Trash2} tone="danger" label={`Eliminar ${i.nombre}`} onPress={() => open('delete', i)} /></View> },
          ]}
          empty={<EmptyState icon={Package} title={items.length ? 'No hay insumos con estos filtros' : 'Tu almacén comienza aquí'} description={items.length ? 'Prueba otra búsqueda o revisa todas las categorías.' : 'Registra tus insumos, sus unidades y el mínimo que necesitas mantener.'}
            action={<Button onPress={items.length ? () => { setQuery(''); setStatus('all'); setCategory(null); } : () => open('edit')}>{items.length ? 'Quitar filtros' : 'Crear primer insumo'}</Button>} />} /></FadeIn>}
      <Text style={[type.micro, { color: c.faint, marginTop: space.md }]}>Toca un insumo para registrar una entrada, salida o ajuste.</Text>
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'edit' ? 'Configura los datos y niveles de reposición.' : current?.nombre} maxWidth={650} close={close} busy={busy} footer={<View style={[row, { justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton busy={busy} danger={dialog?.kind === 'delete'} primary={dialog?.kind !== 'delete'} onPress={submit}>{dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : 'Guardar insumo'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>Si lo usan productos, recetas o movimientos, el sistema no dejará borrarlo.</MenuNotice> : dialog?.kind === 'movement' ? <>
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
