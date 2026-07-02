import { AppState, Platform, Vibration } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { BASE_URL } from '../context/AuthContext';

let configured = false;
let lastPushToken = null;

function projectId() {
  return (
    Constants?.easConfig?.projectId
    || Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.manifest2?.extra?.eas?.projectId
    || Constants?.manifest?.extra?.eas?.projectId
    || undefined
  );
}

export async function configureWaiterNotifications() {
  if (configured || Platform.OS === 'web') return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('waiter-alerts', {
      name: 'Alertas de cocina',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 120, 250],
      lightColor: '#ea580c',
      sound: 'default',
    }).catch(() => {});
  }
}

function playWebChime() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const now = context.currentTime;
    [880, 1175].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.0001, now + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.22, now + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.15);
    });
    setTimeout(() => context.close().catch(() => {}), 650);
  } catch {}
}

async function showWebNotification({ title, body, data }) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission === 'default') {
    await window.Notification.requestPermission().catch(() => null);
  }
  if (window.Notification.permission === 'granted') {
    const notification = new window.Notification(title, { body, data });
    notification.onclick = () => {
      window.focus?.();
      notification.close();
    };
  }
}

export async function registerWaiterPushToken(user) {
  if (!user || user.rol !== 'mesero' || Platform.OS === 'web') return null;

  await configureWaiterNotifications();
  const current = await Notifications.getPermissionsAsync();
  const finalStatus = current.status === 'granted'
    ? current.status
    : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') return null;

  const tokenResult = await Notifications.getExpoPushTokenAsync(
    projectId() ? { projectId: projectId() } : undefined
  );
  lastPushToken = tokenResult.data;

  await axios.post(`${BASE_URL}/notificaciones/push-token`, {
    token: lastPushToken,
    platform: Platform.OS,
    device_name: Constants?.deviceName || Constants?.sessionId || null,
  }).catch(() => null);

  return lastPushToken;
}

export async function unregisterWaiterPushToken() {
  if (!lastPushToken || Platform.OS === 'web') return;
  await axios.delete(`${BASE_URL}/notificaciones/push-token`, {
    data: { token: lastPushToken },
  }).catch(() => null);
  lastPushToken = null;
}

export async function notifyWaiterInApp({ title, body, data }) {
  await configureWaiterNotifications();

  const notification = {
    title: title || 'Mesa lista',
    body: body || 'Pedido listo para recoger.',
    data: data || {},
  };

  if (AppState.currentState === 'active') {
    playWebChime();
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 250, 120, 250]);
      await Notifications.scheduleNotificationAsync({
        content: {
          ...notification,
          sound: 'default',
        },
        trigger: null,
      }).catch(() => {});
    }
    return;
  }

  if (Platform.OS === 'web') {
    await showWebNotification(notification);
  }
}

export function addWaiterNotificationResponseListener(handler) {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener((response) => {
    handler?.(response?.notification?.request?.content?.data || {});
  });
}
