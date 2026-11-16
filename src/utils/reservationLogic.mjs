// Lógica de reservas de mesas, compartida por el panel y el backend
// (el backend tiene una copia idéntica en services/reservationLogic.js).
// Las fechas viajan como texto local 'YYYY-MM-DD HH:MM' para no depender de la zona horaria del servidor.

export const RESERVATION_STATES = ['PENDIENTE', 'CONFIRMADA', 'LLEGO', 'NO_VINO', 'CANCELADA'];
// Estados que ocupan la mesa en su horario.
export const BLOCKING_STATES = ['PENDIENTE', 'CONFIRMADA', 'LLEGO'];
export const RESERVATION_LABELS = {
  PENDIENTE: 'Por confirmar', CONFIRMADA: 'Confirmada', LLEGO: 'Llegó', NO_VINO: 'No vino', CANCELADA: 'Cancelada',
};
export const DEFAULT_DURATION = 90;
export const LATE_AFTER_MIN = 15;

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/;
const pad = n => String(n).padStart(2, '0');

// Minutos desde una época fija; solo sirve para comparar y sumar, nunca para mostrar.
export function toMinutes(value) {
  const m = DATE_TIME.exec(String(value || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(ms);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null; // 31 de febrero, etc.
  return ms / 60000;
}

export function fromMinutes(minutes) {
  const d = new Date(minutes * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Fecha y hora local del equipo en el mismo formato que usan las reservas.
export function localStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export const dayOf = stamp => String(stamp || '').slice(0, 10);
export const timeOf = stamp => String(stamp || '').slice(11, 16);
export function addDays(day, n) { const t = toMinutes(`${day} 00:00`); return t == null ? day : dayOf(fromMinutes(t + n * 1440)); }

const positiveInt = (v, max) => ['string', 'number'].includes(typeof v) && String(v).trim() !== '' && Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= max;

export function reservationInputError(input = {}, { creating = false } = {}) {
  const has = key => creating || input[key] !== undefined;
  if (has('cliente_nombre')) {
    const name = String(input.cliente_nombre ?? '').trim();
    if (name.length < 2) return 'Escribe el nombre de quien reserva.';
    if (name.length > 120) return 'El nombre no puede pasar de 120 caracteres.';
  }
  if (input.telefono != null && String(input.telefono).trim() !== '') {
    const phone = String(input.telefono).trim();
    if (phone.length > 30 || !/^[+\d][\d\s-]{5,}$/.test(phone)) return 'El teléfono solo puede tener números, espacios, guiones y un + inicial.';
  }
  if (has('personas') && !positiveInt(input.personas, 50)) return 'Indica cuántas personas vienen (de 1 a 50).';
  if (has('fecha_hora') && toMinutes(input.fecha_hora) == null) return 'La fecha y hora de la reserva no son válidas.';
  if (input.duracion_min !== undefined && (!positiveInt(input.duracion_min, 480) || Number(input.duracion_min) < 15)) return 'La duración debe estar entre 15 y 480 minutos.';
  if (input.mesa_id != null && input.mesa_id !== '' && !positiveInt(input.mesa_id, 2147483647)) return 'La mesa seleccionada no es válida.';
  if (input.notas != null && String(input.notas).length > 300) return 'Las notas no pueden pasar de 300 caracteres.';
  if (input.estado !== undefined && !RESERVATION_STATES.includes(input.estado)) return 'El estado de la reserva no es válido.';
  return null;
}

export function reservationPayload(form = {}) {
  const phone = String(form.telefono ?? '').trim();
  const notes = String(form.notas ?? '').trim();
  const payload = {
    cliente_nombre: String(form.cliente_nombre ?? '').trim().replace(/\s+/g, ' '),
    telefono: phone || null,
    personas: Number(form.personas),
    fecha_hora: String(form.fecha_hora ?? '').trim().replace('T', ' ').slice(0, 16),
    duracion_min: Number(form.duracion_min || DEFAULT_DURATION),
    mesa_id: form.mesa_id == null || form.mesa_id === '' ? null : Number(form.mesa_id),
    notas: notes || null,
  };
  const error = reservationInputError(payload, { creating: true });
  if (error) throw new Error(error);
  return payload;
}

export function interval(r) {
  const start = toMinutes(r.fecha_hora);
  return start == null ? null : { start, end: start + Number(r.duracion_min || DEFAULT_DURATION) };
}

// La reserva activa que choca con `candidate` en la misma mesa, o null.
export function findConflict(candidate, reservations = []) {
  if (candidate.mesa_id == null) return null;
  const a = interval(candidate);
  if (!a) return null;
  return reservations.find(r => Number(r.id) !== Number(candidate.id)
    && r.mesa_id != null && Number(r.mesa_id) === Number(candidate.mesa_id)
    && BLOCKING_STATES.includes(r.estado || 'PENDIENTE')
    && (b => b && a.start < b.end && b.start < a.end)(interval(r))) || null;
}

export function capacityError(personas, table) {
  if (!table) return null;
  if (Number(table.activo) === 0) return `La mesa ${table.numero} está inactiva.`;
  if (Number(personas) > Number(table.capacidad)) return `La mesa ${table.numero} es para ${table.capacidad} personas y la reserva es de ${personas}.`;
  return null;
}

export function transitionError(current, next) {
  if (!RESERVATION_STATES.includes(next)) return 'El estado de la reserva no es válido.';
  if (current === next) return `La reserva ya está en «${RESERVATION_LABELS[next]}».`;
  return null;
}

// Mesas libres para ese horario, de la más ajustada a la más grande.
export function suggestTables(tables = [], reservations = [], candidate = {}) {
  const people = Number(candidate.personas || 1);
  return tables
    .filter(t => Number(t.activo ?? 1) === 1 && Number(t.capacidad) >= people)
    .filter(t => !findConflict({ ...candidate, mesa_id: t.id }, reservations))
    .sort((a, b) => Number(a.capacidad) - Number(b.capacidad) || Number(a.numero) - Number(b.numero));
}

// ¿Llegó la hora y no hay noticias? (pasaron LATE_AFTER_MIN sin marcar llegada)
export function isLate(r, now = localStamp()) {
  if (!['PENDIENTE', 'CONFIRMADA'].includes(r.estado)) return false;
  const start = toMinutes(r.fecha_hora), n = toMinutes(now);
  return start != null && n != null && n - start > LATE_AFTER_MIN;
}

// Minutos que faltan (negativo si ya pasó).
export function minutesUntil(r, now = localStamp()) {
  const start = toMinutes(r.fecha_hora), n = toMinutes(now);
  return start == null || n == null ? null : start - n;
}

// Próxima reserva activa de cada mesa para hoy (desde ahora menos la tolerancia).
export function nextByTable(reservations = [], now = localStamp()) {
  const n = toMinutes(now), today = dayOf(now), out = {};
  for (const r of reservations) {
    if (r.mesa_id == null || !['PENDIENTE', 'CONFIRMADA'].includes(r.estado) || dayOf(r.fecha_hora) !== today) continue;
    const start = toMinutes(r.fecha_hora);
    if (start == null || start < n - LATE_AFTER_MIN * 4) continue;
    const prev = out[r.mesa_id];
    if (!prev || start < toMinutes(prev.fecha_hora)) out[r.mesa_id] = r;
  }
  return out;
}
