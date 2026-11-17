// Imagen de un producto: su foto si la tiene; si no, una ilustración por tipo de plato con el tono de su categoría.
// Así el mesero reconoce el producto de un vistazo aunque todavía no haya fotos cargadas.
import React, { memo, useState } from 'react';
import { Image, View } from 'react-native';
import {
  Beer, CakeSlice, Coffee, Croissant, CupSoda, Drumstick, EggFried, Fish, GlassWater, IceCreamCone, Salad, Sandwich, Soup, UtensilsCrossed, Wine,
} from 'lucide-react-native';
import { assetUrl } from '../../context/AuthContext';
import { useTheme } from '../../theme';

const strip = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Del nombre (más preciso) a la categoría (respaldo).
const RULES = [
  [/cafe|capuc|cappuc|latte|espresso|mocac|moca|americano|tinto| te |infusion|aromatica|chocolate caliente/, Coffee],
  [/cerveza|pilsener|club|chela/, Beer],
  [/vino|sangria|coctel|mojito|michelada/, Wine],
  [/jugo|batido|limonada|bebida|gaseosa|cola|frappe|smoothie|naranjada|colada/, CupSoda],
  [/agua/, GlassWater],
  [/ceviche|pescado|camaron|marisco|encocado|viche|corvina|tilapia|langost|concha/, Fish],
  [/sopa|caldo|locro|crema de|sancocho|encebollado|consome/, Soup],
  [/pollo|carne|seco|res|cerdo|chuleta|costilla|parrill|asado|lomo|fritada|hornado|guatita|estofado/, Drumstick],
  [/ensalada/, Salad],
  [/huevo|desayuno|tortilla|bolon|tigrillo/, EggFried],
  [/sanduche|sandwich|tostado|hamburg|wrap|empanada| pan |sanduch|humita|tamal|quimbolito|muchin/, Sandwich],
  [/croissant|pastel|cachito|hojaldre|pan de/, Croissant],
  [/helado|sundae|copa/, IceCreamCone],
  [/postre|torta|cheesecake|pie|brownie|flan|tres leches|mousse|maria pipona|dulce/, CakeSlice],
];
const CATEGORY_RULES = [
  [/cafe|cafeteria/, Coffee], [/bebida|jugo|bar/, CupSoda], [/postre|dulce/, CakeSlice], [/entrada|picad|aperitiv/, Sandwich],
  [/fuerte|almuerzo|plato|principal/, Drumstick], [/desayuno/, EggFried], [/ensalada/, Salad], [/sopa/, Soup], [/mar/, Fish],
];

// Tonos suaves que acompañan al rojo de la marca (claro / oscuro).
const TONES = {
  light: [['#FDEDEA', '#B4321A'], ['#E8F2FD', '#1F64A6'], ['#E9F6EE', '#22744A'], ['#FFF2DF', '#9A5700'], ['#F3EDFB', '#6A45A6'], ['#EEF0F3', '#4B5058']],
  dark: [['#3A1F1A', '#FF9A85'], ['#172638', '#8EC1F5'], ['#16291E', '#7FD3A2'], ['#33260F', '#F2C27A'], ['#271F38', '#C3A8F2'], ['#24262B', '#C3C6CC']],
};
const toneIndex = category => {
  const c = strip(category);
  if (/cafe/.test(c)) return 0;
  if (/bebida|bar|jugo/.test(c)) return 1;
  if (/entrada|ensalada|desayuno/.test(c)) return 2;
  if (/fuerte|almuerzo|plato|principal|sopa|mar/.test(c)) return 3;
  if (/postre|dulce/.test(c)) return 4;
  let h = 0; for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return c ? h % 5 : 5;
};
export function artFor(product = {}) {
  const name = ` ${strip(product.nombre)} `;
  const cat = strip(product.categoria_nombre || product.categoria);
  const icon = (RULES.find(([re]) => re.test(name)) || CATEGORY_RULES.find(([re]) => re.test(cat)) || [null, UtensilsCrossed])[1];
  return { icon, tone: toneIndex(cat) };
}

/** Foto o ilustración cuadrada. `size` solo ajusta el icono; el contenedor llena su ancho. */
export const ProductArt = memo(function ProductArt({ product, radius = 20, dim = false, iconScale = 0.36, style }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const [w, setW] = useState(0);
  const { icon: Icon, tone } = artFor(product);
  const [bg, fg] = TONES[c.isDark ? 'dark' : 'light'][tone];
  const uri = product?.imagen_url && !failed ? assetUrl(product.imagen_url) : null;
  return <View onLayout={e => setW(e.nativeEvent.layout.width)} style={[{ width: '100%', aspectRatio: 1, borderRadius: radius, overflow: 'hidden', backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.45 : 1 }, style]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      : <>
        {/* Plato de fondo: dos círculos que dan profundidad sin ser decoración ajena. */}
        <View style={{ position: 'absolute', width: '74%', aspectRatio: 1, borderRadius: 999, backgroundColor: fg, opacity: c.isDark ? 0.12 : 0.08 }} />
        <View style={{ position: 'absolute', width: '52%', aspectRatio: 1, borderRadius: 999, backgroundColor: fg, opacity: c.isDark ? 0.14 : 0.09 }} />
        <Icon size={Math.max(24, Math.round((w || 120) * iconScale))} color={fg} strokeWidth={1.6} />
      </>}
  </View>;
});
