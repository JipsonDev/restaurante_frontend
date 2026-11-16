const stockFor = product => {
  const value = Number(product?.stock_disponible ?? product?.inventario_stock ?? product?.stock ?? 9999);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
const quantityFor = (items, id) => items.filter(i => Number(i.producto_id) === Number(id)).reduce((s, i) => s + Number(i.cantidad || 0), 0);

export function addDraftProduct(items, product, promo = false, localId = `${product.id}-${Date.now()}`) {
  const stock = stockFor(product);
  if (items.filter(i => Number(i.producto_id) === Number(product.id)).reduce((s, i) => s + Number(i.cantidad || 0), 0) + 1 > stock) return { items, error: 'stock' };
  const defaultNotes = promo ? product.descripcion || 'Promocion' : '';
  const defaultModifiers = promo ? [{ nombre: 'Promocion admin', tipo: 'NOTA', precio_extra: 0 }] : [];
  // Only merge the untouched baseline. Customized variants belong to distinct guests.
  const index = items.findIndex(i => Number(i.producto_id) === Number(product.id)
    && Boolean(i.promo) === Boolean(promo)
    && (i.notas || '') === defaultNotes
    && JSON.stringify(i.modificadores || []) === JSON.stringify(defaultModifiers)
    && Number(i.precio ?? product.precio) === Number(product.precio));
  if (index >= 0) return { items: items.map((i, n) => n === index ? { ...i, cantidad: Number(i.cantidad) + 1, stock } : i) };
  return { items: [...items, { localId, producto_id: product.id, nombre: product.nombre, precio: Number(product.precio || 0), cantidad: 1, notas: promo ? product.descripcion || 'Promocion' : '', modificadores: promo ? [{ nombre: 'Promocion admin', tipo: 'NOTA', precio_extra: 0 }] : [], imagen_url: product.imagen_url, categoria_nombre: product.categoria_nombre || product.categoria, stock, promo }] };
}

export function changeDraftQuantity(items, item, delta, product) {
  const index = items.findIndex(i => (i.localId || i.id) === (item.localId || item.id));
  if (index < 0) return { items };
  const quantity = Math.max(0, Number(items[index].cantidad) + delta);
  const total = quantityFor(items, items[index].producto_id) - Number(items[index].cantidad) + quantity;
  if (delta > 0 && (!product || Number(product.disponible ?? 1) !== 1 || total > stockFor(product))) return { items, error: 'stock' };
  return { items: items.map((i, n) => n === index ? { ...i, cantidad: quantity } : i).filter(i => i.cantidad > 0) };
}
