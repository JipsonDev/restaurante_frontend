// Comanda: lógica pura de la cola de rondas sin conexión (sin React ni red).
const PRICE_RE = /precio|servicio|porcentaje/i;

/** Clasifica un error de axios/fetch al enviar una ronda.
 *  'offline'  → sin respuesta (red caída, timeout): se conserva y se reintenta.
 *  'changed'  → 409 por precio/servicio: hay que mostrar diferencias y reconfirmar.
 *  'rejected' → 4xx definitivo: el servidor no la aceptará tal cual.
 *  'retry'    → 5xx / conflicto de request en curso: reintentar más tarde. */
export function classifyError(error) {
  const status = error?.response?.status;
  if (!status) return 'offline';
  const data = error.response.data || {};
  const message = String(data.error || data.message || '');
  if (data.code === 'REQUEST_CONFLICT') return 'retry';
  if (status === 409 && PRICE_RE.test(message)) return 'changed';
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'rejected';
  return 'retry';
}

/** Espera antes del siguiente reintento: 2s, 4s, 8s … tope 60s, con jitter opcional (0–1). */
export function nextDelay(attempt = 0, jitter = 0) {
  const base = Math.min(60000, 2000 * 2 ** Math.max(0, Math.min(attempt, 10)));
  return Math.round(base * (1 + Math.max(0, Math.min(jitter, 1)) * 0.25));
}

const money = v => Math.round((Number(v) || 0) * 100) / 100;

/** Resume las rondas pendientes para la bandeja: [{key,label,items,total,since}] ordenadas por antigüedad. */
export function queueSummary(pending = {}, mesas = []) {
  return Object.entries(pending || {})
    .filter(([, request]) => request && Array.isArray(request.items))
    .map(([key, request]) => {
      const mesa = (mesas || []).find(m => String(m.id) === String(request.mesa_id));
      const items = request.items.reduce((n, it) => n + (Number(it.cantidad) || 0), 0);
      const label = mesa ? `Mesa ${mesa.numero ?? mesa.id}`
        : request.tipo && request.tipo !== 'MESA' ? (request.cliente_nombre ? `${request.tipo === 'DELIVERY' ? 'Delivery' : 'Para llevar'} · ${request.cliente_nombre}` : (request.tipo === 'DELIVERY' ? 'Delivery' : 'Para llevar'))
        : request.mesa_id ? `Mesa ${request.mesa_id}` : 'Pedido';
      return { key, label, items, total: money(request.total), since: request.prepared_at || request.created_at || null };
    })
    .sort((a, b) => String(a.since || '').localeCompare(String(b.since || '')));
}

/** Total de una ronda nueva (solo líneas del carrito, sin servicio). */
export function roundTotal(items = []) {
  return money((items || []).reduce((s, it) => {
    const extras = (it.modificadores || it.modifiers || []).reduce((e, m) => e + (Number(m.precio ?? m.price) || 0), 0);
    return s + (Number(it.precio) + extras) * (Number(it.cantidad) || 0);
  }, 0));
}

/** Diferencias de precio entre el carrito y el catálogo actual: [{name, before, after}]. */
export function priceDiffs(items = [], products = []) {
  const byId = new Map((products || []).map(p => [String(p.id), p]));
  return (items || []).flatMap(it => {
    const p = byId.get(String(it.producto_id ?? it.id));
    if (!p) return [{ name: it.nombre || 'Producto', before: money(it.precio), after: null }];
    const after = money(p.precio);
    return after !== money(it.precio) ? [{ name: it.nombre || p.nombre, before: money(it.precio), after }] : [];
  });
}

/** Borrador Express vacío reutilizable (sin productos, sin datos, sin envío pendiente) — evita acumular borradores fantasma. */
export function reusableExpressDraft(state = {}) {
  const entries = Object.entries(state.expressDrafts || {});
  const blank = ([key, d]) => !(state.carritos?.[key] || []).length && !state.pending?.[key] && !String(state.orderNotes?.[key] || '').trim()
    && !Object.values(d?.expressInfo || {}).some(v => String(v || '').trim());
  const found = entries.filter(blank).sort((a, b) => String(b[1]?.createdAt || '').localeCompare(String(a[1]?.createdAt || '')))[0];
  return found ? found[0] : null;
}
