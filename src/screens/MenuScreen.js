import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal,
  Image, Alert, ActivityIndicator, Switch, Platform, useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  BadgePercent, Camera, Edit3, ImagePlus, Plus, Search, Trash2, Utensils, X,
} from 'lucide-react-native';
import axios from 'axios';
import { assetUrl, BASE_URL } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme, softShadow } from '../theme';
import { BOTTOM_INSET } from '../utils/safeArea';

const EMPTY_FORM = {
  id: null,
  nombre: '',
  descripcion: '',
  precio: '',
  stock: '10',
  categoria_id: 1,
  imagen_url: null,
  disponible: true,
  imageAsset: null,
  inventario_item_id: null,
  receta: [],
};

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
const isPromotionProduct = (producto) => {
  const category = normalizeText(producto.categoria_nombre || '');
  const name = normalizeText(producto.nombre);
  const description = normalizeText(producto.descripcion);
  return category.includes('promo') || name.includes('promo') || description.includes('promo');
};

export default function MenuScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 680;
  // Minimo 2 columnas en movil, 3 en tablet, 4 en escritorio.
  const cardWidth = compact ? '48%' : width < 1180 ? '31.5%' : '23.5%';
  const {
    productos, categorias, inventario, createProducto, updateProducto,
    deleteProducto, fetchProductos, createCategoria, updateCategoria, deleteCategoria,
  } = useAdmin();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, nombre: '', icono: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const allCategoryOptions = categorias.length
    ? categorias
    : [{ id: 1, nombre: 'Entradas' }, { id: 2, nombre: 'Platos fuertes' }, { id: 6, nombre: 'Bebidas' }];
  const activeCategoryOptions = allCategoryOptions.filter((c) => Number(c.activo) !== 0);
  const categoryOptions = activeCategoryOptions.length ? activeCategoryOptions : allCategoryOptions;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return productos.filter((p) => {
      const matchesQ = !q
        || p.nombre?.toLowerCase().includes(q)
        || p.categoria_nombre?.toLowerCase().includes(q);
      const matchesCategory = category === 'todos' || Number(p.categoria_id) === Number(category);
      return matchesQ && matchesCategory;
    });
  }, [productos, query, category]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, categoria_id: categoryOptions[0]?.id || 1 });
    setModalOpen(true);
  };

  const openNewPromotion = () => {
    const promoCategory = categoryOptions.find((item) => normalizeText(item.nombre).includes('promo'));
    setForm({
      ...EMPTY_FORM,
      nombre: 'Promo ',
      descripcion: 'Promocion creada desde admin. Agrega aqui los productos o insumos de la receta.',
      categoria_id: promoCategory?.id || categoryOptions[0]?.id || 1,
      stock: '10',
    });
    setModalOpen(true);
  };

  const openEdit = async (p) => {
    let receta = [];
    try {
      const res = await axios.get(`${BASE_URL}/productos/${p.id}/receta`);
      receta = res.data || [];
    } catch {
      receta = [];
    }
    setForm({
      id: p.id,
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      precio: String(p.precio ?? ''),
      stock: String(p.stock ?? 0),
      categoria_id: p.categoria_id || categoryOptions[0]?.id || 1,
      inventario_item_id: p.inventario_item_id || null,
      imagen_url: p.imagen_url || null,
      disponible: Number(p.disponible) === 1,
      imageAsset: null,
      receta: receta.map((item) => ({
        inventario_item_id: item.inventario_item_id,
        cantidad: String(item.cantidad ?? 1),
        unidad: item.unidad || item.inventario_unidad || '',
      })),
    });
    setModalOpen(true);
  };

  const openCategory = (item = null) => {
    setCategoryForm(item ? {
      id: item.id,
      nombre: item.nombre || '',
      icono: item.icono || '',
      activo: Number(item.activo) !== 0,
    } : { id: null, nombre: '', icono: '', activo: true });
    setCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre de la categoria.');
      return;
    }
    try {
      const payload = {
        nombre: categoryForm.nombre.trim(),
        icono: categoryForm.icono.trim() || null,
        activo: categoryForm.activo ? 1 : 0,
      };
      if (categoryForm.id) await updateCategoria(categoryForm.id, payload);
      else await createCategoria(payload);
      setCategoryForm({ id: null, nombre: '', icono: '', activo: true });
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    }
  };

  const confirmDeleteCategory = (item) => {
    confirmDanger('Eliminar categoria', `Eliminar permanentemente "${item.nombre}"? Solo se permite si no tiene productos.`, async () => {
      await deleteCategoria(item.id);
      if (Number(category) === Number(item.id)) setCategory('todos');
    }, 'Eliminar');
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const showError = (title, error, fallback = 'Revisa el backend.') => {
    Alert.alert(title, error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback);
  };

  const confirmDanger = (title, message, action, label = 'Eliminar') => {
    const run = async () => {
      try {
        await action();
      } catch (error) {
        showError('No se pudo completar', error);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) run();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: label, style: 'destructive', onPress: run },
    ]);
  };

  const addRecipeItem = (item) => {
    setForm((prev) => {
      if ((prev.receta || []).some((r) => Number(r.inventario_item_id) === Number(item.id))) return prev;
      return {
        ...prev,
        receta: [...(prev.receta || []), {
          inventario_item_id: item.id,
          cantidad: '1',
          unidad: item.unidad || '',
        }],
      };
    });
  };

  const updateRecipeItem = (inventarioItemId, key, value) => {
    setForm((prev) => ({
      ...prev,
      receta: (prev.receta || []).map((item) => (
        Number(item.inventario_item_id) === Number(inventarioItemId) ? { ...item, [key]: value } : item
      )),
    }));
  };

  const removeRecipeItem = (inventarioItemId) => {
    setForm((prev) => ({
      ...prev,
      receta: (prev.receta || []).filter((item) => Number(item.inventario_item_id) !== Number(inventarioItemId)),
    }));
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Activa el permiso de galeria para seleccionar imagenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setForm((prev) => ({
        ...prev,
        imageAsset: asset,
        imagen_url: asset.uri,
      }));
    }
  };

  const uploadImage = async (imageAsset) => {
    const data = new FormData();
    const name = imageAsset.fileName || `producto-${Date.now()}.jpg`;
    const type = imageAsset.mimeType || 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(imageAsset.uri);
      const blob = await response.blob();
      data.append('image', blob, name);
    } else {
      data.append('image', {
        uri: imageAsset.uri,
        name,
        type,
      });
    }

    const res = await axios.post(`${BASE_URL}/productos/upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.imagen_url;
  };

  const saveProduct = async () => {
    if (!form.nombre.trim()) {
      Alert.alert('Falta nombre', 'Escribe el nombre del producto.');
      return;
    }
    if (!form.precio || Number.isNaN(Number(form.precio))) {
      Alert.alert('Precio invalido', 'Escribe un precio numerico.');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = form.imagen_url;
      if (form.imageAsset) {
        imageUrl = await uploadImage(form.imageAsset);
      }

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        precio: Number(form.precio),
        stock: Number(form.stock || 0),
        categoria_id: Number(form.categoria_id),
        inventario_item_id: form.inventario_item_id ? Number(form.inventario_item_id) : null,
        imagen_url: imageUrl,
        disponible: form.disponible ? 1 : 0,
      };

      let saved = null;
      if (form.id) {
        saved = await updateProducto(form.id, payload);
      } else {
        saved = await createProducto(payload);
      }
      const productId = form.id || saved?.id;
      if (productId) {
        await axios.put(`${BASE_URL}/productos/${productId}/receta`, {
          items: (form.receta || []).map((item) => ({
            inventario_item_id: Number(item.inventario_item_id),
            cantidad: Number(item.cantidad || 0),
            unidad: item.unidad || null,
          })),
        });
      }

      setModalOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      Alert.alert('No se pudo guardar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (p) => {
    confirmDanger('Eliminar producto', `Eliminar permanentemente "${p.nombre}"? Solo se permite si no aparece en pedidos historicos.`, () => deleteProducto(p.id), 'Eliminar');
  };

  const toggleDisponibilidad = async (p) => {
    await updateProducto(p.id, { disponible: Number(p.disponible) === 1 ? 0 : 1 });
    await fetchProductos();
  };

  const imagePreview = form.imagen_url
    ? (form.imageAsset ? form.imagen_url : assetUrl(form.imagen_url))
    : null;

  return (
    <View className="flex-1">
      <View style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16, marginBottom: 16, ...softShadow(c) }}>
        <View className={compact ? 'flex-col' : 'flex-row items-center'}>
          <View
            className={`flex-row items-center rounded-lg px-4 flex-1 ${compact ? 'mb-3' : 'mr-3'}`}
            style={{ backgroundColor: c.soft, borderWidth: 1, borderColor: c.line }}
          >
            <Search size={18} color={c.faint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar producto, bebida o categoria"
              placeholderTextColor={c.faint}
              className="flex-1 py-3 ml-2 text-sm"
              style={{ color: c.text }}
            />
          </View>
          <View className="flex-row" style={{ flexWrap: compact ? 'wrap' : 'nowrap', gap: compact ? 8 : 0 }}>
            <TouchableOpacity
              onPress={openNewPromotion}
              className="flex-row items-center rounded-lg px-4 py-3"
              style={{ backgroundColor: c.amberSoft, marginRight: compact ? 0 : 8 }}
            >
              <BadgePercent size={18} color={c.amber} />
              <Text className="font-bold ml-2" style={{ color: c.amber }}>Nueva promocion</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openCategory()}
              className="flex-row items-center rounded-lg px-4 py-3"
              style={{ backgroundColor: c.primarySoft, marginRight: compact ? 0 : 8 }}
            >
              <Utensils size={18} color={c.primaryText} />
              <Text className="font-bold ml-2" style={{ color: c.primaryText }}>Categorias</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openNew}
              className="flex-row items-center rounded-lg px-4 py-3 flex-1 justify-center"
              style={{ backgroundColor: c.primary }}
            >
              <Plus size={18} color={c.onPrimary} />
              <Text className="font-bold ml-2" style={{ color: c.onPrimary }}>Nuevo producto</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => setCategory('todos')}
              className="px-4 py-2 rounded-lg mr-2"
              style={{ backgroundColor: category === 'todos' ? c.primary : c.soft }}
            >
              <Text className="font-semibold text-sm" style={{ color: category === 'todos' ? c.onPrimary : c.muted }}>Todos</Text>
            </TouchableOpacity>
            {categoryOptions.map((cat) => {
              const active = Number(category) === Number(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategory(cat.id)}
                  className="px-4 py-2 rounded-lg mr-2"
                  style={{ backgroundColor: active ? c.primary : c.soft }}
                >
                  <Text className="font-semibold text-sm" style={{ color: active ? c.onPrimary : c.muted }}>
                    {cat.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: BOTTOM_INSET + 16 }}>
        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {filtered.map((p) => {
            const displayStock = p.inventario_item_id ? p.inventario_stock : p.stock;
            const available = Number(p.disponible) === 1 && Number(displayStock || 0) > 0;
            const promo = isPromotionProduct(p);
            return (
              <View key={p.id} className="rounded-lg overflow-hidden" style={{ width: cardWidth, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...softShadow(c) }}>
                <View className="h-36" style={{ backgroundColor: c.soft }}>
                  {p.imagen_url ? (
                    <Image source={{ uri: assetUrl(p.imagen_url) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.amberSoft }}>
                      <Utensils size={34} color={c.amber} />
                      <Text className="font-semibold text-xs mt-2" style={{ color: c.amber }}>Sin imagen</Text>
                    </View>
                  )}
                  {promo && (
                    <View className="absolute top-2 left-2 px-3 py-1 rounded-full flex-row items-center" style={{ backgroundColor: c.amberSoft }}>
                      <BadgePercent size={13} color={c.amber} />
                      <Text className="text-xs font-extrabold ml-1" style={{ color: c.amber }}>Promo</Text>
                    </View>
                  )}
                </View>
                <View className="p-4">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-extrabold" style={{ color: c.text }} numberOfLines={1}>{p.nombre}</Text>
                      <Text className="text-xs mt-0.5" style={{ color: c.faint }}>{p.categoria_nombre || 'Sin categoria'}</Text>
                    </View>
                    <Text className="font-extrabold" style={{ color: c.primaryText }}>{money(p.precio)}</Text>
                  </View>

                  <Text className="text-xs mt-2 h-8" style={{ color: c.muted }} numberOfLines={2}>
                    {p.descripcion || 'Sin descripcion.'}
                  </Text>

                  <View className="flex-row items-center justify-between mt-3">
                    <TouchableOpacity
                      onPress={() => toggleDisponibilidad(p)}
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: available ? c.greenSoft : c.redSoft }}
                    >
                      <Text className="text-xs font-bold" style={{ color: available ? c.green : c.red }}>
                        {available ? `Disponible (${displayStock})` : 'Agotado/Oculto'}
                      </Text>
                    </TouchableOpacity>
                    <View className="flex-row">
                      <TouchableOpacity onPress={() => openEdit(p)} className="w-9 h-9 rounded-lg items-center justify-center mr-2" style={{ backgroundColor: c.soft }}>
                        <Edit3 size={16} color={c.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(p)} className="w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: c.redSoft }}>
                        <Trash2 size={16} color={c.red} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
          {!filtered.length && (
            <View className="rounded-lg p-10 flex-1 items-center" style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
              <Utensils size={36} color={c.faint} />
              <Text className="font-bold mt-3" style={{ color: c.muted }}>No hay productos con ese filtro.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={categoryModal} animationType="fade" transparent onRequestClose={() => setCategoryModal(false)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-4">
          <View className="bg-white rounded-lg w-full max-w-2xl max-h-[88%] overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              <Text className="text-lg font-extrabold text-slate-800">Categorias del menu</Text>
              <TouchableOpacity onPress={() => setCategoryModal(false)} className="p-1">
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: BOTTOM_INSET + 12 }}>
              <View className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
                <TextInput
                  value={categoryForm.nombre}
                  onChangeText={(v) => setCategoryForm((p) => ({ ...p, nombre: v }))}
                  placeholder="Ej. Bebidas frias"
                  placeholderTextColor="#94a3b8"
                  className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3"
                />
                <Text className="text-slate-600 font-semibold text-sm mb-1">Icono o clave</Text>
                <TextInput
                  value={categoryForm.icono}
                  onChangeText={(v) => setCategoryForm((p) => ({ ...p, icono: v }))}
                  placeholder="bebida, cafe, postre..."
                  placeholderTextColor="#94a3b8"
                  className="bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3"
                />
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-slate-700 font-bold">Categoria activa</Text>
                  <Switch value={categoryForm.activo} onValueChange={(v) => setCategoryForm((p) => ({ ...p, activo: v }))} />
                </View>
                <View className="flex-row">
                  <TouchableOpacity onPress={() => setCategoryForm({ id: null, nombre: '', icono: '', activo: true })} className="px-4 py-3 rounded-lg bg-white border border-slate-200 mr-2">
                    <Text className="text-slate-600 font-bold">Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveCategory} className="px-4 py-3 rounded-lg bg-blue-600 flex-1 items-center">
                    <Text className="text-white font-bold">{categoryForm.id ? 'Actualizar categoria' : 'Crear categoria'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {allCategoryOptions.map((item) => (
                <View key={item.id} className="flex-row items-center py-3 border-b border-slate-100">
                  <View className="w-10 h-10 rounded-lg bg-amber-50 items-center justify-center mr-3">
                    <Utensils size={17} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-900 font-bold">{item.nombre}</Text>
                    <Text className="text-slate-400 text-xs">{item.icono || 'Sin icono'} - {Number(item.activo) !== 0 ? 'Activa' : 'Inactiva'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openCategory(item)} className="w-9 h-9 rounded-lg bg-slate-50 items-center justify-center mr-2">
                    <Edit3 size={16} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteCategory(item)} className="w-9 h-9 rounded-lg bg-rose-50 items-center justify-center">
                    <Trash2 size={16} color="#e11d48" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalOpen} animationType="fade" transparent onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-4">
          <View className="bg-white rounded-lg w-full max-w-3xl max-h-[92%] overflow-hidden">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-100">
              <Text className="text-lg font-extrabold text-slate-800">
                {form.id ? 'Editar producto' : 'Nuevo producto'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} className="p-1">
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: BOTTOM_INSET + 12 }}>
              <View className="flex-row flex-wrap -m-2">
                <View className="m-2" style={{ width: compact ? '100%' : 288 }}>
                  <TouchableOpacity
                    onPress={pickImage}
                    className="h-56 bg-slate-50 border border-dashed border-slate-300 rounded-lg overflow-hidden items-center justify-center"
                  >
                    {imagePreview ? (
                      <Image source={{ uri: imagePreview }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <>
                        <ImagePlus size={34} color="#94a3b8" />
                        <Text className="text-slate-500 font-bold mt-2">Subir imagen real</Text>
                        <Text className="text-slate-400 text-xs mt-1 text-center px-6">
                          Recomendado 4:3, buena luz y sin mucho fondo.
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={pickImage} className="flex-row items-center justify-center bg-slate-100 rounded-lg py-3 mt-3">
                    <Camera size={17} color="#2563EB" />
                    <Text className="text-blue-600 font-bold ml-2">Seleccionar imagen</Text>
                  </TouchableOpacity>
                </View>

                <View className="m-2 flex-1" style={{ minWidth: compact ? '100%' : 300 }}>
                  <Text className="text-slate-600 font-semibold text-sm mb-1">Nombre</Text>
                  <TextInput
                    value={form.nombre}
                    onChangeText={(v) => setField('nombre', v)}
                    placeholder="Ej. Cappuccino"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3"
                  />

                  <Text className="text-slate-600 font-semibold text-sm mb-1">Descripcion</Text>
                  <TextInput
                    value={form.descripcion}
                    onChangeText={(v) => setField('descripcion', v)}
                    placeholder="Ingredientes, preparacion o nota visible"
                    placeholderTextColor="#94a3b8"
                    multiline
                    className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3 min-h-[84px]"
                  />

                  <View className="flex-row">
                    <View className="flex-1 mr-2">
                      <Text className="text-slate-600 font-semibold text-sm mb-1">Precio</Text>
                      <TextInput
                        value={form.precio}
                        onChangeText={(v) => setField('precio', v.replace(',', '.'))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#94a3b8"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3"
                      />
                    </View>
                    <View className="flex-1 ml-2">
                      <Text className="text-slate-600 font-semibold text-sm mb-1">Stock</Text>
                      <TextInput
                        value={form.stock}
                        onChangeText={(v) => setField('stock', v.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#94a3b8"
                        className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 mb-3"
                      />
                    </View>
                  </View>

                  <Text className="text-slate-600 font-semibold text-sm mb-2">Categoria</Text>
                  <View className="flex-row flex-wrap mb-3">
                    {categoryOptions.map((c) => {
                      const active = Number(form.categoria_id) === Number(c.id);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => setField('categoria_id', c.id)}
                          className={`px-3 py-2 rounded-lg mr-2 mb-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}
                        >
                          <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{c.nombre}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text className="text-slate-600 font-semibold text-sm mb-2">Vincular con inventario</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    <View className="flex-row">
                      <TouchableOpacity
                        onPress={() => setField('inventario_item_id', null)}
                        className={`px-3 py-2 rounded-lg mr-2 ${!form.inventario_item_id ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}
                      >
                        <Text className={`text-xs font-bold ${!form.inventario_item_id ? 'text-white' : 'text-slate-500'}`}>Sin vinculo</Text>
                      </TouchableOpacity>
                      {inventario.map((item) => {
                        const active = Number(form.inventario_item_id) === Number(item.id);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => setField('inventario_item_id', item.id)}
                            className={`px-3 py-2 rounded-lg mr-2 ${active ? 'bg-blue-600' : 'bg-slate-50 border border-slate-200'}`}
                          >
                            <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-500'}`}>
                              {item.nombre} ({Number(item.stock).toFixed(0)})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <Text className="text-slate-600 font-semibold text-sm mb-2">Receta estandar</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    <View className="flex-row">
                      {inventario.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => addRecipeItem(item)}
                          className="px-3 py-2 rounded-lg mr-2 bg-slate-50 border border-slate-200"
                        >
                          <Text className="text-xs font-bold text-slate-500">{item.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  {(form.receta || []).map((recipe) => {
                    const inv = inventario.find((item) => Number(item.id) === Number(recipe.inventario_item_id));
                    return (
                      <View key={recipe.inventario_item_id} className={`${compact ? 'flex-col items-stretch' : 'flex-row items-center'} bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-2`}>
                        <View className="flex-1" style={{ minWidth: 0 }}>
                          <Text className="text-slate-800 font-bold text-sm">{inv?.nombre || `Insumo ${recipe.inventario_item_id}`}</Text>
                          <Text className="text-slate-400 text-xs">Stock: {Number(inv?.stock || 0).toFixed(2)} {inv?.unidad || ''}</Text>
                        </View>
                        <View className={`${compact ? 'mt-2' : ''} flex-row items-center`}>
                          <TextInput
                            value={recipe.cantidad}
                            onChangeText={(v) => updateRecipeItem(recipe.inventario_item_id, 'cantidad', v.replace(',', '.'))}
                            keyboardType="decimal-pad"
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 mr-2"
                            style={{ flex: compact ? 1 : undefined, width: compact ? undefined : 82 }}
                          />
                          <TextInput
                            value={recipe.unidad}
                            onChangeText={(v) => updateRecipeItem(recipe.inventario_item_id, 'unidad', v)}
                            placeholder={inv?.unidad || 'unidad'}
                            placeholderTextColor="#94a3b8"
                            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 mr-2"
                            style={{ flex: compact ? 1 : undefined, width: compact ? undefined : 90 }}
                          />
                          <TouchableOpacity onPress={() => removeRecipeItem(recipe.inventario_item_id)} className="w-9 h-9 rounded-lg bg-rose-50 items-center justify-center">
                            <Trash2 size={16} color="#e11d48" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  <View className="flex-row items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <View>
                      <Text className="text-slate-700 font-bold text-sm">Disponible para venta</Text>
                      <Text className="text-slate-400 text-xs">Si esta apagado, no aparece al mesero.</Text>
                    </View>
                    <Switch
                      value={form.disponible}
                      onValueChange={(v) => setField('disponible', v)}
                      trackColor={{ true: '#d8c7bb', false: '#e2e8f0' }}
                      thumbColor={form.disponible ? '#2563EB' : '#94a3b8'}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View className={`${compact ? 'flex-col' : 'flex-row justify-end'} px-5 py-4 border-t border-slate-100`} style={{ paddingBottom: BOTTOM_INSET + 16 }}>
              <TouchableOpacity onPress={() => setModalOpen(false)} className="px-5 py-3 rounded-lg bg-slate-100 mr-3">
                <Text className="text-slate-600 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveProduct}
                disabled={saving}
                className={`px-5 py-3 rounded-lg bg-blue-600 min-w-[150px] items-center ${compact ? 'mt-3' : ''}`}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


