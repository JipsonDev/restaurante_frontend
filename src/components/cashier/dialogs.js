// Diálogos de caja: abrir turno, cerrar con arqueo, movimientos, autorización de anulación/devolución y cierres anteriores.
import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Ban, Clock, Download, Minus, Pencil, Plus, Printer, RotateCcw, ShieldCheck, Store, WalletCards } from 'lucide-react-native';
import { Badge, Btn, Cell, Cells, Dialog, Empty, FONT, IconBtn, Lbl, Num, Seg, T, TotalRow, WEB, haptic, money, r, toNum } from './kit';

const BILLS = [100, 50, 20, 10, 5, 1];
const COINS = [1, 0.5, 0.25, 0.1, 0.05, 0.01];
const denomLabel = (v, coin) => coin ? (v >= 1 ? '$1 moneda' : `${Math.round(v * 100)} ¢`) : `$${v}`;
const when = v => { const d = new Date(String(v || '').replace(' ', 'T')); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }); };
const cents = n => Math.round(Number(n || 0) * 100);

function Footer({ children }) { return <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>{children}</View>; }

function Counter({ c, label, value, onChange, subtotal }) {
  const n = Number(value || 0);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.line }}>
    <Num c={c} size={15} weight="700" style={{ width: 84 }}>{label}</Num>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.rule, borderRadius: r.md }}>
      <IconBtn c={c} icon={Minus} label={`Una menos de ${label}`} onPress={() => { haptic('tap'); onChange(String(Math.max(0, n - 1))); }} disabled={n <= 0} size={36} />
      <TextInput value={value} onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="0" placeholderTextColor={c.faint} accessibilityLabel={`Cantidad de ${label}`} selectTextOnFocus
        style={[{ width: 48, height: 36, textAlign: 'center', fontFamily: FONT, fontSize: 16, fontWeight: '700', color: c.text, fontVariant: ['tabular-nums'] }, WEB ? { outlineStyle: 'none' } : null]} />
      <IconBtn c={c} icon={Plus} label={`Una más de ${label}`} onPress={() => { haptic('tap'); onChange(String(n + 1)); }} size={36} />
    </View>
    <Num c={c} size={14} weight="600" color={subtotal ? c.text : c.faint} style={{ flex: 1, textAlign: 'right' }}>{money(subtotal)}</Num>
  </View>;
}

export default function CajaDialogs({ c, s }) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  // ── Arqueo ──
  const [mode, setMode] = useState('conteo');
  const [counts, setCounts] = useState({});
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (s.closeCajaModal) { setCounts({}); setMode('conteo'); setTouched(false); } }, [s.closeCajaModal]);
  const count = updater => { setTouched(true); setCounts(updater); };
  const counted = useMemo(() => [...BILLS.map(v => ['b' + v, v]), ...COINS.map(v => ['c' + v, v])].reduce((sum, [k, v]) => sum + cents(v) * Number(counts[k] || 0), 0) / 100, [counts]);
  useEffect(() => { if (s.closeCajaModal && mode === 'conteo') s.setCloseAmount(counted.toFixed(2)); }, [counted, mode, s.closeCajaModal]);
  const expected = Number(s.expectedCash || 0);
  const countedNow = toNum(s.closeAmount || 0);
  const diff = Math.round((countedNow - expected) * 100) / 100;
  const diffTone = Math.abs(diff) < 0.005 ? 'green' : diff < 0 ? 'red' : 'amber';
  const diffText = Math.abs(diff) < 0.005 ? 'Cuadra' : diff < 0 ? 'Faltante' : 'Sobrante';
  const tt = s.turnTotals || {};

  const pa = s.paymentAuth;
  const setPa = patch => s.setPaymentAuth(prev => ({ ...prev, ...patch }));
  const mvLabel = { INGRESO: 'ingreso', RETIRO: 'retiro', GASTO: 'gasto' }[s.movementType] || 'movimiento';

  return <>
    {/* Abrir caja */}
    <Dialog c={c} visible={s.openCajaModal} onClose={() => s.setOpenCajaModal(false)} busy={s.cashBusy} icon={WalletCards} width={480}
      title="Abrir caja" subtitle="Cuenta el efectivo que hay en el cajón antes de empezar."
      footer={<Footer><Btn c={c} onPress={() => s.setOpenCajaModal(false)} disabled={s.cashBusy}>Cancelar</Btn>
        <Btn c={c} variant="ink" icon={WalletCards} onPress={s.submitOpenCaja} loading={s.cashBusy} disabled={!(toNum(s.openAmount) >= 0) || s.openAmount === ''}>Abrir turno</Btn></Footer>}>
      <Cells c={c}>
        <Cell c={c} label="Responsable" basis="55%">{s.user?.nombre || s.user?.correo || 'Caja'}</Cell>
        <Cell c={c} label="Fecha y hora" basis="45%">{new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</Cell>
      </Cells>
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Fondo de apertura</T>
        <TextInput value={s.openAmount} onChangeText={v => s.setOpenAmount(v.replace(',', '.').replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.faint} accessibilityLabel="Fondo de apertura en efectivo" selectTextOnFocus autoFocus={WEB}
          style={[{ height: 60, paddingHorizontal: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 28, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }, WEB ? { outlineStyle: 'none' } : null]} />
        <View style={{ flexDirection: 'row', gap: 6 }}>{['0.00', '20.00', '50.00', '100.00'].map(v => <Btn key={v} c={c} size="sm" style={{ flex: 1 }} variant={s.openAmount === v ? 'ink' : 'outline'} onPress={() => s.setOpenAmount(v)}>{money(v)}</Btn>)}</View>
      </View>
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Observación (opcional)</T>
        <TextInput value={s.openNote} onChangeText={s.setOpenNote} placeholder="Ej. turno de la mañana, billetes revisados" placeholderTextColor={c.faint} multiline accessibilityLabel="Observación de apertura"
          style={[{ minHeight: 64, padding: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 14, color: c.text, textAlignVertical: 'top' }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>
    </Dialog>

    {/* Cerrar caja con arqueo */}
    <Dialog c={c} visible={s.closeCajaModal} onClose={() => s.setCloseCajaModal(false)} busy={s.cashBusy} icon={Store} width={760}
      title={`Cerrar turno #${s.caja?.caja?.id || ''}`} subtitle="Cuenta el efectivo del cajón. La diferencia queda registrada en el cierre."
      footer={<View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T c={c} size={14} weight="700" color={diffTone === 'green' ? c.green : diffTone === 'red' ? c.red : c.amber}>{diffText}</T>
          <Num c={c} size={20} weight="800" color={diffTone === 'green' ? c.green : diffTone === 'red' ? c.red : c.amber}>{`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${money(Math.abs(diff))}`}</Num>
        </View>
        <Footer><Btn c={c} onPress={() => s.setCloseCajaModal(false)} disabled={s.cashBusy}>Cancelar</Btn>
          <Btn c={c} variant="ink" icon={Store} onPress={s.submitCloseCaja} loading={s.cashBusy} disabled={!touched || (Math.abs(diff) >= 0.005 && !s.closeNote.trim())}>Cerrar con {money(countedNow)}</Btn></Footer>
      </View>}>
      <Cells c={c}>
        <Cell c={c} label="Fondo" basis={wide ? '25%' : '50%'}><Num c={c} size={17} weight="800">{money(s.caja?.caja?.monto_inicial)}</Num></Cell>
        <Cell c={c} label="Debe haber" basis={wide ? '25%' : '50%'}><Num c={c} size={17} weight="800">{money(expected)}</Num></Cell>
        <Cell c={c} label="Contado" basis={wide ? '25%' : '50%'}><Num c={c} size={17} weight="800">{money(countedNow)}</Num></Cell>
        <Cell c={c} label="Diferencia" basis={wide ? '25%' : '50%'} style={{ backgroundColor: diffTone === 'green' ? c.greenSoft : diffTone === 'red' ? c.redSoft : c.amberSoft }}>
          <Num c={c} size={17} weight="800" color={diffTone === 'green' ? c.green : diffTone === 'red' ? c.red : c.amber}>{`${diff > 0 ? '+' : diff < 0 ? '−' : ''}${money(Math.abs(diff))}`}</Num>
        </Cell>
      </Cells>
      <Seg c={c} size="sm" label="Cómo contar" value={mode} onChange={setMode} options={[{ value: 'conteo', label: wide ? 'Contar billetes y monedas' : 'Por billetes' }, { value: 'total', label: wide ? 'Escribir el total' : 'Total' }]} />
      {!touched ? <T c={c} size={13} color={c.faint}>Cuenta el efectivo para poder cerrar. Si el cajón está vacío, escribe 0 en «{wide ? 'Escribir el total' : 'Total'}».</T> : Math.abs(diff) >= 0.005 && !s.closeNote.trim() ? <T c={c} size={13} color={c.amber}>Hay {diff < 0 ? 'un faltante' : 'un sobrante'} de {money(Math.abs(diff))}: escribe la explicación abajo para cerrar.</T> : null}
      {mode === 'conteo' ? <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 24 : 12 }}>
        <View style={{ flex: 1 }}>
          <T c={c} size={14} weight="800" style={{ marginBottom: 4 }}>Billetes</T>
          {BILLS.map(v => <Counter key={v} c={c} label={denomLabel(v)} value={counts['b' + v] || ''} subtotal={cents(v) * Number(counts['b' + v] || 0) / 100} onChange={x => count(o => ({ ...o, ['b' + v]: x }))} />)}
        </View>
        <View style={{ flex: 1 }}>
          <T c={c} size={14} weight="800" style={{ marginBottom: 4 }}>Monedas</T>
          {COINS.map(v => <Counter key={v} c={c} label={denomLabel(v, true)} value={counts['c' + v] || ''} subtotal={cents(v) * Number(counts['c' + v] || 0) / 100} onChange={x => count(o => ({ ...o, ['c' + v]: x }))} />)}
        </View>
      </View> : <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Efectivo contado</T>
        <TextInput value={s.closeAmount} onChangeText={v => { setTouched(true); s.setCloseAmount(v.replace(',', '.').replace(/[^0-9.]/g, '')); }} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.faint} selectTextOnFocus accessibilityLabel="Efectivo contado"
          style={[{ height: 60, paddingHorizontal: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 28, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>}
      <View style={{ borderWidth: 1, borderColor: c.rule }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.paperAlt, borderBottomWidth: 1, borderColor: c.rule }}><T c={c} size={14} weight="800">Resumen del turno</T></View>
        <TotalRow c={c} label="Efectivo" value={Number(tt.efectivo || 0)} />
        <TotalRow c={c} label="Tarjeta" value={Number(tt.tarjeta || 0)} />
        <TotalRow c={c} label="Transferencia" value={Number(tt.transferencia || 0)} />
        {Number(tt.qr) ? <TotalRow c={c} label="QR" value={Number(tt.qr)} /> : null}
        {Number(tt.vales) ? <TotalRow c={c} label="Vales" value={Number(tt.vales)} /> : null}
        <TotalRow c={c} label="Total cobrado" value={Number(tt.total || 0)} strong />
        <TotalRow c={c} label="Ingresos de efectivo" value={Number(tt.ingresos || 0)} />
        <TotalRow c={c} label="Retiros" value={Number(tt.retiros || 0)} />
        <TotalRow c={c} label="Gastos" value={Number(tt.gastos || 0)} />
        {Number(tt.devoluciones) ? <TotalRow c={c} label="Devoluciones" value={Number(tt.devoluciones)} /> : null}
      </View>
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>{Math.abs(diff) >= 0.005 ? 'Explica la diferencia' : 'Observación (opcional)'}</T>
        <TextInput value={s.closeNote} onChangeText={s.setCloseNote} placeholder={Math.abs(diff) >= 0.005 ? 'Ej. faltan $2 por un vuelto mal dado' : 'Ej. todo en orden'} placeholderTextColor={c.faint} multiline accessibilityLabel="Observación del cierre"
          style={[{ minHeight: 60, padding: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 14, color: c.text, textAlignVertical: 'top' }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>
    </Dialog>

    {/* Movimiento de efectivo */}
    <Dialog c={c} visible={s.movementModal} onClose={() => s.setMovementModal(false)} busy={s.cashBusy} icon={s.movementType === 'INGRESO' ? ArrowDownLeft : s.movementType === 'RETIRO' ? ArrowUpRight : Ban} width={460}
      title={`Registrar ${mvLabel}`} subtitle={s.movementType === 'INGRESO' ? 'Efectivo que entra al cajón sin ser una venta.' : s.movementType === 'RETIRO' ? 'Efectivo que sale del cajón, por ejemplo para depositar.' : 'Pago de un gasto con el efectivo del cajón.'}
      footer={<Footer><Btn c={c} onPress={() => s.setMovementModal(false)} disabled={s.cashBusy}>Cancelar</Btn>
        <Btn c={c} variant="ink" onPress={s.submitMovement} loading={s.cashBusy} disabled={!(toNum(s.movementAmount) > 0) || !s.movementReason.trim()}>{`Registrar ${money(toNum(s.movementAmount))}`}</Btn></Footer>}>
      <Seg c={c} size="sm" label="Tipo de movimiento" value={s.movementType} onChange={s.setMovementType}
        options={[{ value: 'INGRESO', label: 'Ingreso', icon: ArrowDownLeft }, { value: 'RETIRO', label: 'Retiro', icon: ArrowUpRight }, { value: 'GASTO', label: 'Gasto', icon: Ban }]} />
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Monto</T>
        <TextInput value={s.movementAmount} onChangeText={v => s.setMovementAmount(v.replace(',', '.').replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.faint} accessibilityLabel="Monto del movimiento" autoFocus={WEB}
          style={[{ height: 56, paddingHorizontal: 14, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 24, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Motivo</T>
        <TextInput value={s.movementReason} onChangeText={s.setMovementReason} placeholder={s.movementType === 'GASTO' ? 'Ej. compra de servilletas' : s.movementType === 'RETIRO' ? 'Ej. depósito en el banco' : 'Ej. cambio traído del banco'} placeholderTextColor={c.faint} multiline accessibilityLabel="Motivo del movimiento"
          style={[{ minHeight: 60, padding: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 14, color: c.text, textAlignVertical: 'top' }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>
    </Dialog>

    {/* Autorizar anulación o devolución */}
    <Dialog c={c} visible={pa.visible} onClose={() => setPa({ visible: false })} busy={s.adminBusy} icon={ShieldCheck} tone={pa.action === 'anular' ? 'red' : 'amber'} width={480}
      title={pa.action === 'anular' ? 'Anular comprobante' : 'Registrar devolución'}
      subtitle={pa.action === 'anular' ? 'El cobro deja de contar en el turno y la cuenta vuelve a quedar por cobrar.' : 'Se devuelve el dinero al cliente y queda registrado en el turno.'}
      footer={<Footer><Btn c={c} onPress={() => setPa({ visible: false })} disabled={s.adminBusy}>Cancelar</Btn>
        <Btn c={c} variant={pa.action === 'anular' ? 'dangerSolid' : 'ink'} icon={pa.action === 'anular' ? Ban : RotateCcw} onPress={s.submitPaymentAuthorization} loading={s.adminBusy}
          disabled={!pa.motivo.trim() || (!s.canVoidPayments && (!pa.correo.trim() || !/^\d{4}$/.test(pa.pin)))}>{pa.action === 'anular' ? 'Anular' : 'Registrar devolución'}</Btn></Footer>}>
      <Cells c={c}>
        <Cell c={c} label="Comprobante" basis="60%">{pa.pago?.comprobante_numero || `Pago #${pa.pago?.id || '—'}`}</Cell>
        <Cell c={c} label="Monto" basis="40%"><Num c={c} size={16} weight="800">{money(pa.pago?.monto)}</Num></Cell>
      </Cells>
      <View style={{ gap: 6 }}>
        <T c={c} size={13} weight="600" color={c.muted}>Motivo</T>
        <TextInput value={pa.motivo} onChangeText={v => setPa({ motivo: v })} placeholder="Ej. se cobró con el método equivocado" placeholderTextColor={c.faint} multiline accessibilityLabel="Motivo"
          style={[{ minHeight: 64, padding: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, fontFamily: FONT, fontSize: 14, color: c.text, textAlignVertical: 'top' }, WEB ? { outlineStyle: 'none' } : null]} />
      </View>
      {!s.canVoidPayments ? <View style={{ gap: 10, padding: 12, borderRadius: r.md, backgroundColor: c.amberSoft }}>
        <T c={c} size={13} weight="700" color={c.amber}>Necesita la autorización de un administrador o supervisor.</T>
        <TextInput value={pa.correo} onChangeText={v => setPa({ correo: v })} autoCapitalize="none" keyboardType="email-address" placeholder="Correo de quien autoriza" placeholderTextColor={c.faint} accessibilityLabel="Correo de quien autoriza"
          style={[{ height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper, fontFamily: FONT, fontSize: 15, color: c.text }, WEB ? { outlineStyle: 'none' } : null]} />
        <TextInput value={pa.pin} onChangeText={v => setPa({ pin: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="PIN de 4 dígitos" placeholderTextColor={c.faint} accessibilityLabel="PIN de quien autoriza"
          style={[{ height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper, fontFamily: FONT, fontSize: 18, letterSpacing: 6, color: c.text }, WEB ? { outlineStyle: 'none' } : null]} />
      </View> : <T c={c} size={13} color={c.green}>Tu usuario puede autorizarlo directamente.</T>}
    </Dialog>

    {/* Cierres anteriores */}
    <Dialog c={c} visible={s.historyModal} onClose={() => s.setHistoryModal(false)} icon={Clock} width={820}
      title="Cierres anteriores" subtitle={`${(s.cierres || []).length} cierres registrados`}
      footer={<Footer><Btn c={c} icon={Download} onPress={s.exportClosures} disabled={!(s.cierres || []).length}>Exportar CSV</Btn><Btn c={c} variant="ink" onPress={() => s.setHistoryModal(false)}>Listo</Btn></Footer>}>
      {(s.cierres || []).length ? <View style={{ borderTopWidth: 1, borderColor: c.text }}>
        {wide ? <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.rule }}>
          <Lbl c={c} style={{ width: 54 }}>Caja</Lbl><Lbl c={c} style={{ flex: 1 }}>Cierre</Lbl><Lbl c={c} style={{ width: 90, textAlign: 'right' }}>Ventas</Lbl>
          <Lbl c={c} style={{ width: 90, textAlign: 'right' }}>Esperado</Lbl><Lbl c={c} style={{ width: 90, textAlign: 'right' }}>Contado</Lbl><Lbl c={c} style={{ width: 90, textAlign: 'right' }}>Diferencia</Lbl><View style={{ width: s.canManageClosures ? 116 : 40 }} />
        </View> : null}
        {s.cierres.map(item => { const d = Number(item.diferencia_cierre || 0); const tone = Math.abs(d) < 0.005 ? c.green : d < 0 ? c.red : c.amber;
          return <View key={item.id} style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: wide ? 10 : 4, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
            <Num c={c} size={14} weight="800" style={{ width: 54 }}>#{item.id}</Num>
            <View style={{ flex: 1, minWidth: 0 }}><T c={c} size={14} weight="600" numberOfLines={1}>{when(item.fecha_cierre)}</T><T c={c} size={12} color={c.faint} numberOfLines={1}>{item.trabajador_nombre || 'Caja'}{item.observacion_cierre ? ` · ${item.observacion_cierre}` : ''}</T></View>
            <Num c={c} size={14} weight="700" style={{ width: wide ? 90 : undefined, textAlign: wide ? 'right' : 'left' }}>{wide ? money(item.total_ventas) : `Ventas ${money(item.total_ventas)} · esperado ${money(item.efectivo_esperado)} · contado ${money(item.monto_final)}`}</Num>
            {wide ? <><Num c={c} size={14} weight="500" color={c.muted} style={{ width: 90, textAlign: 'right' }}>{money(item.efectivo_esperado)}</Num>
              <Num c={c} size={14} weight="500" color={c.muted} style={{ width: 90, textAlign: 'right' }}>{money(item.monto_final)}</Num></> : null}
            <Num c={c} size={14} weight="800" color={tone} style={{ width: wide ? 90 : undefined, textAlign: wide ? 'right' : 'left' }}>{`${d > 0 ? '+' : d < 0 ? '−' : ''}${money(Math.abs(d))}`}</Num>
            <View style={{ flexDirection: 'row', gap: 2, width: wide ? (s.canManageClosures ? 116 : 40) : undefined, justifyContent: 'flex-end' }}>
              <IconBtn c={c} icon={Printer} label={`Imprimir cierre ${item.id}`} onPress={() => s.printClosure(item)} size={36} />
              {s.canManageClosures ? <><IconBtn c={c} icon={Pencil} label={`Corregir cierre ${item.id}`} onPress={() => s.adminClosureAction(item, 'editar')} disabled={s.adminBusy} size={36} />
                <IconBtn c={c} icon={RotateCcw} label={`Reabrir caja ${item.id}`} onPress={() => s.adminClosureAction(item, 'reabrir')} disabled={s.adminBusy} size={36} /></> : null}
            </View>
          </View>; })}
      </View> : <Empty c={c} icon={Clock} title="Aún no hay cierres" description="Cada vez que se cierra un turno queda aquí con su arqueo y diferencia." />}
    </Dialog>
  </>;
}
