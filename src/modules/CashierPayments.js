// Libro de comprobantes: cada cobro con su número en rojo, filtros y acciones (ver, reimprimir, anular, devolver).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, FileText, Printer, RefreshCw, RotateCcw, Search, Slash, X } from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL } from '../context/AuthContext';
import { savedPaymentText } from '../utils/paymentReceipt.mjs';
import { Badge, Btn, Dialog, Empty, FONT, IconBtn, Lbl, Num, Press, Serial, Skel, T, WEB, money, r } from '../components/cashier/kit';

const blank = { q: '', desde: '', hasta: '', metodo: '', estado: '', cajero_id: '' };
const METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'QR', 'Vales', 'Otro', 'Mixto'];
const STATE = { ACTIVO: ['Cobrado', 'green'], ANULADO: ['Anulado', 'red'], DEVUELTO: ['Devuelto', 'amber'] };
const PRINT = { ENVIADO: 'Impreso', ERROR: 'Error al imprimir' };
const when = v => { const d = new Date(String(v || '').replace(' ', 'T')); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }); };
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

function Chip({ c, label, on, onPress }) {
  return <Press accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} scaleTo={0.97} hoverStyle={on ? null : { backgroundColor: c.hover }}
    style={{ height: 32, paddingHorizontal: 10, borderRadius: r.md, justifyContent: 'center', borderWidth: 1, borderColor: on ? 'transparent' : c.rule, backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : c.paper }}>
    <T c={c} size={13} weight={on ? '700' : '600'} color={on ? (c.isDark ? c.ink : c.onInk) : c.muted}>{label}</T>
  </Press>;
}

export default function CashierPayments({ c, phone, onReprint, onAuthorize, canAuthorize, busy, version }) {
  const [filters, setFilters] = useState(blank);
  const [applied, setApplied] = useState(blank);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ rows: [], total: 0, pages: 1, cajeros: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailError, setDetailError] = useState('');
  const req = useRef(0), dreq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++req.current; setLoading(true); setError('');
    try { const { data } = await axios.get(`${BASE_URL}/caja/pagos`, { params: { ...applied, page } }); if (seq === req.current) setResult(data); }
    catch (e) { if (seq === req.current) setError(e.response?.data?.message || 'No se pudo cargar el libro de comprobantes.'); }
    finally { if (seq === req.current) setLoading(false); }
  }, [applied, page, version]);
  useEffect(() => { load(); return () => { req.current++; }; }, [load]);
  useEffect(() => () => { dreq.current++; }, []);

  // Los filtros de lista se aplican al tocarlos; el texto se aplica al pulsar Enter o «Buscar».
  const apply = next => { setFilters(next); setApplied(next); setPage(1); };
  const set = (k, v) => apply({ ...filters, [k]: v });
  const openDetail = async id => {
    const seq = ++dreq.current; setDetail(null); setDetailError(''); setDetailOpen(true);
    try { const { data } = await axios.get(`${BASE_URL}/caja/pagos/${id}`); if (seq === dreq.current) setDetail(data); }
    catch (e) { if (seq === dreq.current) setDetailError(e.response?.data?.message || 'No se pudo cargar el comprobante.'); }
  };
  const reprint = async id => { await onReprint(id); load(); };
  const range = filters.desde === today() && filters.hasta === today() ? 'hoy' : filters.desde === daysAgo(6) && filters.hasta === today() ? '7' : !filters.desde && !filters.hasta ? 'todo' : 'otro';
  const dirty = JSON.stringify(applied) !== JSON.stringify(blank);

  const row = p => {
    const [stLabel, stTone] = STATE[p.estado] || [p.estado, 'neutral'];
    const voided = p.estado !== 'ACTIVO';
    return <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line, paddingRight: phone ? 0 : 16 }}><Press accessibilityRole="button" accessibilityLabel={`Comprobante ${p.comprobante_numero || p.id}, ${money(p.monto)}, ${stLabel}. Ver detalle`}
      onPress={() => openDetail(p.id)} scaleTo={0.995} hoverStyle={{ backgroundColor: c.hover }}
      style={{ flex: 1, flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: phone ? 4 : 12, paddingLeft: 16, paddingRight: phone ? 16 : 0, paddingVertical: phone ? 12 : 10 }}>
      {phone ? <>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Serial c={c} value={p.comprobante_numero} size={15} muted={voided} />
          <Num c={c} size={16} weight="800" style={voided ? { textDecorationLine: 'line-through', color: c.faint } : null}>{money(p.monto)}</Num>
        </View>
        <T c={c} size={13} color={c.muted} numberOfLines={1}>{[p.factura_cliente || p.cliente_nombre || 'Consumidor final', p.metodo, when(p.created_at)].join(' · ')}</T>
        <View style={{ flexDirection: 'row', gap: 6 }}><Badge c={c} tone={stTone}>{stLabel}</Badge>{p.impresion_estado === 'ERROR' ? <Badge c={c} tone="red">Error al imprimir</Badge> : null}</View>
      </> : <>
        <View style={{ width: 150 }}><Serial c={c} value={p.comprobante_numero} size={14} muted={voided} /></View>
        <Num c={c} size={13} weight="500" color={c.muted} style={{ width: 110 }}>{when(p.created_at)}</Num>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T c={c} size={14} weight="600" numberOfLines={1}>{p.factura_cliente || p.cliente_nombre || 'Consumidor final'}</T>
          <T c={c} size={12} color={c.faint} numberOfLines={1}>{[p.factura_documento, p.mesa_numero ? `Mesa ${p.mesa_numero}` : p.tipo, `Pedido #${p.pedido_id}`].filter(Boolean).join(' · ')}</T>
        </View>
        <T c={c} size={13} color={c.muted} style={{ width: 100 }} numberOfLines={1}>{p.metodo}</T>
        <T c={c} size={13} color={c.muted} style={{ width: 110 }} numberOfLines={1}>{p.cajero_nombre || '—'}</T>
        <View style={{ width: 96, gap: 3 }}><Badge c={c} tone={stTone}>{stLabel}</Badge>{p.impresion_estado === 'ERROR' ? <T c={c} size={12} color={c.red}>Error al imprimir</T> : null}</View>
        <Num c={c} size={15} weight="800" style={[{ width: 96, textAlign: 'right' }, voided ? { textDecorationLine: 'line-through', color: c.faint } : null]}>{money(p.monto)}</Num>
      </>}
    </Press>{!phone ? <View style={{ marginLeft: 12 }}><IconBtn c={c} icon={Printer} label={`Reimprimir ${p.comprobante_numero || p.id}`} onPress={() => reprint(p.id)} disabled={busy} size={36} /></View> : null}</View>;
  };

  return <View style={{ flex: 1, backgroundColor: c.paper }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T c={c} size={20} weight="800" accessibilityRole="header">Comprobantes</T>
          <T c={c} size={13} color={c.muted}>{loading ? 'Cargando…' : `${result.total} comprobantes · cobrado neto ${money(result.total_activo)}`}</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, minWidth: phone ? undefined : 320 }}>
          <View style={{ flexShrink: 0 }}><Search size={17} color={c.faint} /></View>
          <TextInput value={filters.q} onChangeText={v => setFilters(f => ({ ...f, q: v }))} onSubmitEditing={() => apply(filters)} returnKeyType="search"
            placeholder="Número, cliente o cédula" placeholderTextColor={c.faint} accessibilityLabel="Buscar comprobante"
            style={[{ flex: 1, fontFamily: FONT, fontSize: 15, color: c.text, height: 42 }, WEB ? { outlineStyle: 'none' } : null]} />
          {filters.q ? <IconBtn c={c} icon={X} label="Borrar búsqueda" onPress={() => apply({ ...filters, q: '' })} size={30} /> : null}
        </View>
        <IconBtn c={c} icon={RefreshCw} label="Actualizar" onPress={load} disabled={loading} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
        <Chip c={c} label="Hoy" on={range === 'hoy'} onPress={() => apply({ ...filters, desde: today(), hasta: today() })} />
        <Chip c={c} label="7 días" on={range === '7'} onPress={() => apply({ ...filters, desde: daysAgo(6), hasta: today() })} />
        <Chip c={c} label="Todo" on={range === 'todo'} onPress={() => apply({ ...filters, desde: '', hasta: '' })} />
        <View style={{ width: 1, height: 20, backgroundColor: c.rule, marginHorizontal: 4 }} />
        {[['', 'Todos'], ['ACTIVO', 'Cobrados'], ['ANULADO', 'Anulados'], ['DEVUELTO', 'Devueltos']].map(([v, l]) => <Chip key={v || 'all'} c={c} label={l} on={filters.estado === v} onPress={() => set('estado', v)} />)}
        <View style={{ width: 1, height: 20, backgroundColor: c.rule, marginHorizontal: 4 }} />
        <Chip c={c} label="Cualquier pago" on={!filters.metodo} onPress={() => set('metodo', '')} />
        {METHODS.map(v => <Chip key={v} c={c} label={v} on={filters.metodo === v} onPress={() => set('metodo', filters.metodo === v ? '' : v)} />)}
        {result.cajeros?.length > 1 ? <>
          <View style={{ width: 1, height: 20, backgroundColor: c.rule, marginHorizontal: 4 }} />
          {result.cajeros.map(cj => <Chip key={cj.id} c={c} label={cj.nombre} on={filters.cajero_id === String(cj.id)} onPress={() => set('cajero_id', filters.cajero_id === String(cj.id) ? '' : String(cj.id))} />)}
        </> : null}
        {dirty ? <Btn c={c} size="sm" variant="ghost" icon={X} onPress={() => apply(blank)}>Quitar filtros</Btn> : null}
      </ScrollView>
    </View>
    {!phone ? <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.rule, backgroundColor: c.paperAlt }}>
      <Lbl c={c} style={{ width: 150 }}>N.º</Lbl><Lbl c={c} style={{ width: 110 }}>Fecha</Lbl><Lbl c={c} style={{ flex: 1 }}>Cliente</Lbl>
      <Lbl c={c} style={{ width: 100 }}>Pago</Lbl><Lbl c={c} style={{ width: 110 }}>Cajero</Lbl><Lbl c={c} style={{ width: 96 }}>Estado</Lbl>
      <Lbl c={c} style={{ width: 96, textAlign: 'right' }}>Monto</Lbl><View style={{ width: 36 }} />
    </View> : null}
    <ScrollView style={{ flex: 1 }}>
      {error ? <View style={{ padding: 16, gap: 8 }} accessibilityRole="alert"><T c={c} size={14} color={c.red}>{error}</T><Btn c={c} size="sm" icon={RefreshCw} onPress={load}>Reintentar</Btn></View> : null}
      {loading && !result.rows.length ? [0, 1, 2, 3, 4, 5].map(i => <View key={i} style={{ flexDirection: 'row', gap: 16, padding: 16, borderBottomWidth: 1, borderColor: c.line }}><Skel c={c} w={130} /><Skel c={c} w={90} /><Skel c={c} w="30%" /><View style={{ flex: 1 }} /><Skel c={c} w={70} /></View>) : null}
      {!error ? result.rows.map(row) : null}
      {!loading && !error && !result.rows.length ? <Empty c={c} icon={FileText} title="No hay comprobantes con estos filtros" description="Cambia el rango de fechas o quita los filtros." action={dirty ? <Btn c={c} size="sm" onPress={() => apply(blank)}>Quitar filtros</Btn> : null} /> : null}
    </ScrollView>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.paperAlt }}>
      <Num c={c} size={13} weight="500" color={c.muted}>Página {page} de {result.pages || 1}</Num>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Btn c={c} size="sm" icon={ChevronLeft} disabled={loading || page <= 1} onPress={() => setPage(page - 1)} accessibilityLabel="Página anterior">{phone ? null : 'Anterior'}</Btn>
        <Btn c={c} size="sm" disabled={loading || page >= (result.pages || 1)} onPress={() => setPage(page + 1)} accessibilityLabel="Página siguiente" icon={phone ? ChevronRight : undefined}>{phone ? null : 'Siguiente'}</Btn>
      </View>
    </View>

    <Dialog c={c} visible={detailOpen} onClose={() => { dreq.current++; setDetailOpen(false); }} width={560} icon={FileText}
      title={detail ? `Comprobante ${detail.pago?.comprobante_numero || detail.pago?.id}` : 'Comprobante'}
      subtitle={detail ? `${STATE[detail.pago?.estado]?.[0] || detail.pago?.estado} · ${money(detail.pago?.monto)} · ${detail.pago?.metodo}` : null}
      footer={detail ? <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {canAuthorize && detail.pago?.estado === 'ACTIVO' ? <>
          <Btn c={c} variant="danger" icon={Slash} disabled={busy} onPress={() => { setDetailOpen(false); onAuthorize(detail.pago, 'anular'); }}>Anular</Btn>
          <Btn c={c} icon={RotateCcw} disabled={busy} onPress={() => { setDetailOpen(false); onAuthorize(detail.pago, 'devolver'); }}>Devolver</Btn>
        </> : null}
        <Btn c={c} variant="ink" icon={Printer} disabled={busy} onPress={() => reprint(detail.pago.id)}>Reimprimir</Btn>
      </View> : null}>
      {!detail && !detailError ? <View style={{ gap: 8 }}>{[0, 1, 2, 3, 4, 5, 6].map(i => <Skel key={i} c={c} w={i % 2 ? '70%' : '90%'} />)}</View> : null}
      {detailError ? <T c={c} size={14} color={c.red}>{detailError}</T> : null}
      {detail ? <>
        {detail.pago?.impresion_estado ? <T c={c} size={13} color={detail.pago.impresion_estado === 'ERROR' ? c.red : c.faint}>{PRINT[detail.pago.impresion_estado] || 'Impresión sin registrar'}{detail.pago.impresion_estado === 'ENVIADO' ? ' (se envió a la impresora; la salida física no se confirma)' : ''}</T> : null}
        {/* El ticket guardado, tal cual se imprime: papel de 80 mm con letra de impresora. */}
        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 380, paddingVertical: 16, paddingHorizontal: 14, backgroundColor: c.isDark ? '#F4F4F2' : '#FFFFFF', borderWidth: 1, borderColor: c.rule }}>
          <Text selectable style={{ fontFamily: WEB ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined, fontSize: 12, lineHeight: 18, color: '#16171A' }}>{savedPaymentText(detail.snapshot, detail.pago)}</Text>
        </View>
      </> : null}
    </Dialog>
  </View>;
}
