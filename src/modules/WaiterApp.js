import WaiterExpress from '../components/WaiterExpress';
import WaiterCatalog from '../components/WaiterCatalog';
import { isMenuPromotion as isPromotionProduct } from '../utils/waiterCatalog.mjs';
import OrderOverview from '../components/OrderOverview';
import OrderServicePanel from '../components/OrderServicePanel';
import WaiterNotifications from '../components/WaiterNotifications';
import useServiceAlerts from '../services/useServiceAlerts';
import useServiceClock from '../services/useServiceClock';
import { draftDeliveryStatus, confirmedOrder } from '../utils/waiterSync.mjs';
import { accountRounds, combineAccounts, operationalOrder, splitCents } from '../utils/accountLogic.mjs';
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BadgePercent,
  Bell,
  CheckCircle2,
  ChefHat,
  Clock,
  Coffee,
  Croissant,
  CupSoda,
  GlassWater,
  Grid2X2,
  Info,
  LogOut,
  Menu,
  Minus,
  Moon,
  PieChart,
  Plus,
  Printer,
  Receipt,
  Search,
  Sandwich,
  Soup,
  Sun,
  Table2,
  Trash2,
  Users,
  X,
  CakeSlice,
  ArrowRightLeft
} from 'lucide-react-native';
import axios from 'axios';
import { useFonts } from 'expo-font';
import { runExclusive } from '../utils/waiterLogic.mjs';
import { useAuth, BASE_URL, assetUrl } from '../context/AuthContext';
import { useTheme, operationalColors as UI_COLORS, tableStatusMeta } from '../theme';
import Logo from '../components/Logo';
import WaiterFloor from '../components/WaiterFloor';
import { addDraftProduct, changeDraftQuantity } from '../utils/waiterCart.mjs';
import { createRefreshQueue } from '../utils/kitchenLogic.mjs';
import ProductCard from '../components/WaiterProductCard';
import WaiterNavigation from '../components/WaiterNavigation';
import useWaiterDrafts from '../services/useWaiterDrafts';
import { validateDraft, emptyExpressInfo, isExpressDraftKey, savedDraftKeys } from '../utils/orderDrafts.mjs';
import ExpressDraftList from '../components/ExpressDraftList';
import { catalogContext } from '../utils/waiterNavigation.mjs';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';
import {
  addWaiterNotificationResponseListener,
  configureWaiterNotifications,
  notifyWaiterInApp,
  registerWaiterPushToken,
} from '../services/waiterNotifications';
import { ALERT_TONES, playWebAlertTone } from '../services/webAudioAlerts';

const DEFAULT_BUSINESS_CONFIG = {
  servicio_porcentaje: '0',
};
// Solo 'PAGADO' y 'CANCELADO' cierran la cuenta en el backend.
const WAITER_FONT = Platform.select({
  web: 'Manrope, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

const Text = ({ style, ...props }) => (
  <RNText {...props} style={[WAITER_FONT ? { fontFamily: WAITER_FONT } : null, style]} />
);

// --- UTILIDADES ---
function money(n) { return `$${Number(n || 0).toFixed(2)}`; }

function percentRate(value, fallback = 0) {
  const parsed = Number(String(value ?? fallback).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed / 100 : 0;
}

function lineExtras(item) {
  return (item.modificadores || []).reduce((sum, mod) => sum + Number(mod.precio_extra || 0), 0);
}

function lineTotal(item) {
  return (Number(item.precio || 0) + lineExtras(item)) * Number(item.cantidad || 0);
}

function modifierLabel(mod) {
  return `${mod.nombre}${Number(mod.precio_extra || 0) ? ` +${money(mod.precio_extra)}` : ''}`;
}

const normalizeEstado = (estado) => String(estado || 'PENDIENTE').toUpperCase();
const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

const upsertById = (items, nextItem) => {
  if (!nextItem?.id) return items;
  const exists = items.some((item) => Number(item.id) === Number(nextItem.id));
  return exists
    ? items.map((item) => (Number(item.id) === Number(nextItem.id) ? { ...item, ...nextItem } : item))
    : [nextItem, ...items];
};

const updateMesaFromEvent = (items, payload = {}, fallbackEstado = null) => {
  const mesaId = Number(payload.mesa?.id || payload.mesa_id);
  if (!mesaId) return items;
  const mesaPatch = payload.mesa || { id: mesaId, estado: fallbackEstado };
  return upsertById(items, mesaPatch);
};

// BUG FIX #2: Extracción robusta del mesa_id de un pedido.
// El backend a veces devuelve mesa_id, a veces mesa.id, a veces mesa_numero.
// Nunca dependas de un solo campo.
const getMesaIdFromPedido = (pedido) => {
  if (!pedido) return null;
  const id = Number(pedido.mesa_id || pedido.mesa?.id || 0);
  return id > 0 ? id : null;
};

const isPickupOrder = (pedido = {}) => (
  !getMesaIdFromPedido(pedido) || ['Para llevar', 'Delivery'].includes(pedido.tipo)
);

const pickupTypeLabel = (tipo) => (tipo === 'Delivery' ? 'Delivery' : 'Express');
const pickupOrderLabel = (pedido = {}) => `${pickupTypeLabel(pedido.tipo)} #${pedido.id || '-'}: ${pedido.cliente_nombre || 'Cliente'}`;
const pickupDetailLabel = (pedido = {}) => {
  if (pedido.tipo === 'Delivery') {
    return [
      pedido.delivery_telefono,
      pedido.delivery_direccion,
      pedido.delivery_referencia,
      pedido.cliente_dato,
    ].filter(Boolean).join(' - ') || 'Delivery';
  }
  return pedido.cliente_dato || 'Para recoger';
};



const statusMeta = tableStatusMeta;

const modernShadow = Platform.select({
  web: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.15)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }
});

const softShadow = Platform.select({
  web: { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.1)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
});

const EXPRESS_DESTINATION = '__express__';

// BUG FIX #3: SwipeableRow — el PanResponder se recrea cuando cambia `enabled`,
// lo que provocaba que el swipe quedara bloqueado después del primer render.
// Solución: mover `enabled` a un ref para que el PanResponder siempre lo lea actualizado
// sin necesidad de recrearse.
const SwipeableRow = ({ children, onDelete, enabled, colors }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const enabledRef = useRef(enabled);
  const onDeleteRef = useRef(onDelete);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (e, gestureState) => {
        return enabledRef.current
          && Math.abs(gestureState.dx) > 20
          && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (e, gestureState) => {
        let newDx = isOpen.current ? gestureState.dx - 80 : gestureState.dx;
        if (newDx < -100) newDx = -100 - (Math.abs(newDx + 100) * 0.1);
        if (newDx > 0) newDx = 0;
        pan.setValue(newDx);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx < -50 || (isOpen.current && gestureState.dx < 10)) {
          isOpen.current = true;
          Animated.spring(pan, { toValue: -80, useNativeDriver: true, tension: 50, friction: 8 }).start();
        } else {
          isOpen.current = false;
          Animated.spring(pan, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
        }
      },
      onPanResponderTerminate: () => {
        isOpen.current = false;
        Animated.spring(pan, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
      }
    })
  ).current;

  if (!enabled) return children;

  return (
    <View style={{ position: 'relative', width: '100%' }}>
      <View style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 90,
        backgroundColor: colors.danger, borderRadius: 8,
        alignItems: 'flex-end', justifyContent: 'center', paddingRight: 24
      }}>
        <TouchableOpacity onPress={() => onDeleteRef.current?.()} style={{ height: '100%', justifyContent: 'center' }}>
          <Trash2 size={24} color={colors.onAccent} />
        </TouchableOpacity>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX: pan }] }}>
        {children}
      </Animated.View>
    </View>
  );
};

export default function App() {
  useFonts({ Manrope: require('../../assets/fonts/Manrope-Regular.ttf') });
  const { user, logout } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const measureViewport = useCallback(event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  }, []);
  const width = Math.min(windowWidth, measuredWidth ?? windowWidth);
  const { isDark, toggle: toggleTheme } = useTheme();
  const colors = useMemo(() => isDark ? UI_COLORS.dark : { ...UI_COLORS.light, pageBg: '#F7F8FA', ink: '#142238', success: '#047857', warning: '#92570A', danger: '#BE123C', brand: '#8A5B08', brandHover: '#D99A1F', softOrange: '#FFF4D6', onAccent: '#142238', action: '#F6B325' }, [isDark]);

  const [step, setStep] = useState('mesas');
  const serviceNow = useServiceClock(['mesas', 'express', 'pedido'].includes(step));
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [businessConfig, setBusinessConfig] = useState(DEFAULT_BUSINESS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const dataLoaded = useRef(false);
  const loadDataLock = useRef(false);
  const [orderSending, setOrderSending] = useState(false);
  const orderSendLock = useRef(false);
  const [mesaSel, setMesaSel] = useState(null);
  const [orderMode, setOrderMode] = useState('mesa');
  const [selectedExpressPedidoId, setSelectedExpressPedidoId] = useState(null);
  const [selectedExpressDraftKey, setSelectedExpressDraftKey] = useState(null);
  const [mesaFilter, setMesaFilter] = useState('Todas');
  const [mesaSearch, setMesaSearch] = useState('');
  const [mesaZone, setMesaZone] = useState('Todas');
  const [compactTables, setCompactTables] = useState(false);
  const [expressSearch, setExpressSearch] = useState('');
  const [expressView, setExpressView] = useState('active');
  const [categoria, setCategoria] = useState('Todas');
  const [promoCategoria, setPromoCategoria] = useState('Todas');
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [menuPreferences, setMenuPreferences] = useState({ view: 'auto', sort: 'name', availableOnly: false });
  const [expressStageFilter, setExpressStageFilter] = useState('all');
  const [promoBusqueda, setPromoBusqueda] = useState('');
  const drafts = useWaiterDrafts(user.id);
  const [draftListOpen, setDraftListOpen] = useState(false);
  const { carritos, setCarritos, orderNotes, setOrderNotes } = drafts;
  const [pickupFilter, setPickupFilter] = useState('Todos');
  const [customExtras, setCustomExtras] = useState({});
  const [notificaciones, setNotificaciones] = useState([]);
  const [kitchenNotice, setKitchenNotice] = useState(null);
  const [notiOpen, setNotiOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [editItemId, setEditItemId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);
  const kitchenNoticeTimer = useRef(null);
  const realtimeStatusRef = useRef('connecting');
  const serviceAlerts = useServiceAlerts(user?.id, (items) => {
    if (kitchenNoticeTimer.current) clearTimeout(kitchenNoticeTimer.current);
    setKitchenNotice({action:'delay_summary',title:`${items.length} ${items.length===1?'ronda requiere':'rondas requieren'} atención`,body:'Revisa las demoras del servicio.'});
    kitchenNoticeTimer.current=setTimeout(()=>setKitchenNotice(null),6000);
  });

  const liveSyncQueue = useRef(null);
  const [splitSending, setSplitSending] = useState(false);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitMode, setSplitMode] = useState('equal');
  const [splitWays, setSplitWays] = useState(2);
  const [splitGuests, setSplitGuests] = useState([1, 2]);
  const [activeGuest, setActiveGuest] = useState(1);
  const [itemAssignments, setItemAssignments] = useState({});

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSending, setTransferSending] = useState(false);

  const shellWidth = width;
  const isMobile = width < 768;
  const bodyPad = isMobile ? 16 : width >= 1024 ? 32 : 24;

  const getColumns = useCallback((minCardWidth, gap, minColumns = 1) => {
    const availableWidth = shellWidth - (bodyPad * 2);
    return Math.max(minColumns, Math.floor((availableWidth + gap) / (minCardWidth + gap)));
  }, [shellWidth, bodyPad]);

  const productGap = isMobile ? 12 : 20;

  const productColumns = width < 340 ? 1 : getColumns(width < 768 ? 140 : 230, productGap);

  const productCardWidth = Math.max(0, Math.floor((shellWidth - bodyPad * 2 - productGap * (productColumns - 1) - 1) / productColumns));
  const serviceRate = percentRate(businessConfig.servicio_porcentaje, 0);
  const servicePercent = Math.round(serviceRate * 10000) / 100;

  const activeOrders = useMemo(
    () => pedidos.filter((p) => (
      operationalOrder(p)
      && (p.items || []).some((item) => Number(item.cantidad || 0) > 0)
    )),
    [pedidos]
  );

  const alertRevision = JSON.stringify(pedidos.map(order=>[order.id,order.estado,(order.rondas||[]).map(round=>[round.id,round.estado])]));
  useEffect(()=>{serviceAlerts.refresh();},[alertRevision,serviceAlerts.refresh]);

  const activeOrdersByMesa = useMemo(() => {
    const map = new Map();
    activeOrders.forEach((pedido) => {
      const mesaId = getMesaIdFromPedido(pedido);
      if (mesaId) {
        if (!map.has(mesaId)) map.set(mesaId, []);
        map.get(mesaId).push(pedido);
      }
    });
    return map;
  }, [activeOrders]);

  // BUG FIX #5: activeOrderForMesa no necesita recalcular toda la lógica de merge
  // en cada invocación. Al separar el getter del memo de activeOrdersByMesa,
  // evitamos que cada llamada a esta función recree objetos innecesariamente.
  const activeOrderForMesa = useCallback((mesaId) => {
    if (!mesaId) return null;
    const orders = activeOrdersByMesa.get(Number(mesaId));
    if (!orders || orders.length === 0) return null;

    return combineAccounts(orders);
  }, [activeOrdersByMesa]);

  // BUG FIX #6: Estado visual de mesa — la lógica anterior marcaba 'Cuenta' para
  // un pedido con estado 'ENTREGADO', pero 'ENTREGADO' significa que ya se sirvió,
  // NO que se pidió la cuenta. Solo mostramos 'Cuenta' si el campo del servidor
  // lo indica explícitamente. Un pedido 'ENTREGADO' sin estado de mesa 'CUENTA'
  // debe mostrarse como 'Ocupada' para que el mesero pueda seguir atendiendo.
  // También corregimos: si el servidor dice LIBRE pero hay pedidos activos en
  // memoria local (latencia), confiamos en los pedidos locales.
  const mesaEstadoVisual = useCallback((mesa) => {
    const active = activeOrderForMesa(mesa.id);
    const estadoServidor = normalizeEstado(mesa.estado);
    const pedidosActivosServidor = Number(mesa.pedidos_activos || 0);

    // Si hay pedidos activos en memoria local, la mesa está ocupada.
    if (active) {
      return estadoServidor === 'CUENTA' || (active.cuenta_solicitada_at && active.estado_cobro !== 'PAGADO') ? 'Cuenta' : 'Ocupada';
    }

    // Si el servidor trae contador activo, respetamos cuenta/ocupada.
    if (pedidosActivosServidor > 0) {
      return estadoServidor === 'CUENTA' ? 'Cuenta' : 'Ocupada';
    }

    // Sin pedidos activos, una mesa marcada Ocupada/Cuenta es estado stale.
    if (estadoServidor === 'RESERVADA') return 'Reservada';

    return 'Libre';
  }, [activeOrderForMesa]);

  const mesaUbicacion = useCallback((mesa) => {
    const value = mesa.ubicacion_nombre || mesa.ubicacion?.nombre || mesa.ubicacion || mesa.zona;
    return typeof value === 'string' && value.trim() ? value.trim() : 'Sin ubicación';
  }, []);
  const mesaZones = useMemo(() => [...new Set(mesas.map(mesaUbicacion))].sort((a, b) => a.localeCompare(b, 'es')), [mesas, mesaUbicacion]);
  const isExpressOrder = orderMode === 'express';
  const mesaActual = useMemo(() => mesas.find((m) => Number(m.id) === Number(mesaSel)) || null, [mesas, mesaSel]);
  const expressOrders = useMemo(() => activeOrders.filter(isPickupOrder), [activeOrders]);
  const selectedExpressOrder = useMemo(
    () => pedidos.find((pedido) => isPickupOrder(pedido) && Number(pedido.id) === Number(selectedExpressPedidoId)) || null,
    [pedidos, selectedExpressPedidoId]
  );
  const currentExpressDraft = selectedExpressPedidoId ? null : drafts.expressDrafts[selectedExpressDraftKey];
  const expressInfo = selectedExpressPedidoId ? {
    nombre: selectedExpressOrder?.cliente_nombre || '', dato: selectedExpressOrder?.cliente_dato || '',
    telefono: selectedExpressOrder?.delivery_telefono || '', direccion: selectedExpressOrder?.delivery_direccion || '',
    referencia: selectedExpressOrder?.delivery_referencia || '',
  } : currentExpressDraft?.expressInfo || emptyExpressInfo();
  const pickupType = selectedExpressPedidoId ? (selectedExpressOrder?.tipo || drafts.pending[`express-${selectedExpressPedidoId}`]?.tipo || 'Para llevar') : currentExpressDraft?.pickupType || 'Para llevar';
  const setExpressInfo = value => drafts.updateExpress(selectedExpressDraftKey, meta => ({ expressInfo: typeof value === 'function' ? value(meta.expressInfo) : value }));
  const setPickupType = value => drafts.updateExpress(selectedExpressDraftKey, { pickupType: value });
  const pedidoActual = useMemo(
    () => (isExpressOrder ? selectedExpressOrder : activeOrderForMesa(mesaSel)),
    [activeOrderForMesa, isExpressOrder, mesaSel, selectedExpressOrder]
  );

  const catalog = isExpressOrder && !selectedExpressPedidoId && !currentExpressDraft ? { editable: false, reason: 'no-express-draft', label: 'Selecciona o crea un borrador Express' } : catalogContext({ express: isExpressOrder, savedExpressId: selectedExpressPedidoId, table: mesaActual, order: pedidoActual });
  const cartKey = isExpressOrder
    ? (selectedExpressPedidoId ? `express-${selectedExpressPedidoId}` : currentExpressDraft ? selectedExpressDraftKey : null)
    : mesaSel;
  const pendingSend = drafts.pending[cartKey];
  const cart = carritos[cartKey] || [];
  const orderNote = orderNotes[cartKey] || '';
  const showingCart = cart.length > 0;
  const cartCount = cart.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  const cartQtyByProduct = useMemo(() => cart.reduce((acc, item) => {
    acc[item.producto_id] = (acc[item.producto_id] || 0) + Number(item.cantidad || 0);
    return acc;
  }, {}), [cart]);

  const orderItems = showingCart ? cart : pedidoActual?.items || [];
  const subtotal = orderItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const storedTotal = showingCart && pedidoActual?.estado_cobro === 'PAGADO' ? 0 : Number(pedidoActual?.total || 0);
  const service = showingCart ? subtotal * serviceRate : Math.max(0, storedTotal - subtotal);

  // BUG FIX #7: mesaDisplayTotal estaba sumando el pedido anterior + el carrito
  // nuevo de forma acumulativa. El total a mostrar debe ser:
  // - Si hay carrito nuevo: subtotal_carrito + servicio + lo que ya estaba en cocina
  // - Si no hay carrito: el total del pedido del servidor
  const cartSubtotalWithService = showingCart ? subtotal + subtotal * serviceRate : 0;
  const mesaDisplayTotal = showingCart
    ? cartSubtotalWithService + storedTotal          // nuevo + histórico
    : storedTotal || (subtotal + service);           // solo histórico

  const total = showingCart ? subtotal + service : storedTotal || subtotal + service;


  const expandedOrderItems = useMemo(() => {
    const expanded = [];
    orderItems.forEach(item => {
      const qty = Number(item.cantidad || 1);
      const unitPrice = lineTotal({ ...item, cantidad: 1 });
      for (let i = 0; i < qty; i++) {
        expanded.push({ ...item, unitPrice, splitKey: `${item.localId || item.id}-${i}` });
      }
    });
    return expanded;
  }, [orderItems]);

  const guestTotals = useMemo(() => {
    const totals = {};
    splitGuests.forEach(g => totals[g] = 0);
    expandedOrderItems.forEach(item => {
      const guestId = itemAssignments[item.splitKey] || 1;
      totals[guestId] = (totals[guestId] || 0) + item.unitPrice;
    });
    return totals;
  }, [expandedOrderItems, itemAssignments, splitGuests]);

  useEffect(() => {
    setSplitOpen(false);
    setSplitMode('equal');
    setSplitWays(2);
    setSplitGuests([1, 2]);
    setActiveGuest(1);
    setItemAssignments({});
  }, [mesaSel, selectedExpressPedidoId, selectedExpressDraftKey]);

  const categorias = useMemo(() => {
    const values = productos
      .filter((p) => !isPromotionProduct(p))
      .map((p) => p.categoria_nombre || p.categoria || 'General')
      .filter(Boolean);
    return ['Todas', ...Array.from(new Set(values))];
  }, [productos]);

  const tableCounts = useMemo(() => {
    const counts = { Todas: mesas.length, Disponibles: 0, Ocupadas: 0, Cuenta: 0, Reservadas: 0 };
    const keys = { Libre: 'Disponibles', Ocupada: 'Ocupadas', Cuenta: 'Cuenta', Reservada: 'Reservadas' };
    mesas.forEach(mesa => { counts[keys[mesaEstadoVisual(mesa)]] += 1; });
    return counts;
  }, [mesas, mesaEstadoVisual]);

  const mesasFiltradas = useMemo(() => {
    const q = normalizeText(mesaSearch);
    return mesas.filter((mesa) => {
      const visual = mesaEstadoVisual(mesa);
      const byText = !q || normalizeText(`Mesa ${mesa.numero ?? mesa.id} ${mesaUbicacion(mesa)}`).includes(q);
      const byStatus = mesaFilter === 'Todas'
        || (mesaFilter === 'Disponibles' && visual === 'Libre')
        || (mesaFilter === 'Ocupadas' && visual === 'Ocupada')
        || (mesaFilter === 'Cuenta' && visual === 'Cuenta')
        || (mesaFilter === 'Reservadas' && visual === 'Reservada');
      return byText && byStatus && (mesaZone === 'Todas' || mesaUbicacion(mesa) === mesaZone);
    });
  }, [mesas, mesaFilter, mesaSearch, mesaZone, mesaEstadoVisual, mesaUbicacion]);

  const mesasPorUbicacion = useMemo(() => {
    const groups = [];
    const indexByName = new Map();
    mesasFiltradas.forEach((mesa) => {
      const name = mesaUbicacion(mesa);
      if (!indexByName.has(name)) {
        indexByName.set(name, groups.length);
        groups.push({ name, mesas: [] });
      }
      groups[indexByName.get(name)].mesas.push(mesa);
    });
    groups.forEach(group => group.mesas.sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'es', { numeric: true })));
    return groups.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [mesasFiltradas, mesaUbicacion]);

  const promociones = useMemo(
    () => productos.filter((p) => Number(p.disponible ?? 1) === 1 && isPromotionProduct(p)),
    [productos]
  );

  const promoCategorias = useMemo(() => {
    const values = promociones.map((p) => p.categoria_nombre || p.categoria || 'Promociones').filter(Boolean);
    return ['Todas', ...Array.from(new Set(values))];
  }, [promociones]);

  const promocionesFiltradas = useMemo(() => {
    const q = normalizeText(promoBusqueda);
    return promociones.filter((p) => {
      const cat = p.categoria_nombre || p.categoria || 'Promociones';
      const byCategory = promoCategoria === 'Todas' || normalizeText(cat) === normalizeText(promoCategoria);
      const byText = !q || normalizeText(p.nombre).includes(q) || normalizeText(p.descripcion).includes(q);
      return byCategory && byText;
    });
  }, [promociones, promoCategoria, promoBusqueda]);

  const exclusionExtras = useMemo(() => extras.filter((extra) => extra.tipo !== 'EXTRA'), [extras]);
  const paidExtras = useMemo(() => extras.filter((extra) => extra.tipo === 'EXTRA'), [extras]);

  useEffect(() => {
    const queue = createRefreshQueue(async () => {
      setBackgroundSyncing(true);
      try {
      const [tables, orders] = await Promise.all([
        axios.get(`${BASE_URL}/mesas`, { timeout: 15000 }),
        axios.get(`${BASE_URL}/pedidos`, { timeout: 15000 }),
      ]);
      if (!Array.isArray(tables.data) || !Array.isArray(orders.data)) throw new Error('Respuesta inválida');
      return { tables: tables.data, orders: orders.data };
      } finally { setBackgroundSyncing(false); }
    }, ({ tables, orders }) => {
      setMesas(tables); setPedidos(orders); setLoadError(false);
      setLastSyncAt(Date.now());
    }, () => setLoadError(true));
    liveSyncQueue.current = queue;
    return () => { queue.stop(); liveSyncQueue.current = null; };
  }, []);

  const syncBackground = useCallback(() => liveSyncQueue.current?.refresh(), []);
  const scheduleLiveSync = syncBackground;

  // BUG FIX #8: loadData en useCallback para que pueda incluirse en deps de useEffect
  // sin crear un loop infinito.
  const loadData = useCallback(async () => {
    if (loadDataLock.current) return;
    loadDataLock.current = true;
    setLoading(true);
    try {
      const [mesasRes, productosRes, pedidosRes, extrasRes, configRes] = await Promise.all([
        axios.get(`${BASE_URL}/mesas`, { timeout: 15000 }),
        axios.get(`${BASE_URL}/productos`, { timeout: 15000 }),
        axios.get(`${BASE_URL}/pedidos`, { timeout: 15000 }),
        axios.get(`${BASE_URL}/extras`, { timeout: 15000 }),
        axios.get(`${BASE_URL}/configuracion`, { timeout: 15000 }),
      ]);
      if (![mesasRes.data, productosRes.data, pedidosRes.data, extrasRes.data].every(Array.isArray)) {
        throw new Error('El servidor devolvió datos inválidos.');
      }
      setMesas(mesasRes.data);
      setProductos(productosRes.data.filter((p) => Number(p.disponible ?? 1) === 1));
      setPedidos(pedidosRes.data);
      setExtras(extrasRes.data);
      setBusinessConfig(configRes.data || DEFAULT_BUSINESS_CONFIG);
      dataLoaded.current = true;
      setLoadError(false);
      setLastSyncAt(Date.now());
    } catch (error) {
      setLoadError(true);
      setCustomAlert({
        title: 'No se pudieron cargar los datos',
        message: 'Revisa la conexión y usa Actualizar en el menú para reintentar. ' +
          (error.response?.data?.message || error.message),
      });
    } finally {
      loadDataLock.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (realtimeStatus === 'connected' && !dataLoaded.current) loadData();
  }, [realtimeStatus, loadData]);

  const openPedidoFromNotification = useCallback((data = {}) => {
    const mesaId = Number(data.mesa_id || data.mesaId || data.pedido?.mesa_id || 0);
    const pedidoId = Number(data.pedido_id || data.pedido?.id || 0);
    const knownPedido = data.pedido || pedidos.find((pedido) => Number(pedido.id) === pedidoId);
    const isPickup = !!data.is_pickup || (!!knownPedido && isPickupOrder(knownPedido)) || (!mesaId && !!pedidoId);

    if (data.pedido) {
      const orderEvent = { ...data.pedido };
      if (!orderEvent.mesa_id && orderEvent.mesa?.id) orderEvent.mesa_id = orderEvent.mesa.id;
      setPedidos((prev) => upsertById(prev, orderEvent));
    }
    setNotificaciones((prev) => prev.map((item) => (
      (item.key && item.key === data.key) || Number(item.pedido_id) === Number(data.pedido_id || data.pedido?.id)
        ? { ...item, read: true }
        : item
    )));
    if (mesaId) {
      setOrderMode('mesa');
      setSelectedExpressPedidoId(null);
      setMesaSel(mesaId);
      setStep('pedido');
      setNotiOpen(false);
      setKitchenNotice(null);
    } else if (isPickup) {
      setOrderMode('express');
      setSelectedExpressPedidoId(pedidoId || knownPedido?.id || null);

      setMesaSel(EXPRESS_DESTINATION);
      setStep(pedidoId || knownPedido?.id ? 'pedido' : 'express');
      setNotiOpen(false);
      setKitchenNotice(null);
    }
    scheduleLiveSync();
  }, [pedidos, scheduleLiveSync]);

  useEffect(() => {
    configureWaiterNotifications().catch(() => null);
    registerWaiterPushToken(user).catch(() => null);
    const responseSub = addWaiterNotificationResponseListener(openPedidoFromNotification);
    return () => responseSub?.remove?.();
  }, [openPedidoFromNotification, user]);

  const addNotification = useCallback((notification) => {
    const nextNotification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification,
    };

    setNotificaciones((prev) => {
      if (prev.some((item) => item.key === nextNotification.key)) return prev;
      return [nextNotification, ...prev].slice(0, 30);
    });

    setKitchenNotice(nextNotification);
    if (kitchenNoticeTimer.current) clearTimeout(kitchenNoticeTimer.current);
    kitchenNoticeTimer.current = setTimeout(() => {
      setKitchenNotice((current) => (
        current?.key === nextNotification.key ? null : current
      ));
      kitchenNoticeTimer.current = null;
    }, 3200);
  }, []);

  const unreadNotifications = useMemo(
    () => notificaciones.filter((notification) => !notification.read).length,
    [notificaciones]
  );

  useEffect(() => () => {
    if (kitchenNoticeTimer.current) clearTimeout(kitchenNoticeTimer.current);
  }, []);

  useEffect(() => {
    if (!addedNotice) return undefined;
    const timer = setTimeout(() => setAddedNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [addedNotice]);

  useEffect(() => {
    const previous = realtimeStatusRef.current;
    realtimeStatusRef.current = realtimeStatus;
    if (previous === realtimeStatus || realtimeStatus === 'connected' || realtimeStatus === 'connecting') return;

    if (Platform.OS === 'web') {
      playWebAlertTone(ALERT_TONES.SYNC_ERROR);
    }
    addNotification({
      key: `sync-${realtimeStatus}-${Date.now()}`,
      title: 'Error de sincronizacion',
      body: realtimeStatus === 'error'
        ? 'No se pudo conectar con el servidor.'
        : 'El modulo de mesero perdio conexion en tiempo real.',
      action: 'sync_error',
    });
  }, [addNotification, realtimeStatus]);

  useEffect(() => {
    const client = getRealtimeSocket();

    const onConnect = () => {
      setRealtimeStatus('connected');
      scheduleLiveSync();
    };
    const onDisconnect = () => setRealtimeStatus('disconnected');
    const onConnectError = () => setRealtimeStatus('error');

    setRealtimeStatus(client.connected ? 'connected' : 'connecting');
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);

    const applyOrderPayload = (payload = {}) => {
      if (payload.action === 'delete' && payload.pedido_id) {
        setPedidos((prev) => prev.filter((pedido) => Number(pedido.id) !== Number(payload.pedido_id)));
        scheduleLiveSync();
        return;
      }
      if (payload.pedido) {
        const orderEvent = { ...payload.pedido };
        // BUG FIX #9: Siempre normalizar mesa_id en eventos realtime
        if (!orderEvent.mesa_id && orderEvent.mesa?.id) {
          orderEvent.mesa_id = orderEvent.mesa.id;
        }
        setPedidos((prev) => upsertById(prev, orderEvent));
        scheduleLiveSync();
        return;
      }
      scheduleLiveSync();
    };

    const applyTablePayload = (estado) => (payload = {}) => {
      setMesas((prev) => updateMesaFromEvent(prev, payload, estado));
      // Invalidate an in-flight read even when the event contains the full table.
      scheduleLiveSync();
    };

    const unsubs = [
      subscribeRealtime(REALTIME_EVENTS.ORDER_READY, ({ pedido, message, action, ronda_id }) => {
        const mesaId = pedido?.mesa_id || pedido?.mesa?.id || null;
        const isPickup = !mesaId || ['Para llevar', 'Delivery'].includes(pedido?.tipo);
        const targetLabel = isPickup
          ? `${pickupTypeLabel(pedido?.tipo)} #${pedido?.id || '-'} ${pedido?.cliente_nombre || ''}`.trim()
          : `Mesa ${pedido?.mesa_numero || pedido?.mesa?.numero || mesaId || '-'}`;
        const title = action === 'manual_ping'
          ? `Cocina llama: ${targetLabel}`
          : `${targetLabel} lista`;
        const body = message || 'Pedido listo para recoger.';
        const isAssignedToCurrentWaiter = !pedido?.mesero_id || Number(pedido.mesero_id) === Number(user?.id);

        if (isAssignedToCurrentWaiter) {
          const notification = {
            key: `${action || 'ready'}-${pedido?.id || Date.now()}-${ronda_id || ''}`,
            title,
            body,
            pedido_id: pedido?.id,
            pedido,
            mesa_id: mesaId,
            mesa_numero: pedido?.mesa_numero || pedido?.mesa?.numero || mesaId || null,
            is_pickup: isPickup,
            action,
          };

          addNotification(notification);
          notifyWaiterInApp({
            title,
            body,
            data: {
              type: 'ORDER_READY',
              pedido_id: pedido?.id,
              mesa_id: mesaId,
              mesa_numero: pedido?.mesa_numero || pedido?.mesa?.numero || mesaId || null,
              is_pickup: isPickup,
              action,
            },
          }).catch(() => null);
        }

        if (pedido) {
          const p = { ...pedido };
          if (!p.mesa_id && p.mesa?.id) p.mesa_id = p.mesa.id;
          setPedidos((prev) => upsertById(prev, p));
        }
        scheduleLiveSync();
      }),
      subscribeRealtime(REALTIME_EVENTS.ORDER_CREATED, applyOrderPayload),
      subscribeRealtime(REALTIME_EVENTS.ORDER_UPDATED, applyOrderPayload),
      subscribeRealtime(REALTIME_EVENTS.PAYMENT_CREATED, (payload = {}) => {
        if (payload.pedido) {
          const p = { ...payload.pedido };
          if (!p.mesa_id && p.mesa?.id) p.mesa_id = p.mesa.id;
          setPedidos((prev) => upsertById(prev, p));
        }
        scheduleLiveSync();
      }),
      subscribeRealtime(REALTIME_EVENTS.TABLE_OCCUPIED, applyTablePayload('Ocupada')),
      subscribeRealtime(REALTIME_EVENTS.TABLE_FREED, applyTablePayload('Libre')),
      subscribeRealtime(REALTIME_EVENTS.TABLE_UPDATED, applyTablePayload(null)),
    ];

    return () => {
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
      client.off('connect_error', onConnectError);
      unsubs.forEach((fn) => fn?.());
    };
  }, [addNotification, scheduleLiveSync, user?.id]);

  const selectMesa = useCallback((mesa) => {
    setOrderMode('mesa');
    setSelectedExpressPedidoId(null);
    setMesaSel(mesa.id);
    setEditItemId(null);
    setStep(activeOrderForMesa(mesa.id) ? 'pedido' : 'productos');
  }, [activeOrderForMesa]);

  const startExpressOrder = (tipo = 'Para llevar') => {
    if (!drafts.ready || orderSendLock.current) return;
    const key = drafts.createExpress(tipo);
    setExpressView('active');
    setOrderMode('express');
    setSelectedExpressDraftKey(key);
    setSelectedExpressPedidoId(null);
    setMesaSel(EXPRESS_DESTINATION);
    setEditItemId(null);
    setStep('pedido');
  };

  const openExpressOrder = useCallback((pedido) => {
    setOrderMode('express');

    setSelectedExpressPedidoId(pedido.id);
    setMesaSel(EXPRESS_DESTINATION);
    setEditItemId(null);
    setStep('pedido');
  }, []);

  const setCartForMesa = useCallback((updater) => {
    if (!cartKey || drafts.pending[cartKey] || orderSendLock.current) return;
    setCarritos((prev) => ({
      ...prev,
      [cartKey]: typeof updater === 'function' ? updater(prev[cartKey] || []) : updater
    }));
  }, [cartKey, drafts.pending, setCarritos, setOrderNotes]);

  const updateOrderNote = useCallback((value) => {
    if (!cartKey || drafts.pending[cartKey] || orderSendLock.current) return;
    setOrderNotes((prev) => ({ ...prev, [cartKey]: value }));
  }, [cartKey, drafts.pending, setCarritos, setOrderNotes]);

  const handleNoStock = useCallback((producto) => {
    setCustomAlert({ title: 'Agotado', message: `El producto "${producto.nombre}" no tiene unidades disponibles en stock.` });
  }, []);

  const handleAddProduct = useCallback((producto, isPromo = false) => {
    if (pendingSend || orderSendLock.current) return;
    if (!catalog.editable) { setTargetOpen(true); return; }
    const localId = `${isPromo ? 'promo-' : ''}${producto.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const preview = addDraftProduct(cart, producto, isPromo, localId);
    if (preview.error) {
      setCustomAlert({ title: 'Límite de stock', message: `No hay más unidades disponibles de ${producto.nombre}.` });
      return;
    }
    setCartForMesa(current => addDraftProduct(current, producto, isPromo, localId).items);
    setAddedNotice({ id: producto.id, nombre: producto.nombre });
  }, [cart, setCartForMesa, catalog.editable, pendingSend]);

  const handleDecrementProduct = useCallback((producto, isPromo = false) => {
    setCartForMesa((current) => {
      const index = current
        .map((i, idx) => (
          Number(i.producto_id) === Number(producto.id) && Boolean(i.promo) === Boolean(isPromo) ? idx : -1
        ))
        .filter((idx) => idx >= 0)
        .pop();
      if (index === undefined) return current;
      const nextQty = Number(current[index].cantidad || 0) - 1;
      if (nextQty <= 0) return current.filter((_, i) => i !== index);
      return current.map((x, i) => i === index ? { ...x, cantidad: nextQty } : x);
    });
  }, [setCartForMesa]);

  const changeQty = useCallback((item, delta) => {
    const product = productos.find(p => Number(p.id) === Number(item.producto_id));
    const preview = changeDraftQuantity(cart, item, delta, product);
    if (preview.error) {
      setCustomAlert({ title: 'Límite de stock', message: `No hay más unidades disponibles de ${item.nombre}.` });
      return;
    }
    setCartForMesa(current => changeDraftQuantity(current, item, delta, product).items);
  }, [cart, productos, setCartForMesa]);

  const removeItem = useCallback((item) => {
    setCartForMesa((current) => current.filter((i) => (i.localId || i.id) !== (item.localId || item.id)));
  }, [setCartForMesa]);

  const updateItem = useCallback((item, patch) => {
    setCartForMesa((current) =>
      current.map((i) => ((i.localId || i.id) === (item.localId || item.id) ? { ...i, ...patch } : i))
    );
  }, [setCartForMesa]);

  const updateCustomExtra = useCallback((itemId, patch) => {
    setCustomExtras((prev) => ({ ...prev, [itemId]: { nombre: '', precio: '', ...(prev[itemId] || {}), ...patch } }));
  }, []);

  const toggleModifier = useCallback((item, mod) => {
    const normalized = { nombre: mod.nombre, tipo: mod.tipo || 'EXTRA', precio_extra: Number(mod.precio_extra ?? mod.precio ?? 0) };
    const exists = (item.modificadores || []).some((m) => m.nombre === normalized.nombre);
    updateItem(item, {
      modificadores: exists
        ? item.modificadores.filter((m) => m.nombre !== normalized.nombre)
        : [...(item.modificadores || []), normalized],
    });
  }, [updateItem]);

  const addCustomExtra = useCallback((item) => {
    const itemId = item.localId || item.id;
    const draft = customExtras[itemId] || {};
    const nombre = String(draft.nombre || '').trim();
    const precio = Number(String(draft.precio || '').replace(',', '.'));

    if (!nombre) return setCustomAlert({ title: 'Campo requerido', message: 'Escribe el nombre de la especificación o extra.' });
    if (!Number.isFinite(precio) || precio < 0) return setCustomAlert({ title: 'Error', message: 'Por favor asigna un precio válido al extra (0 o mayor).' });

    toggleModifier(item, { nombre, tipo: 'EXTRA', precio_extra: precio });
    setCustomExtras((prev) => ({ ...prev, [itemId]: { nombre: '', precio: '' } }));
  }, [customExtras, toggleModifier]);

  // BUG FIX #11: enviarCocina — el pedido guardado no aparecía porque se llamaba
  // `setStep('pedido')` inmediatamente y `loadData()` era asíncrono. Ahora:
  // 1. Primero actualizamos el estado local con el pedido recibido del backend
  //    (garantizando que mesa_id esté presente).
  // 2. Luego hacemos setStep('pedido') para que la UI ya tenga el pedido disponible.
  // 3. Finalmente sincronizamos en background sin bloquear la UI.
  const enviarCocina = () => runExclusive(orderSendLock, async () => {
    if (!pendingSend && !catalog.editable) { setTargetOpen(true); return; }
    if (!pendingSend && (!cartKey || !cart.length)) {
      return setCustomAlert({ title: 'Cuenta Vacía', message: 'Por favor, agrega productos antes de enviar la comanda.' });
    }
    setOrderSending(true);
    try {
      if (!drafts.ready) throw new Error('Espera a que se recuperen los borradores.');
      if (!pendingSend) {
        const [productResponse, tableResponse, orderResponse, configResponse] = await Promise.all([
          axios.get(`${BASE_URL}/productos`, { timeout: 10000 }),
          isExpressOrder ? Promise.resolve(null) : axios.get(`${BASE_URL}/mesas`, { timeout: 10000 }),
          selectedExpressPedidoId ? axios.get(`${BASE_URL}/pedidos/${selectedExpressPedidoId}`, { timeout: 10000 }) : Promise.resolve(null),
          axios.get(`${BASE_URL}/configuracion`, { timeout: 10000 }),
        ]);
        if (!isExpressOrder && !tableResponse.data.some(m => Number(m.id) === Number(mesaSel) && Number(m.activo ?? 1) === 1)) throw new Error('La mesa ya no esta disponible. El borrador se conserva.');
        if (orderResponse && (!catalogContext({ express: true, savedExpressId: selectedExpressPedidoId, order: orderResponse.data }).editable)) throw new Error('El Express fue cobrado, cancelado o tiene abonos. El borrador se conserva.');
        const checked = validateDraft(cart, productResponse.data);
        setProductos(productResponse.data.filter(p => Number(p.disponible ?? 1) === 1));
        if (checked.error) throw new Error(checked.error);
        const serviceChanged = percentRate(configResponse.data.servicio_porcentaje, 0) !== serviceRate;
        setBusinessConfig(configResponse.data);
        if (checked.changes.length || serviceChanged) {
          setCarritos(prev => ({ ...prev, [cartKey]: checked.items }));
          return setCustomAlert({ title: 'Precios actualizados', message: `${checked.changes.length ? `Cambiaron los precios de: ${checked.changes.join(', ')}. ` : ''}${serviceChanged ? 'Cambió el porcentaje de servicio. ' : ''}Revisa el total y vuelve a enviar.` });
        }
      }
      const expressName = expressInfo.nombre.trim();
      const expressData = expressInfo.dato.trim();
      const deliveryPhone = expressInfo.telefono.trim();
      const deliveryAddress = expressInfo.direccion.trim();
      const deliveryReference = expressInfo.referencia.trim();
      if (!pendingSend && isExpressOrder && !selectedExpressPedidoId && !expressName) {
        return setCustomAlert({ title: 'Dato requerido', message: 'Escribe el nombre del cliente para el pedido express.' });
      }

      const payload = {
        validar_precios: true,
        servicio_esperado: servicePercent,
        pedido_id: isExpressOrder ? selectedExpressPedidoId : null,
        mesa_id: isExpressOrder ? null : mesaSel,
        mesero_id: user?.id,
        notas: orderNote,
        total,
        tipo: isExpressOrder ? pickupType : 'Mesa',
        cliente_nombre: isExpressOrder ? expressName : null,
        cliente_dato: isExpressOrder ? expressData : null,
        delivery_telefono: isExpressOrder && pickupType === 'Delivery' ? deliveryPhone : null,
        delivery_direccion: isExpressOrder && pickupType === 'Delivery' ? deliveryAddress : null,
        delivery_referencia: isExpressOrder && pickupType === 'Delivery' ? deliveryReference : null,
        destino_cocina: true,
        destino_caja: true,
        abrir_cuenta_caja: true,
        items: cart.map(i => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio: i.precio,
          notas: i.notas,
          modificadores: i.modificadores
        })),
      };

      const request = await drafts.prepare(cartKey, payload);
      const { data } = await axios.post(`${BASE_URL}/pedidos`, request, { timeout: 20000 });
      const savedOrder = confirmedOrder(data, request);
      await drafts.complete(cartKey);

      // BUG FIX #11 continuación: normalizar mesa_id siempre
      const finalOrder = { ...savedOrder };
      if (!isExpressOrder && !finalOrder.mesa_id) {
        if (finalOrder.mesa?.id) {
          finalOrder.mesa_id = finalOrder.mesa.id;
        } else {
          finalOrder.mesa_id = mesaSel;
        }
      }

      // Actualizar estado local sincrónicamente antes de cambiar de vista
      setPedidos((prev) => {
        const withoutFallback = prev.filter((p) => p?.id);
        const exists = withoutFallback.some((p) => Number(p.id) === Number(finalOrder.id));
        return exists
          ? withoutFallback.map((p) => (Number(p.id) === Number(finalOrder.id) ? finalOrder : p))
          : [finalOrder, ...withoutFallback];
      });

      // Limpiar carrito y notas
      setAddedNotice(null);
      if (isExpressOrder && !selectedExpressPedidoId) {
        setSelectedExpressDraftKey(null);
        setSelectedExpressPedidoId(null);
        setOrderMode('mesa');
        setMesaSel(null);
      }

      // Ahora sí cambiar de vista — ya hay pedido en el estado local
      setStep(isExpressOrder && !selectedExpressPedidoId ? 'express' : 'pedido');
      setCustomAlert({ title: 'Orden Enviada', message: 'La comanda ha sido enviada a cocina y la cuenta se registró en caja con éxito.' });

      // Sync en background sin bloquear la UI
      scheduleLiveSync();
    } catch (error) {
      if ([400, 404, 409, 422].includes(error.response?.status) && error.response?.data?.code !== 'REQUEST_CONFLICT') await drafts.reject(cartKey).catch(() => {});
      setCustomAlert({
        title: 'No se confirmó el envío',
        message: error.response?.data?.message || error.response?.data?.error || error.message
      });
    } finally {
      setOrderSending(false);
    }
  });

  const deliveryLock = useRef(false);
  const [deliveringRound, setDeliveringRound] = useState(null);
  const marcarEntregado = async (round) => runExclusive(deliveryLock, async () => {
    if (isExpressOrder && round.estado_cobro !== 'PAGADO') { setCustomAlert({ title: 'Primero cobrar', message: 'Registra el pago completo en caja antes de entregar este pedido.' }); return; }
    setDeliveringRound(round.id);
    try {
      const { data } = await axios.put(`${BASE_URL}/pedidos/${round.pedido_id}/rondas/${round.id}`, { estado: 'ENTREGADO' });
      if (data.pedido) setPedidos((prev) => upsertById(prev, data.pedido));
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({ title: 'Error al entregar', message: error.response?.data?.message || error.message });
    } finally { setDeliveringRound(null); }
  });

  const solicitarCobroCaja = async () => {
    if (!pedidoActual) return setCustomAlert({ title: 'Aviso', message: 'Este pedido aun no tiene una cuenta activa.' });
    try {
      const { data } = await axios.post(`${BASE_URL}/pedidos/${pedidoActual.id}/solicitar-cobro`);
      if (data.pedido) {
        setPedidos((prev) => upsertById(prev, data.pedido));
      }
      if (data.pedido?.mesa_id) {
        setMesas((prev) => prev.map((mesa) => (
          Number(mesa.id) === Number(data.pedido.mesa_id) ? { ...mesa, estado: 'Cuenta' } : mesa
        )));
      }
      setCustomAlert({ title: 'Cobro solicitado', message: 'Caja ya ve esta cuenta pendiente. Lleva el pago a caja para cobrar, imprimir y entregar la factura al cliente.' });
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({ title: 'No se pudo solicitar cobro', message: error.response?.data?.message || error.message });
    }
  };

  const enviarDivisionCaja = async () => {
    if (!pedidoActual) return setCustomAlert({ title: 'Aviso', message: 'Esta mesa aun no tiene un pedido activo.' });

    const isEqual = splitMode === 'equal';
    const divisions = isEqual
      ? splitCents(mesaDisplayTotal, Array(splitWays).fill(1)).map((monto, index) => ({ nombre: `Parte ${index + 1}`, monto, items: [] }))
      : splitGuests.map((guest) => {
          const assignedItems = expandedOrderItems.filter(
            (item) => Number(itemAssignments[item.splitKey] || 1) === Number(guest)
          );
          const itemMap = new Map();
          assignedItems.forEach((item) => {
            const detailId = Number(item.id);
            if (!detailId) return;
            itemMap.set(detailId, (itemMap.get(detailId) || 0) + 1);
          });
          const subtotalGuest = assignedItems.reduce((sum, item) => sum + Number(item.unitPrice || 0), 0);
          return {
            nombre: `Comensal ${guest}`,
            monto: Number((subtotalGuest + subtotalGuest * serviceRate).toFixed(2)),
            items: Array.from(itemMap.entries()).map(([detalle_pedido_id, cantidad]) => ({ detalle_pedido_id, cantidad })),
          };
        }).filter((division) => division.monto > 0);

    if (!divisions.length) {
      return setCustomAlert({ title: 'Division vacia', message: 'Asigna al menos un producto antes de enviar la division a caja.' });
    }

    setSplitSending(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/pedidos/${pedidoActual.id}/split/request`, {
        mode: isEqual ? 'equal' : 'items',
        partes: isEqual ? splitWays : divisions.length,
        divisions,
      });
      setSplitOpen(false);
      setCustomAlert({ title: 'Enviado a caja', message: (data.divisions || []).map((part) => `${part.nombre}: ${money(part.monto)}`).join('\n') || 'Caja recibio la division de esta cuenta.' });
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({
        title: 'No se pudo enviar',
        message: error.response?.data?.message || error.response?.data?.error || error.message
      });
    } finally {
      setSplitSending(false);
    }
  };

  const enviarTransferencia = async (targetMesa) => {
    if (!pedidoActual) return;
    setTransferSending(true);
    try {
      await axios.post(`${BASE_URL}/pedidos/${pedidoActual.id}/transferir`, {
        mesa_id: targetMesa.id,
        target_mesa_id: targetMesa.id
      });
      setTransferOpen(false);
      setStep('mesas');
      setCustomAlert({ title: 'Éxito', message: `Cuenta transferida/unida a la Mesa ${targetMesa.numero} exitosamente.` });
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({ title: 'Error', message: error.response?.data?.message || 'No se pudo completar la transferencia.' });
    } finally {
      setTransferSending(false);
    }
  };

  const meseroNombre = user?.nombre || user?.name || 'Mesero';

  // --- MODAL DE TRANSFERIR O UNIR MESA ---
  const renderTransferModal = () => {
    if (!transferOpen) return null;
    return (
      <Modal visible={transferOpen} transparent animationType="slide" onRequestClose={() => setTransferOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: isDark ? 'rgba(9, 14, 23, 0.8)' : 'rgba(15, 23, 42, 0.5)' }}>
          <View style={{ backgroundColor: colors.pageBg, height: '80%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: BOTTOM_INSET, ...modernShadow }}>
            <View style={{ padding: 24, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <ArrowRightLeft size={24} color={colors.brand} />
                </View>
                <View>
                  <Text style={{ fontSize: 22, fontWeight: '600', color: colors.ink }}>Mover Mesa</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 2 }}>Desde Mesa {mesaActual?.numero}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setTransferOpen(false)} style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field }}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 16 }}>Selecciona la mesa destino:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {mesas.filter(m => Number(m.id) !== Number(mesaSel)).map(m => {
                  const vState = mesaEstadoVisual(m);
                  const isFree = vState === 'Libre';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => enviarTransferencia(m)}
                      disabled={transferSending}
                      style={{ width: isMobile ? '100%' : '48%', backgroundColor: colors.surface, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.line, ...softShadow }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.ink }}>Mesa {m.numero}</Text>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isFree ? colors.success : colors.warning }} />
                      </View>
                      <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '500' }}>
                        {isFree ? 'Transferir cuenta' : 'Unir cuentas'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // --- MODAL DE DIVIDIR CUENTA ---
  const renderSplitBillModal = () => {
    if (!splitOpen) return null;

    const isEqual = splitMode === 'equal';
    const equalAmounts = splitCents(mesaDisplayTotal, Array(splitWays).fill(1));

    const addGuest = () => {
      const nextId = splitGuests.length > 0 ? Math.max(...splitGuests) + 1 : 1;
      setSplitGuests([...splitGuests, nextId]);
      setActiveGuest(nextId);
    };

    return (
      <Modal visible={splitOpen} transparent animationType="slide" onRequestClose={() => setSplitOpen(false)}>
        <View style={{
          flex: 1,
          justifyContent: isMobile ? 'flex-end' : 'center',
          alignItems: isMobile ? 'stretch' : 'center',
          backgroundColor: isDark ? 'rgba(9, 14, 23, 0.8)' : 'rgba(15, 23, 42, 0.5)'
        }}>
          <View style={{
            backgroundColor: colors.pageBg,
            height: isMobile ? '90%' : '85%',
            width: isMobile ? '100%' : 600,
            maxHeight: 900,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderBottomLeftRadius: isMobile ? 0 : 32,
            borderBottomRightRadius: isMobile ? 0 : 32,
            paddingBottom: isMobile ? BOTTOM_INSET : 0,
            ...modernShadow,
            overflow: 'hidden'
          }}>
            {isMobile && (
              <View style={{ width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4, backgroundColor: colors.surface }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
              </View>
            )}

            <View style={{ padding: 24, paddingTop: isMobile ? 12 : 24, borderBottomWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <PieChart size={24} color={colors.brand} />
                </View>
                <View>
                  <Text style={{ fontSize: 22, fontWeight: '600', color: colors.ink }}>Dividir Cuenta</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '500', marginTop: 2 }}>
                    Mesa {mesaActual?.numero || '-'} · Total: {money(mesaDisplayTotal)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSplitOpen(false)} style={{ width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field }}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', padding: 16, backgroundColor: colors.surface }}>
              <TouchableOpacity
                onPress={() => setSplitMode('equal')}
                style={{ flex: 1, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isEqual ? colors.softOrange : colors.field, borderWidth: 1, borderColor: isEqual ? colors.brand : 'transparent', marginRight: 8 }}
              >
                <Text style={{ color: isEqual ? colors.brand : colors.muted, fontWeight: '600', fontSize: 14 }}>Partes Iguales</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSplitMode('items')}
                style={{ flex: 1, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: !isEqual ? colors.softOrange : colors.field, borderWidth: 1, borderColor: !isEqual ? colors.brand : 'transparent', marginLeft: 8 }}
              >
                <Text style={{ color: !isEqual ? colors.brand : colors.muted, fontWeight: '600', fontSize: 14 }}>Por Productos</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {isEqual ? (
                <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} showsVerticalScrollIndicator={false}>
                  <Users size={64} color={colors.brand} style={{ marginBottom: 32 }} />
                  <Text style={{ color: colors.muted, fontSize: 18, fontWeight: '500', marginBottom: 24, textAlign: 'center' }}>¿Entre cuántas personas?</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: colors.line, ...softShadow }}>
                    <TouchableOpacity
                      onPress={() => setSplitWays(Math.max(2, splitWays - 1))}
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Minus size={28} color={colors.ink} />
                    </TouchableOpacity>
                    <View style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 36, fontWeight: '600', color: colors.ink }}>{splitWays}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSplitWays(Math.min(50, splitWays + 1))}
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.action || colors.brand, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={28} color={colors.onAccent} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginTop: 40, alignItems: 'center', padding: 24, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.brand, width: '100%', maxWidth: 300 }}>
                    <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '500', marginBottom: 8 }}>Importes por persona</Text>
                    <Text style={{ color: colors.brand, fontSize: 42, fontWeight: '600', textAlign: 'center' }}>{[...new Set(equalAmounts)].map(money).join(' / ')}</Text>
                    <Text style={{ color: colors.muted, marginTop: 8 }}>{equalAmounts.map((amount, i) => `Parte ${i + 1}: ${money(amount)}`).join(' · ')}</Text>
                    {service > 0 ? (
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 8 }}>Incluye el servicio de la cuenta</Text>
                    ) : null}
                  </View>
                </ScrollView>
              ) : (
                <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
                  <View style={{ marginBottom: 16 }}>
                    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                      {splitGuests.map(g => {
                        const isActive = activeGuest === g;
                        const totalGuest = guestTotals[g] || 0;
                        const guestDisplayTotal = splitCents(mesaDisplayTotal, splitGuests.map((g) => expandedOrderItems.filter((item) => Number(itemAssignments[item.splitKey] || 1) === Number(g)).reduce((sum, item) => sum + Math.round(Number(item.unitPrice || 0) * 100), 0)))[splitGuests.indexOf(g)];
                        return (
                          <TouchableOpacity
                            key={g}
                            onPress={() => setActiveGuest(g)}
                            style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, backgroundColor: isActive ? colors.brand : colors.surface, borderWidth: 1, borderColor: isActive ? colors.brand : colors.line, ...softShadow, alignItems: 'center' }}
                          >
                            <Text style={{ color: isActive ? colors.onAccent : colors.ink, fontWeight: '600', fontSize: 14 }}>Comensal {g}</Text>
                            <Text style={{ color: isActive ? 'rgba(255,255,255,0.8)' : colors.muted, fontWeight: '500', fontSize: 12, marginTop: 4 }}>{money(guestDisplayTotal)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        onPress={addGuest}
                        style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.softOrange, borderWidth: 1, borderColor: colors.brand, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                      >
                        <Plus size={18} color={colors.brand} />
                        <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 14, marginLeft: 8 }}>Añadir nueva ronda</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 12, paddingHorizontal: 4 }}>
                    Toca un producto para asignarlo al Comensal {activeGuest}
                  </Text>
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                    <View style={{ gap: 10 }}>
                      {expandedOrderItems.map((item) => {
                        const assignedTo = itemAssignments[item.splitKey] || 1;
                        const isCurrentActive = assignedTo === activeGuest;
                        return (
                          <TouchableOpacity
                            key={item.splitKey}
                            onPress={() => setItemAssignments(prev => ({ ...prev, [item.splitKey]: activeGuest }))}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isCurrentActive ? colors.softOrange : colors.surface, borderRadius: 8, borderWidth: 1, borderColor: isCurrentActive ? colors.brand : colors.line, ...softShadow }}
                          >
                            <View style={{ width: 36, height: 44, borderRadius: 6, backgroundColor: isCurrentActive ? colors.brand : colors.field, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                              <Text style={{ color: isCurrentActive ? colors.onAccent : colors.muted, fontWeight: '600', fontSize: 12 }}>C-{assignedTo}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: isCurrentActive ? colors.ink : colors.muted, fontWeight: '600', fontSize: 15 }}>{item.nombre}</Text>
                              <Text style={{ color: isCurrentActive ? colors.brand : colors.muted, fontWeight: '500', fontSize: 13, marginTop: 2 }}>{money(item.unitPrice)}</Text>
                            </View>
                            {isCurrentActive ? <CheckCircle2 size={20} color={colors.brand} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={{ padding: 24, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
              <TouchableOpacity
                disabled={splitSending}
                onPress={enviarDivisionCaja}
                style={{ height: 56, borderRadius: 8, backgroundColor: splitSending ? colors.muted : colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
              >
                {splitSending ? <ActivityIndicator color={colors.onAccent} /> : <Printer size={20} color={colors.onAccent} />}
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '600', marginLeft: 12 }}>
                  {splitSending ? 'Enviando...' : 'Enviar division a caja'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const navigate = (key) => {
    if (key === 'pedido' && !mesaActual && !isExpressOrder) {
      setTargetOpen(true);
      return;
    }
    setStep(key);
  };

  const renderTopTabs = () => <WaiterNavigation
    colors={colors} width={width} step={step} navigate={navigate}
    menuOpen={menuOpen} setMenuOpen={setMenuOpen} name={meseroNombre}
    dark={isDark} toggleTheme={toggleTheme} unread={unreadNotifications + serviceAlerts.items.length} delayCount={serviceAlerts.items.length}
    notifications={() => setNotiOpen(true)} refresh={loadData} logout={logout}
    draftCount={draftKeys.length} draftAttention={!!drafts.error || Object.keys(drafts.pending).length > 0} openDrafts={() => setDraftListOpen(true)}
    connection={realtimeStatus} expressCount={expressOrders.length} cartCount={cartCount}
    lastSyncAt={lastSyncAt} syncing={loading || backgroundSyncing} syncError={loadError}
    contextLabel={catalog.label} topInset={TOP_INSET} bottomInset={BOTTOM_INSET}
  />;

  const renderSideMenu = () => null;

  const renderTargetPicker = () => (
    <Modal visible={targetOpen} transparent animationType="fade" onRequestClose={() => setTargetOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#0f172a88', padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: 600, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: '500', color: colors.ink }}>Destino del pedido</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Selecciona una mesa o prepara un nuevo Express.</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar selector de destino" onPress={() => setTargetOpen(false)} style={{ padding: 10 }}><X size={20} color={colors.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[['Para llevar', 'Pedido para llevar'], ['Delivery', 'Pedido delivery']].map(([type, label]) => <TouchableOpacity key={type} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setTargetOpen(false); startExpressOrder(type); }} style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: 6, backgroundColor: colors.softOrange, borderWidth: 1, borderColor: colors.brand }}><Text style={{ color: colors.brand, fontSize: 13, fontWeight: '600' }}>{label}</Text></TouchableOpacity>)}
            </View>
            <Text style={{ marginTop: 12, color: colors.muted, fontSize: 11 }}>MESAS DEL SALÓN</Text>
            {mesas.map(mesa => <TouchableOpacity key={mesa.id} accessibilityRole="button" accessibilityLabel={`Usar mesa ${mesa.numero}`} onPress={() => { setTargetOpen(false); selectMesa(mesa); setStep('productos'); }} style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 6 }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '600' }}>Mesa {mesa.numero}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{mesaUbicacion(mesa)}</Text></View><Text style={{ color: statusMeta(mesaEstadoVisual(mesa), isDark).text, fontSize: 12 }}>{statusMeta(mesaEstadoVisual(mesa), isDark).label}</Text>
            </TouchableOpacity>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderCatalogContext = () => (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.brand, backgroundColor: colors.surface, padding: 10, borderRadius: 6, marginBottom: 12, gap: 10 }}>
      {loadError ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reintentar carga del catálogo" onPress={loadData} style={{ paddingVertical: 8 }}><Text style={{ color: colors.danger, fontSize: 12 }}>No se pudo cargar el catálogo. Toca para reintentar.</Text></TouchableOpacity> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: '500' }}>{isExpressOrder && !selectedExpressPedidoId ? `${pickupTypeLabel(pickupType)} · borrador` : catalog.label}</Text>
          {!catalog.editable ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{ catalog.reason === 'closed-express' ? 'Puedes consultar el menú. Selecciona otro destino para un nuevo pedido.' : catalog.reason === 'advance' ? 'Esta cuenta tiene abonos. Gestiona el saldo en caja antes de modificarla.' : 'Consulta el menú y elige un destino cuando quieras pedir.'}</Text> : null}</View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Seleccionar destino" onPress={() => setTargetOpen(true)} style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 6, backgroundColor: colors.softOrange }}><Text style={{ color: colors.brand, fontWeight: '600', fontSize: 12 }}>{catalog.editable ? 'Cambiar' : 'Elegir destino'}</Text></TouchableOpacity>
      </View>
    </View>
  );

  const draftKeys = savedDraftKeys(drafts);
  const draftLabel = key => isExpressDraftKey(key)
    ? `${drafts.expressDrafts[key]?.expressInfo.nombre.trim() || 'Sin nombre'} · ${pickupTypeLabel(drafts.expressDrafts[key]?.pickupType)}`
    : key.startsWith('express-') ? `Express #${key.slice(8)}` : `Mesa ${mesas.find(m => Number(m.id) === Number(key))?.numero || key}`;
  const resumeDraft = key => {
    setEditItemId(null);
    if (isExpressDraftKey(key)) {
      setOrderMode('express'); setMesaSel(EXPRESS_DESTINATION); setSelectedExpressPedidoId(null); setSelectedExpressDraftKey(key);
    } else if (key.startsWith('express-')) {
      setOrderMode('express'); setMesaSel(EXPRESS_DESTINATION); setSelectedExpressPedidoId(Number(key.slice(8)));
    } else {
      setOrderMode('mesa'); setSelectedExpressPedidoId(null); setMesaSel(Number(key));
    }
    setStep('pedido'); setDraftListOpen(false); drafts.dismissRecovery();
  };
  const discardDraft = async key => {
    try {
      await drafts.discardExpress(key);
      if (key === selectedExpressDraftKey) { setSelectedExpressDraftKey(null); setOrderMode('mesa'); setMesaSel(null); setStep('express'); }
    } catch (error) { setCustomAlert({ title: 'No se eliminó el borrador', message: error.message }); }
  };
  const renderDraftStatus = () => (drafts.error || pendingSend) ? (
    <View style={{ paddingHorizontal: bodyPad, paddingVertical: 8, gap: 6, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line }}>
      {drafts.error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{drafts.error} Conserva esta página abierta y vuelve a intentar.</Text> : null}
      {pendingSend ? <TouchableOpacity accessibilityRole="button" disabled={orderSending} onPress={enviarCocina} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: colors.brand, fontWeight: '500', fontSize: 12 }}>{orderSending ? 'Confirmando envío…' : 'Envío sin confirmar · reintentar'}</Text></TouchableOpacity> : null}
    </View>
  ) : null;
  const renderDraftList = () => (
    <Modal visible={draftListOpen} transparent animationType="fade" onRequestClose={() => setDraftListOpen(false)}>
      <View style={{ flex: 1, backgroundColor: '#0f172a88', padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: colors.surface, borderRadius: 10, padding: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, color: colors.ink, fontWeight: '500', fontSize: 18 }}>Tus borradores</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cerrar borradores" onPress={() => setDraftListOpen(false)} style={{ padding: 10 }}><X size={20} color={colors.muted} /></TouchableOpacity></View>
          {drafts.recovered ? <Text style={{ color: colors.success, fontSize: 12 }}>Recuperamos tus borradores guardados.</Text> : null}
          <Text style={{ color: colors.muted, fontSize: 12 }}>Disponibles para tu usuario en este equipo. Los precios y la disponibilidad se revisan antes del envío.</Text>
          <ScrollView contentContainerStyle={{ gap: 8 }}>
            <ExpressDraftList drafts={drafts} colors={colors} onOpen={resumeDraft} onDiscard={discardDraft} />
            {draftKeys.filter(key => !isExpressDraftKey(key)).map(key => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Recuperar ${draftLabel(key)}`} onPress={() => resumeDraft(key)} style={{ padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 6, gap: 5 }}><Text style={{ color: colors.ink, fontWeight: '500' }}>{draftLabel(key)}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{drafts.pending[key] ? 'Envío pendiente de confirmar · reintento protegido' : `${carritos[key]?.length || 0} producto(s) · continuar pedido`}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderShell = (children, scrollable = true) => (
    <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {renderTopTabs()}
      {renderDraftStatus()}
      {scrollable ? (
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: BOTTOM_INSET + (cartCount > 0 && step !== 'pedido' ? 96 : 32) }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {children}
        </View>
      )}
    </View>
  );

  const renderMesas = () => renderShell(<WaiterFloor
    colors={colors} width={width} groups={mesasPorUbicacion} counts={tableCounts} now={serviceNow} alerts={serviceAlerts}
    search={mesaSearch} setSearch={setMesaSearch} filter={mesaFilter} setFilter={setMesaFilter}
    compact={compactTables} setCompact={setCompactTables} selected={mesaSel} selectTable={selectMesa}
    stateFor={mesaEstadoVisual} orderFor={activeOrderForMesa} zones={mesaZones} zone={mesaZone} setZone={setMesaZone}
    refresh={loadData} refreshing={loading} loadError={loadError}
  />);

  const renderExpress = () => renderShell(<WaiterExpress
    colors={colors} width={width} orders={expressOrders} view={expressView} setView={setExpressView} drafts={drafts} openDraft={resumeDraft} discardDraft={discardDraft} now={serviceNow} alerts={serviceAlerts}
    query={expressSearch} setQuery={setExpressSearch} channel={pickupFilter} setChannel={setPickupFilter} stage={expressStageFilter} setStage={setExpressStageFilter}
    startOrder={startExpressOrder} openOrder={openExpressOrder} refresh={loadData} loading={loading} loadError={loadError}
  />);

  const categoryIconFor = (label) => {
    const v = normalizeText(label);
    if (v === 'todas' || v === 'todo') return Grid2X2;
    if (v.includes('cafe')) return Coffee;
    if (v.includes('bebida') || v.includes('jugo')) return CupSoda;
    if (v.includes('desayuno')) return Croissant;
    if (v.includes('postre') || v.includes('pastel')) return CakeSlice;
    if (v.includes('sandwich') || v.includes('comida')) return Sandwich;
    if (v.includes('promo')) return BadgePercent;
    if (v.includes('sopa') || v.includes('entrada')) return Soup;
    return GlassWater;
  };

  const renderCategoryTabs = (values, selected, onSelect) => (
    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
      {values.map(cat => {
        const active = selected === cat;
        const Icon = categoryIconFor(cat);
        return <TouchableOpacity key={cat} accessibilityRole="button" accessibilityLabel={`Categoría ${cat}`} accessibilityState={{ selected: active }} onPress={() => onSelect(cat)} style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', gap: 7, borderRadius: 6, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, alignItems: 'center' }}>
          <Icon size={16} color={active ? colors.brand : colors.muted} /><Text style={{ color: active ? colors.brand : colors.ink, fontSize: 12, fontWeight: '600' }}>{cat === 'Todas' ? 'Todo' : cat}</Text>
        </TouchableOpacity>;
      })}
    </ScrollView>
  );

  const renderProductos = () => renderShell(<WaiterCatalog
    draftState={{saving:drafts.saving,error:drafts.error,pending:!!pendingSend,sending:orderSending}}
    colors={colors} width={width} products={productos} categories={categorias} category={categoria} setCategory={setCategoria}
    search={productoBusqueda} setSearch={setProductoBusqueda} preferences={menuPreferences} setPreferences={setMenuPreferences}
    catalog={{ ...catalog, label: isExpressOrder && !selectedExpressPedidoId ? `${expressInfo.nombre.trim() || 'Sin nombre'} · ${pickupTypeLabel(pickupType)} · borrador` : catalog.label }} locked={!!pendingSend || orderSending}
    counts={cartQtyByProduct} cartCount={cartCount} cartTotal={mesaDisplayTotal} openOrder={() => setStep('pedido')}
    chooseTarget={() => setTargetOpen(true)} onAdd={handleAddProduct} onDecrement={handleDecrementProduct}
    refresh={loadData} loading={loading} loadError={loadError} bottomInset={BOTTOM_INSET}
  />, false);

  const renderPromociones = () => {
    const listHeader = (
      <View style={{ paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <BadgePercent size={24} color={colors.brand} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '500', marginLeft: 16 }}>Promociones</Text>
        </View>

        <View style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24, backgroundColor: colors.surface, ...softShadow }}>
          <Search size={18} color={colors.muted} />
          <TextInput
            value={promoBusqueda}
            onChangeText={setPromoBusqueda}
            placeholder="Buscar promociones..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', marginLeft: 12, paddingVertical: 0 }}
          />
        </View>

        {renderCatalogContext()}
        {renderCategoryTabs(promoCategorias, promoCategoria, setPromoCategoria)}
      </View>
    );

    return renderShell(
      <FlatList
        data={promocionesFiltradas}
        key={productColumns}
        keyExtractor={(item) => item.id.toString()}
        numColumns={productColumns}
        showsVerticalScrollIndicator={false}
        initialNumToRender={isMobile ? 6 : 9}
        maxToRenderPerBatch={isMobile ? 4 : 8}
        updateCellsBatchingPeriod={80}
        windowSize={isMobile ? 5 : 9}
        removeClippedSubviews={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: bodyPad, paddingTop: 24, paddingBottom: BOTTOM_INSET + (cartCount > 0 && step !== 'pedido' ? 96 : 32) }}
        columnWrapperStyle={productColumns > 1 ? { gap: productGap, marginBottom: productGap, justifyContent: 'flex-start' } : undefined}
        ItemSeparatorComponent={productColumns === 1 ? () => <View style={{ height: productGap }} /> : undefined}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          promociones.length === 0 ? (
            <View style={{ width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface, padding: 32, alignItems: 'center', ...softShadow }}>
              <BadgePercent size={48} color={colors.line} />
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 16 }}>Sin promociones activas</Text>
            </View>
          ) : (
            <View style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
              <Search size={44} color={colors.line} />
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 16, marginTop: 16 }}>Sin resultados</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProductCard
            producto={item}
            canAdd={catalog.editable && !pendingSend}
            chooseTarget={() => setTargetOpen(true)}
            qty={cartQtyByProduct[item.id] || 0}
            isPromo={true}
            onPress={(p) => handleAddProduct(p, true)}
            onDecrement={handleDecrementProduct}
            onNoStock={handleNoStock}
            cardWidth={productCardWidth}
            isMobile={isMobile}
            colors={colors}
            showDescription={true}
          />
        )}
      />,
      false
    );
  };

  // BUG FIX #12: renderOrderItem — extraído como función pura (sin closures sobre
  // estado cambiante) y envuelto en useCallback para evitar re-renders innecesarios
  // de toda la lista cuando cambia un solo item.
  const renderOrderItem = useCallback((item, isCartItem = true) => {
    const itemId = item.localId || item.id;
    const isEditing = editItemId === itemId;

    const productoOriginal = productos.find(p => Number(p.id) === Number(item.producto_id));
    const imgUrl = item.imagen_url || productoOriginal?.imagen_url;
    const img = imgUrl ? assetUrl(imgUrl) : null;
    const quantityControls = (<View style={{ width: 116, height: 44, borderRadius: 6, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: isCartItem ? 'space-between' : 'center', paddingHorizontal: 0, marginRight: 8, backgroundColor: colors.surface }}>
                {isCartItem ? (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Reducir cantidad de ${item.nombre}`} disabled={!showingCart} onPress={() => changeQty(item, -1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Minus size={14} color={showingCart ? colors.ink : colors.muted} strokeWidth={3} />
                  </TouchableOpacity>
                ) : null}
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.ink, fontSize: 15, fontWeight: '600', minWidth: 20, textAlign: 'center' }}>
                  {item.cantidad}
                </Text>
                {isCartItem ? (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Aumentar cantidad de ${item.nombre}`} disabled={!showingCart} onPress={() => changeQty(item, 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={14} color={showingCart ? colors.ink : colors.muted} strokeWidth={3} />
                  </TouchableOpacity>
                ) : null}
              </View>);

    return (
      <View key={itemId} style={{ marginBottom: 12 }}>
        <SwipeableRow enabled={isCartItem} onDelete={() => removeItem(item)} colors={colors}>
          <View style={{ width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.surface, padding: isMobile ? 12 : 16, ...softShadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: isMobile ? 42 : 64, height: isMobile ? 42 : 64, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.line, opacity: isCartItem ? 1 : 0.7 }}>
                {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ChefHat size={32} color={colors.muted} />}
              </View>

              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text numberOfLines={2} style={{ color: colors.ink, fontSize: isMobile ? 15 : 17, fontWeight: '600', lineHeight: isMobile ? 18 : 22 }}>
                  {item.nombre}
                </Text>
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  {[item.notas, ...(item.modificadores || []).map(modifierLabel)].filter(Boolean).join(', ') || item.categoria_nombre || 'Sin observaciones'}
                </Text>
              </View>

              {!isMobile ? quantityControls : null}

              <Text numberOfLines={1} adjustsFontSizeToFit style={{ width: isMobile ? 60 : 80, textAlign: 'right', color: colors.brand, fontSize: isMobile ? 14 : 18, fontWeight: '600' }}>
                {money(lineTotal(item))}
              </Text>

              {isCartItem && !isMobile ? (
                <TouchableOpacity onPress={() => removeItem(item)} style={{ width: 36, height: 44, borderRadius: 6, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isMobile ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>{isCartItem ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar ${item.nombre} del borrador`} onPress={() => removeItem(item)} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><Trash2 size={17} color={colors.danger} /></TouchableOpacity> : <View />}{quantityControls}</View> : null}
            {isCartItem ? (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Notas y extras de ${item.nombre}`}
                  accessibilityState={{ expanded: isEditing }}
                  onPress={() => setEditItemId(isEditing ? null : itemId)}
                  style={{ alignSelf: 'flex-start', marginTop: 16, height: 44, borderRadius: 6, paddingHorizontal: 16, backgroundColor: isEditing ? colors.softOrange : colors.field, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
                >
                  <Receipt size={14} color={isEditing ? colors.brand : colors.muted} />
                  <Text style={{ color: isEditing ? colors.brand : colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                    {isEditing ? 'Ocultar notas y extras' : 'Notas y extras adicionales'}
                  </Text>
                </TouchableOpacity>
                {isEditing ? (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Notas adicionales</Text>
                    <TextInput
                      value={item.notas || ''}
                      onChangeText={(text) => updateItem(item, { notas: text })}
                      accessibilityLabel={`Notas para ${item.nombre}`}
                      placeholder="Ej. sin cebolla, poco picante..."
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{ minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: '600' }}
                    />

                    {exclusionExtras.length > 0 ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 10 }}>Exclusiones y opciones</Text> : null}
                    <View style={{ gap: 8 }}>
                      {exclusionExtras.map((extra) => {
                        const active = (item.modificadores || []).some((m) => m.nombre === extra.nombre);
                        const extraPrice = Number(extra.precio_extra ?? extra.precio ?? 0);
                        return (
                          <TouchableOpacity
                            key={`${itemId}-${extra.nombre}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Extra ${extra.nombre}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => toggleModifier(item, extra)}
                            style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, justifyContent: 'center' }}
                          >
                            <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '500' }}>
                              {extra.nombre}{extraPrice ? ` +${money(extraPrice)}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {paidExtras.length > 0 ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 10 }}>Extras adicionales con costo</Text> : null}
                    <View style={{ gap: 8 }}>
                      {paidExtras.map((extra) => {
                        const active = (item.modificadores || []).some((m) => m.nombre === extra.nombre);
                        const extraPrice = Number(extra.precio_extra ?? extra.precio ?? 0);
                        return (
                          <TouchableOpacity
                            key={`${itemId}-${extra.nombre}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Extra ${extra.nombre}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => toggleModifier(item, extra)}
                            style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, justifyContent: 'center' }}
                          >
                            <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '500' }}>
                              {extra.nombre} +{money(extraPrice)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 10 }}>Crear extra personalizado</Text>
                    <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 10 }}>
                      <TextInput
                        value={customExtras[itemId]?.nombre || ''}
                        onChangeText={(text) => updateCustomExtra(itemId, { nombre: text })}
                        accessibilityLabel="Nombre del extra personalizado"
                        placeholder="Escribir otro extra..."
                        placeholderTextColor={colors.muted}
                        style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 16, fontSize: 13, fontWeight: '600' }}
                      />
                      <TextInput
                        value={customExtras[itemId]?.precio || ''}
                        onChangeText={(text) => updateCustomExtra(itemId, { precio: text })}
                        accessibilityLabel="Precio del extra personalizado"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={{ width: isMobile ? '100%' : 80, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 12, textAlign: 'center', fontSize: 13, fontWeight: '600' }}
                      />
                      <TouchableOpacity onPress={() => addCustomExtra(item)} style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.action || colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={20} color={colors.onAccent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </SwipeableRow>
      </View>
    );
  }, [editItemId, productos, colors, isMobile, showingCart, exclusionExtras, paidExtras, customExtras, changeQty, removeItem, updateItem, toggleModifier, addCustomExtra, updateCustomExtra]);

  const renderTotals = () => {
    const rounds = accountRounds(pedidoActual).filter((round) => round.estado !== 'CANCELADO');
    const paid = pedidoActual?.estado_cobro === 'PAGADO';

    return (
      <View style={{ backgroundColor: colors.surface, padding: isMobile ? 18 : 22, borderRadius: 10, borderWidth: 1, borderColor: colors.line, ...softShadow, marginTop: 0 }}>
        <Text style={{ color: colors.ink, fontWeight: '500', fontSize: 18, marginBottom: 18 }}>Resumen y acciones</Text>
        {showingCart && pedidoActual ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '500' }}>Cuenta anterior (en cocina)</Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{money(storedTotal)}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '500' }}>
            {showingCart ? 'Subtotal nuevos' : 'Subtotal'}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{money(subtotal)}</Text>
        </View>
        {service > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line }}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '500' }}>{showingCart ? `Servicio (${servicePercent}%)` : 'Servicio incluido'}</Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{money(service)}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line }} />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: colors.field, borderRadius: 8, padding: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600' }}>{isExpressOrder ? 'Total express' : 'Total mesa'}</Text>
          <Text style={{ color: colors.brand, fontSize: 28, fontWeight: '600' }}>{money(mesaDisplayTotal)}</Text>
        </View>

        {showingCart ? (
          <TouchableOpacity onPress={enviarCocina} disabled={orderSending} style={{ height: 56, borderRadius: 10, backgroundColor: colors.action || colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <ChefHat size={24} color={colors.onAccent} />
            <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '600', marginLeft: 12 }}>{orderSending ? 'Confirmando…' : pendingSend ? 'Reintentar envío pendiente' : 'Enviar a Cocina y Caja'}</Text>
          </TouchableOpacity>
        ) : pedidoActual ? (
          <View style={{ gap: 12 }}>
            {paid ? <Text style={{ color: colors.success, fontWeight: '500' }}>{pedidoActual.pendiente_entrega ? 'Pago completo · falta la entrega' : 'Pedido completado · guardado en el historial'}</Text> : null}
            {rounds.map((round) => (
              <View key={round.id} style={{ padding: 12, borderRadius: 8, backgroundColor: colors.field, gap: 8 }}>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>Ronda #{round.id} · {round.estado}{round.estado_cobro === 'PAGADO' ? ' · Pagada' : ''}</Text>
                <Text style={{ color: colors.muted }}>{(round.items || []).map((item) => `${item.cantidad} × ${item.nombre}`).join(', ')}</Text>
                {round.estado === 'LISTO' && isExpressOrder && round.estado_cobro !== 'PAGADO' ? <Text style={{ color: colors.warning, fontSize: 12, lineHeight: 19 }}>Listo en cocina. Entrega bloqueada hasta completar el cobro.</Text> : null}
                {round.estado === 'LISTO' && (!isExpressOrder || round.estado_cobro === 'PAGADO') ? (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Entregar ronda ${round.id}`} disabled={deliveringRound !== null} onPress={() => marcarEntregado(round)} style={{ height: 46, borderRadius: 8, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.onAccent, fontWeight: '600' }}>{deliveringRound === round.id ? 'Entregando…' : 'Entregar esta ronda'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {catalog.editable ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Añadir nueva ronda" onPress={() => setStep('productos')} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 8, backgroundColor: colors.softOrange, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                  <Plus size={16} color={colors.brand} />
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.brand, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Añadir nueva ronda</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity disabled={paid} onPress={() => setSplitOpen(true)} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                <PieChart size={16} color={colors.ink} />
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Dividir</Text>
              </TouchableOpacity>

              {!isExpressOrder ? (
                <TouchableOpacity onPress={() => setTransferOpen(true)} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                  <ArrowRightLeft size={16} color={colors.ink} />
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Mover</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Solicitar cobro en caja" disabled={paid} onPress={solicitarCobroCaja} style={{ width: '100%', height: 48, borderRadius: 8, backgroundColor: paid ? colors.field : colors.action || colors.brand, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                <Printer size={16} color={paid ? colors.muted : colors.onAccent} />
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: paid ? colors.muted : colors.onAccent, fontSize: 13, fontWeight: '600', marginLeft: 6 }}>{paid ? 'Pago completado' : 'Solicitar cobro en caja'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderPedido = () => {
    const activeOrderMesa = mesaActual || { numero: pedidoActual?.mesa_numero || '-' };

    const cartItems = cart;
    const historicalItems = pedidoActual?.items || [];
    const totalItemsCount = [...cartItems, ...historicalItems].reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const currentPickupType = pedidoActual?.tipo === 'Delivery' ? 'Delivery' : pickupType;
    const pickupDraftDetail = currentPickupType === 'Delivery'
      ? [expressInfo.telefono.trim(), expressInfo.direccion.trim(), expressInfo.referencia.trim(), expressInfo.dato.trim()].filter(Boolean).join(' - ')
      : expressInfo.dato.trim();
    const orderTitle = isExpressOrder
      ? (pedidoActual ? pickupOrderLabel(pedidoActual) : expressInfo.nombre.trim() || `Pedido ${pickupTypeLabel(currentPickupType)}`)
      : `Mesa ${activeOrderMesa.numero || '-'}`;
    const orderSubtitle = isExpressOrder
      ? `${pedidoActual ? (pickupDetailLabel(pedidoActual) || pickupTypeLabel(currentPickupType)) : (pickupDraftDetail || 'Cliente pendiente')} · ${totalItemsCount} ${totalItemsCount === 1 ? 'artículo' : 'artículos'}`
      : `${mesaActual?.capacidad ? `${mesaActual.capacidad} plazas · ` : ''}${totalItemsCount} ${totalItemsCount === 1 ? 'artículo' : 'artículos'}`;

    return renderShell(
      <View style={{ padding: bodyPad, paddingTop: 24, maxWidth: 1180, alignSelf: 'center', width: '100%' }}>
        <View style={{ marginBottom: 18 }}><Text style={{ color: colors.ink, fontSize: 27, fontWeight: '500' }}>Pedido</Text><Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Productos, preparación, pago y entrega en una sola vista.</Text></View>
        {isExpressOrder && currentExpressDraft ? <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Añadir productos al borrador" onPress={() => setStep('productos')} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: colors.brand, borderRadius: 6, backgroundColor: colors.softOrange }}><Text style={{ color: colors.brand, fontSize: 13 }}>Añadir productos</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cambiar borrador Express" onPress={() => setDraftListOpen(true)} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ color: colors.muted, fontSize: 13 }}>Cambiar borrador</Text></TouchableOpacity>
        </View> : null}
        <OrderOverview order={pedidoActual} title={orderTitle} subtitle={orderSubtitle} express={isExpressOrder} draft={showingCart} draftCount={cartCount} total={mesaDisplayTotal} colors={colors} deliveryState={draftDeliveryStatus({hasDraft:(isExpressOrder&&!!currentExpressDraft)||showingCart||!!orderNote,pending:!!pendingSend,sending:orderSending,saving:drafts.saving,error:drafts.error,order:pedidoActual})} />

        {totalItemsCount === 0 && !(isExpressOrder && currentExpressDraft && !selectedExpressPedidoId) ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Receipt size={64} color={colors.line} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '600', marginTop: 20 }}>Cuenta vacía</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 8 }}>No hay productos añadidos a esta mesa.</Text>
            <TouchableOpacity
              onPress={() => setStep('productos')}
              style={{ marginTop: 24, height: 44, borderRadius: 8, paddingHorizontal: 24, backgroundColor: colors.action || colors.brand, alignItems: 'center', justifyContent: 'center', ...softShadow }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '600' }}>Explorar menú</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: width >= 1000 ? 'row' : 'column', alignItems: 'flex-start', gap: 22 }}>
          <View style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <OrderServicePanel key={pedidoActual?.id||'draft'} order={pedidoActual} now={serviceNow} colors={colors} alerts={serviceAlerts}/>
            {isExpressOrder && currentExpressDraft && !selectedExpressPedidoId ? (
              <View pointerEvents={pendingSend ? 'none' : 'auto'} style={{ marginBottom: 24, borderRadius: 8, padding: 14, opacity: pendingSend ? 0.65 : 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...softShadow }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600', marginBottom: 10 }}>Datos del cliente</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {['Para llevar', 'Delivery'].map((tipo) => {
                    const active = pickupType === tipo;
                    return (
                      <TouchableOpacity
                        key={tipo}
                        accessibilityRole="button"
                        accessibilityLabel={`Tipo de borrador: ${pickupTypeLabel(tipo)}`}
                        accessibilityState={{ selected: active, disabled: !!pendingSend }}
                        disabled={!!pendingSend}
                        onPress={() => setPickupType(tipo)}
                        style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.softOrange : colors.field, borderWidth: 1, borderColor: active ? colors.brand : colors.line }}
                      >
                        <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 13, fontWeight: '600' }}>{pickupTypeLabel(tipo)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  value={expressInfo.nombre}
                  onChangeText={(nombre) => setExpressInfo((prev) => ({ ...prev, nombre }))}
                  editable={!pendingSend}
                  accessibilityLabel="Nombre del cliente"
                  placeholder="Nombre del cliente (obligatorio)"
                  placeholderTextColor={colors.muted}
                  maxLength={120}
                  style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '500', paddingHorizontal: 14, marginBottom: 10 }}
                />
                <TextInput
                  value={expressInfo.dato}
                  onChangeText={(dato) => setExpressInfo((prev) => ({ ...prev, dato }))}
                  editable={!pendingSend}
                  accessibilityLabel="Referencia del cliente"
                  placeholder={pickupType === 'Delivery' ? 'Dato de plataforma o referencia (opcional)' : 'Telefono, referencia, placa u otro dato (opcional)'}
                  placeholderTextColor={colors.muted}
                  maxLength={160}
                  style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '500', paddingHorizontal: 14, marginBottom: pickupType === 'Delivery' ? 10 : 0 }}
                />
                {pickupType === 'Delivery' ? (
                  <>
                    <TextInput
                      value={expressInfo.telefono}
                      onChangeText={(telefono) => setExpressInfo((prev) => ({ ...prev, telefono }))}
                      editable={!pendingSend}
                      accessibilityLabel="Teléfono de delivery"
                      placeholder="Telefono directo (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={40}
                      style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '500', paddingHorizontal: 14, marginBottom: 10 }}
                    />
                    <TextInput
                      value={expressInfo.direccion}
                      onChangeText={(direccion) => setExpressInfo((prev) => ({ ...prev, direccion }))}
                      editable={!pendingSend}
                      accessibilityLabel="Dirección de delivery"
                      placeholder="Direccion si contacta directo al local (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={220}
                      style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '500', paddingHorizontal: 14, marginBottom: 10 }}
                    />
                    <TextInput
                      value={expressInfo.referencia}
                      onChangeText={(referencia) => setExpressInfo((prev) => ({ ...prev, referencia }))}
                      editable={!pendingSend}
                      accessibilityLabel="Referencia de delivery"
                      placeholder="Referencia de entrega, app o repartidor (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={220}
                      style={{ height: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '500', paddingHorizontal: 14 }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            {cartItems.length > 0 ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.action || colors.brand, marginRight: 8 }} />
                  <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '500', flexShrink: 1 }}>Nueva ronda · por enviar</Text>

                </View>
                <View pointerEvents={pendingSend ? 'none' : 'auto'} style={{ gap: 0, opacity: pendingSend ? 0.65 : 1 }}>
                  {cartItems.map(item => renderOrderItem(item, true))}
                </View>
              </View>
            ) : null}

            {historicalItems.length > 0 ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 8 }} />
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>Productos registrados</Text>
                </View>
                <View>
                  {historicalItems.map(item => renderOrderItem(item, false))}
                </View>
              </View>
            ) : null}

            <View style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Receipt size={16} color={colors.ink} />
                <Text style={{ marginLeft: 8, color: colors.ink, fontSize: 14, fontWeight: '600' }}>Notas generales de la cuenta</Text>
              </View>
              {showingCart || (isExpressOrder && currentExpressDraft) ? (
                <TextInput
                  editable={!pendingSend}
                  value={orderNote}
                  onChangeText={updateOrderNote}
                  accessibilityLabel="Notas generales de la cuenta"
                  placeholder="Ej. Entregar todo junto, mesa necesita periquera..."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={120}
                  style={{ minHeight: 60, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 8, color: colors.ink, fontSize: 13, fontWeight: '600', padding: 16, ...softShadow }}
                />
              ) : (
                <View style={{ minHeight: 60, backgroundColor: colors.field, borderRadius: 8, padding: 16 }}>
                  <Text style={{ color: pedidoActual?.notas ? colors.ink : colors.muted, fontSize: 13, fontWeight: '600' }}>
                    {pedidoActual?.notas || 'Sin notas registradas para esta cuenta.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ width: width >= 1000 ? 350 : '100%' }}>{renderTotals()}</View>
          </View>
        )}
      </View>
    );
  };

  const renderCustomAlertModal = () => {
    if (!customAlert) return null;

    return (
    <Modal visible transparent animationType="none" onRequestClose={() => setCustomAlert(null)}>
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(9, 14, 23, 0.75)' : 'rgba(15, 23, 42, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: colors.surface, borderRadius: 8, padding: 24, borderWidth: 1, borderColor: colors.line, ...modernShadow }}>
          <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Info size={24} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '600', color: colors.ink, marginBottom: 8 }}>{customAlert?.title}</Text>
          <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '600', lineHeight: 22, marginBottom: 24 }}>{customAlert?.message}</Text>
          <TouchableOpacity onPress={() => setCustomAlert(null)} style={{ width: '100%', height: 48, borderRadius: 8, backgroundColor: colors.action || colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '600' }}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    );
  };

  const renderNotifications = () => <WaiterNotifications colors={colors} alerts={serviceAlerts} activity={notificaciones} close={()=>setNotiOpen(false)} openOrder={openPedidoFromNotification} clearActivity={()=>setNotificaciones([])}/>;

  if ((loading && !dataLoaded.current) || !drafts.ready) {
    return (
      <View onLayout={measureViewport} style={{ flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg }}>
        {!drafts.error ? <ActivityIndicator color={colors.brand} size="large" /> : null}
        <Text style={{ marginTop: 24, fontWeight: '600', fontSize: 16, color: colors.muted }}>{drafts.error || 'Recuperando datos y borradores...'}</Text>
        {drafts.error ? <TouchableOpacity accessibilityRole="button" onPress={drafts.retryLoad} style={{ padding: 18 }}><Text style={{ color: colors.brand }}>Reintentar recuperación</Text></TouchableOpacity> : null}
      </View>
    );
  }

  return (
    <View onLayout={measureViewport} pointerEvents={orderSending ? 'none' : 'auto'} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', backgroundColor: colors.pageBg, fontFamily: WAITER_FONT }}>
      {renderTargetPicker()}
      {renderDraftList()}
      {step === 'mesas' ? renderMesas() : null}
      {step === 'express' ? renderExpress() : null}
      {step === 'productos' ? renderProductos() : null}
      {step === 'promociones' ? renderPromociones() : null}
      {step === 'pedido' ? renderPedido() : null}

      {kitchenNotice ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${kitchenNotice.title}. ${kitchenNotice.action==='delay_summary'?'Ver demoras':'Abrir aviso'}`}
          activeOpacity={0.92}
          onPress={() => {
            if (kitchenNotice.action === 'delay_summary') {setKitchenNotice(null);setNotiOpen(true);return;}
            if (kitchenNotice.action === 'sync_error') {
              setKitchenNotice(null);
              scheduleLiveSync();
              return;
            }
            openPedidoFromNotification(kitchenNotice);
          }}
          style={{
            position: 'absolute',
            left: isMobile ? bodyPad : undefined,
            right: bodyPad,
            bottom: BOTTOM_INSET + (addedNotice && cartCount > 0 && step !== 'pedido' ? 86 : 18),
            zIndex: 10000,
            elevation: 20,
            width: isMobile ? undefined : 340,
            maxWidth: isMobile ? undefined : 340,
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: ['sync_error','delay_summary'].includes(kitchenNotice.action) ? colors.warning : colors.success,
            paddingHorizontal: 9,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            ...modernShadow,
          }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: ['sync_error','delay_summary'].includes(kitchenNotice.action) ? colors.warningSoft : colors.successSoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Bell size={15} color={['sync_error','delay_summary'].includes(kitchenNotice.action) ? colors.warning : colors.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityLiveRegion="polite" numberOfLines={1} style={{ color: colors.ink, fontSize: 12 }}>{kitchenNotice.title}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
              {kitchenNotice.action === 'sync_error'
                ? 'Tocar para reintentar'
                : kitchenNotice.action === 'delay_summary' ? 'Ver demoras · aviso sin sonido' : unreadNotifications > 1 ? `${unreadNotifications} alertas pendientes` : 'Tocar para abrir'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(event) => {
              event?.stopPropagation?.();
              setKitchenNotice(null);
            }}
            accessibilityRole="button" accessibilityLabel="Descartar aviso" style={{ width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field, marginLeft: 6 }}
          >
            <X size={14} color={colors.muted} />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      {(addedNotice && cartCount > 0 && step === 'promociones') ? (
        <View style={{
          position: 'absolute',
          left: isMobile ? bodyPad : undefined,
          right: bodyPad,
          bottom: BOTTOM_INSET + 18,
          width: isMobile ? undefined : 390,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          paddingHorizontal: 10,
          paddingVertical: 9,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.line,
          ...modernShadow,
          zIndex: 9999,
        }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
            <CheckCircle2 size={19} color={colors.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: '600' }}>{addedNotice.nombre} añadido</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
              {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'} · {money(mesaDisplayTotal)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setStep('pedido')}
            style={{ height: 34, borderRadius: 10, backgroundColor: colors.action || colors.brand, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginLeft: 8 }}
          >
            <Receipt size={15} color={colors.onAccent} />
            {!isMobile ? <Text style={{ color: colors.onAccent, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Ver</Text> : null}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={orderSending} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ padding: 24, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={{ marginTop: 12, color: colors.ink }}>Enviando pedido…</Text>
          </View>
        </View>
      </Modal>
      {customAlert ? renderCustomAlertModal() : null}
      {transferOpen ? renderTransferModal() : null}
      {splitOpen ? renderSplitBillModal() : null}
      {notiOpen ? renderNotifications() : null}
      {menuOpen ? renderSideMenu() : null}
    </View>
  );
}
