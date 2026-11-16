const pendingStates = ['PENDIENTE', 'PREPARANDO', 'LISTO'];

// API dates are normally ISO instants. Also accept the local SQL format used by
// older records, without interpreting null as 1970 or rolling invalid days over.
export function serviceDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(value);
    if (!match) return null;
    const [, year, month, day, hour, minute, second = '0'] = match;
    const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    if (+month < 1 || +month > 12 || +day < 1 || +day > days || +hour > 23 || +minute > 59 || +second > 59) return null;
  } else if (!(value instanceof Date) && typeof value !== 'number') return null;
  const date = new Date(typeof value === 'string' ? value.replace(' ', 'T') : value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function minutesBetween(start, end) {
  if (!start || !end || start > end) return null;
  return Math.floor((end.getTime() - start.getTime()) / 60000);
}

export function serviceRounds(order) {
  return (order?.originalOrders || (order ? [order] : [])).flatMap(account => {
    if (account.estado === 'CANCELADO') return [];
    const rounds = account.rondas?.length ? account.rondas : account.id ? [{
      id: `legacy-${account.id}`, estado: account.estado_cocina || account.estado,
      created_at: account.created_at, listo_at: account.listo_at, entregado_at: account.entregado_at,
    }] : [];
    return rounds.filter(round => round.estado !== 'CANCELADO').map(round => ({ ...round, pedido_id: account.id }));
  });
}

export function roundTiming(round, now = Date.now()) {
  const current = serviceDate(now);
  const rawSent = serviceDate(round.created_at);
  const sentAt = rawSent && current && rawSent <= current ? rawSent : null;
  const rawReady = serviceDate(round.listo_at);
  const rawDelivered = serviceDate(round.entregado_at);
  const readyAt = rawReady && current && rawReady <= current && (!rawSent || rawReady >= rawSent) ? rawReady : null;
  const deliveredAt = rawDelivered && current && rawDelivered <= current && (!rawSent || rawDelivered >= rawSent) && (!rawReady || rawDelivered >= rawReady) ? rawDelivered : null;
  const active = pendingStates.includes(round.estado);
  const end = active ? current : round.estado === 'ENTREGADO' ? deliveredAt : null;
  return { sentAt, readyAt, deliveredAt, active,
    waitMinutes: minutesBetween(sentAt, end),
    readyMinutes: ['LISTO', 'ENTREGADO'].includes(round.estado) ? minutesBetween(readyAt, end) : null,
  };
}

export function serviceSummary(order, now = Date.now()) {
  const rounds = serviceRounds(order);
  const active = rounds.filter(round => pendingStates.includes(round.estado)).map(round => ({ ...roundTiming(round, now), estado: round.estado }));
  const ready = active.filter(round => round.estado === 'LISTO');
  const unknownWaitCount = active.filter(round => round.waitMinutes === null).length;
  const unknownReadyCount = ready.filter(round => round.readyMinutes === null).length;
  return {
    pendingCount: active.length, readyCount: ready.length, unknownWaitCount, unknownReadyCount,
    waitMinutes: active.length && !unknownWaitCount ? Math.max(...active.map(round => round.waitMinutes)) : null,
    readyMinutes: ready.length && !unknownReadyCount ? Math.max(...ready.map(round => round.readyMinutes)) : null,
  };
}

export function serviceDuration(minutes) {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return 'Sin hora registrada';
  const whole = Math.floor(minutes);
  if (!whole) return 'Menos de 1 min';
  const days = Math.floor(whole / 1440), hours = Math.floor(whole % 1440 / 60), rest = whole % 60;
  return [days ? `${days} d` : '', hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}

export function serviceSummaryLabel(order, now = Date.now()) {
  if (!order) return '';
  const summary = serviceSummary(order, now);
  if (!summary.pendingCount) return 'Sin entregas pendientes';
  return `Espera: ${serviceDuration(summary.waitMinutes)}${summary.readyCount ? `; lista para entregar: ${serviceDuration(summary.readyMinutes)}, ${summary.readyCount} ${summary.readyCount === 1 ? 'ronda' : 'rondas'}` : ''}`;
}

export function serviceTimeLabel(value, now = Date.now()) {
  const date = serviceDate(value), current = serviceDate(now);
  if (!date) return 'Sin hora registrada';
  const time = date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return current && date.toDateString() === current.toDateString() ? `hoy, ${time}` : `${date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${time}`;
}
