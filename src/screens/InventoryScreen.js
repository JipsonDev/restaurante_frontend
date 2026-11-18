import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowDownUp, Check, CircleAlert, Edit3, Package, PackageCheck, PackageX, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { ActionMenu, Banner, Button, Card, DataTable, EmptyState, FadeIn, IconButton, PageHeader, SearchField, Segmented, Skeleton, Status, Tabs, space, type, useToast } from '../components/admin/ui';
import { inventoryMovement, inventoryPayload, inventoryStock } from '../utils/inventoryLogic.mjs';
import { enableWebPush, pushStatus, pushSupport, subscribePushStatus } from '../services/webPushClient';

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
  const tone = { ok: c.isDark ? '#8A8A8A' : '#8A8A8A', low: c.amberBright || c.amber, empty: c.redBright || c.red }[item.levels.status] || c.muted;
  return <View style={{ height: 6, borderRadius: 3, backgroundColor: c.soft, width: width || '100%', maxWidth: 260 }}>
    <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, avail / scale * 100)}%`, backgroundColor: tone }} />
    {min > 0 ? <View style={{ position: 'absolute', top: -3, height: 12, width: 2, borderRadius: 1, left: `${Math.min(100, min / scale * 100)}%`, backgroundColor: c.text, opacity: 0.4 }} /> : null}
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
  // Avisos de «queda poco» al teléfono de quien administra (los mismos avisos push del mesero).
  const [push, setPush] = useState(pushStatus());
  useEffect(() => { enableWebPush({ ask: false }).catch(() => {}); return subscribePushStatus(setPush); }, []);
  const askPush = async () => {
    const result = await enableWebPush({ ask: true });
    if (result === 'active') toast.show('Listo: te avisaremos al teléfono cuando algo esté por acabarse.', 'green', 6000);
    else if (result === 'denied') toast.show('El navegador bloqueó los avisos. Permítelos en los ajustes del sitio.', 'amber', 8000);
    else if (result === 'ios-install') toast.show('En iPhone, instala la app en la pantalla de inicio y actívalo desde ahí.', 'amber', 8000);
    else if (result === 'unsupported') toast.show('Este navegador no permite avisos al teléfono.', 'amber', 6000);
    else if (result === 'error') toast.show('No se pudo activar. Intenta de nuevo en un momento.', 'red', 6000);
  };
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
    return <View style={[row, { alignSelf: 'flex-start', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: c[`${meta.tone}Soft`] }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c[meta.tone] }} /><Text style={{ fontSize: 12, fontWeight: '600', color: c[meta.tone] }}>{meta.label}</Text></View>;
  };
  const identity = item => <View style={[row, { gap: 10, flex: 1 }]}><View style={{ padding: 9, borderRadius: 9, backgroundColor: c.soft }}><Package size={19} color={c.primaryText} /></View><View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{item.categoria || 'Sin categoría'} · {item.unidad}</Text><Text style={{ color: c.faint, fontSize: 12 }}>{item.proveedor || 'Sin proveedor'}</Text></View></View>;
  const actions = item => <View style={[row, { gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }]}><MenuButton icon={ArrowDownUp} label={`Registrar movimiento de ${item.nombre}`} onPress={() => open('movement', item)}>Movimiento</MenuButton><MenuButton icon={Edit3} label={`Editar ${item.nombre}`} onPress={() => open('edit', item)} /><MenuButton icon={Trash2} label={`Eliminar ${item.nombre}`} onPress={() => open('delete', item)} /></View>;
  const stat = (label, value, tone = c.text) => <View style={{ flex: 1, gap: 5 }}><Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: tone, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{quantity(value)}</Text></View>;
  const levelStatus = item => { const meta = STATES[item.levels.status]; return <Status tone={meta.tone === 'primary' ? 'neutral' : meta.tone}>{item.levels.shortage > 0 ? `Faltan ${quantity(item.levels.shortage)}` : meta.label}</Status>; };
  const fieldsRow = { flexDirection: compact ? 'column' : 'row', gap: 14 };
  const field = (key, label, props = {}) => <MenuField containerStyle={{ flex: 1 }} label={label} value={form[key]} onChangeText={v => change(key, v)} editable={!busy} {...props} />;
  const title = dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : dialog?.item ? 'Editar insumo' : 'Nuevo insumo';

  const lowCount = items.filter(i => i.levels.status === 'low').length, emptyCount = items.filter(i => i.levels.status === 'empty').length;
  const rowMenu = i => <ActionMenu label={`Acciones de ${i.nombre}`} actions={[
    { label: 'Registrar movimiento', icon: ArrowDownUp, onPress: () => open('movement', i) },
    { label: 'Editar datos', icon: Edit3, onPress: () => open('edit', i) },
    { divider: true },
    { label: 'Eliminar', icon: Trash2, tone: 'danger', onPress: () => open('delete', i) },
  ]} />;
  const toolbar = <View style={{ padding: space.sm, gap: space.sm }}>
    <Tabs value={status} onChange={setStatus}
      options={Object.entries(STATES).map(([key, meta]) => ({ value: key, label: key === 'all' ? 'Todos' : meta.title, count: key === 'all' ? items.length : items.filter(i => i.levels.status === key).length }))} />
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.sm, alignItems: compact ? 'stretch' : 'center' }}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar insumos" style={compact ? null : { flex: 1 }} />
      {categories.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: space.xs }}>
        <MenuChip selected={!category} onPress={() => setCategory(null)}>Todas las categorías</MenuChip>{categories.map(cat => <MenuChip key={cat} selected={category === cat} onPress={() => setCategory(cat)}>{cat}</MenuChip>)}
      </ScrollView> : null}
    </View>
  </View>;
  return <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Inventario" description={push === 'active' ? 'Te avisamos al teléfono cuando algo esté por acabarse.' : 'Al vender, cada plato descuenta sus ingredientes de la receta.'}
        actions={<View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {push !== 'active' && pushSupport() !== 'unsupported' ? <Button onPress={askPush}>Avisarme al teléfono</Button> : null}
          <Button variant="primary" onPress={() => open('edit')}>Agregar insumo</Button>
        </View>} />
      {lowCount + emptyCount > 0 ? <Banner tone="warning" style={{ marginBottom: space.lg }} title={`${lowCount + emptyCount} ${lowCount + emptyCount === 1 ? 'insumo necesita' : 'insumos necesitan'} reposición`}
        action={status === 'all' ? <Button size="sm" onPress={() => setStatus(emptyCount ? 'empty' : 'low')}>Ver insumos</Button> : null}>
        {`${emptyCount ? `${emptyCount} sin disponible` : ''}${emptyCount && lowCount ? ' · ' : ''}${lowCount ? `${lowCount} bajo el mínimo` : ''}.`}
      </Banner> : null}
      {loading && !items.length ? <Card padded={false}><View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} height={36} />)}</View></Card>
        : !items.length ? <Card><EmptyState icon={Package} title="Registra tus insumos" description="Unidades, costo y el mínimo que necesitas mantener. Los productos y recetas descuentan de aquí."
          action={<Button variant="primary" onPress={() => open('edit')}>Agregar insumo</Button>} /></Card>
        : <DataTable toolbar={toolbar} selectedKey={dialog?.item?.id} rows={filtered} onRowPress={item => open('movement', item)}
          columns={compact ? [
            { key: 'n', label: 'Insumo', flex: 1, render: i => <View style={{ gap: 4, minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{i.nombre}</Text><Meter item={i} c={c} width={96} /></View> },
            { key: 'q', label: 'Disponible', width: 110, align: 'right', render: i => <View style={{ alignItems: 'flex-end', gap: 2 }}><Text style={[type.body, type.num, { color: c.text }]}>{quantity(i.levels.available)} {unitLabel(i.unidad)}</Text>{i.levels.status !== 'ok' ? levelStatus(i) : null}</View> },
          ] : [
            { key: 'n', label: 'Insumo', flex: 2.2, sortValue: i => i.nombre, render: i => <View style={{ minWidth: 0 }}><Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{i.nombre}</Text><Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{i.categoria || 'Sin categoría'}{i.proveedor ? ` · ${i.proveedor}` : ''}</Text></View> },
            { key: 's', label: 'Estado', width: 130, sortValue: i => ({ empty: 0, low: 1, ok: 2 })[i.levels.status], render: i => levelStatus(i) },
            { key: 'm', label: 'Nivel', flex: 1.8, render: i => <View style={{ gap: 4, width: '100%', paddingRight: space.lg }}><Meter item={i} c={c} /><Text style={[type.small, type.num, { color: c.muted }]}>Mínimo {quantity(i.stock_minimo)} {unitLabel(i.unidad)}{Number(i.levels.reserved) ? ` · ${quantity(i.levels.reserved)} reservado` : ''}</Text></View> },
            { key: 'q', label: 'Disponible', width: 110, sortValue: i => Number(i.levels.available), align: 'right', render: i => <Text style={[type.body, type.num, { color: c.text }]}>{quantity(i.levels.available)} {unitLabel(i.unidad)}</Text> },
            { key: 'c', label: 'Costo / ud.', width: 96, sortValue: i => Number(i.costo_unitario), align: 'right', render: i => <Text style={[type.body, type.num, { color: c.text }]}>{money(i.costo_unitario)}</Text> },
            { key: 'a', label: '', width: 40, align: 'right', actions: true, render: rowMenu },
          ]}
          empty={<EmptyState compact icon={Search} title="Sin coincidencias" description="Prueba otra búsqueda o revisa todas las categorías."
            action={<Button onPress={() => { setQuery(''); setStatus('all'); setCategory(null); }}>Quitar filtros</Button>} />} />}
      {items.length ? <Text style={[type.body, { color: c.muted, marginTop: space.md, textAlign: 'center' }]}>Toca un insumo para registrar una entrada, salida o ajuste.</Text> : null}
    </ScrollView>
    <MenuModal visible={!!dialog} title={title} subtitle={dialog?.kind === 'edit' ? 'Configura los datos y niveles de reposición.' : current?.nombre} maxWidth={650} close={close} busy={busy} footer={<View style={[row, { justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }]}><MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton><MenuButton busy={busy} danger={dialog?.kind === 'delete'} primary={dialog?.kind !== 'delete'} onPress={submit}>{dialog?.kind === 'movement' ? 'Registrar movimiento' : dialog?.kind === 'delete' ? 'Eliminar insumo' : 'Guardar insumo'}</MenuButton></View>}>
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
      {dialog?.kind === 'delete' ? <MenuNotice>Si lo usan productos, recetas o movimientos, el sistema no dejará borrarlo.</MenuNotice> : dialog?.kind === 'movement' ? <>
        <View style={[row, { padding: 14, borderRadius: 8, backgroundColor: c.surfaceAlt, gap: 10 }]}>{stat(`Físico (${current.unidad})`, inventoryStock(current).physical)}{stat('Reservado', inventoryStock(current).reserved)}{stat('Disponible', inventoryStock(current).available)}</View>
        <View style={{ gap: 10 }}><View style={[row, { flexWrap: 'wrap', gap: 8 }]}><Segmented value={movement.tipo} onChange={v => !busy && setMovement(m => ({ ...m, tipo: v }))} accessibilityLabel="Tipo de movimiento" options={Object.keys(MOVES).map(k => ({ value: k, label: k, icon: MOVES[k].icon }))} /></View><Text style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>{MOVES[movement.tipo].hint}</Text></View>
        <MenuField label={movement.tipo === 'Ajuste' ? `Conteo físico final (${current.unidad})` : `Cantidad (${current.unidad})`} value={movement.cantidad} editable={!busy} onChangeText={v => setMovement(m => ({ ...m, cantidad: v }))} keyboardType="decimal-pad" placeholder="0" hint="Admite hasta 3 decimales." />
        <MenuField label="Motivo" value={movement.motivo} editable={!busy} onChangeText={v => setMovement(m => ({ ...m, motivo: v }))} placeholder="Ej. Compra, merma o conteo de cierre" maxLength={250} />
        {preview?.error ? <MenuNotice danger>{preview.error}</MenuNotice> : preview ? <View style={{ padding: 16, gap: 10, borderRadius: 8, backgroundColor: c.primarySoft }}><Text style={{ color: c.primaryText, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>VISTA PREVIA DEL STOCK FÍSICO</Text><View style={[row, { gap: 12 }]}><Text style={{ color: c.muted, fontSize: 21 }}>{quantity(current.stock)}</Text><ArrowRight size={20} color={c.primaryText} /><Text style={{ color: c.text, fontSize: 23, fontWeight: '700' }}>{quantity(preview.next)} {current.unidad}</Text></View><Text style={{ color: c.muted, fontSize: 12 }}>Disponible después: {quantity(preview.available)}. Se valida de nuevo al guardar.</Text></View> : null}
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
