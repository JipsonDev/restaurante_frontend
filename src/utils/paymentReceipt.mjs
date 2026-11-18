// Comprobante de un pago guardado (se reimprime igual que salió). Marca blanca: datos del negocio del propio snapshot.
import { build, businessHeader, dateTime, docTitle, footer, itemTable, money, t, toPlain } from './ticketLayout.mjs';

export function savedPaymentMarkup(snapshot, payment = {}) {
  const s = snapshot.negocio || {};
  const sym = s.simbolo_moneda || '$';
  const m = v => money(v, sym);
  const order = snapshot.pedido || {};
  const partial = Number(snapshot.saldo_pendiente) > 0 || Number(snapshot.abonado_anterior) > 0;
  const { fecha, hora } = dateTime(snapshot.created_at);
  const where = order.mesa_id ? ['Mesa', String(order.mesa_numero || order.mesa_id)] : [order.tipo || 'Para llevar', order.cliente_nombre || ''];
  const cash = Number(snapshot.efectivo_recibido) > 0;
  return build(
    businessHeader(s),
    docTitle(partial ? 'COMPROBANTE DE ABONO' : 'COMPROBANTE DE VENTA', snapshot.comprobante_numero || `Pago #${payment.id || '-'}`),
    payment.estado && payment.estado !== 'ACTIVO' ? t.centerBold(`ESTADO: ${payment.estado}`) : null,
    payment.motivo_anulacion ? t.center(`Motivo: ${payment.motivo_anulacion}`) : null,
    t.row('Fecha', `${fecha} ${hora}`),
    t.row('Pedido', `#${order.id || payment.pedido_id || '-'}`),
    t.row(where[0], where[1]),
    t.row('Cliente', snapshot.cliente?.nombre || 'Consumidor final'),
    snapshot.cliente?.documento ? t.row('Documento', snapshot.cliente.documento) : null,
    snapshot.cliente?.correo ? t.row('Correo', snapshot.cliente.correo) : null,
    snapshot.division ? t.row('Parte', snapshot.division.nombre) : null,
    snapshot.cajero?.nombre ? t.row('Atendió', snapshot.cajero.nombre) : null,
    snapshot.reconstruido ? [t.blank(), t.text('DOCUMENTO ANTIGUO: detalle reconstruido. No se conservó una copia original.')] : null,
    t.blank(),
    itemTable(order.items || [], sym),
    ...(order.ajustes || []).map(a => t.row(`${a.tipo === 'CORTESIA' ? 'Cortesía' : `Descuento${a.porcentaje ? ` ${Number(a.porcentaje)}%` : ''}`} (${a.motivo})`, `-${m(a.monto)}`)),
    snapshot.version > 0 ? [
      t.row('Subtotal', m(snapshot.totales?.subtotal)),
      t.row('IVA incluido', m(snapshot.totales?.tax)),
      Number(snapshot.totales?.service) ? t.row('Servicio', m(snapshot.totales?.service)) : null,
      t.row('Total de la cuenta', m(snapshot.totales?.total), 'B'),
    ] : null,
    Number(snapshot.abonado_anterior) > 0 ? t.row('Abonos anteriores', m(snapshot.abonado_anterior)) : null,
    t.row('COBRADO EN ESTE COMPROBANTE', m(snapshot.monto), 'H'),
    Number(snapshot.propina) > 0 ? [t.row(`Propina (${snapshot.propina_metodo || 'aparte'})`, m(snapshot.propina)), t.row('Total pagado', m(Number(snapshot.monto) + Number(snapshot.propina)), 'B')] : null,
    snapshot.saldo_pendiente != null ? t.row('Saldo al emitir', m(snapshot.saldo_pendiente)) : null,
    (snapshot.desglose || []).length || cash ? t.rule('-') : null,
    ...(snapshot.desglose || []).map(p => t.row(`${p.metodo}${p.referencia ? ` · ${p.referencia}` : ''}`, m(p.monto))),
    cash ? [t.row('Efectivo recibido', m(snapshot.efectivo_recibido)), t.row('Cambio', m(snapshot.cambio))] : null,
    footer(s),
  );
}

// Texto plano alineado (vista previa en pantalla y respaldo).
export function savedPaymentText(snapshot, payment = {}) {
  return toPlain(savedPaymentMarkup(snapshot, payment));
}
