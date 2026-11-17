export const REPORT_PERIODS = [
  { days: 1, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const dayKey = value => {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export function completeTimeline(rows = [], days = 7, now = new Date()) {
  const values = new Map(rows.map(row => [dayKey(row.fecha), row]));
  const output = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const row = values.get(key);
    output.push({ fecha: key, ventas: Number(row?.ventas || 0), pedidos: Number(row?.pedidos || 0) });
  }
  return output;
}

export function bestHour(rows = []) {
  if (!rows.length) return null;
  return rows.reduce((best, row) => Number(row.total || 0) > Number(best.total || 0) ? row : best, rows[0]);
}

export function percentage(value, total) {
  const denominator = Number(total || 0);
  return denominator > 0 ? Math.max(0, Math.min(100, Number(value || 0) / denominator * 100)) : 0;
}

export function shortDate(value, days = 7) {
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return days === 1
    ? date.toLocaleDateString('es-EC', { weekday: 'short' })
    : date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }).replace('.', '');
}

// ── Rango propio, días de la semana y exportación ───────────────────────────
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const utc = day => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const iso = ms => new Date(ms).toISOString().slice(0, 10);
export const validDay = day => DAY.test(String(day || '')) && iso(utc(day)) === day;
export const todayISO = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** Atajos de rango: este mes y el mes pasado. */
export function monthRange(today, offset = 0) {
  const [y, m] = today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1)), last = new Date(Date.UTC(y, m + offset, 0));
  const to = iso(last.getTime());
  return { desde: iso(first.getTime()), hasta: to > today ? today : to };
}

/** Mensaje de error del rango, o null si se puede consultar. */
export function rangeError(desde, hasta, today) {
  if (!validDay(desde) || !validDay(hasta)) return 'Escribe las dos fechas como AAAA-MM-DD.';
  if (hasta < desde) return 'La fecha final no puede ser anterior a la inicial.';
  if (hasta > today) return 'El rango no puede terminar después de hoy.';
  if ((utc(hasta) - utc(desde)) / 86400000 + 1 > 366) return 'El rango no puede pasar de un año.';
  return null;
}

/** Un punto por cada día entre from y to, con cero donde no hubo ventas. */
export function rangeTimeline(rows = [], from, to) {
  if (!validDay(from) || !validDay(to) || to < from) return [];
  const values = new Map(rows.map(row => [String(row.fecha).slice(0, 10), row]));
  const out = [];
  for (let t = utc(from); t <= utc(to); t += 86400000) {
    const key = iso(t), row = values.get(key);
    out.push({ fecha: key, ventas: Number(row?.ventas || 0), pedidos: Number(row?.pedidos || 0) });
  }
  return out;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/** Ventas por día de la semana (lunes primero), con el promedio por día trabajado. */
export function weekdayTotals(timeline = []) {
  const out = WEEKDAYS.map(nombre => ({ nombre, total: 0, pedidos: 0, dias: 0, promedio: 0 }));
  for (const d of timeline) {
    if (!validDay(d.fecha)) continue;
    const slot = out[(new Date(utc(d.fecha)).getUTCDay() + 6) % 7];
    slot.total += Number(d.ventas || 0); slot.pedidos += Number(d.pedidos || 0); slot.dias += 1;
  }
  for (const slot of out) { slot.total = Math.round(slot.total * 100) / 100; slot.promedio = slot.dias ? Math.round(slot.total / slot.dias * 100) / 100 : 0; }
  return out;
}

const cell = value => { const text = String(value ?? ''); return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const num = value => Number(value || 0).toFixed(2).replace('.', ',');
/** Reporte en CSV para abrir en Excel (punto y coma, decimales con coma). */
export function reportCsv(report = {}) {
  const s = report.summary || {}, lines = [];
  const add = (...cols) => lines.push(cols.map(cell).join(';'));
  add('Reporte de ventas', `${report.period?.from || ''} a ${report.period?.to || ''}`);
  add();
  add('Resumen'); add('Ventas netas', num(s.net_sales)); add('Cuentas cobradas', s.paid_orders || 0); add('Ticket promedio', num(s.average_ticket));
  add('Propinas', num(s.tips)); add('Descuentos', num(s.discounts)); add('Cortesías', num(s.comps)); add('Cuentas canceladas', s.cancelled_orders || 0);
  add(); add('Ventas por día'); add('Fecha', 'Ventas', 'Cuentas');
  for (const d of report.timeline || []) add(d.fecha, num(d.ventas), d.pedidos || 0);
  add(); add('Ventas por hora'); add('Hora', 'Ventas', 'Cuentas');
  for (const h of report.hours || []) add(`${String(h.hora).padStart(2, '0')}:00`, num(h.total), h.pedidos || 0);
  add(); add('Meseros'); add('Mesero', 'Cuentas', 'Ventas', 'Ticket promedio', 'Propinas');
  for (const w of report.waiters || []) add(w.nombre, w.cuentas || 0, num(w.total), num(w.ticket), num(w.propinas));
  add(); add('Productos'); add('Producto', 'Categoría', 'Unidades', 'Ventas');
  for (const p of report.products || []) add(p.nombre, p.categoria || '', p.unidades || 0, num(p.total));
  add(); add('Formas de pago'); add('Método', 'Ventas', 'Pagos');
  for (const m of report.methods || []) add(m.nombre, num(m.total), m.transacciones || 0);
  return '\uFEFF' + lines.join('\r\n');
}
