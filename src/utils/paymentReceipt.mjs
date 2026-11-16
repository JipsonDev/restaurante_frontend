export function savedPaymentText(snapshot, payment = {}) {
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const order = snapshot.pedido || {};
  const business = snapshot.negocio || {};
  const line = '-'.repeat(42);
  const partial = Number(snapshot.saldo_pendiente) > 0 || Number(snapshot.abonado_anterior) > 0;
  return [
    business.nombre_restaurante || 'Morena Mia', business.razon_social, business.ruc ? `RUC: ${business.ruc}` : '', business.direccion,
    line, partial ? 'COMPROBANTE DE ABONO' : 'COMPROBANTE DE VENTA',
    snapshot.comprobante_numero || `Pago #${payment.id || '-'}`,
    `Fecha: ${new Date(snapshot.created_at).toLocaleString('es-EC')}`,
    payment.estado && payment.estado !== 'ACTIVO' ? `ESTADO: ${payment.estado}` : '',
    payment.motivo_anulacion ? `Motivo: ${payment.motivo_anulacion}` : '',
    `Pedido #${order.id || payment.pedido_id || '-'}`,
    order.mesa_id ? `Mesa ${order.mesa_numero || order.mesa_id}` : `${order.tipo || 'Para llevar'}: ${order.cliente_nombre || ''}`,
    `Cliente: ${snapshot.cliente?.nombre || 'Consumidor Final'}`,
    snapshot.cliente?.documento ? `Documento: ${snapshot.cliente.documento}` : '',
    snapshot.cliente?.correo ? `Correo: ${snapshot.cliente.correo}` : '',
    snapshot.division ? `Parte: ${snapshot.division.nombre}` : '',
    snapshot.cajero?.nombre ? `Cajero: ${snapshot.cajero.nombre}` : '', line,
    snapshot.reconstruido ? 'DOCUMENTO ANTIGUO: detalle reconstruido.\nNo se conservo una copia original.' : '',
    ...(order.items || []).flatMap((item) => [
      `${item.cantidad} x ${item.nombre}: ${money((Number(item.precio) + (item.modificadores || []).reduce((sum,m)=>sum+Number(m.precio_extra || 0),0)) * Number(item.cantidad))}`,
      item.notas ? `  Nota: ${item.notas}` : '',
    ]), line,
    snapshot.version > 0 ? `Subtotal de cuenta: ${money(snapshot.totales?.subtotal)}` : '',
    snapshot.version > 0 ? `IVA incluido: ${money(snapshot.totales?.tax)}` : '',
    snapshot.version > 0 ? `Servicio: ${money(snapshot.totales?.service)}` : '',
    snapshot.version > 0 ? `TOTAL DE CUENTA: ${money(snapshot.totales?.total)}` : '',
    Number(snapshot.abonado_anterior) > 0 ? `Abonos anteriores: ${money(snapshot.abonado_anterior)}` : '',
    `COBRADO EN ESTE COMPROBANTE: ${money(snapshot.monto)}`,
    snapshot.saldo_pendiente != null ? `Saldo al emitir: ${money(snapshot.saldo_pendiente)}` : '', line,
    ...(snapshot.desglose || []).map((part)=>`${part.metodo}: ${money(part.monto)}${part.referencia ? ` / ${part.referencia}` : ''}`),
    Number(snapshot.efectivo_recibido) > 0 ? `Efectivo recibido: ${money(snapshot.efectivo_recibido)}` : '',
    Number(snapshot.efectivo_recibido) > 0 ? `Cambio: ${money(snapshot.cambio)}` : '', line,
    'Comprobante interno', business.texto_ticket || 'Gracias por su compra',
  ].filter(Boolean).join('\n');
}
