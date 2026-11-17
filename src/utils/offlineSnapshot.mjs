// Copia local de lo último que el mesero vio (mesas, menú, cuentas) para abrir la app y seguir
// tomando pedidos aunque no haya internet. Lógica pura: sin React ni almacenamiento.
export const SNAPSHOT_VERSION = 1;
const MAX_AGE_MS = 18 * 60 * 60 * 1000; // una copia de ayer ya no sirve para trabajar

export function packSnapshot({ mesas, productos, pedidos, extras, config }, at = Date.now()) {
  if (![mesas, productos, pedidos].every(Array.isArray)) throw new Error('Datos incompletos: no se guarda la copia local.');
  return JSON.stringify({ v: SNAPSHOT_VERSION, at, mesas, productos, pedidos, extras: Array.isArray(extras) ? extras : [], config: config || null });
}

/** Devuelve la copia si es válida y reciente; si no, null (nunca lanza). */
export function parseSnapshot(raw, now = Date.now()) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.v !== SNAPSHOT_VERSION || !Number.isFinite(data.at)) return null;
    if (![data.mesas, data.productos, data.pedidos, data.extras].every(Array.isArray) || !data.mesas.length) return null;
    if (now - data.at > MAX_AGE_MS || data.at > now + 60000) return null;
    return { at: data.at, mesas: data.mesas, productos: data.productos, pedidos: data.pedidos, extras: data.extras, config: data.config || null };
  } catch { return null; }
}

/** «hace un momento», «hace 5 min», «hace 2 h». */
export function snapshotAge(at, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

/** Mesas con una ronda guardada que todavía no llega al servidor: { [mesa_id]: cantidad }. */
export function queuedByTable(pending = {}) {
  const out = {};
  for (const request of Object.values(pending || {})) {
    if (!request || request.mesa_id == null) continue;
    out[request.mesa_id] = (out[request.mesa_id] || 0) + 1;
  }
  return out;
}
