const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export function isMenuPromotion(product) {
  return /\bpromo(?:cion(?:es)?|s)?\b/.test(normalize(`${product.nombre || ''} ${product.categoria_nombre || product.categoria || ''}`));
}
export const menuStock = product => {
  const stock = Number(product.stock_disponible ?? product.inventario_stock ?? product.stock ?? 9999);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
};
export function filterMenuProducts(products, { query = '', category = 'Todas', availableOnly = false, sort = 'name' } = {}) {
  return products.filter(product => (category === 'Todas' || normalize(product.categoria_nombre || product.categoria || 'General') === normalize(category))
    && (!normalize(query) || normalize(`${product.nombre} ${product.descripcion || ''} ${product.categoria_nombre || product.categoria || ''}`).includes(normalize(query)))
    && Number(product.disponible ?? 1) === 1 && (!availableOnly || menuStock(product) > 0) && !isMenuPromotion(product))
    .sort((a, b) => (sort === 'price' ? Number(a.precio) - Number(b.precio) : 0) || String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base', numeric: true }));
}
