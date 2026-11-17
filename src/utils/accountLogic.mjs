const unpaid = (order) => !['PAGADO', 'CANCELADO'].includes(order.estado);

export function operationalOrder(order) {
  return order.estado !== 'CANCELADO' && (unpaid(order) || order.pendiente_entrega === true);
}

export function accountRounds(order) {
  return (order?.originalOrders || (order ? [order] : [])).flatMap((account) =>
    (account.rondas || []).map((round) => ({ ...round, pedido_id: account.id, estado_cobro: account.estado_cobro })));
}

// Amounts and bill lines include only unpaid accounts; delivery includes paid rounds too.
export function combineAccounts(orders) {
  if (!orders?.length) return null;
  const open = orders.filter(unpaid).sort((a, b) => Number(a.id) - Number(b.id));
  const billed = open.length ? open : orders;
  const states = billed.map((order) => order.estado_cocina || order.estado);
  return { ...billed[0],
    total: billed.reduce((sum, order) => sum + Math.round(Number(order.total) * 100), 0) / 100,
    abonado: billed.reduce((sum, order) => sum + Math.round(Number(order.abonado || 0) * 100), 0) / 100,
    saldo_pendiente: open.reduce((sum, order) => sum + Math.round(Number(order.saldo_pendiente ?? Math.max(0, Number(order.total) - Number(order.abonado || 0))) * 100), 0) / 100,
    items: billed.flatMap((order) => order.items || []),
    ajustes: billed.flatMap((order) => order.ajustes || []),
    ajustes_base: billed.reduce((sum, order) => sum + Math.round(Number(order.ajustes_base || 0) * 100), 0) / 100,
    ajustes_total: billed.reduce((sum, order) => sum + Math.round(Number(order.ajustes_total || 0) * 100), 0) / 100,
    notas: billed.map((order) => order.notas).filter(Boolean).join(' | '),
    estado: open.length ? (['PENDIENTE', 'PREPARANDO', 'LISTO'].find((state) => states.includes(state)) || 'ENTREGADO') : 'PAGADO',
    estado_cobro: open.length ? (open.some((order) => Number(order.abonado) > 0) ? 'PARCIAL' : 'PENDIENTE') : 'PAGADO',
    cuenta_solicitada_at: billed.find((order) => order.cuenta_solicitada_at)?.cuenta_solicitada_at || null,
    originalOrders: orders,
  };
}

export function groupUnpaidAccounts(orders) {
  const groups = new Map();
  for (const order of orders.filter(unpaid)) {
    const key = order.mesa_id ? `mesa:${order.mesa_id}` : `pedido:${order.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(order);
  }
  return [...groups.values()].map(combineAccounts);
}

export function splitCents(total, weights) {
  const cents = Math.round(Number(total) * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const amounts = weights.map((weight) => Math.floor(cents * weight / sum));
  const rank = weights.map((weight, i) => ({ i, remainder: (cents * weight) % sum }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let rest = cents - amounts.reduce((a, b) => a + b, 0), i = 0; rest > 0; rest--, i++) amounts[rank[i].i]++;
  return amounts.map((amount) => amount / 100);
}
