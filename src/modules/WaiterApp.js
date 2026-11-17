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
  ArrowRightLeft,
  StickyNote
} from 'lucide-react-native';
import axios from 'axios';
import { useFonts } from 'expo-font';
import { runExclusive } from '../utils/waiterLogic.mjs';
import { useAuth, BASE_URL, assetUrl } from '../context/AuthContext';
import { useTheme, operationalColors as UI_COLORS, tableStatusMeta, WaiterAppearance } from '../theme';
import { ComandaToastProvider, FONT as COMANDA_FONT, useComandaFonts, useComandaToast, useToastLift } from '../components/waiter/comanda';
import Logo from '../components/Logo';
import WaiterFloor from '../components/WaiterFloor';
import { TableActionsSheet, TransferSheet, readyItems, readyRounds, salonHaptic, useTodayReservations } from '../components/waiter/salon'; // Salón:
import { addDraftProduct, changeDraftQuantity, addCustomizedProduct, addLines } from '../utils/waiterCart.mjs';
import { topProducts, lastRoundItems, extrasForProduct } from '../utils/waiterFavorites.mjs'; // Menú:
import CustomizeSheet from '../components/waiter/CustomizeSheet'; // Menú:
import { TargetPickerSheet, MenuSearch, CategoryChips } from '../components/waiter/menu'; // Menú:
import { createRefreshQueue } from '../utils/kitchenLogic.mjs';
import ProductCard from '../components/WaiterProductCard';
import WaiterNavigation, { WaiterBottomBar, WaiterMoreSheet } from '../components/WaiterNavigation';
import useWaiterDrafts from '../services/useWaiterDrafts';
import { validateDraft, emptyExpressInfo, isExpressDraftKey, savedDraftKeys } from '../utils/orderDrafts.mjs';
// Comanda: hoja de pedido y cola sin conexión.
import { ComandaHeader, LineCustomizer, NoticeSheet, OfflineQueue, OrderLine, PastRound, PriceChangesSheet, SectionLabel, SendBar, TearAway, TotalsBlock } from '../components/waiter/order';
import { classifyError, nextDelay, priceDiffs, queueSummary, reusableExpressDraft } from '../utils/sendQueue.mjs';
import { BottomSheet as CBottomSheet, Button as CButton, Chip as CChip, LeaderLine as CLeaderLine, Tally as CTally, Field as CField, Label as CLabel, Num as CNum, Perforation as CPerforation, StampBurst as CStampBurst, T as CT, money as cMoney } from '../components/waiter/comanda';
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
const WAITER_FONT = COMANDA_FONT;

const Text = ({ style, ...props }) => (
  <RNText {...props} style={[WAITER_FONT ? { fontFamily: WAITER_FONT } : null, style]} />
);

// --- UTILIDADES ---
function money(n) { return cMoney(n); } // un solo formato de precio: $1,80

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

// La app del mesero usa su propia identidad («Comanda»), independiente del panel de administración.
export default function WaiterApp() {
  return <WaiterAppearance><ComandaToastProvider bottomOffset={BOTTOM_INSET + 72}><App /></ComandaToastProvider></WaiterAppearance>;
}

function App() {
  useComandaFonts();
  const toast = useComandaToast();
  const setToastLift = useToastLift();
  const { user, logout } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(null);
  const measureViewport = useCallback(event => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => previous === next ? previous : next);
  }, []);
  const width = Math.min(windowWidth, measuredWidth ?? windowWidth);
  const { isDark, toggle: toggleTheme } = useTheme();
  const { c: palette } = useTheme();
  // Colores de la app en la paleta Comanda (papel, tinta, achiote).
  const colors = useMemo(() => ({
    pageBg: palette.bg, secondary: palette.surface, elevated: palette.surfaceAlt, surface: palette.surface, field: palette.soft, line: palette.line,
    ink: palette.text, muted: palette.muted, faint: palette.faint, brand: palette.primary, brandHover: palette.primaryHover, softOrange: palette.primarySoft,
    action: palette.primary, onAccent: palette.onPrimary, promotion: palette.purple, promotionSoft: palette.purpleSoft,
    danger: palette.red, success: palette.green, successSoft: palette.greenSoft, warning: palette.amber, warningSoft: palette.amberSoft,
    info: palette.sky, infoSoft: palette.skySoft, isDark: palette.isDark,
    surfaceAlt: palette.surfaceAlt, primary: palette.primary, onPrimary: palette.onPrimary, primarySoft: palette.primarySoft, text: palette.text,
  }), [palette]);

  const [step, setStep] = useState('mesas');
  const [noteOpen, setNoteOpen] = useState(false); // nota general plegada hasta que se necesite
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
  // Comanda: animación de envío, cambios de precio y cola sin conexión.
  const [tearing, setTearing] = useState(false);
  const [sentBurst, setSentBurst] = useState(false);
  const [priceReview, setPriceReview] = useState(null); // { diffs, message, items, config }
  const [priceAccepting, setPriceAccepting] = useState(false);
  const [resendTick, setResendTick] = useState(0);
  const [queueAttempt, setQueueAttempt] = useState(0);
  const [queueWakeAt, setQueueWakeAt] = useState(0);
  const [queueRetrying, setQueueRetrying] = useState(false);
  const queueLock = useRef(false);
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
  useEffect(() => { setNoteOpen(false); }, [cartKey]); // la nota plegada se reinicia al cambiar de mesa/pedido
  const pendingSend = drafts.pending[cartKey];
  const cart = carritos[cartKey] || [];
  const orderNote = orderNotes[cartKey] || '';
  const showingCart = cart.length > 0;
  const cartCount = cart.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
  // Los avisos suben por encima de la barra «Enviar ronda» cuando está visible.
  useEffect(() => { setToastLift(step === 'pedido' && cartCount > 0 ? 76 : 0); }, [step, cartCount]);
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
      // Cocina marcó platos sueltos como listos: avisar al mesero de esa cuenta qué puede llevar ya.
      if (payload.action === 'platos_listos' && !payload.ronda_lista && payload.pedido && Array.isArray(payload.nombres) && payload.nombres.length) {
        const pd = payload.pedido;
        const mine = !pd.mesero_id || Number(pd.mesero_id) === Number(user?.id);
        if (mine) {
          const mesaId = pd.mesa_id || pd.mesa?.id || null;
          const target = mesaId ? `Mesa ${pd.mesa_numero || pd.mesa?.numero || mesaId}` : `${pickupTypeLabel(pd.tipo)} #${pd.id}`;
          const title = `${target}: ${payload.nombres.length === 1 ? 'plato listo' : 'platos listos'}`;
          const body = `${payload.nombres.join(', ')} para llevar ya.`;
          addNotification({ key: `items-${pd.id}-${payload.ronda_id}-${(payload.platos || []).join('.')}`, title, body, pedido_id: pd.id, pedido: pd, mesa_id: mesaId, mesa_numero: pd.mesa_numero || null, is_pickup: !mesaId, action: 'items_ready' });
          notifyWaiterInApp({ title, body, data: { type: 'ITEMS_READY', pedido_id: pd.id, mesa_id: mesaId, action: 'items_ready' } }).catch(() => null);
        }
      }
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
      // Cocina marcó un producto como agotado (o disponible otra vez): el menú se actualiza al instante.
      subscribeRealtime(REALTIME_EVENTS.CATALOG_UPDATED, (payload = {}) => {
        if (!payload.producto_id) return;
        setProductos((prev) => prev.map((p) => Number(p.id) === Number(payload.producto_id) ? { ...p, agotado: payload.agotado ? 1 : 0 } : p));
        toast.show(payload.agotado ? `${payload.nombre || 'Un producto'} se agotó` : `${payload.nombre || 'Un producto'} está disponible otra vez`,
          { tone: payload.agotado ? 'warning' : 'success', detail: payload.agotado ? 'Avisó cocina. Ya aparece como «Agotado» en el menú.' : null });
      }),
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
    // Comanda: reutiliza un borrador Express vacío en vez de crear uno nuevo cada vez.
    const reusable = reusableExpressDraft(drafts);
    const key = reusable || drafts.createExpress(tipo);
    if (reusable && drafts.expressDrafts[reusable]?.pickupType !== tipo) drafts.updateExpress(reusable, { pickupType: tipo === 'Delivery' ? 'Delivery' : 'Para llevar' });
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

  // Menú: avisos de stock como toast (no modal) y «añadido» con acción «Ver comanda», limitado a uno cada 2,5 s.
  const lastAddToast = useRef(0);
  const announceAdded = useCallback((text, detail, force = false) => {
    const now = Date.now();
    if (!force && now - lastAddToast.current < 2500) return;
    lastAddToast.current = now;
    toast.show(text, { detail, tone: 'success', duration: 2600, haptic: false, action: { label: 'Ver comanda', onPress: () => setStep('pedido') } });
  }, [toast]);
  const handleNoStock = useCallback((producto) => {
    toast.show(`${producto.nombre} está agotado`, { tone: 'error', detail: 'No quedan unidades en stock.' });
  }, [toast]);

  const handleAddProduct = useCallback((producto, isPromo = false) => {
    if (pendingSend || orderSendLock.current) return;
    if (!catalog.editable) { setTargetOpen(true); return; }
    const localId = `${isPromo ? 'promo-' : ''}${producto.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const preview = addDraftProduct(cart, producto, isPromo, localId);
    if (preview.error) {
      toast.show(`No quedan más ${producto.nombre}`, { tone: 'error', detail: 'Ya tienes en la ronda todas las unidades en stock.' });
      return;
    }
    setCartForMesa(current => addDraftProduct(current, producto, isPromo, localId).items);
    setAddedNotice({ id: producto.id, nombre: producto.nombre });
    // En la carta basta el contador que rueda y la barra «Ver ronda nueva»; en Promos (sin barra) se avisa.
    if (isPromo || step !== 'productos') announceAdded(`${producto.nombre} añadido`, catalog.label);
  }, [cart, setCartForMesa, catalog.editable, catalog.label, pendingSend, toast, announceAdded, step]);

  // Menú: personalizar al añadir y repetir la ronda anterior (con «Deshacer»).
  const [customizing, setCustomizing] = useState(null);
  const openCustomize = useCallback((producto) => {
    if (pendingSend || orderSendLock.current) return;
    if (!catalog.editable) { setTargetOpen(true); return; }
    setCustomizing(producto);
  }, [catalog.editable, pendingSend]);
  const handleCustomizedAdd = useCallback((choice) => {
    const producto = customizing;
    if (!producto || pendingSend || orderSendLock.current) return;
    const localId = `${producto.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const preview = addCustomizedProduct(cart, producto, choice, localId);
    if (preview.error) {
      toast.show(`Solo quedan ${preview.available} de ${producto.nombre}`, { tone: 'error' });
      return;
    }
    setCartForMesa(current => addCustomizedProduct(current, producto, choice, localId).items);
    setCustomizing(null);
    const extrasText = [...choice.modificadores.map(m => m.nombre), choice.notas].filter(Boolean).join(' · ');
    announceAdded(`${choice.cantidad} × ${producto.nombre}`, extrasText || catalog.label, true);
  }, [customizing, cart, setCartForMesa, pendingSend, toast, announceAdded, catalog.label]);
  const favoriteProducts = useMemo(() => topProducts(pedidos, { products: productos.filter(p => !isPromotionProduct(p)) }), [pedidos, productos]);
  const repeatLines = useMemo(() => lastRoundItems(pedidoActual), [pedidoActual]);
  const repeatSummary = useMemo(() => {
    if (!repeatLines.length) return null;
    const priceOf = l => Number(productos.find(p => Number(p.id) === Number(l.producto_id))?.precio || 0) + l.modificadores.reduce((m, x) => m + Number(x.precio_extra || 0), 0);
    return { summary: repeatLines.map(l => `${l.cantidad}× ${l.nombre}`).join(', '), total: repeatLines.reduce((s, l) => s + Number(l.cantidad || 0) * priceOf(l), 0) };
  }, [repeatLines, productos]);
  const handleRepeatRound = useCallback(() => {
    if (!repeatLines.length || pendingSend || orderSendLock.current || !catalog.editable) return;
    const before = cart;
    const result = addLines(cart, repeatLines, productos);
    if (result.items === cart) { toast.show('No se pudo repetir la ronda', { tone: 'error', detail: 'Esos productos ya no tienen stock.' }); return; }
    setCartForMesa(() => result.items);
    toast.show('Ronda anterior repetida', {
      tone: 'success', detail: result.skipped.length ? `Sin stock: ${result.skipped.join(', ')}` : `${repeatLines.reduce((s, l) => s + Number(l.cantidad || 0), 0)} artículos añadidos`,
      action: { label: 'Deshacer', onPress: () => setCartForMesa(() => before) },
    });
  }, [repeatLines, cart, productos, pendingSend, catalog.editable, setCartForMesa, toast]);

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
      // Comanda: sin GET previos — el backend valida mesa, Express, disponibilidad, precios y servicio (409).
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

      // Comanda: la hoja se arranca, cae el sello «ENVIADA» y volvemos al salón sin modal bloqueante.
      // La mesa del aviso es la que el mesero eligió (no lo que devuelva el servidor), para no anunciar otra mesa.
      const sentMesa = !isExpressOrder ? (mesaActual || mesas.find((m) => Number(m.id) === Number(finalOrder.mesa_id)) || null) : null;
      const sentMesaId = !isExpressOrder ? (sentMesa?.id ?? finalOrder.mesa_id) : null;
      const sentExpressId = isExpressOrder ? finalOrder.id : null;
      setTearing(true);
      setSentBurst(true);
      setTimeout(() => {
        setTearing(false);
        setEditItemId(null);
        setStep(isExpressOrder ? 'express' : 'mesas');
      }, 260);
      toast.show('Ronda enviada a cocina', {
        tone: 'success',
        detail: sentMesaId ? `Mesa ${String(sentMesa?.numero ?? sentMesaId).padStart(2, '0')}` : (finalOrder.cliente_nombre || undefined),
        action: { label: sentMesaId ? 'Ver mesa' : 'Ver pedido', onPress: () => {
          if (sentMesaId) { setOrderMode('mesa'); setSelectedExpressPedidoId(null); setMesaSel(sentMesaId); setStep('pedido'); }
          else if (sentExpressId) openExpressOrder(finalOrder);
        } },
      });

      // Sync en background sin bloquear la UI
      scheduleLiveSync();
    } catch (error) {
      // Comanda: según el tipo de error se conserva en cola, se piden confirmaciones o se descarta.
      const kind = classifyError(error);
      const serverMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      if (kind === 'offline' || kind === 'retry') {
        setQueueAttempt(0); setQueueWakeAt(Date.now() + nextDelay(0));
        toast.show(kind === 'offline' ? 'Sin conexión · ronda en cola' : 'El servidor no respondió · ronda en cola', {
          tone: 'warning', detail: 'Se enviará sola al volver la red. No se duplica.',
        });
        setStep(isExpressOrder ? 'express' : 'mesas');
      } else if (kind === 'changed') {
        await drafts.reject(cartKey).catch(() => {});
        await reviewPriceChanges(serverMessage);
      } else {
        if (error.response?.data?.code !== 'REQUEST_CONFLICT') await drafts.reject(cartKey).catch(() => {});
        setCustomAlert({ title: 'No se pudo enviar la ronda', message: `${serverMessage} El borrador se conserva.` });
      }
    } finally {
      setOrderSending(false);
    }
  });

  // Comanda: tras un 409 de precio/servicio, se trae catálogo y configuración y se muestran las diferencias.
  const reviewPriceChanges = async (message) => {
    try {
      const [productResponse, configResponse] = await Promise.all([
        axios.get(`${BASE_URL}/productos`, { timeout: 10000 }),
        axios.get(`${BASE_URL}/configuracion`, { timeout: 10000 }),
      ]);
      const checked = validateDraft(cart, productResponse.data);
      setProductos(productResponse.data.filter(p => Number(p.disponible ?? 1) === 1));
      setPriceReview({ message, diffs: priceDiffs(cart, productResponse.data.filter(p => Number(p.disponible ?? 1) === 1)), items: checked.items || cart, config: configResponse.data });
    } catch (error) {
      setCustomAlert({ title: 'Cambiaron los precios', message: `${message} Actualiza el menú y vuelve a enviar.` });
    }
  };
  const acceptPriceChanges = () => {
    if (!priceReview) return;
    setPriceAccepting(true);
    setCarritos(prev => ({ ...prev, [cartKey]: priceReview.items }));
    if (priceReview.config) setBusinessConfig(priceReview.config);
    setPriceReview(null);
    setPriceAccepting(false);
    setResendTick(n => n + 1); // se reenvía en el siguiente render, con el carrito y el servicio ya actualizados
  };
  useEffect(() => { if (resendTick) enviarCocina(); }, [resendTick]);

  // Comanda: reenvío automático de rondas en cola (mismo request_id → el backend no duplica).
  const flushQueue = useCallback(async (manual = false) => {
    const entries = Object.entries(drafts.pending || {});
    if (!entries.length || queueLock.current || orderSendLock.current) return;
    queueLock.current = true; if (manual) setQueueRetrying(true);
    let failed = false; let sent = 0;
    try {
      for (const [key, request] of entries) {
        try {
          await axios.post(`${BASE_URL}/pedidos`, request, { timeout: 20000 });
          await drafts.complete(key); sent += 1;
        } catch (error) {
          const kind = classifyError(error);
          if (kind === 'offline' || kind === 'retry') { failed = true; break; }
          await drafts.reject(key).catch(() => {});
          toast.show('Una ronda en cola no se aceptó', { tone: 'error', detail: `${queueSummary({ [key]: request }, mesas)[0]?.label || ''}: ${error.response?.data?.error || error.message}. El borrador se conserva.` });
        }
      }
    } finally {
      queueLock.current = false; setQueueRetrying(false);
    }
    if (sent) { toast.show(sent === 1 ? 'Ronda en cola enviada a cocina' : `${sent} rondas en cola enviadas`, { tone: 'success' }); scheduleLiveSync(); }
    if (failed) {
      setQueueAttempt(a => { const next = a + 1; setQueueWakeAt(Date.now() + nextDelay(next)); return next; });
      if (manual) toast.show('Todavía sin conexión', { tone: 'warning', detail: 'La ronda sigue en cola.' });
    } else { setQueueAttempt(0); setQueueWakeAt(0); }
  }, [drafts, mesas, toast]);
  const pendingCount = Object.keys(drafts.pending || {}).length;
  useEffect(() => {
    if (!pendingCount || !drafts.ready) return undefined;
    const wait = Math.max(500, (queueWakeAt || Date.now() + nextDelay(queueAttempt)) - Date.now());
    const timer = setTimeout(() => flushQueue(false), wait);
    return () => clearTimeout(timer);
  }, [pendingCount, drafts.ready, queueWakeAt, queueAttempt]);
  useEffect(() => { if (realtimeStatus === 'connected' && pendingCount) flushQueue(false); }, [realtimeStatus]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const online = () => flushQueue(false);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flushQueue]);

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
  // Salón: hoja «Transferir o unir» (BottomSheet Comanda). Libre = mueve la cuenta; ocupada = une.
  const renderTransferModal = () => (
    <TransferSheet open={transferOpen} from={mesaActual} mesas={mesas} stateFor={mesaEstadoVisual} busy={transferSending}
      onClose={() => setTransferOpen(false)} onPick={(m) => enviarTransferencia(m)} />
  );

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

    // Comanda: dividir cuenta en hoja inferior arrastrable.
    return (
      <CBottomSheet visible={splitOpen} onClose={() => setSplitOpen(false)} busy={splitSending} maxHeight="92%"
        title="Dividir cuenta" subtitle={`${isExpressOrder ? 'Pedido' : `Mesa ${mesaActual?.numero || '-'}`} · Total ${cMoney(mesaDisplayTotal)}`}
        footer={<CButton variant="primary" size="lg" full icon={Printer} loading={splitSending} onPress={enviarDivisionCaja}>Enviar división a caja</CButton>}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CChip selected={isEqual} onPress={() => setSplitMode('equal')}>Partes iguales</CChip>
              <CChip selected={!isEqual} onPress={() => setSplitMode('items')}>Por productos</CChip>
            </View>
            {isEqual ? <View style={{ gap: 16, paddingTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <CT size={17} weight="600">Entre cuántas personas</CT>
                <CTally value={splitWays} onChange={setSplitWays} min={2} max={50} label="Personas" />
              </View>
              <CPerforation />
              <View style={{ gap: 10 }}>
                {equalAmounts.map((amount, i) => <CLeaderLine key={i} left={<CT size={16}>Parte {i + 1}</CT>} right={<CNum size={16} weight="600">{cMoney(amount)}</CNum>} />)}
              </View>
              {service > 0 ? <CT size={14} color={colors.muted}>Incluye el servicio de la cuenta.</CT> : null}
            </View> : <View style={{ gap: 12, paddingTop: 8 }}>
              <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {splitGuests.map(g => {
                  const guestDisplayTotal = splitCents(mesaDisplayTotal, splitGuests.map((x) => expandedOrderItems.filter((item) => Number(itemAssignments[item.splitKey] || 1) === Number(x)).reduce((sum, item) => sum + Math.round(Number(item.unitPrice || 0) * 100), 0)))[splitGuests.indexOf(g)];
                  return <CChip key={g} selected={activeGuest === g} onPress={() => setActiveGuest(g)} accessibilityLabel={`Comensal ${g}, ${cMoney(guestDisplayTotal)}`}>{`C${g} · ${cMoney(guestDisplayTotal)}`}</CChip>;
                })}
                <CChip icon={Plus} onPress={addGuest} accessibilityLabel="Añadir comensal">Comensal</CChip>
              </ScrollView>
              <CT size={14} color={colors.muted}>Toca un producto para pasarlo al comensal {activeGuest}.</CT>
              <View>
                {expandedOrderItems.map((item) => {
                  const assignedTo = itemAssignments[item.splitKey] || 1;
                  const mine = assignedTo === activeGuest;
                  return <TouchableOpacity key={item.splitKey} accessibilityRole="button" accessibilityState={{ selected: mine }} accessibilityLabel={`${item.nombre}, comensal ${assignedTo}`}
                    onPress={() => setItemAssignments(prev => ({ ...prev, [item.splitKey]: activeGuest }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderColor: colors.line }}>
                    <View style={{ minWidth: 38, height: 30, paddingHorizontal: 6, borderRadius: 15, backgroundColor: mine ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <CNum size={13} weight="800" color={mine ? colors.onPrimary : colors.text}>C{assignedTo}</CNum>
                    </View>
                    <View style={{ flex: 1 }}><CLeaderLine left={<CT size={16} weight={mine ? '600' : '400'} numberOfLines={1}>{item.nombre}</CT>} right={<CNum size={15}>{cMoney(item.unitPrice)}</CNum>} /></View>
                  </TouchableOpacity>;
                })}
              </View>
            </View>}

      </CBottomSheet>
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

  const renderSideMenu = () => <WaiterMoreSheet open={menuOpen} onClose={() => setMenuOpen(false)} name={meseroNombre} navigate={navigate}
    dark={isDark} toggleTheme={toggleTheme} refresh={loadData} logout={logout}
    draftCount={draftKeys.length} draftAttention={!!drafts.error || Object.keys(drafts.pending).length > 0} openDrafts={() => setDraftListOpen(true)}
    connection={realtimeStatus} lastSyncAt={lastSyncAt} syncing={loading || backgroundSyncing} syncError={loadError} contextLabel={catalog.label} />;

  // Menú: «Destino del pedido» como hoja inferior, mesas por zona con su estado por forma; Express como secundario.
  const renderTargetPicker = () => <>
    <TargetPickerSheet visible={targetOpen} onClose={() => setTargetOpen(false)} mesas={mesas} zoneOf={mesaUbicacion} stateOf={mesaEstadoVisual}
      currentMesaId={orderMode === 'mesa' ? mesaSel : null}
      onPickTable={mesa => { setTargetOpen(false); selectMesa(mesa); setStep('productos'); }}
      onPickExpress={type => { setTargetOpen(false); startExpressOrder(type); }} />
    <CustomizeSheet visible={!!customizing} product={customizing} extras={extras} inCart={customizing ? (cartQtyByProduct[customizing.id] || 0) : 0}
      onClose={() => setCustomizing(null)} onConfirm={handleCustomizedAdd} />
  </>;

  // Menú: contexto del catálogo (destino) en el mismo lenguaje de libreta, sin barra de color.
  const renderCatalogContext = () => (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {loadError ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Reintentar carga del catálogo" onPress={loadData} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.danger, fontSize: 14, fontWeight: '600' }}>No se pudo cargar el catálogo. Toca para reintentar.</Text></TouchableOpacity> : null}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Destino: ${catalog.label}. ${catalog.editable ? 'Cambiar' : 'Elegir destino'}`} onPress={() => setTargetOpen(true)}
        style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderRadius: 24, backgroundColor: catalog.editable ? colors.primarySoft : colors.surfaceAlt }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{catalog.editable ? 'Pidiendo para' : 'Sin destino'}</Text>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>{isExpressOrder && !selectedExpressPedidoId ? `${pickupTypeLabel(pickupType)} · borrador` : catalog.label}</Text>
          {!catalog.editable ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{ catalog.reason === 'closed-express' ? 'Puedes consultar el menú. Selecciona otro destino para un nuevo pedido.' : catalog.reason === 'advance' ? 'Esta cuenta tiene abonos. Gestiona el saldo en caja antes de modificarla.' : 'Consulta el menú y elige un destino cuando quieras pedir.'}</Text> : null}
        </View>
        <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 15 }}>{catalog.editable ? 'Cambiar' : 'Elegir'}</Text>
      </TouchableOpacity>
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
  const renderDraftStatus = () => {
    // Comanda: errores de guardado + bandeja de rondas en cola (visible en todas las vistas).
    const queued = (step === 'pedido' || orderSending) && pendingSend ? queueSummary(Object.fromEntries(Object.entries(drafts.pending || {}).filter(([k]) => k !== String(cartKey))), mesas) : queueSummary(drafts.pending, mesas);
    if (!drafts.error && !queued.length) return null;
    return <View>
      {drafts.error ? <View style={{ paddingHorizontal: bodyPad, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line }}>
        <CT size={14} color={colors.danger}>{drafts.error} Conserva esta página abierta y vuelve a intentar.</CT></View> : null}
      <OfflineQueue entries={queued} retrying={queueRetrying} onRetry={() => flushQueue(true)} nextIn={queueWakeAt ? Math.max(0, queueWakeAt - Date.now()) : 0} />
    </View>;
  };
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

  // Comanda: en tablet (≥900) Menú y Comanda comparten pantalla: catálogo a la izquierda, hoja a la derecha.
  const bareShell = useRef(false);
  const renderShell = (children, scrollable = true, footer = null) => {
    if (bareShell.current) return (
      <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {scrollable ? <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
          : <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</View>}
        {footer}
      </View>
    );
    const splitView = width >= 900 && (step === 'productos' || step === 'pedido') && (!!mesaActual || isExpressOrder);
    let body;
    if (splitView) {
      bareShell.current = true;
      try {
        body = <View style={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
          <View style={{ flex: 1.35, minWidth: 0, minHeight: 0 }}>{renderProductos()}</View>
          <View style={{ width: Math.min(460, Math.max(360, width * 0.4)), minHeight: 0, borderLeftWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
            {renderShell(renderPedidoBody(), true, renderSendBar())}
          </View>
        </View>;
      } finally { bareShell.current = false; }
    }
    return (
      <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {renderTopTabs()}
        {renderDraftStatus()}
        {splitView ? body : scrollable ? (
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ paddingBottom: footer ? 24 : cartCount > 0 && step !== 'pedido' ? 96 : 32 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {children}
          </View>
        )}
        {splitView ? null : footer}
        <WaiterBottomBar step={step} navigate={navigate} cartCount={cartCount} expressCount={expressOrders.length} bottomInset={BOTTOM_INSET} setMenuOpen={setMenuOpen} />
      </View>
    );
  };

  // Salón: reservas de hoy, acciones rápidas (mantener presionada), bandeja «Listo».
  const salonReservations = useTodayReservations(!!user);
  const [salonActionsMesa, setSalonActionsMesa] = useState(null);
  const [trayDelivering, setTrayDelivering] = useState(null);
  const salonReady = useMemo(() => readyRounds(pedidos, serviceNow), [pedidos, serviceNow]);
  const salonPartial = useMemo(() => readyItems(pedidos), [pedidos]); // platos listos sueltos («Listo» parcial)
  const salonFocusMesa = (mesa) => { setOrderMode('mesa'); setSelectedExpressPedidoId(null); setMesaSel(mesa.id); setEditItemId(null); };
  const salonPedirCuenta = async (mesa) => {
    const order = activeOrderForMesa(mesa.id);
    if (!order) return;
    try {
      const { data } = await axios.post(`${BASE_URL}/pedidos/${order.id}/solicitar-cobro`);
      if (data.pedido) setPedidos((prev) => upsertById(prev, data.pedido));
      setMesas((prev) => prev.map((m) => (Number(m.id) === Number(mesa.id) ? { ...m, estado: 'Cuenta' } : m)));
      toast.show(`Mesa ${mesa.numero}: cuenta pedida`, { detail: 'Caja ya la ve como por cobrar.', tone: 'success', haptic: 'success' });
      scheduleLiveSync();
    } catch (error) {
      toast.show('No se pudo pedir la cuenta', { detail: error.response?.data?.message || error.message, tone: 'error', haptic: 'warning' });
    }
  };
  const salonEntregar = (round, pedido) => runExclusive(deliveryLock, async () => {
    if (!pedido.mesa_id && String(pedido.estado_cobro || '').toUpperCase() !== 'PAGADO') {
      toast.show('Primero cobrar en caja', { detail: `Pedido #${pedido.id} aún no está pagado.`, tone: 'warning', haptic: 'warning' });
      return;
    }
    setTrayDelivering(round.id);
    try {
      const { data } = await axios.put(`${BASE_URL}/pedidos/${round.pedido_id || pedido.id}/rondas/${round.id}`, { estado: 'ENTREGADO' });
      if (data.pedido) setPedidos((prev) => upsertById(prev, data.pedido));
      toast.show(pedido.mesa_id ? `Mesa ${pedido.mesa_numero || pedido.mesa_id}: entregado` : `#${pedido.id}: entregado`, { tone: 'success', haptic: 'success' });
      scheduleLiveSync();
    } catch (error) {
      toast.show('No se pudo marcar como entregado', { detail: error.response?.data?.message || error.message, tone: 'error', haptic: 'warning' });
    } finally { setTrayDelivering(null); }
  });
  const salonActionsOrder = salonActionsMesa ? activeOrderForMesa(salonActionsMesa.id) : null;
  // Salón: el aviso flotante ahora es un toast Comanda con acción «Ver» (comida lista vibra con 'success').
  useEffect(() => {
    if (!kitchenNotice) return;
    const n = kitchenNotice;
    setKitchenNotice(null);
    if (n.action === 'delay_summary') {
      toast.show(n.title, { detail: n.body, tone: 'warning', action: { label: 'Ver', onPress: () => setNotiOpen(true) } });
    } else if (n.action === 'sync_error') {
      toast.show(n.title, { detail: n.body, tone: 'error', action: { label: 'Reintentar', onPress: () => scheduleLiveSync() } });
    } else {
      salonHaptic(n.action === 'manual_ping' ? 'warning' : 'success');
      toast.show(n.title, { detail: n.body, tone: 'success', haptic: false, duration: 6000, action: { label: 'Ver', onPress: () => openPedidoFromNotification(n) } });
    }
  }, [kitchenNotice]);

  const renderMesas = () => <>
    {renderShell(<WaiterFloor
      colors={colors} width={width} groups={mesasPorUbicacion} counts={tableCounts} now={serviceNow} alerts={serviceAlerts}
      search={mesaSearch} setSearch={setMesaSearch} filter={mesaFilter} setFilter={setMesaFilter}
      compact={compactTables} setCompact={setCompactTables} selected={mesaSel} selectTable={selectMesa}
      stateFor={mesaEstadoVisual} orderFor={activeOrderForMesa} zones={mesaZones} zone={mesaZone} setZone={setMesaZone}
      refresh={loadData} refreshing={loading} loadError={loadError}
      reservations={salonReservations} onLongPressTable={setSalonActionsMesa} openTray={() => setNotiOpen(true)} readyCount={salonReady.length + salonPartial.length}
    />)}
    <TableActionsSheet mesa={salonActionsMesa} state={salonActionsMesa ? mesaEstadoVisual(salonActionsMesa) : 'Libre'} order={salonActionsOrder} onClose={() => setSalonActionsMesa(null)}
      actions={{
        order: () => { const m = salonActionsMesa; salonFocusMesa(m); setStep('productos'); },
        view: () => selectMesa(salonActionsMesa),
        bill: () => salonPedirCuenta(salonActionsMesa),
        transfer: () => { salonFocusMesa(salonActionsMesa); setTransferOpen(true); },
      }} />
  </>;

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

  // Menú: categorías como Chips de tinta (sin iconos genéricos).
  const renderCategoryTabs = (values, selected, onSelect) => (
    <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
      <CategoryChips items={values.map(cat => [cat, cat === 'Todas' ? 'Todo' : cat])} value={selected} onChange={onSelect} />
    </ScrollView>
  );

  const renderProductos = () => renderShell(<WaiterCatalog
    draftState={{saving:drafts.saving,error:drafts.error,pending:!!pendingSend,sending:orderSending}}
    colors={colors} width={width} products={productos} categories={categorias} category={categoria} setCategory={setCategoria}
    search={productoBusqueda} setSearch={setProductoBusqueda} preferences={menuPreferences} setPreferences={setMenuPreferences}
    catalog={{ ...catalog, label: isExpressOrder && !selectedExpressPedidoId ? `${expressInfo.nombre.trim() || 'Sin nombre'} · ${pickupTypeLabel(pickupType)} · borrador` : catalog.label }} locked={!!pendingSend || orderSending}
    counts={cartQtyByProduct} cartCount={width >= 900 && (!!mesaActual || isExpressOrder) ? 0 : cartCount} cartTotal={showingCart ? subtotal : 0} openOrder={() => setStep('pedido')}
    chooseTarget={() => setTargetOpen(true)} onAdd={handleAddProduct} onDecrement={handleDecrementProduct} onCustomize={openCustomize}
    favorites={favoriteProducts} repeat={repeatSummary ? { ...repeatSummary, onPress: handleRepeatRound } : null}
    refresh={loadData} loading={loading} loadError={loadError} bottomInset={BOTTOM_INSET}
  />, false);

  const renderPromociones = () => {
    // Menú: promociones como líneas de comanda, mismo lenguaje que la carta.
    const listHeader = (
      <View style={{ paddingBottom: 12, gap: 12 }}>
        {renderCatalogContext()}
        <MenuSearch value={promoBusqueda} onChangeText={setPromoBusqueda} placeholder="Buscar promociones" />
        {promoCategorias.length > 2 ? renderCategoryTabs(promoCategorias, promoCategoria, setPromoCategoria) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>Promociones</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{promocionesFiltradas.length} {promocionesFiltradas.length === 1 ? 'promo' : 'promos'}</Text>
        </View>
      </View>
    );

    return renderShell(
      <FlatList
        data={promocionesFiltradas}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.pageBg }}
        contentContainerStyle={{ padding: bodyPad, paddingTop: 16, paddingBottom: BOTTOM_INSET + 32, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            {promociones.length === 0 ? <BadgePercent size={32} color={colors.faint || colors.muted} /> : <Search size={32} color={colors.faint || colors.muted} />}
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>{promociones.length === 0 ? 'Sin promociones activas' : 'Nada coincide con la búsqueda'}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>{promociones.length === 0 ? 'Cuando el administrador cree promos aparecerán aquí.' : 'Prueba con otro nombre.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            producto={item}
            canAdd={catalog.editable}
            locked={!!pendingSend || orderSending}
            chooseTarget={() => setTargetOpen(true)}
            qty={cartQtyByProduct[item.id] || 0}
            isPromo={true}
            onPress={(p) => handleAddProduct(p, true)}
            onDecrement={handleDecrementProduct}
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
    // Comanda: línea de la ronda nueva — cantidad con Tally, quitar con «Deshacer» 5 s, personalización en línea.
    const itemId = item.localId || item.id;
    const isEditing = editItemId === itemId;
    const productoOriginal = productos.find(p => Number(p.id) === Number(item.producto_id));
    const imgUrl = item.imagen_url || productoOriginal?.imagen_url;
    const detail = [item.notas, ...(item.modificadores || []).map(modifierLabel)].filter(Boolean).join(' · ');
    const removeWithUndo = () => {
      const key = cartKey;
      const index = cart.findIndex(i => (i.localId || i.id) === itemId);
      removeItem(item);
      if (isEditing) setEditItemId(null);
      toast.show(`${item.nombre} quitado`, { duration: 5000, action: { label: 'Deshacer', onPress: () => setCarritos(prev => {
        const list = [...(prev[key] || [])];
        if (list.some(i => (i.localId || i.id) === itemId)) return prev;
        list.splice(Math.max(0, Math.min(index, list.length)), 0, item);
        return { ...prev, [key]: list };
      }) } });
    };
    return <OrderLine key={itemId} item={item} total={lineTotal(item)} detail={detail} image={!isMobile && imgUrl ? assetUrl(imgUrl) : null}
      expanded={isEditing} locked={!showingCart || !!pendingSend} onToggle={() => setEditItemId(isEditing ? null : itemId)}
      onQty={delta => changeQty(item, delta)} onRemove={removeWithUndo}>
      <LineCustomizer item={item} custom={customExtras[itemId] || {}}
        exclusions={(productoOriginal ? extrasForProduct(extras, productoOriginal) : exclusionExtras).filter(e => e.tipo !== 'EXTRA')}
        paid={(productoOriginal ? extrasForProduct(extras, productoOriginal) : paidExtras).filter(e => e.tipo === 'EXTRA')}
        onNote={text => updateItem(item, { notas: text })} onToggle={extra => toggleModifier(item, extra)}
        onCustomChange={patch => updateCustomExtra(itemId, patch)} onCustomAdd={() => addCustomExtra(item)} />
    </OrderLine>;
  }, [editItemId, productos, colors, isMobile, showingCart, pendingSend, cart, cartKey, extras, exclusionExtras, paidExtras, customExtras, changeQty, removeItem, updateItem, toggleModifier, addCustomExtra, updateCustomExtra, toast]);


  const renderTotals = () => {
    // Comanda: acciones de la cuenta ya abierta (rondas anteriores, dividir, mover, cobro).
    if (!pedidoActual) return null;
    const rounds = accountRounds(pedidoActual).filter((round) => round.estado !== 'CANCELADO');
    const paid = pedidoActual?.estado_cobro === 'PAGADO';
    return (
      <View>
        {rounds.length ? <SectionLabel>Rondas anteriores</SectionLabel> : null}
        {rounds.map((round, index) => {
          const canDeliver = round.estado === 'LISTO' && (!isExpressOrder || round.estado_cobro === 'PAGADO');
          return <PastRound key={round.id} round={round} index={index + 1}
            action={canDeliver ? <CButton variant="ink" full onPress={() => marcarEntregado(round)} loading={deliveringRound === round.id} disabled={deliveringRound !== null} accessibilityLabel={`Entregar ronda ${round.id}`}>Entregar esta ronda</CButton> : null}>
            {round.estado === 'LISTO' && isExpressOrder && round.estado_cobro !== 'PAGADO' ? <CT size={14} color={colors.warning}>Listo en cocina. La entrega se habilita al completar el cobro.</CT> : null}
          </PastRound>;
        })}
        {paid ? <CT size={15} weight="600" color={colors.success} style={{ marginTop: 12 }}>{pedidoActual.pendiente_entrega ? 'Pago completo · falta la entrega' : 'Pedido completado · guardado en el historial'}</CT> : null}
        <View style={{ gap: 8, marginTop: 16 }}>
          {catalog.editable && !showingCart ? <CButton variant="primary" size="lg" icon={Plus} full onPress={() => setStep('productos')}>Nueva ronda</CButton> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CButton icon={PieChart} disabled={paid} onPress={() => setSplitOpen(true)} style={{ flex: 1, paddingHorizontal: 8 }}>Dividir</CButton>
            {!isExpressOrder ? <CButton icon={ArrowRightLeft} onPress={() => setTransferOpen(true)} style={{ flex: 1, paddingHorizontal: 8 }}>Mover</CButton> : null}
            <CButton icon={Printer} disabled={paid} onPress={solicitarCobroCaja} style={{ flex: 1, paddingHorizontal: 8 }} accessibilityLabel="Solicitar cobro en caja">{paid ? 'Pagado' : 'Cobrar'}</CButton>
          </View>
        </View>
      </View>
    );
  };

  const renderPedidoBody = () => {
    // Comanda: la hoja de la libreta — encabezado, ronda nueva, total y rondas anteriores.
    const activeOrderMesa = mesaActual || { numero: pedidoActual?.mesa_numero || '-' };
    const cartItems = cart;
    const historicalItems = pedidoActual?.items || [];
    const totalItemsCount = [...cartItems, ...historicalItems].reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const currentPickupType = pedidoActual?.tipo === 'Delivery' ? 'Delivery' : pickupType;
    const pickupDraftDetail = currentPickupType === 'Delivery'
      ? [expressInfo.telefono.trim(), expressInfo.direccion.trim(), expressInfo.referencia.trim(), expressInfo.dato.trim()].filter(Boolean).join(' · ')
      : expressInfo.dato.trim();
    const editingCustomer = isExpressOrder && currentExpressDraft && !selectedExpressPedidoId;
    const openedAt = pedidoActual?.created_at ? new Date(pedidoActual.created_at).getTime() : null;
    const elapsed = openedAt && serviceNow ? Math.max(0, Math.floor((Number(serviceNow) - openedAt) / 60000)) : null;
    const minutes = elapsed == null || elapsed >= 24 * 60 ? null : elapsed < 60 ? `${elapsed}` : `${Math.floor(elapsed / 60)} h ${elapsed % 60}`;
    const paid = pedidoActual?.estado_cobro === 'PAGADO';
    const stamp = pendingSend ? 'EN COLA' : paid ? 'PAGADA' : pedidoActual ? 'ABIERTA' : null;
    const stampColor = pendingSend ? colors.warning : paid ? colors.success : colors.ink;
    const meta = isExpressOrder
      ? `${pickupTypeLabel(currentPickupType)}${minutes != null ? ` · ${minutes} min` : ''}`
      : [mesaActual?.ubicacion, mesaActual?.capacidad ? `${mesaActual.capacidad} plazas` : null, minutes != null ? `${minutes} min` : null].filter(Boolean).join(' · ') || 'Mesa';
    const title = isExpressOrder
      ? (pedidoActual ? pickupOrderLabel(pedidoActual) : expressInfo.nombre.trim() || 'Cliente sin nombre')
      : pedidoActual ? `Cuenta #${pedidoActual.id}` : 'Cuenta nueva';
    const subtitle = isExpressOrder
      ? (pedidoActual ? pickupDetailLabel(pedidoActual) : pickupDraftDetail) || null
      : `${totalItemsCount} ${totalItemsCount === 1 ? 'artículo' : 'artículos'}`;
    const split = width >= 900;

    return (
      <TearAway tearing={tearing} style={{ padding: split ? 20 : bodyPad, paddingTop: 20, maxWidth: split ? undefined : 760, alignSelf: 'center', width: '100%' }}>
        <ComandaHeader number={isExpressOrder ? null : activeOrderMesa.numero} meta={meta} title={title} subtitle={subtitle} stamp={stamp} stampColor={stampColor}>
          {isExpressOrder && currentExpressDraft ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <CButton variant="ghost" onPress={() => setDraftListOpen(true)} accessibilityLabel="Cambiar borrador Express">Cambiar borrador</CButton>
          </View> : null}
        </ComandaHeader>

        {editingCustomer ? (
          <View pointerEvents={pendingSend ? 'none' : 'auto'} style={{ gap: 12, marginTop: 8, opacity: pendingSend ? 0.6 : 1 }}>
            <CLabel>Canal</CLabel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['Para llevar', 'Delivery'].map((tipo) => <CChip key={tipo} selected={pickupType === tipo} onPress={() => setPickupType(tipo)} accessibilityLabel={`Canal: ${pickupTypeLabel(tipo)}`}>{pickupTypeLabel(tipo)}</CChip>)}
            </View>
            <CField label="Nombre del cliente" value={expressInfo.nombre} onChangeText={(nombre) => setExpressInfo((prev) => ({ ...prev, nombre }))} editable={!pendingSend} placeholder="Obligatorio" maxLength={120} autoCapitalize="words" accessibilityLabel="Nombre del cliente" />
            <CField label={pickupType === 'Delivery' ? 'Plataforma o código' : 'Referencia'} value={expressInfo.dato} onChangeText={(dato) => setExpressInfo((prev) => ({ ...prev, dato }))} editable={!pendingSend} placeholder={pickupType === 'Delivery' ? 'Opcional' : 'Teléfono, placa u otro dato (opcional)'} maxLength={160} accessibilityLabel="Referencia del cliente" />
            {pickupType === 'Delivery' ? <>
              <CField label="Teléfono" value={expressInfo.telefono} onChangeText={(telefono) => setExpressInfo((prev) => ({ ...prev, telefono }))} editable={!pendingSend} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="Opcional" maxLength={40} accessibilityLabel="Teléfono de delivery" />
              <CField label="Dirección" value={expressInfo.direccion} onChangeText={(direccion) => setExpressInfo((prev) => ({ ...prev, direccion }))} editable={!pendingSend} placeholder="Si contacta directo al local" maxLength={220} accessibilityLabel="Dirección de delivery" />
              <CField label="Referencia de entrega" value={expressInfo.referencia} onChangeText={(referencia) => setExpressInfo((prev) => ({ ...prev, referencia }))} editable={!pendingSend} placeholder="App, repartidor o punto de referencia" maxLength={220} accessibilityLabel="Referencia de delivery" />
            </> : null}
          </View>
        ) : null}

        {cartItems.length || !pedidoActual ? <SectionLabel right={cartCount ? <CNum size={14} color={colors.muted}>{cartCount} art.</CNum> : null}>{pendingSend ? 'Ronda en cola · sin confirmar' : 'Ronda nueva'}</SectionLabel> : null}
        {cartItems.length ? cartItems.map(item => renderOrderItem(item, true)) : pedidoActual ? null : (
          <View style={{ paddingVertical: 28, borderRadius: 24, backgroundColor: colors.surfaceAlt, alignItems: 'center', gap: 12 }}>
            <CT size={15} color={colors.muted}>{catalog.editable ? 'Sin productos en esta ronda.' : 'Esta cuenta ya no admite rondas nuevas.'}</CT>
            {catalog.editable && !split ? <CButton variant="primary" icon={Plus} onPress={() => setStep('productos')} style={{ alignSelf: 'center' }}>Elegir productos</CButton> : null}
          </View>
        )}
        {(cartItems.length && catalog.editable && !split) || ((showingCart || editingCustomer) && !orderNote && !noteOpen) ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {cartItems.length && catalog.editable && !split ? <CButton variant="ghost" icon={Plus} onPress={() => setStep('productos')}>Añadir más</CButton> : null}
          {(showingCart || editingCustomer) && !orderNote && !noteOpen ? <CButton variant="ghost" icon={StickyNote} onPress={() => setNoteOpen(true)} accessibilityLabel="Añadir nota general">Nota general</CButton> : null}
        </View> : null}
        {(showingCart || editingCustomer) && (orderNote || noteOpen) ? <CField label="Nota general" value={orderNote} onChangeText={updateOrderNote} editable={!pendingSend} placeholder="Ej. entregar todo junto, silla para bebé" multiline autoFocus={noteOpen && !orderNote} maxLength={120} style={{ marginTop: 12 }} accessibilityLabel="Notas generales de la cuenta" />
          : !(showingCart || editingCustomer) && pedidoActual?.notas ? <CT size={15} color={colors.muted} style={{ marginTop: 12 }}>Nota: {pedidoActual.notas}</CT> : null}

        <TotalsBlock
          rows={[
            ...(showingCart ? [[`Ronda nueva`, subtotal]] : []),
            ...(service > 0 ? [[showingCart ? `Servicio ${servicePercent}%` : 'Servicio incluido', service]] : []),
            ...(showingCart && pedidoActual ? [['Ya en la cuenta', storedTotal]] : []),
          ]}
          grand={mesaDisplayTotal} grandLabel={isExpressOrder ? 'Total del pedido' : 'Total de la mesa'} />

        {renderTotals()}

        {pedidoActual ? <View style={{ marginTop: 24 }}><OrderServicePanel key={pedidoActual?.id || 'draft'} order={pedidoActual} now={serviceNow} colors={colors} alerts={serviceAlerts} /></View> : null}
      </TearAway>
    );
  };

  const renderSendBar = () => (showingCart || pendingSend) ? <SendBar count={cartCount} amount={total} onPress={enviarCocina} sending={orderSending}
    pending={!!pendingSend} offline={realtimeStatus !== 'connected'} disabled={!drafts.ready} /> : null;

  const renderPedido = () => renderShell(renderPedidoBody(), true, renderSendBar());

  const renderCustomAlertModal = () => (
    // Comanda: avisos como hoja inferior (arrastrable), no modal centrado.
    <NoticeSheet notice={customAlert} onClose={() => setCustomAlert(null)} />
  );

  // Salón: bandeja «Listo» (rondas listas con «Entregado», demoras y actividad).
  const renderNotifications = () => <WaiterNotifications colors={colors} alerts={serviceAlerts} activity={notificaciones} close={()=>setNotiOpen(false)} openOrder={openPedidoFromNotification} clearActivity={()=>setNotificaciones([])}
    ready={salonReady} partial={salonPartial} onDeliver={salonEntregar} deliveringId={trayDelivering} now={serviceNow}/>;

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

      {/* Salón: el aviso flotante (kitchenNotice) se muestra como toast Comanda; ver el efecto junto a renderMesas. */}

      {/* Menú: el aviso «añadido» ahora es un toast Comanda con «Ver comanda» (ver announceAdded). */}

      {/* Comanda: sin modal bloqueante; el estado «Enviando…» vive en la barra de envío. */}
      <CStampBurst text="ENVIADA" visible={sentBurst} onDone={() => setSentBurst(false)} />
      <PriceChangesSheet visible={!!priceReview} diffs={priceReview?.diffs} message={priceReview?.message} busy={priceAccepting}
        onAccept={acceptPriceChanges} onClose={() => setPriceReview(null)} />
      {customAlert ? renderCustomAlertModal() : null}
      {transferOpen ? renderTransferModal() : null}
      {splitOpen ? renderSplitBillModal() : null}
      {notiOpen ? renderNotifications() : null}
      {renderSideMenu()}
    </View>
  );
}
