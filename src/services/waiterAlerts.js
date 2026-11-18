// Avisos del mesero: sonido, vibración, aviso del sistema y pantalla encendida.
// Un solo lugar decide cómo se avisa, respetando lo que el mesero eligió en «Más».
import { Platform, Vibration } from 'react-native';
import * as safeStorage from './storage';
import { installWebAudioUnlock, playWebAlertTone } from './webAudioAlerts';
import { pushStatus } from './webPushClient';

const WEB = Platform.OS === 'web';
const KEY = 'mm:waiter-alerts:v1';
const DEFAULTS = { sound: true, vibrate: true, keepAwake: false };
let settings = { ...DEFAULTS };
const listeners = new Set();

// Cada tipo de aviso suena y vibra distinto para reconocerlo sin mirar.
const KINDS = {
  ready: { tone: { frequencies: [784, 1047, 1319, 1047, 1319, 1568], volume: 0.34, duration: 0.16, gap: 0.14, type: 'triangle' }, vibration: [0, 320, 120, 320, 120, 520] },
  call: { tone: { frequencies: [988, 988, 1319, 988, 988, 1319], volume: 0.34, duration: 0.14, gap: 0.13, type: 'square' }, vibration: [0, 500, 150, 500] },
  reserve: { tone: { frequencies: [659, 880, 659, 880], volume: 0.28, duration: 0.18, gap: 0.17, type: 'sine' }, vibration: [0, 200, 100, 200] },
};

export const alertSettings = () => settings;
export function subscribeAlertSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export async function loadAlertSettings() {
  try { const raw = await safeStorage.getItem(KEY); if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) }; } catch { settings = { ...DEFAULTS }; }
  if (WEB) installWebAudioUnlock();
  if (settings.keepAwake) keepScreenAwake(true);
  listeners.forEach(fn => fn(settings));
  return settings;
}
export async function saveAlertSettings(patch) {
  settings = { ...settings, ...patch };
  listeners.forEach(fn => fn(settings));
  if ('keepAwake' in patch) keepScreenAwake(settings.keepAwake);
  try { await safeStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* se conserva en memoria */ }
  return settings;
}

// ── Aviso del sistema (aparece aunque la app esté en segundo plano) ─────────
export function notificationPermission() {
  if (!WEB || typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission; // 'granted' | 'denied' | 'default'
}
export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try { return await window.Notification.requestPermission(); } catch { return notificationPermission(); }
}
async function systemNotification({ title, body, tag, vibration }) {
  if (notificationPermission() !== 'granted') return false;
  const options = { body, tag, renotify: true, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', vibrate: vibration, requireInteraction: false, data: { url: '/' } };
  try {
    // En Android (Chrome) solo el service worker puede mostrar avisos.
    const registration = typeof navigator !== 'undefined' && navigator.serviceWorker ? await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(() => resolve(null), 1500))]) : null;
    if (registration?.showNotification) { await registration.showNotification(title, options); return true; }
    const n = new window.Notification(title, options);
    n.onclick = () => { window.focus?.(); n.close(); };
    return true;
  } catch { return false; }
}

// ── Título de la pestaña parpadeando mientras la app no está a la vista ─────
let flashTimer = null, baseTitle = null;
function flashTitle(text) {
  if (!WEB || typeof document === 'undefined') return;
  if (baseTitle == null) baseTitle = document.title;
  clearInterval(flashTimer);
  let on = false;
  const stop = () => { clearInterval(flashTimer); flashTimer = null; document.title = baseTitle; document.removeEventListener('visibilitychange', onVisible); };
  const onVisible = () => { if (!document.hidden) stop(); };
  if (!document.hidden) return;
  flashTimer = setInterval(() => { on = !on; document.title = on ? `● ${text}` : baseTitle; }, 900);
  document.addEventListener('visibilitychange', onVisible);
}

// ── Pantalla encendida: así el teléfono no se duerme y los avisos siguen llegando ──
let wakeLock = null, wakeWanted = false, wakeHooked = false;
export const keepAwakeSupported = () => WEB && typeof navigator !== 'undefined' && 'wakeLock' in navigator;
export async function keepScreenAwake(on) {
  wakeWanted = !!on;
  if (!keepAwakeSupported()) return false;
  if (!wakeHooked) {
    wakeHooked = true;
    // El navegador suelta el bloqueo al cambiar de app: se vuelve a pedir al regresar.
    document.addEventListener('visibilitychange', () => { if (!document.hidden && wakeWanted && !wakeLock) keepScreenAwake(true); });
  }
  try {
    if (wakeWanted && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener?.('release', () => { wakeLock = null; }); }
    if (!wakeWanted && wakeLock) { await wakeLock.release(); wakeLock = null; }
    return !!wakeLock;
  } catch { wakeLock = null; return false; }
}

/** Avisa al mesero. kind: 'ready' (plato o ronda lista), 'call' (cocina llama), 'reserve' (reserva por llegar). */
export function alertWaiter(kind = 'ready', { title = '', body = '', tag } = {}) {
  const k = KINDS[kind] || KINDS.ready;
  const hidden = WEB && typeof document !== 'undefined' && document.hidden;
  let sounded = false;
  if (settings.sound && WEB) sounded = playWebAlertTone(k.tone);
  if (settings.vibrate) {
    try {
      if (WEB) { if (typeof navigator !== 'undefined' && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(k.vibration); }
      else Vibration.vibrate(k.vibration);
    } catch { /* sin motor de vibración */ }
  }
  // Con los avisos push activos, el aviso del sistema lo manda el servidor (llega aunque el teléfono esté bloqueado): no se duplica.
  if (hidden) { flashTitle(title); if (pushStatus() !== 'active') systemNotification({ title, body, tag: tag || kind, vibration: settings.vibrate ? k.vibration : undefined }); }
  return { sounded, hidden };
}
