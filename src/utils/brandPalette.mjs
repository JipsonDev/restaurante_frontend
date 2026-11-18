// Marca blanca: a partir del color de cada restaurante se derivan los tonos que usa la app,
// con contraste suficiente aunque el color sea muy claro (amarillo) o muy oscuro (azul marino).
export const PRODUCT_BRAND = '#0B7A5E'; // color del producto cuando el local no eligió uno

const clamp = (n, a = 0, b = 255) => Math.min(b, Math.max(a, n));
export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toHex = ([r, g, b]) => `#${[r, g, b].map(v => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t); // t = cuánto de b

/** Oscurece (o aclara) el color hasta lograr el contraste pedido contra el fondo. */
function untilContrast(rgb, ground, ratio, towards) {
  let out = rgb;
  for (let i = 0; i <= 40 && contrast(out, ground) < ratio; i++) out = mix(rgb, towards, i / 40);
  return out;
}

const WHITE = [255, 255, 255], BLACK = [0, 0, 0], INK = [20, 22, 26];

/**
 * Tonos de marca para un modo. bg/surface = fondos de la app en ese modo.
 *  primary: relleno de botones · onPrimary: texto sobre el relleno · primaryText: la marca como texto
 *  primarySoft: fondo suave · primaryPressed/Hover · focus.
 */
function isAlarmHue([r, g, b]) {
  const R = r / 255, G = g / 255, B = b / 255; const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (!d) return false;
  const l = (max + min) / 2; const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4; h = (h * 60 + 360) % 360;
  return sat > 0.45 && (h <= 45 || h >= 340);
}

export function brandTones(hex, { dark = false, bg = dark ? [14, 15, 18] : WHITE, surface = dark ? [25, 26, 31] : WHITE } = {}) {
  const base = parseHex(hex) || parseHex(PRODUCT_BRAND);
  // Relleno: en modo oscuro un color muy oscuro se perdería contra el fondo; se aclara lo justo.
  // En oscuro, el relleno debe distinguirse del fondo (WCAG 1.4.11: 3:1 para elementos de interfaz).
  const fill = dark && contrast(base, bg) < 3 ? untilContrast(base, bg, 3, WHITE) : base;
  // Texto sobre el relleno: blanco o casi negro, el que lea mejor.
  const onPrimary = contrast(fill, WHITE) >= contrast(fill, INK) ? WHITE : INK;
  // La marca como texto o icono sobre el fondo: oscurecida (claro) o aclarada (oscuro) hasta 4.5:1.
  const text = untilContrast(base, surface, 4.5, dark ? WHITE : BLACK);
  const soft = mix(dark ? surface : WHITE, base, dark ? 0.2 : 0.1);
  const pressedTowards = onPrimary === WHITE ? BLACK : WHITE;
  return {
    primary: toHex(fill),
    onPrimary: toHex(onPrimary),
    primaryText: toHex(text),
    primarySoft: toHex(soft),
    primaryHover: toHex(mix(fill, pressedTowards, 0.08)),
    primaryPressed: toHex(mix(fill, pressedTowards, 0.16)),
    focus: `rgba(${fill.map(Math.round).join(',')},${dark ? 0.55 : 0.4})`,
    brandIsLight: onPrimary !== WHITE,
    // Marca rojiza/naranja/ámbar: se confundiría con los colores de urgencia (demora, alergia).
    brandIsAlarm: isAlarmHue(base),
  };
}

/** Iniciales para cuando el local no tiene logo («Morena Mía» → «MM»). */
export function brandInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w) && !/^(de|del|la|el|y|&)$/i.test(w));
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}
