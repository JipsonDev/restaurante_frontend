const number = value => /^\d+$/.test(String(value).trim()) && Number(value) > 0 && Number(value) <= 2147483647;
export const tableKey = table => Number(table.activo) === 0 ? 'inactive' : table.estado;
export function tableDraft(table, tables = []) {
  return { id: table?.id ?? null, numero: String(table?.numero ?? Math.max(0, ...tables.filter(t => Number(t.activo) === 1).map(t => Number(t.numero) || 0)) + 1), capacidad: String(table?.capacidad ?? 4), ubicacion_id: table?.ubicacion_id ?? null };
}
export function tablePayload(form, original, tables, locations) {
  if (!number(form.numero)) throw new Error('Escribe un número de mesa entero mayor que cero.');
  if (!number(form.capacidad)) throw new Error('La cantidad de sillas debe ser un entero mayor que cero.');
  if ((!original || Number(original.activo) === 1) && tables.some(t => Number(t.id) !== Number(form.id) && Number(t.activo) === 1 && Number(t.numero) === Number(form.numero))) throw new Error('Ya existe una mesa activa con ese número.');
  const locationChanged = Number(form.ubicacion_id) !== Number(original?.ubicacion_id);
  if (form.ubicacion_id && locationChanged && !locations.some(l => Number(l.id) === Number(form.ubicacion_id) && Number(l.activo) === 1)) throw new Error('Selecciona una ubicación activa.');
  const payload = { numero: Number(form.numero), capacidad: Number(form.capacidad), ubicacion_id: form.ubicacion_id ? Number(form.ubicacion_id) : null };
  if (original) {
    // Send only edited metadata. Never overwrite a state changed by a waiter or a payment.
    for (const key of Object.keys(payload)) if (Number(payload[key]) === Number(original[key])) delete payload[key];
  }
  return payload;
}
