import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedPaymentText } from '../utils/paymentReceipt.mjs';
import CashierWorkspace from './CashierWorkspace';
import CajaDialogs from '../components/cashier/dialogs';
import { tokens as cajaTokens } from '../components/cashier/kit';
import { receiptTotals } from '../utils/cashLogic.mjs';
import { runExclusive } from '../utils/waiterLogic.mjs';
import { groupUnpaidAccounts } from '../utils/accountLogic.mjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Banknote,
  CreditCard,
  Gift,
  Hash,
  Printer,
  Receipt,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react-native';
import axios from 'axios';
import { AdminProvider, useAdmin } from '../context/AdminContext';
import { BASE_URL, assetUrl, useAuth } from '../context/AuthContext';
import { useTheme, palette } from '../theme';
import Logo from '../components/Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { ALERT_TONES, installWebAudioUnlock, playWebAlertTone } from '../services/webAudioAlerts';
import { REALTIME_EVENTS, subscribeRealtime } from '../services/realtime';

const ACTIVE_STATES = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO'];

const POS = Object.fromEntries(Object.entries(palette).map(([mode, c]) => [mode, {
  ...c, accent: c.primary, sidebar: '#151632', appBar: '#151632', blue: c.sky, blueSoft: c.skySoft,
}]));

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function normalizeState(value) {
  const normalized = normalizeText(value);
  const map = {
    pendiente: 'PENDIENTE',
    preparando: 'PREPARANDO',
    'en preparacion': 'PREPARANDO',
    listo: 'LISTO',
    entregado: 'ENTREGADO',
    pagado: 'PAGADO',
    completado: 'PAGADO',
    cancelado: 'CANCELADO',
  };
  return map[normalized] || String(value || '').toUpperCase();
}

function itemExtras(item) {
  return (item.modificadores || []).reduce(
    (sum, mod) => sum + Number(mod.precio_extra || 0),
    0
  );
}

function modifierLabel(mod) {
  return `${mod.nombre}${Number(mod.precio_extra || 0) ? ` +${money(mod.precio_extra)}` : ''}`;
}

function itemLineTotal(item) {
  return (Number(item.precio || 0) + itemExtras(item)) * Number(item.cantidad || 0);
}

function cartLineTotal(item) {
  return Number(item.precio || 0) * Number(item.cantidad || 0);
}

function moneyWithSettings(value, settings = {}) {
  const symbol = settings.simbolo_moneda || '$';
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

function centerText(value, width = 42) {
  const text = String(value || '').trim();
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}`;
}

function receiptRow(left, right, width = 42) {
  const l = String(left || '');
  const r = String(right || '');
  const space = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(space)}${r}`;
}

function separator(width = 42) {
  return '-'.repeat(width);
}

function isPickupOrder(order) {
  return !order?.mesa_id || ['Para llevar', 'Delivery'].includes(order?.tipo);
}

function orderLabel(order) {
  if (!order) return 'Pedido';
  if (isPickupOrder(order)) {
    const prefix = order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar';
    return `${prefix} #${order.id || '-'}: ${order.cliente_nombre || 'Cliente'}`;
  }
  return `Mesa ${order.mesa_numero || order.mesa_id || '-'}`;
}

function pickupDetail(order) {
  if (!isPickupOrder(order)) return '';
  if (order.tipo === 'Delivery') {
    return [
      order.delivery_telefono,
      order.delivery_direccion,
      order.delivery_referencia,
      order.cliente_dato,
    ]
      .filter(Boolean)
      .join(' - ') || 'Delivery';
  }
  return order.cliente_dato || 'Para recoger';
}

function isBillRequested(order) {
  return !!order?.cuenta_solicitada_at;
}

function compactTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function businessHeader(settings = {}, width = 42) {
  const businessName = settings.nombre_restaurante || 'Morena Mia';
  return [
    centerText(businessName.toUpperCase(), width),
    settings.razon_social ? centerText(settings.razon_social, width) : '',
    settings.ruc ? centerText(`RUC: ${settings.ruc}`, width) : '',
    settings.direccion ? centerText(settings.direccion, width) : '',
    settings.telefono ? centerText(`Tel: ${settings.telefono}`, width) : '',
    settings.correo ? centerText(settings.correo, width) : '',
  ].filter(Boolean);
}

function saleItemLines(order, settings = {}) {
  const moneyFmt = (value) => moneyWithSettings(value, settings);
  return (order.items || []).flatMap((item) => {
    const lineName = `${item.cantidad} x ${item.nombre}`;
    return [
      receiptRow(lineName.slice(0, 28), moneyFmt(itemLineTotal(item))),
      item.notas ? `  Nota: ${item.notas}` : '',
      ...(item.modificadores || []).map((mod) => `  + ${modifierLabel(mod)}`),
    ].filter(Boolean);
  });
}

function saleTotals(order, settings = {}) {
  return order?.totales_cobro || receiptTotals(order || {}, settings.iva_porcentaje);
}

function buildCustomerTicket(order, method, cashReceived, reference, billing = {}, settings = {}) {
  const {
    subtotal,
    tax,
    service,
    total
  } = saleTotals(order, settings);
  const change = Math.max(0, Number(cashReceived || 0) - total);
  const moneyFmt = value => moneyWithSettings(value, settings);
  return [...businessHeader(settings), separator(), centerText(billing.number ? 'TICKET CLIENTE' : 'PRECUENTA - SIN COBRAR'), billing.number ? receiptRow('No.', billing.number) : '', centerText('CONSUMIDOR FINAL'), separator(), receiptRow('Pedido', `#${order.id}`), receiptRow('Fecha', new Date().toLocaleString('es-EC')), receiptRow('Orden', orderLabel(order)), isPickupOrder(order) ? pickupDetail(order) : '', separator(), ...saleItemLines(order, settings), separator(), receiptRow('Subtotal', moneyFmt(subtotal)), receiptRow(`IVA ${Number(order?.totales_cobro?.taxPercent ?? settings.iva_porcentaje ?? 0)}%`, moneyFmt(tax)), service > 0 ? receiptRow('Servicio incluido', moneyFmt(service)) : '', receiptRow('TOTAL', moneyFmt(total)), Number(order.abonado)>0 ? receiptRow('Abonos', moneyFmt(order.abonado)) : '', receiptRow('Saldo pendiente', moneyFmt(order.saldo_pendiente ?? total)), separator(), receiptRow('Metodo', method), reference ? receiptRow('Referencia', reference) : '', method === 'Efectivo' ? receiptRow('Recibido', moneyFmt(cashReceived)) : '', method === 'Efectivo' ? receiptRow('Cambio', moneyFmt(change)) : '', separator(), centerText('Ticket no fiscal'), centerText(settings.texto_ticket || 'Gracias por su compra')].filter(Boolean).join('\n');
}
function buildFormalInvoice(order, method, cashReceived, reference, billing = {}, settings = {}) {
  const {
    subtotal,
    tax,
    service,
    total
  } = saleTotals(order, settings);
  const change = Math.max(0, Number(cashReceived || 0) - total);
  const moneyFmt = value => moneyWithSettings(value, settings);
  return [...businessHeader(settings), separator(), centerText(billing.number ? 'FACTURA FORMAL' : 'PRECUENTA - SIN COBRAR'), billing.number ? receiptRow('No.', billing.number) : '', receiptRow('Fecha emision', new Date().toLocaleString('es-EC')), receiptRow('Pedido', `#${order.id}`), receiptRow('Orden', orderLabel(order)), isPickupOrder(order) ? pickupDetail(order) : '', separator(), centerText('DATOS DEL CLIENTE'), receiptRow('Cliente', billing.name || 'Consumidor Final'), receiptRow('Documento', billing.id || '-'), billing.phone ? receiptRow('Telefono', billing.phone) : '', billing.email ? receiptRow('Correo', billing.email) : '', separator(), centerText('DETALLE'), ...saleItemLines(order, settings), separator(), receiptRow('Subtotal sin IVA', moneyFmt(subtotal)), receiptRow(`IVA declarado ${Number(order?.totales_cobro?.taxPercent ?? settings.iva_porcentaje ?? 0)}%`, moneyFmt(tax)), service > 0 ? receiptRow('Servicio incluido', moneyFmt(service)) : '', receiptRow('TOTAL FACTURA', moneyFmt(total)), Number(order.abonado)>0 ? receiptRow('Abonos', moneyFmt(order.abonado)) : '', receiptRow('Saldo pendiente', moneyFmt(order.saldo_pendiente ?? total)), separator(), receiptRow('Forma de pago', method), reference ? receiptRow('Referencia', reference) : '', method === 'Efectivo' ? receiptRow('Recibido', moneyFmt(cashReceived)) : '', method === 'Efectivo' ? receiptRow('Cambio', moneyFmt(change)) : '', separator(), centerText(settings.texto_ticket || 'Gracias por su compra')].filter(Boolean).join('\n');
}
function buildReceipt(order, method, cashReceived, reference, billing = {}, settings = {}) {
  return billing.mode === 'ID' ? buildFormalInvoice(order, method, cashReceived, reference, billing, settings) : buildCustomerTicket(order, method, cashReceived, reference, billing, settings);
}
function groupDivisions(rows = []) {
  const map = new Map();
  rows.forEach(row => {
    const pedidoId = Number(row.pedido_id);
    if (!map.has(pedidoId)) {
      map.set(pedidoId, {
        pedido_id: pedidoId,
        divisions: []
      });
    }
    map.get(pedidoId).divisions.push({
      id: row.id,
      nombre: row.nombre,
      monto: Number(row.monto || 0),
      estado: row.estado
    });
  });
  return Array.from(map.values());
}
function notificationKey(order) {
  return [Number(order.id || 0), normalizeState(order.estado), order.cuenta_solicitada_at || '', order.tipo || '', (order.items || []).length].join('|');
}
function cleanDocument(value) {
  return String(value || '').replace(/[^0-9]/g, '').slice(0, 13);
}
function isValidInvoiceDocument(value) {
  const cleaned = cleanDocument(value);
  return cleaned.length === 10 || cleaned.length === 13;
}
function activePayment(pago) {
  return String(pago?.estado || 'ACTIVO') === 'ACTIVO';
}
function shadow(pos, level = 1) {
  if (Platform.OS === 'web') {
    return {
      boxShadow: pos.isDark ? `0 ${level * 10}px ${level * 24}px rgba(0,0,0,0.35)` : `0 ${level * 8}px ${level * 22}px rgba(15,23,42,0.08)`
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: level * 2
    },
    shadowOpacity: pos.isDark ? 0.32 : 0.08,
    shadowRadius: level * 8,
    elevation: level * 2
  };
}
function CashierShell() {
  const {
    user,
    logout
  } = useAuth();
  const {
    pedidos,
    productos,
    categorias,
    caja,
    configuracion,
    loading,
    syncStatus,
    refreshAll,
    cobrarPedido
  } = useAdmin();
  const {
    isDark,
    toggle
  } = useTheme();
  const pos = POS[isDark ? 'dark' : 'light'];
  const {
    width
  } = useWindowDimensions();
  const isPhone = width < 680;
  const userRole = String(user?.rol || '').toLowerCase();
  const canManageCash = ['admin', 'caja'].includes(userRole);
  const canVoidPayments = ['admin', 'supervisor'].includes(userRole);
  const canRequestPaymentActions = ['admin', 'supervisor', 'caja'].includes(userRole);
  const canManageClosures = userRole === 'admin';
  const businessConfig = configuracion || {};
  const serviceRate = Math.max(0, Number(String(businessConfig.servicio_porcentaje || 0).replace(',', '.'))) / 100;
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('TODOS');
  const [selectedId, setSelectedId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [chargeMode, setChargeMode] = useState('TOTAL');
  const [partialAmount, setPartialAmount] = useState('');
  const [divisionId, setDivisionId] = useState(null);
  const [mixedAmounts, setMixedAmounts] = useState({ Efectivo: '', Tarjeta: '' });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [printBusy, setPrintBusy] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const pendingPaymentRef = useRef(null);
  const [pendingReady, setPendingReady] = useState(false);
  const pendingKey = `cash.pending.${user?.id}`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(pendingKey).then(raw => {
      if (!active) return;
      if (raw) { const pending = JSON.parse(raw); pendingPaymentRef.current = pending; setPendingPayment(pending); }
      setPendingReady(true);
    }).catch(() => { if (active) Alert.alert('Almacenamiento no disponible', 'No se pudo verificar si hay un cobro pendiente. Recarga antes de cobrar.'); });
    return () => { active = false; };
  }, [pendingKey]);
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [billingMode, setBillingMode] = useState('FINAL');
  const [billingName, setBillingName] = useState('Consumidor Final');
  const [billingId, setBillingId] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [menuCategory, setMenuCategory] = useState('TODAS');
  const [menuSearch, setMenuSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const cashActionLock = useRef(false);
  const orderActionLock = useRef(false);
  const [closeCajaId, setCloseCajaId] = useState(null);
  const [cashBusy, setCashBusy] = useState(false);
  const [cart, setCart] = useState([]);
  const [saleType, setSaleType] = useState('Para llevar');
  const [customer, setCustomer] = useState({
    nombre: ''
  });
  const [customerError, setCustomerError] = useState('');
  const [saleNote, setSaleNote] = useState('');
  const [orderBusy, setOrderBusy] = useState(false);
  const [openCajaModal, setOpenCajaModal] = useState(false);
  const [closeCajaModal, setCloseCajaModal] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [openAmount, setOpenAmount] = useState('20.00');
  const [openNote, setOpenNote] = useState('');
  const [closeAmount, setCloseAmount] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [movementType, setMovementType] = useState('INGRESO');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [paymentAuth, setPaymentAuth] = useState({
    visible: false,
    pago: null,
    action: 'anular',
    motivo: '',
    correo: '',
    pin: ''
  });
  const [cashNotice, setCashNotice] = useState(null);
  const orderSignalsRef = useRef(new Map());
  const orderSignalsReadyRef = useRef(false);
  const cashNoticeTimer = useRef(null);
  const syncStatusRef = useRef(syncStatus);
  const showCashNotice = useCallback(notice => {
    const nextNotice = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'info',
      ...notice
    };
    setCashNotice(nextNotice);
    if (cashNoticeTimer.current) clearTimeout(cashNoticeTimer.current);
    cashNoticeTimer.current = setTimeout(() => {
      setCashNotice(current => current?.id === nextNotice.id ? null : current);
      cashNoticeTimer.current = null;
    }, 4200);
  }, []);
  useEffect(() => {
    installWebAudioUnlock();
    refreshAll();
    const timer = setInterval(refreshAll, 10000);
    return () => clearInterval(timer);
  }, [refreshAll]);
  useEffect(() => () => {
    if (cashNoticeTimer.current) clearTimeout(cashNoticeTimer.current);
  }, []);
  useEffect(() => {
    return subscribeRealtime(REALTIME_EVENTS.CASH_UPDATED, (payload = {}) => {
      refreshAll();
      const action = String(payload.action || '').toLowerCase();
      if (action === 'opened' || action === 'reopened') {
        playWebAlertTone(ALERT_TONES.CASH_OPEN);
        showCashNotice({
          title: action === 'reopened' ? 'Caja reabierta' : 'Caja abierta',
          message: 'La caja ya puede facturar y cobrar.',
          type: 'success'
        });
      } else if (action === 'closed') {
        playWebAlertTone(ALERT_TONES.CASH_CLOSED);
        showCashNotice({
          title: 'Caja cerrada',
          message: 'Turno finalizado y resumen actualizado.',
          type: 'warning'
        });
      }
    });
  }, [refreshAll, showCashNotice]);
  useEffect(() => {
    const previous = syncStatusRef.current;
    syncStatusRef.current = syncStatus;
    if (previous === syncStatus || syncStatus === 'connected' || syncStatus === 'connecting') return;
    playWebAlertTone(ALERT_TONES.SYNC_ERROR);
    showCashNotice({
      title: 'Error de sincronizacion',
      message: syncStatus === 'error' ? 'No se pudo conectar con el servidor.' : 'Caja trabajando sin conexion en tiempo real.',
      type: 'error'
    });
  }, [syncStatus, showCashNotice]);
  const activeOrders = useMemo(() => {
    return groupUnpaidAccounts(pedidos).filter(order => ACTIVE_STATES.includes(normalizeState(order.estado)) && (order.items || []).some(item => Number(item.cantidad || 0) > 0)).sort((a, b) => {
      const aBill = isBillRequested(a) ? 0 : 1;
      const bBill = isBillRequested(b) ? 0 : 1;
      if (aBill !== bBill) return aBill - bBill;
      return Number(a.mesa_numero || a.mesa_id || 9999) - Number(b.mesa_numero || b.mesa_id || 9999);
    });
  }, [pedidos]);
  useEffect(() => {
    const previous = orderSignalsRef.current;
    const next = new Map();
    let alertTone = null;
    let alertNotice = null;
    let alertPriority = 0;
    const setAlert = (tone, notice, priority) => {
      if (priority >= alertPriority) {
        alertTone = tone;
        alertNotice = notice;
        alertPriority = priority;
      }
    };
    activeOrders.forEach(order => {
      const id = Number(order.id || 0);
      const state = normalizeState(order.estado);
      const accountRequested = isBillRequested(order);
      const pickup = isPickupOrder(order);
      const key = notificationKey(order);
      const previousSignal = previous.get(id);
      next.set(id, {
        key,
        state,
        accountRequested,
        pickup
      });
      if (!orderSignalsReadyRef.current) return;
      if (!previousSignal && pickup) {
        setAlert(ALERT_TONES.PICKUP_NEW, {
          title: 'Nuevo para llevar/delivery',
          message: orderLabel(order),
          type: 'success'
        }, 2);
      }
      if (previousSignal && pickup && previousSignal.key !== key) {
        setAlert(ALERT_TONES.PICKUP_NEW, {
          title: 'Pedido actualizado',
          message: orderLabel(order),
          type: 'success'
        }, 2);
      }
      if (previousSignal && !previousSignal.accountRequested && accountRequested) {
        setAlert(ALERT_TONES.ACCOUNT_REQUESTED, {
          title: 'Cuenta solicitada',
          message: orderLabel(order),
          type: 'info'
        }, 4);
      }
      if (previousSignal && previousSignal.state !== 'LISTO' && state === 'LISTO') {
        setAlert(ALERT_TONES.ORDER_READY, {
          title: 'Pedido listo',
          message: orderLabel(order),
          type: 'success'
        }, 3);
      }
      if (previousSignal && previousSignal.state !== 'ENTREGADO' && state === 'ENTREGADO') {
        setAlert(ALERT_TONES.ORDER_READY, {
          title: 'Pedido entregado',
          message: orderLabel(order),
          type: 'success'
        }, 3);
      }
    });
    orderSignalsRef.current = next;
    if (!orderSignalsReadyRef.current) {
      orderSignalsReadyRef.current = true;
      return;
    }
    if (alertTone) {
      playWebAlertTone(alertTone);
      if (alertNotice) showCashNotice(alertNotice);
    }
  }, [activeOrders, showCashNotice]);
  const splitRequests = useMemo(() => groupDivisions(caja?.divisiones || []), [caja?.divisiones]);
  const splitByOrder = useMemo(() => {
    const map = new Map();
    splitRequests.forEach(request => map.set(Number(request.pedido_id), request));
    return map;
  }, [splitRequests]);
  const selectedOrder = useMemo(() => activeOrders.find(order => Number(order.id) === Number(selectedId)) || null, [activeOrders, selectedId]);
  useEffect(() => {
    if (!selectedOrder) return;
    const suggested = Math.ceil(Number(selectedOrder.saldo_pendiente ?? selectedOrder.total ?? 0) / 5) * 5;
    setChargeMode('TOTAL'); setPartialAmount(''); setDivisionId(null); setMixedAmounts({ Efectivo: '', Tarjeta: '' });
    setCashReceived(String(suggested || ''));
    setReference('');
    setPaymentMethod('Efectivo');
    setBillingMode('FINAL');
    setBillingName(selectedOrder.cliente_nombre || 'Consumidor Final');
    setBillingId('');
    setBillingPhone('');
    setBillingEmail('');
  }, [selectedOrder?.id, selectedOrder?.saldo_pendiente]);
  const {
    subtotal,
    total,
    tax,
    service
  } = saleTotals(selectedOrder, businessConfig);
  const balanceDue = Number(selectedOrder?.saldo_pendiente ?? total);
  const chargeAmount = chargeMode === 'PARCIAL' ? Number(partialAmount.replace(',', '.')) : balanceDue;
  const mixedParts = Object.entries(mixedAmounts).filter(([,amount]) => Number(amount) > 0).map(([metodo,monto]) => ({ metodo, monto: Number(monto), referencia: reference || null }));
  const cashPortion = paymentMethod === 'Mixto' ? Number(mixedAmounts.Efectivo || 0) : paymentMethod === 'Efectivo' ? chargeAmount : 0;
  const mixedTotal = mixedParts.reduce((sum, part) => sum + Math.round(part.monto * 100), 0) / 100;
  const validCents = (amount) => Number.isFinite(amount) && amount >= 0 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001;
  const change = Math.max(0, Number(cashReceived || 0) - cashPortion);
  const canCharge = pendingReady && !!selectedOrder && canManageCash && caja?.caja && validCents(chargeAmount) && chargeAmount > 0 && chargeAmount <= balanceDue &&
    (paymentMethod !== 'Mixto' || (mixedParts.length >= 2 && Object.values(mixedAmounts).every(value => value === '' || validCents(Number(value))) && Math.round(mixedTotal*100) === Math.round(chargeAmount*100))) &&
    (!cashPortion || (validCents(Number(cashReceived)) && Number(cashReceived) >= cashPortion));
  const connected = syncStatus === 'connected';
  const selectedSplit = selectedOrder ? splitByOrder.get(Number(selectedOrder.id)) : null;
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + cartLineTotal(item), 0),
    [cart]
  );
  const cartService = Math.max(0, cartSubtotal * serviceRate);
  const cartTotal = Number((cartSubtotal + cartService).toFixed(2));

  const turnTotals = caja?.totales_turno || {};
  const stats = { byMethod: {
    Efectivo: Number(turnTotals.efectivo || 0), Tarjeta: Number(turnTotals.tarjeta || 0),
    Transferencia: Number(turnTotals.transferencia || 0), QR: Number(turnTotals.qr || 0),
    Vales: Number(turnTotals.vales || 0), Otro: Number(turnTotals.otro || 0),
  } };
  const movementStats = { INGRESO: Number(turnTotals.ingresos || 0), RETIRO: Number(turnTotals.retiros || 0),
    GASTO: Number(turnTotals.gastos || 0), DEVOLUCION: Number(turnTotals.devoluciones || 0) };

  const matchingClients = useMemo(() => {
    const q = normalizeText(`${billingName} ${billingId}`);
    if (billingMode !== 'ID' || !q) return [];
    return (caja?.clientes || []).filter((client) => (
      normalizeText([client.nombre, client.documento, client.telefono, client.correo].filter(Boolean).join(' ')).includes(q)
    )).slice(0, 3);
  }, [billingId, billingMode, billingName, caja?.clientes]);

  const availableProducts = useMemo(() => {
    return productos.filter((product) => {
      const stock = product.inventario_item_id ? product.inventario_stock : product.stock;
      return Number(product.disponible ?? 1) === 1 && Number(stock ?? 1) > 0;
    });
  }, [productos]);

  const menuCategories = useMemo(() => {
    const values = availableProducts.map((product) => product.categoria_nombre || product.categoria).filter(Boolean);
    const fallback = categorias.filter((cat) => Number(cat.activo) !== 0).map((cat) => cat.nombre).filter(Boolean);
    return ['TODAS', ...Array.from(new Set([...values, ...fallback]))];
  }, [availableProducts, categorias]);

  const visibleProducts = useMemo(() => {
    const q = normalizeText(menuSearch);
    return availableProducts.filter((product) => {
      const category = product.categoria_nombre || product.categoria || 'General';
      if (menuCategory !== 'TODAS' && normalizeText(category) !== normalizeText(menuCategory)) return false;
      if (!q) return true;
      return normalizeText([product.nombre, product.descripcion, category].filter(Boolean).join(' ')).includes(q);
    });
  }, [availableProducts, menuCategory, menuSearch]);

  const filteredOrders = useMemo(() => {
    const q = normalizeText(orderSearch);
    return activeOrders.filter((order) => {
      const pickup = isPickupOrder(order);
      const delivery = order.tipo === 'Delivery';
      if (orderFilter === 'MESAS' && pickup) return false;
      if (orderFilter === 'EXPRESS' && (!pickup || delivery)) return false;
      if (orderFilter === 'DELIVERY' && !delivery) return false;
      if (orderFilter === 'CUENTA' && !isBillRequested(order)) return false;
      if (!q) return true;
      return normalizeText([
        orderLabel(order),
        pickupDetail(order),
        order.cliente_nombre,
        order.mesero_nombre,
        `pedido ${order.id}`,
        ...(order.items || []).map((item) => item.nombre),
      ].filter(Boolean).join(' ')).includes(q);
    });
  }, [activeOrders, orderFilter, orderSearch]);

  const field = {
    backgroundColor: pos.surfaceAlt,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: pos.line,
    color: pos.text,
  };

  const paymentMethods = [
    { label: 'Efectivo', icon: Banknote },
    { label: 'Tarjeta', icon: CreditCard },
    { label: 'Transferencia', icon: RefreshCw },
    { label: 'QR', icon: Hash },
    { label: 'Vales', icon: Gift },
    { label: 'Mixto', icon: WalletCards },
  ];

  const addToCart = (product) => {
    if (orderActionLock.current) return;
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede crear ventas directas.');
      return;
    }
    setCart((current) => {
      const exists = current.find((item) => Number(item.producto_id) === Number(product.id));
      if (exists) {
        return current.map((item) => (
          Number(item.producto_id) === Number(product.id)
            ? { ...item, cantidad: Number(item.cantidad || 0) + 1 }
            : item
        ));
      }
      return [
        ...current,
        {
          producto_id: product.id,
          nombre: product.nombre,
          precio: Number(product.precio || 0),
          cantidad: 1,
        },
      ];
    });
  };

  const changeCartQty = (productId, delta) => {
    if (!canManageCash || orderActionLock.current) return;
    setCart((current) => current
      .map((item) => (
        Number(item.producto_id) === Number(productId)
          ? { ...item, cantidad: Number(item.cantidad || 0) + delta }
          : item
      ))
      .filter((item) => Number(item.cantidad || 0) > 0));
  };

  const createPickupOrder = async () => runExclusive(orderActionLock, async () => {
    const customerName = customer.nombre.trim();
    setCustomerError('');
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede crear ventas directas.');
      return;
    }
    if (!caja?.caja) {
      Alert.alert('Caja cerrada', 'Abre caja antes de crear ventas desde caja.');
      return;
    }
    if (!cart.length) {
      Alert.alert('Carrito vacio', 'Agrega productos del menu para crear el pedido.');
      return;
    }
    if (!customerName) {
      setCustomerError(
        saleType === 'Delivery'
          ? 'Falta el nombre del delivery.'
          : 'Falta el nombre del cliente.'
      );
      Alert.alert(
        'Falta nombre',
        saleType === 'Delivery'
          ? 'Escribe el nombre del delivery.'
          : 'Escribe el nombre del cliente.'
      );
      return;
    }

    setOrderBusy(true);
    try {
      const payload = {
        mesa_id: null,
        tipo: saleType,
        cliente_nombre: customerName,
        cliente_dato: null,
        delivery_telefono: null,
        delivery_direccion: null,
        delivery_referencia: null,
        total: cartTotal,
        notas: saleNote.trim() || null,
        items: cart.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio: item.precio,
        })),
      };

      const { data } = await axios.post(`${BASE_URL}/pedidos`, payload);
      setCart([]);
      setCustomer({ nombre: '' });
      setCustomerError('');
      setSaleNote('');
      await refreshAll();
      if (data?.pedido?.id) setSelectedId(data.pedido.id);
    } catch (error) {
      Alert.alert('No se pudo crear pedido', error.response?.data?.message || error.response?.data?.error || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setOrderBusy(false);
    }
  });

  const printText = async (text, title = 'Ticket', options = {}) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const win = options.printWindow || window.open('', '_blank', 'width=420,height=680');
      if (win) {
        const logoSrc = options.logo_url ? assetUrl(options.logo_url) : null;
        win.document.write(`
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: 80mm auto; margin: 5mm; }
            body { margin: 0; background: #fff; color: #111827; }
            .ticket { max-width: 310px; margin: auto; padding: 12px 8px 18px; }
            .logo { display: block; max-width: 190px; max-height: 74px; object-fit: contain; margin: 0 auto 10px; }
            pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.35; margin: 0; }
          </style>
          <div class="ticket">
            ${logoSrc ? `<img class="logo" src="${escapeHtml(logoSrc)}" />` : ''}
            <pre>${escapeHtml(text)}</pre>
          </div>
        `);
        win.document.close();
        win.focus();
        const images = Array.from(win.document.images);
        await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => {
          img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 3000);
        }))).then(() => {
          if (win.closed) throw new Error('La ventana se cerro antes de imprimir.');
          win.print();
        });
        return;
      }
    }
    if (options.strict) throw new Error('No se pudo abrir la impresion. Permite ventanas emergentes y reintenta desde Comprobantes.');
    Alert.alert(title, text);
  };

  const printReceipt = (settlement = {}) => {
    if (!selectedOrder) return;
    const isInvoice = billingMode === 'ID';
    return printText(
      buildReceipt(settlement.pedido || selectedOrder, paymentMethod, cashReceived, reference, {
        mode: billingMode,
        name: billingName.trim(),
        id: cleanDocument(billingId),
        phone: billingPhone.trim(),
        email: billingEmail.trim(),
        number: settlement.comprobante_numero,
      }, businessConfig),
      settlement.comprobante_numero ? (isInvoice ? 'Factura formal' : 'Ticket cliente') : 'Precuenta',
      { ...businessConfig, printWindow: settlement.printWindow }
    );
  };

  const selectBillingClient = (client) => {
    setBillingMode('ID');
    setBillingName(client.nombre || '');
    setBillingId(cleanDocument(client.documento));
    setBillingPhone(client.telefono || '');
    setBillingEmail(client.correo || '');
  };

  const handleOpenCaja = async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede abrir caja.');
      return;
    }
    setOpenAmount('20.00');
    setOpenNote('');
    setOpenCajaModal(true);
  };

  const submitOpenCaja = async () => runExclusive(cashActionLock, async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede abrir caja.');
      return;
    }
    setCashBusy(true);
    try {
      await axios.post(`${BASE_URL}/caja/abrir`, {
        monto_inicial: openAmount,
        observacion: openNote.trim() || null,
      });
      setOpenCajaModal(false);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo abrir caja', error.response?.data?.message || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setCashBusy(false);
    }
  });

  const handleCloseCaja = () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede cerrar caja.');
      return;
    }
    if (!caja?.caja) {
      Alert.alert('Caja cerrada', 'No hay una caja abierta para cerrar.');
      return;
    }
    if (caja.efectivo_esperado == null) { Alert.alert('Actualiza caja', 'No se han cargado los totales del turno.'); return; }
    setCloseCajaId(caja.caja.id);
    const expected = Number(caja.efectivo_esperado);
    setCloseAmount(String(expected.toFixed(2)));
    setCloseNote('');
    setCloseCajaModal(true);
  };

  const submitCloseCaja = async () => runExclusive(cashActionLock, async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede cerrar caja.');
      return;
    }
    setCashBusy(true);
    // La ventana de impresión se abre en el mismo toque para que el navegador no la bloquee.
    const printWindow = Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank', 'width=420,height=680') : null;
    try {
      const { data } = await axios.post(`${BASE_URL}/caja/cerrar`, {
        caja_id: closeCajaId,
        monto_final: closeAmount,
        observacion: closeNote.trim() || null,
      });
      setCloseCajaModal(false);
      // Corte Z: el cierre recién hecho, impreso al momento.
      const r = data?.resumen || {};
      const cerrado = { id: closeCajaId, trabajador_nombre: user?.nombre, fecha_apertura: caja?.caja?.fecha_apertura, fecha_cierre: new Date().toISOString(),
        total_ventas: turnTotals.total, total_efectivo: stats.byMethod.Efectivo, total_tarjeta: stats.byMethod.Tarjeta, total_transferencia: stats.byMethod.Transferencia, total_qr: stats.byMethod.QR,
        monto_inicial: caja?.caja?.monto_inicial, total_ingresos: movementStats.INGRESO, total_retiros: movementStats.RETIRO, total_gastos: movementStats.GASTO, total_devoluciones: movementStats.DEVOLUCION,
        total_anulaciones: turnTotals.anulaciones, efectivo_esperado: r.efectivo_esperado ?? caja?.efectivo_esperado, monto_final: r.monto_final ?? closeAmount,
        diferencia_cierre: r.diferencia ?? (Number(closeAmount) - Number(caja?.efectivo_esperado || 0)), observacion_cierre: closeNote.trim() || null };
      printText(closureText(cerrado), `Corte Z caja ${closeCajaId}`, { ...businessConfig, printWindow }).catch(() => { printWindow?.close(); });
      await refreshAll();
    } catch (error) {
      printWindow?.close();
      Alert.alert('No se pudo cerrar', error.response?.data?.message || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setCashBusy(false);
    }
  });

  const printSavedPayment = async (data, printWindow) => {
    const paymentId = data.pago?.id || data.pago_id;
    try {
      if (Platform.OS === 'web' && !printWindow) throw new Error('La ventana de impresion fue bloqueada. Permite ventanas emergentes.');
      await printText(savedPaymentText(data.snapshot, data.pago || { id: paymentId, estado: 'ACTIVO' }), data.snapshot.comprobante_numero || 'Comprobante',
        { ...data.snapshot.negocio, printWindow, strict: true });
      await axios.post(`${BASE_URL}/caja/pagos/${paymentId}/impresion`, { estado: 'ENVIADO' });
    } catch (error) {
      await axios.post(`${BASE_URL}/caja/pagos/${paymentId}/impresion`, { estado: 'ERROR', error: error.message }).catch(() => {});
      throw error;
    } finally { setHistoryVersion(v => v+1); }
  };
  const reprintPayment = async (id) => {
    if (printBusy) return;
    const win = Platform.OS === 'web' ? window.open('', '_blank', 'width=420,height=680') : null;
    setPrintBusy(true);
    try { const { data } = await axios.get(`${BASE_URL}/caja/pagos/${id}`); await printSavedPayment(data, win); }
    catch (error) { win?.close(); Alert.alert('No se pudo reimprimir', error.response?.data?.message || error.message); }
    finally { setPrintBusy(false); }
  };
  const handleCharge = async () => runExclusive(cashActionLock, async () => {
    if (!pendingReady || (!pendingPaymentRef.current && (!selectedOrder || !canCharge))) return;
    if (!canManageCash) return;
    if (!pendingPaymentRef.current && billingMode === 'ID') {
      if (!billingName.trim() || !isValidInvoiceDocument(billingId)) {
        Alert.alert('Datos incompletos', 'Ingresa nombre y cedula de 10 digitos o RUC de 13 digitos.'); return;
      }
    }
    const printWindow = Platform.OS === 'web' ? window.open('', '_blank', 'width=420,height=680') : null;
    setBusy(true);
    let registered = false;
    try {
      let payload = pendingPaymentRef.current;
      if (!payload) {
        payload = { pedido_id: selectedOrder.id, metodo: paymentMethod, caja_id: caja?.caja?.id,
          monto: chargeAmount, parcial: chargeMode === 'PARCIAL', division_id: divisionId,
          desglose: paymentMethod === 'Mixto' ? mixedParts : null, efectivo_recibido: cashPortion ? cashReceived : 0,
          referencia: reference.trim() || null,
          factura_tipo: billingMode === 'ID' ? 'DOCUMENTO' : 'FINAL', factura_cliente: billingMode === 'ID' ? billingName.trim() : 'Consumidor Final',
          factura_documento: billingMode === 'ID' ? cleanDocument(billingId) : null,
          factura_telefono: billingMode === 'ID' ? billingPhone.trim() : null, factura_correo: billingMode === 'ID' ? billingEmail.trim() : null,
          idempotency_key: `cash_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}` };
        await AsyncStorage.setItem(pendingKey, JSON.stringify(payload));
        pendingPaymentRef.current = payload; setPendingPayment(payload);
      }
      const settlement = await cobrarPedido(payload.pedido_id, payload.metodo, payload);
      registered = true;
      await AsyncStorage.removeItem(pendingKey);
      pendingPaymentRef.current = null; setPendingPayment(null);
      setSelectedId(Number(settlement.snapshot.saldo_pendiente) > 0 ? payload.pedido_id : null);
      setHistoryVersion(v=>v+1);
      try { await printSavedPayment(settlement, printWindow); }
      catch (error) { printWindow?.close(); Alert.alert('Cobro guardado · impresión pendiente', `${error.message} Puedes reimprimir desde Comprobantes.`); }
      refreshAll().catch(()=>{});
    } catch (error) {
      printWindow?.close();
      if (!registered && error.response?.status >= 400 && error.response.status < 500) {
        await AsyncStorage.removeItem(pendingKey); pendingPaymentRef.current = null; setPendingPayment(null);
      }
      Alert.alert(registered ? 'Cobro guardado' : 'No se pudo confirmar el cobro', error.response?.data?.message || 'Reintenta el cobro pendiente. Se usará el mismo identificador para evitar duplicados.');
    } finally { setBusy(false); }
  });

  const openOrder = (order) => {
    setSelectedId(order.id);
  };

  const closeOrderModal = () => {
    setSelectedId(null);
  };

  const openMovement = (type = 'INGRESO') => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede registrar movimientos.');
      return;
    }
    if (!caja?.caja) {
      Alert.alert('Caja cerrada', 'Abre caja antes de registrar movimientos.');
      return;
    }
    setMovementType(type);
    setMovementAmount('');
    setMovementReason('');
    setMovementModal(true);
  };

  const submitMovement = async () => runExclusive(cashActionLock, async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede registrar movimientos.');
      return;
    }
    if (!movementReason.trim()) {
      Alert.alert('Falta motivo', 'Escribe el motivo del movimiento.');
      return;
    }
    setCashBusy(true);
    try {
      await axios.post(`${BASE_URL}/caja/movimientos`, {
        tipo: movementType,
        caja_id: caja?.caja?.id,
        monto: movementAmount,
        metodo: 'Efectivo',
        motivo: movementReason.trim(),
      });
      setMovementModal(false);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo registrar', error.response?.data?.message || error.response?.data?.error || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setCashBusy(false);
    }
  });

  const openPaymentAuthorization = (pago, action) => {
    if (!canRequestPaymentActions) {
      Alert.alert('Sin permiso', 'Solo caja, supervisor o administrador puede solicitar esta accion.');
      return;
    }
    setPaymentAuth({
      visible: true,
      pago,
      action,
      motivo: '',
      correo: '',
      pin: '',
    });
  };

  const submitPaymentAuthorization = async () => runExclusive(cashActionLock, async () => {
    if (!paymentAuth.pago) return;
    if (!paymentAuth.motivo.trim()) {
      Alert.alert('Motivo requerido', 'Escribe un motivo para continuar.');
      return;
    }
    if (!canVoidPayments) {
      if (!paymentAuth.correo.trim() || !/^\d{4}$/.test(paymentAuth.pin)) {
        Alert.alert('Autorizacion requerida', 'Ingresa correo y PIN de 4 digitos de un admin o supervisor.');
        return;
      }
    }
    setAdminBusy(true);
    try {
      await axios.post(`${BASE_URL}/caja/pagos/${paymentAuth.pago.id}/${paymentAuth.action}`, {
        motivo: paymentAuth.motivo.trim(),
        ...(!canVoidPayments ? {
          authorization: {
            correo: paymentAuth.correo.trim().toLowerCase(),
            pin: paymentAuth.pin,
          },
        } : {}),
      });
      setHistoryVersion(v=>v+1);
      setPaymentAuth({ visible: false, pago: null, action: 'anular', motivo: '', correo: '', pin: '' });
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo completar', error.response?.data?.message || error.response?.data?.error || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setAdminBusy(false);
    }
  });

  const closureText = (item) => {
    const moneyFmt = (value) => moneyWithSettings(value, businessConfig);
    return [
      ...businessHeader(businessConfig),
      separator(),
      centerText('CIERRE DE CAJA - CORTE Z'),
      receiptRow('Caja', `#${item.id}`),
      receiptRow('Cajera', item.trabajador_nombre || item.trabajador_id || '-'),
      receiptRow('Apertura', item.fecha_apertura ? new Date(item.fecha_apertura).toLocaleString('es-EC') : '-'),
      receiptRow('Cierre', item.fecha_cierre ? new Date(item.fecha_cierre).toLocaleString('es-EC') : '-'),
      separator(),
      centerText('VENTAS POR METODO'),
      receiptRow('Total ventas', moneyFmt(item.total_ventas)),
      receiptRow('Efectivo', moneyFmt(item.total_efectivo)),
      receiptRow('Tarjeta', moneyFmt(item.total_tarjeta)),
      receiptRow('Transferencia', moneyFmt(item.total_transferencia)),
      receiptRow('QR', moneyFmt(item.total_qr)),
      separator(),
      centerText('MOVIMIENTOS'),
      receiptRow('Monto inicial', moneyFmt(item.monto_inicial)),
      receiptRow('Ingresos', moneyFmt(item.total_ingresos)),
      receiptRow('Retiros', moneyFmt(item.total_retiros)),
      receiptRow('Gastos', moneyFmt(item.total_gastos)),
      receiptRow('Devoluciones', moneyFmt(item.total_devoluciones)),
      receiptRow('Anulaciones', moneyFmt(item.total_anulaciones)),
      separator(),
      centerText('CUADRE'),
      receiptRow('Efectivo esperado', moneyFmt(item.efectivo_esperado)),
      receiptRow('Efectivo contado', moneyFmt(item.monto_final)),
      receiptRow('Diferencia', moneyFmt(item.diferencia_cierre)),
      item.observacion_cierre ? `Observacion: ${item.observacion_cierre}` : '',
      separator(),
      centerText('Documento interno'),
    ].filter(Boolean).join('\n');
  };

  const exportClosures = () => {
    const rows = [
      ['Caja', 'Cajera', 'Apertura', 'Cierre', 'Inicial', 'Ventas', 'Efectivo esperado', 'Contado', 'Diferencia'],
      ...(caja?.cierres || []).map((item) => [
        item.id,
        item.trabajador_nombre || '',
        item.fecha_apertura || '',
        item.fecha_cierre || '',
        Number(item.monto_inicial || 0).toFixed(2),
        Number(item.total_ventas || 0).toFixed(2),
        Number(item.efectivo_esperado || 0).toFixed(2),
        Number(item.monto_final || 0).toFixed(2),
        Number(item.diferencia_cierre || 0).toFixed(2),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `cierres-caja-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    Alert.alert('Exportar cierres', csv);
  };

  const adminClosureAction = async (item, action) => {
    if (!canManageClosures) {
      Alert.alert('Solo admin', 'Solo un administrador puede reabrir o editar cierres.');
      return;
    }
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Accion admin', 'Esta accion requiere confirmacion desde la version web.');
      return;
    }
    setAdminBusy(true);
    try {
      if (action === 'reabrir') {
        if (!window.confirm(`Reabrir caja #${item.id}?`)) return;
        await axios.post(`${BASE_URL}/caja/cierres/${item.id}/reabrir`);
      } else {
        const amount = window.prompt('Efectivo contado corregido:', String(Number(item.monto_final || 0).toFixed(2)));
        if (amount === null) return;
        const note = window.prompt('Observacion del cierre:', item.observacion_cierre || '') || '';
        await axios.put(`${BASE_URL}/caja/cierres/${item.id}`, {
          monto_final: Number(String(amount).replace(',', '.')),
          observacion: note.trim() || null,
        });
      }
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo completar', error.response?.data?.message || error.response?.data?.error || 'Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setAdminBusy(false);
    }
  };

  const expectedCash = Number(caja?.efectivo_esperado || 0);
  const countedCash = Number(String(closeAmount || 0).replace(',', '.'));
  const closeDiff = countedCash - expectedCash;

  const cajaTheme = cajaTokens[isDark ? 'dark' : 'light'];
  // Corte X: el resumen del turno abierto, impreso sin cerrarlo.
  const printShiftReport = () => {
    if (!caja?.caja) return;
    const moneyFmt = (value) => moneyWithSettings(value, businessConfig);
    printText([
      ...businessHeader(businessConfig), separator(), centerText('CORTE X - TURNO ABIERTO'),
      receiptRow('Caja', `#${caja.caja.id}`), receiptRow('Cajera', user?.nombre || '-'),
      receiptRow('Apertura', caja.caja.fecha_apertura ? new Date(String(caja.caja.fecha_apertura).replace(' ', 'T')).toLocaleString('es-EC') : '-'),
      receiptRow('Impreso', new Date().toLocaleString('es-EC')), separator(), centerText('COBROS POR METODO'),
      ...Object.entries(stats.byMethod).map(([label, value]) => receiptRow(label, moneyFmt(value))),
      receiptRow('TOTAL COBRADO', moneyFmt(turnTotals.total)), receiptRow('Comprobantes', String(turnTotals.pagos || 0)), separator(), centerText('EFECTIVO'),
      receiptRow('Fondo de apertura', moneyFmt(caja.caja.monto_inicial)), receiptRow('Cobros en efectivo', moneyFmt(stats.byMethod.Efectivo)),
      receiptRow('Ingresos', moneyFmt(movementStats.INGRESO)), receiptRow('Retiros', moneyFmt(movementStats.RETIRO)), receiptRow('Gastos', moneyFmt(movementStats.GASTO)),
      receiptRow('Devoluciones', moneyFmt(movementStats.DEVOLUCION)), receiptRow('DEBE HABER', moneyFmt(caja.efectivo_esperado)), separator(),
      centerText('Documento interno - no cierra el turno'),
    ].filter(Boolean).join('\n'), `Corte X caja ${caja.caja.id}`, businessConfig).catch((error) => Alert.alert('No se pudo imprimir', error.message));
  };

  const renderCashModals = () => <CajaDialogs c={cajaTheme} s={{
    user, caja, turnTotals, expectedCash, cashBusy, adminBusy, canVoidPayments, canManageClosures, cierres: caja?.cierres || [],
    openCajaModal, setOpenCajaModal, openAmount, setOpenAmount, openNote, setOpenNote, submitOpenCaja,
    closeCajaModal, setCloseCajaModal, closeAmount, setCloseAmount, closeNote, setCloseNote, submitCloseCaja,
    movementModal, setMovementModal, movementType, setMovementType, movementAmount, setMovementAmount, movementReason, setMovementReason, submitMovement,
    paymentAuth, setPaymentAuth, submitPaymentAuthorization,
    historyModal, setHistoryModal, exportClosures, adminClosureAction,
    printClosure: (item) => printText(closureText(item), `Cierre caja ${item.id}`, businessConfig),
  }} />;

  if (loading && !pedidos.length) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: TOP_INSET, backgroundColor: cajaTheme.paper }}>
        <ActivityIndicator size="large" color={cajaTheme.text} />
        <Text style={{ color: cajaTheme.muted, fontWeight: '600', marginTop: 12 }}>Cargando caja…</Text>
      </SafeAreaView>
    );
  }

  return <>
    <CashierWorkspace
      model={{ pos, isDark, user, connected, caja, turnTotals, stats, activeOrders, filteredOrders,
        selectedOrder, selectedSplit, subtotal, tax, service, total, change, taxPercent: selectedOrder ? Number(selectedOrder?.totales_cobro?.taxPercent ?? businessConfig.iva_porcentaje ?? 0) : null, balanceDue, chargeAmount, chargeMode, partialAmount, divisionId, mixedAmounts, mixedTotal, cashPortion, historyVersion, printBusy, pendingPayment, cart, cartSubtotal, cartTotal,
        customer, customerError, saleType, saleNote, paymentMethods, paymentMethod, cashReceived, reference,
        billingMode, billingName, billingId, billingPhone, billingEmail, matchingClients,
        menuSearch, menuCategory, menuCategories, filteredMenu: visibleProducts, orderSearch, orderFilter,
        busy, cashBusy, adminBusy, orderBusy, canCharge, canManageCash, canRequestPaymentActions, cashNotice }}
      actions={{ openOrder, closeOrder: closeOrderModal, logout, toggleTheme: toggle,
        setBillingMode, setBillingName, setBillingId: (value) => setBillingId(cleanDocument(value)),
        setBillingPhone, setBillingEmail, selectBillingClient, setPaymentMethod, setCashReceived, setReference,
        setSaleType, setCustomerName: (value) => { if (!orderActionLock.current) { setCustomer({ nombre: value }); setCustomerError(''); } },
        setSaleNote: (value) => { if (!orderActionLock.current) setSaleNote(value); },
        setMenuSearch, setMenuCategory, setOrderSearch, setOrderFilter, addToCart, changeCartQty,
        clearCart: () => { if (!orderActionLock.current) setCart([]); }, createPickupOrder, handleCharge,
        printReceipt, reprintPayment, printShiftReport, setChargeMode, setPartialAmount, setDivisionId, setMixedAmounts, handleOpenCaja, handleCloseCaja, openMovement, openPaymentAuthorization,
        showHistory: () => setHistoryModal(true), dismissNotice: () => setCashNotice(null) }}
      helpers={{ money, orderLabel, itemLineTotal, itemExtras, activePayment, assetUrl }}
    />
    {renderCashModals()}
  </>;

}

export default function CashierApp() {
  return (
    <AdminProvider>
      <CashierShell />
    </AdminProvider>
  );
}
