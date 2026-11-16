import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Banknote, CreditCard, Landmark, LockKeyhole, Receipt, Unlock, Wallet } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { MenuButton, MenuField, MenuModal, MenuNotice } from '../components/MenuUI';
import { ORDER_PREP } from '../components/admin/states';
import { AnimatedNumber, Badge, Banner, Button, Card, CardHeader, DataTable, EmptyState, PageHeader, Segmented, ago, money, radius, space, type, useToast } from '../components/admin/ui';

const errorText = e => e?.response?.data?.message || e?.message || 'No se pudo completar la operación.';
const toNumber = v => Number(String(v ?? '').replace(',', '.'));
const origin = o => o?.mesa_id ? `Mesa ${o.mesa_numero || o.mesa_id}` : o?.tipo === 'Delivery' ? 'Delivery' : 'Para llevar';
const PREP = ORDER_PREP;
const METHODS = [{ value: 'Efectivo', label: 'Efectivo', icon: Banknote }, { value: 'Tarjeta', label: 'Tarjeta', icon: CreditCard }, { value: 'Transferencia', label: 'Transferencia', icon: Landmark }];

export default function CashScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1180, phone = width < 760;
  const toast = useToast();
  const { pedidos, caja, abrirCaja, cerrarCaja, cobrarPedido, refreshAll } = useAdmin();
  const [dialog, setDialog] = useState(null); // { kind: 'open'|'close'|'charge', order }
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = caja?.caja;
  const t = caja?.totales_turno || {};
  const payable = pedidos.filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado || '').toUpperCase()));
  const balanceOf = o => Math.max(0, Number(o.saldo_pendiente ?? (Number(o.total || 0) - Number(o.abonado || 0))));
  const pendingTotal = Number(caja?.monto_por_cobrar ?? payable.reduce((s, o) => s + balanceOf(o), 0));
  const expected = useMemo(() => {
    if (!open) return 0;
    if (caja?.efectivo_esperado != null && Number(caja.efectivo_esperado) > 0) return Number(caja.efectivo_esperado);
    const efectivo = (caja?.pagos || []).filter(p => String(p.metodo || '').toLowerCase() === 'efectivo' && String(p.estado || 'ACTIVO').toUpperCase() !== 'ANULADO').reduce((s, p) => s + Number(p.monto || 0), 0);
    const moves = (caja?.movimientos || []).reduce((acc, m) => { const k = String(m.tipo || '').toUpperCase(); acc[k] = (acc[k] || 0) + Number(m.monto || 0); return acc; }, {});
    return Number(open.monto_inicial || 0) + efectivo + Number(moves.INGRESO || 0) - Number(moves.RETIRO || 0) - Number(moves.GASTO || 0) - Number(moves.DEVOLUCION || 0);
  }, [caja]);
  const paid = Number(caja?.total_cobrado ?? t.total ?? 0);
  const payments = (caja?.pagos || []).slice(0, 12);

  const show = (kind, order) => { setError(''); setDialog({ kind, order }); setForm(kind === 'open' ? { monto: '20.00', nota: '' } : kind === 'close' ? { monto: expected.toFixed(2), nota: '' } : { metodo: 'Efectivo' }); };
  const close = () => { if (!busy) { setDialog(null); setError(''); } };
  async function run() {
    setError('');
    try {
      if (dialog.kind === 'open') {
        const amount = toNumber(form.monto); if (!Number.isFinite(amount) || amount < 0) return setError('Escribe un monto inicial válido.');
        setBusy(true); await abrirCaja(amount, form.nota.trim() || null); await refreshAll(); toast.show('Caja abierta. Ya puedes cobrar.');
      } else if (dialog.kind === 'close') {
        const amount = toNumber(form.monto); if (!Number.isFinite(amount) || amount < 0) return setError('Escribe el efectivo contado.');
        setBusy(true); await cerrarCaja(amount, form.nota.trim() || null); await refreshAll(); toast.show('Caja cerrada. El cierre quedó registrado.');
      } else {
        setBusy(true); await cobrarPedido(dialog.order.id, form.metodo); toast.show(`${origin(dialog.order)} cobrada en ${form.metodo.toLowerCase()}.`);
      }
      setDialog(null);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const counted = toNumber(form.monto);
  const diff = Number.isFinite(counted) ? counted - expected : 0;

  const since = open ? new Date(String(open.fecha_apertura).replace(' ', 'T')).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '';
  const shift = <Card padded={false} style={{ flex: wide ? 1.4 : undefined }}>
    <CardHeader title="Turno" description={open ? `Caja #${open.id} · abierta desde ${since} · fondo inicial ${money(open.monto_inicial)}` : 'Abre la caja para empezar a cobrar. Las cuentas siguen visibles.'}
      actions={<>
        <Badge tone={open ? 'success' : 'neutral'} progress={open ? 'complete' : 'incomplete'}>{open ? 'Abierta' : 'Cerrada'}</Badge>
        {open ? <Button icon={LockKeyhole} onPress={() => show('close')}>Cerrar caja</Button> : <Button variant="primary" icon={Unlock} onPress={() => show('open')}>Abrir caja</Button>}
      </>} />
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
      <Text style={[type.body, { color: c.muted }]}>Efectivo esperado en caja</Text>
      <AnimatedNumber value={expected} format={v => money(v)} style={[type.figure, { fontSize: 28, lineHeight: 36, color: c.text }]} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: c.line }}>
      {[['Efectivo', t.efectivo], ['Tarjeta', t.tarjeta], ['Transferencia', t.transferencia], ['Total cobrado', paid]].map(([l, v], i) => <View key={l} style={{ flexGrow: 1, flexBasis: phone ? '50%' : 0, paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2, borderLeftWidth: i && !(phone && i % 2 === 0) ? 1 : 0, borderTopWidth: phone && i > 1 ? 1 : 0, borderColor: c.line }}>
        <Text style={[type.body, { color: c.muted }]}>{l}</Text>
        <Text style={[type.body, type.num, { color: c.text, fontWeight: l === 'Total cobrado' ? '700' : '500' }]}>{money(v)}</Text>
      </View>)}
    </View>
  </Card>;

  const pending = <Card padded={false} style={{ flex: wide ? 1 : undefined }}>
    <CardHeader title="Por cobrar ahora" description={`${payable.length} ${payable.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`} />
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
      <AnimatedNumber value={pendingTotal} format={v => money(v)} style={[type.figure, { fontSize: 28, lineHeight: 36, color: c.text }]} />
    </View>
    {payable.slice().sort((a, b) => balanceOf(b) - balanceOf(a)).slice(0, 3).map(o => <View key={o.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.line }}>
      <Text numberOfLines={1} style={[type.body, { color: c.text, flex: 1 }]}>{origin(o)} <Text style={{ color: c.muted }}>#{o.id}</Text></Text>
      <Text style={[type.body, type.num, { color: c.text }]}>{money(balanceOf(o))}</Text>
    </View>)}
  </Card>;

  const chargeCols = phone ? [
    { key: 'a', label: 'Cuenta', flex: 1, render: o => <View style={{ gap: 4 }}><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{origin(o)} <Text style={{ color: c.faint, fontWeight: '400' }}>#{o.id}</Text></Text>
      <Text style={[type.body, { color: c.muted }]}>{o.cliente_nombre || o.mesero_nombre || 'Consumidor final'}</Text></View> },
    { key: 'b', label: 'Saldo', width: 120, align: 'right', render: o => <View style={{ alignItems: 'flex-end', gap: 6 }}><Text style={[type.body, type.num, { color: c.text, fontWeight: '700' }]}>{money(balanceOf(o))}</Text>
      <Button size="sm" disabled={!open} onPress={() => show('charge', o)}>Cobrar</Button></View> },
  ] : [
    { key: 'a', label: 'Cuenta', flex: 2, sortValue: o => Number(o.id), render: o => <View><Text style={[type.body, { color: c.text, fontWeight: '600' }]}>{origin(o)} <Text style={{ color: c.faint, fontWeight: '400' }}>#{o.id}</Text></Text>
      <Text style={[type.body, { color: c.muted }]}>{o.cliente_nombre || o.mesero_nombre || 'Consumidor final'} · {ago(o.created_at)}</Text></View> },
    { key: 's', label: 'Preparación', flex: 1, render: o => { const [l, tone, progress] = PREP[String(o.estado_cocina || o.estado).toUpperCase()] || ['Abierta', 'neutral']; return <Badge tone={tone} progress={progress}>{l}</Badge>; } },
    { key: 'b', label: 'Saldo', width: 110, sortValue: o => balanceOf(o), align: 'right', render: o => <Text style={[type.body, type.num, { color: c.text, fontWeight: '700' }]}>{money(balanceOf(o))}</Text> },
    { key: 'x', label: '', width: 104, align: 'right', render: o => <Button size="sm" disabled={!open} onPress={() => show('charge', o)}>Cobrar</Button> },
  ];

  const payCols = [
    { key: 'r', label: 'Comprobante', flex: 2, render: p => <View><Text style={[type.body, type.num, { color: c.text, fontWeight: '600' }]}>{p.comprobante_numero || `Pago #${p.id}`}</Text>
      <Text style={[type.body, { color: c.muted }]}>{p.factura_cliente || p.cliente_nombre || 'Consumidor final'} · {origin(p)}</Text></View> },
    ...(phone ? [] : [{ key: 'm', label: 'Método', flex: 1, render: p => <Text style={[type.body, { color: c.text }]}>{p.metodo || '—'}</Text> },
      { key: 'd', label: 'Hora', flex: 1, render: p => <Text style={[type.body, { color: c.muted }]}>{ago(p.created_at)}</Text> }]),
    { key: 'v', label: 'Monto', width: 110, align: 'right', render: p => { const ok = String(p.estado || 'ACTIVO').toUpperCase() === 'ACTIVO';
      return <View style={{ alignItems: 'flex-end' }}><Text style={[type.body, type.num, { color: ok ? c.text : c.red, fontWeight: '600', textDecorationLine: ok ? 'none' : 'line-through' }]}>{money(p.monto)}</Text>
        {!ok ? <Badge tone="critical" size="sm">{String(p.estado).charAt(0) + String(p.estado).slice(1).toLowerCase()}</Badge> : null}</View>; } },
  ];

  return <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.x3 }}>
      <PageHeader title="Caja" />
      {!open ? <Banner tone="warning" title="La caja está cerrada" style={{ marginBottom: space.lg }} action={<Button variant="primary" icon={Unlock} onPress={() => show('open')}>Abrir caja</Button>}>Puedes revisar las cuentas, pero para cobrar primero abre el turno con su fondo inicial.</Banner> : null}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space.lg, alignItems: wide ? 'flex-start' : 'stretch' }}>{shift}{pending}</View>
      <DataTable style={{ marginTop: space.lg }} columns={chargeCols} rows={payable} pageSize={20}
        toolbar={<CardHeader title="Cuentas por cobrar" description={open ? 'Cobro rápido del saldo completo. Para dividir la cuenta o facturar, usa la pantalla del cajero.' : 'Abre la caja para habilitar los cobros.'} style={{ paddingBottom: space.md }} />}
        empty={<EmptyState icon={Receipt} title="Nada por cobrar" description="Todas las cuentas están pagadas." />} />
      <DataTable style={{ marginTop: space.lg }} columns={payCols} rows={payments} compact
        toolbar={<CardHeader title="Últimos comprobantes" description="Los 12 cobros más recientes del turno." style={{ paddingBottom: space.md }} />}
        empty={<EmptyState compact icon={Wallet} title="Sin cobros todavía" description="Los cobros del turno aparecerán aquí." />} />
    </ScrollView>

    <MenuModal visible={!!dialog} busy={busy} close={close} maxWidth={460}
      title={dialog?.kind === 'open' ? 'Abrir caja' : dialog?.kind === 'close' ? 'Cerrar caja' : `Cobrar ${origin(dialog?.order)}`}
      subtitle={dialog?.kind === 'open' ? 'Cuenta el efectivo con el que empieza el turno.' : dialog?.kind === 'close' ? 'Cuenta el efectivo y registra el cierre del turno.' : dialog?.order ? `Pedido #${dialog.order.id} · saldo ${money(balanceOf(dialog.order))}` : ''}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
        <MenuButton disabled={busy} onPress={close}>Cancelar</MenuButton>
        <MenuButton primary busy={busy} onPress={run}>{dialog?.kind === 'open' ? 'Abrir caja' : dialog?.kind === 'close' ? 'Registrar cierre' : `Cobrar ${dialog?.order ? money(balanceOf(dialog.order)) : ''}`}</MenuButton>
      </View>}>
      {dialog?.kind === 'charge' ? <View style={{ gap: space.md }}>
        <Text style={[type.body, { color: c.text }]}>Método de pago</Text>
        <Segmented options={METHODS} value={form.metodo} onChange={m => setForm({ metodo: m })} accessibilityLabel="Método de pago" />
        <Text style={[type.body, { color: c.muted }]}>Para dividir la cuenta, emitir factura o cobrar con varios métodos, usa la pantalla del cajero.</Text>
      </View> : <>
        <MenuField label={dialog?.kind === 'open' ? 'Fondo inicial' : 'Efectivo contado'} value={form.monto} onChangeText={v => setForm(f => ({ ...f, monto: v }))} keyboardType="decimal-pad" autoFocus />
        {dialog?.kind === 'close' && Number.isFinite(counted) ? <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.lg }}>
          {[['Efectivo esperado', money(expected)], ['Efectivo contado', money(counted)]].map(([l, v]) => <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Text style={[type.body, { color: c.muted }]}>{l}</Text><Text style={[type.body, type.num, { color: c.text }]}>{v}</Text></View>)}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm }}>
            <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>Diferencia</Text>
            <Badge tone={Math.abs(diff) < 0.005 ? 'success' : 'warning'}>{Math.abs(diff) < 0.005 ? 'Cuadra exacto' : `${diff > 0 ? 'Sobrante' : 'Faltante'} ${money(Math.abs(diff))}`}</Badge>
          </View>
        </View> : null}
        <MenuField label="Observación (opcional)" value={form.nota} onChangeText={v => setForm(f => ({ ...f, nota: v }))} placeholder={dialog?.kind === 'open' ? 'Ej.: turno mañana' : 'Ej.: billete roto apartado'} />
      </>}
      {!!error && <MenuNotice danger>{error}</MenuNotice>}
    </MenuModal>
  </>;
}
