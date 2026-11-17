import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ArrowUpRight, FileText, Trash2 } from 'lucide-react-native';
import { WText, WButton, WSearch } from './WaiterUI';
import { draftDeliveryStatus } from '../utils/waiterSync.mjs';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ExpressDraftList({ drafts, colors: c, onOpen, onDiscard }) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(null);
  const entries = Object.entries(drafts.expressDrafts);
  const filtered = useMemo(() => entries.filter(([, meta]) => normalize(`${meta.expressInfo.nombre} ${meta.expressInfo.telefono} ${meta.expressInfo.direccion} ${meta.pickupType}`).includes(normalize(query))), [drafts.expressDrafts, query]);
  const discard = async key => {
    setBusy(key);
    try { await onDiscard(key); setConfirm(null); } finally { setBusy(null); }
  };
  return <View style={{ gap: 10 }}>
    <WText style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Cada cliente tiene sus productos y datos separados. Guardados para tu usuario en este equipo; aún no son pedidos de cocina.</WText>
    {entries.length > 2 ? <WSearch colors={c} label="Buscar borradores Express" placeholder="Cliente, teléfono o dirección" value={query} onChangeText={setQuery} /> : null}
    {!filtered.length ? <View style={{ paddingVertical: 24, alignItems: 'center', gap: 10 }}><FileText size={24} color={c.muted} /><WText style={{ color: c.ink, fontSize: 13 }}>{entries.length ? 'No hay borradores con esta búsqueda' : 'No hay borradores Express guardados'}</WText>{query ? <WButton colors={c} onPress={() => setQuery('')}>Limpiar búsqueda de borradores</WButton> : null}</View> : null}
    {filtered.map(([key, meta]) => {
      const name = meta.expressInfo.nombre.trim() || 'Sin nombre';
      const type = meta.pickupType === 'Delivery' ? 'Delivery' : 'Para llevar';
      const items = drafts.carritos[key] || [];
      const count = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
      const subtotal = items.reduce((sum, item) => sum + (Number(item.precio || 0) + (item.modificadores || []).reduce((extra, mod) => extra + Number(mod.precio_extra || 0), 0)) * Number(item.cantidad || 0), 0);
      const pending = !!drafts.pending[key];
      const deliveryStatus=draftDeliveryStatus({hasDraft:true,pending,saving:drafts.saving,error:drafts.error});
      return <View key={key} style={{ borderWidth: pending ? 2 : 0, borderColor: c.warning, borderRadius: 20, backgroundColor: c.surfaceAlt || c.elevated, padding: 16, gap: 10 }}>
        <View style={{ gap: 5 }}><WText style={{ color: c.ink, fontSize: 15 }}>{name}</WText><WText style={{ color: c.muted, fontSize: 11 }}>{type} · {count} {count === 1 ? 'artículo' : 'artículos'} · subtotal ${subtotal.toFixed(2)}</WText>{meta.expressInfo.telefono || meta.expressInfo.direccion ? <WText numberOfLines={2} style={{ color: c.muted, fontSize: 11 }}>{[meta.expressInfo.telefono, meta.expressInfo.direccion].filter(Boolean).join(' · ')}</WText> : null}<WText style={{ color: pending || deliveryStatus.key==='unsaved' ? c.warning : c.muted, fontSize: 11 }}>{deliveryStatus.label} · {key.slice(-6)}</WText></View>
        {confirm === key ? <View style={{ gap: 10, borderTopWidth: 1, borderColor: c.line, paddingTop: 12 }}><WText style={{ color: c.ink, fontSize: 12 }}>¿Eliminar el borrador de {name}? Se borrarán sus productos y datos de este equipo.</WText><View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><WButton colors={c} disabled={busy === key} onPress={() => setConfirm(null)}>Conservar borrador</WButton><WButton colors={c} disabled={busy === key} label={`Confirmar eliminar borrador de ${name}`} onPress={() => discard(key)} style={{ borderColor: c.danger }}>Eliminar borrador</WButton></View></View> : <View style={{ flexDirection: 'row', gap: 8 }}><WButton colors={c} label={`Continuar borrador ${name}, ${type}, ${key.slice(-6)}`} Icon={ArrowUpRight} onPress={() => onOpen(key)} style={{ flex: 1 }}>{pending ? 'Revisar envío' : 'Continuar'}</WButton><WButton colors={c} disabled={pending} label={`Eliminar borrador de ${name}`} Icon={Trash2} onPress={() => setConfirm(key)} /></View>}
      </View>;
    })}
  </View>;
}
