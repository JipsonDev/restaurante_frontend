export function receiptTotals(order, percent = 0) {
  const rate = Math.max(0, Number(String(percent ?? 0).replace(',', '.')) || 0) / 100;
  const totalCents = Math.round(Number(order.total || 0) * 100);
  const itemsCents = (order.items || []).reduce((sum, item) => sum + Math.round((Number(item.precio || 0) +
    (item.modificadores || []).reduce((extra, mod) => extra + Number(mod.precio_extra || 0), 0)) * 100) * Number(item.cantidad || 0), 0);
  // Descuentos y cortesías bajan la parte de productos; el servicio es lo que queda.
  const productCents = Math.max(0, itemsCents - Math.round(Number(order.ajustes_base || 0) * 100));
  const serviceCents = Math.max(0, totalCents - productCents);
  const subtotalCents = Math.round((totalCents - serviceCents) / (1 + rate));
  return { subtotal: subtotalCents / 100, tax: (totalCents - serviceCents - subtotalCents) / 100,
    service: serviceCents / 100, total: totalCents / 100, taxPercent: rate * 100 };
}
