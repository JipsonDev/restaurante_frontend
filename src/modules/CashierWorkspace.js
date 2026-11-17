// Caja — punto de cobro. Dirección «Comprobante»: cada cuenta se lee como el comprobante que va a emitirse.
// Toda la lógica de cobro vive en CashierApp (CashierShell); aquí solo se dibuja y se llama a sus acciones.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import {
  ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote, Ban, Clock, CreditCard, FileText, Gift, Hash, Layers, LogOut, Minus, Moon, Plus,
  Printer, Receipt, RefreshCw, Search, ShoppingBag, Store, Sun, Table2, Trash2, WalletCards, Wifi, WifiOff, X,
} from 'lucide-react-native';
import Logo from '../components/Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import CashierPayments from './CashierPayments';
import {
  Badge, Btn, Cell, CellInput, Cells, Empty, FONT, IconBtn, Kbd, Keypad, Lbl, Num, Press, Seg, Serial, T, TotalRow,
  WEB, applyKey, haptic, money, r, sp, tokens, toNum, useCajaFonts,
} from '../components/cashier/kit';

const METHOD_ICON = { Efectivo: Banknote, Tarjeta: CreditCard, Transferencia: RefreshCw, QR: Hash, Vales: Gift, Mixto: Layers };
const KITCHEN = { PENDIENTE: 'En cola', PREPARANDO: 'En cocina', LISTO: 'Listo para servir', ENTREGADO: 'Servido' };
const parseDate = v => { if (!v) return null; const d = new Date(String(v).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? null : d; };
const hhmm = v => { const d = parseDate(v); return d ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'; };
const minutesSince = v => { const d = parseDate(v); return d ? Math.max(0, Math.round((Date.now() - d.getTime()) / 60000)) : null; };
// Tiempo de la cuenta: «hace 12 min»; pasada una hora, la hora de apertura; otro día, la fecha.
const ago = v => { const m = minutesSince(v); if (m == null) return ''; if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
  const d = parseDate(v); return m < 24 * 60 ? `desde ${hhmm(v)}` : `${d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })} ${hhmm(v)}`; };
const onControl = () => { if (!WEB || typeof document === 'undefined') return false; const el = document.activeElement; return !!el && el !== document.body && (el.getAttribute?.('role') || el.tagName === 'BUTTON'); };
const typing = () => { if (!WEB || typeof document === 'undefined') return false; const el = document.activeElement; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); };

export default function CashierWorkspace({ model: m, actions: a, helpers: h }) {
  useCajaFonts();
  const c = tokens[m.isDark ? 'dark' : 'light'];
  const { width } = useWindowDimensions();
  const three = width >= 1024, two = width >= 760, phone = width < 760;
  const roomy = width >= 1280;
  const [view, setView] = useState('cobrar');
  const [target, setTarget] = useState('recibido'); // a dónde escribe el teclado numérico
  const fresh = useRef(true); // la primera tecla reemplaza el monto sugerido
  const searchRef = useRef(null);
  const sel = m.selectedOrder;
  const openCaja = !!m.caja?.caja;

  // Al cambiar de cuenta o de método, el teclado vuelve a «Recibido» (o al abono si se cobra por partes).
  useEffect(() => { fresh.current = true; setTarget(m.chargeMode === 'PARCIAL' ? 'abono' : m.paymentMethod === 'Mixto' ? 'Efectivo' : 'recibido'); }, [sel?.id, m.paymentMethod, m.chargeMode]);
  // Una venta directa confirmada pasa sola a cobro.
  const prevSel = useRef(sel?.id);
  useEffect(() => { if (sel?.id && sel.id !== prevSel.current && view === 'venta' && !m.cart.length) setView('cobrar'); prevSel.current = sel?.id; }, [sel?.id]);

  const padValue = t => t === 'recibido' ? m.cashReceived : t === 'abono' ? m.partialAmount : (m.mixedAmounts[t] || '');
  const padWrite = (t, next) => {
    if (t === 'recibido') a.setCashReceived(next);
    else if (t === 'abono') { a.setPartialAmount(next); a.setDivisionId(null); }
    else a.setMixedAmounts(old => ({ ...old, [t]: next }));
  };
  const pressKey = k => {
    if (m.busy) return;
    const base = fresh.current && k !== 'back' ? '' : padValue(target);
    fresh.current = false;
    padWrite(target, applyKey(base, k));
  };

  // Atajos de teclado (web): F2 buscar, F3 venta directa, F8 cobrar, F9 precuenta, Esc soltar cuenta; números al teclado de cobro.
  const live = useRef({});
  live.current = { m, a, view, pressKey, sel, docOk: true };
  useEffect(() => {
    if (!WEB || typeof window === 'undefined') return;
    const onKey = e => {
      const { m: mm, a: aa, view: v, pressKey: pk, sel: s } = live.current;
      if (e.key === 'F2') { e.preventDefault(); setView('cobrar'); setTimeout(() => searchRef.current?.focus?.(), 30); return; }
      if (e.key === 'F3') { e.preventDefault(); aa.closeOrder(); setView('venta'); return; }
      if (e.key === 'F8') { e.preventDefault(); if (v === 'cobrar' && !mm.busy && (mm.pendingPayment || (s && mm.canCharge && live.current.docOk))) aa.handleCharge(); return; }
      if (e.key === 'F9') { e.preventDefault(); if (v === 'cobrar' && s && !mm.busy) aa.printReceipt(); return; }
      if (typing() || v !== 'cobrar' || !s) return;
      if (e.key === 'Enter' && onControl()) return; // Enter sobre un botón activa ese botón, no cobra
      if (e.key === 'Escape') { aa.closeOrder(); return; }
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pk(e.key); }
      else if (e.key === '.' || e.key === ',') { e.preventDefault(); pk('.'); }
      else if (e.key === 'Backspace') { e.preventDefault(); pk('back'); }
      else if (e.key === 'Enter' && mm.canCharge && !mm.busy && !mm.pendingPayment && live.current.docOk) { e.preventDefault(); aa.handleCharge(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const porCobrar = m.activeOrders.reduce((s, o) => s + Number(o.saldo_pendiente ?? o.total ?? 0), 0);
  const nav = [
    { key: 'cobrar', label: 'Cobrar', icon: Receipt, count: m.activeOrders.length, kbd: 'F2' },
    { key: 'venta', label: 'Venta directa', short: 'Venta', icon: ShoppingBag, kbd: 'F3' },
    { key: 'comprobantes', label: 'Comprobantes', icon: FileText },
    { key: 'turno', label: 'Turno', icon: WalletCards },
  ];
  const go = key => { if (key === 'venta') a.closeOrder(); setView(key); };

  // ── Barra superior (tinta) ────────────────────────────────────────────────
  const topBar = <View style={{ backgroundColor: c.ink, paddingTop: TOP_INSET }}>
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: phone ? 12 : 16, gap: phone ? 8 : 16 }}>
      <View style={{ width: phone ? 92 : 120, justifyContent: 'center' }}><Logo dark height={phone ? 26 : 30} /></View>
      {!phone ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'stretch', height: 56, gap: 2 }}>
        {nav.map(n => { const on = view === n.key; const Icon = n.icon; return <Press key={n.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={n.label}
          onPress={() => go(n.key)} scaleTo={0.98} hoverStyle={on ? null : { backgroundColor: 'rgba(255,255,255,0.06)' }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 3, borderColor: on ? c.onInk : 'transparent' }}>
          <Icon size={17} color={on ? c.onInk : c.inkMuted} />
          {three ? <T c={c} size={14} weight={on ? '700' : '500'} color={on ? c.onInk : c.inkMuted}>{width < 1100 && n.short ? n.short : n.label}</T> : null}
          {n.count ? <Num c={c} size={12} weight="700" color={on ? c.onInk : c.inkMuted} style={{ paddingHorizontal: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)' }}>{n.count}</Num> : null}
        </Press>; })}
      </View> : null}
      <View style={{ flex: 1 }} />
      <Press accessibilityRole="button" accessibilityLabel={openCaja ? `Turno ${m.caja.caja.id} abierto. Ver turno` : 'Caja cerrada. Abrir caja'} onPress={() => openCaja ? setView('turno') : a.handleOpenCaja()}
        scaleTo={0.97} hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.inkLine }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: openCaja ? '#3FB873' : '#E8A93B' }} />
        <T c={c} size={13} weight="600" color={c.onInk} numberOfLines={1}>{openCaja ? (!three ? `Turno ${m.caja.caja.id}` : `Turno ${m.caja.caja.id} · desde ${hhmm(m.caja.caja.fecha_apertura)}`) : 'Caja cerrada'}</T>
      </Press>
      {!phone ? <View accessibilityLabel={m.connected ? 'Conectado en tiempo real' : 'Sin conexión en tiempo real'} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {m.connected ? <Wifi size={16} color="#3FB873" /> : <WifiOff size={16} color="#E8A93B" />}
        {width >= 1180 ? <T c={c} size={13} color={c.inkMuted}>{m.connected ? 'En vivo' : 'Reconectando'}</T> : null}
      </View> : null}
      <IconBtn c={c} onInk icon={m.isDark ? Sun : Moon} label={m.isDark ? 'Tema claro' : 'Tema oscuro'} onPress={a.toggleTheme} />
      {three ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inkLine, alignItems: 'center', justifyContent: 'center' }}>
          <T c={c} size={12} weight="700" color={c.onInk}>{String(m.user?.nombre || 'C').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}</T>
        </View>
        {roomy ? <T c={c} size={13} color={c.onInk} numberOfLines={1}>{m.user?.nombre || 'Caja'}</T> : null}
      </View> : null}
      <IconBtn c={c} onInk icon={LogOut} label="Cerrar sesión" onPress={a.logout} />
    </View>
  </View>;

  // ── Avisos (cobro pendiente, caja cerrada, eventos) ────────────────────────
  const notices = <>
    {m.pendingPayment ? <View accessibilityRole="alert" style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.amberSoft, borderBottomWidth: 1, borderColor: c.line }}>
      <T c={c} size={14} weight="600" color={c.amber} style={{ flex: 1 }}>Hay un cobro sin confirmar del pedido #{m.pendingPayment.pedido_id} por {money(m.pendingPayment.monto)}. Reintenta: se usa el mismo identificador y no se duplica.</T>
      <Btn c={c} size="sm" variant="ink" icon={RefreshCw} onPress={a.handleCharge} loading={m.busy} kbd="F8">Reintentar cobro</Btn>
    </View> : null}
    {m.cashNotice ? <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line,
      backgroundColor: m.cashNotice.type === 'error' ? c.redSoft : m.cashNotice.type === 'warning' ? c.amberSoft : m.cashNotice.type === 'success' ? c.greenSoft : c.blueSoft }}>
      <T c={c} size={14} weight="700" color={m.cashNotice.type === 'error' ? c.red : m.cashNotice.type === 'warning' ? c.amber : m.cashNotice.type === 'success' ? c.green : c.blue}>{m.cashNotice.title}</T>
      <T c={c} size={14} color={c.text} style={{ flex: 1 }} numberOfLines={1}>{m.cashNotice.message}</T>
      <IconBtn c={c} icon={X} label="Cerrar aviso" onPress={a.dismissNotice} size={32} />
    </View> : null}
  </>;

  // ── Lista de cuentas ───────────────────────────────────────────────────────
  const filters = [['TODOS', 'Todas'], ['CUENTA', 'Pidieron cuenta'], ['MESAS', 'Mesas'], ['EXPRESS', 'Para llevar'], ['DELIVERY', 'Delivery']];
  const countFor = key => m.activeOrders.filter(o => {
    const pickup = !o.mesa_id || ['Para llevar', 'Delivery'].includes(o.tipo);
    if (key === 'MESAS') return !pickup; if (key === 'EXPRESS') return pickup && o.tipo !== 'Delivery'; if (key === 'DELIVERY') return o.tipo === 'Delivery'; if (key === 'CUENTA') return !!o.cuenta_solicitada_at; return true;
  }).length;
  const accountRow = o => {
    const on = sel && Number(sel.id) === Number(o.id);
    const asked = !!o.cuenta_solicitada_at;
    const fg = on ? (c.isDark ? c.ink : c.onInk) : c.text;
    const sub = on ? (c.isDark ? '#3A3D43' : c.inkMuted) : c.faint;
    const items = (o.items || []).reduce((s, i) => s + Number(i.cantidad || 0), 0);
    return <Press key={o.id} accessibilityRole="button" accessibilityState={{ selected: !!on }} accessibilityLabel={`${h.orderLabel(o)}, saldo ${money(o.saldo_pendiente ?? o.total)}${asked ? ', pidió la cuenta' : ''}`}
      onPress={() => { haptic('select'); a.openOrder(o); }} scaleTo={0.99} hoverStyle={on ? null : { backgroundColor: c.hover }}
      style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line, backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : 'transparent' }}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {o.mesa_id ? <Table2 size={15} color={sub} /> : <ShoppingBag size={15} color={sub} />}
          <T c={c} size={15} weight="700" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>{h.orderLabel(o)}</T>
        </View>
        <T c={c} size={13} color={sub} numberOfLines={1}>{[`#${o.id}`, `${items} ${items === 1 ? 'producto' : 'productos'}`, KITCHEN[o.estado] || o.estado, ago(o.created_at)].filter(Boolean).join(' · ')}</T>
        {asked || Number(o.abonado) > 0 ? <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
          {asked ? <Badge c={c} tone="amber">{`Pidió la cuenta ${hhmm(o.cuenta_solicitada_at)}`}</Badge> : null}
          {Number(o.abonado) > 0 ? <Badge c={c} tone="blue">{`Abonado ${money(o.abonado)}`}</Badge> : null}
        </View> : null}
      </View>
      <Num c={c} size={16} weight="700" color={fg}>{money(o.saldo_pendiente ?? o.total)}</Num>
    </Press>;
  };
  const accounts = <View style={{ flex: 1, backgroundColor: c.paper }}>
    <View style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
        <View style={{ flexShrink: 0 }}><Search size={17} color={c.faint} /></View>
        <TextInput ref={searchRef} value={m.orderSearch} onChangeText={a.setOrderSearch} placeholder="Buscar mesa, cliente o pedido" placeholderTextColor={c.faint} accessibilityLabel="Buscar cuenta"
          style={[{ flex: 1, fontFamily: FONT, fontSize: 15, color: c.text, height: 42 }, WEB ? { outlineStyle: 'none' } : null]} />
        {m.orderSearch ? <IconBtn c={c} icon={X} label="Borrar búsqueda" onPress={() => a.setOrderSearch('')} size={30} /> : <Kbd c={c}>F2</Kbd>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {filters.map(([k, l]) => { const on = m.orderFilter === k; const n = countFor(k); return <Press key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => a.setOrderFilter(k)} scaleTo={0.97}
          hoverStyle={on ? null : { backgroundColor: c.hover }}
          style={{ height: 32, paddingHorizontal: 10, borderRadius: r.md, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? 'transparent' : c.rule, backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : c.paper }}>
          <T c={c} size={13} weight={on ? '700' : '600'} color={on ? (c.isDark ? c.ink : c.onInk) : c.muted}>{l}</T>
          <Num c={c} size={12} weight="700" color={on ? (c.isDark ? '#3A3D43' : c.inkMuted) : c.faint}>{n}</Num>
        </Press>; })}
      </View>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: phone ? 24 : 0 }}>
      {m.filteredOrders.map(accountRow)}
      {!m.filteredOrders.length ? <Empty c={c} icon={Table2} title={m.activeOrders.length ? 'Ninguna cuenta coincide' : 'No hay cuentas abiertas'}
        description={m.activeOrders.length ? 'Prueba otra búsqueda o cambia el filtro.' : 'Cuando un mesero tome un pedido, la cuenta aparece aquí para cobrarla.'}
        action={m.activeOrders.length ? <Btn c={c} size="sm" onPress={() => { a.setOrderSearch(''); a.setOrderFilter('TODOS'); }}>Ver todas</Btn> : <Btn c={c} size="sm" icon={ShoppingBag} onPress={() => go('venta')}>Venta directa</Btn>} /> : null}
    </ScrollView>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.paperAlt }}>
      <T c={c} size={13} color={c.muted}>{m.activeOrders.length} {m.activeOrders.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}</T>
      <T c={c} size={13} color={c.muted}>Por cobrar <Num c={c} size={14} weight="800">{money(porCobrar)}</Num></T>
    </View>
  </View>;

  // ── Comprobante en curso (documento) ──────────────────────────────────────
  const invoice = m.billingMode === 'ID';
  const nextNumber = invoice ? m.caja?.siguiente_factura : m.caja?.siguiente_ticket;
  const docIds = useMemo(() => new Set((sel?.originalOrders || (sel ? [sel] : [])).map(o => Number(o.id))), [sel]);
  const abonos = (m.caja?.pagos || []).filter(p => docIds.has(Number(p.pedido_id)) && String(p.estado || 'ACTIVO') === 'ACTIVO');
  const docOk = !invoice || (m.billingName.trim() && m.billingName !== 'Consumidor Final' && [10, 13].includes(String(m.billingId).length));
  live.current.docOk = !!docOk;
  const document = sel ? <View style={{ padding: phone ? 16 : 24, gap: 20 }}>
    <View style={{ flexDirection: roomy ? 'row' : 'column', gap: 16, alignItems: roomy ? 'flex-start' : 'stretch' }}>
      <View style={{ flex: roomy ? 1 : undefined, minWidth: 0, gap: 4 }}>
        <T c={c} size={phone ? 22 : 26} weight="800" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>{h.orderLabel(sel)}</T>
        <T c={c} size={14} color={c.muted}>{[`Pedido #${sel.id}`, sel.mesero_nombre ? `Atiende ${sel.mesero_nombre}` : null, `Abierta ${hhmm(sel.created_at)}`, KITCHEN[sel.estado]].filter(Boolean).join(' · ')}</T>
      </View>
      <View style={{ gap: roomy ? 8 : 12, width: roomy ? 236 : '100%', flexDirection: roomy ? 'column' : 'row', alignItems: roomy ? 'stretch' : 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ width: roomy ? '100%' : 168 }}><Seg c={c} size="sm" label="Tipo de comprobante" value={m.billingMode} disabled={m.busy} onChange={a.setBillingMode}
          options={[{ value: 'FINAL', label: 'Ticket', a11y: 'Ticket a consumidor final' }, { value: 'ID', label: 'Factura', a11y: 'Factura con cédula o RUC' }]} /></View>
        <View style={{ alignItems: 'flex-end' }}>
          <Lbl c={c}>Próximo número</Lbl>
          <Serial c={c} value={nextNumber} size={roomy ? 20 : 17} />
        </View>
      </View>
    </View>

    {invoice ? <View style={{ gap: 8 }}>
      <Cells c={c}>
        <CellInput c={c} label="Nombre o razón social" basis={phone ? '100%' : '58%'} value={m.billingName === 'Consumidor Final' ? '' : m.billingName} onChangeText={a.setBillingName} editable={!m.busy} placeholder="Como figura en el documento" />
        <CellInput c={c} label="Cédula o RUC" basis={phone ? '100%' : '42%'} value={m.billingId} onChangeText={a.setBillingId} editable={!m.busy} keyboardType="number-pad" maxLength={13} placeholder="10 o 13 dígitos"
          error={m.billingId && ![10, 13].includes(String(m.billingId).length)} />
        <CellInput c={c} label="Correo" basis={phone ? '100%' : '58%'} value={m.billingEmail} onChangeText={a.setBillingEmail} editable={!m.busy} keyboardType="email-address" autoCapitalize="none" placeholder="Opcional" />
        <CellInput c={c} label="Teléfono" basis={phone ? '100%' : '42%'} value={m.billingPhone} onChangeText={a.setBillingPhone} editable={!m.busy} keyboardType="phone-pad" placeholder="Opcional" />
      </Cells>
      {m.billingId && ![10, 13].includes(String(m.billingId).length) ? <T c={c} size={13} color={c.red}>La cédula tiene 10 dígitos y el RUC 13. Van {String(m.billingId).length}.</T> : null}
      {m.matchingClients.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <T c={c} size={13} color={c.faint}>Clientes guardados:</T>
        {m.matchingClients.map(cl => <Btn key={cl.id} c={c} size="sm" onPress={() => a.selectBillingClient(cl)}>{`${cl.nombre} · ${cl.documento}`}</Btn>)}
      </View> : null}
    </View> : <Cells c={c}>
      <Cell c={c} label="Cliente" basis={phone ? '100%' : '58%'}>Consumidor final</Cell>
      <Cell c={c} label="Ubicación" basis={phone ? '100%' : '42%'}>{sel.mesa_id ? `Mesa ${sel.mesa_numero || sel.mesa_id}` : sel.tipo === 'Delivery' ? 'Delivery' : 'Para llevar'}</Cell>
    </Cells>}

    <View accessibilityRole="table" style={{ borderTopWidth: 1, borderColor: c.text }}>
      <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: c.rule, gap: 12 }}>
        <Lbl c={c} style={{ width: 40, textAlign: 'right' }}>Cant.</Lbl>
        <Lbl c={c} style={{ flex: 1 }}>Descripción</Lbl>
        {!phone ? <Lbl c={c} style={{ width: 96, textAlign: 'right' }}>P. unit. con IVA</Lbl> : null}
        <Lbl c={c} style={{ width: 92, textAlign: 'right' }}>Importe</Lbl>
      </View>
      {(sel.items || []).filter(i => Number(i.cantidad) > 0).map((item, idx) => {
        const extra = [item.notas, ...(item.modificadores || []).map(mod => `${mod.nombre}${Number(mod.precio_extra) ? ` +${money(mod.precio_extra)}` : ''}`)].filter(Boolean).join(' · ');
        return <View key={item.id || idx} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line, gap: 12 }}>
          <Num c={c} size={15} weight="700" style={{ width: 40, textAlign: 'right' }}>{item.cantidad}</Num>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T c={c} size={15} weight="600">{item.nombre}</T>
            {extra ? <T c={c} size={13} color={c.faint}>{extra}</T> : null}
          </View>
          {!phone ? <Num c={c} size={14} weight="500" color={c.muted} style={{ width: 96, textAlign: 'right' }}>{money(Number(item.precio) + h.itemExtras(item))}</Num> : null}
          <Num c={c} size={15} weight="700" style={{ width: 92, textAlign: 'right' }}>{money(h.itemLineTotal(item))}</Num>
        </View>;
      })}
    </View>

    <View style={{ flexDirection: phone || !three ? 'column' : 'row', gap: 20, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0, gap: 12, width: phone || !three ? '100%' : undefined }}>
        {sel.notas ? <View style={{ gap: 2 }}><Lbl c={c}>Observaciones</Lbl><T c={c} size={14} color={c.muted}>{sel.notas}</T></View> : null}
        {abonos.length ? <View style={{ gap: 6 }}>
          <Lbl c={c}>Abonos de este turno</Lbl>
          {abonos.map(p => <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Serial c={c} value={p.comprobante_numero} size={13} />
            <T c={c} size={13} color={c.muted} style={{ flex: 1 }}>{p.metodo} · {hhmm(p.created_at)}</T>
            <Num c={c} size={14} weight="700">{money(p.monto)}</Num>
          </View>)}
        </View> : null}
        {m.selectedSplit ? <View style={{ gap: 8 }}>
          <Lbl c={c}>Reparto pedido por el mesero</Lbl>
          {m.selectedSplit.divisions.map(part => { const on = Number(m.divisionId) === Number(part.id); return <View key={part.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <T c={c} size={14} weight="600" style={{ flex: 1 }}>{part.nombre}</T>
            <Num c={c} size={14} weight="700">{money(part.monto)}</Num>
            <Btn c={c} size="sm" variant={on ? 'ink' : 'outline'} disabled={m.busy || part.estado === 'PAGADO'} onPress={() => { a.setChargeMode('PARCIAL'); a.setPartialAmount(Number(part.monto).toFixed(2)); a.setDivisionId(part.id); fresh.current = true; }}>
              {part.estado === 'PAGADO' ? 'Cobrado' : on ? 'Elegido' : 'Cobrar esta parte'}</Btn>
          </View>; })}
        </View> : null}
      </View>
      <View style={{ width: phone || !three ? '100%' : 300, borderWidth: 1, borderColor: c.rule }}>
        <TotalRow c={c} label="Subtotal sin IVA" value={m.subtotal} />
        <TotalRow c={c} label={`IVA ${m.taxPercent != null ? `${String(m.taxPercent).replace('.', ',')} %` : ''}`.trim()} value={m.tax} />
        {Number(m.service) > 0 ? <TotalRow c={c} label="Servicio" value={m.service} /> : null}
        <TotalRow c={c} label="Total" value={m.total} strong />
        {Number(sel.abonado) > 0 ? <>
          <TotalRow c={c} label="Abonado" value={`−${money(sel.abonado)}`} tone="green" />
          <TotalRow c={c} label="Saldo" value={m.balanceDue} strong />
        </> : null}
      </View>
    </View>
  </View> : <Empty c={c} icon={Receipt} title="Elige una cuenta para cobrar"
    description="Las cuentas que pidieron cobro aparecen primero. Busca con F2 o empieza una venta directa con F3."
    action={<Btn c={c} icon={ShoppingBag} onPress={() => go('venta')} kbd="F3">Venta directa</Btn>} />;

  // ── Panel de cobro ─────────────────────────────────────────────────────────
  const received = toNum(m.cashReceived || 0);
  const missing = Math.max(0, Math.round(m.cashPortion * 100) - Math.round((received || 0) * 100)) / 100;
  const chargeLabel = `Cobrar ${money(Number.isFinite(m.chargeAmount) ? m.chargeAmount : 0)}`;
  const blockers = [];
  if (sel) {
    if (!openCaja) blockers.push('La caja está cerrada.');
    else if (!m.canManageCash) blockers.push('Tu usuario no puede cobrar.');
    if (m.chargeMode === 'PARCIAL' && !(m.chargeAmount > 0)) blockers.push('Escribe el monto del abono.');
    else if (m.chargeAmount > m.balanceDue + 0.0001) blockers.push(`El abono supera el saldo (${money(m.balanceDue)}).`);
    if (m.paymentMethod === 'Mixto' && Math.round(m.mixedTotal * 100) !== Math.round(m.chargeAmount * 100)) blockers.push(`El desglose suma ${money(m.mixedTotal)} y debe sumar ${money(m.chargeAmount)}.`);
    if (invoice && !docOk) blockers.push('Completa nombre y cédula o RUC.');
  }
  const display = (t, label, value, hint) => {
    const on = target === t;
    return <Press key={t} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${label}: ${money(toNum(value || 0))}. Tocar para escribir con el teclado`}
      onPress={() => { setTarget(t); fresh.current = true; }} scaleTo={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: r.md, borderWidth: on ? 2 : 1,
        borderColor: on ? c.blue : c.rule, backgroundColor: c.paper }}>
      <View style={{ gap: 1 }}><T c={c} size={13} weight="600" color={c.muted}>{label}</T>{hint ? <T c={c} size={12} color={c.faint}>{hint}</T> : null}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Num c={c} size={22} weight="800">{value === '' || value == null ? '$0' : `$${String(value).replace('.', ',')}`}</Num>
        {on ? <View style={{ width: 2, height: 22, backgroundColor: c.blue, marginLeft: 2 }} /> : null}
      </View>
    </Press>;
  };
  const quick = m.cashPortion > 0 ? [...new Set([m.cashPortion, Math.ceil(m.cashPortion / 5) * 5, Math.ceil(m.cashPortion / 10) * 10, Math.ceil(m.cashPortion / 20) * 20, 50, 100].filter(v => v >= m.cashPortion))].slice(0, 4) : [];
  const usesPad = m.cashPortion > 0 || m.chargeMode === 'PARCIAL' || m.paymentMethod === 'Mixto';
  const payPanel = sel ? <View style={{ padding: phone ? 16 : 20, gap: 14 }}>
    <View style={{ gap: 2 }}>
      <T c={c} size={14} weight="600" color={c.muted}>{m.chargeMode === 'PARCIAL' ? 'Saldo de la cuenta' : 'Por cobrar'}</T>
      <Num c={c} size={40} weight="800" accessibilityLabel={`Por cobrar ${money(m.balanceDue)}`}>{money(m.balanceDue)}</Num>
    </View>
    <Seg c={c} label="Cuánto se cobra" value={m.chargeMode} disabled={m.busy} onChange={v => { a.setChargeMode(v); a.setDivisionId(null); if (v === 'TOTAL') a.setPartialAmount(''); }}
      options={[{ value: 'TOTAL', label: 'Todo el saldo' }, { value: 'PARCIAL', label: m.selectedSplit ? 'Una parte' : 'Abono parcial' }]} />
    {m.chargeMode === 'PARCIAL' ? display('abono', 'Monto de este abono', m.partialAmount, m.chargeAmount > 0 && m.chargeAmount <= m.balanceDue ? `Queda ${money(m.balanceDue - m.chargeAmount)}` : null) : null}
    <View style={{ gap: 6 }}>
      <T c={c} size={13} weight="600" color={c.muted}>Forma de pago</T>
      <Seg c={c} wrap size="sm" label="Forma de pago" value={m.paymentMethod} disabled={m.busy} onChange={a.setPaymentMethod}
        options={m.paymentMethods.map(pm => ({ value: pm.label, label: pm.label === 'Transferencia' ? 'Transf.' : pm.label, a11y: pm.label, icon: roomy ? METHOD_ICON[pm.label] : undefined, basis: '30%' }))} />
    </View>
    {m.paymentMethod === 'Mixto' ? <View style={{ gap: 8 }}>
      {m.paymentMethods.filter(pm => pm.label !== 'Mixto').map(pm => (target === pm.label || toNum(m.mixedAmounts[pm.label]) > 0 || ['Efectivo', 'Tarjeta'].includes(pm.label)) ? display(pm.label, pm.label, m.mixedAmounts[pm.label] || '') : null)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {m.paymentMethods.filter(pm => pm.label !== 'Mixto' && !['Efectivo', 'Tarjeta'].includes(pm.label) && target !== pm.label && !(toNum(m.mixedAmounts[pm.label]) > 0)).map(pm =>
          <Btn key={pm.label} c={c} size="sm" variant="ghost" icon={Plus} onPress={() => { setTarget(pm.label); fresh.current = true; }}>{pm.label}</Btn>)}
      </View>
      <T c={c} size={13} weight="600" color={Math.round(m.mixedTotal * 100) === Math.round(m.chargeAmount * 100) ? c.green : c.amber}>
        Desglose {money(m.mixedTotal)} de {money(m.chargeAmount)}</T>
    </View> : null}
    {m.cashPortion > 0 ? <View style={{ gap: 8 }}>
      {display('recibido', m.paymentMethod === 'Mixto' ? 'Recibido en efectivo' : 'Efectivo recibido', m.cashReceived, m.paymentMethod === 'Mixto' ? `Parte en efectivo ${money(m.cashPortion)}` : null)}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {quick.map(v => <Btn key={v} c={c} size="sm" style={{ flex: 1, paddingHorizontal: 4 }} disabled={m.busy}
          onPress={() => { a.setCashReceived(v.toFixed(2)); fresh.current = true; setTarget('recibido'); }}>{v === m.cashPortion ? 'Exacto' : money(v).replace(',00', '')}</Btn>)}
      </View>
    </View> : null}
    {usesPad ? <Keypad c={c} onKey={pressKey} disabled={m.busy} compact={!roomy || phone} /> : null}
    {m.paymentMethod !== 'Efectivo' ? <View style={{ gap: 6 }}>
      <T c={c} size={13} weight="600" color={c.muted}>Referencia</T>
      <TextInput value={m.reference} onChangeText={a.setReference} editable={!m.busy} placeholder="Voucher, n.º de transferencia o nota" placeholderTextColor={c.faint} accessibilityLabel="Referencia del pago"
        style={[{ height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper, fontFamily: FONT, fontSize: 15, color: c.text }, WEB ? { outlineStyle: 'none' } : null]} />
    </View> : null}
  </View> : <View style={{ padding: 20, gap: 14 }}>
    <T c={c} size={16} weight="800">Resumen del salón</T>
    <View style={{ borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
      <TotalRow c={c} label="Cuentas abiertas" value={String(m.activeOrders.length)} />
      <TotalRow c={c} label="Pidieron la cuenta" value={String(countFor('CUENTA'))} tone={countFor('CUENTA') ? 'amber' : undefined} />
      <TotalRow c={c} label="Cobrado en el turno" value={Number(m.turnTotals.total || 0)} />
      <TotalRow c={c} label="Por cobrar" value={porCobrar} strong />
    </View>
    {!openCaja ? <Btn c={c} variant="ink" icon={WalletCards} onPress={a.handleOpenCaja} disabled={!m.canManageCash}>Abrir caja</Btn> : null}
    <T c={c} size={13} color={c.faint}>F2 buscar · F3 venta directa · F8 cobrar · F9 precuenta · Esc volver a la lista</T>
  </View>;

  // Pie fijo del panel de cobro en escritorio: el botón siempre a la vista.
  const changeLine = sel && m.cashPortion > 0 ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderRadius: r.md,
    backgroundColor: missing > 0 ? c.paperAlt : c.greenSoft }}>
    <T c={c} size={15} weight="700" color={missing > 0 ? c.text : c.green}>{missing > 0 ? 'Falta' : 'Cambio'}</T>
    <Num c={c} size={24} weight="800" color={missing > 0 ? c.text : c.green}>{money(missing > 0 ? missing : m.change)}</Num>
  </View> : null;
  const chargeFoot = sel ? <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
    {changeLine}
    {blockers.length ? <T c={c} size={13} color={c.amber} accessibilityLiveRegion="polite" numberOfLines={2}>{blockers[0]}</T> : <T c={c} size={13} color={c.faint} numberOfLines={1}>Se emite {invoice ? 'factura' : 'ticket'} {nextNumber || ''}{WEB ? ' · F9 precuenta' : ''}</T>}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Btn c={c} icon={Printer} onPress={() => a.printReceipt()} disabled={m.busy} accessibilityLabel="Imprimir precuenta (F9)" style={{ width: 56, paddingHorizontal: 0 }} size="lg">{null}</Btn>
      <Btn c={c} variant="ink" size="lg" full icon={Receipt} onPress={a.handleCharge} loading={m.busy} disabled={!m.canCharge || !!m.pendingPayment || !docOk} kbd="F8">{chargeLabel}</Btn>
    </View>
  </View> : null;

  // Barra fija de cobro (celular y tablet vertical).
  const chargeBar = sel ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 + BOTTOM_INSET, gap: 6, borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
    {changeLine}
    {blockers.length ? <T c={c} size={13} color={c.amber} numberOfLines={1}>{blockers[0]}</T> : null}
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Btn c={c} icon={Printer} onPress={() => a.printReceipt()} disabled={m.busy} accessibilityLabel="Imprimir precuenta">{phone ? null : 'Precuenta'}</Btn>
      <Btn c={c} variant="ink" size="lg" full icon={Receipt} onPress={a.handleCharge} loading={m.busy} disabled={!m.canCharge || !!m.pendingPayment || !docOk}>{chargeLabel}</Btn>
    </View>
  </View> : null;

  const closedBanner = !openCaja ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.amberSoft, borderBottomWidth: 1, borderColor: c.line }}>
    <T c={c} size={14} weight="600" color={c.amber} style={{ flex: 1 }}>La caja está cerrada: puedes revisar cuentas, pero para cobrar hay que abrir el turno.</T>
    <Btn c={c} size="sm" variant="ink" icon={WalletCards} onPress={a.handleOpenCaja} disabled={!m.canManageCash}>Abrir caja</Btn>
  </View> : null;

  const cobrar = three
    ? <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: roomy ? 340 : 290, borderRightWidth: 1, borderColor: c.rule }}>{accounts}</View>
      <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ flexGrow: 1 }}>{document}</ScrollView>
      <View style={{ width: roomy ? 380 : 340, borderLeftWidth: 1, borderColor: c.rule, backgroundColor: c.paperAlt }}>
        <ScrollView style={{ flex: 1 }}>{payPanel}</ScrollView>{chargeFoot}
      </View>
    </View>
    : two
      ? <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 290, borderRightWidth: 1, borderColor: c.rule }}>{accounts}</View>
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, backgroundColor: c.paper }}>{document}{sel ? <View style={{ borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paperAlt }}>{payPanel}</View> : null}</ScrollView>
          {chargeBar}
        </View>
      </View>
      : sel
        ? <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, height: 48, borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.paper }}>
            <IconBtn c={c} icon={ArrowLeft} label="Volver a las cuentas" onPress={a.closeOrder} size={44} />
            <T c={c} size={15} weight="700" numberOfLines={1} style={{ flex: 1 }}>{h.orderLabel(sel)}</T>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: c.paper }}>{document}<View style={{ borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paperAlt }}>{payPanel}</View></ScrollView>
          {chargeBar}
        </View>
        : accounts;

  // ── Venta directa ──────────────────────────────────────────────────────────
  const qtyOf = id => m.cart.find(i => Number(i.producto_id) === Number(id))?.cantidad || 0;
  const [gridW, setGridW] = useState(0);
  const cols = Math.max(2, Math.floor((gridW - 24 + 8) / (phone ? 150 : 190)));
  const tileW = gridW ? Math.floor((gridW - 24 - (cols - 1) * 8) / cols) : (phone ? '48%' : '31%');
  const catalog = <View style={{ flex: 1, backgroundColor: c.paper }}>
    <View style={{ padding: 12, gap: 10, borderBottomWidth: 1, borderColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: r.md, borderWidth: 1, borderColor: c.rule }}>
        <View style={{ flexShrink: 0 }}><Search size={17} color={c.faint} /></View>
        <TextInput value={m.menuSearch} onChangeText={a.setMenuSearch} placeholder="Buscar producto" placeholderTextColor={c.faint} accessibilityLabel="Buscar producto"
          style={[{ flex: 1, fontFamily: FONT, fontSize: 15, color: c.text, height: 42 }, WEB ? { outlineStyle: 'none' } : null]} />
        {m.menuSearch ? <IconBtn c={c} icon={X} label="Borrar búsqueda" onPress={() => a.setMenuSearch('')} size={30} /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {m.menuCategories.map(cat => { const on = cat === m.menuCategory; return <Press key={cat} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => a.setMenuCategory(cat)} scaleTo={0.97}
          hoverStyle={on ? null : { backgroundColor: c.hover }}
          style={{ height: 32, paddingHorizontal: 10, borderRadius: r.md, justifyContent: 'center', borderWidth: 1, borderColor: on ? 'transparent' : c.rule, backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : c.paper }}>
          <T c={c} size={13} weight={on ? '700' : '600'} color={on ? (c.isDark ? c.ink : c.onInk) : c.muted}>{cat === 'TODAS' ? 'Todo' : cat}</T>
        </Press>; })}
      </ScrollView>
    </View>
    <ScrollView style={{ flex: 1 }} onLayout={e => setGridW(e.nativeEvent.layout.width)} contentContainerStyle={{ padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {m.filteredMenu.map(p => { const q = qtyOf(p.id); return <Press key={p.id} accessibilityRole="button" accessibilityLabel={`Agregar ${p.nombre}, ${money(p.precio)}${q ? `, van ${q}` : ''}`}
        disabled={m.orderBusy || !m.canManageCash} onPress={() => { haptic('tap'); a.addToCart(p); }} scaleTo={0.97} hoverStyle={{ borderColor: c.text }}
        style={{ width: tileW, minHeight: 84, padding: 12, borderRadius: r.md, borderWidth: q ? 2 : 1, borderColor: q ? c.text : c.rule, backgroundColor: c.paper, justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
          <T c={c} size={14} weight="700" style={{ flex: 1 }} numberOfLines={2}>{p.nombre}</T>
          {q ? <Num c={c} size={13} weight="800" color={c.isDark ? c.ink : c.onInk} style={{ minWidth: 22, textAlign: 'center', paddingHorizontal: 5, borderRadius: 3, backgroundColor: c.isDark ? c.onInk : c.ink }}>{q}</Num> : null}
        </View>
        <Num c={c} size={15} weight="700" color={c.muted}>{money(p.precio)}</Num>
      </Press>; })}
      {!m.filteredMenu.length ? <View style={{ width: '100%' }}><Empty c={c} icon={Search} title="Sin productos" description="Prueba con otro nombre o categoría. Los productos agotados no aparecen." /></View> : null}
    </ScrollView>
  </View>;
  const draft = <View style={{ flex: 1, backgroundColor: c.paperAlt }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T c={c} size={18} weight="800" accessibilityRole="header">Nueva venta</T>
        {m.cart.length ? <Btn c={c} size="sm" variant="ghost" icon={Trash2} onPress={a.clearCart} disabled={m.orderBusy}>Vaciar</Btn> : null}
      </View>
      <Seg c={c} size="sm" label="Tipo de venta" value={m.saleType} disabled={m.orderBusy} onChange={a.setSaleType} options={[{ value: 'Para llevar', label: 'Para llevar' }, { value: 'Delivery', label: 'Delivery' }]} />
      <Cells c={c}>
        <CellInput c={c} label={m.saleType === 'Delivery' ? 'Nombre del delivery' : 'A nombre de'} basis="100%" value={m.customer.nombre} onChangeText={a.setCustomerName} editable={!m.orderBusy} placeholder="Nombre del cliente" error={!!m.customerError} />
      </Cells>
      {m.customerError ? <T c={c} size={13} color={c.red}>{m.customerError}</T> : null}
      <View style={{ borderTopWidth: 1, borderColor: c.text }}>
        {m.cart.map(item => <View key={item.producto_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.line }}>
          <View style={{ flex: 1, minWidth: 0 }}><T c={c} size={14} weight="600" numberOfLines={1}>{item.nombre}</T><Num c={c} size={13} weight="500" color={c.faint}>{money(item.precio)} c/u</Num></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.rule, borderRadius: r.md }}>
            <IconBtn c={c} icon={Minus} label={`Quitar una unidad de ${item.nombre}`} onPress={() => a.changeCartQty(item.producto_id, -1)} disabled={m.orderBusy} size={36} />
            <Num c={c} size={15} weight="800" style={{ minWidth: 24, textAlign: 'center' }}>{item.cantidad}</Num>
            <IconBtn c={c} icon={Plus} label={`Añadir una unidad de ${item.nombre}`} onPress={() => a.changeCartQty(item.producto_id, 1)} disabled={m.orderBusy} size={36} />
          </View>
          <Num c={c} size={15} weight="700" style={{ width: 76, textAlign: 'right' }}>{money(item.precio * item.cantidad)}</Num>
        </View>)}
        {!m.cart.length ? <T c={c} size={14} color={c.faint} style={{ paddingVertical: 16 }}>Toca productos del catálogo para agregarlos.</T> : null}
      </View>
      <TextInput value={m.saleNote} onChangeText={a.setSaleNote} editable={!m.orderBusy} placeholder="Indicaciones para cocina (opcional)" placeholderTextColor={c.faint} accessibilityLabel="Indicaciones para cocina" multiline
        style={[{ minHeight: 60, padding: 10, borderRadius: r.md, borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper, fontFamily: FONT, fontSize: 14, color: c.text, textAlignVertical: 'top' }, WEB ? { outlineStyle: 'none' } : null]} />
      <View style={{ borderWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
        <TotalRow c={c} label="Productos" value={m.cartSubtotal} />
        {m.cartTotal - m.cartSubtotal > 0.004 ? <TotalRow c={c} label="Servicio" value={m.cartTotal - m.cartSubtotal} /> : null}
        <TotalRow c={c} label="Total" value={m.cartTotal} strong />
      </View>
    </ScrollView>
    <View style={{ padding: 16, paddingBottom: 16 + (phone ? BOTTOM_INSET : 0), gap: 6, borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
      {!openCaja ? <T c={c} size={13} color={c.amber}>Abre la caja para registrar ventas.</T> : null}
      <Btn c={c} variant="ink" size="lg" full icon={ArrowUpRight} onPress={a.createPickupOrder} loading={m.orderBusy} disabled={!m.cart.length || !openCaja || !m.canManageCash}>{m.cart.length ? `Enviar a cocina · ${money(m.cartTotal)}` : 'Enviar a cocina'}</Btn>
    </View>
  </View>;
  const [phoneDraft, setPhoneDraft] = useState(false);
  const cartCount = m.cart.reduce((s, i) => s + Number(i.cantidad || 0), 0);
  const venta = two
    ? <View style={{ flex: 1, flexDirection: 'row' }}><View style={{ flex: 1, borderRightWidth: 1, borderColor: c.rule }}>{catalog}</View><View style={{ width: three ? (roomy ? 420 : 380) : 340 }}>{draft}</View></View>
    : phoneDraft ? <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, height: 48, borderBottomWidth: 1, borderColor: c.line, backgroundColor: c.paper }}>
        <IconBtn c={c} icon={ArrowLeft} label="Volver al catálogo" onPress={() => setPhoneDraft(false)} size={44} /><T c={c} size={15} weight="700">Catálogo</T>
      </View>{draft}</View>
      : <View style={{ flex: 1 }}>{catalog}
        {cartCount ? <View style={{ padding: 12, borderTopWidth: 1, borderColor: c.rule, backgroundColor: c.paper }}>
          <Btn c={c} variant="ink" size="lg" full onPress={() => setPhoneDraft(true)}>{`Ver venta · ${cartCount} · ${money(m.cartTotal)}`}</Btn>
        </View> : null}
      </View>;

  // ── Turno ──────────────────────────────────────────────────────────────────
  const tt = m.turnTotals || {};
  const fondo = Number(m.caja?.caja?.monto_inicial || 0);
  const moves = m.caja?.movimientos || [];
  const ledger = useMemo(() => {
    const rows = [{ label: 'Fondo de apertura', amount: fondo, sign: 1, at: m.caja?.caja?.fecha_apertura }];
    rows.push({ label: 'Cobros en efectivo', amount: Number(tt.efectivo || 0), sign: 1 });
    [...moves].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))).forEach(mv => {
      const t = String(mv.tipo || '').toUpperCase();
      if (String(mv.metodo || 'Efectivo') !== 'Efectivo' || !['INGRESO', 'RETIRO', 'GASTO'].includes(t)) return;
      rows.push({ label: `${t === 'INGRESO' ? 'Ingreso' : t === 'RETIRO' ? 'Retiro' : 'Gasto'}: ${mv.motivo || 'sin motivo'}`, amount: Number(mv.monto || 0), sign: t === 'INGRESO' ? 1 : -1, at: mv.created_at });
    });
    let run = 0; const out = rows.map(row => { run = Math.round((run + row.sign * row.amount) * 100) / 100; return { ...row, run }; });
    const expected = m.caja?.efectivo_esperado;
    const devol = Number(tt.devoluciones || 0);
    if (devol > 0 && Math.round((run - devol - Number(expected)) * 100) >= -1 && expected != null && Number(expected) < run) { run = Math.round((run - Math.min(devol, run - Number(expected))) * 100) / 100; out.push({ label: 'Devoluciones', amount: devol, sign: -1, run }); }
    if (expected != null && Math.abs(Number(expected) - run) >= 0.01) out.push({ label: 'Diferencia sin detallar (según el sistema)', amount: Math.abs(Number(expected) - run), sign: Number(expected) > run ? 1 : -1, run: Number(expected), warn: true });
    return out;
  }, [fondo, tt.efectivo, tt.devoluciones, moves, m.caja?.efectivo_esperado]);
  const methods = Object.entries(m.stats.byMethod).filter(([k, v]) => v > 0 || ['Efectivo', 'Tarjeta', 'Transferencia'].includes(k));
  const turno = !openCaja ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: phone ? 16 : 32, alignItems: 'center' }}>
    <View style={{ width: '100%', maxWidth: 640, backgroundColor: c.paper, borderWidth: 1, borderColor: c.rule, padding: phone ? 20 : 28, gap: 16 }}>
      <T c={c} size={22} weight="800" accessibilityRole="header">La caja está cerrada</T>
      <T c={c} size={15} color={c.muted}>Abre el turno con el fondo de efectivo que hay en el cajón. Desde ese momento se registran los cobros, ingresos, retiros y gastos.</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn c={c} variant="ink" size="lg" icon={WalletCards} onPress={a.handleOpenCaja} disabled={!m.canManageCash}>Abrir caja</Btn>
        <Btn c={c} size="lg" icon={Clock} onPress={a.showHistory}>Cierres anteriores</Btn>
      </View>
      {m.caja?.cierres?.[0] ? <View style={{ borderWidth: 1, borderColor: c.rule }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.paperAlt, borderBottomWidth: 1, borderColor: c.rule }}><T c={c} size={14} weight="700">Último cierre · caja #{m.caja.cierres[0].id}</T></View>
        <TotalRow c={c} label="Ventas" value={Number(m.caja.cierres[0].total_ventas || 0)} />
        <TotalRow c={c} label="Efectivo esperado" value={Number(m.caja.cierres[0].efectivo_esperado || 0)} />
        <TotalRow c={c} label="Efectivo contado" value={Number(m.caja.cierres[0].monto_final || 0)} />
        <TotalRow c={c} label="Diferencia" value={Number(m.caja.cierres[0].diferencia_cierre || 0)} strong tone={Number(m.caja.cierres[0].diferencia_cierre) < 0 ? 'red' : Number(m.caja.cierres[0].diferencia_cierre) > 0 ? 'amber' : 'green'} />
      </View> : null}
    </View>
  </ScrollView> : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: phone ? 12 : 24, gap: 16, flexDirection: three ? 'row' : 'column', alignItems: 'flex-start' }}>
    <View style={{ flex: three ? 1 : undefined, width: three ? undefined : '100%', minWidth: 0, backgroundColor: c.paper, borderWidth: 1, borderColor: c.rule, padding: phone ? 16 : 24, gap: 20 }}>
      <View style={{ gap: 4 }}>
        <T c={c} size={22} weight="800" accessibilityRole="header">Corte del turno #{m.caja.caja.id}</T>
        <T c={c} size={14} color={c.muted}>Abierto {parseDate(m.caja.caja.fecha_apertura)?.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) || '—'} · {m.user?.nombre || 'Caja'}</T>
      </View>
      <Cells c={c}>
        <Cell c={c} label="Fondo de apertura" basis={phone ? '50%' : '25%'}><Num c={c} size={18} weight="800">{money(fondo)}</Num></Cell>
        <Cell c={c} label="Cobrado" basis={phone ? '50%' : '25%'}><Num c={c} size={18} weight="800">{money(tt.total)}</Num></Cell>
        <Cell c={c} label="Comprobantes" basis={phone ? '50%' : '25%'}><Num c={c} size={18} weight="800">{Number(tt.pagos || 0)}</Num></Cell>
        <Cell c={c} label="Efectivo en caja" basis={phone ? '50%' : '25%'}><Num c={c} size={18} weight="800">{money(m.caja?.efectivo_esperado)}</Num></Cell>
      </Cells>
      <View style={{ gap: 8 }}>
        <T c={c} size={16} weight="800">Cobros por forma de pago</T>
        <View style={{ borderTopWidth: 1, borderColor: c.text }}>
          {methods.map(([k, v]) => { const Icon = METHOD_ICON[k] || WalletCards; const share = Number(tt.total) > 0 ? v / Number(tt.total) : 0; return <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderColor: c.line }}>
            <Icon size={16} color={c.faint} /><T c={c} size={14} weight="600" style={{ width: 110 }}>{k}</T>
            <View style={{ flex: 1 }} />
            <Num c={c} size={13} weight="600" color={c.faint} style={{ width: 40, textAlign: 'right' }}>{Math.round(share * 100)}%</Num>
            <Num c={c} size={15} weight="700" style={{ width: 96, textAlign: 'right' }}>{money(v)}</Num>
          </View>; })}
          <View style={{ flexDirection: 'row', paddingVertical: 10, backgroundColor: c.paperAlt, paddingHorizontal: 8 }}>
            <T c={c} size={15} weight="800" style={{ flex: 1 }}>Total cobrado</T><Num c={c} size={17} weight="800">{money(tt.total)}</Num>
          </View>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <T c={c} size={16} weight="800">Libro de efectivo</T>
        <View style={{ borderTopWidth: 1, borderColor: c.text }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderColor: c.rule }}>
            <Lbl c={c} style={{ flex: 1 }}>Concepto</Lbl>{!phone ? <Lbl c={c} style={{ width: 48 }}>Hora</Lbl> : null}<Lbl c={c} style={{ width: 92, textAlign: 'right' }}>Monto</Lbl><Lbl c={c} style={{ width: 92, textAlign: 'right' }}>Saldo</Lbl>
          </View>
          {ledger.map((row, i) => <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderColor: c.line }}>
            <T c={c} size={14} weight="500" color={row.warn ? c.amber : c.text} style={{ flex: 1 }} numberOfLines={2}>{row.label}</T>
            {!phone ? <Num c={c} size={13} weight="500" color={c.faint} style={{ width: 48 }}>{row.at ? hhmm(row.at) : ''}</Num> : null}
            <Num c={c} size={14} weight="600" color={row.warn ? c.amber : c.text} style={{ width: 92, textAlign: 'right' }}>{`${row.sign < 0 ? '−' : '+'}${money(row.amount)}`}</Num>
            <Num c={c} size={14} weight="700" style={{ width: 92, textAlign: 'right' }}>{money(row.run)}</Num>
          </View>)}
          <View style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: c.paperAlt }}>
            <T c={c} size={15} weight="800" style={{ flex: 1 }}>Debe haber en el cajón</T><Num c={c} size={17} weight="800">{money(m.caja?.efectivo_esperado)}</Num>
          </View>
        </View>
      </View>
    </View>
    <View style={{ width: three ? 320 : '100%', gap: 12 }}>
      <View style={{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.rule, padding: 16, gap: 8 }}>
        <T c={c} size={15} weight="800">Movimientos de efectivo</T>
        <Btn c={c} icon={ArrowDownLeft} onPress={() => a.openMovement('INGRESO')} disabled={!m.canManageCash}>Registrar ingreso</Btn>
        <Btn c={c} icon={ArrowUpRight} onPress={() => a.openMovement('RETIRO')} disabled={!m.canManageCash}>Registrar retiro</Btn>
        <Btn c={c} icon={Ban} onPress={() => a.openMovement('GASTO')} disabled={!m.canManageCash}>Registrar gasto</Btn>
      </View>
      <View style={{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.rule, padding: 16, gap: 8 }}>
        <T c={c} size={15} weight="800">Cierre</T>
        <T c={c} size={13} color={c.muted}>El corte X se imprime sin cerrar. El cierre pide contar billetes y monedas y deja registrada la diferencia.</T>
        <Btn c={c} icon={Printer} onPress={a.printShiftReport}>Imprimir corte X</Btn>
        <Btn c={c} icon={Clock} onPress={a.showHistory}>Cierres anteriores</Btn>
        <Btn c={c} variant="ink" icon={Store} onPress={a.handleCloseCaja} disabled={!m.canManageCash || m.cashBusy}>Cerrar turno</Btn>
      </View>
    </View>
  </ScrollView>;

  const body = view === 'cobrar' ? <>{closedBanner}{cobrar}</> : view === 'venta' ? venta : view === 'comprobantes'
    ? <CashierPayments c={c} phone={phone} onReprint={a.reprintPayment} onAuthorize={a.openPaymentAuthorization} canAuthorize={m.canRequestPaymentActions} busy={m.adminBusy || m.printBusy} version={m.historyVersion} />
    : turno;

  const webAttr = WEB ? { dataSet: { caja: '1', ...(c.isDark ? { cajaDark: '1' } : {}) } } : {};
  return <SafeAreaView {...webAttr} style={{ flex: 1, backgroundColor: c.ground }}>
    {topBar}
    {notices}
    <View style={{ flex: 1, minHeight: 0 }}>{body}</View>
    {phone && !(view === 'cobrar' && sel) && !(view === 'venta' && phoneDraft) ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.ink, paddingBottom: BOTTOM_INSET }}>
      {nav.map(n => { const on = view === n.key; const Icon = n.icon; return <Press key={n.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={n.label} onPress={() => go(n.key)} scaleTo={0.96}
        style={{ flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3, borderTopWidth: 3, borderColor: on ? c.onInk : 'transparent' }}>
        <Icon size={19} color={on ? c.onInk : c.inkMuted} />
        <T c={c} size={11} weight={on ? '700' : '500'} color={on ? c.onInk : c.inkMuted}>{n.short || n.label}{n.count ? ` ${n.count}` : ''}</T>
      </Press>; })}
    </View> : null}
  </SafeAreaView>;
}
