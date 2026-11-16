// Menú del mesero en lenguaje «Comanda»: cada producto es una línea de la libreta
// «Batido de mora ····· 2,80». Tocar la línea suma uno; mantener (o el botón ⋯) abre la personalización.
import React, { memo, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Search, SlidersHorizontal, X, RotateCcw, Flame, ShoppingBag, Bike, LockKeyhole } from 'lucide-react-native';
import { comandaTableMeta, useTheme } from '../../theme';
import { menuStock } from '../../utils/waiterCatalog.mjs';
import { normalize } from '../../utils/waiterFavorites.mjs';
import { T, Num, Label, Press, Button, Chip, LeaderLine, RollingNumber, BottomSheet, EmptyState, TOUCH, FONT, WEB, radius, space } from './comanda';

const price = n => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Línea de producto ──────────────────────────────────────────────────────
export const MenuRow = memo(function MenuRow({ producto, qty = 0, isPromo, locked, canAdd, onAdd, onCustomize, onDecrement, chooseTarget }) {
  const { c } = useTheme();
  const stock = menuStock(producto);
  const available = Number(producto.disponible ?? 1) === 1 && stock > 0;
  const limit = qty >= stock;
  const off = locked || !available;
  const add = () => { if (off) return; if (!canAdd) return chooseTarget(); onAdd(producto, isPromo); }; // sin stock: WaiterApp avisa con un toast
  const custom = () => { if (off) return; if (!canAdd) return chooseTarget(); onCustomize?.(producto, isPromo); };
  const note = locked ? 'Envío pendiente' : !available ? 'Agotado' : limit ? 'Sin más stock' : stock < 9999 && stock <= 5 ? `Quedan ${stock}` : null;
  const label = `${producto.nombre}, ${price(producto.precio)} dólares${qty ? `, ${qty} en la ronda` : ''}${note ? `, ${note}` : ''}`;
  return <View style={{ flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: c.line, opacity: off ? 0.5 : 1 }}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={canAdd ? 'Toca para añadir uno; mantén para personalizar' : 'Elige primero mesa o pedido'}
      disabled={off} onPress={add} onLongPress={onCustomize && canAdd ? custom : undefined} hapticKind={off ? undefined : 'tap'} scaleTo={0.99} sink={0}
      hoverStyle={{ backgroundColor: c.soft }} style={{ flex: 1, minHeight: 60, paddingVertical: 10, paddingLeft: space.md, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 34, alignItems: 'center' }}>
        {qty > 0 ? <View style={{ minWidth: 30, height: 28, paddingHorizontal: 4, borderRadius: radius.sm, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <RollingNumber value={qty} size={15} color={c.onInk} />
        </View> : <Num size={15} color={c.faint}>{locked ? '' : '+'}</Num>}
        {locked ? <LockKeyhole size={16} color={c.muted} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <LeaderLine dim={off} left={<T size={17} weight={qty ? '700' : '500'} numberOfLines={2}>{producto.nombre}</T>} right={<Num size={16} weight="600">{price(producto.precio)}</Num>} />
        {(isPromo || note || producto.descripcion) ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {isPromo ? <Label size={13} color={c.primary}>Promo</Label> : null}
          {note ? <T size={13} weight="600" color={!available || limit ? c.red : c.amber}>{note}</T> : null}
          {producto.descripcion && !note ? <T size={13} color={c.muted} numberOfLines={1} style={{ flex: 1 }}>{producto.descripcion}</T> : null}
        </View> : null}
      </View>
    </Press>
    {qty > 0 && canAdd && !locked ? <Press accessibilityRole="button" accessibilityLabel={`Quitar uno de ${producto.nombre}`} onPress={() => onDecrement(producto, isPromo)} hapticKind="select"
      scaleTo={0.9} sink={0} hoverStyle={{ backgroundColor: c.soft }} style={{ width: TOUCH, alignItems: 'center', justifyContent: 'center' }}><Num size={22} weight="700" color={c.muted}>−</Num></Press> : null}
    {onCustomize && canAdd && !off ? <Press accessibilityRole="button" accessibilityLabel={`Personalizar ${producto.nombre}`} onPress={custom} hapticKind="tap"
      scaleTo={0.9} sink={0} hoverStyle={{ backgroundColor: c.soft }} style={{ width: TOUCH, alignItems: 'center', justifyContent: 'center' }}><SlidersHorizontal size={19} color={c.muted} /></Press> : null}
  </View>;
});

// ── Cabecera compacta: búsqueda + categorías + filtros ─────────────────────
export function MenuSearch({ value, onChangeText, placeholder = 'Buscar en el menú', onFilters, filtersActive }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
    <View style={{ flex: 1, minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderWidth: 1.5, borderColor: focus ? c.ink : c.lineStrong, borderRadius: radius.md, backgroundColor: c.surface }}>
      <Search size={18} color={c.muted} />
      <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.faint} returnKeyType="search"
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minHeight: TOUCH - 4, fontFamily: FONT, fontSize: 16, color: c.text, ...(WEB ? { outlineStyle: 'none' } : {}) }} />
      {value ? <Press accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => onChangeText('')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={c.muted} /></Press> : null}
    </View>
    {onFilters ? <Press accessibilityRole="button" accessibilityLabel={filtersActive ? 'Filtros, activos' : 'Filtros'} onPress={onFilters} hapticKind="tap" scaleTo={0.94}
      style={{ width: TOUCH, height: TOUCH, borderRadius: radius.md, borderWidth: 1.5, borderColor: filtersActive ? c.ink : c.lineStrong, backgroundColor: filtersActive ? c.ink : c.surface, alignItems: 'center', justifyContent: 'center' }}>
      <SlidersHorizontal size={19} color={filtersActive ? c.onInk : c.text} />
    </Press> : null}
  </View>;
}

export function CategoryChips({ items, value, onChange, counts }) {
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: WEB ? 'nowrap' : 'nowrap', gap: 8, ...(WEB ? { overflowX: 'auto', scrollbarWidth: 'none' } : {}) }}>
    {items.map(([key, text]) => <Chip key={key} selected={value === key} onPress={() => onChange(key)} count={counts?.[key]}>{text}</Chip>)}
  </View>;
}

export function MenuFiltersSheet({ visible, onClose, availableOnly, setAvailableOnly, sort, setSort, onRefresh, loading }) {
  const { c } = useTheme();
  return <BottomSheet visible={visible} onClose={onClose} title="Filtros del menú" footer={<Button variant="ink" size="lg" full onPress={onClose}>Listo</Button>}>
    <View style={{ gap: space.sm }}><Label>Mostrar</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip selected={!availableOnly} onPress={() => setAvailableOnly(false)}>Todo</Chip>
        <Chip selected={availableOnly} onPress={() => setAvailableOnly(true)}>Solo con stock</Chip>
      </View></View>
    <View style={{ gap: space.sm }}><Label>Ordenar por</Label>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip selected={sort === 'name'} onPress={() => setSort('name')}>Nombre A–Z</Chip>
        <Chip selected={sort === 'price'} onPress={() => setSort('price')}>Menor precio</Chip>
      </View></View>
    {onRefresh ? <Button icon={RotateCcw} onPress={() => { onRefresh(); onClose(); }} loading={loading}>Actualizar menú</Button> : null}
    <T size={14} color={c.muted}>Consejo: toca una línea para sumar uno; mantenla presionada para elegir extras, término o notas.</T>
  </BottomSheet>;
}

// ── Lo más pedido hoy + repetir ronda ──────────────────────────────────────
export function QuickStrip({ favorites = [], counts = {}, canAdd, locked, onAdd, chooseTarget, repeat }) {
  const { c } = useTheme();
  if (!favorites.length && !repeat) return null;
  return <View style={{ gap: space.sm }}>
    {repeat ? <Press accessibilityRole="button" accessibilityLabel={`Repetir ronda anterior: ${repeat.summary}`} onPress={repeat.onPress} disabled={locked} hapticKind="medium"
      hoverStyle={{ backgroundColor: c.soft }} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink, borderRadius: radius.md, opacity: locked ? 0.5 : 1 }}>
      <RotateCcw size={20} color={c.text} />
      <View style={{ flex: 1, minWidth: 0 }}><T size={16} weight="700">Repetir ronda anterior</T><T size={13} color={c.muted} numberOfLines={1}>{repeat.summary}</T></View>
      <Num size={15} weight="600">{price(repeat.total)}</Num>
    </Press> : null}
    {favorites.length ? <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Flame size={15} color={c.primary} /><Label>Lo más pedido hoy</Label></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: 8, paddingHorizontal: space.lg }}>
        {favorites.map(f => {
          const p = f.product; const qty = counts[p.id] || 0;
          const out = menuStock(p) <= 0 || locked;
          return <Press key={p.id} accessibilityRole="button" accessibilityLabel={`Añadir ${p.nombre}${qty ? `, ${qty} en la ronda` : ''}`} disabled={out}
            onPress={() => canAdd ? onAdd(p, false) : chooseTarget()} hapticKind="tap" scaleTo={0.95}
            hoverStyle={{ borderColor: c.ink }} style={{ minHeight: TOUCH, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: radius.md,
              borderWidth: 1.5, borderColor: qty ? c.ink : c.lineStrong, backgroundColor: c.surface, opacity: out ? 0.45 : 1 }}>
            <T size={15} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{p.nombre}</T>
            {qty ? <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><RollingNumber value={qty} size={12} color={c.onInk} /></View>
              : <Num size={13} color={c.muted}>{price(p.precio)}</Num>}
          </Press>;
        })}
      </ScrollView>
    </> : null}
  </View>;
}

// ── Destino del pedido ─────────────────────────────────────────────────────
function TableTile({ mesa, state, current, onPress }) {
  const { c } = useTheme();
  const meta = comandaTableMeta(state, c);
  return <Press accessibilityRole="button" accessibilityLabel={`Mesa ${mesa.numero}, ${meta.label}${current ? ', seleccionada' : ''}`} accessibilityState={{ selected: current }} onPress={onPress} hapticKind="select" scaleTo={0.94}
    style={{ width: 86, minHeight: 72, padding: 8, borderRadius: radius.md, borderWidth: current ? 3 : meta.shape === 'stamp' ? 2 : 1.5, borderStyle: meta.shape === 'dashed' ? 'dashed' : 'solid',
      borderColor: current ? c.primary : meta.border, backgroundColor: meta.bg, justifyContent: 'space-between' }}>
    <Num size={24} weight="700" color={meta.number}>{mesa.numero}</Num>
    <T size={13} weight="600" color={meta.text} numberOfLines={1}>{meta.label}</T>
  </Press>;
}

export function TargetPickerSheet({ visible, onClose, mesas = [], zoneOf, stateOf, currentMesaId, onPickTable, onPickExpress }) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = normalize(query);
    const map = new Map();
    mesas.filter(m => !q || normalize(`mesa ${m.numero} ${zoneOf(m)}`).includes(q))
      .sort((a, b) => Number(a.numero) - Number(b.numero))
      .forEach(m => { const z = zoneOf(m) || 'Salón'; if (!map.has(z)) map.set(z, []); map.get(z).push(m); });
    return [...map.entries()];
  }, [mesas, query, zoneOf]);
  return <BottomSheet visible={visible} onClose={() => { setQuery(''); onClose(); }} title="Destino del pedido" subtitle="Elige la mesa o un pedido para llevar."
    footer={<View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button icon={ShoppingBag} variant="ghost" style={{ flex: 1, borderWidth: 1.5, borderColor: c.lineStrong }} onPress={() => onPickExpress('Para llevar')}>Para llevar</Button>
      <Button icon={Bike} variant="ghost" style={{ flex: 1, borderWidth: 1.5, borderColor: c.lineStrong }} onPress={() => onPickExpress('Delivery')}>Delivery</Button>
    </View>}>
    {mesas.length > 8 ? <MenuSearch value={query} onChangeText={setQuery} placeholder="Buscar mesa o zona" /> : null}
    {groups.length ? groups.map(([zone, list]) => <View key={zone} style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{zone}</Label><Num size={13} color={c.muted}>{list.filter(m => stateOf(m) === 'Libre').length} libres</Num></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map(m => <TableTile key={m.id} mesa={m} state={stateOf(m)} current={Number(m.id) === Number(currentMesaId)} onPress={() => onPickTable(m)} />)}
      </View>
    </View>) : <EmptyState icon={Search} title={mesas.length ? 'Ninguna mesa coincide' : 'No hay mesas registradas'} description={mesas.length ? 'Prueba con otro número o zona.' : 'Puedes tomar un pedido para llevar.'} />}
  </BottomSheet>;
}
