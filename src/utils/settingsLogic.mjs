const clean = value => String(value ?? '').trim();

function rate(value, label) {
  const raw = clean(value).replace(',', '.');
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(raw) || Number(raw) > 100) throw new Error(`${label} debe estar entre 0 y 100.`);
  return String(Number(raw));
}

export function settingsPayload(form = {}) {
  const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, clean(value)]));
  if (!payload.nombre_restaurante) throw new Error('Escribe el nombre del restaurante.');
  payload.iva_porcentaje = rate(payload.iva_porcentaje, 'El IVA');
  payload.servicio_porcentaje = rate(payload.servicio_porcentaje, 'El servicio');
  payload.moneda = payload.moneda.toUpperCase();
  if (!/^[A-Z]{3}$/.test(payload.moneda)) throw new Error('La moneda debe tener tres letras, por ejemplo USD.');
  if (!payload.simbolo_moneda || payload.simbolo_moneda.length > 5) throw new Error('Escribe un símbolo de moneda válido.');
  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) throw new Error('El correo de facturación no es válido.');
  if (payload.ruc && !/^\d{10,13}$/.test(payload.ruc)) throw new Error('El RUC o identificación fiscal debe tener entre 10 y 13 dígitos.');
  if (payload.alertas_demora_activas !== undefined && !['0','1'].includes(payload.alertas_demora_activas)) throw new Error('Las alertas deben usar 0 o 1.');
  for (const key of ['alerta_espera_minutos','alerta_lista_minutos']) {
    if (payload[key] === undefined) continue;
    if (!/^\d+$/.test(payload[key]) || Number(payload[key]) < 1 || Number(payload[key]) > 240) throw new Error('Los límites de atención deben ser minutos enteros entre 1 y 240.');
    payload[key] = String(Number(payload[key]));
  }
  return payload;
}

export function ticketPreview(form = {}, base = 10) {
  const subtotal = Math.max(0, Number(base || 0));
  const tax = subtotal * Math.max(0, Number(String(form.iva_porcentaje || 0).replace(',', '.'))) / 100;
  const service = subtotal * Math.max(0, Number(String(form.servicio_porcentaje || 0).replace(',', '.'))) / 100;
  return { subtotal, tax, service, total: subtotal + tax + service };
}
