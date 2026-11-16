// Menú del mesero: qué extras corresponden a cada producto, lo más pedido del día y repetir la ronda anterior.
export const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const DRINK = /bebida|jugo|batido|refresco|gaseosa|agua|cafe|cafeteria|te\b|infusion|cerveza|coctel|trago|licor|vino|bar\b/;
const SWEET = /postre|dulce|helado|pasteler|reposter/;
const GLOBAL = new Set(['', 'todas', 'todos', 'general', 'todo']);

export const productCategory = product => product?.categoria_nombre || product?.categoria || 'General';

// ¿El extra aplica a este producto? Sin categoría = aplica a todo.
// «Bebidas» cubre todo lo que se bebe (incluido café); «Comida» cubre platos salados (no bebidas ni postres);
// cualquier otra categoría se compara por nombre (con o sin acentos, y por prefijo: «Cafe» ≈ «Cafetería»).
export function extraAppliesTo(extra, product) {
  const target = normalize(extra?.categoria);
  if (GLOBAL.has(target)) return true;
  const cat = normalize(productCategory(product));
  if (target === cat || cat.startsWith(target) || target.startsWith(cat)) return true;
  if (/^bebida/.test(target)) return DRINK.test(cat);
  if (/^comida|^plato|^cocina/.test(target)) return !DRINK.test(cat) && !SWEET.test(cat);
  if (/^postre|^dulce/.test(target)) return SWEET.test(cat);
  return false;
}

export function extrasForProduct(extras = [], product) {
  return extras.filter(e => Number(e.activo ?? 1) === 1 && extraAppliesTo(e, product));
}

// Modificador tal como lo guarda la comanda.
export const toModifier = extra => ({ nombre: extra.nombre, tipo: extra.tipo || 'EXTRA', precio_extra: Number(extra.precio_extra ?? extra.precio ?? 0) });

const localDay = value => {
  const d = value instanceof Date ? value : new Date(String(value || '').replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Productos más pedidos del día (o de todo lo cargado si hoy no hay nada). Solo los que siguen a la venta.
export function topProducts(orders = [], { now = new Date(), limit = 8, products = null } = {}) {
  const valid = orders.filter(o => String(o.estado || '').toUpperCase() !== 'CANCELADO');
  const today = localDay(now);
  const todays = valid.filter(o => localDay(o.created_at) === today);
  const source = todays.length ? todays : valid;
  const tally = new Map();
  for (const order of source) {
    for (const item of order.items || []) {
      const id = Number(item.producto_id);
      if (!id) continue;
      const prev = tally.get(id) || { producto_id: id, nombre: item.nombre, cantidad: 0 };
      prev.cantidad += Number(item.cantidad || 0);
      tally.set(id, prev);
    }
  }
  let list = [...tally.values()].filter(x => x.cantidad > 0);
  if (products) {
    const byId = new Map(products.map(p => [Number(p.id), p]));
    list = list.filter(x => byId.has(x.producto_id) && Number(byId.get(x.producto_id).disponible ?? 1) === 1)
      .map(x => ({ ...x, product: byId.get(x.producto_id) }));
  }
  return list.sort((a, b) => b.cantidad - a.cantidad || String(a.nombre).localeCompare(String(b.nombre), 'es')).slice(0, limit);
}

// Productos de la última ronda no cancelada de un pedido (para «Repetir ronda»).
export function lastRoundItems(order) {
  const rounds = (order?.rondas || []).filter(r => String(r.estado || '').toUpperCase() !== 'CANCELADO' && (r.items || []).length);
  if (!rounds.length) return [];
  const last = rounds.reduce((a, b) => (String(b.created_at || '') > String(a.created_at || '') || (b.created_at === a.created_at && Number(b.id) > Number(a.id)) ? b : a));
  return last.items.filter(i => Number(i.cantidad) > 0).map(i => ({
    producto_id: Number(i.producto_id), nombre: i.nombre, cantidad: Number(i.cantidad),
    notas: i.notas || '', modificadores: (i.modificadores || []).map(toModifier),
  }));
}

// Precio unitario con extras.
export const unitPrice = (product, modifiers = []) => Number(product?.precio || 0) + modifiers.reduce((s, m) => s + Number(m.precio_extra || 0), 0);
