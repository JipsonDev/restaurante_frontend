// Un solo mapa de estados para todo el panel: misma etiqueta y mismo tono en cada pantalla.
// Tonos: success = hecho/libre · info = en curso · warning = pendiente/requiere acción · critical = problema · neutral = cerrado.
export const ORDER_PREP = {
  PENDIENTE: ['Pendiente', 'warning', 'incomplete'],
  PREPARANDO: ['En preparación', 'warning', 'partial'],
  LISTO: ['Listo', 'info', 'complete'],
  ENTREGADO: ['Entregado', 'neutral', 'complete'],
  CANCELADO: ['Cancelado', 'neutral', null],
};
export const ORDER_PAY = {
  PENDIENTE: ['Pago pendiente', 'warning', 'incomplete'],
  PARCIAL: ['Abono parcial', 'warning', 'partial'],
  PAGADO: ['Pagado', 'neutral', 'complete'],
  CANCELADO: ['Anulado', 'neutral', null],
};
export const TABLE_STATE = {
  Libre: ['Disponible', 'success'],
  Ocupada: ['Ocupada', 'info'],
  Cuenta: ['Pidió la cuenta', 'warning'],
  Reservada: ['Reservada', 'purple'],
  inactive: ['Inactiva', 'neutral'],
};
