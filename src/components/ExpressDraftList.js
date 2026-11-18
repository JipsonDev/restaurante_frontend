// Pedidos Express a medias (para llevar y delivery) guardados en este teléfono.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { FileText, ShoppingBag, Trash2, Truck } from 'lucide-react-native';
import { useTheme } from '../theme';
import { Button, EmptyState, Field, IconButton, Num, Press, T, money, radius, space } from './waiter/kit';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ExpressDraftList({ drafts, onOpen, onDiscard }) {
  const { c } = useTheme();
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);
  const entries = Object.entries(drafts.expressDrafts);
  const filtered = useMemo(() => entries.filter(([, meta]) => normalize(`${meta.expressInfo.nombre} ${meta.expressInfo.telefono} ${meta.expressInfo.direccion} ${meta.pickupType}`).includes(normalize(query))), [drafts.expressDrafts, query]);
  const discard = async key => {
    setBusy(key);
    try { await onDiscard(key); setConfirm(null); } finally { setBusy(null); }
  };
  return <View style={{ gap: space.sm }}>
    {entries.length > 3 ? <Field value={query} onChangeText={setQuery} placeholder="Buscar por cliente o teléfono" accessibilityLabel="Buscar pedidos Express guardados" /> : null}
    {!filtered.length ? <EmptyState icon={FileText} title={entries.length ? 'Ninguno con esa búsqueda' : 'No hay pedidos Express a medias'}
      description={entries.length ? null : 'Si empiezas un pedido para llevar y no lo envías, queda guardado aquí.'}
      action={query ? <Button onPress={() => setQuery('')}>Ver todos</Button> : null} /> : null}
    {filtered.map(([key, meta]) => {
      const name = meta.expressInfo.nombre.trim() || 'Cliente sin nombre';
      const delivery = meta.pickupType === 'Delivery';
      const items = drafts.carritos[key] || [];
      const count = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
      const subtotal = items.reduce((sum, item) => sum + (Number(item.precio || 0) + (item.modificadores || []).reduce((extra, mod) => extra + Number(mod.precio_extra || 0), 0)) * Number(item.cantidad || 0), 0);
      const pending = !!drafts.pending[key];
      return <View key={key} style={{ borderRadius: radius.lg, backgroundColor: c.surfaceAlt, borderWidth: pending ? 2 : 0, borderColor: c.amber, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.sm }}>
          <Press accessibilityRole="button" accessibilityLabel={`Continuar el pedido de ${name}, ${delivery ? 'delivery' : 'para llevar'}`} onPress={() => onOpen(key)} hapticKind="tap"
            style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              {delivery ? <Truck size={19} color={c.text} /> : <ShoppingBag size={19} color={c.text} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} weight="800" numberOfLines={1}>{name}</T>
              <T size={14} color={pending ? c.amber : c.muted} weight={pending ? '700' : '400'} numberOfLines={1}>{pending ? 'Sin enviar a cocina · se reintenta sola' : `${delivery ? 'Delivery' : 'Para llevar'} · ${count} ${count === 1 ? 'producto' : 'productos'}`}</T>
            </View>
            {count ? <Num size={16} weight="800">{money(subtotal)}</Num> : null}
          </Press>
          {!pending ? <IconButton icon={Trash2} label={`Eliminar el pedido guardado de ${name}`} onPress={() => setConfirm(confirm === key ? null : key)} size={44} /> : null}
        </View>
        {confirm === key ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingTop: 0, flexWrap: 'wrap' }}>
          <T size={14} color={c.muted} style={{ flex: 1, minWidth: 160 }}>¿Eliminar este pedido guardado? No se puede deshacer.</T>
          <Button size="sm" disabled={busy === key} onPress={() => setConfirm(null)}>Conservar</Button>
          <Button size="sm" variant="ink" loading={busy === key} onPress={() => discard(key)} accessibilityLabel={`Confirmar eliminar el pedido guardado de ${name}`}>Eliminar</Button>
        </View> : null}
      </View>;
    })}
  </View>;
}
