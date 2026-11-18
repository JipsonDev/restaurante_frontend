// Avisos del mesero en la web: sonido, vibración y aviso del sistema (ver waiterAlerts.js).
import { installWebAudioUnlock } from './webAudioAlerts';
import { alertWaiter, loadAlertSettings } from './waiterAlerts';
import { disableWebPush, enableWebPush } from './webPushClient';

let loaded = false;
export async function configureWaiterNotifications() {
  installWebAudioUnlock();
  if (!loaded) { loaded = true; await loadAlertSettings(); }
}

// Avisos con el teléfono bloqueado: si ya dio permiso, se renueva la suscripción en cada inicio.
export async function registerWaiterPushToken() {
  return enableWebPush({ ask: false });
}

export async function unregisterWaiterPushToken() {
  return disableWebPush();
}

export async function notifyWaiterInApp({ title, body, data }) {
  await configureWaiterNotifications();
  alertWaiter(data?.action === 'manual_ping' ? 'call' : 'ready', {
    title: title || 'Mesa lista', body: body || 'Pedido listo para recoger.',
    tag: `listo-${data?.pedido_id ?? ''}`,
  });
}

export function addWaiterNotificationResponseListener() {
  return { remove: () => {} };
}
