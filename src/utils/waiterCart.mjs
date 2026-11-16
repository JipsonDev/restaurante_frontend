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

// Añade un producto con cantidad, extras y nota elegidos al momento. Si ya existe una línea idéntica
// (mismo producto, misma personalización y precio) se suma; si cambia algo, queda como línea aparte.
const sameModifiers = (a = [], b = []) => JSON.stringify([...a].map(m => m.nombre).sort()) === JSON.stringify([...b].map(m => m.nombre).sort());
export function addCustomizedProduct(items, product, { cantidad = 1, modificadores = [], notas = '' } = {}, localId = `${product.id}-${Date.now()}`) {
  const qty = Math.max(1, Math.floor(Number(cantidad) || 1));
  const stock = stockFor(product);
  if (Number(product.disponible ?? 1) !== 1 || quantityFor(items, product.id) + qty > stock) return { items, error: 'stock', available: Math.max(0, stock - quantityFor(items, product.id)) };
  const note = String(notas || '').trim();
  const mods = modificadores.map(m => ({ nombre: m.nombre, tipo: m.tipo || 'EXTRA', precio_extra: Number(m.precio_extra ?? m.precio ?? 0) }));
  const index = items.findIndex(i => Number(i.producto_id) === Number(product.id) && !i.promo
    && (i.notas || '') === note && sameModifiers(i.modificadores, mods) && Number(i.precio ?? product.precio) === Number(product.precio));
  if (index >= 0) return { items: items.map((i, n) => n === index ? { ...i, cantidad: Number(i.cantidad) + qty, stock } : i) };
  return { items: [...items, { localId, producto_id: product.id, nombre: product.nombre, precio: Number(product.precio || 0), cantidad: qty, notas: note, modificadores: mods,
    imagen_url: product.imagen_url, categoria_nombre: product.categoria_nombre || product.categoria, stock, promo: false }] };
}

// Añade varias líneas (p. ej. «Repetir ronda»). Las que no tienen stock o ya no están a la venta se saltan.
export function addLines(items, lines, products) {
  const byId = new Map(products.map(p => [Number(p.id), p]));
  let next = items; const skipped = [];
  lines.forEach((line, n) => {
    const product = byId.get(Number(line.producto_id));
    if (!product) { skipped.push(line.nombre); return; }
    const result = addCustomizedProduct(next, product, line, `rep-${product.id}-${Date.now()}-${n}`);
    if (result.error) skipped.push(product.nombre); else next = result.items;
  });
  return { items: next, skipped };
}
