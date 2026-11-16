const clean = value => String(value ?? '').trim();
export const normalizeAuditText = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const AUDIT_FILTERS = [
  { key: 'TODOS', label: 'Toda la actividad' },
  { key: 'VENTAS', label: 'Ventas y cobros' },
  { key: 'PEDIDOS', label: 'Pedidos' },
  { key: 'CAJA', label: 'Caja' },
  { key: 'CATALOGO', label: 'Catálogo' },
  { key: 'ADMIN', label: 'Administración' },
  { key: 'REVERSOS', label: 'Anulaciones' },
];

const ACTION_LABELS = {
  'caja.abierta': 'Caja abierta',
  'caja.cerrada': 'Caja cerrada',
  'caja.cobro_registrado': 'Venta cobrada',
  'caja.movimiento_registrado': 'Movimiento de caja',
  'caja.pago_anulado': 'Pago anulado',
  'caja.pago_devuelto': 'Pago devuelto',
  'caja.cierre_editado': 'Cierre corregido',
  'caja.cierre_reabierto': 'Caja reabierta',
  'pedido.creado': 'Pedido creado',
  'pedido.ronda_agregada': 'Nueva ronda enviada',
  'pedido.estado_actualizado': 'Estado del pedido actualizado',
  'pedido.precuenta_impresa': 'Precuenta impresa',
  'pedido.cobro_solicitado': 'Cobro solicitado',
  'pedido.eliminado': 'Pedido eliminado',
  'ronda.estado_actualizado': 'Preparación actualizada',
  'cuenta.transferida': 'Cuenta transferida',
  'cuenta.dividida': 'Cuenta dividida',
  'producto.creado': 'Producto creado',
  'producto.actualizado': 'Producto actualizado',
  'producto.precio_cambiado': 'Precio actualizado',
  'producto.eliminado': 'Producto eliminado',
  'configuracion.actualizada': 'Ajustes actualizados',
  'configuracion.logo_actualizado': 'Logo actualizado',
  'mesa.creada': 'Mesa creada',
  'mesa.actualizada': 'Mesa actualizada',
  'mesa.eliminada': 'Mesa eliminada',
};

export function auditActionLabel(action) {
  const value = clean(action);
  if (ACTION_LABELS[value]) return ACTION_LABELS[value];
  return value.split(/[._]/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Acción registrada';
}

export function auditGroup(row = {}) {
  const action = clean(row.accion).toLowerCase();
  const entity = clean(row.entidad).toLowerCase();
  if (action.includes('anulado') || action.includes('devuelto') || action.includes('eliminado')) return 'REVERSOS';
  if (action === 'caja.cobro_registrado') return 'VENTAS';
  if (action.startsWith('pedido.') || action.startsWith('ronda.') || action.startsWith('cuenta.') || ['pedido', 'ronda'].includes(entity)) return 'PEDIDOS';
  if (action.startsWith('caja.') || entity.startsWith('caja') || entity === 'pago') return 'CAJA';
  if (action.startsWith('producto.') || action.startsWith('inventario.') || action.startsWith('extra.') || ['producto', 'inventario', 'extra'].includes(entity)) return 'CATALOGO';
  return 'ADMIN';
}

export function auditCustomer(row = {}) {
  const metadata = row.metadata || {};
  const name = clean(row.cliente_nombre || metadata.factura_cliente || metadata.cliente_nombre);
  return name || (auditGroup(row) === 'VENTAS' ? 'Consumidor final' : '');
}

export function auditSearchText(row = {}) {
  const metadata = row.metadata || {};
  return normalizeAuditText([
    row.trabajador_nombre, row.rol, row.mesero_nombre, row.cajero_nombre,
    auditCustomer(row), row.cliente_documento, row.accion, auditActionLabel(row.accion),
    row.descripcion, row.entidad, row.entidad_id, row.pedido_id, row.mesa_numero,
    row.canal, row.comprobante_numero, row.factura_cliente, row.factura_documento, metadata.motivo, metadata.observacion,
    metadata.metodo, metadata.monto, metadata.referencia,
  ].join(' '));
}

export function filterAuditRows(rows = [], { group = 'TODOS', query = '', range = '30D', now = new Date() } = {}) {
  const needle = normalizeAuditText(query);
  const days = range === 'HOY' ? 1 : range === '7D' ? 7 : range === '30D' ? 30 : null;
  const start = days ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime() : null;
  return rows.filter(row => {
    if (group !== 'TODOS' && auditGroup(row) !== group) return false;
    if (start && new Date(row.created_at || 0).getTime() < start) return false;
    return !needle || auditSearchText(row).includes(needle);
  });
}

export function auditStats(rows = []) {
  const sales = rows.filter(row => auditGroup(row) === 'VENTAS');
  return {
    events: rows.length,
    sales: sales.reduce((sum, row) => sum + Number(row.metadata?.monto || 0), 0),
    users: new Set(rows.map(row => row.trabajador_id || row.trabajador_nombre).filter(Boolean)).size,
    reversals: rows.filter(row => auditGroup(row) === 'REVERSOS').length,
  };
}
