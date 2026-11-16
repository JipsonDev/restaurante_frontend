import React, { memo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Coffee, Utensils, Wine, Minus, Plus, ArrowUpRight, LockKeyhole } from 'lucide-react-native';
import { assetUrl } from '../context/AuthContext';
import { menuStock } from '../utils/waiterCatalog.mjs';
import { WText, WButton } from './WaiterUI';

export default memo(function WaiterProductCard({ producto, qty = 0, isPromo, onPress, onDecrement, cardWidth, colors: c, canAdd, chooseTarget, showDescription = false, layout = 'grid', locked = false }) {
  const uri = assetUrl(producto.imagen_url);
  const [failedUri, setFailedUri] = useState(null);
  const stock = menuStock(producto);
  const available = Number(producto.disponible ?? 1) === 1 && stock > 0;
  const limit = qty >= stock;
  const category = producto.categoria_nombre || producto.categoria || 'General';
  const categoryText = typeof category === 'string' ? category : 'General';
  const Icon = /caf|postre|pan/i.test(categoryText) ? Coffee : /bebida|bar|cerveza/i.test(categoryText) ? Wine : Utensils;
  const list = layout === 'list';
  const tight = cardWidth < 240;
  const hasImage = !!uri && failedUri !== uri;
  const price = `$${Number(producto.precio || 0).toFixed(2)}`;
  const add = () => { if (locked || !available || limit) return; if (!canAdd) chooseTarget(); else onPress(producto, isPromo); };
  const art = <View style={{ width: list ? 56 : '100%', height: list ? 56 : 100, backgroundColor: c.field, alignItems: 'center', justifyContent: 'center', borderRadius: list ? 4 : 0, overflow: 'hidden', flexShrink: 0 }}>{hasImage ? <Image source={{ uri }} resizeMode="cover" onError={() => setFailedUri(uri)} style={{ width: '100%', height: '100%' }} accessibilityLabel={producto.nombre} /> : <Icon size={list ? 24 : 30} color={c.muted} strokeWidth={1.25} />}</View>;
  const stockLabel = !available ? 'Agotado' : limit ? 'Límite en el pedido' : stock < 9999 ? `${stock} disponibles` : null;
  const controls = qty > 0 && canAdd ? <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 5, overflow: 'hidden', width: list && !tight ? 116 : '100%' }}>
    <WButton colors={c} Icon={Minus} label={`Quitar uno de ${producto.nombre}`} disabled={locked} onPress={() => onDecrement(producto, isPromo)} style={{ borderWidth: 0, borderRadius: 0 }} />
    <WText accessibilityLiveRegion="polite" style={{ color: c.ink, flex: 1, textAlign: 'center', fontSize: 13 }}>{qty}</WText>
    <WButton colors={c} Icon={Plus} label={`Añadir uno de ${producto.nombre}`} disabled={locked || !available || limit} onPress={add} primary style={{ borderWidth: 0, borderRadius: 0 }} />
  </View> : <WButton colors={c} Icon={locked ? LockKeyhole : canAdd ? Plus : ArrowUpRight} label={locked ? `Envío pendiente, ${producto.nombre}` : canAdd ? `Añadir ${producto.nombre}` : `Elegir destino para ${producto.nombre}`} disabled={locked || !available || limit} onPress={add} primary={canAdd && !locked && available && !limit} style={list ? { paddingHorizontal: 14 } : undefined}>{locked ? 'Envío pendiente' : !available ? 'Agotado' : canAdd ? 'Añadir' : 'Elegir destino'}</WButton>;
  return <View style={{ width: cardWidth, minWidth: 0, backgroundColor: c.surface, borderWidth: 1, borderColor: qty > 0 ? c.brand : c.line, borderRadius: 6, overflow: 'hidden' }}>
    {!list ? art : null}
    <View style={{ padding: 12, gap: 10, flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        {list && !tight ? art : null}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><WText numberOfLines={1} style={{ color: isPromo ? c.promotion : c.muted, fontSize: 10 }}>{isPromo ? 'Promoción' : categoryText}</WText><WText numberOfLines={2} style={{ color: c.ink, fontSize: 14, lineHeight: 20, minHeight: list ? undefined : 40 }}>{producto.nombre}</WText>{showDescription && producto.descripcion ? <WText numberOfLines={2} style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>{producto.descripcion}</WText> : null}</View>
        {list && !tight ? <WText style={{ color: c.ink, fontSize: 16, fontVariant: ['tabular-nums'] }}>{price}</WText> : null}
      </View>
      {!list || tight ? <WText style={{ color: c.ink, fontSize: 20, fontVariant: ['tabular-nums'] }}>{price}</WText> : null}
      <View style={{ flexDirection: list && !tight ? 'row' : 'column', alignItems: list && !tight ? 'center' : 'stretch', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>{stockLabel ? <WText numberOfLines={list ? 2 : 1} style={{ color: !available ? c.danger : c.muted, fontSize: 10, flexShrink: 1 }}>{stockLabel}</WText> : <View />}{controls}</View>
    </View>
  </View>;
});
