// Compatibilidad: la casilla de mesa ahora vive en waiter/salon.js (TableTile, dirección «Comanda»).
import React, { memo } from 'react';
import { TableTile } from './waiter/salon';

export { TableTile };

function WaiterTableCard({ mesa, state, order, cardWidth, now, selected, ready, alert, reservation, onPress, onLongPress }) {
  return <TableTile mesa={mesa} state={state || 'Libre'} order={order} width={cardWidth} now={now} selected={selected} ready={ready} alert={alert} reservation={reservation} onPress={onPress} onLongPress={onLongPress} />;
}

export default memo(WaiterTableCard);
