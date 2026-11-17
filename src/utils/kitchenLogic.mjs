export const normalizeKitchenState = (state) => ({
  Pendiente: 'PENDIENTE', 'En preparación': 'PREPARANDO', 'En preparacion': 'PREPARANDO',
  Listo: 'LISTO', Entregado: 'ENTREGADO', Completado: 'PAGADO', Pagado: 'PAGADO', Cancelado: 'CANCELADO',
}[state] || String(state || '').toUpperCase());

export function kitchenRounds(accounts) {
  return accounts.flatMap((account) => (account.rondas || []).map((round) => ({
    ...account, ...round, id: round.id, ronda_id: round.id, pedido_id: account.id,
    estado_cobro: account.estado_cobro, items: round.items || [],
  })));
}

export function kitchenColumn(order) {
  if (!(order.items || []).some((item) => Number(item.cantidad) > 0)) return null;
  const state = normalizeKitchenState(order.estado);
  if (['PENDIENTE', 'PREPARANDO', 'LISTO'].includes(state)) return state;
  return ['ENTREGADO', 'PAGADO', 'CANCELADO'].includes(state) ? 'ENTREGADO' : null;
}

export function pendingSignature(order) {
  return `${order.id}:${(order.items || []).map((item) => `${item.id}-${item.cantidad}`).sort().join(',')}`;
}

// Coalesce events, and discard reads overtaken by an event while in flight.
export function createRefreshQueue(load, apply, onError) {
  let running = null;
  let version = 0;
  let stopped = false;
  return {
    refresh() {
      if (stopped) return Promise.resolve();
      version += 1;
      if (running) return running;
      running = (async () => {
        let observed;
        do {
          observed = version;
          try {
            const value = await load();
            if (!stopped && observed === version) apply(value);
          } catch (error) { if (!stopped) onError(error); }
        } while (!stopped && observed !== version);
      })().finally(() => { running = null; });
      return running;
    },
    stop() { stopped = true; },
  };
}

// ── Pantalla de cocina (KDS) ────────────────────────────────────────────────
// Minutos que lleva una ronda en su etapa actual: nuevas desde que llegaron, en preparación desde
// que se empezaron, listas desde que se marcaron listas.
export function stageMinutes(round, now = Date.now()) {
  const state = normalizeKitchenState(round.estado);
  const from = state === 'LISTO' ? (round.listo_at || round.created_at) : state === 'PREPARANDO' ? (round.preparando_at || round.created_at) : round.created_at;
  const t = from ? new Date(String(from).replace(' ', 'T')).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

// Minutos totales desde que llegó a cocina (para el semáforo de espera del cliente).
export function waitMinutes(round, now = Date.now()) {
  const t = round.created_at ? new Date(String(round.created_at).replace(' ', 'T')).getTime() : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

// Semáforo según el límite configurado (Ajustes › Atención): a tiempo < 60 %, atento 60–100 %, tarde > límite.
export function ticketUrgency(minutes, limit = 20) {
  const l = Math.max(1, Number(limit) || 20);
  if (minutes >= l) return 'late';
  if (minutes >= Math.ceil(l * 0.6)) return 'warn';
  return 'ok';
}

// «8 min», «1 h 05»
export function shortDuration(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  if (m < 1) return 'ahora';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

// Tablero: rondas con productos, por columna. Nuevas y en preparación: las más antiguas primero.
export function kitchenBoard(rounds = []) {
  const board = { PENDIENTE: [], PREPARANDO: [], LISTO: [], ENTREGADO: [] };
  for (const r of rounds) {
    const col = kitchenColumn(r);
    if (col && board[col]) board[col].push(r);
  }
  const age = r => new Date(String(r.created_at || 0).replace(' ', 'T')).getTime() || 0;
  board.PENDIENTE.sort((a, b) => age(a) - age(b));
  board.PREPARANDO.sort((a, b) => age(a) - age(b));
  board.LISTO.sort((a, b) => age(a) - age(b));
  board.ENTREGADO.sort((a, b) => age(b) - age(a));
  return board;
}

// «Por plato»: total de cada producto (con sus extras y notas) en rondas nuevas y en preparación.
export function allDayItems(rounds = [], targetOf = r => r.mesa_numero ? `Mesa ${r.mesa_numero}` : 'Llevar') {
  const map = new Map();
  for (const r of rounds) {
    const state = normalizeKitchenState(r.estado);
    if (state !== 'PENDIENTE' && state !== 'PREPARANDO') continue;
    for (const item of r.items || []) {
      const qty = Number(item.cantidad || 0);
      if (qty <= 0) continue;
      const mods = (item.modificadores || []).map(m => m.nombre).filter(Boolean).sort();
      const key = `${item.producto_id || item.nombre}::${mods.join('|')}::${item.notas || ''}`;
      const row = map.get(key) || { key, nombre: item.nombre, modificadores: mods, notas: item.notas || '', cantidad: 0, nuevas: 0, destinos: new Map() };
      row.cantidad += qty;
      if (state === 'PENDIENTE') row.nuevas += qty;
      const dest = targetOf(r);
      row.destinos.set(dest, (row.destinos.get(dest) || 0) + qty);
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map(r => ({ ...r, destinos: [...r.destinos.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })) }))
    .sort((a, b) => b.cantidad - a.cantidad || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

// Notas que la cocina no puede pasar por alto (alergias, intolerancias).
export function isCriticalNote(text) {
  return /alerg|intoler|cel[ií]ac|sin gluten|sin man[ií]|sin mariscos|vegan/i.test(String(text || ''));
}
