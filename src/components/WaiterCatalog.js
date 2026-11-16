import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { ArrowDownUp, LayoutGrid, List, ShoppingBag, MapPin, Search, RefreshCw } from 'lucide-react-native';
import ProductCard from './WaiterProductCard';
import { WText, WButton, WSearch, WFilters } from './WaiterUI';
import { filterMenuProducts } from '../utils/waiterCatalog.mjs';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';

export default function WaiterCatalog({ colors: c, width, products, categories, category, setCategory, search, setSearch, preferences, setPreferences, catalog, locked, counts, cartCount, cartTotal, openOrder, chooseTarget, onAdd, onDecrement, refresh, loading, loadError, bottomInset, draftState }) {
  const { availableOnly, sort, view } = preferences;
  const setAvailableOnly = value => setPreferences(previous => ({ ...previous, availableOnly: value }));
  const setSort = value => setPreferences(previous => ({ ...previous, sort: value }));
  const setView = value => setPreferences(previous => ({ ...previous, view: value }));
  const [measured, setMeasured] = useState(null);
  const localWidth = Math.min(width, measured ?? width);
  const list = view === 'list' || (view === 'auto' && localWidth < 600);
  const padding = localWidth < 768 ? 16 : localWidth >= 1024 ? 32 : 24;
  const gap = 12;
  const columns = list ? 1 : Math.max(1, Math.floor((localWidth - padding * 2 + gap) / ((localWidth < 600 ? 140 : 180) + gap)));
  const cardWidth = Math.max(0, Math.floor((localWidth - padding * 2 - gap * (columns - 1) - 1) / columns));
  useEffect(() => { if (!categories.includes(category)) setCategory('Todas'); }, [categories, category, setCategory]);
  const items = useMemo(() => filterMenuProducts(products, { query: search, category, availableOnly, sort }), [products, search, category, availableOnly, sort]);
  const clear = () => { setSearch(''); setCategory('Todas'); setAvailableOnly(false); };
  const header = <View style={{ gap: 12, paddingBottom: 14 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ flex: 1 }}><WText style={{ fontSize: 25, color: c.ink }}>Menú</WText><WText style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>Busca, selecciona y añade al pedido.</WText></View><WButton colors={c} label="Actualizar menú" Icon={RefreshCw} onPress={refresh} disabled={loading} /></View>
    <View style={{ borderWidth: 1, borderColor: locked ? c.warning : c.line, borderRadius: 6, backgroundColor: c.surface, paddingLeft: 12, paddingRight: 4, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 }}><View>{catalog.reason?.startsWith('express') || catalog.reason === 'draft' ? <ShoppingBag size={18} color={c.brand} /> : <MapPin size={18} color={c.brand} />}</View><View style={{ flex: 1, minWidth: 0 }}><WText numberOfLines={2} style={{ color: c.ink, fontSize: 12 }}>{catalog.label}</WText>{locked ? <WText style={{ color: c.warning, fontSize: 10, marginTop: 3 }}>Confirma el envío desde Pedido para continuar.</WText> : !catalog.editable ? <WText style={{ color: c.muted, fontSize: 10, marginTop: 3 }}>Puedes explorar el menú sin crear un pedido.</WText> : null}</View><WButton colors={c} label="Seleccionar destino" onPress={chooseTarget} disabled={locked} style={{ borderWidth: 0, backgroundColor: 'transparent' }}>{catalog.editable ? 'Cambiar' : 'Elegir'}</WButton></View>
    {loadError ? <WText accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>No se pudo actualizar el catálogo. Pulsa actualizar para reintentar.</WText> : null}
    <View style={{ flexDirection: 'row', gap: 8 }}><WSearch colors={c} label="Buscar productos" placeholder="Producto, descripción o categoría" value={search} onChangeText={setSearch} /><WButton colors={c} label={list ? 'Ver productos en tarjetas' : 'Ver productos en lista'} Icon={list ? LayoutGrid : List} onPress={() => setView(list ? 'grid' : 'list')} /></View>
    <WFilters colors={c} label="Categorías del menú" items={categories.map(value => [value, value === 'Todas' ? 'Todo' : value])} value={category} onChange={setCategory} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: -10 }}><WButton colors={c} active={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} label="Mostrar solo disponibles">Solo disponibles</WButton><WButton colors={c} label="Cambiar orden de productos" Icon={ArrowDownUp} onPress={() => setSort(sort === 'name' ? 'price' : 'name')}>{sort === 'name' ? 'Nombre A–Z' : 'Menor precio'}</WButton><WText accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 11, marginLeft: 'auto' }}>{items.length} {items.length === 1 ? 'producto' : 'productos'}</WText></View>
  </View>;
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0 }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setMeasured(next); }}>
    <FlatList key={`${columns}-${list}`} data={items} numColumns={columns} keyExtractor={item => String(item.id)} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} initialNumToRender={8} windowSize={5} removeClippedSubviews={Platform.OS !== 'web'} contentContainerStyle={{ padding, paddingTop: 20, paddingBottom: (bottomInset || 0) + 24 }} columnWrapperStyle={columns > 1 ? { gap, marginBottom: gap } : undefined} ItemSeparatorComponent={columns === 1 ? () => <View style={{ height: gap }} /> : undefined}
      ListEmptyComponent={<View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}><Search size={26} color={c.muted} /><WText style={{ color: c.ink, fontSize: 14 }}>{products.length ? 'No hay productos con estos filtros' : 'El menú todavía no tiene productos'}</WText>{products.length ? <WButton colors={c} onPress={clear}>Limpiar filtros</WButton> : null}</View>}
      renderItem={({ item }) => <ProductCard producto={item} colors={c} cardWidth={cardWidth} qty={counts[item.id] || 0} layout={list ? 'list' : 'grid'} locked={locked} canAdd={catalog.editable} chooseTarget={chooseTarget} onPress={onAdd} onDecrement={onDecrement} />} />
    {cartCount > 0 ? <View style={{ borderTopWidth: 1, borderColor: c.line, backgroundColor: c.secondary, padding: 10, paddingBottom: (bottomInset || 0) + 10 }}><WText style={{color:draftState?.error||draftState?.pending?c.warning:c.muted,fontSize:10,marginBottom:6}}>{draftDeliveryStatus({hasDraft:true,...draftState}).label}</WText><WButton colors={c} primary onPress={openOrder} Icon={ShoppingBag} label="Ver pedido actual">Ver pedido · {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'} · ${Number(cartTotal || 0).toFixed(2)}</WButton></View> : null}
  </View>;
}
