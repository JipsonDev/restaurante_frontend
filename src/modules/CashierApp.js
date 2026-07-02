import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  BadgePercent,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Hash,
  LogOut,
  Minus,
  Moon,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SplitSquareHorizontal,
  Sun,
  Table2,
  Trash2,
  User,
  Utensils,
  WalletCards,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react-native';
import axios from 'axios';
import { AdminProvider, useAdmin } from '../context/AdminContext';
import { BASE_URL, assetUrl, useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import Logo from '../components/Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { ALERT_TONES, installWebAudioUnlock, playWebAlertTone } from '../services/webAudioAlerts';
import { REALTIME_EVENTS, subscribeRealtime } from '../services/realtime';

const IVA = 0.16;
const ACTIVE_STATES = ['PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO'];

const POS = {
  light: {
    bg: '#F3F6FA',
    appBar: '#061426',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    soft: '#EEF2F7',
    line: '#D7DEE8',
    text: '#0F172A',
    muted: '#44546A',
    faint: '#718096',
    primary: '#0B1B33',
    primarySoft: '#E8EEF7',
    primaryText: '#0F2D5C',
    onPrimary: '#FFFFFF',
    green: '#059669',
    greenSoft: '#D1FAE5',
    amber: '#D97706',
    amberSoft: '#FEF3C7',
    red: '#E11D48',
    redSoft: '#FFE4E6',
    blue: '#2563EB',
    blueSoft: '#DBEAFE',
    isDark: false,
  },
  dark: {
    bg: '#07111F',
    appBar: '#061426',
    surface: '#111827',
    surfaceAlt: '#162033',
    soft: '#1F2A3D',
    line: '#334155',
    text: '#F8FAFC',
    muted: '#CBD5E1',
    faint: '#94A3B8',
    primary: '#E2E8F0',
    primarySoft: '#22324A',
    primaryText: '#DBEAFE',
    onPrimary: '#07111F',
    green: '#34D399',
    greenSoft: '#064E3B',
    amber: '#FBBF24',
    amberSoft: '#451A03',
    red: '#FB7185',
    redSoft: '#4C0519',
    blue: '#60A5FA',
    blueSoft: '#1E3A8A',
    isDark: true,
  },
};

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const isPromotionProduct = (product) => {
  const category = normalizeText(product?.categoria_nombre || product?.categoria || '');
  const name = normalizeText(product?.nombre);
  const description = normalizeText(product?.descripcion);
  return category.includes('promo') || name.includes('promo') || description.includes('promo');
};

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

function orderSubtotal(order, taxRate = IVA, serviceRate = 0) {
  const sum = (order?.items || []).reduce((acc, item) => acc + itemLineTotal(item), 0);
  const total = Number(order?.total || 0);
  return total > 0 ? total / (1 + taxRate + serviceRate) : sum;
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
    .replace(/>/g, '&gt;');
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
  const taxRate = Math.max(0, Number(settings.iva_porcentaje || 16)) / 100;
  const serviceRate = Math.max(0, Number(settings.servicio_porcentaje || 0)) / 100;
  const subtotal = orderSubtotal(order, taxRate, serviceRate);
  const total = Number(order?.total || 0);
  const tax = Math.max(0, subtotal * taxRate);
  const service = Math.max(0, subtotal * serviceRate);
  return { subtotal, tax, service, total };
}

function buildCustomerTicket(order, method, cashReceived, reference, billing = {}, settings = {}) {
  const { subtotal, tax, service, total } = saleTotals(order, settings);
  const change = Math.max(0, Number(cashReceived || 0) - total);
  const moneyFmt = (value) => moneyWithSettings(value, settings);

  return [
    ...businessHeader(settings),
    separator(),
    centerText('TICKET CLIENTE'),
    centerText('CONSUMIDOR FINAL'),
    separator(),
    receiptRow('Pedido', `#${order.id}`),
    receiptRow('Fecha', new Date().toLocaleString('es-EC')),
    receiptRow('Orden', orderLabel(order)),
    isPickupOrder(order) ? pickupDetail(order) : '',
    separator(),
    ...saleItemLines(order, settings),
    separator(),
    receiptRow('Subtotal', moneyFmt(subtotal)),
    receiptRow(`IVA ${Number(settings.iva_porcentaje || 0)}%`, moneyFmt(tax)),
    Number(settings.servicio_porcentaje || 0) > 0 ? receiptRow(`Servicio ${Number(settings.servicio_porcentaje || 0)}%`, moneyFmt(service)) : '',
    receiptRow('TOTAL', moneyFmt(total)),
    separator(),
    receiptRow('Metodo', method),
    reference ? receiptRow('Referencia', reference) : '',
    method === 'Efectivo' ? receiptRow('Recibido', moneyFmt(cashReceived)) : '',
    method === 'Efectivo' ? receiptRow('Cambio', moneyFmt(change)) : '',
    separator(),
    centerText('Ticket no fiscal'),
    centerText(settings.texto_ticket || 'Gracias por su compra'),
  ].filter(Boolean).join('\n');
}

function buildFormalInvoice(order, method, cashReceived, reference, billing = {}, settings = {}) {
  const { subtotal, tax, service, total } = saleTotals(order, settings);
  const change = Math.max(0, Number(cashReceived || 0) - total);
  const moneyFmt = (value) => moneyWithSettings(value, settings);

  return [
    ...businessHeader(settings),
    separator(),
    centerText('FACTURA FORMAL'),
    billing.number ? receiptRow('No.', billing.number) : '',
    receiptRow('Fecha emision', new Date().toLocaleString('es-EC')),
    receiptRow('Pedido', `#${order.id}`),
    receiptRow('Orden', orderLabel(order)),
    isPickupOrder(order) ? pickupDetail(order) : '',
    separator(),
    centerText('DATOS DEL CLIENTE'),
    receiptRow('Cliente', billing.name || 'Consumidor Final'),
    receiptRow('Documento', billing.id || '-'),
    billing.phone ? receiptRow('Telefono', billing.phone) : '',
    billing.email ? receiptRow('Correo', billing.email) : '',
    separator(),
    centerText('DETALLE'),
    ...saleItemLines(order, settings),
    separator(),
    receiptRow('Subtotal sin IVA', moneyFmt(subtotal)),
    receiptRow(`IVA declarado ${Number(settings.iva_porcentaje || 0)}%`, moneyFmt(tax)),
    Number(settings.servicio_porcentaje || 0) > 0 ? receiptRow(`Servicio ${Number(settings.servicio_porcentaje || 0)}%`, moneyFmt(service)) : '',
    receiptRow('TOTAL FACTURA', moneyFmt(total)),
    separator(),
    receiptRow('Forma de pago', method),
    reference ? receiptRow('Referencia', reference) : '',
    method === 'Efectivo' ? receiptRow('Recibido', moneyFmt(cashReceived)) : '',
    method === 'Efectivo' ? receiptRow('Cambio', moneyFmt(change)) : '',
    separator(),
    centerText(settings.texto_ticket || 'Gracias por su compra'),
  ].filter(Boolean).join('\n');
}

function buildReceipt(order, method, cashReceived, reference, billing = {}, settings = {}) {
  return billing.mode === 'ID'
    ? buildFormalInvoice(order, method, cashReceived, reference, billing, settings)
    : buildCustomerTicket(order, method, cashReceived, reference, billing, settings);
}

function groupDivisions(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const pedidoId = Number(row.pedido_id);
    if (!map.has(pedidoId)) {
      map.set(pedidoId, { pedido_id: pedidoId, divisions: [] });
    }
    map.get(pedidoId).divisions.push({
      id: row.id,
      nombre: row.nombre,
      monto: Number(row.monto || 0),
      estado: row.estado,
    });
  });
  return Array.from(map.values());
}

function notificationKey(order) {
  return [
    Number(order.id || 0),
    normalizeState(order.estado),
    order.cuenta_solicitada_at || '',
    order.tipo || '',
    (order.items || []).length,
  ].join('|');
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
      boxShadow: pos.isDark
        ? `0 ${level * 10}px ${level * 24}px rgba(0,0,0,0.35)`
        : `0 ${level * 8}px ${level * 22}px rgba(15,23,42,0.08)`,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: level * 2 },
    shadowOpacity: pos.isDark ? 0.32 : 0.08,
    shadowRadius: level * 8,
    elevation: level * 2,
  };
}

function CashierShell() {
  const { user, logout } = useAuth();
  const {
    pedidos,
    productos,
    categorias,
    caja,
    configuracion,
    loading,
    syncStatus,
    refreshAll,
    cobrarPedido,
  } = useAdmin();

  const { isDark, toggle } = useTheme();
  const pos = POS[isDark ? 'dark' : 'light'];
  const { width } = useWindowDimensions();

  const isWide = width >= 1180;
  const isTablet = width >= 760;
  const isPhone = width < 680;
  const userRole = String(user?.rol || '').toLowerCase();
  const canManageCash = ['admin', 'caja'].includes(userRole);
  const canVoidPayments = ['admin', 'supervisor'].includes(userRole);
  const canRequestPaymentActions = ['admin', 'supervisor', 'caja'].includes(userRole);
  const canManageClosures = userRole === 'admin';
  const pad = isWide ? 12 : 10;
  const productCardWidth = isWide ? '23.5%' : isTablet ? '31.5%' : '48%';
  const businessConfig = configuracion || {};
  const taxRate = Math.max(0, Number(businessConfig.iva_porcentaje || 16)) / 100;
  const serviceRate = Math.max(0, Number(businessConfig.servicio_porcentaje || 0)) / 100;

  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('TODOS');
  const [selectedId, setSelectedId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [billingMode, setBillingMode] = useState('FINAL');
  const [billingName, setBillingName] = useState('Consumidor Final');
  const [billingId, setBillingId] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [menuMode, setMenuMode] = useState('TODOS');
  const [menuCategory, setMenuCategory] = useState('TODAS');
  const [menuSearch, setMenuSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);
  const [cart, setCart] = useState([]);
  const [saleType, setSaleType] = useState('Para llevar');
  const [customer, setCustomer] = useState({
    nombre: '',
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
    pin: '',
  });
  const [cashNotice, setCashNotice] = useState(null);
  const orderSignalsRef = useRef(new Map());
  const orderSignalsReadyRef = useRef(false);
  const cashNoticeTimer = useRef(null);
  const syncStatusRef = useRef(syncStatus);

  const showCashNotice = useCallback((notice) => {
    const nextNotice = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'info',
      ...notice,
    };
    setCashNotice(nextNotice);
    if (cashNoticeTimer.current) clearTimeout(cashNoticeTimer.current);
    cashNoticeTimer.current = setTimeout(() => {
      setCashNotice((current) => (current?.id === nextNotice.id ? null : current));
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
          type: 'success',
        });
      } else if (action === 'closed') {
        playWebAlertTone(ALERT_TONES.CASH_CLOSED);
        showCashNotice({
          title: 'Caja cerrada',
          message: 'Turno finalizado y resumen actualizado.',
          type: 'warning',
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
      message: syncStatus === 'error'
        ? 'No se pudo conectar con el servidor.'
        : 'Caja trabajando sin conexion en tiempo real.',
      type: 'error',
    });
  }, [syncStatus, showCashNotice]);

  const activeOrders = useMemo(() => {
    return pedidos
      .filter((order) => (
        ACTIVE_STATES.includes(normalizeState(order.estado)) &&
        (order.items || []).some((item) => Number(item.cantidad || 0) > 0)
      ))
      .sort((a, b) => {
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

    activeOrders.forEach((order) => {
      const id = Number(order.id || 0);
      const state = normalizeState(order.estado);
      const accountRequested = isBillRequested(order);
      const pickup = isPickupOrder(order);
      const key = notificationKey(order);
      const previousSignal = previous.get(id);

      next.set(id, { key, state, accountRequested, pickup });
      if (!orderSignalsReadyRef.current) return;
      if (!previousSignal && pickup) {
        setAlert(ALERT_TONES.PICKUP_NEW, {
          title: 'Nuevo para llevar/delivery',
          message: orderLabel(order),
          type: 'success',
        }, 2);
      }
      if (previousSignal && pickup && previousSignal.key !== key) {
        setAlert(ALERT_TONES.PICKUP_NEW, {
          title: 'Pedido actualizado',
          message: orderLabel(order),
          type: 'success',
        }, 2);
      }
      if (previousSignal && !previousSignal.accountRequested && accountRequested) {
        setAlert(ALERT_TONES.ACCOUNT_REQUESTED, {
          title: 'Cuenta solicitada',
          message: orderLabel(order),
          type: 'info',
        }, 4);
      }
      if (previousSignal && previousSignal.state !== 'LISTO' && state === 'LISTO') {
        setAlert(ALERT_TONES.ORDER_READY, {
          title: 'Pedido listo',
          message: orderLabel(order),
          type: 'success',
        }, 3);
      }
      if (previousSignal && previousSignal.state !== 'ENTREGADO' && state === 'ENTREGADO') {
        setAlert(ALERT_TONES.ORDER_READY, {
          title: 'Pedido entregado',
          message: orderLabel(order),
          type: 'success',
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
    splitRequests.forEach((request) => map.set(Number(request.pedido_id), request));
    return map;
  }, [splitRequests]);

  const selectedOrder = useMemo(
    () => activeOrders.find((order) => Number(order.id) === Number(selectedId)) || null,
    [activeOrders, selectedId]
  );

  useEffect(() => {
    if (!selectedOrder) return;
    const suggested = Math.ceil(Number(selectedOrder.total || 0) / 5) * 5;
    setCashReceived(String(suggested || ''));
    setReference('');
    setPaymentMethod('Efectivo');
    setBillingMode('FINAL');
    setBillingName(selectedOrder.cliente_nombre || 'Consumidor Final');
    setBillingId('');
    setBillingPhone('');
    setBillingEmail('');
  }, [selectedOrder?.id]);

  const subtotal = orderSubtotal(selectedOrder, taxRate, serviceRate);
  const total = Number(selectedOrder?.total || 0);
  const tax = Math.max(0, subtotal * taxRate);
  const service = Math.max(0, subtotal * serviceRate);
  const change = Math.max(0, Number(cashReceived || 0) - total);
  const canCharge = !!selectedOrder && canManageCash && caja?.caja && (paymentMethod !== 'Efectivo' || Number(cashReceived || 0) >= total);
  const connected = syncStatus === 'connected';
  const selectedSplit = selectedOrder ? splitByOrder.get(Number(selectedOrder.id)) : null;
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + cartLineTotal(item), 0),
    [cart]
  );
  const cartTax = Math.max(0, cartSubtotal * taxRate);
  const cartService = Math.max(0, cartSubtotal * serviceRate);
  const cartTotal = Number((cartSubtotal + cartTax + cartService).toFixed(2));

  const stats = useMemo(() => {
    return (caja?.pagos || []).filter(activePayment).reduce((acc, pago) => {
      const method = pago.metodo || 'Otro';
      acc.byMethod[method] = Number(acc.byMethod[method] || 0) + Number(pago.monto || 0);
      return acc;
    }, { byMethod: {} });
  }, [caja?.pagos]);

  const movementStats = useMemo(() => {
    return (caja?.movimientos || []).reduce((acc, item) => {
      const type = String(item.tipo || '').toUpperCase();
      acc[type] = Number(acc[type] || 0) + Number(item.monto || 0);
      return acc;
    }, {});
  }, [caja?.movimientos]);

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
      const promo = isPromotionProduct(product);
      if (menuMode === 'MENU' && promo) return false;
      if (menuMode === 'PROMOS' && !promo) return false;
      if (menuCategory !== 'TODAS' && normalizeText(category) !== normalizeText(menuCategory)) return false;
      if (!q) return true;
      return normalizeText([product.nombre, product.descripcion, category].filter(Boolean).join(' ')).includes(q);
    });
  }, [availableProducts, menuCategory, menuMode, menuSearch]);

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

  const panel = {
    backgroundColor: pos.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: pos.line,
    ...shadow(pos),
  };

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
    { label: 'Mixto', icon: SplitSquareHorizontal },
    { label: 'Vales', icon: Gift },
  ];

  const addToCart = (product) => {
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
    if (!canManageCash) return;
    setCart((current) => current
      .map((item) => (
        Number(item.producto_id) === Number(productId)
          ? { ...item, cantidad: Number(item.cantidad || 0) + delta }
          : item
      ))
      .filter((item) => Number(item.cantidad || 0) > 0));
  };

  const createPickupOrder = async () => {
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
      Alert.alert('No se pudo crear pedido', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setOrderBusy(false);
    }
  };

  const printText = (text, title = 'Ticket', options = {}) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const win = window.open('', '_blank', 'width=420,height=680');
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
        win.print();
        return;
      }
    }
    Alert.alert(title, text);
  };

  const printReceipt = (settlement = {}) => {
    if (!selectedOrder) return;
    const isInvoice = billingMode === 'ID';
    printText(
      buildReceipt(selectedOrder, paymentMethod, cashReceived, reference, {
        mode: billingMode,
        name: billingName.trim(),
        id: cleanDocument(billingId),
        phone: billingPhone.trim(),
        email: billingEmail.trim(),
        number: settlement.comprobante_numero,
      }, businessConfig),
      isInvoice ? 'Factura formal' : 'Ticket cliente',
      businessConfig
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

  const submitOpenCaja = async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede abrir caja.');
      return;
    }
    setCashBusy(true);
    try {
      await axios.post(`${BASE_URL}/caja/abrir`, {
        monto_inicial: Number(openAmount || 0),
        observacion: openNote.trim() || null,
      });
      setOpenCajaModal(false);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo abrir caja', error.response?.data?.message || 'Revisa el backend.');
    } finally {
      setCashBusy(false);
    }
  };

  const handleCloseCaja = () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede cerrar caja.');
      return;
    }
    if (!caja?.caja) {
      Alert.alert('Caja cerrada', 'No hay una caja abierta para cerrar.');
      return;
    }
    const expected = Number(caja?.caja?.monto_inicial || 0) + Number(stats.byMethod.Efectivo || 0);
    setCloseAmount(String(expected.toFixed(2)));
    setCloseNote('');
    setCloseCajaModal(true);
  };

  const submitCloseCaja = async () => {
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede cerrar caja.');
      return;
    }
    setCashBusy(true);
    try {
      await axios.post(`${BASE_URL}/caja/cerrar`, {
        monto_final: Number(closeAmount || 0),
        observacion: closeNote.trim() || null,
      });
      setCloseCajaModal(false);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo cerrar', error.response?.data?.message || 'Revisa el backend.');
    } finally {
      setCashBusy(false);
    }
  };

  const handleCharge = async () => {
    if (!selectedOrder || !canCharge) return;
    if (!canManageCash) {
      Alert.alert('Sin permiso', 'Solo caja o administrador puede cobrar y facturar.');
      return;
    }
    if (billingMode === 'ID') {
      if (!billingName.trim()) {
        Alert.alert('Falta cliente', 'Escribe el nombre o razon social para facturar con cedula/RUC.');
        return;
      }
      if (!isValidInvoiceDocument(billingId)) {
        Alert.alert('Documento invalido', 'La cedula debe tener 10 digitos o el RUC 13 digitos.');
        return;
      }
    }
    setBusy(true);
    try {
      const billingReference = billingMode === 'ID'
        ? [
          reference,
          `Factura: ${billingName.trim()} ${cleanDocument(billingId)}`,
          `IVA: ${money(tax)}`,
        ].filter(Boolean).join(' | ')
        : reference;

      const settlement = await cobrarPedido(selectedOrder.id, paymentMethod, {
        monto: total,
        referencia: billingReference || null,
        factura_tipo: billingMode === 'ID' ? 'DOCUMENTO' : 'FINAL',
        factura_cliente: billingMode === 'ID' ? billingName.trim() : 'Consumidor Final',
        factura_documento: billingMode === 'ID' ? cleanDocument(billingId) : null,
        factura_telefono: billingMode === 'ID' ? billingPhone.trim() : null,
        factura_correo: billingMode === 'ID' ? billingEmail.trim() : null,
        iva_declarado: billingMode === 'ID' ? tax : 0,
      });
      printReceipt(settlement);
      setSelectedId(null);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo cobrar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setBusy(false);
    }
  };

  const appendCash = (value) => {
    setCashReceived((current) => {
      if (value === 'back') return current.slice(0, -1);
      if (value === 'clear') return '';
      if (value === '.' && current.includes('.')) return current;
      return `${current || ''}${value}`;
    });
  };

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

  const submitMovement = async () => {
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
        monto: Number(movementAmount || 0),
        metodo: 'Efectivo',
        motivo: movementReason.trim(),
      });
      setMovementModal(false);
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo registrar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setCashBusy(false);
    }
  };

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

  const submitPaymentAuthorization = async () => {
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
      setPaymentAuth({ visible: false, pago: null, action: 'anular', motivo: '', correo: '', pin: '' });
      await refreshAll();
    } catch (error) {
      Alert.alert('No se pudo completar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setAdminBusy(false);
    }
  };

  const closureText = (item) => {
    const moneyFmt = (value) => moneyWithSettings(value, businessConfig);
    return [
      ...businessHeader(businessConfig),
      separator(),
      centerText('CIERRE DE CAJA'),
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
      Alert.alert('No se pudo completar', error.response?.data?.message || error.response?.data?.error || 'Revisa el backend.');
    } finally {
      setAdminBusy(false);
    }
  };

  const renderProductCard = (product) => {
    const promo = isPromotionProduct(product);
    const imageUri = product.imagen_url ? assetUrl(product.imagen_url) : null;

    return (
      <TouchableOpacity
        key={product.id}
        onPress={() => addToCart(product)}
        activeOpacity={0.88}
        style={{
          width: productCardWidth,
          minWidth: isPhone ? 142 : 150,
          backgroundColor: pos.surface,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: pos.line,
          overflow: 'hidden',
        }}
      >
        <View style={{ height: isPhone ? 92 : 108, backgroundColor: promo ? pos.amberSoft : pos.primarySoft }}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {promo ? <BadgePercent size={26} color={pos.amber} /> : <Utensils size={26} color={pos.primaryText} />}
            </View>
          )}
          {promo ? (
            <View
              style={{
                position: 'absolute',
                top: 7,
                left: 7,
                borderRadius: 999,
                backgroundColor: 'rgba(6,20,38,0.82)',
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>PROMO</Text>
            </View>
          ) : null}
        </View>
        <View style={{ padding: 10 }}>
          <Text style={{ color: pos.text, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>
            {product.nombre}
          </Text>
          <Text style={{ color: pos.faint, fontSize: 10, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
            {product.categoria_nombre || product.categoria || 'General'}
          </Text>
          <Text style={{ color: pos.primaryText, fontSize: 16, fontWeight: '900', marginTop: 7 }}>
            {money(product.precio)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMenuPanel = () => (
    <View style={{ ...panel, width: isWide ? '42%' : '100%', minWidth: 0, overflow: 'hidden' }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: pos.line }}>
        <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 10 }}>
          <View style={{ height: 42, flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, ...field }}>
            <Search size={17} color={pos.faint} />
            <TextInput
              value={menuSearch}
              onChangeText={setMenuSearch}
              placeholder="Buscar producto..."
              placeholderTextColor={pos.faint}
              style={{ flex: 1, color: pos.text, marginLeft: 8, fontWeight: '800', paddingVertical: 0 }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              ['TODOS', 'Todo', Utensils],
              ['MENU', 'Menu', Utensils],
              ['PROMOS', 'Promos', BadgePercent],
            ].map(([key, label, Icon]) => {
              const active = menuMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setMenuMode(key)}
                  style={{
                    height: 42,
                    borderRadius: 7,
                    paddingHorizontal: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? pos.primary : pos.soft,
                  }}
                >
                  <Icon size={15} color={active ? pos.onPrimary : pos.muted} />
                  <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 12, fontWeight: '900', marginLeft: 6 }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 11 }}>
          {menuCategories.map((category) => {
            const active = menuCategory === category;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setMenuCategory(category)}
                style={{
                  height: 36,
                  borderRadius: 7,
                  paddingHorizontal: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? pos.primary : pos.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? pos.primary : pos.line,
                }}
              >
                <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 11, fontWeight: '900' }}>
                  {category === 'TODAS' ? 'Todas' : category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {visibleProducts.length ? visibleProducts.map(renderProductCard) : (
            <View style={{ flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center' }}>
              <Utensils size={36} color={pos.faint} />
              <Text style={{ color: pos.muted, fontWeight: '900', marginTop: 10 }}>No hay productos con este filtro.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  const renderOrderCard = (order) => {
    const pickup = isPickupOrder(order);
    const ready = normalizeState(order.estado) === 'ENTREGADO' || isBillRequested(order);
    return (
      <TouchableOpacity
        key={order.id}
        onPress={() => openOrder(order)}
        style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor: ready ? pos.green : pos.line,
          backgroundColor: ready ? pos.greenSoft : pos.surfaceAlt,
          padding: 11,
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: pickup ? pos.blueSoft : pos.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            {pickup ? <ShoppingBag size={19} color={pos.blue} /> : <Table2 size={19} color={pos.primaryText} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: pos.text, fontWeight: '900', fontSize: 14 }} numberOfLines={1}>
              {orderLabel(order)}
            </Text>
            <Text style={{ color: pos.faint, fontWeight: '800', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              Pedido #{order.id} - {(order.items || []).length} lineas - {compactTime(order.created_at)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={{ color: pos.primaryText, fontWeight: '900' }}>{money(order.total)}</Text>
            <Text style={{ color: ready ? pos.green : pos.faint, fontWeight: '900', fontSize: 10, marginTop: 4 }}>
              {ready ? 'COBRAR' : normalizeState(order.estado)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDirectSalePanel = () => (
    <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: pos.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <ShoppingBag size={18} color={pos.primaryText} />
        <Text style={{ color: pos.text, fontSize: 16, fontWeight: '900', marginLeft: 8, flex: 1 }}>
          Express / Delivery desde caja
        </Text>
        <Text style={{ color: pos.green, fontWeight: '900' }}>{money(cartTotal)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        {[
          ['Para llevar', 'Para llevar'],
          ['Delivery', 'Delivery'],
        ].map(([key, label]) => {
          const active = saleType === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSaleType(key)}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 7,
                backgroundColor: active ? pos.primary : pos.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 12, fontWeight: '900' }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View>
        <TextInput
          value={customer.nombre}
          onChangeText={(value) => {
            setCustomer((current) => ({ ...current, nombre: value }));
            if (value.trim()) setCustomerError('');
          }}
          placeholder={saleType === 'Delivery' ? 'Nombre del delivery' : 'Nombre del cliente'}
          placeholderTextColor={pos.faint}
          style={{ height: 38, paddingHorizontal: 10, fontWeight: '800', ...field, borderColor: customerError ? pos.red : field.borderColor }}
        />
        {customerError ? (
          <View style={{ marginTop: 7, borderRadius: 7, backgroundColor: pos.redSoft, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: pos.red }}>
            <Text style={{ color: pos.red, fontSize: 12, fontWeight: '900' }}>{customerError}</Text>
          </View>
        ) : null}
      </View>

      <TextInput
        value={saleNote}
        onChangeText={setSaleNote}
        placeholder="Nota del pedido (opcional)"
        placeholderTextColor={pos.faint}
        style={{ height: 38, paddingHorizontal: 10, fontWeight: '800', marginTop: 8, ...field }}
      />

      <View style={{ marginTop: 10, borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line, overflow: 'hidden' }}>
        {cart.length ? cart.map((item, index) => (
          <View
            key={item.producto_id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 9,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: pos.line,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: pos.text, fontSize: 12, fontWeight: '900' }} numberOfLines={1}>{item.nombre}</Text>
              <Text style={{ color: pos.faint, fontSize: 10, fontWeight: '800', marginTop: 2 }}>{money(item.precio)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 }}>
              <TouchableOpacity onPress={() => changeCartQty(item.producto_id, -1)} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={14} color={pos.muted} />
              </TouchableOpacity>
              <Text style={{ width: 28, color: pos.text, textAlign: 'center', fontWeight: '900' }}>{item.cantidad}</Text>
              <TouchableOpacity onPress={() => changeCartQty(item.producto_id, 1)} style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} color={pos.muted} />
              </TouchableOpacity>
            </View>
            <Text style={{ width: 70, color: pos.primaryText, fontWeight: '900', textAlign: 'right' }}>{money(cartLineTotal(item))}</Text>
          </View>
        )) : (
          <View style={{ padding: 14, alignItems: 'center' }}>
            <Text style={{ color: pos.faint, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>
              Toca productos del menu para agregarlos.
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => setCart([])}
          disabled={!cart.length || orderBusy}
          style={{
            width: 108,
            height: 42,
            borderRadius: 7,
            backgroundColor: pos.redSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: cart.length ? 1 : 0.45,
          }}
        >
          <Text style={{ color: pos.red, fontWeight: '900' }}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={createPickupOrder}
          disabled={!cart.length || orderBusy || !canManageCash || !caja?.caja}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 7,
            backgroundColor: cart.length && canManageCash && caja?.caja ? pos.green : pos.soft,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            opacity: orderBusy ? 0.7 : 1,
          }}
        >
          {orderBusy ? <ActivityIndicator color="#FFFFFF" /> : <CheckCircle2 size={17} color={cart.length && canManageCash && caja?.caja ? '#FFFFFF' : pos.faint} />}
          <Text style={{ color: cart.length && canManageCash && caja?.caja ? '#FFFFFF' : pos.faint, fontWeight: '900', marginLeft: 7 }}>
            {!canManageCash ? 'Solo caja/admin' : caja?.caja ? 'Crear pedido' : 'Caja cerrada'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOrdersPanel = () => (
    <View style={{ ...panel, flex: isWide ? 1 : undefined, width: isWide ? undefined : '100%', overflow: 'hidden' }}>
      {renderDirectSalePanel()}
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: pos.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Receipt size={18} color={pos.primaryText} />
          <Text style={{ color: pos.text, fontSize: 16, fontWeight: '900', marginLeft: 8, flex: 1 }}>
            Cuentas pendientes
          </Text>
          <Text style={{ color: pos.primaryText, fontWeight: '900' }}>{filteredOrders.length}</Text>
        </View>
        <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, ...field }}>
          <Search size={16} color={pos.faint} />
          <TextInput
            value={orderSearch}
            onChangeText={setOrderSearch}
            placeholder="Buscar mesa, pedido o cliente"
            placeholderTextColor={pos.faint}
            style={{ flex: 1, color: pos.text, marginLeft: 8, fontWeight: '800', paddingVertical: 0 }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 10 }}>
          {[
            ['TODOS', 'Todas'],
            ['MESAS', 'Mesas'],
            ['EXPRESS', 'Express'],
            ['DELIVERY', 'Delivery'],
            ['CUENTA', 'Cuenta'],
          ].map(([key, label]) => {
            const active = orderFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setOrderFilter(key)}
                style={{
                  height: 32,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor: active ? pos.primary : pos.soft,
                }}
              >
                <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 11, fontWeight: '900' }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 12 }}>
        {filteredOrders.length ? filteredOrders.map(renderOrderCard) : (
          <View style={{ alignItems: 'center', paddingVertical: 38 }}>
            <Receipt size={34} color={pos.faint} />
            <Text style={{ color: pos.muted, fontWeight: '900', marginTop: 10 }}>Sin cuentas por cobrar</Text>
          </View>
        )}
      </ScrollView>
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: pos.line, backgroundColor: pos.surfaceAlt }}>
        <Text style={{ color: pos.text, fontSize: 14, fontWeight: '900' }}>Detalle de venta</Text>
        <Text style={{ color: pos.faint, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
          Toca una mesa, express o delivery para abrir la ventana de facturacion sin salir de esta pantalla.
        </Text>
      </View>
    </View>
  );

  const renderCajaPanel = () => (
    <View style={{ ...panel, width: isWide ? 320 : '100%', overflow: 'hidden' }}>
      <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <WalletCards size={18} color={pos.primaryText} />
          <Text style={{ color: pos.text, fontSize: 16, fontWeight: '900', marginLeft: 8, flex: 1 }}>
            Caja
          </Text>
          <View
            style={{
              borderRadius: 999,
              backgroundColor: caja?.caja ? pos.greenSoft : pos.redSoft,
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: caja?.caja ? pos.green : pos.red, fontSize: 10, fontWeight: '900' }}>
              {caja?.caja ? 'ABIERTA' : 'CERRADA'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            onPress={handleOpenCaja}
            disabled={cashBusy || !canManageCash}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 7,
              backgroundColor: canManageCash ? pos.blue : pos.soft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: cashBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: canManageCash ? '#FFFFFF' : pos.faint, fontWeight: '900' }}>Abrir caja</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCloseCaja}
            disabled={cashBusy || !canManageCash || !caja?.caja}
            style={{
              flex: 1,
              height: 42,
              borderRadius: 7,
              backgroundColor: canManageCash && caja?.caja ? pos.primary : pos.soft,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: cashBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: canManageCash && caja?.caja ? pos.onPrimary : pos.faint, fontWeight: '900' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => openMovement('INGRESO')}
            disabled={!canManageCash || !caja?.caja}
            style={{ flex: 1, height: 34, borderRadius: 7, backgroundColor: canManageCash && caja?.caja ? pos.greenSoft : pos.soft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: canManageCash && caja?.caja ? pos.green : pos.faint, fontSize: 11, fontWeight: '900' }}>Ingreso</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openMovement('RETIRO')}
            disabled={!canManageCash || !caja?.caja}
            style={{ flex: 1, height: 34, borderRadius: 7, backgroundColor: canManageCash && caja?.caja ? pos.amberSoft : pos.soft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: canManageCash && caja?.caja ? pos.amber : pos.faint, fontSize: 11, fontWeight: '900' }}>Retiro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openMovement('GASTO')}
            disabled={!canManageCash || !caja?.caja}
            style={{ flex: 1, height: 34, borderRadius: 7, backgroundColor: canManageCash && caja?.caja ? pos.redSoft : pos.soft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: canManageCash && caja?.caja ? pos.red : pos.faint, fontSize: 11, fontWeight: '900' }}>Gasto</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setHistoryModal(true)}
          style={{ height: 34, borderRadius: 7, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
        >
          <Text style={{ color: pos.primaryText, fontSize: 11, fontWeight: '900' }}>Historial de cierres</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line }}>
            <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '900' }}>Cobrado hoy</Text>
            <Text style={{ color: pos.green, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{money(caja?.total_cobrado)}</Text>
          </View>
          <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line }}>
            <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '900' }}>Pagos</Text>
            <Text style={{ color: pos.text, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{caja?.pagos_hoy || 0}</Text>
          </View>
        </View>

        <View style={{ borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line, padding: 11, gap: 7 }}>
          {['Efectivo', 'Tarjeta', 'Transferencia', 'QR'].map((method) => (
            <View key={method} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '800' }}>{method}</Text>
              <Text style={{ color: pos.text, fontSize: 12, fontWeight: '900' }}>{money(stats.byMethod[method])}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: pos.line }} />
          {[
            ['Ingresos', movementStats.INGRESO, pos.green],
            ['Retiros', movementStats.RETIRO, pos.amber],
            ['Gastos', movementStats.GASTO, pos.red],
            ['Devoluciones', movementStats.DEVOLUCION, pos.red],
          ].map(([label, value, color]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '800' }}>{label}</Text>
              <Text style={{ color, fontSize: 12, fontWeight: '900' }}>{money(value)}</Text>
            </View>
          ))}
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Clock size={16} color={pos.primaryText} />
            <Text style={{ color: pos.text, fontWeight: '900', marginLeft: 7 }}>Pagos recientes</Text>
          </View>
          {(caja?.pagos || []).slice(0, 6).map((pago, index) => (
            <View
              key={pago.id || index}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: pos.line,
              }}
            >
              <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                <Text style={{ color: pos.text, fontWeight: '900', fontSize: 12 }} numberOfLines={1}>{orderLabel(pago)}</Text>
                <Text style={{ color: pos.faint, fontWeight: '800', fontSize: 10, marginTop: 2 }}>{pago.metodo || 'Pago'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: activePayment(pago) ? pos.green : pos.red, fontWeight: '900', fontSize: 12 }}>{money(pago.monto)}</Text>
                <Text style={{ color: pos.faint, fontWeight: '800', fontSize: 9 }}>{pago.comprobante_numero || pago.estado || ''}</Text>
                {canRequestPaymentActions && activePayment(pago) ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                    <TouchableOpacity disabled={adminBusy} onPress={() => openPaymentAuthorization(pago, 'anular')}>
                      <Text style={{ color: pos.red, fontSize: 9, fontWeight: '900' }}>Anular</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={adminBusy} onPress={() => openPaymentAuthorization(pago, 'devolver')}>
                      <Text style={{ color: pos.amber, fontSize: 9, fontWeight: '900' }}>Devolver</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {!(caja?.pagos || []).length ? (
            <Text style={{ color: pos.faint, fontWeight: '800' }}>Aun no hay pagos registrados.</Text>
          ) : null}
        </View>

        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <WalletCards size={16} color={pos.primaryText} />
            <Text style={{ color: pos.text, fontWeight: '900', marginLeft: 7 }}>Movimientos</Text>
          </View>
          {(caja?.movimientos || []).slice(0, 4).map((item, index) => (
            <View key={item.id || index} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: pos.line }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: pos.text, fontSize: 11, fontWeight: '900' }}>{item.tipo}</Text>
                <Text style={{ color: pos.faint, fontSize: 9, fontWeight: '800' }} numberOfLines={1}>{item.motivo}</Text>
              </View>
              <Text style={{ color: ['INGRESO'].includes(item.tipo) ? pos.green : pos.red, fontSize: 11, fontWeight: '900' }}>{money(item.monto)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderOrderModal = () => (
    <Modal visible={!!selectedOrder} transparent animationType="fade" onRequestClose={closeOrderModal}>
      <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.56)', padding: isPhone ? 8 : 18, justifyContent: 'center' }}>
        <View
          style={{
            width: '100%',
            maxWidth: 1180,
            maxHeight: '94%',
            alignSelf: 'center',
            borderRadius: 10,
            backgroundColor: pos.surface,
            overflow: 'hidden',
            ...shadow(pos, 2),
          }}
        >
          <View
            style={{
              minHeight: 58,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: pos.line,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pos.surfaceAlt,
            }}
          >
            <Receipt size={20} color={pos.primaryText} />
            <View style={{ flex: 1, marginLeft: 9, minWidth: 0 }}>
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900' }} numberOfLines={1}>
                {selectedOrder ? orderLabel(selectedOrder) : 'Factura'}
              </Text>
              <Text style={{ color: pos.faint, fontSize: 12, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
                {selectedOrder ? `Pedido #${selectedOrder.id} - ${isPickupOrder(selectedOrder) ? pickupDetail(selectedOrder) : 'Mesa salon'}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={printReceipt}
              disabled={!selectedOrder}
              style={{ height: 38, borderRadius: 7, backgroundColor: pos.soft, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginRight: 8 }}
            >
              <Printer size={16} color={pos.primaryText} />
              {!isPhone ? <Text style={{ color: pos.primaryText, fontWeight: '900', marginLeft: 6 }}>Imprimir</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={closeOrderModal} style={{ width: 38, height: 38, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
              <X size={19} color={pos.red} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, borderRadius: 8, borderWidth: 1, borderColor: pos.line, overflow: 'hidden' }}>
                <View style={{ padding: 12, backgroundColor: pos.surfaceAlt, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row' }}>
                  <Text style={{ flex: 1, color: pos.muted, fontSize: 12, fontWeight: '900' }}>Producto</Text>
                  <Text style={{ width: 70, color: pos.muted, fontSize: 12, fontWeight: '900', textAlign: 'center' }}>Cant.</Text>
                  <Text style={{ width: 86, color: pos.muted, fontSize: 12, fontWeight: '900', textAlign: 'right' }}>Total</Text>
                </View>
                {(selectedOrder?.items || []).map((item, index) => (
                  <View
                    key={`${selectedOrder?.id}-${item.id || index}`}
                    style={{
                      minHeight: 54,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: pos.line,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: pos.text, fontWeight: '900' }} numberOfLines={1}>{item.nombre}</Text>
                      <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
                        {[item.notas, ...(item.modificadores || []).map((mod) => mod.nombre)].filter(Boolean).join(', ') || 'Sin observaciones'}
                      </Text>
                    </View>
                    <View style={{ width: 70, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                      <TouchableOpacity style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={13} color={pos.faint} />
                      </TouchableOpacity>
                      <Text style={{ color: pos.text, fontWeight: '900', width: 24, textAlign: 'center' }}>{item.cantidad}</Text>
                      <TouchableOpacity style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={13} color={pos.faint} />
                      </TouchableOpacity>
                    </View>
                    <Text style={{ width: 86, color: pos.text, fontWeight: '900', textAlign: 'right' }}>{money(itemLineTotal(item))}</Text>
                  </View>
                ))}
                {selectedSplit ? (
                  <View style={{ margin: 12, padding: 12, borderRadius: 8, backgroundColor: pos.amberSoft, borderWidth: 1, borderColor: pos.amber }}>
                    <Text style={{ color: pos.amber, fontWeight: '900' }}>Cuenta dividida pendiente</Text>
                    {selectedSplit.divisions.map((part) => (
                      <View key={part.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
                        <Text style={{ color: pos.text, fontWeight: '800' }}>{part.nombre}</Text>
                        <Text style={{ color: pos.text, fontWeight: '900' }}>{money(part.monto)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ margin: 12, padding: 12, borderRadius: 8, backgroundColor: pos.surfaceAlt, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: pos.muted, fontWeight: '800' }}>Subtotal</Text>
                    <Text style={{ color: pos.text, fontWeight: '900' }}>{money(subtotal)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: pos.muted, fontWeight: '800' }}>IVA {Number(businessConfig.iva_porcentaje || 0)}%</Text>
                    <Text style={{ color: pos.text, fontWeight: '900' }}>{money(tax)}</Text>
                  </View>
                  {Number(businessConfig.servicio_porcentaje || 0) > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: pos.muted, fontWeight: '800' }}>Servicio {Number(businessConfig.servicio_porcentaje || 0)}%</Text>
                      <Text style={{ color: pos.text, fontWeight: '900' }}>{money(service)}</Text>
                    </View>
                  ) : null}
                  <View style={{ height: 1, backgroundColor: pos.line }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: pos.text, fontSize: 16, fontWeight: '900' }}>TOTAL A PAGAR</Text>
                    <Text style={{ color: pos.green, fontSize: 28, fontWeight: '900' }}>{money(total)}</Text>
                  </View>
                </View>
              </View>

              <View style={{ width: isWide ? 380 : '100%', gap: 10 }}>
                <View style={{ borderRadius: 8, borderWidth: 1, borderColor: pos.line, overflow: 'hidden' }}>
                  <View style={{ padding: 12, backgroundColor: pos.surfaceAlt, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center' }}>
                    <FileText size={17} color={pos.primaryText} />
                    <Text style={{ color: pos.text, fontWeight: '900', marginLeft: 7 }}>Datos de facturacion</Text>
                  </View>
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[
                        ['FINAL', 'Consumidor final'],
                        ['ID', 'Con cedula/RUC'],
                      ].map(([key, label]) => {
                        const active = billingMode === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => {
                              setBillingMode(key);
                              if (key === 'FINAL') {
                                setBillingName('Consumidor Final');
                                setBillingId('');
                                setBillingPhone('');
                                setBillingEmail('');
                              } else {
                                setBillingName(selectedOrder?.cliente_nombre || '');
                              }
                            }}
                            style={{
                              flex: 1,
                              height: 38,
                              borderRadius: 7,
                              backgroundColor: active ? pos.primary : pos.soft,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 12, fontWeight: '900' }}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {matchingClients.length ? (
                      <View style={{ gap: 6 }}>
                        <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900' }}>Clientes frecuentes</Text>
                        {matchingClients.map((client) => (
                          <TouchableOpacity
                            key={client.id}
                            onPress={() => selectBillingClient(client)}
                            style={{ padding: 8, borderRadius: 7, backgroundColor: pos.soft, borderWidth: 1, borderColor: pos.line }}
                          >
                            <Text style={{ color: pos.text, fontSize: 12, fontWeight: '900' }} numberOfLines={1}>{client.nombre}</Text>
                            <Text style={{ color: pos.faint, fontSize: 10, fontWeight: '800' }}>{client.documento}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}

                    <View>
                      <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>Cliente</Text>
                      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, ...field }}>
                        <TextInput
                          value={billingName}
                          onChangeText={setBillingName}
                          editable={billingMode === 'ID'}
                          placeholder={billingMode === 'ID' ? 'Nombre o razon social' : 'Consumidor Final'}
                          placeholderTextColor={pos.faint}
                          style={{ flex: 1, color: pos.text, fontWeight: '800', paddingVertical: 0 }}
                        />
                        <User size={15} color={pos.faint} />
                      </View>
                    </View>

                    {billingMode === 'ID' ? (
                      <>
                        <View>
                          <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>Cedula / RUC</Text>
                          <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, ...field }}>
                            <TextInput
                              value={billingId}
                              onChangeText={(value) => setBillingId(cleanDocument(value))}
                              keyboardType="number-pad"
                              placeholder="10 digitos cedula o 13 RUC"
                              placeholderTextColor={pos.faint}
                              maxLength={13}
                              style={{ flex: 1, color: pos.text, fontWeight: '800', paddingVertical: 0 }}
                            />
                            <Hash size={15} color={pos.faint} />
                          </View>
                        </View>
                        <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 8 }}>
                          <TextInput
                            value={billingPhone}
                            onChangeText={setBillingPhone}
                            keyboardType="phone-pad"
                            placeholder="Telefono (opcional)"
                            placeholderTextColor={pos.faint}
                            style={{ flex: 1, height: 38, paddingHorizontal: 10, fontWeight: '800', ...field }}
                          />
                          <TextInput
                            value={billingEmail}
                            onChangeText={setBillingEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholder="Correo (opcional)"
                            placeholderTextColor={pos.faint}
                            style={{ flex: 1, height: 38, paddingHorizontal: 10, fontWeight: '800', ...field }}
                          />
                        </View>
                      </>
                    ) : null}

                    <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>Comprobante</Text>
                        <View style={{ height: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, ...field }}>
                          <Text style={{ flex: 1, color: pos.text, fontWeight: '800' }} numberOfLines={1}>
                            {billingMode === 'ID' ? caja?.siguiente_factura : caja?.siguiente_ticket}
                          </Text>
                          <Receipt size={15} color={pos.faint} />
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>Fecha</Text>
                        <View style={{ height: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, ...field }}>
                          <Text style={{ flex: 1, color: pos.text, fontWeight: '800' }} numberOfLines={1}>
                            {new Date().toLocaleDateString('es-EC')}
                          </Text>
                          <Calendar size={15} color={pos.faint} />
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        borderRadius: 7,
                        backgroundColor: billingMode === 'ID' ? pos.greenSoft : pos.soft,
                        padding: 10,
                        borderWidth: 1,
                        borderColor: billingMode === 'ID' ? pos.green : pos.line,
                      }}
                    >
                      <Text
                        style={{
                          color: billingMode === 'ID' ? pos.green : pos.muted,
                          fontSize: 12,
                          fontWeight: '900',
                        }}
                      >
                        {billingMode === 'ID'
                          ? `IVA declarado al documento: ${money(tax)}`
                          : `Consumidor final: IVA incluido ${money(tax)}`}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ borderRadius: 8, borderWidth: 1, borderColor: pos.line, overflow: 'hidden' }}>
                  <View style={{ padding: 12, backgroundColor: pos.surfaceAlt, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center' }}>
                    <WalletCards size={17} color={pos.primaryText} />
                    <Text style={{ color: pos.text, fontWeight: '900', marginLeft: 7 }}>Pago</Text>
                  </View>
                  <View style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {paymentMethods.slice(0, 4).map(({ label, icon: Icon }) => {
                        const active = paymentMethod === label;
                        return (
                          <TouchableOpacity
                            key={label}
                            onPress={() => setPaymentMethod(label)}
                            style={{
                              flex: 1,
                              minWidth: 104,
                              height: 42,
                              borderRadius: 7,
                              backgroundColor: active ? pos.primary : pos.surfaceAlt,
                              borderWidth: 1,
                              borderColor: active ? pos.primary : pos.line,
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexDirection: 'row',
                            }}
                          >
                            <Icon size={16} color={active ? pos.onPrimary : pos.muted} />
                            <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 11, fontWeight: '900', marginLeft: 6 }}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 10, marginTop: 12 }}>
                      <View style={{ width: isPhone ? '100%' : 112, gap: 8 }}>
                        <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900' }}>Recibido</Text>
                        <TextInput
                          value={cashReceived}
                          onChangeText={(value) => setCashReceived(value.replace(',', '.'))}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={pos.faint}
                          style={{ height: 50, paddingHorizontal: 12, color: pos.green, fontSize: 20, fontWeight: '900', ...field }}
                        />
                        <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '900' }}>Cambio</Text>
                        <View style={{ height: 50, borderRadius: 7, backgroundColor: pos.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: pos.green, fontSize: 20, fontWeight: '900' }}>{money(change)}</Text>
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {['7', '8', '9', 'back', '4', '5', '6', '+', '1', '2', '3', '-', '0', '00', '.', 'clear'].map((key) => (
                            <TouchableOpacity
                              key={key}
                              onPress={() => appendCash(key === '+' || key === '-' ? '' : key)}
                              style={{
                                width: '23.5%',
                                height: 42,
                                borderRadius: 7,
                                backgroundColor: key === 'clear' ? pos.primary : pos.surfaceAlt,
                                borderWidth: 1,
                                borderColor: pos.line,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {key === 'back' ? (
                                <Trash2 size={16} color={pos.red} />
                              ) : (
                                <Text style={{ color: key === 'clear' ? pos.onPrimary : pos.text, fontSize: 16, fontWeight: '900' }}>
                                  {key === 'clear' ? 'C' : key}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    {paymentMethod !== 'Efectivo' ? (
                      <TextInput
                        value={reference}
                        onChangeText={setReference}
                        placeholder="Referencia, voucher o nota"
                        placeholderTextColor={pos.faint}
                        style={{ height: 40, paddingHorizontal: 10, marginTop: 10, fontWeight: '800', ...field }}
                      />
                    ) : null}

                    <TouchableOpacity
                      onPress={handleCharge}
                      disabled={!canCharge || busy}
                      style={{
                        height: 58,
                        borderRadius: 8,
                        backgroundColor: canCharge && !busy ? pos.green : pos.soft,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        marginTop: 12,
                      }}
                    >
                      {busy ? <ActivityIndicator color="#FFFFFF" /> : <CheckCircle2 size={22} color={canCharge ? '#FFFFFF' : pos.faint} />}
                      <Text style={{ color: canCharge ? '#FFFFFF' : pos.faint, fontSize: 15, fontWeight: '900', marginLeft: 8 }}>
                        {canManageCash ? 'Cobrar / Facturar' : 'Solo caja/admin'}
                      </Text>
                    </TouchableOpacity>
                    {selectedOrder && !canManageCash ? (
                      <Text style={{ color: pos.amber, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>
                        Supervisor puede anular o devolver pagos, pero no cobrar.
                      </Text>
                    ) : null}
                    {!caja?.caja ? (
                      <Text style={{ color: pos.red, fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 8 }}>
                        Abre caja antes de cobrar.
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const expectedCash = Number(caja?.caja?.monto_inicial || 0)
    + Number(stats.byMethod.Efectivo || 0)
    + Number(movementStats.INGRESO || 0)
    - Number(movementStats.RETIRO || 0)
    - Number(movementStats.GASTO || 0)
    - Number(movementStats.DEVOLUCION || 0);
  const countedCash = Number(closeAmount || 0);
  const closeDiff = countedCash - expectedCash;

  const renderCashModals = () => (
    <>
      <Modal visible={openCajaModal} transparent animationType="fade" onRequestClose={() => setOpenCajaModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.55)', padding: 16, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', borderRadius: 10, backgroundColor: pos.surface, overflow: 'hidden', ...shadow(pos, 2) }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center', backgroundColor: pos.surfaceAlt }}>
              <WalletCards size={20} color={pos.primaryText} />
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900', marginLeft: 8, flex: 1 }}>Abrir caja</Text>
              <TouchableOpacity onPress={() => setOpenCajaModal(false)} style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={pos.red} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 14, gap: 10 }}>
              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Cajera responsable</Text>
                <View style={{ height: 42, paddingHorizontal: 11, justifyContent: 'center', ...field }}>
                  <Text style={{ color: pos.text, fontWeight: '900' }}>{user?.nombre || user?.name || user?.correo || 'Cajera'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Fecha y hora</Text>
                  <View style={{ height: 42, paddingHorizontal: 11, justifyContent: 'center', ...field }}>
                    <Text style={{ color: pos.text, fontWeight: '800' }}>{new Date().toLocaleString('es-EC')}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Monto inicial efectivo</Text>
                  <TextInput
                    value={openAmount}
                    onChangeText={(value) => setOpenAmount(value.replace(',', '.'))}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={pos.faint}
                    style={{ height: 42, paddingHorizontal: 11, fontWeight: '900', fontSize: 18, ...field }}
                  />
                </View>
              </View>
              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Observacion opcional</Text>
                <TextInput
                  value={openNote}
                  onChangeText={setOpenNote}
                  placeholder="Ej. Turno manana, billetes revisados..."
                  placeholderTextColor={pos.faint}
                  style={{ minHeight: 74, paddingHorizontal: 11, paddingVertical: 10, fontWeight: '800', ...field }}
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={submitOpenCaja}
                disabled={cashBusy}
                style={{ height: 48, borderRadius: 8, backgroundColor: pos.blue, alignItems: 'center', justifyContent: 'center', marginTop: 4, opacity: cashBusy ? 0.65 : 1 }}
              >
                {cashBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Confirmar apertura</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={closeCajaModal} transparent animationType="fade" onRequestClose={() => setCloseCajaModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.55)', padding: 16, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 620, alignSelf: 'center', borderRadius: 10, backgroundColor: pos.surface, overflow: 'hidden', ...shadow(pos, 2) }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center', backgroundColor: pos.surfaceAlt }}>
              <Receipt size={20} color={pos.primaryText} />
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900', marginLeft: 8, flex: 1 }}>Cerrar caja</Text>
              <TouchableOpacity onPress={() => setCloseCajaModal(false)} style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={pos.red} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: 10 }}>
                <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line }}>
                  <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '900' }}>Monto inicial</Text>
                  <Text style={{ color: pos.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{money(caja?.caja?.monto_inicial)}</Text>
                </View>
                <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line }}>
                  <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '900' }}>Efectivo esperado</Text>
                  <Text style={{ color: pos.green, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{money(expectedCash)}</Text>
                </View>
                <View style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: closeDiff < 0 ? pos.redSoft : pos.greenSoft, borderWidth: 1, borderColor: closeDiff < 0 ? pos.red : pos.green }}>
                  <Text style={{ color: closeDiff < 0 ? pos.red : pos.green, fontSize: 11, fontWeight: '900' }}>Diferencia</Text>
                  <Text style={{ color: closeDiff < 0 ? pos.red : pos.green, fontSize: 20, fontWeight: '900', marginTop: 4 }}>{money(closeDiff)}</Text>
                </View>
              </View>

              <View style={{ borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line, padding: 12, gap: 8 }}>
                {[
                  ['Total vendido', caja?.total_cobrado],
                  ['Total efectivo', stats.byMethod.Efectivo],
                  ['Total tarjeta', stats.byMethod.Tarjeta],
                  ['Total transferencia', stats.byMethod.Transferencia],
                  ['Total QR', stats.byMethod.QR],
                  ['Ingresos de caja', movementStats.INGRESO],
                  ['Retiros', movementStats.RETIRO],
                  ['Gastos', movementStats.GASTO],
                  ['Devoluciones', movementStats.DEVOLUCION],
                ].map(([label, value]) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: pos.muted, fontWeight: '800' }}>{label}</Text>
                    <Text style={{ color: pos.text, fontWeight: '900' }}>{money(value)}</Text>
                  </View>
                ))}
              </View>

              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Efectivo contado fisicamente</Text>
                <TextInput
                  value={closeAmount}
                  onChangeText={(value) => setCloseAmount(value.replace(',', '.'))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={pos.faint}
                  style={{ height: 46, paddingHorizontal: 12, fontWeight: '900', fontSize: 20, ...field }}
                />
              </View>
              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Observacion opcional</Text>
                <TextInput
                  value={closeNote}
                  onChangeText={setCloseNote}
                  placeholder="Ej. Faltante, sobrante, retiro de caja..."
                  placeholderTextColor={pos.faint}
                  style={{ minHeight: 70, paddingHorizontal: 11, paddingVertical: 10, fontWeight: '800', ...field }}
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={submitCloseCaja}
                disabled={cashBusy}
                style={{ height: 50, borderRadius: 8, backgroundColor: pos.primary, alignItems: 'center', justifyContent: 'center', opacity: cashBusy ? 0.65 : 1 }}
              >
                {cashBusy ? <ActivityIndicator color={pos.onPrimary} /> : <Text style={{ color: pos.onPrimary, fontWeight: '900' }}>Confirmar cierre manual</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={movementModal} transparent animationType="fade" onRequestClose={() => setMovementModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.55)', padding: 16, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', borderRadius: 10, backgroundColor: pos.surface, overflow: 'hidden', ...shadow(pos, 2) }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center', backgroundColor: pos.surfaceAlt }}>
              <WalletCards size={20} color={pos.primaryText} />
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900', marginLeft: 8, flex: 1 }}>Movimiento de caja</Text>
              <TouchableOpacity onPress={() => setMovementModal(false)} style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={pos.red} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['INGRESO', 'RETIRO', 'GASTO'].map((type) => {
                  const active = movementType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setMovementType(type)}
                      style={{ flex: 1, height: 38, borderRadius: 7, backgroundColor: active ? pos.primary : pos.soft, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: active ? pos.onPrimary : pos.muted, fontSize: 11, fontWeight: '900' }}>{type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Monto</Text>
                <TextInput
                  value={movementAmount}
                  onChangeText={(value) => setMovementAmount(value.replace(',', '.'))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={pos.faint}
                  style={{ height: 44, paddingHorizontal: 11, fontWeight: '900', fontSize: 18, ...field }}
                />
              </View>
              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Motivo</Text>
                <TextInput
                  value={movementReason}
                  onChangeText={setMovementReason}
                  placeholder="Ej. Compra de servilletas, retiro para deposito..."
                  placeholderTextColor={pos.faint}
                  style={{ minHeight: 70, paddingHorizontal: 11, paddingVertical: 10, fontWeight: '800', ...field }}
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={submitMovement}
                disabled={cashBusy}
                style={{ height: 48, borderRadius: 8, backgroundColor: pos.green, alignItems: 'center', justifyContent: 'center', opacity: cashBusy ? 0.65 : 1 }}
              >
                {cashBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Registrar movimiento</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={paymentAuth.visible} transparent animationType="fade" onRequestClose={() => setPaymentAuth((prev) => ({ ...prev, visible: false }))}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.55)', padding: 16, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 500, alignSelf: 'center', borderRadius: 10, backgroundColor: pos.surface, overflow: 'hidden', ...shadow(pos, 2) }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center', backgroundColor: pos.surfaceAlt }}>
              <ShieldCheck size={20} color={paymentAuth.action === 'anular' ? pos.red : pos.amber} />
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900', marginLeft: 8, flex: 1 }}>
                {paymentAuth.action === 'anular' ? 'Autorizar anulacion' : 'Autorizar devolucion'}
              </Text>
              <TouchableOpacity onPress={() => setPaymentAuth((prev) => ({ ...prev, visible: false }))} style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={pos.red} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 14, gap: 10 }}>
              <View style={{ borderRadius: 8, backgroundColor: pos.surfaceAlt, borderWidth: 1, borderColor: pos.line, padding: 11 }}>
                <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '900' }}>Pago seleccionado</Text>
                <Text style={{ color: pos.text, fontSize: 14, fontWeight: '900', marginTop: 4 }}>
                  {paymentAuth.pago?.comprobante_numero || `Pago #${paymentAuth.pago?.id || '-'}`} - {money(paymentAuth.pago?.monto)}
                </Text>
              </View>

              <View>
                <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Motivo obligatorio</Text>
                <TextInput
                  value={paymentAuth.motivo}
                  onChangeText={(value) => setPaymentAuth((prev) => ({ ...prev, motivo: value }))}
                  placeholder="Ej. Error de metodo de pago, cliente solicito devolucion..."
                  placeholderTextColor={pos.faint}
                  style={{ minHeight: 74, paddingHorizontal: 11, paddingVertical: 10, fontWeight: '800', ...field }}
                  multiline
                />
              </View>

              {!canVoidPayments ? (
                <View style={{ borderRadius: 8, backgroundColor: pos.amberSoft, borderWidth: 1, borderColor: '#F59E0B', padding: 11, gap: 10 }}>
                  <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '900' }}>
                    Requiere PIN de administrador o supervisor.
                  </Text>
                  <View>
                    <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>Correo autorizador</Text>
                    <TextInput
                      value={paymentAuth.correo}
                      onChangeText={(value) => setPaymentAuth((prev) => ({ ...prev, correo: value }))}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      placeholder="supervisor@morenamia.com"
                      placeholderTextColor={pos.faint}
                      style={{ height: 42, paddingHorizontal: 11, fontWeight: '800', ...field }}
                    />
                  </View>
                  <View>
                    <Text style={{ color: pos.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 }}>PIN</Text>
                    <TextInput
                      value={paymentAuth.pin}
                      onChangeText={(value) => setPaymentAuth((prev) => ({ ...prev, pin: value.replace(/\D/g, '').slice(0, 4) }))}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      placeholder="0000"
                      placeholderTextColor={pos.faint}
                      style={{ height: 42, paddingHorizontal: 11, fontWeight: '900', letterSpacing: 8, ...field }}
                    />
                  </View>
                </View>
              ) : (
                <Text style={{ color: pos.green, fontSize: 12, fontWeight: '800' }}>
                  Tu rol puede autorizar esta accion con la sesion actual.
                </Text>
              )}

              <TouchableOpacity
                onPress={submitPaymentAuthorization}
                disabled={adminBusy}
                style={{
                  height: 48,
                  borderRadius: 8,
                  backgroundColor: paymentAuth.action === 'anular' ? pos.red : pos.amber,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: adminBusy ? 0.65 : 1,
                }}
              >
                {adminBusy ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                    {paymentAuth.action === 'anular' ? 'Anular pago' : 'Registrar devolucion'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={historyModal} transparent animationType="fade" onRequestClose={() => setHistoryModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(2,8,23,0.55)', padding: 16, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 760, maxHeight: '86%', alignSelf: 'center', borderRadius: 10, backgroundColor: pos.surface, overflow: 'hidden', ...shadow(pos, 2) }}>
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: pos.line, flexDirection: 'row', alignItems: 'center', backgroundColor: pos.surfaceAlt }}>
              <Receipt size={20} color={pos.primaryText} />
              <Text style={{ color: pos.text, fontSize: 18, fontWeight: '900', marginLeft: 8, flex: 1 }}>Historial de cierres</Text>
              <TouchableOpacity onPress={exportClosures} style={{ height: 34, borderRadius: 7, backgroundColor: pos.greenSoft, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Text style={{ color: pos.green, fontSize: 12, fontWeight: '900' }}>Exportar CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setHistoryModal(false)} style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: pos.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={pos.red} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
              {(caja?.cierres || []).map((item) => (
                <View key={item.id} style={{ borderRadius: 8, borderWidth: 1, borderColor: pos.line, backgroundColor: pos.surfaceAlt, padding: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: pos.text, fontSize: 14, fontWeight: '900' }}>Caja #{item.id} - {item.trabajador_nombre || 'Cajera'}</Text>
                      <Text style={{ color: pos.faint, fontSize: 11, fontWeight: '800', marginTop: 2 }}>
                        {item.fecha_cierre ? new Date(item.fecha_cierre).toLocaleString('es-EC') : 'Sin fecha'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: pos.green, fontSize: 14, fontWeight: '900' }}>{money(item.total_ventas)}</Text>
                      <Text style={{ color: Number(item.diferencia_cierre || 0) < 0 ? pos.red : pos.muted, fontSize: 11, fontWeight: '900' }}>
                        Dif. {money(item.diferencia_cierre)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '800' }}>Inicial {money(item.monto_inicial)}</Text>
                    <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '800' }}>Esperado {money(item.efectivo_esperado)}</Text>
                    <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '800' }}>Contado {money(item.monto_final)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => printText(closureText(item), `Cierre caja ${item.id}`)} style={{ height: 32, borderRadius: 7, backgroundColor: pos.soft, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                    <Text style={{ color: pos.primaryText, fontSize: 11, fontWeight: '900' }}>Imprimir resumen</Text>
                  </TouchableOpacity>
                  {canManageClosures ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity disabled={adminBusy} onPress={() => adminClosureAction(item, 'editar')} style={{ flex: 1, height: 30, borderRadius: 7, backgroundColor: pos.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: pos.blue, fontSize: 11, fontWeight: '900' }}>Editar cierre</Text>
                      </TouchableOpacity>
                      <TouchableOpacity disabled={adminBusy} onPress={() => adminClosureAction(item, 'reabrir')} style={{ flex: 1, height: 30, borderRadius: 7, backgroundColor: pos.amberSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: pos.amber, fontSize: 11, fontWeight: '900' }}>Reabrir</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))}
              {!(caja?.cierres || []).length ? (
                <Text style={{ color: pos.faint, fontWeight: '800', textAlign: 'center', paddingVertical: 30 }}>Aun no hay cierres registrados.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );

  if (loading && !pedidos.length) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: TOP_INSET, backgroundColor: pos.bg }}>
        <ActivityIndicator size="large" color={pos.blue} />
        <Text style={{ color: pos.muted, fontWeight: '800', marginTop: 12 }}>Cargando caja...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: TOP_INSET, backgroundColor: pos.bg }}>
      <View
        style={{
          minHeight: 70,
          backgroundColor: pos.appBar,
          paddingHorizontal: pad + 6,
          paddingVertical: 9,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Logo height={isTablet ? 42 : 32} dark />
        <View style={{ width: 1, height: 42, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#FFFFFF', fontSize: isTablet ? 20 : 16, fontWeight: '900' }} numberOfLines={1}>
            Sistema de facturacion
          </Text>
          <Text style={{ color: '#BBD0E8', fontSize: 12, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
            Morena Mia - Caja {caja?.caja ? `abierta #${caja.caja.id}` : 'cerrada'} - {connected ? 'Sincronizada' : 'Reconectando'}
          </Text>
        </View>
        <View style={{ height: 38, borderRadius: 999, paddingHorizontal: 11, alignItems: 'center', flexDirection: 'row', backgroundColor: connected ? 'rgba(16,185,129,0.16)' : 'rgba(245,158,11,0.16)' }}>
          {connected ? <Wifi size={15} color="#34D399" /> : <WifiOff size={15} color="#FBBF24" />}
          {isTablet ? <Text style={{ color: connected ? '#34D399' : '#FBBF24', fontSize: 12, fontWeight: '900', marginLeft: 7 }}>{connected ? 'En vivo' : 'Offline'}</Text> : null}
        </View>
        <TouchableOpacity onPress={toggle} style={{ width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' }}>
          {isDark ? <Sun size={17} color="#FBBF24" /> : <Moon size={17} color="#DBEAFE" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={refreshAll} style={{ width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.09)' }}>
          <RefreshCw size={17} color="#DBEAFE" />
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={{ width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(225,29,72,0.18)' }}>
          <LogOut size={17} color="#FB7185" />
        </TouchableOpacity>
      </View>

      {cashNotice ? (
        <View
          style={{
            position: 'absolute',
            top: TOP_INSET + 78,
            right: pad + 6,
            zIndex: 40,
            maxWidth: 430,
            minWidth: isPhone ? undefined : 330,
            left: isPhone ? pad + 6 : undefined,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: cashNotice.type === 'error'
              ? pos.redSoft
              : cashNotice.type === 'warning'
                ? pos.amberSoft
                : cashNotice.type === 'success'
                  ? pos.greenSoft
                  : pos.blueSoft,
            borderWidth: 1,
            borderColor: cashNotice.type === 'error'
              ? pos.red
              : cashNotice.type === 'warning'
                ? pos.amber
                : cashNotice.type === 'success'
                  ? pos.green
                  : pos.blue,
            flexDirection: 'row',
            alignItems: 'center',
            ...shadow(pos, 1),
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: pos.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            {cashNotice.type === 'error' ? (
              <WifiOff size={17} color={pos.red} />
            ) : (
              <CheckCircle2
                size={17}
                color={cashNotice.type === 'warning' ? pos.amber : cashNotice.type === 'success' ? pos.green : pos.blue}
              />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: pos.text, fontSize: 13, fontWeight: '900' }} numberOfLines={1}>{cashNotice.title}</Text>
            <Text style={{ color: pos.muted, fontSize: 11, fontWeight: '800', marginTop: 2 }} numberOfLines={2}>{cashNotice.message}</Text>
          </View>
          <TouchableOpacity onPress={() => setCashNotice(null)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: pos.surface, marginLeft: 8 }}>
            <X size={14} color={pos.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: pad, paddingBottom: BOTTOM_INSET + 10 }}>
        <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 10, alignItems: 'stretch' }}>
          {renderMenuPanel()}
          {renderOrdersPanel()}
          {renderCajaPanel()}
        </View>
      </ScrollView>
      {renderOrderModal()}
      {renderCashModals()}
    </SafeAreaView>
  );
}

export default function CashierApp() {
  return (
    <AdminProvider>
      <CashierShell />
    </AdminProvider>
  );
}
