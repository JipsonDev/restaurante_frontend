export function readyOrders(pedido) {
  const orders = pedido?.originalOrders || (pedido ? [pedido] : []);
  return orders.filter((order) => String(order.estado_cocina || order.estado || '').toUpperCase() === 'LISTO'
    && (!['Para llevar', 'Delivery'].includes(order.tipo) || order.estado_cobro === 'PAGADO' || order.estado === 'PAGADO'));
}

// The ref closes the gap before React renders the disabled send button.
export async function runExclusive(lock, action) {
  if (lock.current) return;
  lock.current = true;
  try {
    return await action();
  } finally {
    lock.current = false;
  }
}
