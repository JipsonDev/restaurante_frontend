export function draftDeliveryStatus({ hasDraft, order, pending, sending, saving, error } = {}) {
  if (pending) return { key:sending?'sending':'pending',label:sending?'Enviando · pendiente de confirmar':'Pendiente de confirmar',detail:'El servidor puede haber recibido esta ronda. Reintenta el mismo envío; no crees otro pedido.' };
  if (sending) return {key:'sending',label:'Validando el envío…',detail:'Comprobando productos, precios y disponibilidad.'};
  if (hasDraft && error) return {key:'unsaved',label:'No guardado en este equipo',detail:'Conserva esta página abierta. Los últimos cambios no están protegidos al cerrarla.'};
  if (hasDraft && saving) return {key:'saving',label:'Guardando en este equipo…',detail:'Todavía no se ha enviado a cocina.'};
  if (hasDraft) return {key:'local',label:'Guardado en este equipo · sin enviar',detail:'Disponible para tu usuario en este dispositivo. Aún no está registrado en cocina.'};
  if (order?.id) return {key:'sent',label:'Enviado · confirmado por el servidor',detail:'La cuenta y sus rondas ya están registradas.'};
  return {key:'empty',label:'',detail:''};
}

export function connectionState({connection,lastSyncAt,syncing,error} = {}) {
  if(syncing)return {key:'syncing',label:'Sincronizando…'};
  if(error)return {key:'error',label:'No se pudo actualizar'};
  if(!lastSyncAt)return {key:'never',label:'Sin sincronizar'};
  if(connection==='connected')return {key:'live',label:'Conexión en vivo'};
  return {key:'disconnected',label:connection==='connecting'?'Reconectando…':'Sin conexión en vivo'};
}

export function confirmedOrder(response, request) {
  const order=response?.pedido || response;
  if(!Number.isSafeInteger(Number(order?.id)) || Number(order.id)<=0 || !Array.isArray(order.items) || !Array.isArray(order.rondas) || !order.rondas.length
    || (request.pedido_id && Number(request.pedido_id)!==Number(order.id))
    || Number(request.mesa_id || 0)!==Number(order.mesa_id || 0)) throw new Error('La respuesta no confirma esta ronda. Conservamos el envío pendiente para reintentar sin duplicarlo.');
  return order;
}

const eventTypes=new Set(['pedido_tomado','ronda_enviada','ronda_entregada','ronda_agregada_legacy','cobro','cobro_anulado','cobro_devuelto']);
export function trackingEvents(responses) {
  const events=new Map();
  for(const response of responses){
    if(!Number.isSafeInteger(Number(response?.pedido_id))||!Array.isArray(response.events))throw new Error('El seguimiento tiene un formato inválido.');
    for(const event of response.events){
      if(!event?.id||!eventTypes.has(event.tipo)||!event.actor||typeof event.actor.nombre!=='string')throw new Error('Una acción del seguimiento no es válida.');
      const key=`${response.pedido_id}:${event.id}`;
      events.set(key,{...event,pedido_id:response.pedido_id,key});
    }
  }
  const stamp=event=>{const value=event.at?new Date(event.at).getTime():NaN;return Number.isFinite(value)?value:Infinity;};
  return [...events.values()].sort((a,b)=>stamp(a)-stamp(b)||0);
}
