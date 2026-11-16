import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown, ScrollText } from 'lucide-react-native';
import { Badge, Button, Card, EmptyState, FadeIn, PageHeader, Press, SearchField, Segmented, Skeleton, Tabs, money as fmtMoney, space, type, radius } from '../components/admin/ui';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import {
  AUDIT_FILTERS,
  auditActionLabel,
  auditCustomer,
  auditGroup,
  auditStats,
  filterAuditRows,
} from '../utils/auditLogic.mjs';

const RANGE_FILTERS = [
  { key: 'HOY', label: 'Hoy' },
  { key: '7D', label: '7 días' },
  { key: '30D', label: '30 días' },
  { key: 'TODO', label: 'Todo' },
];

const roleNames = {
  admin: 'Administración',
  mesero: 'Mesero',
  cocina: 'Cocina',
  caja: 'Caja',
};

const money = value => `$${Number(value || 0).toLocaleString('es-EC', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function dateParts(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return { date: 'Sin fecha', time: '' };
  return {
    date: date.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
  };
}

function capitalize(value) {
  const text = String(value || '').trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}` : '';
}

function actorLines(record) {
  const actor = record.trabajador_nombre || 'Sistema';
  const lines = [{ label: actor, detail: roleNames[record.rol] || capitalize(record.rol) || 'Proceso automático' }];
  if (record.mesero_nombre && record.mesero_nombre !== actor) {
    lines.push({ label: record.mesero_nombre, detail: 'Atendió el pedido' });
  }
  if (record.cajero_nombre && record.cajero_nombre !== actor && record.cajero_nombre !== record.mesero_nombre) {
    lines.push({ label: record.cajero_nombre, detail: 'Registró el cobro' });
  }
  return lines;
}

function customerLines(record) {
  const customer = auditCustomer(record);
  const invoiceName = String(record.factura_cliente || '').trim();
  const invoiceDocument = String(record.factura_documento || record.cliente_documento || '').trim();
  const lines = [];
  if (customer) lines.push(customer);
  if (invoiceName && invoiceName !== customer) lines.push(`Factura: ${invoiceName}`);
  if (invoiceDocument) lines.push(`Documento: ${invoiceDocument}`);
  return lines.length ? lines : ['No aplica'];
}

function referenceLines(record) {
  const lines = [];
  const orderId = record.pedido_id || record.metadata?.pedido_id;
  if (orderId) lines.push(`Pedido #${orderId}`);
  if (record.mesa_numero) lines.push(`Mesa ${record.mesa_numero}`);
  if (record.canal && !record.mesa_numero) lines.push(capitalize(record.canal));
  if (record.comprobante_numero) lines.push(`Comprobante ${record.comprobante_numero}`);
  if (!lines.length && record.entidad_id) lines.push(`${capitalize(record.entidad)} #${record.entidad_id}`);
  return lines.length ? lines : ['Sin referencia'];
}

function detailLines(record) {
  const metadata = record.metadata || {};
  const lines = [];
  if (metadata.monto !== undefined && metadata.monto !== null) lines.push(money(metadata.monto));
  if (metadata.metodo) lines.push(capitalize(metadata.metodo));
  if (metadata.tipo) lines.push(capitalize(metadata.tipo));
  if (metadata.motivo) lines.push(`Motivo: ${metadata.motivo}`);
  if (metadata.observacion) lines.push(metadata.observacion);
  if (metadata.estado_anterior || metadata.estado_nuevo) {
    lines.push(`${metadata.estado_anterior || '—'} → ${metadata.estado_nuevo || '—'}`);
  }
  return lines.length ? lines : ['—'];
}

const hhmm = v => { const d = new Date(v || 0); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const RESERVATION_ACTIONS = { 'reserva.creada': 'Reserva creada', 'reserva.actualizada': 'Reserva modificada', 'reserva.estado': 'Cambio de estado de reserva', 'reserva.eliminada': 'Reserva eliminada' };
const actionLabel = accion => RESERVATION_ACTIONS[accion] || auditActionLabel(accion);
const GROUP_TONE = { VENTAS: 'green', PEDIDOS: 'sky', CAJA: 'amber', CATALOGO: 'neutral', ADMIN: 'neutral', REVERSOS: 'red' };
const GROUP_LABEL = { VENTAS: 'Venta', PEDIDOS: 'Pedido', CAJA: 'Caja', CATALOGO: 'Catálogo', ADMIN: 'Administración', REVERSOS: 'Anulación' };

function dayLabel(value) {
  const d = new Date(value || 0);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return capitalize(d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }));
}

// Fila de la bitácora: hora, tipo, acción y responsable; se expande para ver el detalle completo.
function Event({ record, c, phone, first }) {
  const [open, setOpen] = useState(false);
  const when = dateParts(record.created_at);
  const action = actionLabel(record.accion);
  const group = auditGroup(record);
  const people = actorLines(record);
  const refs = referenceLines(record);
  const details = detailLines(record);
  const amount = record.metadata?.monto;
  const reversal = group === 'REVERSOS';
  return <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: c.line, backgroundColor: open ? c.surfaceAlt : c.surface }}>
    <Press scaleTo={1} onPress={() => setOpen(v => !v)} accessibilityRole="button" accessibilityLabel={`${action}. ${open ? 'Ocultar' : 'Ver'} detalle`} accessibilityState={{ expanded: open }}
      style={{ flexDirection: 'row', alignItems: phone ? 'flex-start' : 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 48, paddingVertical: 8 }}
      hoverStyle={{ backgroundColor: c.surfaceAlt }}>
      <Text numberOfLines={1} style={[type.body, type.num, { color: c.muted, width: 44 }]}>{hhmm(record.created_at)}</Text>
      {!phone ? <View style={{ width: 120 }}><Badge tone={GROUP_TONE[group] || 'neutral'}>{GROUP_LABEL[group] || 'Otro'}</Badge></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={open ? undefined : 1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{action}</Text>
        <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{people[0].label} · {refs.join(' · ')}</Text>
      </View>
      {amount !== undefined && amount !== null ? <Text style={[type.body, type.num, { color: reversal ? c.red : c.text, fontWeight: '600' }]}>{reversal ? '−' : ''}{fmtMoney(amount)}</Text> : null}
      <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><ChevronDown size={16} color={c.muted} /></View>
    </Press>
    {open ? <FadeIn duration={140} offset={2}><View style={{ paddingLeft: phone ? space.md : space.md + 44 + space.md, paddingRight: space.md, paddingBottom: space.md, gap: 6 }}>
      {!!record.descripcion && record.descripcion !== action ? <Text style={[type.body, { color: c.text }]}>{record.descripcion}</Text> : null}
      {[['Responsable', people.map(p => `${p.label} (${p.detail})`).join(' · ')], ['Cliente', customerLines(record).join(' · ')], ['Referencia', refs.join(' · ')], ['Detalle', details.join(' · ')], ['Fecha', `${when.date}, ${when.time}`]]
        .filter(([, v]) => v && v !== '—' && v !== 'No aplica').map(([k, v]) => <View key={k} style={{ flexDirection: 'row', gap: space.md }}>
          <Text style={[type.body, { color: c.muted, width: 96 }]}>{k}</Text><Text style={[type.body, { color: c.text, flex: 1 }]}>{v}</Text></View>)}
    </View></FadeIn> : null}
  </View>;
}

export default function AuditScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const phone = width < 600;
  const { auditoria, loading } = useAdmin();
  const [range, setRange] = useState('TODO');
  const [group, setGroup] = useState('TODOS');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(50);

  useEffect(() => setVisibleLimit(50), [range, group, query]);

  const rows = useMemo(() => filterAuditRows(auditoria, { range, group, query }), [auditoria, range, group, query]);
  const stats = useMemo(() => auditStats(rows), [rows]);
  const days = useMemo(() => {
    const out = [];
    rows.slice(0, visibleLimit).forEach(r => {
      const label = dayLabel(r.created_at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(r);
    });
    return out;
  }, [rows, visibleLimit]);

  return <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
    <PageHeader title="Auditoría" description={`${stats.events} movimientos · ${money(stats.sales)} en cobros · ${stats.users} responsables · ${stats.reversals} anulaciones o devoluciones`} />
    <Card padded={false}>
      <View style={{ padding: space.sm, gap: space.sm, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Tabs value={group} onChange={setGroup} options={AUDIT_FILTERS.map(f => ({ value: f.key, label: f.label }))} />
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.sm, alignItems: compact ? 'stretch' : 'center' }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Buscar usuario, cliente, pedido o acción" style={compact ? null : { flex: 1, maxWidth: 420 }} />
          <Segmented value={range} onChange={setRange} accessibilityLabel="Periodo" options={RANGE_FILTERS.map(r => ({ value: r.key, label: r.label }))} />
        </View>
      </View>
      {loading && !auditoria.length ? <View style={{ gap: space.sm, padding: space.lg }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={40} radius={8} />)}</View>
        : !rows.length ? <EmptyState icon={ScrollText} title="No hay movimientos con estos filtros" description="Prueba otro periodo o quita el texto de búsqueda."
          action={<Button onPress={() => { setQuery(''); setRange('TODO'); setGroup('TODOS'); }}>Quitar filtros</Button>} />
        : <FadeIn trigger={`${range}-${group}`}>
          {days.map((day, di) => <View key={day.label}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 36, backgroundColor: c.surfaceAlt, borderTopWidth: di ? 1 : 0, borderBottomWidth: 1, borderColor: c.line }}>
              <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{day.label}</Text>
              <Text style={[type.body, { color: c.muted }]}>{day.items.length} {day.items.length === 1 ? 'movimiento' : 'movimientos'}</Text>
            </View>
            {day.items.map((r, i) => <Event key={r.id} record={r} c={c} phone={phone} first={i === 0} />)}
          </View>)}
          {rows.length > visibleLimit ? <View style={{ padding: space.md, borderTopWidth: 1, borderTopColor: c.line, alignItems: 'center' }}>
            <Button variant="plain" onPress={() => setVisibleLimit(v => v + 50)}>{`Mostrar ${Math.min(50, rows.length - visibleLimit)} más · quedan ${rows.length - visibleLimit}`}</Button>
          </View> : null}
        </FadeIn>}
    </Card>
  </ScrollView>;
}
