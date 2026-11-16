// Menú del mesero («Comanda»): cabecera compacta (destino, búsqueda, categorías) y la carta como líneas de libreta.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { MapPin, Search, ShoppingBag, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme';
import { filterMenuProducts } from '../utils/waiterCatalog.mjs';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';
import { T, Num, Label, Press, Button, EmptyState, RollingNumber, money, TOUCH_MAIN, radius, space } from './waiter/comanda';
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
      hoverStyle={{ backgroundColor: c.soft }} style={{ minHeight: TOUCH_MAIN, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.md,
        borderWidth: 1.5, borderStyle: catalog.editable ? 'solid' : 'dashed', borderColor: locked ? c.amber : catalog.editable ? c.ink : c.lineStrong, backgroundColor: c.surface }}>
      {express ? <ShoppingBag size={20} color={c.text} /> : <MapPin size={20} color={c.text} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label size={13}>{catalog.editable ? 'Pidiendo para' : 'Sin destino'}</Label>
        <T size={16} weight="700" numberOfLines={1}>{catalog.label}</T>
        {locked ? <T size={13} color={c.amber} weight="600">Confirma el envío desde Comanda para seguir.</T> : null}
      </View>
      <T size={15} weight="700" color={c.primary}>{catalog.editable ? 'Cambiar' : 'Elegir'}</T>
      <ChevronRight size={18} color={c.primary} />
    </Press>
    {loadError ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} color={c.red} weight="600" style={{ flex: 1 }}>No se pudo actualizar el menú.</T><Button size="sm" onPress={refresh} loading={loading}>Reintentar</Button>
    </View> : null}
    <MenuSearch value={search} onChangeText={setSearch} onFilters={() => setFiltersOpen(true)} filtersActive={availableOnly || sort !== 'name'} />
    <CategoryChips items={categories.map(value => [value, value === 'Todas' ? 'Todo' : value])} value={category} onChange={setCategory} />
    {browsing ? <QuickStrip favorites={favorites} counts={counts} canAdd={catalog.editable} locked={locked} onAdd={onAdd} chooseTarget={chooseTarget} repeat={catalog.editable ? repeat : null} /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xs }}>
      <Label color={c.text}>{category === 'Todas' ? 'Carta' : category}</Label>
      <Num size={13} color={c.muted} accessibilityLiveRegion="polite">{items.length} {items.length === 1 ? 'producto' : 'productos'}</Num>
    </View>
  </View>;
  const row = item => <MenuRow producto={item} qty={counts[item.id] || 0} locked={locked} canAdd={catalog.editable} chooseTarget={chooseTarget} onAdd={onAdd} onDecrement={onDecrement} onCustomize={onCustomize} />;
  const status = draftDeliveryStatus({ hasDraft: true, ...draftState });
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: c.bg }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setMeasured(next); }}>
    <FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => String(item.id)} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      initialNumToRender={14} windowSize={7} removeClippedSubviews={Platform.OS !== 'web'}
      contentContainerStyle={{ padding, paddingTop: space.lg, paddingBottom: (bottomInset || 0) + 24, maxWidth: 1180, width: '100%', alignSelf: 'center' }}
      columnWrapperStyle={columns > 1 ? { gap: space.xl } : undefined}
      ListEmptyComponent={<EmptyState icon={Search} title={products.length ? 'Nada coincide con la búsqueda' : 'El menú todavía no tiene productos'}
        description={products.length ? 'Revisa la ortografía o quita los filtros.' : 'Cuando el administrador cargue productos aparecerán aquí.'}
        action={products.length ? <Button onPress={clear}>Limpiar filtros</Button> : <Button onPress={refresh} loading={loading}>Actualizar</Button>} />}
      renderItem={({ item }) => columns > 1 ? <View style={{ flex: 1, minWidth: 0 }}>{row(item)}</View> : row(item)} />
    {cartCount > 0 ? <View style={{ borderTopWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: padding, paddingTop: 8, paddingBottom: (bottomInset || 0) + 8 }}>
      <Press accessibilityRole="button" accessibilityLabel={`Ver comanda: ${cartCount} ${cartCount === 1 ? 'artículo' : 'artículos'}, ${money(cartTotal)}`} onPress={openOrder} hapticKind="tap"
        style={{ minHeight: TOUCH_MAIN, borderRadius: radius.md, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, maxWidth: 1116, width: '100%', alignSelf: 'center' }}>
        <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><RollingNumber value={cartCount} size={14} color={c.onPrimary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="700" color={c.onInk}>Ver ronda nueva</T>
          <T size={13} color={c.onInk} style={{ opacity: 0.7 }} numberOfLines={1}>{status.label}</T>
        </View>
        <RollingNumber value={Number(cartTotal || 0)} format={money} size={17} color={c.onInk} />
      </Press>
    </View> : null}
    <MenuFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} availableOnly={availableOnly} setAvailableOnly={setAvailableOnly} sort={sort} setSort={setSort} onRefresh={refresh} loading={loading} />
  </View>;
}
