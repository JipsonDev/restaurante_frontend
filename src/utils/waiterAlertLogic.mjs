// Recordatorios de rondas listas que nadie ha llevado (lógica pura).
export const REMIND_EVERY_MIN = 3;
export const MAX_REMINDERS = 3;

/** Decide a qué rondas listas hay que volver a avisar.
 *  ready: [{ round: { id }, pedido, minutes }]  ·  state: { [roundId]: { count, at } } (se devuelve actualizado)
 *  Solo recuerda rondas que llevan REMIND_EVERY_MIN o más esperando, cada REMIND_EVERY_MIN, hasta MAX_REMINDERS veces. */
export function dueReminders(ready = [], state = {}, now = Date.now()) {
  const next = {}, due = [];
  for (const entry of ready) {
    const id = entry?.round?.id;
    if (id == null) continue;
    const prev = state[id] || { count: 0, at: 0 };
    const waited = Number(entry.minutes);
    const sinceLast = (now - prev.at) / 60000;
    if (Number.isFinite(waited) && waited >= REMIND_EVERY_MIN && prev.count < MAX_REMINDERS && sinceLast >= REMIND_EVERY_MIN) {
      next[id] = { count: prev.count + 1, at: now };
      due.push(entry);
    } else next[id] = prev;
  }
  return { due, state: next }; // las rondas ya entregadas desaparecen del estado
}
