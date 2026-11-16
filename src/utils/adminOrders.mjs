export const ORDER_LABELS = { PENDIENTE: 'Pendiente', PREPARANDO: 'En preparación', LISTO: 'Listo', ENTREGADO: 'Entregado', PAGADO: 'Pagado', CANCELADO: 'Cancelado', PARCIAL: 'Abono parcial' };
const pending = ['PENDIENTE', 'PREPARANDO', 'LISTO'];
export function orderChannel(order) { return order.tipo === 'Delivery' ? 'Delivery' : order.tipo === 'Para llevar' || !order.mesa_id ? 'Para llevar' : 'Mesa'; }
export function orderDestination(order) { return orderChannel(order) === 'Mesa' ? `Mesa ${order.mesa_numero || order.mesa_id}` : orderChannel(order); }
export function preparationState(order) {
  if (order.estado === 'CANCELADO') return 'CANCELADO';
  if (order.rondas?.length) return pending.find(state => order.rondas.some(r => r.estado === state)) || 'ENTREGADO';
  return order.estado_cocina || (order.estado === 'PAGADO' ? 'ENTREGADO' : order.estado);
}
export function paymentState(order) { return order.estado_cobro || (['PAGADO', 'CANCELADO'].includes(order.estado) ? order.estado : Number(order.abonado) > 0 ? 'PARCIAL' : 'PENDIENTE'); }
export function orderBalance(order) { return ['PAGADO','CANCELADO'].includes(order.estado) ? 0 : Math.max(0, Number(order.saldo_pendiente ?? (Number(order.total || 0) - Number(order.abonado || 0)))); }
export function ongoingOrder(order) { return order.estado !== 'CANCELADO' && (order.estado !== 'PAGADO' || pending.includes(preparationState(order))); }
export function nextRoundAction(order, round) {
  if (order.estado === 'CANCELADO') return null;
  const next = { PENDIENTE: 'PREPARANDO', PREPARANDO: 'LISTO', LISTO: 'ENTREGADO' }[round.estado];
  if (!next) return null;
  if (next === 'ENTREGADO' && orderChannel(order) !== 'Mesa' && paymentState(order) !== 'PAGADO') return null;
  return { next, label: { PREPARANDO: 'Preparar', LISTO: 'Marcar listo', ENTREGADO: 'Entregar' }[next] };
}
export function orderDate(value) {
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function isOrderToday(order, now = new Date()) { const date = orderDate(order.created_at); return !!date && date.toDateString() === now.toDateString(); }
export function orderMatches(order, { scope = 'active', channel = 'all', state = 'all', query = '' } = {}, now = new Date()) {
  if (scope === 'active' && !ongoingOrder(order)) return false;
  if (scope === 'today' && !isOrderToday(order, now)) return false;
  if (channel !== 'all' && orderChannel(order) !== channel) return false;
  if (state === 'unpaid') { if (orderBalance(order) <= 0) return false; }
  else if (state !== 'all') {
    const matches = pending.includes(state) && order.rondas?.length && order.estado !== 'CANCELADO'
      ? order.rondas.some(round => round.estado === state) : preparationState(order) === state;
    if (!matches) return false;
  }
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalize([`#${order.id}`, orderDestination(order), order.cliente_nombre, order.mesero_nombre, ...(order.items || []).map(i => i.nombre)].join(' ')).includes(normalize(query).trim());
}
