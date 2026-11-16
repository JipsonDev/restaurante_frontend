const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const historyDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function validHistoryDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && historyDay(parsed) === value;
}
export function expressStage(order) {
  const paid = order.estado_cobro === 'PAGADO' || order.estado === 'PAGADO';
  const kitchen = String(order.estado_cocina || order.estado || 'PENDIENTE').toUpperCase();
  const ready = kitchen === 'LISTO' || (order.rondas || []).some(round => round.estado === 'LISTO');
  const preparing = ['PENDIENTE', 'PREPARANDO'].includes(kitchen) || (order.rondas || []).some(round => ['PENDIENTE', 'PREPARANDO'].includes(round.estado));
  const delivered = kitchen === 'ENTREGADO' && !order.pendiente_entrega;
  const balance = paid ? 0 : Math.max(0, Number(order.saldo_pendiente ?? (Number(order.total || 0) - Number(order.abonado || 0))));
  return { paid, ready, preparing, delivered, balance, canDeliver: paid && ready, group: !paid ? 'payment' : ready ? 'ready' : 'preparing', issue: delivered && !paid,
    kitchenLabel: ready && ['PENDIENTE', 'PREPARANDO'].includes(kitchen) ? 'Parte lista' : ({ PENDIENTE: 'Por preparar', PREPARANDO: 'En preparación', LISTO: 'Listo', ENTREGADO: 'Entregado' })[kitchen] || 'En cocina' };
}
export function filterExpressOrders(orders, { query = '', channel = 'Todos', stage = 'all' } = {}) {
  const q = normalize(query);
  return orders.filter(order => (channel === 'Todos' || (channel === 'Delivery' ? order.tipo === 'Delivery' : order.tipo !== 'Delivery'))
    && (stage === 'all' || (stage === 'preparing' ? expressStage(order).preparing : expressStage(order).group === stage))
    && (!q || normalize(`${order.id} ${order.cliente_nombre} ${order.cliente_dato || ''} ${order.delivery_telefono || ''} ${order.delivery_direccion || ''} ${order.delivery_referencia || ''}`).includes(q)));
}
