// Avisos del mesero en la web: sonido, vibración y aviso del sistema (ver waiterAlerts.js).
import { installWebAudioUnlock } from './webAudioAlerts';
import { alertWaiter, loadAlertSettings } from './waiterAlerts';

let loaded = false;
export async function configureWaiterNotifications() {
  installWebAudioUnlock();
  if (!loaded) { loaded = true; await loadAlertSettings(); }
}

export async function registerWaiterPushToken() {
  return null;
}

export async function unregisterWaiterPushToken() {}

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
