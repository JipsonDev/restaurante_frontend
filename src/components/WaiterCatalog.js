// Menú del mesero: tocar una foto suma el producto a la ronda. Poco texto, la imagen manda.
// Arriba: a quién se le pide (y su cuenta), búsqueda y categorías. Abajo: la barra «Ver ronda».
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Platform, ScrollView, View } from 'react-native';
import { ChevronDown, LayoutGrid, Minus, Receipt, RotateCcw, Search, ShoppingBag, Table2 } from 'lucide-react-native';
import { useTheme } from '../theme';
import { filterMenuProducts, menuStock } from '../utils/waiterCatalog.mjs';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';
import { T, Num, Press, Button, EmptyState, RollingNumber, Appear, elevate, haptic, money, TOUCH, WEB, radius, space } from './waiter/comanda';
import { MenuSearch } from './waiter/menu';
import { ProductArt, artFor } from './waiter/ProductArt';

const ND = !WEB;
const price = n => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Tarjeta de producto ────────────────────────────────────────────────────
const ProductTile = memo(function ProductTile({ producto, qty, canAdd, locked, onAdd, onDecrement, onCustomize, chooseTarget }) {
  const { c } = useTheme();
  const stock = menuStock(producto);
  const soldOut = Number(producto.agotado) === 1 || Number(producto.disponible ?? 1) !== 1 || stock <= 0;
  const off = locked || soldOut;
  const low = !soldOut && stock < 9999 && stock <= 5;
  const pop = useRef(new Animated.Value(0)).current;   // contador que salta
  const plus = useRef(new Animated.Value(0)).current;  // «+1» que sube y se desvanece
  const prev = useRef(qty);
  useEffect(() => {
    if (qty > prev.current) {
      pop.setValue(0); Animated.spring(pop, { toValue: 1, speed: 26, bounciness: 14, useNativeDriver: ND }).start();
      plus.setValue(0); Animated.timing(plus, { toValue: 1, duration: 520, useNativeDriver: ND }).start();
    }
    prev.current = qty;
  }, [qty]);
  const add = () => { if (off) return; if (!canAdd) return chooseTarget(); onAdd(producto); };
  const custom = () => { if (off || !onCustomize) return; if (!canAdd) return chooseTarget(); onCustomize(producto); };
  const label = `${producto.nombre}, ${price(producto.precio)}${qty ? `, ${qty} en la ronda` : ''}${soldOut ? ', agotado' : low ? `, quedan ${stock}` : ''}`;
  return <View style={{ flex: 1, minWidth: 0 }}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={soldOut ? undefined : canAdd ? 'Toca para añadir; mantén presionado para notas o extras' : 'Elige primero la mesa'}
      disabled={off} onPress={add} onLongPress={canAdd && !off ? custom : undefined} hapticKind={off ? undefined : 'tap'} scaleTo={0.95}
      style={{ gap: 8, borderRadius: radius.lg }}>
      <View>
        <ProductArt product={producto} radius={20} dim={soldOut} style={qty ? { borderWidth: 3, borderColor: c.primary } : null} />
        {soldOut ? <View style={{ position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: c.isDark ? '#000000CC' : '#16171ACC' }}>
          <T size={12} weight="800" color="#FFFFFF">Agotado</T></View> : null}
        {qty > 0 ? <Animated.View style={[{ position: 'absolute', top: 8, right: 8, minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 17, backgroundColor: c.primary,
          alignItems: 'center', justifyContent: 'center' }, elevate(c, 1), { transform: [{ scale: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.35, 1] }) }] }]}>
          <Num size={16} weight="800" color={c.onPrimary}>{qty}</Num>
        </Animated.View> : null}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '38%', alignSelf: 'center', opacity: plus.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateY: plus.interpolate({ inputRange: [0, 1], outputRange: [6, -34] }) }, { scale: plus.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.6, 1.1, 1] }) }] }}>
          <View style={{ paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: c.primary, justifyContent: 'center' }}><T size={16} weight="800" color={c.onPrimary}>+1</T></View>
        </Animated.View>
      </View>
      <View style={{ gap: 1, paddingHorizontal: 2 }}>
        <T size={15} weight="700" numberOfLines={2} style={{ minHeight: 40 }} color={soldOut ? c.muted : c.text}>{producto.nombre}</T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Num size={16} weight="800" color={soldOut ? c.muted : c.text}>{price(producto.precio)}</Num>
          {low ? <T size={12} weight="700" color={c.amber}>Quedan {stock}</T> : null}
        </View>
      </View>
    </Press>
    {qty > 0 && !locked ? <Press accessibilityRole="button" accessibilityLabel={`Quitar uno de ${producto.nombre}`} onPress={() => onDecrement(producto)} hapticKind="select" scaleTo={0.85}
      style={[{ position: 'absolute', top: 8, left: 8, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }, elevate(c, 1)]}>
      <Minus size={20} strokeWidth={2.6} color={c.text} />
    </Press> : null}
  </View>;
});

// ── Categorías con su ilustración ──────────────────────────────────────────
function Categories({ items, value, onChange }) {
  const { c } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} style={{ flexGrow: 0 }}>
    {items.map(cat => {
      const on = cat === value;
      const Icon = cat === 'Todas' ? LayoutGrid : artFor({ categoria_nombre: cat }).icon;
      return <Press key={cat} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={cat === 'Todas' ? 'Todo el menú' : cat} onPress={() => { haptic('select'); onChange(cat); }} scaleTo={0.95}
        style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 12, paddingRight: 16, borderRadius: radius.pill, backgroundColor: on ? c.ink : c.surfaceAlt }}>
        <Icon size={17} color={on ? c.onInk : c.muted} />
        <T size={15} weight={on ? '800' : '600'} color={on ? c.onInk : c.text}>{cat === 'Todas' ? 'Todo' : cat}</T>
      </Press>;
    })}
  </ScrollView>;
}

export default function WaiterCatalog({ width, products, categories, category, setCategory, search, setSearch, preferences, catalog, locked, counts, cartCount, cartTotal, openOrder, chooseTarget, onAdd, onDecrement, onCustomize, title, emptyTitle, emptyDescription, searchPlaceholder, repeat, refresh, loading, loadError, bottomInset, draftState, account }) {
  const { c } = useTheme();
  const [measured, setMeasured] = useState(null);
  const localWidth = Math.min(width, measured ?? width);
  const padding = localWidth < 600 ? 16 : 24;
  const columns = localWidth >= 1100 ? 5 : localWidth >= 820 ? 4 : localWidth >= 560 ? 3 : 2;
  useEffect(() => { if (!categories.includes(category)) setCategory('Todas'); }, [categories, category, setCategory]);
  const items = useMemo(() => filterMenuProducts(products, { query: search, category, availableOnly: !!preferences?.availableOnly, sort: preferences?.sort || 'name' }), [products, search, category, preferences]);
  const express = catalog.reason?.startsWith('express') || catalog.reason === 'draft';
  const DestIcon = express ? ShoppingBag : Table2;

  const header = <View style={{ gap: space.md, paddingBottom: space.md }}>
    {/* A quién se le pide. A la derecha, su cuenta (lo que ya se pidió). */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Press accessibilityRole="button" accessibilityLabel={catalog.editable ? `Pidiendo para ${catalog.label}. Cambiar` : 'Elegir mesa o pedido'} onPress={chooseTarget} disabled={locked} hapticKind="tap" scaleTo={0.97}
        style={{ flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 8, paddingRight: 12, borderRadius: radius.pill, backgroundColor: catalog.editable ? c.primarySoft : c.surfaceAlt }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: catalog.editable ? c.primary : c.surface }}>
          <DestIcon size={19} color={catalog.editable ? c.onPrimary : c.text} />
        </View>
        <T size={18} weight="800" numberOfLines={1} style={{ flex: 1 }}>{catalog.editable ? catalog.label : 'Elige la mesa'}</T>
        <ChevronDown size={18} color={c.primaryText} />
      </Press>
      {account ? <Press accessibilityRole="button" accessibilityLabel={`Ver la cuenta: ${money(account.total)}`} onPress={account.open} hapticKind="tap" scaleTo={0.95}
        style={{ minHeight: 56, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Receipt size={18} color={c.text} />
        <View><T size={12} weight="600" color={c.muted}>Cuenta</T><Num size={15} weight="800">{money(account.total)}</Num></View>
      </Press> : null}
    </View>
    {locked ? <T size={14} color={c.amber} weight="700">Hay una ronda esperando confirmación. Ábrela abajo para enviarla.</T> : null}
    {loadError ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} color={c.red} weight="600" style={{ flex: 1 }}>No se pudo actualizar el menú.</T><Button size="sm" onPress={refresh} loading={loading}>Reintentar</Button>
    </View> : null}
    {title ? <T size={24} weight="800" accessibilityRole="header">{title}</T> : null}
    <MenuSearch value={search} onChangeText={setSearch} placeholder={searchPlaceholder || 'Buscar en el menú'} />
    <Categories items={categories} value={category} onChange={setCategory} />
    {repeat && catalog.editable && !search && category === 'Todas' ? <Press accessibilityRole="button" accessibilityLabel={`Repetir la última ronda: ${repeat.label || ''}`} onPress={repeat.onPress} hapticKind="tap" scaleTo={0.97}
      style={{ alignSelf: 'flex-start', height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.line }}>
      <RotateCcw size={16} color={c.text} /><T size={14} weight="700">Repetir última ronda</T>
    </Press> : null}
  </View>;

  const status = draftDeliveryStatus({ hasDraft: true, ...draftState });
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: c.bg }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setMeasured(next); }}>
    <FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => String(item.id)} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      initialNumToRender={12} windowSize={7} removeClippedSubviews={Platform.OS !== 'web'}
      contentContainerStyle={{ padding, paddingTop: space.md, paddingBottom: (bottomInset || 0) + 24, maxWidth: 1180, width: '100%', alignSelf: 'center' }}
      columnWrapperStyle={{ gap: 12 }} ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
      ListEmptyComponent={<EmptyState icon={Search} title={products.length ? 'No hay nada con ese nombre' : (emptyTitle || 'El menú todavía no tiene productos')}
        description={products.length ? 'Prueba con otra palabra o elige «Todo».' : (emptyDescription || 'Cuando el administrador cargue productos aparecerán aquí.')}
        action={products.length ? <Button onPress={() => { setSearch(''); setCategory('Todas'); }}>Ver todo el menú</Button> : <Button onPress={refresh} loading={loading}>Actualizar</Button>} />}
      renderItem={({ item, index }) => {
        const tile = <ProductTile producto={item} qty={counts[item.id] || 0} canAdd={catalog.editable} locked={locked} onAdd={onAdd} onDecrement={onDecrement} onCustomize={onCustomize} chooseTarget={chooseTarget} />;
        // La última fila incompleta conserva el ancho de las columnas.
        const last = index === items.length - 1 && items.length % columns;
        return last ? <>{tile}{Array.from({ length: columns - (items.length % columns) }, (_, i) => <View key={i} style={{ flex: 1 }} />)}</> : tile;
      }} />
    {cartCount > 0 ? <Appear style={{ paddingHorizontal: padding, paddingTop: 6, paddingBottom: (bottomInset || 0) + 2 }}>
      <Press accessibilityRole="button" accessibilityLabel={`Ver la ronda: ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}, ${money(cartTotal)}`} onPress={openOrder} hapticKind="tap"
        style={[{ minHeight: 60, borderRadius: radius.pill, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 10, paddingRight: space.xl, maxWidth: 1116, width: '100%', alignSelf: 'center' }, elevate(c, 2)]}>
        <View style={{ minWidth: 40, height: 40, borderRadius: 20, backgroundColor: c.onPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}><RollingNumber value={cartCount} size={17} weight="800" color={c.primary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={17} weight="800" color={c.onPrimary}>Ver ronda y enviar</T>
          {status.key !== 'local' ? <T size={12} color={c.onPrimary} style={{ opacity: 0.85 }} numberOfLines={1}>{status.label}</T> : null}
        </View>
        <RollingNumber value={Number(cartTotal || 0)} format={money} size={18} weight="800" color={c.onPrimary} />
      </Press>
    </Appear> : null}
  </View>;
}
