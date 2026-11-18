// Avisos con el teléfono bloqueado (Web Push). Funciona en la app web: Android con Chrome/Edge y
// iPhone con la app instalada en la pantalla de inicio (iOS 16.4 o posterior).
import { Platform } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const listeners = new Set();
let status = 'off';
const set = next => { if (next !== status) { status = next; listeners.forEach(fn => fn(status)); } };

export const pushStatus = () => status;
export function subscribePushStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const isIOS = () => WEB && /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (WEB && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => WEB && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

/** ¿Qué puede hacer este teléfono? 'ok' | 'ios-install' (iPhone: falta instalar la app) | 'unsupported'. */
export function pushSupport() {
  if (!WEB || !('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported';
  if (!('PushManager' in window)) return isIOS() && !standalone() ? 'ios-install' : 'unsupported';
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return 'unsupported';
  return 'ok';
}

function keyBytes(base64url) {
  const pad = '='.repeat((4 - base64url.length % 4) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
}
const sameKey = (a, b) => { if (!a || !b || a.byteLength !== b.byteLength) return false; const x = new Uint8Array(a), y = new Uint8Array(b); return x.every((v, i) => v === y[i]); };

async function registration() {
  const ready = navigator.serviceWorker.ready;
  return Promise.race([ready, new Promise((_, reject) => setTimeout(() => reject(new Error('La app aún no termina de instalarse. Intenta en un momento.')), 6000))]);
}

/** Activa los avisos en este teléfono para el usuario que inició sesión. Solo pide permiso si ask = true. */
export async function enableWebPush({ ask = false } = {}) {
  const support = pushSupport();
  if (support !== 'ok') { set(support); return status; }
  let permission = Notification.permission;
  if (permission === 'default' && ask) permission = await Notification.requestPermission();
  if (permission === 'denied') { set('denied'); return status; }
  if (permission !== 'granted') { set('off'); return status; }
  try {
    const { data } = await axios.get(`${BASE_URL}/notificaciones/web-push/clave`, { timeout: 10000 });
    const key = keyBytes(data.publicKey);
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    // Si el servidor cambió de clave, la suscripción vieja ya no sirve.
    if (sub && !sameKey(sub.options?.applicationServerKey, key.buffer)) { await sub.unsubscribe().catch(() => {}); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await axios.post(`${BASE_URL}/notificaciones/web-push`, { subscription: sub.toJSON(), dispositivo: navigator.userAgent }, { timeout: 10000 });
    set('active');
  } catch (error) {
    console.warn('Avisos con el teléfono bloqueado:', error?.message);
    set('error');
  }
  return status;
}

/** Al cerrar sesión: este teléfono deja de recibir los avisos de esa persona. */
export async function disableWebPush() {
  if (!WEB || pushSupport() !== 'ok') return;
  try {
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await axios.delete(`${BASE_URL}/notificaciones/web-push`, { data: { endpoint: sub.endpoint }, timeout: 5000 }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch { /* sin service worker: nada que quitar */ }
  set('off');
}

/** Pide al servidor un aviso de prueba dentro de `delay` segundos (el mismo camino que «plato listo»). */
export async function testWebPush(delay = 0) {
  const { data } = await axios.post(`${BASE_URL}/notificaciones/web-push/prueba`, { delay }, { timeout: 12000 });
  return Number(data?.sent || 0) > 0;
}
