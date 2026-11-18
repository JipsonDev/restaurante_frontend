// Imagen de un producto: su foto si la tiene; si no, el icono de su tipo de plato sobre gris neutro.
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

export function artFor(product = {}) {
  const name = ` ${strip(product.nombre)} `;
  const cat = strip(product.categoria_nombre || product.categoria);
  const icon = (RULES.find(([re]) => re.test(name)) || CATEGORY_RULES.find(([re]) => re.test(cat)) || [null, UtensilsCrossed])[1];
  return { icon };
}

/** Foto o, sin foto, el icono del tipo de plato sobre gris neutro (sin colores inventados).
 *  `aspect` 1 = cuadrada; `dim` = agotado (foto en gris). */
export const ProductArt = memo(function ProductArt({ product, radius = 16, dim = false, iconScale = 0.36, style, aspect = 1 }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const [w, setW] = useState(0);
  const { icon: Icon } = artFor(product);
  const uri = product?.imagen_url && !failed ? assetUrl(product.imagen_url) : null;
  const gray = dim && typeof document !== 'undefined' ? { filter: 'grayscale(1)', opacity: 0.55 } : dim ? { opacity: 0.45 } : null;
  return <View onLayout={e => setW(e.nativeEvent.layout.width)} style={[{ width: '100%', aspectRatio: aspect, borderRadius: radius, overflow: 'hidden', backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, style]}>
    {uri ? <Image source={{ uri }} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, gray]} />
      : <Icon size={Math.max(22, Math.round((w || 100) * iconScale))} color={c.faint} strokeWidth={1.5} style={dim ? { opacity: 0.5 } : null} />}
  </View>;
});
