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
