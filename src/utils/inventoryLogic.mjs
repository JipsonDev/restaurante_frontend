import { adminNumber } from './adminNumbers.mjs';

export function inventoryStock(item) {
  const physical = Number(item.stock || 0);
  const reserved = Number(item.stock_reservado || 0);
  const available = Math.max(0, Math.round((physical - reserved) * 1000) / 1000);
  const minimum = Number(item.stock_minimo || 0);
  return { physical, reserved, available, minimum, shortage: Math.max(0, Math.round((reserved - physical) * 1000) / 1000),
    status: available <= 0 ? 'empty' : available <= minimum ? 'low' : 'ok' };
}

export function inventoryPayload(form, editing = false) {
  if (!form.nombre.trim()) throw new Error('Escribe el nombre del insumo.');
  if (!form.unidad.trim()) throw new Error('Indica la unidad de medida.');
  const payload = {
    nombre: form.nombre.trim(), categoria: form.categoria.trim() || null,
    proveedor: form.proveedor.trim() || null, unidad: form.unidad.trim(),
    stock_minimo: adminNumber(form.stock_minimo, 'Stock mínimo', 3),
    costo_unitario: adminNumber(form.costo_unitario, 'Costo unitario'),
  };
  // Metadata edits must never replay an old stock value over kitchen movements.
  if (!editing) payload.stock = adminNumber(form.stock, 'Stock inicial', 3);
  return payload;
}

export function inventoryMovement(item, form) {
  if (!['Entrada', 'Salida', 'Ajuste'].includes(form.tipo)) throw new Error('Selecciona un tipo de movimiento.');
  const amount = adminNumber(form.cantidad, 'Cantidad', 3);
  if (form.tipo !== 'Ajuste' && amount === 0) throw new Error('La entrada o salida debe ser mayor que cero.');
  const { physical, reserved } = inventoryStock(item);
  const next = Math.round((form.tipo === 'Entrada' ? physical + amount : form.tipo === 'Salida' ? physical - amount : amount) * 1000) / 1000;
  if (next < 0 || (next < reserved && next < physical)) throw new Error('La cantidad afecta stock reservado para pedidos. Revisa el disponible antes de retirar.');
  return { next, available: Math.max(0, Math.round((next - reserved) * 1000) / 1000), payload: { tipo: form.tipo, cantidad: amount, motivo: form.motivo.trim() || null } };
}
