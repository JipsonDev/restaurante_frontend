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
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 12000,
      // El servidor rechaza conexiones sin JWT. Se lee en cada (re)conexion,
      // asi un token renovado se usa sin recrear el socket.
      auth: (callback) => {
        safeStorage.getItem('token').then(token => callback({ token: token || '' }), () => callback({ token: '' }));
      },
    });
  }
  return socket;
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
