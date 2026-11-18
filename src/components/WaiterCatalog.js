// Menú del mesero, como una app de delivery: lista con la foto a la derecha y el «+» sobre la foto.
// Tocar la fila suma uno; mantener presionado abre notas y extras. En tablet, cuadrícula.
// Arriba: para quién se pide y su cuenta, búsqueda y categorías. Abajo: la barra del carrito en el color del local.
import React, { memo, useEffect, useMemo, useState, useRef } from 'react';
import { FlatList, Platform, View } from 'react-native';
import { ChevronDown, Minus, Plus, Trash2, Receipt, RotateCcw, Search } from 'lucide-react-native';
import { useTheme } from '../theme';
import { filterMenuProducts, menuStock } from '../utils/waiterCatalog.mjs';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';
import { T, Num, Press, Button, EmptyState, RollingNumber, Appear, Tally, QtyControl, UnderlineTabs, elevate, money, radius, space } from './waiter/kit';
import { MenuSearch } from './waiter/menu';

const price = n => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function useProductState(producto, qty, canAdd, locked, onAdd, onCustomize, chooseTarget) {
  const stock = menuStock(producto);
  const soldOut = Number(producto.agotado) === 1 || Number(producto.disponible ?? 1) !== 1 || stock <= 0;
  const off = locked || soldOut;
  const low = !soldOut && stock < 9999 && stock <= 5;
  const add = () => { if (off) return; if (!canAdd) return chooseTarget(); onAdd(producto); };
  const custom = () => { if (off || !onCustomize) return; if (!canAdd) return chooseTarget(); onCustomize(producto); };
  const label = `${producto.nombre}, ${price(producto.precio)}${qty ? `, ${qty} en la ronda` : ''}${soldOut ? ', agotado' : low ? `, quedan ${stock}` : ''}`;
  return { stock, soldOut, off, low, add, custom, label };
}

// Control de cantidad, como en las apps de delivery:
// sin pedir → «+»; pedido → un cuadro con la cantidad; al tocarlo se abre «− n +» y se cierra solo a los 3 s.
function AddControl({ producto, qty, off, locked, add, onDecrement, onAdd, small, plusBg }) {
  const { c } = useTheme();
  const size = small ? 34 : 38;
  const box = { height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' };
  if (qty > 0 && !locked) return <QtyControl value={qty} tone="brand" size={size} label={producto.nombre} onInc={() => onAdd(producto)} onDec={() => onDecrement(producto)} />;
  if (off) return null;
  return <Press accessibilityRole="button" accessibilityLabel={`Añadir ${producto.nombre}`} onPress={add} hapticKind="tap" scaleTo={0.88}
    style={[box, { width: size, backgroundColor: plusBg || c.surfaceAlt }]}>
    <Plus size={20} color={c.text} strokeWidth={2.4} />
  </Press>;
}

// ── Fila (celular): solo texto, sin foto; el control a la derecha ─────────
const ProductRow = memo(function ProductRow({ producto, qty, canAdd, locked, onAdd, onDecrement, onCustomize, chooseTarget }) {
  const { c } = useTheme();
  const s = useProductState(producto, qty, canAdd, locked, onAdd, onCustomize, chooseTarget);
  // El control va al lado del botón de la fila, no dentro (un botón no puede contener otro).
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 68 }}>
    <Press accessibilityRole="button" accessibilityLabel={s.label} accessibilityHint={s.soldOut ? undefined : canAdd ? 'Toca para añadir; mantén presionado para notas o extras' : 'Elige primero la mesa'}
      disabled={s.off} onPress={s.add} onLongPress={canAdd && !s.off ? s.custom : undefined} hapticKind={s.off ? undefined : 'tap'} scaleTo={0.985}
      style={{ flex: 1, minWidth: 0, paddingVertical: space.md, gap: 2 }}>
      <T size={16} weight="600" numberOfLines={2} color={s.soldOut ? c.muted : c.text}>{producto.nombre}</T>
      {producto.descripcion ? <T size={14} color={c.muted} numberOfLines={1}>{producto.descripcion}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Num size={15} weight="600" color={s.soldOut ? c.muted : c.text}>{price(producto.precio)}</Num>
        {s.soldOut ? <T size={13} weight="700" color={c.red}>Agotado</T> : s.low ? <T size={13} weight="700" color={c.amber}>Quedan {s.stock}</T> : null}
      </View>
    </Press>
    <AddControl producto={producto} qty={qty} off={s.off} locked={locked} add={s.add} onAdd={onAdd} onDecrement={onDecrement} small />
  </View>;
});

// ── Tarjeta (tablet): bloque de texto, sin foto ───────────────────────────
const ProductCard = memo(function ProductCard({ producto, qty, canAdd, locked, onAdd, onDecrement, onCustomize, chooseTarget }) {
  const { c } = useTheme();
  const s = useProductState(producto, qty, canAdd, locked, onAdd, onCustomize, chooseTarget);
  return <View style={{ flex: 1, minWidth: 0, minHeight: 108, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt, justifyContent: 'space-between', gap: space.sm }}>
    <Press accessibilityRole="button" accessibilityLabel={s.label} disabled={s.off} onPress={s.add} onLongPress={canAdd && !s.off ? s.custom : undefined} hapticKind={s.off ? undefined : 'tap'} scaleTo={0.98}
      style={{ gap: 2, flex: 1 }}>
      <T size={16} weight="600" numberOfLines={2} color={s.soldOut ? c.muted : c.text}>{producto.nombre}</T>
      {s.soldOut ? <T size={13} weight="700" color={c.red}>Agotado</T> : s.low ? <T size={13} weight="700" color={c.amber}>Quedan {s.stock}</T> : null}
    </Press>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
      <Num size={15} weight="600" color={s.soldOut ? c.muted : c.text}>{price(producto.precio)}</Num>
      <AddControl producto={producto} qty={qty} off={s.off} locked={locked} add={s.add} onAdd={onAdd} onDecrement={onDecrement} small plusBg={c.bg} />
    </View>
  </View>;
});

export default function WaiterCatalog({ width, products, categories, category, setCategory, search, setSearch, preferences, catalog, locked, counts, cartCount, cartTotal, openOrder, chooseTarget, onAdd, onDecrement, onCustomize, title, emptyTitle, emptyDescription, searchPlaceholder, repeat, refresh, loading, loadError, bottomInset, draftState, account }) {
  const { c } = useTheme();
  const [measured, setMeasured] = useState(null);
  const localWidth = Math.min(width, measured ?? width);
  const grid = localWidth >= 700;
  const padding = localWidth < 600 ? 16 : 24;
  const columns = grid ? (localWidth >= 1100 ? 4 : localWidth >= 900 ? 3 : 2) : 1;
  useEffect(() => { if (!categories.includes(category)) setCategory('Todas'); }, [categories, category, setCategory]);
  const items = useMemo(() => filterMenuProducts(products, { query: search, category, availableOnly: !!preferences?.availableOnly, sort: preferences?.sort || 'name' }), [products, search, category, preferences]);
  const tabs = useMemo(() => categories.map(cat => ({ key: cat, label: cat === 'Todas' ? 'Todo' : cat })), [categories]);

  const header = <View style={{ gap: space.md, paddingBottom: grid ? space.lg : 0 }}>
    {/* Para quién se pide (toca para cambiar) y, a la derecha, lo que ya se pidió. */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Press accessibilityRole="button" accessibilityLabel={catalog.editable ? `Pidiendo para ${catalog.label}. Cambiar` : 'Elegir mesa o pedido'} onPress={chooseTarget} disabled={locked} hapticKind="tap" scaleTo={0.98}
        style={{ flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' }}>
        <T size={13} color={c.muted}>{catalog.editable ? 'Pidiendo para' : 'Primero'}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T size={22} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{catalog.editable ? catalog.label : 'Elige la mesa'}</T>
          <ChevronDown size={20} color={c.text} strokeWidth={2.4} />
        </View>
      </Press>
      {account ? <Press accessibilityRole="button" accessibilityLabel={`Ver la cuenta: ${money(account.total)}`} onPress={account.open} hapticKind="tap" scaleTo={0.96}
        style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Receipt size={17} color={c.text} />
        <Num size={15} weight="700">{money(account.total)}</Num>
      </Press> : null}
    </View>
    {locked ? <T size={14} color={c.amber} weight="600">Hay una ronda esperando confirmación. Ábrela abajo para enviarla.</T> : null}
    {loadError ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T size={14} color={c.red} weight="600" style={{ flex: 1 }}>No se pudo actualizar el menú.</T><Button size="sm" onPress={refresh} loading={loading}>Reintentar</Button>
    </View> : null}
    {title ? <T size={24} weight="700" accessibilityRole="header">{title}</T> : null}
    <MenuSearch value={search} onChangeText={setSearch} placeholder={searchPlaceholder || 'Buscar en el menú'} />
    {repeat && catalog.editable && !search && category === 'Todas' ? <Press accessibilityRole="button" accessibilityLabel={`Repetir la última ronda: ${repeat.label || ''}`} onPress={repeat.onPress} hapticKind="tap" scaleTo={0.97}
      style={{ alignSelf: 'flex-start', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
      <RotateCcw size={16} color={c.text} /><T size={14} weight="600">Repetir la última ronda</T>
    </Press> : null}
    <View style={{ marginHorizontal: -padding }}>
      <View style={{ paddingHorizontal: padding - 12 }}><UnderlineTabs items={tabs} value={category} onChange={setCategory} /></View>
    </View>
  </View>;

  const status = draftDeliveryStatus({ hasDraft: true, ...draftState });
  const cell = item => {
    const props = { producto: item, qty: counts[item.id] || 0, canAdd: catalog.editable, locked, onAdd, onDecrement, onCustomize, chooseTarget };
    return grid ? <ProductCard {...props} /> : <ProductRow {...props} />;
  };
  return <View style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: c.bg }} onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setMeasured(next); }}>
    <FlatList key={columns} data={items} numColumns={columns} keyExtractor={item => String(item.id)} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      initialNumToRender={12} windowSize={7} removeClippedSubviews={Platform.OS !== 'web'}
      contentContainerStyle={{ paddingHorizontal: padding, paddingTop: space.sm, paddingBottom: (bottomInset || 0) + 24, maxWidth: 1180, width: '100%', alignSelf: 'center' }}
      columnWrapperStyle={grid ? { gap: 16 } : undefined}
      ItemSeparatorComponent={() => grid ? <View style={{ height: 20 }} /> : <View style={{ height: 1, backgroundColor: c.line }} />}
      ListEmptyComponent={<EmptyState icon={Search} title={products.length ? 'No hay nada con ese nombre' : (emptyTitle || 'El menú todavía no tiene productos')}
        description={products.length ? 'Prueba con otra palabra o elige «Todo».' : (emptyDescription || 'Cuando el administrador cargue productos aparecerán aquí.')}
        action={products.length ? <Button onPress={() => { setSearch(''); setCategory('Todas'); }}>Ver todo el menú</Button> : <Button onPress={refresh} loading={loading}>Actualizar</Button>} />}
      renderItem={({ item, index }) => {
        const tile = cell(item);
        const last = grid && index === items.length - 1 && items.length % columns;
        return last ? <>{tile}{Array.from({ length: columns - (items.length % columns) }, (_, i) => <View key={i} style={{ flex: 1 }} />)}</> : tile;
      }} />
    {cartCount > 0 ? <Appear style={{ paddingHorizontal: padding, paddingTop: 8, paddingBottom: (bottomInset || 0) + 8, backgroundColor: c.bg }}>
      <Press accessibilityRole="button" accessibilityLabel={`Ver la ronda: ${cartCount} ${cartCount === 1 ? 'producto' : 'productos'}, ${money(cartTotal)}`} onPress={openOrder} hapticKind="tap" scaleTo={0.98}
        style={[{ minHeight: 56, borderRadius: radius.md, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 10, paddingRight: space.lg, maxWidth: 1116, width: '100%', alignSelf: 'center' }]}>
        <View style={{ minWidth: 34, height: 34, borderRadius: 9, backgroundColor: c.brandIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
          <RollingNumber value={cartCount} size={16} weight="800" color={c.onPrimary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={17} weight="700" color={c.onPrimary}>Ver ronda</T>
          {status.key !== 'local' ? <T size={12} color={c.onPrimary} style={{ opacity: 0.85 }} numberOfLines={1}>{status.label}</T> : null}
        </View>
        <RollingNumber value={Number(cartTotal || 0)} format={money} size={17} weight="700" color={c.onPrimary} />
      </Press>
    </Appear> : null}
  </View>;
}
