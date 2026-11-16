export async function refreshServiceAlerts({ get, claim }) {
  const snapshot = await get();
  if (!snapshot || !Array.isArray(snapshot.items) || typeof snapshot.limits?.enabled !== 'boolean' || ![snapshot.limits.espera,snapshot.limits.lista].every(value=>Number.isInteger(value)&&value>=1&&value<=240)
    || snapshot.items.some(item=>!Number.isSafeInteger(item.id)||!Number.isSafeInteger(item.ronda_id)||!Number.isSafeInteger(item.pedido_id)||!['espera','lista'].includes(item.tipo)||!Number.isFinite(item.minutos)||!Number.isFinite(item.limite))) throw new Error('No se pudo validar la respuesta de demoras.');
  const result = { ...snapshot, newItems: [], error: '' };
  const pending = snapshot.limits.enabled ? snapshot.items.filter(item=>!item.avisada).slice(0,100) : [];
  if (pending.length) {
    try {
      const response = await claim(pending.map(item=>item.id));
      if (!Array.isArray(response?.ids)) throw new Error('Respuesta inválida.');
      result.newItems = pending.filter(item=>response.ids.includes(item.id));
      const claimed = new Set(result.newItems.map(item=>item.id));
      result.items = snapshot.items.map(item=>claimed.has(item.id)?{...item,avisada:true}:item);
    } catch (error) {
      if (error?.code === 'ERR_CANCELED') throw error;
      result.error = 'No se pudieron confirmar los avisos. La lista de demoras sigue disponible.';
    }
  }
  return result;
}
