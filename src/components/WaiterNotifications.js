// Bandeja «Listo» (reemplaza el antiguo panel de notificaciones).
import React from 'react';
import { ReadyTray } from './waiter/salon';

export default function WaiterNotifications({ alerts, activity, close, openOrder, clearActivity, ready = [], onDeliver, deliveringId, now }) {
  return <ReadyTray open onClose={close} ready={ready} alerts={alerts} activity={activity} onDeliver={onDeliver} deliveringId={deliveringId} onOpen={openOrder} clearActivity={clearActivity} now={now} />;
}
