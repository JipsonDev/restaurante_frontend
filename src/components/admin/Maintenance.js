// Ajustes › Mantenimiento: estado de la base (intercalación unificada) y limpieza de cuentas abandonadas.
// Nada se borra: las cuentas elegidas se marcan como canceladas con la misma lógica que una cancelación
// normal (libera mesa, reservas e inventario) y queda registro en auditoría. Las que tienen pagos se excluyen.
import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import axios from 'axios';
import { Archive, Database, RefreshCw } from 'lucide-react-native';
import { BASE_URL } from '../../context/AuthContext';
import { useTheme } from '../../theme';
import { MenuModal, MenuButton } from '../MenuUI';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Segmented, Skeleton, money, space, type, useToast } from './ui';

const errorText = error => error.response?.data?.detail || error.response?.data?.message || error.message || 'No se pudo completar la operación.';
const when = value => { const d = new Date(String(value).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }); };
const daysAgo = value => { const d = new Date(String(value).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000); };
const target = o => o.mesa_numero != null ? `Mesa ${o.mesa_numero}` : `${o.tipo === 'Delivery' ? 'Delivery' : 'Para llevar'}${o.cliente_nombre ? ` · ${o.cliente_nombre}` : ''}`;

function DatabaseCard() {
  const { c } = useTheme();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setError(''); const { data } = await axios.get(`${BASE_URL}/configuracion/mantenimiento/base`); setReport(data); }
    catch (e) { setError(errorText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const fix = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/configuracion/mantenimiento/base`);
      setReport(data.report);
      if (data.failed?.length) toast?.show?.(`${data.failed.length} ${data.failed.length === 1 ? 'tabla no se pudo convertir' : 'tablas no se pudieron convertir'}`, 'red');
      else toast?.show?.(data.converted?.length ? `Intercalación unificada en ${data.converted.length} ${data.converted.length === 1 ? 'tabla' : 'tablas'}` : 'La base ya estaba unificada', 'green');
    } catch (e) { toast?.show?.(errorText(e), 'red'); }
    finally { setBusy(false); }
  };
  return <Card title="Base de datos" description="Toda la base usa una sola intercalación (utf8mb4_unicode_ci). Así no aparece el error «Illegal mix of collations». Se revisa sola al iniciar el servidor."
    actions={report && !report.ok ? <Button variant="primary" icon={RefreshCw} loading={busy} onPress={fix}>Unificar ahora</Button> : <Button variant="plain" icon={RefreshCw} onPress={load}>Revisar</Button>}>
    {error ? <Banner tone="critical" title="No se pudo revisar la base">{error}</Banner>
      : !report ? <Skeleton height={44} radius={8} />
      : report.ok ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Badge tone="success">Unificada</Badge>
        <Text style={[type.body, { color: c.muted }]}>Base, tablas y columnas de texto en {report.target}.</Text>
      </View>
      : <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          {report.tables.length ? <Badge tone="warning">{`${report.tables.length} ${report.tables.length === 1 ? 'tabla pendiente' : 'tablas pendientes'}`}</Badge> : null}
          {!report.database.ok ? <Badge tone="warning">{`Base: ${report.database.collation || 'desconocida'}`}</Badge> : null}
        </View>
        {report.tables.length ? <Text style={[type.body, { color: c.muted }]}>{report.tables.join(', ')}</Text> : null}
      </View>}
  </Card>;
}

function AbandonedCard() {
  const { c } = useTheme();
  const toast = useToast();
  const [days, setDays] = useState('15');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // filas a cerrar
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data: next } = await axios.get(`${BASE_URL}/pedidos/mantenimiento/abandonados`, { params: { dias: days } }); setData(next); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);
  const closable = (data?.items || []).filter(o => o.cerrable);
  const run = async () => {
    setBusy(true);
    try {
      const { data: res } = await axios.post(`${BASE_URL}/pedidos/mantenimiento/abandonados/cerrar`, { ids: confirm.map(o => o.id), dias: Number(days) });
      toast?.show?.(res.message, res.cerradas?.length ? 'green' : 'red');
      if (res.omitidas?.length) toast?.show?.(`${res.omitidas.length} sin cerrar: ${res.omitidas[0].motivo}`, 'red');
      setConfirm(null); await load();
    } catch (e) { toast?.show?.(errorText(e), 'red'); }
    finally { setBusy(false); }
  };
  const total = (confirm || []).reduce((s, o) => s + Number(o.total || 0), 0);
  return <Card padded={false} title="Cuentas abandonadas" description="Cuentas abiertas sin actividad desde hace varios días (suelen ser pedidos de prueba). Dejan mesas ocupadas y ensucian los reportes."
    actions={<View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <Segmented accessibilityLabel="Días sin actividad" value={days} onChange={setDays} options={[{ value: '7', label: '7 días' }, { value: '15', label: '15 días' }, { value: '30', label: '30 días' }]} />
      {closable.length ? <Button variant="primary" icon={Archive} onPress={() => setConfirm(closable)}>{`Cerrar ${closable.length}`}</Button> : null}
    </View>}>
    {error ? <View style={{ padding: space.lg }}><Banner tone="critical" title="No se pudo revisar">{error}</Banner></View>
      : loading && !data ? <View style={{ padding: space.lg }}><Skeleton height={120} radius={8} /></View>
      : <>
        {data?.con_pagos ? <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}><Banner tone="warning" title={`${data.con_pagos} con pagos registrados`}>No se cierran aquí: resuélvelas desde Caja para no perder el registro del cobro.</Banner></View> : null}
        <DataTable bare rows={data?.items || []} keyOf={o => o.id} selectable
          bulkActions={[{ label: 'Cerrar seleccionadas', onPress: rows => setConfirm(rows.filter(o => o.cerrable)) }]}
          defaultSort={{ key: 'u', dir: 1 }}
          columns={[
            { key: 'a', label: 'Cuenta', flex: 1.6, render: o => <View style={{ minWidth: 0 }}>
              <Text numberOfLines={1} style={[type.body, { color: c.text, fontWeight: '600' }]}>{target(o)} · #{o.id}</Text>
              <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>Abierta el {when(o.created_at)}</Text></View> },
            { key: 'u', label: 'Sin actividad', width: 120, sortValue: o => -Number(daysAgo(o.ultima_actividad) || 0), render: o => <Text style={[type.body, type.num, { color: c.text }]}>{daysAgo(o.ultima_actividad) ?? '—'} días</Text> },
            { key: 's', label: 'Estado', width: 120, render: o => o.cerrable ? <Badge tone="neutral">Abierta</Badge> : <Badge tone="warning">Con pagos</Badge> },
            { key: 't', label: 'Total', width: 100, align: 'right', sortValue: o => Number(o.total || 0), render: o => <Text style={[type.body, type.num, { color: c.text }]}>{money(o.total)}</Text> },
          ]}
          empty={<EmptyState compact icon={Database} title="Todo en orden" description={`No hay cuentas abiertas con más de ${days} días sin actividad.`} />} />
      </>}
    <MenuModal visible={!!confirm} close={() => !busy && setConfirm(null)} busy={busy} tone="danger" maxWidth={460}
      title={`¿Cerrar ${confirm?.length || 0} ${confirm?.length === 1 ? 'cuenta' : 'cuentas'}?`}
      subtitle={`Se marcarán como canceladas (no se borran) y se liberarán sus mesas, reservas e inventario. Suman ${money(total)}. Queda registrado en auditoría.`}
      footer={<View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' }}>
        <MenuButton onPress={() => setConfirm(null)} disabled={busy}>Volver</MenuButton>
        <MenuButton danger busy={busy} onPress={run}>Cerrar cuentas</MenuButton>
      </View>}>
      <View style={{ gap: 4 }}>{(confirm || []).slice(0, 8).map(o => <Text key={o.id} style={[type.body, { color: c.muted }]}>{target(o)} · #{o.id} · {money(o.total)}</Text>)}
        {(confirm || []).length > 8 ? <Text style={[type.body, { color: c.muted }]}>y {confirm.length - 8} más…</Text> : null}</View>
    </MenuModal>
  </Card>;
}

export default function Maintenance() {
  return <View style={{ gap: space.lg }}>
    <DatabaseCard />
    <AbandonedCard />
  </View>;
}
