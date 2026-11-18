// Menú del cliente: lo que se abre al escanear el código QR de la mesa. Sin sesión y solo para mirar;
// el pedido se le hace al mesero. Pensado para el teléfono.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { MapPin, Phone, Search, UtensilsCrossed, X } from 'lucide-react-native';
import { BASE_URL } from '../context/AuthContext';
import { MeseroAppearance, setBrandColor, useTheme } from '../theme';
import Logo from '../components/Logo';
import { ProductArt } from '../components/waiter/ProductArt';
import { Appear, BottomSheet, Button, FONT, Num, Press, T, elevate, radius, space, useComandaFonts } from '../components/waiter/kit';

const strip = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Dish({ product, symbol, onOpen }) {
  const { c } = useTheme();
  const price = `${symbol}${Number(product.precio).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return <Press accessibilityRole="button" accessibilityLabel={`${product.nombre}, ${price}${product.agotado ? ', agotado' : ''}`} onPress={() => onOpen(product)} scaleTo={0.97}
    style={{ flex: 1, minWidth: 0, gap: 8 }}>
    <View>
      <ProductArt product={product} radius={22} dim={product.agotado} />
      {product.agotado ? <View style={{ position: 'absolute', left: 8, top: 8, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c.ink, justifyContent: 'center' }}>
        <T size={12} weight="800" color={c.onInk}>Agotado</T>
      </View> : null}
    </View>
    <View style={{ paddingHorizontal: 2, gap: 2, opacity: product.agotado ? 0.55 : 1 }}>
      <T size={16} weight="700" numberOfLines={2} style={{ lineHeight: 20 }}>{product.nombre}</T>
      {product.descripcion ? <T size={13} color={c.muted} numberOfLines={2}>{product.descripcion}</T> : null}
      <Num size={16} weight="800" color={c.primaryText}>{price}</Num>
    </View>
  </Press>;
}

function Menu({ code }) {
  useComandaFonts();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState('Todo');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    setError('');
    fetch(`${BASE_URL}/publico/menu?mesa=${encodeURIComponent(code || '')}`)
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !Array.isArray(data.productos)) throw new Error(data?.message || 'No se pudo cargar el menú.');
        if (alive) setMenu(data);
      })
      .catch(e => { if (alive) setError(e.message === 'Failed to fetch' ? 'Parece que no hay internet. Revisa tu conexión e intenta de nuevo.' : e.message); });
    return () => { alive = false; };
  }, [code, attempt]);
  useEffect(() => { if (menu?.negocio) setBrandColor(menu.negocio.color_marca || null); }, [menu?.negocio?.color_marca]);
  useEffect(() => { if (menu?.negocio?.nombre && typeof document !== 'undefined') document.title = `Menú · ${menu.negocio.nombre}`; }, [menu]);

  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const symbol = menu?.negocio?.simbolo || '$';
  const sections = useMemo(() => {
    if (!menu) return [];
    const q = strip(query);
    return menu.categorias
      .filter(name => category === 'Todo' || name === category)
      .map(name => ({ name, items: menu.productos.filter(p => p.categoria === name && (!q || strip(`${p.nombre} ${p.descripcion || ''}`).includes(q))) }))
      .filter(section => section.items.length);
  }, [menu, category, query]);

  if (error) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: space.lg }}>
    <Logo width={160} dark={c.isDark} />
    <T size={18} weight="800" style={{ textAlign: 'center' }}>No pudimos abrir el menú</T>
    <T size={15} color={c.muted} style={{ textAlign: 'center', maxWidth: 320 }}>{error}</T>
    <Button variant="primary" size="lg" onPress={() => setAttempt(n => n + 1)} style={{ alignSelf: 'stretch', maxWidth: 320, width: '100%', marginHorizontal: 'auto' }}>Intentar de nuevo</Button>
  </View>;
  if (!menu) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: space.lg }}>
    <Logo width={160} dark={c.isDark} />
    <ActivityIndicator color={c.primary} />
  </View>;

  const chips = ['Todo', ...menu.categorias];
  const rows = items => Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => items.slice(i * columns, i * columns + columns));
  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <ScrollView stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Portada: la marca y la mesa. */}
      <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 18, paddingHorizontal: 20, gap: 12, backgroundColor: c.primarySoft }}>
        <Logo width={Math.min(220, width * 0.56)} dark={c.isDark} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {menu.mesa ? <View style={{ height: 34, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.primary, justifyContent: 'center' }}>
            <T size={15} weight="800" color={c.onPrimary}>Mesa {menu.mesa.numero}</T>
          </View> : null}
          <T size={15} weight="600" color={c.muted}>Nuestro menú</T>
        </View>
      </View>

      {/* Categorías, siempre a la vista al bajar. */}
      <View style={{ backgroundColor: c.bg, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
        {searching ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, height: 48, paddingLeft: 16, paddingRight: 4, borderRadius: 8, backgroundColor: c.surfaceAlt }}>
          <Search size={18} color={c.muted} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Buscar un plato o bebida" placeholderTextColor={c.muted} accessibilityLabel="Buscar en el menú"
            style={{ flex: 1, minWidth: 0, fontSize: 16, color: c.text, fontFamily: FONT, outlineStyle: 'none', height: 48 }} />
          <Press accessibilityRole="button" accessibilityLabel="Cerrar la búsqueda" onPress={() => { setQuery(''); setSearching(false); }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={c.text} /></Press>
        </View>
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}>
            <Press accessibilityRole="button" accessibilityLabel="Buscar en el menú" onPress={() => setSearching(true)} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Search size={19} color={c.text} /></Press>
            {chips.map(name => {
              const active = name === category;
              return <Press key={name} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setCategory(name)} scaleTo={0.96}
                style={{ height: 44, paddingHorizontal: 18, borderRadius: 8, justifyContent: 'center', backgroundColor: active ? c.ink : c.surfaceAlt }}>
                <T size={15} weight={active ? '800' : '600'} color={active ? c.onInk : c.text}>{name}</T>
              </Press>;
            })}
          </ScrollView>}
      </View>

      <View style={{ paddingHorizontal: 16, maxWidth: 1080, width: '100%', alignSelf: 'center' }}>
        {!sections.length ? <View style={{ alignItems: 'center', paddingVertical: 64, gap: 10 }}>
          <UtensilsCrossed size={34} color={c.faint || c.muted} />
          <T size={18} weight="800">{query ? 'No encontramos ese plato' : 'El menú se está preparando'}</T>
          <T size={15} color={c.muted} style={{ textAlign: 'center' }}>{query ? 'Prueba con otra palabra.' : 'Pregunta a tu mesero por las opciones de hoy.'}</T>
          {query ? <Button onPress={() => setQuery('')}>Ver todo el menú</Button> : null}
        </View> : null}
        {sections.map((section, si) => <Appear key={section.name} delay={Math.min(si, 4) * 60}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 26, marginBottom: 14 }}>
            <T size={22} weight="800" accessibilityRole="header">{section.name}</T>
            <Num size={14} weight="600" color={c.faint || c.muted}>{section.items.length}</Num>
          </View>
          <View style={{ gap: 22 }}>
            {rows(section.items).map((row, ri) => <View key={ri} style={{ flexDirection: 'row', gap: 14 }}>
              {row.map(product => <Dish key={product.id} product={product} symbol={symbol} onOpen={setOpen} />)}
              {Array.from({ length: columns - row.length }, (_, i) => <View key={`f${i}`} style={{ flex: 1 }} />)}
            </View>)}
          </View>
        </Appear>)}

        {/* Cierre: cómo pedir y los datos del local. */}
        <View style={{ marginTop: 40, padding: 20, borderRadius: radius.xl, backgroundColor: c.surfaceAlt, gap: 10, alignItems: 'center' }}>
          <T size={17} weight="800" style={{ textAlign: 'center' }}>¿Ya sabes qué vas a pedir?</T>
          <T size={15} color={c.muted} style={{ textAlign: 'center' }}>Llama a tu mesero y con gusto toma tu pedido.</T>
          {menu.negocio.telefono || menu.negocio.direccion ? <View style={{ marginTop: 6, gap: 6, alignItems: 'center' }}>
            {menu.negocio.direccion ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MapPin size={15} color={c.muted} /><T size={14} color={c.muted}>{menu.negocio.direccion}</T></View> : null}
            {menu.negocio.telefono ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Phone size={15} color={c.muted} /><T size={14} color={c.muted}>{menu.negocio.telefono}</T></View> : null}
          </View> : null}
        </View>
        <T size={12} color={c.faint || c.muted} style={{ textAlign: 'center', marginTop: 16 }}>Precios en dólares. Pueden cambiar sin previo aviso.</T>
      </View>
    </ScrollView>

    {/* Detalle del plato: foto grande, descripción y precio. */}
    <BottomSheet visible={!!open} onClose={() => setOpen(null)} title={open?.nombre || ''} subtitle={open?.categoria}>
      {open ? <View style={{ gap: space.lg }}>
        <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center' }}><ProductArt product={open} radius={24} dim={open.agotado} /></View>
        {open.descripcion ? <T size={16} color={c.muted} style={{ lineHeight: 23 }}>{open.descripcion}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Num size={26} weight="800">{symbol}{Number(open.precio).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Num>
          {open.agotado ? <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}><T size={14} weight="800" color={c.muted}>Agotado por hoy</T></View> : null}
        </View>
        <Button variant="ink" size="lg" full onPress={() => setOpen(null)}>Seguir viendo el menú</Button>
      </View> : null}
    </BottomSheet>
  </View>;
}

export default function PublicMenu({ code }) {
  return <MeseroAppearance><Menu code={code} /></MeseroAppearance>;
}

/** Código de mesa si la página se abrió desde un QR («/?menu=5-a1b2c3d4e5»); si no, null. */
export function publicMenuCode() {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has('menu') ? (params.get('menu') || '') : null;
  } catch { return null; }
}
