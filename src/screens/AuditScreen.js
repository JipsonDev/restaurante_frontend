import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { RefreshCw, Search } from 'lucide-react-native';
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

function groupColor(group, c) {
  return ({
    VENTAS: c.green,
    PEDIDOS: c.sky,
    CAJA: c.amber,
    CATALOGO: c.primaryText,
    ADMIN: c.muted,
    REVERSOS: c.red,
  })[group] || c.muted;
}

function Lines({ values, color, secondaryColor, size = 12 }) {
  return <View style={{ gap: 3 }}>
    {values.map((value, index) => (
      <Text key={`${value}-${index}`} style={{ color: index === 0 ? color : secondaryColor, fontSize: size, lineHeight: 18 }}>
        {value}
      </Text>
    ))}
  </View>;
}

function TableHeader({ c }) {
  const columns = [
    ['FECHA', 1.05],
    ['ACCIÓN', 2.15],
    ['RESPONSABLE', 1.75],
    ['CLIENTE', 1.65],
    ['REFERENCIA', 1.65],
    ['DETALLE', 1.35],
  ];
  return <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line }}>
    {columns.map(([label, flex]) => (
      <Text key={label} style={{ flex, minWidth: 0, paddingHorizontal: 12, paddingVertical: 10, color: c.faint, fontSize: 10, letterSpacing: 0.8 }}>
        {label}
      </Text>
    ))}
  </View>;
}

function DesktopRow({ record, c, index }) {
  const when = dateParts(record.created_at);
  const action = auditActionLabel(record.accion);
  const group = auditGroup(record);
  return <View style={{ flexDirection: 'row', backgroundColor: index % 2 ? c.surfaceAlt : c.surface, borderBottomWidth: 1, borderBottomColor: c.line }}>
    <View style={{ flex: 1.05, minWidth: 0, padding: 12 }}>
      <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{when.date}</Text>
      <Text style={{ color: c.faint, fontSize: 11, lineHeight: 17 }}>{when.time}</Text>
    </View>
    <View style={{ flex: 2.15, minWidth: 0, padding: 12, flexDirection: 'row', gap: 9 }}>
      <View style={{ width: 3, minHeight: 34, backgroundColor: groupColor(group, c) }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 13, lineHeight: 19 }}>{action}</Text>
        {!!record.descripcion && record.descripcion !== action && (
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17 }}>{record.descripcion}</Text>
        )}
      </View>
    </View>
    <View style={{ flex: 1.75, minWidth: 0, padding: 12 }}>
      {actorLines(record).map((person, personIndex) => (
        <View key={`${person.label}-${personIndex}`} style={{ marginBottom: personIndex < actorLines(record).length - 1 ? 6 : 0 }}>
          <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{person.label}</Text>
          <Text style={{ color: c.faint, fontSize: 10, lineHeight: 15 }}>{person.detail}</Text>
        </View>
      ))}
    </View>
    <View style={{ flex: 1.65, minWidth: 0, padding: 12 }}><Lines values={customerLines(record)} color={c.text} secondaryColor={c.faint} /></View>
    <View style={{ flex: 1.65, minWidth: 0, padding: 12 }}><Lines values={referenceLines(record)} color={c.text} secondaryColor={c.faint} /></View>
    <View style={{ flex: 1.35, minWidth: 0, padding: 12 }}><Lines values={detailLines(record)} color={c.text} secondaryColor={c.faint} /></View>
  </View>;
}

function MobileRow({ record, c }) {
  const when = dateParts(record.created_at);
  const action = auditActionLabel(record.accion);
  const people = actorLines(record);
  const refs = referenceLines(record);
  const details = detailLines(record);
  return <View style={{ paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.line, gap: 9 }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
      <View style={{ width: 3, alignSelf: 'stretch', minHeight: 34, backgroundColor: groupColor(auditGroup(record), c) }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{action}</Text>
        <Text style={{ color: c.faint, fontSize: 11, lineHeight: 17 }}>{when.date} · {when.time}</Text>
      </View>
    </View>
    <View style={{ paddingLeft: 12, gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
        {people.map(person => `${person.label} · ${person.detail}`).join('  /  ')}
      </Text>
      <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{refs.join(' · ')}</Text>
      {auditCustomer(record) ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Cliente: {customerLines(record).join(' · ')}</Text> : null}
      {details[0] !== '—' ? <Text style={{ color: c.text, fontSize: 12, lineHeight: 18 }}>{details.join(' · ')}</Text> : null}
      {!!record.descripcion && record.descripcion !== action ? <Text style={{ color: c.faint, fontSize: 11, lineHeight: 17 }}>{record.descripcion}</Text> : null}
    </View>
  </View>;
}

function TextTabs({ items, value, onChange, c }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20 }}>
    {items.map(item => {
      const selected = item.key === value;
      return <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(item.key)}
        style={{ paddingVertical: 9, borderBottomWidth: selected ? 2 : 1, borderBottomColor: selected ? c.primary : 'transparent' }}
      >
        <Text style={{ color: selected ? c.text : c.muted, fontSize: 12 }}>{item.label}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

export default function AuditScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const { auditoria, loading, fetchAuditoria } = useAdmin();
  const [range, setRange] = useState('TODO');
  const [group, setGroup] = useState('TODOS');
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => setVisibleLimit(40), [range, group, query]);

  const rows = useMemo(
    () => filterAuditRows(auditoria, { range, group, query }),
    [auditoria, range, group, query],
  );
  const stats = useMemo(() => auditStats(rows), [rows]);

  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await fetchAuditoria({ limit: 200 });
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 28 }}>
    <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'flex-start', gap: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: compact ? 25 : 29, lineHeight: compact ? 32 : 36 }}>Auditoría</Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
          Registro cronológico de ventas, pedidos y cambios administrativos.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Actualizar auditoría"
        disabled={refreshing}
        onPress={refresh}
        style={({ hovered }) => ({
          minHeight: 38,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: hovered ? c.surfaceAlt : c.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          alignSelf: compact ? 'flex-start' : 'auto',
        })}
      >
        {refreshing ? <ActivityIndicator size="small" color={c.primaryText} /> : <RefreshCw size={15} color={c.muted} />}
        <Text style={{ color: c.text, fontSize: 12 }}>{refreshing ? 'Actualizando' : 'Actualizar'}</Text>
      </Pressable>
    </View>

    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
      {stats.events} movimientos · {money(stats.sales)} en cobros · {stats.users} responsables · {stats.reversals} anulaciones o devoluciones
    </Text>

    <View style={{ paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 14, alignItems: compact ? 'stretch' : 'center' }}>
        <View style={{ minHeight: 42, flex: 1, minWidth: 220, maxWidth: compact ? undefined : 520, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Search size={16} color={c.faint} />
          <TextInput
            accessibilityLabel="Buscar en auditoría"
            placeholder="Buscar usuario, cliente, pedido o acción"
            placeholderTextColor={c.faint}
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, minWidth: 0, color: c.text, fontSize: 13, paddingVertical: 9 }}
          />
        </View>
        <TextTabs items={RANGE_FILTERS} value={range} onChange={setRange} c={c} />
      </View>
      <TextTabs items={AUDIT_FILTERS} value={group} onChange={setGroup} c={c} />
    </View>

    <View style={{ paddingTop: 14 }}>
      <Text style={{ color: c.muted, fontSize: 11, marginBottom: 9 }}>
        {rows.length} {rows.length === 1 ? 'registro encontrado' : 'registros encontrados'}
      </Text>
      {compact ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
          {rows.slice(0, visibleLimit).map(record => <MobileRow key={record.id} record={record} c={c} />)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, width: '100%', minWidth: 1040, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.line }}>
            <TableHeader c={c} />
            {rows.slice(0, visibleLimit).map((record, index) => <DesktopRow key={record.id} record={record} c={c} index={index} />)}
          </View>
        </ScrollView>
      )}

      {!rows.length && (
        <View style={{ paddingVertical: 34, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
          <Text style={{ color: c.text, fontSize: 14 }}>No hay movimientos con estos filtros.</Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>Prueba otro periodo o elimina el texto de búsqueda.</Text>
        </View>
      )}

      {rows.length > visibleLimit && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleLimit(value => value + 40)}
          style={({ hovered }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: hovered ? c.surfaceAlt : 'transparent' })}
        >
          <Text style={{ color: c.primaryText, fontSize: 12, textAlign: 'center' }}>Mostrar 40 registros más</Text>
        </Pressable>
      )}
    </View>
  </ScrollView>;
}
