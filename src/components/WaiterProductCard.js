// Compatibilidad: la «tarjeta» de producto del mesero ahora es una línea de comanda (ver waiter/menu.js).
import React, { memo } from 'react';
import { MenuRow } from './waiter/menu';

export default memo(function WaiterProductCard({ producto, qty = 0, isPromo, onPress, onDecrement, onCustomize, canAdd = true, chooseTarget = () => {}, locked = false }) {
  return <MenuRow producto={producto} qty={qty} isPromo={isPromo} locked={locked} canAdd={canAdd} chooseTarget={chooseTarget}
    onAdd={onPress} onDecrement={onDecrement || (() => {})} onCustomize={onCustomize} />;
});
