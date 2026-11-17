import { adminNumber } from './adminNumbers.mjs';

export const normalizeCatalogText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const productStock = product => Math.max(0, Math.floor(Number(product.stock_disponible ?? (product.inventario_item_id ? product.inventario_stock : Number(product.stock || 0) - Number(product.stock_reservado || 0))) || 0));
export const productStatus = product => Number(product.disponible) !== 1 || product.categoria_activa != null && Number(product.categoria_activa) === 0 ? 'hidden' : productStock(product) <= 0 || Number(product.agotado) === 1 ? 'empty' : 'available';
export const stockMode = product => Number(product.receta_count) > 0 ? 'recipe' : product.inventario_item_id ? 'linked' : 'own';

export function productPayload(form, categories, inventory) {
  const nombre = form.nombre.trim();
  if (!nombre) throw new Error('Escribe el nombre del producto.');
  const category = categories.find(item => Number(item.id) === Number(form.categoria_id));
  if (!category) throw new Error('Selecciona una categoría existente.');
  if (Number(category.activo) === 0 && (form.disponible || Number(form.originalCategory) !== Number(category.id))) throw new Error('Selecciona una categoría activa antes de publicar o mover el producto.');
  const precio = adminNumber(form.precio, 'Precio');
  let stock, linked = null, receta = [];
  const resource = id => {
    const item = inventory.find(item => Number(item.id) === Number(id));
    if (!item || Number(item.activo) === 0) throw new Error('Selecciona insumos activos y existentes.');
    return item;
  };
  if (form.mode === 'own') {
    stock = adminNumber(form.stock, 'Existencias físicas', 0);
    if (stock < Number(form.reserved || 0) && stock < Number(form.originalStock || 0)) throw new Error('Las existencias no pueden quedar por debajo de las unidades reservadas.');
  } else if (form.mode === 'linked') {
    linked = Number(resource(form.inventario_item_id).id);
  } else if (form.mode === 'recipe') {
    if (!form.receta.length) throw new Error('Agrega al menos un insumo a la receta.');
    const seen = new Set();
    receta = form.receta.map(line => {
      const item = resource(line.inventario_item_id);
      if (seen.has(Number(item.id))) throw new Error('No repitas un insumo en la receta.');
      seen.add(Number(item.id));
      const cantidad = adminNumber(line.cantidad, `Cantidad de ${item.nombre}`, 3);
      if (cantidad <= 0) throw new Error('Cada cantidad de receta debe ser mayor que cero.');
      return { inventario_item_id: Number(item.id), cantidad, unidad: item.unidad || null };
    });
  } else throw new Error('Selecciona cómo se controlan las existencias.');
  return {
    nombre, descripcion: form.descripcion.trim() || null, estacion: String(form.estacion || '').trim() || null, precio,
    categoria_id: Number(category.id), disponible: form.disponible ? 1 : 0,
    inventario_item_id: linked, receta,
    ...(!form.id ? { stock: stock ?? 0 } : stock !== undefined && (stock !== form.originalStock || form.mode !== form.originalMode) ? { stock } : {}),
    imagen_url: form.imagen_url || null,
  };
}

export function recipeEstimate(form, inventory) {
  const lines = form.mode === 'recipe' ? form.receta : form.mode === 'linked' && form.inventario_item_id ? [{ inventario_item_id: form.inventario_item_id, cantidad: 1 }] : [];
  if (!lines.length) return null;
  let cost = 0, portions = Infinity, completeCost = true;
  for (const line of lines) {
    const item = inventory.find(item => Number(item.id) === Number(line.inventario_item_id));
    const amount = Number(String(line.cantidad).replace(',', '.'));
    if (!item || !Number.isFinite(amount) || amount <= 0) return null;
    const free = Math.max(0, Number(item.stock || 0) - Number(item.stock_reservado || 0));
    portions = Math.min(portions, Math.floor((free + 1e-9) / amount));
    if (item.costo_unitario == null || Number(item.costo_unitario) <= 0) completeCost = false;
    cost += amount * Number(item.costo_unitario || 0);
  }
  return { portions, cost, completeCost };
}
