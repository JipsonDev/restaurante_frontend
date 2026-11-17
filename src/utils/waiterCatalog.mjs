const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function isMenuPromotion(product) {
  return /\bpromo(?:cion(?:es)?|s)?\b/.test(normalize(`${product.nombre || ''} ${product.categoria_nombre || product.categoria || ''}`));
}
export const menuStock = product => {
  const stock = Number(product.stock_disponible ?? product.inventario_stock ?? product.stock ?? 9999);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
};
// Búsqueda del menú: por número (código = id del producto; «12», «#12», «n 12») o por palabras en
// cualquier orden y sin tildes («batido mora» encuentra «Batido de mora»). Pensada también para voz.
export function menuQueryCode(query) {
  const m = String(query || '').trim().match(/^(?:#|n(?:o|ro|um(?:ero)?)?\.?\s*|número\s*)?(\d{1,6})$/i);
  return m ? Number(m[1]) : null;
}
export function matchesMenuQuery(product, query) {
  const q = normalize(query);
  if (!q) return true;
  const code = menuQueryCode(query);
  if (code != null) return Number(product.id) === code;
  const text = normalize(`${product.nombre} ${product.descripcion || ''} ${product.categoria_nombre || product.categoria || ''}`);
  return q.split(/\s+/).filter(w => w.length > 1 && !['de', 'la', 'el', 'con', 'y', 'un', 'una', 'los', 'las'].includes(w)).every(w => text.includes(w)) || text.includes(q);
}

export function filterMenuProducts(products, { query = '', category = 'Todas', availableOnly = false, sort = 'name' } = {}) {
  return products.filter(product => (category === 'Todas' || normalize(product.categoria_nombre || product.categoria || 'General') === normalize(category))
    && matchesMenuQuery(product, query)
    && Number(product.disponible ?? 1) === 1 && (!availableOnly || menuStock(product) > 0) && !isMenuPromotion(product))
    .sort((a, b) => (sort === 'price' ? Number(a.precio) - Number(b.precio) : 0) || String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base', numeric: true }));
}
