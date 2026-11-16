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
