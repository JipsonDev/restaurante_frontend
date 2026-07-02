import { Platform } from 'react-native';
import { ALERT_TONES, installWebAudioUnlock, playWebAlertTone } from './webAudioAlerts';

function playWebChime() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  playWebAlertTone(ALERT_TONES.ORDER_READY);
}

async function showWebNotification({ title, body, data }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission === 'granted') {
    const notification = new window.Notification(title, { body, data });
    notification.onclick = () => {
      window.focus?.();
      notification.close();
    };
  }
}

export async function configureWaiterNotifications() {
  installWebAudioUnlock();
}

export async function registerWaiterPushToken() {
  return null;
}

export async function unregisterWaiterPushToken() {}

export async function notifyWaiterInApp({ title, body, data }) {
  installWebAudioUnlock();
  const notification = {
    title: title || 'Mesa lista',
    body: body || 'Pedido listo para recoger.',
    data: data || {},
  };

  playWebChime();
  await showWebNotification(notification);
}

export function addWaiterNotificationResponseListener() {
  return { remove: () => {} };
}
