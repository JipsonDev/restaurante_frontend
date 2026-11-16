// Browsing is independent of the selected sale. Open Express orders accept
// additional rounds on the same account, subject to payment restrictions.
export function catalogContext({ express, savedExpressId, table, order }) {
  if (express && savedExpressId) {
    if (!order || ['PAGADO', 'CANCELADO'].includes(order.estado) || order.estado_cobro === 'PAGADO') return { editable: false, reason: 'closed-express', label: `Express #${savedExpressId} · cerrado o no disponible` };
    if (Number(order.abonado || 0) > 0) return { editable: false, reason: 'advance', label: `Express #${savedExpressId} · cuenta con abonos` };
    return { editable: true, reason: 'express-round', label: `Express #${savedExpressId} · nueva ronda` };
  }
  if (express) return { editable: true, reason: 'draft', label: 'Nuevo pedido para llevar / delivery' };
  if (!table || Number(table.activo ?? 1) !== 1) return { editable: false, reason: 'no-table', label: 'Catálogo · sin mesa seleccionada' };
  if (Number(order?.abonado || 0) > 0 && order?.estado_cobro !== 'PAGADO') return { editable: false, reason: 'advance', label: `Mesa ${table.numero} · cuenta con abonos` };
  return { editable: true, reason: 'table', label: `Mesa ${table.numero}` };
}
