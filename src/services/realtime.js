import { io } from 'socket.io-client';
import { BASE_URL } from '../context/AuthContext';

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
    });
  }
  return socket;
}

export function subscribeRealtime(event, handler) {
  const client = getRealtimeSocket();
  client.on(event, handler);
  return () => client.off(event, handler);
}
