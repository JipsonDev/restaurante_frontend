import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown, ScrollText } from 'lucide-react-native';
import { Button, EmptyState, FadeIn, PageHeader, Press, SearchField, Segmented, Skeleton, Tabs, space, type, radius } from '../components/admin/ui';
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
const GROUP_TONE = { VENTAS: 'green', PEDIDOS: 'sky', CAJA: 'amber', CATALOGO: 'gold', ADMIN: 'neutral', REVERSOS: 'red' };

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

// Un evento en la línea de tiempo: punto del grupo, hora, acción y quién; se expande para ver el detalle.
function Event({ record, c, last }) {
  const [open, setOpen] = useState(false);
  const when = dateParts(record.created_at);
  const action = auditActionLabel(record.accion);
  const tone = GROUP_TONE[auditGroup(record)] || 'neutral';
  const dot = { green: c.green, sky: c.sky, amber: c.amber, gold: c.primary, red: c.red, neutral: c.faint }[tone];
  const people = actorLines(record);
  const refs = referenceLines(record);
  const details = detailLines(record);
  const amount = record.metadata?.monto;
  return <View style={{ flexDirection: 'row' }}>
    <View style={{ width: 48, paddingTop: 13 }}><Text numberOfLines={1} style={[type.small, type.num, { color: c.faint }]}>{hhmm(record.created_at)}</Text></View>
    <View style={{ width: 20, alignItems: 'center' }}>
      <View style={{ width: 1, flex: 1, backgroundColor: c.line, position: 'absolute', top: 0, bottom: last ? '60%' : 0 }} />
      <View style={{ marginTop: 17, width: 9, height: 9, borderRadius: 5, backgroundColor: dot, borderWidth: 2, borderColor: c.bg }} />
    </View>
    <Press scaleTo={0.995} onPress={() => setOpen(v => !v)} accessibilityLabel={`${action}. ${open ? 'Ocultar' : 'Ver'} detalle`} accessibilityState={{ expanded: open }}
      style={({ hovered }) => ({ flex: 1, minWidth: 0, marginLeft: space.sm, marginVertical: 2, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md, backgroundColor: open ? c.surface : hovered ? c.surfaceAlt : 'transparent', borderWidth: 1, borderColor: open ? c.line : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={open ? undefined : 1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{action}</Text>
          <Text numberOfLines={1} style={[type.small, { color: c.muted }]}>{people[0].label} · {refs.join(' · ')}</Text>
        </View>
        {amount !== undefined && amount !== null ? <Text style={[type.body, type.num, { color: tone === 'red' ? c.red : c.text, fontWeight: '600' }]}>{tone === 'red' ? '−' : ''}{money(amount)}</Text> : null}
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><ChevronDown size={16} color={c.faint} /></View>
      </View>
      {open ? <FadeIn trigger="open" duration={160} offset={3}><View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: c.line, gap: space.sm }}>
        {!!record.descripcion && record.descripcion !== action ? <Text style={[type.small, { color: c.text }]}>{record.descripcion}</Text> : null}
        {[['Responsable', people.map(p => `${p.label} (${p.detail})`).join(' · ')], ['Cliente', customerLines(record).join(' · ')], ['Referencia', refs.join(' · ')], ['Detalle', details.join(' · ')], ['Fecha', `${when.date}, ${when.time}`]]
          .filter(([, v]) => v && v !== '—' && v !== 'No aplica').map(([k, v]) => <View key={k} style={{ flexDirection: 'row', gap: space.md }}>
            <Text style={[type.small, { color: c.faint, width: 92 }]}>{k}</Text><Text style={[type.small, { color: c.text, flex: 1 }]}>{v}</Text></View>)}
      </View></FadeIn> : null}
    </Press>
  </View>;
}

export default function AuditScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const { auditoria, loading } = useAdmin();
  const [range, setRange] = useState('TODO');
  const [group, setGroup] = useState('TODOS');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(40);

  useEffect(() => setVisibleLimit(40), [range, group, query]);

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
    <Tabs value={group} onChange={setGroup} style={{ marginBottom: space.lg }} options={AUDIT_FILTERS.map(f => ({ value: f.key, label: f.label }))} />
    <View style={{ flexDirection: compact ? 'column' : 'row', gap: space.md, marginBottom: space.lg, alignItems: compact ? 'stretch' : 'center' }}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Buscar usuario, cliente, pedido o acción…" style={compact ? null : { flex: 1, minWidth: 260, maxWidth: 420 }} />
      <Segmented size="sm" value={range} onChange={setRange} accessibilityLabel="Periodo" options={RANGE_FILTERS.map(r => ({ value: r.key, label: r.label }))} />
    </View>
    {loading && !auditoria.length ? <View style={{ gap: space.sm }}>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} height={52} radius={10} />)}</View>
      : !rows.length ? <EmptyState icon={ScrollText} title="No hay movimientos con estos filtros" description="Prueba otro periodo o quita el texto de búsqueda."
        action={<Button onPress={() => { setQuery(''); setRange('TODO'); setGroup('TODOS'); }}>Quitar filtros</Button>} />
      : <FadeIn trigger={`${range}-${group}`} duration={180} offset={4}><View style={{ maxWidth: 920 }}>
        {days.map(day => <View key={day.label} style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.xs }}>
            <Text style={[type.h3, { color: c.text }]}>{day.label}</Text>
            <Text style={[type.small, { color: c.faint }]}>{day.items.length} {day.items.length === 1 ? 'movimiento' : 'movimientos'}</Text>
          </View>
          {day.items.map((r, i) => <Event key={r.id} record={r} c={c} last={i === day.items.length - 1} />)}
        </View>)}
        {rows.length > visibleLimit ? <Button variant="ghost" onPress={() => setVisibleLimit(v => v + 40)}>Mostrar {Math.min(40, rows.length - visibleLimit)} más de {rows.length - visibleLimit} restantes</Button> : null}
      </View></FadeIn>}
  </ScrollView>;
}
