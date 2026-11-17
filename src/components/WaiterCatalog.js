// Menú del mesero («Comanda»): cabecera compacta (destino, búsqueda, categorías) y la carta como líneas de libreta.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { MapPin, Search, ShoppingBag, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme';
import { filterMenuProducts } from '../utils/waiterCatalog.mjs';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';
import { T, Num, Label, Press, Button, EmptyState, RollingNumber, Appear, elevate, money, TOUCH_MAIN, radius, space } from './waiter/comanda';
import { MenuRow, MenuSearch, CategoryChips, MenuFiltersSheet, QuickStrip } from './waiter/menu';

export default function WaiterCatalog({ width, products, categories, category, setCategory, search, setSearch, preferences, setPreferences, catalog, locked, counts, cartCount, cartTotal, openOrder, chooseTarget, onAdd, onDecrement, onCustomize, favorites, repeat, refresh, loading, loadError, bottomInset, draftState }) {
  const { c } = useTheme();
  const { availableOnly, sort } = preferences;
  const setAvailableOnly = value => setPreferences(previous => ({ ...previous, availableOnly: value }));
  const setSort = value => setPreferences(previous => ({ ...previous, sort: value }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [measured, setMeasured] = useState(null);
  const localWidth = Math.min(width, measured ?? width);
  const padding = localWidth < 768 ? 16 : localWidth >= 1024 ? 32 : 24;
  const columns = localWidth >= 1000 ? 2 : 1; // en tableta, dos columnas de libreta
  useEffect(() => { if (!categories.includes(category)) setCategory('Todas'); }, [categories, category, setCategory]);
  const items = useMemo(() => filterMenuProducts(products, { query: search, category, availableOnly, sort }), [products, search, category, availableOnly, sort]);
  const browsing = !search && category === 'Todas';
  const clear = () => { setSearch(''); setCategory('Todas'); setAvailableOnly(false); };
  const express = catalog.reason?.startsWith('express') || catalog.reason === 'draft';
  const header = <View style={{ gap: space.md, paddingBottom: space.md }}>
    <Press accessibilityRole="button" accessibilityLabel={`Destino: ${catalog.label}. ${catalog.editable ? 'Cambiar' : 'Elegir'}`} onPress={chooseTarget} disabled={locked} hapticKind="tap"
      hoverStyle={{ backgroundColor: c.soft }} style={{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.xl,
        backgroundColor: locked ? c.amberSoft : catalog.editable ? c.primarySoft : c.surfaceAlt }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: catalog.editable ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center' }}>
        {express ? <ShoppingBag size={20} color={catalog.editable ? c.onPrimary : c.text} /> : <MapPin size={20} color={catalog.editable ? c.onPrimary : c.text} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={13} weight="600" color={c.muted}>{catalog.editable ? 'Pidiendo para' : 'Sin destino'}</T>
        <T size={18} weight="800" numberOfLines={1}>{catalog.label}</T>
        {locked ? <T size={13} color={c.amber} weight="600">Confirma el envío desde Comanda para seguir.</T> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 12, paddingRight: 8, height: 34, borderRadius: radius.pill, backgroundColor: c.surface }}>
        <T size={14} weight="700" color={c.primaryText}>{catalog.editable ? 'Cambiar' : 'Elegir'}</T>
        <ChevronRight size={16} color={c.primaryText} />
      </View>
    </Press>
    {loadError ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} color={c.red} weight="600" style={{ flex: 1 }}>No se pudo actualizar el menú.</T><Button size="sm" onPress={refresh} loading={loading}>Reintentar</Button>
    </View> : null}
    <MenuSearch value={search} onChangeText={setSearch} onFilters={() => setFiltersOpen(true)} filtersActive={availableOnly || sort !== 'name'} />
    <CategoryChips items={categories.map(value => [value, value === 'Todas' ? 'Todo' : value])} value={category} onChange={setCategory} />
    {browsing ? <QuickStrip favorites={favorites} counts={counts} canAdd={catalog.editable} locked={locked} onAdd={onAdd} chooseTarget={chooseTarget} repeat={catalog.editable ? repeat : null} /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xs }}>
      <T size={20} weight="800">{category === 'Todas' ? 'Carta' : category}</T>
      <Num size={13} color={c.muted} accessibilityLiveRegion="polite">{items.length} {items.length === 1 ? 'producto' : 'productos'}</Num>
    </View>
  </View>;
  const row = item => <MenuRow producto={item} qty={counts[item.id] || 0} locked={locked} canAdd={catalog.editable} chooseTarget={chooseTarget} onAdd={onAdd} onDecrement={onDecrement} onCustomize={onCustomize} />;
  const status = draftDeliveryStatus({ hasDraft: true, ...draftState });
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: c.bg }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setMeasured(next); }}>
    <FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => String(item.id)} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      initialNumToRender={14} windowSize={7} removeClippedSubviews={Platform.OS !== 'web'}
      contentContainerStyle={{ padding, paddingTop: space.lg, paddingBottom: (bottomInset || 0) + 24, maxWidth: 1180, width: '100%', alignSelf: 'center' }}
      columnWrapperStyle={columns > 1 ? { gap: space.lg } : undefined}
      ListEmptyComponent={<EmptyState icon={Search} title={products.length ? 'Nada coincide con la búsqueda' : 'El menú todavía no tiene productos'}
        description={products.length ? 'Revisa la ortografía o quita los filtros.' : 'Cuando el administrador cargue productos aparecerán aquí.'}
        action={products.length ? <Button onPress={clear}>Limpiar filtros</Button> : <Button onPress={refresh} loading={loading}>Actualizar</Button>} />}
      renderItem={({ item }) => columns > 1 ? <View style={{ flex: 1, minWidth: 0 }}>{row(item)}</View> : row(item)} />
    {cartCount > 0 ? <Appear style={{ paddingHorizontal: padding, paddingTop: 6, paddingBottom: (bottomInset || 0) + 2 }}>
      <Press accessibilityRole="button" accessibilityLabel={`Ver comanda: ${cartCount} ${cartCount === 1 ? 'artículo' : 'artículos'}, ${money(cartTotal)}`} onPress={openOrder} hapticKind="tap"
        style={[{ minHeight: 60, borderRadius: radius.pill, backgroundColor: c.isDark ? '#2A2C32' : c.ink, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 10, paddingRight: space.xl, maxWidth: 1116, width: '100%', alignSelf: 'center' }, elevate(c, 2)]}>
        <View style={{ minWidth: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}><RollingNumber value={cartCount} size={16} weight="800" color={c.onPrimary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="800" color={c.isDark ? c.text : c.onInk}>Ver ronda nueva</T>
          <T size={13} color={c.isDark ? c.text : c.onInk} style={{ opacity: 0.7 }} numberOfLines={2}>{status.key === 'local' ? 'Guardada aquí · sin enviar' : status.label}</T>
        </View>
        <RollingNumber value={Number(cartTotal || 0)} format={money} size={18} weight="800" color={c.isDark ? c.text : c.onInk} />
      </Press>
    </Appear> : null}
    <MenuFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} availableOnly={availableOnly} setAvailableOnly={setAvailableOnly} sort={sort} setSort={setSort} onRefresh={refresh} loading={loading} />
  </View>;
}
