import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Archive, ArrowDownUp, BadgePercent, Check, ChefHat, Edit3, Eye, EyeOff, ImagePlus, LayoutGrid, List, Package, Plus, Search, Trash2, Utensils, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { Alert } from '../utils/adminAlert';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuChip, MenuField, MenuModal, MenuNotice, MenuSection } from '../components/MenuUI';
import { normalizeCatalogText as normalize, productPayload, productStatus, productStock, recipeEstimate, stockMode } from '../utils/menuLogic.mjs';

const money = value => `$${Number(value || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EMPTY = { id: null, nombre: '', descripcion: '', precio: '', stock: '0', categoria_id: null, disponible: true, imagen_url: null, imageAsset: null, inventario_item_id: null, receta: [], mode: 'own' };
const EMPTY_CATEGORY = { id: null, nombre: '', icono: '', activo: true };
const STATUS = { available: 'Disponible', empty: 'Agotado', hidden: 'Oculto' };
const MODES = { own: 'Stock propio', linked: 'Insumo vinculado', recipe: 'Por receta' };
const PAGE_SIZE = 24;
const errorText = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'No se pudo completar la operación.';
const promo = product => normalize(`${product.nombre} ${product.categoria_nombre} ${product.descripcion}`).includes('promo');

function ProductImage({ uri, height = 132, style }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={[{ height, backgroundColor: c.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
    {uri && !failed ? <Image source={{ uri: assetUrl(uri) }} resizeMode="cover" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /> : <View style={{ alignItems: 'center', gap: 8 }}><Utensils size={28} color={c.faint} /><Text style={{ color: c.muted, fontSize: 10 }}>{failed ? 'Imagen no disponible' : 'Sin fotografía'}</Text></View>}
  </View>;
}
function StatusBadge({ product }) {
  const { c } = useTheme();
  const status = productStatus(product);
  const color = { available: c.green, empty: c.amber, hidden: c.muted }[status];
  const backgroundColor = { available: c.greenSoft, empty: c.amberSoft, hidden: c.soft }[status];
  return <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, backgroundColor, borderRadius: 12 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} /><Text style={{ color, fontSize: 10, fontWeight: '600' }}>{STATUS[status]}</Text></View>;
}

export default function MenuScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 680;
  const { productos, categorias, inventario, loading, createProducto, updateProducto, deleteProducto, createCategoria, updateCategoria, deleteCategoria } = useAdmin();
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name'), [layout, setLayout] = useState('grid'), [limit, setLimit] = useState(PAGE_SIZE);
  const [contentWidth, setContentWidth] = useState(800);
  const [modalOpen, setModalOpen] = useState(false), [formTab, setFormTab] = useState('info');
  const [form, setForm] = useState(EMPTY), [formError, setFormError] = useState(''), [saving, setSaving] = useState(false), [loadingEdit, setLoadingEdit] = useState(null);
  const [categoryModal, setCategoryModal] = useState(false), [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY), [categorySaving, setCategorySaving] = useState(false), [categoryError, setCategoryError] = useState('');
  const [ingredientQuery, setIngredientQuery] = useState(''), [pending, setPending] = useState([]), [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const busy = useRef(false), categoryBusy = useRef(false), toggleBusy = useRef(new Set()), version = useRef(0), baseline = useRef(''), categoryBaseline = useRef(JSON.stringify(EMPTY_CATEGORY));
  useEffect(() => () => { version.current += 1; }, []);
  useEffect(() => setLimit(PAGE_SIZE), [query, category, status, sort]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
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
    try { await updateProducto(product.id, { disponible: Number(product.disponible) === 1 ? 0 : 1 }); setNotice(Number(product.disponible) === 1 ? 'Producto oculto. Se conserva su historial.' : 'Producto publicado. La venta depende de sus existencias.'); }
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
  return <View style={{ flex: 1, gap: 14 }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24, gap: 18 }}>
      <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: 14 }}>
        <View style={{ flex: 1 }}><Text style={{ color: c.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 }}>CATÁLOGO DEL RESTAURANTE</Text><Text style={{ color: c.text, fontSize: 28, fontWeight: '700', marginTop: 7 }}>Menú y productos</Text><Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>Administra lo que vendes, cómo se presenta y sus existencias.</Text></View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><MenuButton icon={Utensils} onPress={() => startCategory()}>Categorías</MenuButton><MenuButton icon={Plus} primary onPress={() => openNew()}>Nuevo producto</MenuButton></View>
      </View>
      {!!notice && <View accessibilityRole="status" style={{ flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: c.greenSoft, borderRadius: 8, padding: 12 }}><Check color={c.green} size={17} /><Text style={{ flex: 1, color: c.green, fontSize: 12 }}>{notice}</Text><MenuButton icon={X} label="Cerrar aviso" onPress={() => setNotice('')} /></View>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[[productos.length, 'Productos', 'all', Package, c.primaryText, c.primarySoft], [counts.available, 'Disponibles', 'available', Eye, c.green, c.greenSoft], [counts.empty, 'Agotados', 'empty', Archive, c.amber, c.amberSoft], [counts.hidden, 'Ocultos', 'hidden', EyeOff, c.muted, c.soft]].map(([count, label, key, Icon, color, bg]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Filtrar ${label}`} accessibilityState={{ selected: status === key }} onPress={() => setStatus(key)} style={{ width: phone ? '46%' : '22%', flexGrow: 1, padding: 14, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: status === key ? c.primary : c.line, flexDirection: 'row', alignItems: 'center', gap: 11 }}><View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}><Icon size={18} color={color} /></View><View><Text style={{ color: c.text, fontWeight: '700', fontSize: 23 }}>{count}</Text><Text style={{ color: c.muted, fontSize: 11, marginTop: 3 }}>{label}</Text></View></Pressable>)}
      </View>
      <View style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 14, gap: 14 }}>
        <View style={{ flexDirection: phone ? 'column' : 'row', gap: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 12 }}><Search color={c.muted} size={18} /><TextInput accessibilityLabel="Buscar productos" value={query} onChangeText={setQuery} placeholder="Buscar por nombre, descripción, categoría o código…" placeholderTextColor={c.muted} style={{ flex: 1, minWidth: 0, minHeight: 44, color: c.text, fontSize: 12 }} />{!!query && <MenuButton icon={X} label="Limpiar búsqueda" onPress={() => setQuery('')} />}</View>
          <View style={{ flexDirection: 'row', gap: 8 }}><MenuButton icon={ArrowDownUp} onPress={() => setSort(previous => ({ name: 'price', price: 'stock', stock: 'name' })[previous])}>{`Orden: ${{ name: 'A–Z', price: 'menor precio', stock: 'menor stock' }[sort]}`}</MenuButton><MenuButton icon={layout === 'grid' ? List : LayoutGrid} label={layout === 'grid' ? 'Ver como lista' : 'Ver como tarjetas'} onPress={() => setLayout(previous => previous === 'grid' ? 'list' : 'grid')} /><MenuButton icon={BadgePercent} label="Crear promoción" onPress={() => openNew(true)} /></View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}><MenuChip selected={category === 'all'} onPress={() => setCategory('all')}>Todas las categorías</MenuChip>{categorias.map(item => <MenuChip key={item.id} selected={Number(category) === Number(item.id)} onPress={() => setCategory(item.id)}>{`${item.nombre} · ${categoryCount(item)}${Number(item.activo) === 0 ? ' · Inactiva' : ''}`}</MenuChip>)}</ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: c.muted, fontSize: 11 }}>{filtered.length} resultados · {status === 'all' ? 'Todos los estados' : STATUS[status]}</Text>{(query || category !== 'all' || status !== 'all') && <MenuButton onPress={resetFilters}>Limpiar filtros</MenuButton>}</View>
      </View>
      {loading && !productos.length ? <ActivityIndicator color={c.primary} /> : !filtered.length ? <View style={{ padding: 30, alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.line }}><Search size={30} color={c.muted} /><Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{productos.length ? 'No encontramos coincidencias' : 'Tu menú empieza aquí'}</Text><Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{productos.length ? 'Prueba otra búsqueda o limpia los filtros.' : 'Crea una categoría y agrega tu primer producto.'}</Text><MenuButton onPress={productos.length ? resetFilters : () => openNew()}>{productos.length ? 'Mostrar todos' : 'Agregar producto'}</MenuButton></View> : <View onLayout={event => setContentWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {filtered.slice(0, limit).map(product => {
          const asRow = layout === 'list', mode = stockMode(product);
          return <View key={product.id} style={{ width: asRow ? '100%' : cardWidth, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 10, overflow: 'hidden' }}>
            <View style={{ flexDirection: asRow && !phone ? 'row' : 'column' }}>
              <ProductImage uri={product.imagen_url} height={asRow ? 90 : 138} style={asRow && !phone ? { width: 116, height: 'auto', minHeight: 112 } : undefined} />
              <View style={{ padding: 15, flex: 1, minWidth: 0, gap: 11 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: c.muted, fontSize: 10, marginBottom: 5 }}>{product.categoria_nombre || 'Sin categoría'} · #{product.id}</Text><Text style={{ color: c.text, fontSize: 16, lineHeight: 22, fontWeight: '600' }} numberOfLines={2}>{product.nombre}</Text></View><Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginTop: 16 }}>{money(product.precio)}</Text></View>
                <Text numberOfLines={2} style={{ color: c.muted, fontSize: 12, lineHeight: 18, minHeight: asRow ? undefined : 36 }}>{product.descripcion || 'Agrega una descripción para presentar mejor este producto.'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}><StatusBadge product={product} /><Text style={{ color: c.muted, fontSize: 11 }}>{productStock(product)} para vender</Text>{promo(product) && <Text style={{ color: c.purple || c.primaryText, fontSize: 10, fontWeight: '600' }}>Promoción</Text>}</View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}><ChefHat size={14} color={c.muted} /><Text style={{ color: c.muted, fontSize: 10 }}>{MODES[mode]}</Text></View><MenuButton icon={Edit3} label={`Editar ${product.nombre}`} busy={loadingEdit === product.id} onPress={() => openEdit(product)}>Editar</MenuButton><MenuButton icon={Number(product.disponible) === 1 ? EyeOff : Eye} label={`${Number(product.disponible) === 1 ? 'Ocultar' : 'Publicar'} ${product.nombre}`} busy={pending.includes(product.id)} onPress={() => toggleProduct(product)} /></View>
              </View>
            </View>
          </View>;
        })}
      </View>}
      {filtered.length > limit && <MenuButton onPress={() => setLimit(previous => previous + PAGE_SIZE)}>{`Ver más productos (${filtered.length - limit} restantes)`}</MenuButton>}
    </ScrollView>

    <MenuModal visible={modalOpen} title={form.id ? 'Editar producto' : 'Nuevo producto'} subtitle="Información clara, precio y control de existencias en un solo lugar." close={closeForm}
      tabs={<View style={{ paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{[['info','Información'],['stock','Existencias y receta'],['image','Fotografía']].map(([key,label]) => <MenuChip key={key} selected={formTab === key} onPress={() => setFormTab(key)}>{label}</MenuChip>)}</ScrollView></View>}
      footer={<>{!!formError && <MenuNotice danger>{formError}</MenuNotice>}<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><MenuButton disabled={saving} onPress={closeForm}>Cancelar</MenuButton><MenuButton primary icon={Check} busy={saving} onPress={saveProduct}>{form.id ? 'Guardar cambios' : 'Crear producto'}</MenuButton></View></>}>
      {formTab === 'info' && <MenuSection title="Información del producto" subtitle="El nombre, la descripción y el precio aparecen en el menú del mesero.">
        <MenuField label="Nombre del producto" maxLength={80} value={form.nombre} onChangeText={value => setField('nombre', value)} placeholder="Ej. Cappuccino" editable={!saving} />
        <MenuField label="Descripción" multiline maxLength={1500} value={form.descripcion} onChangeText={value => setField('descripcion', value)} placeholder="Ingredientes principales y presentación" editable={!saving} />
        <MenuField label="Precio de venta" value={form.precio} onChangeText={value => setField('precio', value)} keyboardType="decimal-pad" placeholder="0,00" hint="Admite hasta dos decimales. Se conservan los precios de pedidos ya confirmados." editable={!saving} />
        {form.precio.trim() && Number(form.precio.replace(',', '.')) === 0 ? <MenuNotice>Precio cero: este producto se registrará sin importe. Verifica que sea intencional.</MenuNotice> : null}
        <View style={{ gap: 8 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>Categoría</Text>{!categorias.length && <MenuNotice>No hay categorías registradas. Crea una desde Categorías antes de guardar el producto.</MenuNotice>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{categorias.filter(item => Number(item.activo) !== 0 || Number(item.id) === Number(form.categoria_id)).map(item => <MenuChip key={item.id} selected={Number(form.categoria_id) === Number(item.id)} onPress={() => !saving && Number(item.activo) !== 0 && setField('categoria_id', item.id)}>{`${item.nombre}${Number(item.activo) === 0 ? ' · Inactiva' : ''}`}</MenuChip>)}</View></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surfaceAlt, borderRadius: 8 }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Publicado en el menú</Text><Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }}>Ocultarlo impide nuevas ventas y conserva su historial. Agotado significa que está publicado, pero sin existencias.</Text></View><Switch accessibilityLabel="Publicado en el menú" disabled={saving} value={form.disponible} onValueChange={value => value && Number(formCategory?.activo) === 0 ? setFormError('Activa la categoría o selecciona otra antes de publicar.') : setField('disponible', value)} trackColor={{ false: c.line, true: c.primary }} thumbColor={c.surface} /></View>
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
            return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${form.mode === 'linked' ? 'Vincular' : 'Agregar'} ${item.nombre}`} accessibilityState={{ selected }} disabled={saving} onPress={() => form.mode === 'linked' ? setField('inventario_item_id', item.id) : addIngredient(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: selected ? c.primarySoft : c.surface, borderBottomWidth: 1, borderBottomColor: c.line }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{Math.max(0, Number(item.stock || 0) - Number(item.stock_reservado || 0)).toLocaleString('es-EC')} {item.unidad} libres</Text></View>{selected ? <Check size={17} color={c.primaryText} /> : <Plus size={17} color={c.muted} />}</Pressable>;
          })}{!ingredientResults.length && <Text style={{ color: c.muted, padding: 18, fontSize: 12 }}>{activeInventory.length ? 'No hay coincidencias.' : 'No hay insumos activos. Regístralos primero en Inventario.'}</Text>}</ScrollView></View>
          {form.mode === 'recipe' && form.receta.map(line => {
            const item = inventario.find(item => Number(item.id) === Number(line.inventario_item_id));
            return <View key={line.inventario_item_id} style={{ padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.line, gap: 10 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{item?.nombre || `Insumo no disponible #${line.inventario_item_id}`}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MenuField containerStyle={{ flex: 1 }} label={`Cantidad de ${item?.nombre || 'insumo'}`} value={line.cantidad} keyboardType="decimal-pad" onChangeText={value => updateRecipe(line.inventario_item_id, value)} editable={!saving} /><Text style={{ color: c.muted, fontSize: 12, paddingTop: 18 }}>{item?.unidad || line.unidad}</Text><MenuButton icon={Trash2} danger label={`Quitar ${item?.nombre || 'insumo'} de receta`} disabled={saving} onPress={() => setForm(previous => ({ ...previous, receta: previous.receta.filter(row => row.inventario_item_id !== line.inventario_item_id) }))} /></View></View>;
          })}
          {estimate && <View style={{ backgroundColor: c.surfaceAlt, padding: 14, borderRadius: 8, gap: 7 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600' }}>{estimate.portions} unidades elaborables ahora</Text><Text style={{ color: c.muted, fontSize: 12 }}>Costo de insumos por unidad: {estimate.completeCost ? money(estimate.cost) : 'incompleto; revisa los costos del inventario'}.</Text><Text style={{ color: c.muted, fontSize: 11 }}>Estimación de materiales; no incluye personal, impuestos ni otros gastos.</Text>{estimate.completeCost && Number(form.precio.replace(',', '.')) > 0 && estimate.cost >= Number(form.precio.replace(',', '.')) && <MenuNotice>El costo de insumos alcanza o supera el precio de venta.</MenuNotice>}</View>}
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
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Categoría activa</Text><Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }}>Al desactivarla se ocultan sus productos para nuevas ventas. Los pedidos e historial se conservan.</Text></View><Switch accessibilityLabel="Categoría activa" value={categoryForm.activo} disabled={categorySaving} onValueChange={value => setCategoryForm(previous => ({ ...previous, activo: value }))} trackColor={{ true: c.primary, false: c.line }} thumbColor={c.surface} /></View>
        <View style={{ flexDirection: 'row', gap: 8 }}><MenuButton disabled={categorySaving} onPress={() => {
          if (JSON.stringify(categoryForm) !== categoryBaseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de esta categoría?', () => startCategory()); else startCategory();
        }}>Nueva / limpiar</MenuButton><MenuButton primary busy={categorySaving} onPress={saveCategory}>{categoryForm.id ? 'Guardar categoría' : 'Crear categoría'}</MenuButton></View>
      </MenuSection>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 16 }}><Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{categorias.length} categorías registradas</Text>{categorias.map(item => <View key={item.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>{item.nombre}</Text><Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{categoryCount(item)} productos · {Number(item.activo) !== 0 ? 'Activa' : 'Inactiva'}</Text></View><MenuButton icon={Edit3} label={`Editar categoría ${item.nombre}`} disabled={categorySaving} onPress={() => {
        if (JSON.stringify(categoryForm) !== categoryBaseline.current) confirmAction('Cambios sin guardar', '¿Descartar los cambios de la categoría actual?', () => startCategory(item)); else startCategory(item);
      }} /><MenuButton icon={Trash2} danger label={`Eliminar categoría ${item.nombre}`} disabled={categorySaving || categoryCount(item) > 0} onPress={() => removeCategory(item)} /></View>)}</View>
    </MenuModal>
    <MenuModal visible={!!confirmation} title={confirmation?.title || 'Confirmar acción'} maxWidth={440} close={() => setConfirmation(null)}
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><MenuButton onPress={() => setConfirmation(null)}>Seguir editando</MenuButton><MenuButton danger onPress={() => { const action = confirmation?.action; setConfirmation(null); action?.(); }}>{confirmation?.actionLabel || 'Confirmar'}</MenuButton></View>}>
      <Text style={{ color: c.text, fontSize: 14, lineHeight: 22 }}>{confirmation?.message}</Text>
    </MenuModal>
  </View>;
}
