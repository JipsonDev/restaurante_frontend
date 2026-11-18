import { io } from 'socket.io-client';
import { BASE_URL, onSessionChange } from '../context/AuthContext';
import * as safeStorage from './storage';

let socket = null;

export const REALTIME_EVENTS = {
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_READY: 'order:ready',
  SPLIT_REQUESTED: 'split:requested',
  TABLE_OCCUPIED: 'TABLE_OCCUPIED',
  TABLE_FREED: 'TABLE_FREED',
  TABLE_UPDATED: 'TABLE_UPDATED',
  PAYMENT_CREATED: 'payment:created',
  CASH_UPDATED: 'cash:updated',
  RESERVATION_UPDATED: 'reservation:updated',
  PRINT_COMANDA: 'print:comanda',
  PRINT_PRECUENTA: 'print:precuenta',
  CATALOG_UPDATED: 'catalog:updated', // producto agotado o disponible otra vez (cocina) o cambio de stock (action: 'stock')
  INVENTORY_ALERT: 'inventory:alert', // «queda poco», «se acabó» y lo repuesto (administración)
};

function socketUrl() {
  return BASE_URL.replace(/\/api\/?$/, '');
}

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(socketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 4000,
      randomizationFactor: 0.3,
      timeout: 15000,
      // El servidor rechaza conexiones sin JWT. Se lee en cada (re)conexion,
      // asi un token renovado se usa sin recrear el socket.
      auth: (callback) => {
        safeStorage.getItem('token').then(token => callback({ token: token || '' }), () => callback({ token: '' }));
      },
    });
    installWakeHandlers();
  }
  return socket;
}

// Al volver a la app (pantalla desbloqueada, pestaña visible, vuelve internet) se reconecta YA, sin esperar
// el siguiente reintento. Si estuvo en segundo plano más de 25 s, se renueva la conexión: el socket pudo
// quedar «zombi» (el sistema congeló la app) y los datos se resincronizan al conectar.
let wakeInstalled = false;
let hiddenAt = 0;
function installWakeHandlers() {
  if (wakeInstalled || typeof window === 'undefined' || !window.addEventListener) return;
  wakeInstalled = true;
  const wake = () => {
    if (!socket) return;
    const longAway = hiddenAt && Date.now() - hiddenAt > 25000;
    hiddenAt = 0;
    if (!socket.connected) socket.connect();
    else if (longAway) { socket.disconnect(); socket.connect(); }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') hiddenAt = Date.now(); else wake(); });
  }
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
}

// Estado de conexión «estable» para la interfaz: conectado se muestra al instante; desconectado solo si
// sigue así más de `grace` ms (los micro-cortes de wifi ya no hacen parpadear «Sin conexión»).
// onReconnect se llama al volver a conectar (para resincronizar datos).
export function watchConnection(setStatus, { grace = 4000, onReconnect } = {}) {
  const client = getRealtimeSocket();
  let timer = null;
  const later = state => { if (timer) return; timer = setTimeout(() => { timer = null; if (!client.connected) setStatus(state); }, grace); };
  const onConnect = () => { if (timer) { clearTimeout(timer); timer = null; } setStatus('connected'); onReconnect?.(); };
  const onDisconnect = () => later('disconnected');
  const onError = () => later('error');
  setStatus(client.connected ? 'connected' : 'connecting');
  client.on('connect', onConnect); client.on('disconnect', onDisconnect); client.on('connect_error', onError);
  return () => { if (timer) clearTimeout(timer); client.off('connect', onConnect); client.off('disconnect', onDisconnect); client.off('connect_error', onError); };
}

// Cierra la conexion al cerrar o cambiar de sesion para no reutilizar
// la identidad del usuario anterior.
export function resetRealtimeSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

onSessionChange(resetRealtimeSocket);

export function subscribeRealtime(event, handler) {
  const client = getRealtimeSocket();
  client.on(event, handler);
  return () => client.off(event, handler);
}
