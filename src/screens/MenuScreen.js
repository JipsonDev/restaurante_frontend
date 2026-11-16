import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Archive, ArrowDownUp, BadgePercent, Check, ChefHat, Edit3, Eye, EyeOff, ImagePlus, LayoutGrid, List, Package, Plus, Search, Trash2, Utensils, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Alert } from '../utils/adminAlert';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { ActionMenu, Badge, Button, Card, DataTable, EmptyState, FadeIn, IconButton, PageHeader, Press, SearchField, Segmented, Skeleton, Status, Switch as Toggle, Tabs, money as fmtMoney, radius, space, type, useToast } from '../components/admin/ui';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice, MenuSection } from '../components/MenuUI';
import { normalizeCatalogText as normalize, productPayload, productStatus, productStock, recipeEstimate, stockMode } from '../utils/menuLogic.mjs';

const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EMPTY = { id: null, nombre: '', descripcion: '', precio: '', stock: '0', categoria_id: null, disponible: true, imagen_url: null, imageAsset: null, inventario_item_id: null, receta: [], mode: 'own' };
const EMPTY_CATEGORY = { id: null, nombre: '', icono: '', activo: true };
const STATUS = { available: 'Activo', empty: 'Agotado', hidden: 'Oculto' };
const MODES = { own: 'Stock propio', linked: 'Insumo vinculado', recipe: 'Por receta' };
const PAGE_SIZE = 24;
const errorText = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'No se pudo completar la operación.';
const promo = product => normalize(`${product.nombre} ${product.categoria_nombre} ${product.descripcion}`).includes('promo');

function ProductImage({ uri, height = 132, style }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={[{ height, backgroundColor: c.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
    {uri && !failed ? <Image source={{ uri: assetUrl(uri) }} resizeMode="cover" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /> : <View style={{ alignItems: 'center', gap: 8 }}><Utensils size={28} color={c.faint} /><Text style={{ color: c.muted, fontSize: 12 }}>{failed ? 'Imagen no disponible' : 'Sin fotografía'}</Text></View>}
  </View>;
}
function StatusBadge({ product }) {
  const status = productStatus(product);
  return <Status tone={{ available: 'green', empty: 'amber', hidden: 'neutral' }[status]}>{STATUS[status]}</Status>;
}
export default function MenuScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 680;
  const { productos, categorias, inventario, loading, createProducto, updateProducto, deleteProducto, createCategoria, updateCategoria, deleteCategoria } = useAdmin();
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name'), [layout, setLayout] = useState('list'), [limit, setLimit] = useState(PAGE_SIZE);
  const [contentWidth, setContentWidth] = useState(800);
  const [modalOpen, setModalOpen] = useState(false), [formTab, setFormTab] = useState('info');
  const [form, setForm] = useState(EMPTY), [formError, setFormError] = useState(''), [saving, setSaving] = useState(false), [loadingEdit, setLoadingEdit] = useState(null);
  const [categoryModal, setCategoryModal] = useState(false), [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY), [categorySaving, setCategorySaving] = useState(false), [categoryError, setCategoryError] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState(''), [pending, setPending] = useState([]), [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const toast = useToast();
  const busy = useRef(false), categoryBusy = useRef(false), toggleBusy = useRef(new Set()), version = useRef(0), baseline = useRef(''), categoryBaseline = useRef(JSON.stringify(EMPTY_CATEGORY));
  useEffect(() => () => { version.current += 1; }, []);
  useEffect(() => setLimit(PAGE_SIZE), [query, category, status, sort]);
  useEffect(() => { if (!notice) return; toast.show(notice); setNotice(''); }, [notice]);
  const activeCategories = categorias.filter(item => Number(item.activo) !== 0);
  const activeInventory = inventario.filter(item => Number(item.activo) !== 0);
  const counts = useMemo(() => productos.reduce((acc, product) => { acc[productStatus(product)] += 1; return acc; }, { available: 0, empty: 0, hidden: 0 }), [productos]);
  const filtered = useMemo(() => productos.filter(product => normalize(`${product.nombre} ${product.descripcion} ${product.categoria_nombre} ${product.id}`).includes(normalize(query)) && (category === 'all' || Number(product.categoria_id) === Number(category)) && (status === 'all' || productStatus(product) === status)).sort((a, b) => sort === 'price' ? Number(a.precio) - Number(b.precio) || Number(a.id) - Number(b.id) : sort === 'stock' ? productStock(a) - productStock(b) || Number(a.id) - Number(b.id) : String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' }) || Number(a.id) - Number(b.id)), [productos, query, category, status, sort]);
  const columns = contentWidth >= 1040 ? 4 : contentWidth >= 750 ? 3 : contentWidth >= 500 ? 2 : 1;
  const cardWidth = Math.max(0, Math.floor((contentWidth - (columns - 1) * 14 - 2) / columns));
  const estimate = useMemo(() => recipeEstimate(form, inventario), [form, inventario]);
  const formCategory = categorias.find(item => Number(item.id) === Number(form.categoria_id));
  const categoryCount = item => productos.filter(product => Number(product.categoria_id) === Number(item.id)).length;
  const confirmAction = (title, message, action, actionLabel = 'Descartar') => {
    setConfirmation({ title, message, action, actionLabel });
  };
  const setField = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setFormError(''); };
  const beginForm = next => { setForm(next); baseline.current = JSON.stringify(next); setFormError(''); setFormTab('info'); setIngredientQuery(''); setModalOpen(true); };
  const closeForm = () => {
    if (busy.current) return;
    if (JSON.stringify(form) !== baseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de este producto?', () => setModalOpen(false));
    else setModalOpen(false);
  };
  const openNew = (promotion = false) => {
    version.current += 1;
    setLoadingEdit(null);
    const selected = activeCategories.find(item => Number(item.id) === Number(category));
    const promoCategory = activeCategories.find(item => normalize(item.nombre).includes('promo'));
    beginForm({ ...EMPTY, nombre: promotion ? 'Promo ' : '', categoria_id: (promotion ? promoCategory : selected)?.id || activeCategories[0]?.id || null });
  };
  const openEdit = async product => {
    const token = ++version.current;
    setLoadingEdit(product.id);
    try {
      const { data } = await axios.get(`${BASE_URL}/productos/${product.id}/receta`, { timeout: 10000 });
      if (!Array.isArray(data)) throw new Error('No se pudo leer la receta.');
      if (version.current !== token) return;
      const mode = data.some(line => Number(line.activo) !== 0) ? 'recipe' : product.inventario_item_id ? 'linked' : 'own';
      beginForm({ ...EMPTY, ...product, precio: String(product.precio ?? ''), stock: String(product.stock ?? 0), descripcion: product.descripcion || '', disponible: Number(product.disponible) === 1, imageAsset: null, originalStock: Number(product.stock || 0), originalMode: mode, originalCategory: product.categoria_id, reserved: Number(product.stock_reservado || 0), mode,
        receta: data.filter(line => Number(line.activo) !== 0).map(line => ({ inventario_item_id: line.inventario_item_id, cantidad: String(line.cantidad), unidad: line.inventario_unidad || line.unidad || '' })) });
    } catch (error) { if (version.current === token) Alert.alert('No se pudo abrir el producto', errorText(error)); }
    finally { if (version.current === token) setLoadingEdit(null); }
  };
  const saveProduct = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setFormError('');
    try {
      const payload = productPayload(form, categorias, inventario);
      if (form.imageAsset) {
        const asset = form.imageAsset, data = new FormData();
        if (Platform.OS === 'web') { const response = await fetch(asset.uri); data.append('image', await response.blob(), asset.fileName || 'producto.jpg'); }
        else data.append('image', { uri: asset.uri, name: asset.fileName || 'producto.jpg', type: asset.mimeType || 'image/jpeg' });
        const uploaded = await axios.post(`${BASE_URL}/productos/upload`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
        payload.imagen_url = uploaded.data.imagen_url;
        setForm(previous => ({ ...previous, imagen_url: payload.imagen_url, imageAsset: null }));
      }
      if (form.id) await updateProducto(form.id, payload); else await createProducto(payload);
      setModalOpen(false); setNotice(form.id ? 'Producto actualizado.' : 'Producto creado.');
    } catch (error) { setFormError(errorText(error)); }
    finally { busy.current = false; setSaving(false); }
  };
  const pickImage = async () => {
    if (saving) return;
    try {
      if (Platform.OS !== 'web') { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) throw new Error('Se necesita acceso a la galería para seleccionar una imagen.'); }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize > 5 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 5 MB.');
      setForm(previous => ({ ...previous, imageAsset: asset, imagen_url: asset.uri }));
    } catch (error) { setFormError(errorText(error)); }
  };
  const toggleProduct = async product => {
    if (toggleBusy.current.has(product.id)) return;
    if (Number(product.disponible) !== 1 && product.categoria_activa != null && Number(product.categoria_activa) === 0) { Alert.alert('Categoría inactiva', 'Activa su categoría antes de publicar el producto.'); return; }
    toggleBusy.current.add(product.id); setPending([...toggleBusy.current]);
    try { await updateProducto(product.id, { disponible: Number(product.disponible) === 1 ? 0 : 1 }); { const hid = Number(product.disponible) === 1; toast.show(`${product.nombre} ${hid ? 'oculto del menú' : 'publicado en el menú'}`, 'green', 5000, { label: 'Deshacer', onPress: () => updateProducto(product.id, { disponible: hid ? 1 : 0 }).catch(e => toast.show(errorText(e), 'red')) }); } }
    catch (error) { Alert.alert('No se pudo cambiar la publicación', errorText(error)); }
    finally { toggleBusy.current.delete(product.id); setPending([...toggleBusy.current]); }
  };
  const deleteCurrent = () => confirmAction('Eliminar producto', `Se eliminará “${form.nombre}” solo si no tiene pedidos históricos. Puedes ocultarlo para conservarlo.`, async () => {
    if (busy.current) return; busy.current = true; setSaving(true);
    try { await deleteProducto(form.id); setModalOpen(false); setNotice('Producto eliminado.'); }
    catch (error) { setFormError(errorText(error)); }
    finally { busy.current = false; setSaving(false); }
  }, 'Eliminar');
  const startCategory = (item = EMPTY_CATEGORY) => {
    const next = { id: item.id, nombre: item.nombre || '', icono: item.icono || '', activo: Number(item.activo) !== 0 };
    setCategoryForm(next); categoryBaseline.current = JSON.stringify(next); setCategoryError(''); setCategoryModal(true);
  };
  const closeCategories = () => {
    if (categoryBusy.current) return;
    if (JSON.stringify(categoryForm) !== categoryBaseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de esta categoría?', () => setCategoryModal(false)); else setCategoryModal(false);
  };
  const saveCategory = async () => {
    if (categoryBusy.current) return;
    categoryBusy.current = true; setCategorySaving(true); setCategoryError('');
    try {
      const nombre = categoryForm.nombre.trim();
      if (!nombre) throw new Error('Escribe el nombre de la categoría.');
      if (categoryForm.activo && categorias.some(item => Number(item.id) !== Number(categoryForm.id) && Number(item.activo) !== 0 && normalize(item.nombre) === normalize(nombre))) throw new Error('Ya existe una categoría activa con ese nombre.');
      const payload = { nombre, icono: categoryForm.icono.trim() || null, activo: categoryForm.activo ? 1 : 0 };
      if (categoryForm.id) await updateCategoria(categoryForm.id, payload); else await createCategoria(payload);
      startCategory(); setNotice('Categoría guardada.');
    } catch (error) { setCategoryError(errorText(error)); }
    finally { categoryBusy.current = false; setCategorySaving(false); }
  };
  const removeCategory = item => confirmAction('Eliminar categoría', `¿Eliminar “${item.nombre}”? Debe estar vacía.`, async () => {
    if (categoryBusy.current) return; categoryBusy.current = true; setCategorySaving(true);
    try { await deleteCategoria(item.id); if (Number(category) === Number(item.id)) setCategory('all'); if (Number(categoryForm.id) === Number(item.id)) startCategory(); setNotice('Categoría eliminada.'); }
    catch (error) { setCategoryError(errorText(error)); }
    finally { categoryBusy.current = false; setCategorySaving(false); }
  }, 'Eliminar');
  const ingredientResults = activeInventory.filter(item => normalize(item.nombre).includes(normalize(ingredientQuery)));
  const updateRecipe = (id, cantidad) => setForm(previous => ({ ...previous, receta: previous.receta.map(line => Number(line.inventario_item_id) === Number(id) ? { ...line, cantidad } : line) }));
  const addIngredient = item => setForm(previous => previous.receta.some(line => Number(line.inventario_item_id) === Number(item.id)) ? previous : { ...previous, receta: [...previous.receta, { inventario_item_id: item.id, cantidad: '1', unidad: item.unidad || '' }] });
  const resetFilters = () => { setQuery(''); setCategory('all'); setStatus('all'); };
  const thumb = (product, size = 44) => <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
    {product.imagen_url ? <Image source={{ uri: assetUrl(product.imagen_url) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : <Utensils size={Math.round(size * 0.4)} color={c.faint} />}
  </View>;
  // Publicar / ocultar varios a la vez, con «Deshacer».
  const setVisibility = async (rows, visible) => {
    const target = rows.filter(p => (Number(p.disponible) === 1) !== visible);
    if (!target.length) { toast.show(visible ? 'Ya estaban publicados.' : 'Ya estaban ocultos.'); return; }
    try {
      for (const p of target) await updateProducto(p.id, { disponible: visible ? 1 : 0 });
      toast.show(`${target.length === 1 ? target[0].nombre : `${target.length} productos`} ${visible ? (target.length === 1 ? 'publicado' : 'publicados') : (target.length === 1 ? 'oculto' : 'ocultos')}`, 'green', 5000,
        { label: 'Deshacer', onPress: async () => { try { for (const p of target) await updateProducto(p.id, { disponible: visible ? 0 : 1 }); } catch (e) { toast.show(errorText(e), 'red'); } } });
    } catch (error) { toast.show(errorText(error), 'red'); }
  };
  const stockLabel = p => { const n = productStock(p); return productStatus(p) === 'hidden' ? '—' : `${n} ${String(n) === '1' ? 'disponible' : 'disponibles'}`; };
  const rowMenu = p => <ActionMenu label={`Acciones de ${p.nombre}`} actions={[
    { label: 'Editar', icon: Edit3, onPress: () => openEdit(p) },
    Number(p.disponible) === 1 ? { label: 'Ocultar del menú', icon: EyeOff, onPress: () => toggleProduct(p) } : { label: 'Publicar en el menú', icon: Eye, onPress: () => toggleProduct(p) },
  ]} />;
  const listColumns = phone ? [
    { key: 'n', label: 'Producto', flex: 1, render: p => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}>{thumb(p, 40)}<View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{p.nombre}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><StatusBadge product={p} /><Text style={[type.body, { color: c.muted }]}>{stockLabel(p)}</Text></View></View></View> },
    { key: 'price', label: 'Precio', width: 72, align: 'right', render: p => <Text style={[type.body, type.num, { color: c.text }]}>{money(p.precio)}</Text> },
  ] : [
    { key: 'n', label: 'Producto', flex: 3, sortValue: p => p.nombre, render: p => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}>{thumb(p, 40)}
      <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600', flexShrink: 1 }]}>{p.nombre}</Text>{promo(p) ? <Badge tone="info">Promo</Badge> : null}</View> },
    { key: 'st', label: 'Estado', width: 110, sortValue: p => ({ available: 0, empty: 1, hidden: 2 })[productStatus(p)], render: p => <StatusBadge product={p} /> },
    { key: 'stock', label: 'Inventario', flex: 1.3, sortValue: p => Number(productStock(p)) || 0, render: p => <View><Text numberOfLines={1} style={[type.body, type.num, { color: productStatus(p) === 'empty' ? c.red : c.text }]}>{stockLabel(p)}</Text>
      <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{MODES[stockMode(p)]}</Text></View> },
    { key: 'cat', label: 'Categoría', flex: 1.2, sortValue: p => p.categoria_nombre || '', render: p => <Text numberOfLines={1} style={[type.body, { color: c.text }]}>{p.categoria_nombre || 'Sin categoría'}</Text> },
    { key: 'price', label: 'Precio', width: 96, sortValue: p => Number(p.precio), align: 'right', render: p => <Text style={[type.body, type.num, { color: c.text }]}>{money(p.precio)}</Text> },
    { key: 'a', label: '', width: 40, align: 'right', actions: true, render: rowMenu },
  ];
  const statusTabs = [{ value: 'all', label: 'Todos', count: productos.length }, { value: 'available', label: 'Activos', count: counts.available }, { value: 'empty', label: 'Agotados', count: counts.empty }, { value: 'hidden', label: 'Ocultos', count: counts.hidden }];
  const toolbar = <View style={{ padding: space.sm, gap: space.sm }}>
    <Tabs value={status} onChange={setStatus} options={statusTabs} />
    <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.sm, alignItems: phone ? 'stretch' : 'center' }}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar productos" style={phone ? null : { flex: 1 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: space.xs }}>
        <MenuChip selected={category === 'all'} onPress={() => setCategory('all')}>Todas las categorías</MenuChip>
        {categorias.map(item => <MenuChip key={item.id} selected={String(category) === String(item.id)} onPress={() => setCategory(String(item.id))}>{`${item.nombre}${Number(item.activo) === 0 ? ' (inactiva)' : ''}`}</MenuChip>)}
      </ScrollView>
    </View>
  </View>;
  return <View style={{ flex: 1 }}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Menú"
        actions={phone ? <><ActionMenu label="Más acciones" actions={[{ label: 'Categorías', icon: Utensils, onPress: () => startCategory() }, { label: 'Crear promoción', icon: BadgePercent, onPress: () => openNew(true) }]} /><Button variant="primary" onPress={() => openNew()}>Agregar producto</Button></>
          : <><Button onPress={() => startCategory()}>Categorías</Button><Button onPress={() => openNew(true)}>Crear promoción</Button><Button variant="primary" onPress={() => openNew()}>Agregar producto</Button></>} />
      {loading && !productos.length ? <Card padded={false}><View style={{ padding: space.lg, gap: space.md }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={40} />)}</View></Card>
        : !productos.length ? <Card><EmptyState icon={Utensils} title="Agrega tu primer producto" description="Crea una categoría y luego los productos que verá el mesero al tomar pedidos."
          action={<Button variant="primary" onPress={() => openNew()}>Agregar producto</Button>} /></Card>
        : <DataTable toolbar={toolbar} columns={listColumns} rows={filtered} onRowPress={openEdit} rowStyle={p => loadingEdit === p.id ? { opacity: 0.6 } : null}
          selectable={!phone} bulkActions={[{ label: 'Publicar', onPress: rows => setVisibility(rows, true) }, { label: 'Ocultar', onPress: rows => setVisibility(rows, false) }]}
          empty={<EmptyState compact icon={Search} title="Sin coincidencias" description="Prueba otra búsqueda o quita los filtros." action={<Button onPress={resetFilters}>Quitar filtros</Button>} />} />}
    </ScrollView>
    <MenuModal visible={modalOpen} title={form.id ? 'Editar producto' : 'Nuevo producto'} subtitle="Así lo verá el mesero al tomar el pedido." close={closeForm}
      tabs={<Tabs value={formTab} onChange={setFormTab} style={{ paddingHorizontal: space.xl }} options={[{ value: 'info', label: 'Información' }, { value: 'stock', label: 'Existencias y receta' }, { value: 'image', label: 'Fotografía' }]} />}
      footer={<>{!!formError && <MenuNotice danger>{formError}</MenuNotice>}<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><MenuButton disabled={saving} onPress={closeForm}>Cancelar</MenuButton><MenuButton primary icon={Check} busy={saving} onPress={saveProduct}>{form.id ? 'Guardar cambios' : 'Crear producto'}</MenuButton></View></>}>
      {formTab === 'info' && <MenuSection title="Información del producto" subtitle="El nombre, la descripción y el precio aparecen en el menú del mesero.">
        <MenuField label="Nombre del producto" maxLength={80} value={form.nombre} onChangeText={value => setField('nombre', value)} placeholder="Ej. Cappuccino" editable={!saving} />
        <MenuField label="Descripción" multiline maxLength={1500} value={form.descripcion} onChangeText={value => setField('descripcion', value)} placeholder="Ingredientes principales y presentación" editable={!saving} />
        <MenuField label="Precio de venta" value={form.precio} onChangeText={value => setField('precio', value)} keyboardType="decimal-pad" placeholder="0,00" hint="Admite hasta dos decimales. Se conservan los precios de pedidos ya confirmados." editable={!saving} />
        {form.precio.trim() && Number(form.precio.replace(',', '.')) === 0 ? <MenuNotice>Precio cero: este producto se registrará sin importe. Verifica que sea intencional.</MenuNotice> : null}
        <View style={{ gap: 8 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Categoría</Text>{!categorias.length && <MenuNotice>No hay categorías registradas. Crea una desde Categorías antes de guardar el producto.</MenuNotice>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{categorias.filter(item => Number(item.activo) !== 0 || Number(item.id) === Number(form.categoria_id)).map(item => <MenuChip key={item.id} selected={Number(form.categoria_id) === Number(item.id)} onPress={() => !saving && Number(item.activo) !== 0 && setField('categoria_id', item.id)}>{`${item.nombre}${Number(item.activo) === 0 ? ' · Inactiva' : ''}`}</MenuChip>)}</View></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, borderRadius: 8 }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Publicado en el menú</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>Ocultarlo impide nuevas ventas y conserva su historial. Agotado significa que está publicado, pero sin existencias.</Text></View><Toggle showLabel={false} label="Publicado en el menú" disabled={saving} value={form.disponible} onValueChange={value => value && Number(formCategory?.activo) === 0 ? setFormError('Activa la categoría o selecciona otra antes de publicar.') : setField('disponible', value)} /></View>
        {form.id && <View style={{ alignItems: 'flex-start', paddingTop: 6 }}><MenuButton danger icon={Trash2} disabled={saving} onPress={deleteCurrent}>Eliminar producto sin historial</MenuButton></View>}
      </MenuSection>}
      {formTab === 'stock' && <MenuSection title="Control de existencias" subtitle="Elige una fuente. El sistema reserva unidades al confirmar el pedido y descuenta el consumo al preparar.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(MODES).map(([key,label]) => <MenuChip key={key} selected={form.mode === key} onPress={() => !saving && setField('mode', key)}>{label}</MenuChip>)}</View>
        {form.mode === 'own' ? <>
          <MenuField label="Existencias físicas" value={form.stock} onChangeText={value => setField('stock', value)} keyboardType="number-pad" placeholder="0" hint="Unidades enteras del producto terminado. Los productos nuevos comienzan en cero." editable={!saving} />
          {!!form.id && <MenuNotice>{`${form.reserved || 0} unidades reservadas en pedidos. Si no modificas las existencias, el guardado respeta las ventas realizadas mientras editabas.`}</MenuNotice>}
        </> : <>
          <MenuNotice>{form.mode === 'linked' ? 'Cada unidad vendida consume 1 unidad del insumo elegido. Para fracciones o varios ingredientes, usa una receta.' : 'Las cantidades corresponden a UNA unidad vendida y se expresan en la unidad del inventario. Ejemplo: 20 g de un insumo almacenado en kg se ingresan como 0,020 kg.'}</MenuNotice>
          <MenuField label="Buscar insumo" value={ingredientQuery} onChangeText={setIngredientQuery} placeholder="Nombre del insumo" />
          <View style={{ maxHeight: 160, borderWidth: 1, borderColor: c.line, borderRadius: 8 }}><ScrollView keyboardShouldPersistTaps="handled">{ingredientResults.map(item => {
            const selected = form.mode === 'linked' ? Number(item.id) === Number(form.inventario_item_id) : form.receta.some(line => Number(line.inventario_item_id) === Number(item.id));
            return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${form.mode === 'linked' ? 'Vincular' : 'Agregar'} ${item.nombre}`} accessibilityState={{ selected }} disabled={saving} onPress={() => form.mode === 'linked' ? setField('inventario_item_id', item.id) : addIngredient(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: selected ? c.primarySoft : c.surface, borderBottomWidth: 1, borderBottomColor: c.line }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{Math.max(0, Number(item.stock || 0) - Number(item.stock_reservado || 0)).toLocaleString('es-EC')} {item.unidad} libres</Text></View>{selected ? <Check size={17} color={c.primaryText} /> : <Plus size={17} color={c.muted} />}</Pressable>;
          })}{!ingredientResults.length && <Text style={{ color: c.muted, padding: 18, fontSize: 12 }}>{activeInventory.length ? 'No hay coincidencias.' : 'No hay insumos activos. Regístralos primero en Inventario.'}</Text>}</ScrollView></View>
          {form.mode === 'recipe' && form.receta.map(line => {
            const item = inventario.find(item => Number(item.id) === Number(line.inventario_item_id));
            return <View key={line.inventario_item_id} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.line, gap: 10 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{item?.nombre || `Insumo no disponible #${line.inventario_item_id}`}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MenuField containerStyle={{ flex: 1 }} label={`Cantidad de ${item?.nombre || 'insumo'}`} value={line.cantidad} keyboardType="decimal-pad" onChangeText={value => updateRecipe(line.inventario_item_id, value)} editable={!saving} /><Text style={{ color: c.muted, fontSize: 12, paddingTop: 18 }}>{item?.unidad || line.unidad}</Text><MenuButton icon={Trash2} danger label={`Quitar ${item?.nombre || 'insumo'} de receta`} disabled={saving} onPress={() => setForm(previous => ({ ...previous, receta: previous.receta.filter(row => row.inventario_item_id !== line.inventario_item_id) }))} /></View></View>;
          })}
          {estimate && <View style={{ backgroundColor: c.surfaceAlt, padding: 14, borderRadius: 8, gap: 7 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{estimate.portions} unidades elaborables ahora</Text><Text style={{ color: c.muted, fontSize: 12 }}>Costo de insumos por unidad: {estimate.completeCost ? money(estimate.cost) : 'incompleto; revisa los costos del inventario'}.</Text><Text style={{ color: c.muted, fontSize: 12 }}>Estimación de materiales; no incluye personal, impuestos ni otros gastos.</Text>{estimate.completeCost && Number(form.precio.replace(',', '.')) > 0 && estimate.cost >= Number(form.precio.replace(',', '.')) && <MenuNotice>El costo de insumos alcanza o supera el precio de venta.</MenuNotice>}</View>}
        </>}
        {form.id && form.originalMode !== form.mode && <MenuNotice>El cambio se aplica a los próximos pedidos. Las reservas ya confirmadas conservan sus insumos originales.</MenuNotice>}
      </MenuSection>}
      {formTab === 'image' && <MenuSection title="Fotografía del producto" subtitle="Usa una imagen horizontal con buena luz. Tamaño máximo: 5 MB.">
        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 400, aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>{form.imagen_url ? <Image source={{ uri: form.imageAsset ? form.imagen_url : assetUrl(form.imagen_url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ImagePlus size={44} color={c.muted} />}</View>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}><MenuButton icon={ImagePlus} disabled={saving} onPress={pickImage}>{form.imagen_url ? 'Cambiar fotografía' : 'Seleccionar fotografía'}</MenuButton>{!!form.imagen_url && <MenuButton icon={Trash2} danger disabled={saving} label="Quitar fotografía" onPress={() => setForm(previous => ({ ...previous, imagen_url: null, imageAsset: null }))} />}</View>
      </MenuSection>}
    </MenuModal>

    <MenuModal visible={categoryModal} title="Categorías del menú" subtitle="Organiza los productos y controla qué grupos aparecen en el menú." maxWidth={720} close={closeCategories}>
      {!!categoryError && <MenuNotice danger>{categoryError}</MenuNotice>}
      <MenuSection title={categoryForm.id ? 'Editar categoría' : 'Nueva categoría'}>
        <MenuField label="Nombre de categoría" maxLength={80} value={categoryForm.nombre} onChangeText={value => setCategoryForm(previous => ({ ...previous, nombre: value }))} placeholder="Ej. Cafetería" editable={!categorySaving} />
        <MenuField label="Clave de icono (opcional)" maxLength={30} value={categoryForm.icono} onChangeText={value => setCategoryForm(previous => ({ ...previous, icono: value }))} placeholder="cafe, bebida, postre…" editable={!categorySaving} />
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Categoría activa</Text><Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>Al desactivarla se ocultan sus productos para nuevas ventas. Los pedidos e historial se conservan.</Text></View><Toggle showLabel={false} label="Categoría activa" value={categoryForm.activo} disabled={categorySaving} onValueChange={value => setCategoryForm(previous => ({ ...previous, activo: value }))} /></View>
        <View style={{ flexDirection: 'row', gap: 8 }}><MenuButton disabled={categorySaving} onPress={() => {
          if (JSON.stringify(categoryForm) !== categoryBaseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de esta categoría?', () => startCategory()); else startCategory();
        }}>Nueva / limpiar</MenuButton><MenuButton primary busy={categorySaving} onPress={saveCategory}>{categoryForm.id ? 'Guardar categoría' : 'Crear categoría'}</MenuButton></View>
      </MenuSection>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{categorias.length} categorías registradas</Text>{categorias.map(item => <View key={item.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{categoryCount(item)} productos · {Number(item.activo) !== 0 ? 'Activa' : 'Inactiva'}</Text></View><MenuButton icon={Edit3} label={`Editar categoría ${item.nombre}`} disabled={categorySaving} onPress={() => {
        if (JSON.stringify(categoryForm) !== categoryBaseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de la categoría actual?', () => startCategory(item)); else startCategory(item);
      }} /><MenuButton icon={Trash2} danger label={`Eliminar categoría ${item.nombre}`} disabled={categorySaving || categoryCount(item) > 0} onPress={() => removeCategory(item)} /></View>)}</View>
    </MenuModal>
    <MenuModal visible={!!confirmation} title={confirmation?.title || 'Confirmar acción'} maxWidth={440} close={() => setConfirmation(null)}
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><MenuButton onPress={() => setConfirmation(null)}>Seguir editando</MenuButton><MenuButton danger onPress={() => { const action = confirmation?.action; setConfirmation(null); action?.(); }}>{confirmation?.actionLabel || 'Confirmar'}</MenuButton></View>}>
      <Text style={{ color: c.text, fontSize: 14, lineHeight: 22 }}>{confirmation?.message}</Text>
    </MenuModal>
  </View>;
}
