export const emptyExpressInfo = () => ({ nombre: '', dato: '', telefono: '', direccion: '', referencia: '' });
export const isExpressDraftKey = key => typeof key === 'string' && /^express-draft:[a-zA-Z0-9_-]+$/.test(key);
export const emptyDrafts = () => ({ version: 2, carritos: {}, orderNotes: {}, pending: {}, expressDrafts: {} });
const isMap = value => value && typeof value === 'object' && !Array.isArray(value);
function checkedInfo(info = {}) {
  if (!isMap(info) || Object.values(info).some(value => typeof value !== 'string')) throw new Error('Los datos del cliente guardados tienen un formato inválido.');
  return { ...emptyExpressInfo(), ...info };
}
export function parseDrafts(raw) {
  if (!raw) return emptyDrafts();
  const data = JSON.parse(raw);
  if (![1, 2].includes(data?.version) || !isMap(data.carritos) || !isMap(data.pending) || !isMap(data.orderNotes)) throw new Error('No se pudo leer el formato del borrador guardado.');
  if (Object.values(data.carritos).some(items => !Array.isArray(items) || items.some(item => !isMap(item) || !Number.isSafeInteger(Number(item.producto_id)) || !Number.isSafeInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0))) throw new Error('El borrador guardado contiene datos inválidos.');
  if (Object.values(data.pending).some(request => !request || typeof request.request_id !== 'string' || !Array.isArray(request.items))) throw new Error('No se pudo recuperar un envío pendiente. Conserva los datos guardados.');
  const next = { ...emptyDrafts(), carritos: { ...data.carritos }, pending: { ...data.pending }, orderNotes: { ...data.orderNotes } };
  if (data.version === 1) {
    const info = checkedInfo(data.expressInfo || {});
    if (data.carritos['express-pickup']?.length || data.pending['express-pickup'] || data.orderNotes['express-pickup'] || Object.values(info).some(value => value.trim())) {
      const key = 'express-draft:legacy';
      const request = data.pending['express-pickup'];
      const customer = request ? checkedInfo({
        nombre: request.cliente_nombre ?? info.nombre, dato: request.cliente_dato ?? info.dato,
        telefono: request.delivery_telefono ?? info.telefono, direccion: request.delivery_direccion ?? info.direccion,
        referencia: request.delivery_referencia ?? info.referencia,
      }) : info;
      next.expressDrafts[key] = { pickupType: (request?.tipo || data.pickupType) === 'Delivery' ? 'Delivery' : 'Para llevar', expressInfo: customer, createdAt: null };
      next.carritos[key] = data.carritos['express-pickup'] || [];
      next.orderNotes[key] = data.orderNotes['express-pickup'] || '';
      // Keep the original immutable payload and request_id for safe retries.
      if (data.pending['express-pickup']) next.pending[key] = data.pending['express-pickup'];
    }
    delete next.carritos['express-pickup']; delete next.pending['express-pickup']; delete next.orderNotes['express-pickup'];
  } else {
    if (!isMap(data.expressDrafts)) throw new Error('No se pudieron leer los borradores Express.');
    for (const [key, meta] of Object.entries(data.expressDrafts)) {
      if (!isExpressDraftKey(key) || !isMap(meta) || !['Para llevar', 'Delivery'].includes(meta.pickupType)) throw new Error('Un borrador Express tiene un formato inválido.');
      next.expressDrafts[key] = { ...meta, expressInfo: checkedInfo(meta.expressInfo) };
    }
    if ([...Object.keys(next.carritos), ...Object.keys(next.pending)].some(key => isExpressDraftKey(key) && !next.expressDrafts[key])) throw new Error('Faltan datos del cliente de un borrador Express.');
  }
  return next;
}
export function newExpressDraft(state, key, pickupType = 'Para llevar', createdAt = new Date().toISOString()) {
  if (!isExpressDraftKey(key)) throw new Error('Identificador de borrador inválido.');
  if (state.expressDrafts[key] || state.carritos[key] || state.pending[key]) throw new Error('El borrador ya existe.');
  return { ...state, expressDrafts: { ...state.expressDrafts, [key]: { pickupType: pickupType === 'Delivery' ? 'Delivery' : 'Para llevar', expressInfo: emptyExpressInfo(), createdAt } }, carritos: { ...state.carritos, [key]: [] }, orderNotes: { ...state.orderNotes, [key]: '' } };
}
export function patchExpressDraft(state, key, patch) {
  const meta = state.expressDrafts[key];
  if (!meta || state.pending[key]) return state;
  const next = typeof patch === 'function' ? patch(meta) : patch;
  return { ...state, expressDrafts: { ...state.expressDrafts, [key]: { ...meta, pickupType: next.pickupType === undefined ? meta.pickupType : next.pickupType === 'Delivery' ? 'Delivery' : 'Para llevar', expressInfo: next.expressInfo === undefined ? meta.expressInfo : checkedInfo({ ...meta.expressInfo, ...next.expressInfo }) } } };
}
export function savedDraftKeys(state) {
  return [...new Set([...Object.keys(state.expressDrafts), ...Object.keys(state.carritos).filter(key => state.carritos[key]?.length), ...Object.keys(state.pending)])];
}
export function discardExpressDraft(state, key) {
  if (!state.expressDrafts[key]) return state;
  if (state.pending[key]) throw new Error('Este borrador tiene un envío sin confirmar. Reintenta antes de eliminarlo.');
  return completedDraft(state, key);
}

export function validateDraft(items, products) {
  const counts = new Map();
  const refreshed = [];
  const changes = [];
  for (const item of items) {
    const product = products.find(p => Number(p.id) === Number(item.producto_id));
    if (!product || Number(product.disponible ?? 1) !== 1) return { error: `${item.nombre} ya no esta disponible. Retiralo del borrador.` };
    if (!Number.isFinite(Number(product.precio)) || Number(product.precio) < 0) return { error: `Precio invalido en ${item.nombre}. Revisa el catalogo.` };
    const count = (counts.get(product.id) || 0) + Number(item.cantidad);
    counts.set(product.id, count);
    if (!Number.isSafeInteger(Number(item.cantidad)) || Number(item.cantidad) <= 0) return { error: `Cantidad invalida en ${item.nombre}.` };
    if (count > Number(product.stock_disponible ?? product.inventario_stock ?? product.stock ?? 9999)) return { error: `No hay existencias suficientes de ${item.nombre}. Ajusta la cantidad.` };
    if (Math.round(Number(item.precio) * 100) !== Math.round(Number(product.precio) * 100)) changes.push(product.nombre);
    refreshed.push({ ...item, precio: Number(product.precio), stock: Number(product.stock_disponible ?? product.inventario_stock ?? product.stock ?? 9999) });
  }
  return { items: refreshed, changes };
}
export function completedDraft(state, key) {
  const next = { ...state, carritos: { ...state.carritos, [key]: [] }, orderNotes: { ...state.orderNotes, [key]: '' }, pending: { ...state.pending } };
  delete next.pending[key];
  if (isExpressDraftKey(key)) {
    next.expressDrafts = { ...state.expressDrafts };
    delete next.expressDrafts[key]; delete next.carritos[key]; delete next.orderNotes[key];
  }
  return next;
}
