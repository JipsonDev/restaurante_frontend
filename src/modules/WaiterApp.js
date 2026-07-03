import React, { useEffect, useMemo, useState, useCallback, memo, useRef } from 'react';
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
  SlidersHorizontal,
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
import { useAuth, BASE_URL, assetUrl } from '../context/AuthContext';
import { useTheme } from '../theme';
import Logo from '../components/Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';
import {
  addWaiterNotificationResponseListener,
  configureWaiterNotifications,
  notifyWaiterInApp,
  registerWaiterPushToken,
} from '../services/waiterNotifications';
import { ALERT_TONES, playWebAlertTone } from '../services/webAudioAlerts';

const SERVICE_RATE = 0.1;
// BUG FIX #1: Incluir 'ENTREGADO' en estados cerrados para que
// una mesa con pedido entregado no quede marcada como "ocupada" indefinidamente.
// Solo 'PAGADO' y 'CANCELADO' cierran la cuenta en el backend.
const CLOSED_STATES = ['PAGADO', 'CANCELADO'];
const WAITER_FONT = Platform.select({
  web: 'Inter, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

const Text = ({ style, ...props }) => (
  <RNText {...props} style={[WAITER_FONT ? { fontFamily: WAITER_FONT } : null, style]} />
);

// --- UTILIDADES ---
function money(n) { return `$${Number(n || 0).toFixed(2)}`; }

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

const isPromotionProduct = (producto) => {
  const category = normalizeText(producto.categoria_nombre || producto.categoria || '');
  const name = normalizeText(producto.nombre);
  const description = normalizeText(producto.descripcion);
  return category.includes('promo') || name.includes('promo') || description.includes('promo');
};

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

const UI_COLORS = {
  light: {
    pageBg: '#f8fafc',
    surface: '#ffffff',
    field: '#f1f5f9',
    line: '#e2e8f0',
    ink: '#0f172a',
    muted: '#64748b',
    brand: '#ea580c',
    softOrange: '#ffedd5',
    onAccent: '#ffffff',
    danger: '#ef4444',
    success: '#16a34a',
    successSoft: '#dcfce7',
    warning: '#f59e0b'
  },
  dark: {
    pageBg: '#090E17',
    surface: '#121A2F',
    field: '#1A243D',
    line: '#263554',
    ink: '#F8FAFC',
    muted: '#94A3B8',
    brand: '#FF7A00',
    softOrange: '#2B1C15',
    onAccent: '#FFFFFF',
    danger: '#FB7185',
    success: '#34D399',
    successSoft: '#064E3B',
    warning: '#FBBF24'
  }
};

const statusMeta = (estado, isDark) => {
  if (estado === 'Ocupada') return {
    label: 'Ocupada',
    dot: isDark ? '#FBBF24' : '#ff981a',
    bg: isDark ? '#451A03' : '#fff1df',
    text: isDark ? '#FDE68A' : '#ea580c',
    border: isDark ? '#78350F' : '#fed7aa'
  };
  if (estado === 'Cuenta') return {
    label: 'Cuenta',
    dot: isDark ? '#F87171' : '#ff7b7b',
    bg: isDark ? '#450A0A' : '#ffecec',
    text: isDark ? '#FECACA' : '#e11d48',
    border: isDark ? '#7F1D1D' : '#fecdd3'
  };
  if (estado === 'Reservada') return {
    label: 'Reservada',
    dot: isDark ? '#60A5FA' : '#2563eb',
    bg: isDark ? '#1E3A8A' : '#dbeafe',
    text: isDark ? '#BFDBFE' : '#1d4ed8',
    border: isDark ? '#1D4ED8' : '#bfdbfe'
  };
  return {
    label: 'Disponible',
    dot: isDark ? '#34D399' : '#72b857',
    bg: isDark ? '#064E3B' : '#e7f4df',
    text: isDark ? '#A7F3D0' : '#16a34a',
    border: isDark ? '#047857' : '#bbf7d0'
  };
};

const modernShadow = Platform.select({
  web: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.15)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }
});

const softShadow = Platform.select({
  web: { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.1)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
});

const FALLBACK_MESAS = [
  { id: 1, numero: 1, capacidad: 2, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
  { id: 2, numero: 2, capacidad: 4, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
  { id: 3, numero: 3, capacidad: 2, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
  { id: 4, numero: 4, capacidad: 2, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
  { id: 5, numero: 5, capacidad: 3, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
  { id: 6, numero: 6, capacidad: 2, estado: 'Libre', pedidos_activos: 0, ubicacion_nombre: 'Salon' },
];

const FALLBACK_PRODUCTOS = [
  { id: 1, nombre: 'Cappuccino', precio: 48, categoria_nombre: 'Cafe', disponible: 1 },
  { id: 2, nombre: 'Chilaquiles Verdes', precio: 128, categoria_nombre: 'Desayunos', disponible: 1 },
];

const FALLBACK_PEDIDOS = [];
const EXPRESS_CART_KEY = 'express-pickup';

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
        backgroundColor: colors.danger, borderRadius: 14,
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

const TableGraphic = ({ mesa, meta, size, colors }) => {
  const cap = mesa.capacidad || 2;
  const chairSize = size * 0.28;
  const tableSize = size * 0.72;
  const chairStyle = {
    width: chairSize, height: chairSize, borderRadius: chairSize / 2,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: meta.text
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 12 }}>
      {cap >= 4 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: -chairSize / 2, zIndex: 1 }}>
          <View style={chairStyle} />
          {cap >= 6 ? <View style={chairStyle} /> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 2 }}>
        <View style={[chairStyle, { marginRight: -chairSize / 2 }]} />
        <View style={{
          width: tableSize, height: tableSize, borderRadius: tableSize * 0.25,
          backgroundColor: meta.bg, borderWidth: 2, borderColor: meta.border,
          alignItems: 'center', justifyContent: 'center', zIndex: 3,
          shadowColor: meta.text, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
        }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={{
              color: meta.text,
              fontSize: Math.min(24, tableSize * 0.34),
              fontWeight: '900',
              width: tableSize * 0.82,
              textAlign: 'center'
            }}
          >
            {mesa.numero}
          </Text>
        </View>
        <View style={[chairStyle, { marginLeft: -chairSize / 2 }]} />
      </View>
      {cap >= 3 ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: -chairSize / 2, zIndex: 1 }}>
          <View style={chairStyle} />
          {cap >= 5 ? <View style={chairStyle} /> : null}
        </View>
      ) : null}
    </View>
  );
};

const MesaCard = memo(({ mesa, meta, visual, selected, onPress, cardWidth, colors, shellWidth }) => (
  <TouchableOpacity
    onPress={() => onPress(mesa)}
    style={{
      width: cardWidth,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: selected ? colors.brand : colors.line,
      padding: cardWidth < 130 ? 9 : 14,
      ...softShadow,
      justifyContent: 'space-between',
    }}
  >
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{
        width: cardWidth < 130 ? 30 : 40, height: cardWidth < 130 ? 30 : 40,
        borderRadius: 21, backgroundColor: colors.softOrange,
        alignItems: 'center', justifyContent: 'center'
      }}>
        <Table2 size={cardWidth < 130 ? 15 : 20} color={colors.brand} strokeWidth={2.5} />
      </View>
      <View style={{
        backgroundColor: meta.bg, paddingHorizontal: cardWidth < 130 ? 6 : 10,
        paddingVertical: 5, borderRadius: 12, borderWidth: 1,
        borderColor: meta.border, maxWidth: cardWidth < 130 ? 72 : 100
      }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: cardWidth < 130 ? 9 : 11, fontWeight: '800', color: meta.text }}>
          {meta.label}
        </Text>
      </View>
    </View>
    <TableGraphic mesa={mesa} meta={meta} size={cardWidth < 130 ? 70 : shellWidth < 600 ? 86 : 84} colors={colors} />
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Users size={14} color={colors.muted} />
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginLeft: 5, color: colors.muted, fontSize: cardWidth < 130 ? 10 : 13, fontWeight: '700' }}>
          {mesa.capacidad} pers.
        </Text>
      </View>
      {Number(mesa.pedidos_activos || 0) > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Receipt size={14} color={colors.brand} />
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginLeft: 5, color: colors.brand, fontSize: cardWidth < 130 ? 10 : 13, fontWeight: '900' }}>
            {mesa.pedidos_activos}
          </Text>
        </View>
      ) : null}
    </View>
  </TouchableOpacity>
), (prevProps, nextProps) => {
  return prevProps.selected === nextProps.selected
    && prevProps.visual === nextProps.visual
    && prevProps.cardWidth === nextProps.cardWidth
    && prevProps.colors === nextProps.colors
    && Number(prevProps.mesa.numero) === Number(nextProps.mesa.numero)
    && Number(prevProps.mesa.capacidad) === Number(nextProps.mesa.capacidad)
    && Number(prevProps.mesa.pedidos_activos || 0) === Number(nextProps.mesa.pedidos_activos || 0);
});

const ProductCard = memo(({ producto, qty, isPromo, showDescription, onPress, onDecrement, onNoStock, cardWidth, isMobile, colors }) => {
  const img = assetUrl(producto.imagen_url);
  const stock = Number(producto.inventario_stock ?? producto.stock ?? 9999);
  const noStock = stock <= 0;
  const verySmallCard = cardWidth < 130;
  const imageHeight = isMobile ? (verySmallCard ? 82 : 140) : 200;
  const cardMinHeight = isMobile ? (verySmallCard ? 170 : 250) : 320;

  return (
    <TouchableOpacity
      onPress={() => (noStock && onNoStock ? onNoStock(producto) : onPress(producto))}
      style={{
        width: cardWidth,
        minHeight: cardMinHeight,
        borderWidth: 1,
        borderColor: qty > 0 ? colors.brand : colors.line,
        borderRadius: 16,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        opacity: noStock ? 0.6 : 1,
        ...modernShadow,
      }}
    >
      <View style={{
        height: imageHeight, minHeight: imageHeight, flexShrink: 0, width: '100%',
        backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative'
      }}>
        {img ? (
          <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          isPromo ? <BadgePercent size={isMobile ? 38 : 54} color={colors.muted} /> : <ChefHat size={isMobile ? 38 : 54} color={colors.muted} />
        )}
        {isPromo ? (
          <View style={{
            position: 'absolute', top: 12, left: 12, borderRadius: 16,
            backgroundColor: colors.softOrange, paddingHorizontal: 12, height: 28,
            alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brand
          }}>
            <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '900' }}>PROMO</Text>
          </View>
        ) : null}
        {qty > 0 ? (
          <View style={{
            position: 'absolute', top: 10, right: 10, minWidth: 28, height: 28,
            borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center',
            justifyContent: 'center', borderWidth: 2, borderColor: colors.surface
          }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.onAccent, fontSize: 12, fontWeight: '900', maxWidth: 24 }}>
              {qty}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: isMobile ? 12 : 16, flexGrow: 1, justifyContent: 'space-between' }}>
        <View>
          <Text numberOfLines={2} style={{ color: colors.ink, fontSize: isMobile ? 13 : 16, fontWeight: '800', lineHeight: isMobile ? 16 : 22 }}>
            {producto.nombre}
          </Text>
          {showDescription && !!producto.descripcion ? (
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: isMobile ? 12 : 14, fontWeight: '600', marginTop: 6, lineHeight: 18 }}>
              {producto.descripcion}
            </Text>
          ) : null}
        </View>
        <View style={{ marginTop: isMobile ? 10 : 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.brand, fontSize: isMobile ? 14 : 18, fontWeight: '900', flex: 1, paddingRight: 4 }}>
            {money(producto.precio)}
          </Text>
          {qty > 0 ? (
            <View style={{
              flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
              borderRadius: 20, borderWidth: 1, borderColor: colors.brand, overflow: 'hidden'
            }}>
              <TouchableOpacity
                onPress={(event) => { event?.stopPropagation?.(); onDecrement(producto, isPromo); }}
                style={{ width: isMobile ? 26 : 38, height: isMobile ? 26 : 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softOrange }}
              >
                <Minus size={isMobile ? 14 : 18} color={colors.brand} strokeWidth={3} />
              </TouchableOpacity>
              <View style={{ minWidth: isMobile ? 24 : 34, alignItems: 'center', justifyContent: 'center' }}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: isMobile ? 12 : 15, fontWeight: '900', color: colors.ink }}>{qty}</Text>
              </View>
              <TouchableOpacity
                onPress={(event) => { event?.stopPropagation?.(); onPress(producto); }}
                style={{ width: isMobile ? 26 : 38, height: isMobile ? 26 : 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}
              >
                <Plus size={isMobile ? 14 : 18} color={colors.onAccent} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={(event) => { event?.stopPropagation?.(); onPress(producto); }}
              style={{ width: isMobile ? 28 : 40, height: isMobile ? 28 : 40, borderRadius: 20, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={isMobile ? 16 : 22} color={colors.brand} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => (
  prevProps.qty === nextProps.qty
  && prevProps.cardWidth === nextProps.cardWidth
  && prevProps.isMobile === nextProps.isMobile
  && prevProps.isPromo === nextProps.isPromo
  && prevProps.showDescription === nextProps.showDescription
  && prevProps.colors === nextProps.colors
  && prevProps.producto.id === nextProps.producto.id
  && prevProps.producto.nombre === nextProps.producto.nombre
  && Number(prevProps.producto.precio) === Number(nextProps.producto.precio)
  && prevProps.producto.imagen_url === nextProps.producto.imagen_url
  && prevProps.producto.descripcion === nextProps.producto.descripcion
  && Number(prevProps.producto.disponible ?? 1) === Number(nextProps.producto.disponible ?? 1)
  && Number(prevProps.producto.inventario_stock ?? prevProps.producto.stock ?? 9999) === Number(nextProps.producto.inventario_stock ?? nextProps.producto.stock ?? 9999)
));

export default function App() {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const { isDark, toggle: toggleTheme } = useTheme();
  const colors = isDark ? UI_COLORS.dark : UI_COLORS.light;

  const [step, setStep] = useState('mesas');
  const [mesas, setMesas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesaSel, setMesaSel] = useState(null);
  const [orderMode, setOrderMode] = useState('mesa');
  const [selectedExpressPedidoId, setSelectedExpressPedidoId] = useState(null);
  const [mesaFilter, setMesaFilter] = useState('Todas');
  const [mesaSearch, setMesaSearch] = useState('');
  const [expressSearch, setExpressSearch] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [promoCategoria, setPromoCategoria] = useState('Todas');
  const [productoBusqueda, setProductoBusqueda] = useState('');
  const [promoBusqueda, setPromoBusqueda] = useState('');
  const [carritos, setCarritos] = useState({});
  const [orderNotes, setOrderNotes] = useState({});
  const [pickupType, setPickupType] = useState('Para llevar');
  const [pickupFilter, setPickupFilter] = useState('Todos');
  const [expressInfo, setExpressInfo] = useState({ nombre: '', dato: '', telefono: '', direccion: '', referencia: '' });
  const [customExtras, setCustomExtras] = useState({});
  const [notificaciones, setNotificaciones] = useState([]);
  const [kitchenNotice, setKitchenNotice] = useState(null);
  const [notiOpen, setNotiOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [editItemId, setEditItemId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);
  // BUG FIX #4: Usar una cola para alertas que se generan dentro de setCartForMesa
  // (setState dentro de setState causa renders inconsistentes). En vez de llamar
  // setCustomAlert dentro de setCartForMesa, acumulamos la alerta en un ref y
  // la aplicamos con un useEffect posterior.
  const pendingAlertRef = useRef(null);
  const kitchenNoticeTimer = useRef(null);
  const realtimeStatusRef = useRef('connecting');

  const liveSyncTimer = useRef(null);
  const liveSyncInFlight = useRef(false);
  const [splitSending, setSplitSending] = useState(false);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitMode, setSplitMode] = useState('equal');
  const [splitWays, setSplitWays] = useState(2);
  const [splitGuests, setSplitGuests] = useState([1, 2]);
  const [activeGuest, setActiveGuest] = useState(1);
  const [itemAssignments, setItemAssignments] = useState({});

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferSending, setTransferSending] = useState(false);

  const shellWidth = Math.max(320, width);
  const isMobile = width < 768;
  const bodyPad = isMobile ? 16 : width >= 1024 ? 32 : 24;

  const getColumns = useCallback((minCardWidth, gap, minColumns = 1) => {
    const availableWidth = shellWidth - (bodyPad * 2);
    return Math.max(minColumns, Math.floor((availableWidth + gap) / (minCardWidth + gap)));
  }, [shellWidth, bodyPad]);

  const tableGap = isMobile ? 10 : 16;
  const productGap = isMobile ? 12 : 20;

  const tableColumns = width < 360 ? 2 : width < 768 ? 3 : getColumns(220, tableGap, 3);
  const productColumns = width < 450 ? 2 : width < 768 ? 2 : getColumns(260, productGap, 3);

  const tableCardWidth = (shellWidth - bodyPad * 2 - tableGap * (tableColumns - 1)) / tableColumns;
  const productCardWidth = (shellWidth - bodyPad * 2 - productGap * (productColumns - 1)) / productColumns;

  // Flush pendingAlertRef después de cada render para no llamar setState dentro de setState
  useEffect(() => {
    if (pendingAlertRef.current) {
      setCustomAlert(pendingAlertRef.current);
      pendingAlertRef.current = null;
    }
  });

  const activeOrders = useMemo(
    () => pedidos.filter((p) => (
      !CLOSED_STATES.includes(normalizeEstado(p.estado))
      && (p.items || []).some((item) => Number(item.cantidad || 0) > 0)
    )),
    [pedidos]
  );

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

    let total = 0;
    let mergedItems = [];
    let notas = [];
    let mainEstado = 'ENTREGADO';

    orders.forEach(o => {
      total += Number(o.total || 0);
      mergedItems.push(...(o.items || []));
      if (o.notas) notas.push(o.notas);

      const st = normalizeEstado(o.estado);
      if (st === 'PENDIENTE') mainEstado = 'PENDIENTE';
      else if (st === 'PREPARANDO' && mainEstado !== 'PENDIENTE') mainEstado = 'PREPARANDO';
      else if (st === 'LISTO' && mainEstado !== 'PENDIENTE' && mainEstado !== 'PREPARANDO') mainEstado = 'LISTO';
    });

    return {
      ...orders[0],
      total,
      items: mergedItems,
      notas: notas.join(' | '),
      estado: mainEstado,
      originalOrders: orders
    };
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
      return estadoServidor === 'CUENTA' ? 'Cuenta' : 'Ocupada';
    }

    // Si el servidor trae contador activo, respetamos cuenta/ocupada.
    if (pedidosActivosServidor > 0) {
      return estadoServidor === 'CUENTA' ? 'Cuenta' : 'Ocupada';
    }

    // Sin pedidos activos, una mesa marcada Ocupada/Cuenta es estado stale.
    if (estadoServidor === 'RESERVADA') return 'Reservada';

    return 'Libre';
  }, [activeOrderForMesa]);

  const mesaUbicacion = useCallback((mesa) => mesa.ubicacion_nombre || mesa.ubicacion || mesa.zona || 'Sin ubicacion', []);
  const isExpressOrder = orderMode === 'express';
  const mesaActual = useMemo(() => mesas.find((m) => Number(m.id) === Number(mesaSel)) || null, [mesas, mesaSel]);
  const expressOrders = useMemo(() => activeOrders.filter(isPickupOrder), [activeOrders]);
  const selectedExpressOrder = useMemo(
    () => expressOrders.find((pedido) => Number(pedido.id) === Number(selectedExpressPedidoId)) || null,
    [expressOrders, selectedExpressPedidoId]
  );
  const pedidoActual = useMemo(
    () => (isExpressOrder ? selectedExpressOrder : activeOrderForMesa(mesaSel)),
    [activeOrderForMesa, isExpressOrder, mesaSel, selectedExpressOrder]
  );

  const cartKey = isExpressOrder ? EXPRESS_CART_KEY : mesaSel;
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
  const storedTotal = Number(pedidoActual?.total || 0);
  const service = showingCart ? subtotal * SERVICE_RATE : Math.max(0, storedTotal - subtotal);

  // BUG FIX #7: mesaDisplayTotal estaba sumando el pedido anterior + el carrito
  // nuevo de forma acumulativa. El total a mostrar debe ser:
  // - Si hay carrito nuevo: subtotal_carrito + servicio + lo que ya estaba en cocina
  // - Si no hay carrito: el total del pedido del servidor
  const cartSubtotalWithService = showingCart ? subtotal + subtotal * SERVICE_RATE : 0;
  const mesaDisplayTotal = showingCart
    ? cartSubtotalWithService + storedTotal          // nuevo + histórico
    : storedTotal || (subtotal + service);           // solo histórico

  const total = showingCart ? subtotal + service : storedTotal || subtotal + service;

  const personas = isExpressOrder ? 1 : (mesaActual?.capacidad || pedidoActual?.personas || 2);

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
  }, [mesaSel]);

  const categorias = useMemo(() => {
    const values = productos
      .filter((p) => !isPromotionProduct(p))
      .map((p) => p.categoria_nombre || p.categoria || 'General')
      .filter(Boolean);
    return ['Todas', ...Array.from(new Set(values))];
  }, [productos]);

  const mesaFilters = useMemo(() => ['Todas', 'Disponibles', 'Ocupadas', 'Cuenta', 'Reservadas'], []);

  const mesasFiltradas = useMemo(() => {
    const q = normalizeText(mesaSearch);
    return mesas.filter((mesa) => {
      const visual = mesaEstadoVisual(mesa);
      const byText = !q || String(mesa.numero || mesa.id || '').includes(q);
      const byStatus = mesaFilter === 'Todas'
        || (mesaFilter === 'Disponibles' && visual === 'Libre')
        || (mesaFilter === 'Ocupadas' && visual === 'Ocupada')
        || (mesaFilter === 'Cuenta' && visual === 'Cuenta')
        || (mesaFilter === 'Reservadas' && visual === 'Reservada');
      return byText && byStatus;
    });
  }, [mesas, mesaFilter, mesaSearch, mesaEstadoVisual]);

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
    return groups;
  }, [mesasFiltradas, mesaUbicacion]);

  const expressOrdersFiltrados = useMemo(() => {
    const q = normalizeText(expressSearch);
    const byType = expressOrders.filter((pedido) => (
      pickupFilter === 'Todos'
      || (pickupFilter === 'Express' && pedido.tipo !== 'Delivery')
      || (pickupFilter === 'Delivery' && pedido.tipo === 'Delivery')
    ));
    if (!q) return byType;
    return byType.filter((pedido) => {
      const haystack = normalizeText(`${pedido.id} ${pedido.tipo || ''} ${pedido.cliente_nombre || ''} ${pedido.cliente_dato || ''} ${pedido.delivery_telefono || ''} ${pedido.delivery_direccion || ''} ${pedido.delivery_referencia || ''}`);
      return haystack.includes(q);
    });
  }, [expressOrders, expressSearch, pickupFilter]);

  const productosFiltrados = useMemo(() => {
    const q = normalizeText(productoBusqueda);
    return productos.filter((p) => {
      const cat = p.categoria_nombre || p.categoria || 'General';
      const byCategory = categoria === 'Todas' || normalizeText(cat) === normalizeText(categoria);
      const byText = !q || normalizeText(p.nombre).includes(q);
      return byCategory && byText && Number(p.disponible ?? 1) === 1 && !isPromotionProduct(p);
    });
  }, [productos, categoria, productoBusqueda]);

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

  const syncBackground = useCallback(async () => {
    try {
      const [mesasRes, pedidosRes] = await Promise.all([
        axios.get(`${BASE_URL}/mesas`),
        axios.get(`${BASE_URL}/pedidos`),
      ]);
      if (Array.isArray(mesasRes.data)) setMesas(mesasRes.data);
      if (Array.isArray(pedidosRes.data)) setPedidos(pedidosRes.data);
    } catch (_) {}
  }, []);

  const scheduleLiveSync = useCallback(() => {
    if (liveSyncTimer.current || liveSyncInFlight.current) return;
    liveSyncTimer.current = setTimeout(async () => {
      liveSyncTimer.current = null;
      liveSyncInFlight.current = true;
      await syncBackground();
      liveSyncInFlight.current = false;
    }, 200);
  }, [syncBackground]);

  // BUG FIX #8: loadData en useCallback para que pueda incluirse en deps de useEffect
  // sin crear un loop infinito.
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mesasRes, productosRes, pedidosRes, extrasRes] = await Promise.all([
        axios.get(`${BASE_URL}/mesas`),
        axios.get(`${BASE_URL}/productos`),
        axios.get(`${BASE_URL}/pedidos`),
        axios.get(`${BASE_URL}/extras`),
      ]);
      setMesas(mesasRes.data?.length ? mesasRes.data : FALLBACK_MESAS);
      setProductos((productosRes.data?.length ? productosRes.data : FALLBACK_PRODUCTOS)
        .filter((p) => Number(p.disponible ?? 1) === 1));
      setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : FALLBACK_PEDIDOS);
      setExtras(extrasRes.data || []);
      setMesaSel((prev) => prev || (mesasRes.data?.length ? mesasRes.data[0].id : FALLBACK_MESAS[0].id));
    } catch (_) {
      setMesas(FALLBACK_MESAS);
      setProductos(FALLBACK_PRODUCTOS);
      setPedidos(FALLBACK_PEDIDOS);
      setExtras([]);
      setMesaSel((prev) => prev || 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
      setPickupType(knownPedido?.tipo === 'Delivery' ? 'Delivery' : 'Para llevar');
      setMesaSel(EXPRESS_CART_KEY);
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
        return;
      }
      scheduleLiveSync();
    };

    const applyTablePayload = (estado) => (payload = {}) => {
      setMesas((prev) => updateMesaFromEvent(prev, payload, estado));
      if (!payload.mesa) scheduleLiveSync();
    };

    const unsubs = [
      subscribeRealtime(REALTIME_EVENTS.ORDER_READY, ({ pedido, message, action }) => {
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
            key: `${action || 'ready'}-${pedido?.id || Date.now()}`,
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
      if (liveSyncTimer.current) {
        clearTimeout(liveSyncTimer.current);
        liveSyncTimer.current = null;
      }
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

  const startExpressOrder = useCallback((tipo = 'Para llevar') => {
    setOrderMode('express');
    setPickupType(tipo === 'Delivery' ? 'Delivery' : 'Para llevar');
    setSelectedExpressPedidoId(null);
    setExpressInfo({ nombre: '', dato: '', telefono: '', direccion: '', referencia: '' });
    setMesaSel(EXPRESS_CART_KEY);
    setEditItemId(null);
    setStep('productos');
  }, []);

  const openExpressOrder = useCallback((pedido) => {
    setOrderMode('express');
    setPickupType(pedido?.tipo === 'Delivery' ? 'Delivery' : 'Para llevar');
    setSelectedExpressPedidoId(pedido.id);
    setMesaSel(EXPRESS_CART_KEY);
    setEditItemId(null);
    setStep('pedido');
  }, []);

  const setCartForMesa = useCallback((updater) => {
    if (!cartKey) return;
    setCarritos((prev) => ({
      ...prev,
      [cartKey]: typeof updater === 'function' ? updater(prev[cartKey] || []) : updater
    }));
  }, [cartKey]);

  const updateOrderNote = useCallback((value) => {
    if (!cartKey) return;
    setOrderNotes((prev) => ({ ...prev, [cartKey]: value }));
  }, [cartKey]);

  const handleNoStock = useCallback((producto) => {
    setCustomAlert({ title: 'Agotado', message: `El producto "${producto.nombre}" no tiene unidades disponibles en stock.` });
  }, []);

  const handleAddProduct = useCallback((producto, isPromo = false) => {
    if (!cartKey) {
      setCustomAlert({ title: 'Aviso', message: 'Selecciona una mesa o inicia un pedido express primero.' });
      setStep('mesas');
      return;
    }
    const stock = Number(producto.inventario_stock ?? producto.stock ?? 9999);

    setCartForMesa((current) => {
      const existing = current.find(
        (i) => Number(i.producto_id) === Number(producto.id) && i.promo === isPromo
      );
      if ((existing?.cantidad || 0) + 1 > stock) {
        // BUG FIX #10: No llamar setCustomAlert dentro del updater de setCartForMesa
        // (setState dentro de setState). Usar el ref de cola en su lugar.
        pendingAlertRef.current = {
          title: 'Sin stock',
          message: `Solo quedan ${stock} unidades disponibles de ${producto.nombre}.`
        };
        return current;
      }
      setAddedNotice({ id: producto.id, nombre: producto.nombre });

      if (existing) {
        return current.map((i) => (
          Number(i.producto_id) === Number(producto.id) && Boolean(i.promo) === Boolean(isPromo)
            ? { ...i, cantidad: Number(i.cantidad || 0) + 1 }
            : i
        ));
      }
      return [...current, {
        localId: `${isPromo ? 'promo-' : ''}${producto.id}-${Date.now()}`,
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio || 0),
        cantidad: 1,
        notas: isPromo ? (producto.descripcion || 'Promocion') : '',
        modificadores: isPromo ? [{ nombre: 'Promocion admin', tipo: 'NOTA', precio_extra: 0 }] : [],
        imagen_url: producto.imagen_url,
        categoria_nombre: producto.categoria_nombre || producto.categoria,
        stock,
        promo: isPromo,
      }];
    });
  }, [cartKey, setCartForMesa]);

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
    setCartForMesa((current) => {
      const nextArr = current.map((i) => {
        if ((i.localId || i.id) !== (item.localId || item.id)) return i;
        const next = Math.max(0, Number(i.cantidad || 0) + delta);
        if (next > Number(i.stock || 9999)) {
          pendingAlertRef.current = { title: 'Límite de stock', message: `No hay más unidades de ${i.nombre}.` };
          return i;
        }
        return { ...i, cantidad: next };
      });
      return nextArr.filter((i) => Number(i.cantidad || 0) > 0);
    });
  }, [setCartForMesa]);

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
  const enviarCocina = async () => {
    if (!cartKey || !cart.length) {
      return setCustomAlert({ title: 'Cuenta Vacía', message: 'Por favor, agrega productos antes de enviar la comanda.' });
    }
    try {
      const expressName = expressInfo.nombre.trim();
      const expressData = expressInfo.dato.trim();
      const deliveryPhone = expressInfo.telefono.trim();
      const deliveryAddress = expressInfo.direccion.trim();
      const deliveryReference = expressInfo.referencia.trim();
      if (isExpressOrder && !expressName) {
        return setCustomAlert({ title: 'Dato requerido', message: 'Escribe el nombre del cliente para el pedido express.' });
      }

      const payload = {
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

      const { data } = await axios.post(`${BASE_URL}/pedidos`, payload);
      const savedOrder = data.pedido || data;

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
      setCarritos(prev => ({ ...prev, [cartKey]: [] }));
      setAddedNotice(null);
      setOrderNotes(prev => ({ ...prev, [cartKey]: '' }));
      if (isExpressOrder) {
        setExpressInfo({ nombre: '', dato: '', telefono: '', direccion: '', referencia: '' });
        setSelectedExpressPedidoId(null);
        setOrderMode('mesa');
        setPickupType('Para llevar');
        setMesaSel(null);
      }

      // Ahora sí cambiar de vista — ya hay pedido en el estado local
      setStep(isExpressOrder ? 'express' : 'pedido');
      setCustomAlert({ title: 'Orden Enviada', message: 'La comanda ha sido enviada a cocina y la cuenta se registró en caja con éxito.' });

      // Sync en background sin bloquear la UI
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({
        title: 'Error de envío',
        message: error.response?.data?.message || error.response?.data?.error || error.message
      });
    }
  };

  const marcarEntregado = async () => {
    if (!pedidoActual || !pedidoActual.originalOrders) return;
    try {
      const listos = pedidoActual.originalOrders.filter(o => normalizeEstado(o.estado) === 'LISTO');
      if (!listos.length) return;
      await Promise.all(listos.map(o => axios.put(`${BASE_URL}/pedidos/${o.id}`, { estado: 'ENTREGADO' })));
      setCustomAlert({ title: 'Actualizado', message: 'Los productos de cocina listos han sido entregados a la mesa.' });
      scheduleLiveSync();
    } catch (error) {
      setCustomAlert({ title: 'Error al actualizar', message: error.response?.data?.message || error.message });
    }
  };

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
      ? Array.from({ length: splitWays }).map((_, index) => {
          const base = Math.floor((mesaDisplayTotal / splitWays) * 100) / 100;
          return {
            nombre: `Parte ${index + 1}`,
            monto: index === splitWays - 1
              ? Number((mesaDisplayTotal - base * (splitWays - 1)).toFixed(2))
              : base,
            items: [],
          };
        })
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
            monto: Number((subtotalGuest + subtotalGuest * SERVICE_RATE).toFixed(2)),
            items: Array.from(itemMap.entries()).map(([detalle_pedido_id, cantidad]) => ({ detalle_pedido_id, cantidad })),
          };
        }).filter((division) => division.monto > 0);

    if (!divisions.length) {
      return setCustomAlert({ title: 'Division vacia', message: 'Asigna al menos un producto antes de enviar la division a caja.' });
    }

    setSplitSending(true);
    try {
      await axios.post(`${BASE_URL}/pedidos/${pedidoActual.id}/split/request`, {
        mode: isEqual ? 'equal' : 'items',
        partes: isEqual ? splitWays : divisions.length,
        divisions,
      });
      setSplitOpen(false);
      setCustomAlert({ title: 'Enviado a caja', message: 'Caja recibio la division de esta cuenta para cobrarla.' });
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
                  <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>Mover Mesa</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700', marginTop: 2 }}>Desde Mesa {mesaActual?.numero}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setTransferOpen(false)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field }}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '800', marginBottom: 16 }}>Selecciona la mesa destino:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {mesas.filter(m => Number(m.id) !== Number(mesaSel)).map(m => {
                  const vState = mesaEstadoVisual(m);
                  const isFree = vState === 'Libre';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => enviarTransferencia(m)}
                      disabled={transferSending}
                      style={{ width: isMobile ? '100%' : '48%', backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.line, ...softShadow }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>Mesa {m.numero}</Text>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isFree ? colors.success : colors.warning }} />
                      </View>
                      <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>
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
    const equalAmount = splitWays > 0 ? mesaDisplayTotal / splitWays : 0;

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
                  <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>Dividir Cuenta</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700', marginTop: 2 }}>
                    Mesa {mesaActual?.numero || '-'} · Total: {money(mesaDisplayTotal)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSplitOpen(false)} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field }}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', padding: 16, backgroundColor: colors.surface }}>
              <TouchableOpacity
                onPress={() => setSplitMode('equal')}
                style={{ flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isEqual ? colors.softOrange : colors.field, borderWidth: 1, borderColor: isEqual ? colors.brand : 'transparent', marginRight: 8 }}
              >
                <Text style={{ color: isEqual ? colors.brand : colors.muted, fontWeight: '800', fontSize: 14 }}>Partes Iguales</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSplitMode('items')}
                style={{ flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: !isEqual ? colors.softOrange : colors.field, borderWidth: 1, borderColor: !isEqual ? colors.brand : 'transparent', marginLeft: 8 }}
              >
                <Text style={{ color: !isEqual ? colors.brand : colors.muted, fontWeight: '800', fontSize: 14 }}>Por Productos</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {isEqual ? (
                <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} showsVerticalScrollIndicator={false}>
                  <Users size={64} color={colors.brand} style={{ marginBottom: 32 }} />
                  <Text style={{ color: colors.muted, fontSize: 18, fontWeight: '700', marginBottom: 24, textAlign: 'center' }}>¿Entre cuántas personas?</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24, padding: 8, borderWidth: 1, borderColor: colors.line, ...softShadow }}>
                    <TouchableOpacity
                      onPress={() => setSplitWays(Math.max(2, splitWays - 1))}
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Minus size={28} color={colors.ink} />
                    </TouchableOpacity>
                    <View style={{ width: 100, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 36, fontWeight: '900', color: colors.ink }}>{splitWays}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSplitWays(splitWays + 1)}
                      style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={28} color={colors.onAccent} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginTop: 40, alignItems: 'center', padding: 24, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.brand, width: '100%', maxWidth: 300 }}>
                    <Text style={{ color: colors.muted, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Cada uno paga</Text>
                    <Text style={{ color: colors.brand, fontSize: 42, fontWeight: '900', textAlign: 'center' }}>{money(equalAmount)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 8 }}>Incluye servicio (10%)</Text>
                  </View>
                </ScrollView>
              ) : (
                <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
                  <View style={{ marginBottom: 16 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
                      {splitGuests.map(g => {
                        const isActive = activeGuest === g;
                        const totalGuest = guestTotals[g] || 0;
                        const guestDisplayTotal = totalGuest + (totalGuest * SERVICE_RATE);
                        return (
                          <TouchableOpacity
                            key={g}
                            onPress={() => setActiveGuest(g)}
                            style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: isActive ? colors.brand : colors.surface, borderWidth: 1, borderColor: isActive ? colors.brand : colors.line, ...softShadow, alignItems: 'center' }}
                          >
                            <Text style={{ color: isActive ? colors.onAccent : colors.ink, fontWeight: '900', fontSize: 14 }}>Comensal {g}</Text>
                            <Text style={{ color: isActive ? 'rgba(255,255,255,0.8)' : colors.muted, fontWeight: '700', fontSize: 12, marginTop: 4 }}>{money(guestDisplayTotal)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        onPress={addGuest}
                        style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.softOrange, borderWidth: 1, borderColor: colors.brand, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
                      >
                        <Plus size={18} color={colors.brand} />
                        <Text style={{ color: colors.brand, fontWeight: '900', fontSize: 14, marginLeft: 8 }}>Añadir</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '800', marginBottom: 12, paddingHorizontal: 4 }}>
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
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isCurrentActive ? colors.softOrange : colors.surface, borderRadius: 16, borderWidth: 1, borderColor: isCurrentActive ? colors.brand : colors.line, ...softShadow }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isCurrentActive ? colors.brand : colors.field, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                              <Text style={{ color: isCurrentActive ? colors.onAccent : colors.muted, fontWeight: '900', fontSize: 12 }}>C-{assignedTo}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: isCurrentActive ? colors.ink : colors.muted, fontWeight: '800', fontSize: 15 }}>{item.nombre}</Text>
                              <Text style={{ color: isCurrentActive ? colors.brand : colors.muted, fontWeight: '700', fontSize: 13, marginTop: 2 }}>{money(item.unitPrice)}</Text>
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
                style={{ height: 56, borderRadius: 16, backgroundColor: splitSending ? colors.muted : colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
              >
                {splitSending ? <ActivityIndicator color={colors.onAccent} /> : <Printer size={20} color={colors.onAccent} />}
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '900', marginLeft: 12 }}>
                  {splitSending ? 'Enviando...' : 'Enviar division a caja'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTopTabs = () => {
    const items = [
      ['mesas', 'Mesas', Users],
      ['express', 'Express', Receipt],
      ['productos', 'Menú', ChefHat],
      ['promociones', 'Promos', BadgePercent],
      ['pedido', 'Pedido', Receipt],
    ];

    const handleTabPress = (key) => {
      if (key === 'express') {
        setStep('express');
        return;
      }
      if (key !== 'mesas' && !mesaSel) return setCustomAlert({ title: 'Aviso', message: 'Selecciona una mesa' });
      if (isExpressOrder && selectedExpressPedidoId && ['productos', 'promociones'].includes(key)) return setCustomAlert({ title: 'Aviso', message: 'Para agregar otro express, inicia un pedido express nuevo desde Mesas.' });
      setStep(key);
    };

    if (isMobile) {
      return (
        <View style={{ flexShrink: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, zIndex: 10, elevation: 4, paddingTop: Math.max(16, TOP_INSET || 0) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: bodyPad, paddingBottom: 16 }}>
            <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.field }}>
              <Menu size={24} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Logo size="lg" dark={isDark} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={toggleTheme} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.field }}>
                {isDark ? <Sun size={21} color={colors.ink} /> : <Moon size={21} color={colors.ink} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setNotiOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: 12, backgroundColor: colors.field }}>
                <Bell size={22} color={colors.ink} />
                {unreadNotifications > 0 ? (
                  <View style={{ position: 'absolute', top: 8, right: 8, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                    <Text style={{ color: colors.onAccent, fontSize: 8, fontWeight: '900' }}>{unreadNotifications}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ paddingHorizontal: bodyPad, paddingBottom: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexGrow: 1, gap: 8, justifyContent: 'space-between' }}>
              {items.map(([key, label, Icon]) => {
                const active = step === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleTabPress(key)}
                    style={{ flex: 1, minWidth: 75, height: 46, borderRadius: 23, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: active ? colors.softOrange : colors.field, borderWidth: 1, borderColor: active ? colors.brand : 'transparent' }}
                  >
                    <Icon size={18} color={active ? colors.brand : colors.muted} strokeWidth={2.5} />
                    {width >= 360 ? <Text numberOfLines={1} style={{ marginLeft: 6, color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '800' }}>{label}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: bodyPad, paddingTop: Math.max(16, TOP_INSET || 0), paddingBottom: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, zIndex: 10, elevation: 4 }}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderRadius: 12, backgroundColor: colors.field }}>
          <Menu size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ marginRight: 32, paddingRight: 32, borderRightWidth: 1, borderColor: colors.line }}>
          <Logo size="md" dark={isDark} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 12 }}>
          {items.map(([key, label, Icon]) => {
            const active = step === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleTabPress(key)}
                style={{ minWidth: 100, height: 44, borderRadius: 22, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: active ? colors.softOrange : 'transparent', borderWidth: 1, borderColor: active ? colors.brand : 'transparent' }}
              >
                <Icon size={18} color={active ? colors.brand : colors.muted} strokeWidth={2.2} />
                <Text numberOfLines={1} style={{ marginLeft: 8, color: active ? colors.brand : colors.muted, fontSize: 14, fontWeight: '800' }}>{label}</Text>
                {key === 'express' && expressOrders.length > 0 ? (
                  <View style={{ marginLeft: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: active ? colors.brand : colors.field, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ color: active ? colors.onAccent : colors.muted, fontSize: 11, fontWeight: '900' }}>{expressOrders.length}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
          <TouchableOpacity onPress={toggleTheme} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.field, marginRight: 8 }}>
            {isDark ? <Sun size={20} color={colors.ink} /> : <Moon size={20} color={colors.ink} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNotiOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative', borderRadius: 12, backgroundColor: colors.field }}>
            <Bell size={20} color={colors.ink} />
            {unreadNotifications > 0 ? (
              <View style={{ position: 'absolute', top: 8, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                <Text style={{ color: colors.onAccent, fontSize: 9, fontWeight: '900' }}>{unreadNotifications}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSideMenu = () => (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: isDark ? 'rgba(9, 14, 23, 0.7)' : 'rgba(15, 23, 42, 0.5)' }}>
        <TouchableOpacity
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        />
        <View style={{ width: '85%', maxWidth: 340, height: '100%', backgroundColor: colors.surface, ...modernShadow }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: TOP_INSET + 24, paddingBottom: BOTTOM_INSET + 24, alignItems: 'center' }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 8 }} onPress={() => setMenuOpen(false)}>
              <X size={28} color={colors.muted} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 16 }}>
              <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 4, borderColor: colors.surface, ...softShadow }}>
                <Text style={{ color: colors.brand, fontSize: 36, fontWeight: '900' }}>{meseroNombre.charAt(0)}</Text>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>{meseroNombre}</Text>
              <View style={{ backgroundColor: colors.field, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.muted }}>Mesero Activo</Text>
              </View>
            </View>

            <View style={{ width: '100%', gap: 12 }}>
              {[
                ['mesas', 'Salón y Mesas', Users],
                ['express', 'Express y Delivery', Receipt],
                ['productos', 'Menú', ChefHat],
                ['promociones', 'Ofertas y Combos', BadgePercent],
                ['pedido', 'Comanda actual', Receipt],
              ].map(([key, label, Icon]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => { setMenuOpen(false); setStep(key); }}
                  style={{ height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, backgroundColor: step === key ? colors.softOrange : 'transparent', borderWidth: 1, borderColor: step === key ? colors.brand : 'transparent' }}
                >
                  <Icon size={24} color={step === key ? colors.brand : colors.muted} />
                  <Text style={{ fontWeight: '800', fontSize: 16, marginLeft: 20, color: step === key ? colors.brand : colors.ink }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 1, width: '100%', marginVertical: 32, backgroundColor: colors.line }} />

            <TouchableOpacity
              onPress={() => { setMenuOpen(false); loadData(); }}
              style={{ width: '100%', height: 60, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16, backgroundColor: colors.field }}
            >
              <Clock size={24} color={colors.muted} />
              <Text style={{ fontWeight: '800', fontSize: 16, marginLeft: 20, color: colors.ink }}>Sincronizar datos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              style={{ width: '100%', height: 60, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16, backgroundColor: colors.field }}
            >
              {isDark ? <Sun size={24} color={colors.ink} /> : <Moon size={24} color={colors.ink} />}
              <Text style={{ fontWeight: '800', fontSize: 16, marginLeft: 20, color: colors.ink }}>{isDark ? 'Modo claro' : 'Modo oscuro'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={logout}
              style={{ width: '100%', marginTop: 'auto', height: 60, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 40, backgroundColor: isDark ? '#431422' : '#fff1f2' }}
            >
              <LogOut size={24} color={colors.danger} />
              <Text style={{ fontWeight: '800', fontSize: 16, marginLeft: 20, color: colors.danger }}>Cerrar sesión</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderShell = (children, scrollable = true) => (
    <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {renderTopTabs()}
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

  const renderMesas = () =>
    renderShell(
      <View style={{ padding: bodyPad, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <Table2 size={24} color={colors.brand} />
          </View>
          <Text style={{ marginLeft: 16, color: colors.ink, fontSize: 26, fontWeight: '900' }}>Mesas</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: colors.surface, ...softShadow }}>
            <Search size={18} color={colors.muted} />
            <TextInput
              value={mesaSearch}
              onChangeText={setMesaSearch}
              placeholder="Buscar por número o ubicación..."
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', marginLeft: 12, paddingVertical: 0 }}
            />
          </View>
          <TouchableOpacity style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...softShadow }}>
            <SlidersHorizontal size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 16 }}>
          {mesaFilters.map((label) => {
            const active = mesaFilter === label;
            const meta = label === 'Disponibles'
              ? statusMeta('Libre', isDark)
              : label === 'Ocupadas'
                ? statusMeta('Ocupada', isDark)
                : label === 'Cuenta'
                  ? statusMeta('Cuenta', isDark)
                  : label === 'Reservadas'
                    ? statusMeta('Reservada', isDark)
                    : null;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => setMesaFilter(label)}
                style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
              >
                {meta ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.dot, marginRight: 8 }} /> : null}
                <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 13, fontWeight: '700' }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {false ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setStep('express')}
            style={{ borderRadius: 18, backgroundColor: colors.softOrange, padding: isMobile ? 14 : 16, marginBottom: 24, borderWidth: 1, borderColor: colors.brand, flexDirection: 'row', alignItems: 'center', ...softShadow }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Receipt size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ color: colors.brand, fontSize: isMobile ? 15 : 16, fontWeight: '900' }}>
                {expressOrders.length} {expressOrders.length === 1 ? 'pedido express abierto' : 'pedidos express abiertos'}
              </Text>
              <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700', marginTop: 2, opacity: 0.85 }}>Ver todos en la pestaña Express</Text>
            </View>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '900' }}>{expressOrders.length}</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {mesasPorUbicacion.map((group) => (
          <View key={group.name} style={{ marginTop: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginRight: 10 }} />
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '800' }}>{group.name}</Text>
              <View style={{ marginLeft: 12, backgroundColor: colors.field, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{group.mesas.length} mesas</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tableGap }}>
              {group.mesas.map(mesa => (
                <MesaCard
                  key={mesa.id}
                  mesa={mesa}
                  meta={statusMeta(mesaEstadoVisual(mesa), isDark)}
                  visual={mesaEstadoVisual(mesa)}
                  selected={Number(mesa.id) === Number(mesaSel)}
                  onPress={selectMesa}
                  cardWidth={tableCardWidth}
                  colors={colors}
                  shellWidth={shellWidth}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    );

  const renderExpress = () =>
    renderShell(
      <View style={{ padding: bodyPad, paddingTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={24} color={colors.brand} />
          </View>
          <Text style={{ marginLeft: 16, color: colors.ink, fontSize: 26, fontWeight: '900' }}>Express y Delivery</Text>
          {expressOrders.length > 0 ? (
            <View style={{ marginLeft: 12, backgroundColor: colors.field, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>{expressOrders.length} abiertos</Text>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 18 }}>
          {[
            ['Para llevar', 'Nuevo express', 'Cliente recoge en local. Solo nombre obligatorio.'],
            ['Delivery', 'Nuevo delivery', 'Para app externa o llamada directa. Datos extra opcionales.'],
          ].map(([tipo, title, subtitle]) => (
            <TouchableOpacity
              key={tipo}
              activeOpacity={0.9}
              onPress={() => startExpressOrder(tipo)}
              style={{ flex: 1, borderRadius: 18, backgroundColor: colors.surface, padding: isMobile ? 14 : 18, borderWidth: 1, borderColor: tipo === 'Delivery' ? colors.success : colors.brand, flexDirection: 'row', alignItems: 'center', ...softShadow }}
            >
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: tipo === 'Delivery' ? colors.successSoft : colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={26} color={tipo === 'Delivery' ? colors.success : colors.brand} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: colors.ink, fontSize: isMobile ? 16 : 18, fontWeight: '900' }}>{title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 3 }}>{subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {['Todos', 'Express', 'Delivery'].map((filter) => {
            const active = pickupFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setPickupFilter(filter)}
                style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.softOrange : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.line }}
              >
                <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '900' }}>{filter}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {expressOrders.length > 0 ? (
          <View style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 20, backgroundColor: colors.surface, ...softShadow }}>
            <Search size={18} color={colors.muted} />
            <TextInput
              value={expressSearch}
              onChangeText={setExpressSearch}
              placeholder="Buscar por cliente, dato o número de pedido..."
              placeholderTextColor={colors.muted}
              style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', marginLeft: 12, paddingVertical: 0 }}
            />
          </View>
        ) : null}

        {expressOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Receipt size={64} color={colors.line} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 20 }}>Sin pedidos express abiertos</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
              Los pedidos para llevar o delivery aparecerán aquí.
            </Text>
          </View>
        ) : expressOrdersFiltrados.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Search size={44} color={colors.line} />
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 16 }}>Sin resultados</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {expressOrdersFiltrados.map((pedido) => {
              const cuentaSolicitada = !!pedido.cuenta_solicitada_at;
              const itemCount = (pedido.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
              const isDelivery = pedido.tipo === 'Delivery';
              return (
                <TouchableOpacity
                  key={`express-${pedido.id}`}
                  activeOpacity={0.88}
                  onPress={() => openExpressOrder(pedido)}
                  style={{ borderRadius: 16, borderWidth: 1, borderColor: cuentaSolicitada ? colors.success : colors.line, backgroundColor: colors.surface, padding: 14, flexDirection: 'row', alignItems: 'center', ...softShadow }}
                >
                  <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: isDelivery ? colors.successSoft : colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={22} color={isDelivery ? colors.success : colors.brand} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 15, fontWeight: '900' }}>{pickupOrderLabel(pedido)}</Text>
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 3 }}>
                      {[pickupDetailLabel(pedido), `${itemCount} productos`, normalizeEstado(pedido.estado)].filter(Boolean).join(' - ')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {cuentaSolicitada ? (
                      <Text style={{ color: colors.success, fontSize: 11, fontWeight: '900', marginBottom: 4 }}>CUENTA</Text>
                    ) : null}
                    <Text style={{ color: colors.brand, fontSize: 15, fontWeight: '900' }}>{money(pedido.total)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );

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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
      {values.map((cat) => {
        const active = selected === cat;
        const Icon = categoryIconFor(cat);
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={{ width: isMobile ? 96 : 110, height: isMobile ? 90 : 100, borderRadius: 16, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, ...softShadow }}
          >
            <Icon size={isMobile ? 28 : 32} color={active ? colors.brand : colors.ink} strokeWidth={2} />
            <Text numberOfLines={1} style={{ color: active ? colors.brand : colors.ink, fontSize: isMobile ? 12 : 13, fontWeight: '800', marginTop: 12 }}>
              {cat === 'Todas' ? 'Todo' : cat}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderProductos = () => {
    const listHeader = (
      <View style={{ paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <Coffee size={24} color={colors.brand} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '900', marginLeft: 16 }}>Productos</Text>
          {isExpressOrder ? (
            <View style={{ marginLeft: 12, backgroundColor: pickupType === 'Delivery' ? colors.successSoft : colors.softOrange, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ color: pickupType === 'Delivery' ? colors.success : colors.brand, fontSize: 13, fontWeight: '800' }}>{pickupTypeLabel(pickupType)}</Text>
            </View>
          ) : mesaActual ? (
            <View style={{ marginLeft: 12, backgroundColor: colors.field, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>Mesa {mesaActual.numero}</Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24, backgroundColor: colors.surface, ...softShadow }}>
          <Search size={18} color={colors.muted} />
          <TextInput
            value={productoBusqueda}
            onChangeText={setProductoBusqueda}
            placeholder="Buscar por nombre..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', marginLeft: 12, paddingVertical: 0 }}
          />
        </View>

        {renderCategoryTabs(categorias, categoria, setCategoria)}
      </View>
    );

    return renderShell(
      <FlatList
        data={productosFiltrados}
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
        columnWrapperStyle={{ gap: productGap, marginBottom: productGap, justifyContent: 'flex-start' }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
            <Coffee size={48} color={colors.line} />
            <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 16 }}>Sin resultados</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProductCard
            producto={item}
            qty={cartQtyByProduct[item.id] || 0}
            isPromo={false}
            onPress={handleAddProduct}
            onDecrement={handleDecrementProduct}
            onNoStock={handleNoStock}
            cardWidth={productCardWidth}
            isMobile={isMobile}
            colors={colors}
            showDescription={false}
          />
        )}
      />,
      false
    );
  };

  const renderPromociones = () => {
    const listHeader = (
      <View style={{ paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <BadgePercent size={24} color={colors.brand} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '900', marginLeft: 16 }}>Promociones</Text>
        </View>

        <View style={{ height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 24, backgroundColor: colors.surface, ...softShadow }}>
          <Search size={18} color={colors.muted} />
          <TextInput
            value={promoBusqueda}
            onChangeText={setPromoBusqueda}
            placeholder="Buscar promociones..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600', marginLeft: 12, paddingVertical: 0 }}
          />
        </View>

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
        columnWrapperStyle={{ gap: productGap, marginBottom: productGap, justifyContent: 'flex-start' }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          promociones.length === 0 ? (
            <View style={{ width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, padding: 32, alignItems: 'center', ...softShadow }}>
              <BadgePercent size={48} color={colors.line} />
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 16 }}>Sin promociones activas</Text>
            </View>
          ) : (
            <View style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
              <Search size={44} color={colors.line} />
              <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16, marginTop: 16 }}>Sin resultados</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProductCard
            producto={item}
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

    return (
      <View key={itemId} style={{ marginBottom: 12 }}>
        <SwipeableRow enabled={isCartItem} onDelete={() => removeItem(item)} colors={colors}>
          <View style={{ width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, padding: isMobile ? 12 : 16, ...softShadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: colors.line, opacity: isCartItem ? 1 : 0.7 }}>
                {img ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <ChefHat size={32} color={colors.muted} />}
              </View>

              <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <Text numberOfLines={2} style={{ color: colors.ink, fontSize: isMobile ? 15 : 17, fontWeight: '800', lineHeight: isMobile ? 18 : 22 }}>
                  {item.nombre}
                </Text>
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                  {[item.notas, ...(item.modificadores || []).map(modifierLabel)].filter(Boolean).join(', ') || item.categoria_nombre || 'Sin observaciones'}
                </Text>
              </View>

              <View style={{ width: isMobile ? 84 : 100, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: isCartItem ? 'space-between' : 'center', paddingHorizontal: 6, marginRight: 8, backgroundColor: colors.surface }}>
                {isCartItem ? (
                  <TouchableOpacity disabled={!showingCart} onPress={() => changeQty(item, -1)} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                    <Minus size={14} color={showingCart ? colors.ink : colors.muted} strokeWidth={3} />
                  </TouchableOpacity>
                ) : null}
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.ink, fontSize: 15, fontWeight: '900', minWidth: 20, textAlign: 'center' }}>
                  {item.cantidad}
                </Text>
                {isCartItem ? (
                  <TouchableOpacity disabled={!showingCart} onPress={() => changeQty(item, 1)} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={14} color={showingCart ? colors.ink : colors.muted} strokeWidth={3} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text numberOfLines={1} adjustsFontSizeToFit style={{ width: isMobile ? 60 : 80, textAlign: 'right', color: colors.brand, fontSize: isMobile ? 14 : 18, fontWeight: '900' }}>
                {money(lineTotal(item))}
              </Text>

              {isCartItem && !isMobile ? (
                <TouchableOpacity onPress={() => removeItem(item)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isCartItem ? (
              <>
                <TouchableOpacity
                  onPress={() => setEditItemId(isEditing ? null : itemId)}
                  style={{ alignSelf: 'flex-start', marginTop: 16, height: 36, borderRadius: 18, paddingHorizontal: 16, backgroundColor: isEditing ? colors.softOrange : colors.field, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
                >
                  <Receipt size={14} color={isEditing ? colors.brand : colors.muted} />
                  <Text style={{ color: isEditing ? colors.brand : colors.muted, fontSize: 12, fontWeight: '800', marginLeft: 8 }}>
                    {isEditing ? 'Ocultar notas y extras' : 'Notas y extras adicionales'}
                  </Text>
                </TouchableOpacity>
                {isEditing ? (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line }}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Notas adicionales</Text>
                    <TextInput
                      value={item.notas || ''}
                      onChangeText={(text) => updateItem(item, { notas: text })}
                      placeholder="Ej. sin cebolla, poco picante..."
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{ minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, fontWeight: '600' }}
                    />

                    {exclusionExtras.length > 0 ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 10 }}>Exclusiones y opciones</Text> : null}
                    <View style={{ gap: 8 }}>
                      {exclusionExtras.map((extra) => {
                        const active = (item.modificadores || []).some((m) => m.nombre === extra.nombre);
                        const extraPrice = Number(extra.precio_extra ?? extra.precio ?? 0);
                        return (
                          <TouchableOpacity
                            key={`${itemId}-${extra.nombre}`}
                            onPress={() => toggleModifier(item, extra)}
                            style={{ minHeight: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, justifyContent: 'center' }}
                          >
                            <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '700' }}>
                              {extra.nombre}{extraPrice ? ` +${money(extraPrice)}` : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {paidExtras.length > 0 ? <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 10 }}>Extras adicionales con costo</Text> : null}
                    <View style={{ gap: 8 }}>
                      {paidExtras.map((extra) => {
                        const active = (item.modificadores || []).some((m) => m.nombre === extra.nombre);
                        const extraPrice = Number(extra.precio_extra ?? extra.precio ?? 0);
                        return (
                          <TouchableOpacity
                            key={`${itemId}-${extra.nombre}`}
                            onPress={() => toggleModifier(item, extra)}
                            style={{ minHeight: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.softOrange : colors.surface, justifyContent: 'center' }}
                          >
                            <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 12, fontWeight: '700' }}>
                              {extra.nombre} +{money(extraPrice)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 10 }}>Crear extra personalizado</Text>
                    <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 10 }}>
                      <TextInput
                        value={customExtras[itemId]?.nombre || ''}
                        onChangeText={(text) => updateCustomExtra(itemId, { nombre: text })}
                        placeholder="Escribir otro extra..."
                        placeholderTextColor={colors.muted}
                        style={{ flex: 1, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 16, fontSize: 13, fontWeight: '600' }}
                      />
                      <TextInput
                        value={customExtras[itemId]?.precio || ''}
                        onChangeText={(text) => updateCustomExtra(itemId, { precio: text })}
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        keyboardType="decimal-pad"
                        style={{ width: isMobile ? '100%' : 80, height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.field, color: colors.ink, paddingHorizontal: 12, textAlign: 'center', fontSize: 13, fontWeight: '600' }}
                      />
                      <TouchableOpacity onPress={() => addCustomExtra(item)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
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
    const tienePedidosListos = pedidoActual?.originalOrders?.some(o => normalizeEstado(o.estado) === 'LISTO');

    return (
      <View style={{ backgroundColor: colors.surface, padding: isMobile ? 18 : 22, borderRadius: 16, borderWidth: 1, borderColor: colors.line, ...softShadow, marginTop: 18 }}>
        {showingCart && pedidoActual ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>Cuenta anterior (en cocina)</Text>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{money(storedTotal)}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>
            {showingCart ? 'Subtotal nuevos' : 'Subtotal'}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{money(subtotal)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: colors.line }}>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700' }}>Servicio sugerido (10%)</Text>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>{money(service)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: colors.field, borderRadius: 14, padding: 14 }}>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900' }}>{isExpressOrder ? 'Total express' : 'Total mesa'}</Text>
          <Text style={{ color: colors.brand, fontSize: 28, fontWeight: '900' }}>{money(mesaDisplayTotal)}</Text>
        </View>

        {showingCart ? (
          <TouchableOpacity onPress={enviarCocina} style={{ height: 56, borderRadius: 16, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <ChefHat size={24} color={colors.onAccent} />
            <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '900', marginLeft: 12 }}>Enviar a Cocina y Caja</Text>
          </TouchableOpacity>
        ) : pedidoActual ? (
          <View style={{ gap: 12 }}>
            {tienePedidosListos ? (
              <TouchableOpacity onPress={marcarEntregado} style={{ height: 50, borderRadius: 12, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <CheckCircle2 size={20} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800', marginLeft: 8 }}>Entregar productos listos</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {!isExpressOrder ? (
                <TouchableOpacity onPress={() => setStep('productos')} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 12, backgroundColor: colors.softOrange, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                  <Plus size={16} color={colors.brand} />
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.brand, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>Añadir</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={() => setSplitOpen(true)} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                <PieChart size={16} color={colors.ink} />
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>Dividir</Text>
              </TouchableOpacity>

              {!isExpressOrder ? (
                <TouchableOpacity onPress={() => setTransferOpen(true)} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                  <ArrowRightLeft size={16} color={colors.ink} />
                  <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>Mover</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={solicitarCobroCaja} style={{ flex: 1, minWidth: '45%', height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', ...softShadow }}>
                <Printer size={16} color={colors.ink} />
                <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>Solicitar cobro</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderPedido = () => {
    const activeOrderMesa = mesaActual || { numero: pedidoActual?.mesa_numero || '-', capacidad: personas };

    const cartItems = cart;
    const historicalItems = pedidoActual?.items || [];
    const totalItemsCount = cartItems.length + historicalItems.length;
    const orderState = normalizeEstado(pedidoActual?.estado || (showingCart ? 'NUEVO' : 'PENDIENTE'));
    const stateColor = orderState === 'LISTO' ? colors.success : orderState === 'ENTREGADO' ? colors.danger : colors.brand;
    const currentPickupType = pedidoActual?.tipo === 'Delivery' ? 'Delivery' : pickupType;
    const pickupDraftDetail = currentPickupType === 'Delivery'
      ? [expressInfo.telefono.trim(), expressInfo.direccion.trim(), expressInfo.referencia.trim(), expressInfo.dato.trim()].filter(Boolean).join(' - ')
      : expressInfo.dato.trim();
    const orderTitle = isExpressOrder
      ? (pedidoActual ? pickupOrderLabel(pedidoActual) : `Pedido ${pickupTypeLabel(currentPickupType)}`)
      : `Mesa ${activeOrderMesa.numero || '-'}`;
    const orderSubtitle = isExpressOrder
      ? `${pedidoActual ? pickupDetailLabel(pedidoActual) : (pickupDraftDetail || expressInfo.nombre.trim() || 'Cliente pendiente')} - ${pickupTypeLabel(currentPickupType)} - ${totalItemsCount} items`
      : `${personas} comensales - ${totalItemsCount} items`;

    return renderShell(
      <View style={{ padding: bodyPad, paddingTop: 24, maxWidth: 1180, alignSelf: 'center', width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '900' }}>Comanda</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 2 }}>Revisa productos, notas y envio a caja</Text>
          </View>
        </View>

        <View style={{ borderRadius: 18, backgroundColor: colors.surface, padding: isMobile ? 14 : 18, flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.line, ...softShadow }}>
          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
            {isExpressOrder ? <Receipt size={28} color={colors.brand} strokeWidth={2} /> : <Table2 size={28} color={colors.brand} strokeWidth={2} />}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ color: colors.ink, fontSize: isMobile ? 20 : 24, fontWeight: '900' }}>{orderTitle}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 }}>{orderSubtitle}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <View style={{ minWidth: 96, height: 32, borderRadius: 16, backgroundColor: colors.field, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stateColor, marginRight: 7 }} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: stateColor, fontSize: 12, fontWeight: '900' }}>{orderState}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.brand, fontSize: isMobile ? 18 : 22, fontWeight: '900', maxWidth: 130 }}>{money(mesaDisplayTotal)}</Text>
          </View>
        </View>

        {totalItemsCount === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Receipt size={64} color={colors.line} />
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 20 }}>Cuenta vacía</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 8 }}>No hay productos añadidos a esta mesa.</Text>
            <TouchableOpacity
              onPress={() => setStep('productos')}
              style={{ marginTop: 24, height: 44, borderRadius: 12, paddingHorizontal: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', ...softShadow }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: '800' }}>Explorar menú</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {showingCart && isExpressOrder ? (
              <View style={{ marginBottom: 24, borderRadius: 16, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...softShadow }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 10 }}>Datos del cliente</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {['Para llevar', 'Delivery'].map((tipo) => {
                    const active = pickupType === tipo;
                    return (
                      <TouchableOpacity
                        key={tipo}
                        onPress={() => setPickupType(tipo)}
                        style={{ flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.softOrange : colors.field, borderWidth: 1, borderColor: active ? colors.brand : colors.line }}
                      >
                        <Text style={{ color: active ? colors.brand : colors.muted, fontSize: 13, fontWeight: '900' }}>{pickupTypeLabel(tipo)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  value={expressInfo.nombre}
                  onChangeText={(nombre) => setExpressInfo((prev) => ({ ...prev, nombre }))}
                  placeholder="Nombre del cliente (obligatorio)"
                  placeholderTextColor={colors.muted}
                  maxLength={120}
                  style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, marginBottom: 10 }}
                />
                <TextInput
                  value={expressInfo.dato}
                  onChangeText={(dato) => setExpressInfo((prev) => ({ ...prev, dato }))}
                  placeholder={pickupType === 'Delivery' ? 'Dato de plataforma o referencia (opcional)' : 'Telefono, referencia, placa u otro dato (opcional)'}
                  placeholderTextColor={colors.muted}
                  maxLength={160}
                  style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, marginBottom: pickupType === 'Delivery' ? 10 : 0 }}
                />
                {pickupType === 'Delivery' ? (
                  <>
                    <TextInput
                      value={expressInfo.telefono}
                      onChangeText={(telefono) => setExpressInfo((prev) => ({ ...prev, telefono }))}
                      placeholder="Telefono directo (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={40}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, marginBottom: 10 }}
                    />
                    <TextInput
                      value={expressInfo.direccion}
                      onChangeText={(direccion) => setExpressInfo((prev) => ({ ...prev, direccion }))}
                      placeholder="Direccion si contacta directo al local (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={220}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, marginBottom: 10 }}
                    />
                    <TextInput
                      value={expressInfo.referencia}
                      onChangeText={(referencia) => setExpressInfo((prev) => ({ ...prev, referencia }))}
                      placeholder="Referencia de entrega, app o repartidor (opcional)"
                      placeholderTextColor={colors.muted}
                      maxLength={220}
                      style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.field, color: colors.ink, fontSize: 14, fontWeight: '700', paddingHorizontal: 14 }}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            {cartItems.length > 0 ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginRight: 8 }} />
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>Nuevos (Por enviar)</Text>
                  {isMobile ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>(Desliza ← para borrar)</Text> : null}
                </View>
                <View style={{ gap: 0 }}>
                  {cartItems.map(item => renderOrderItem(item, true))}
                </View>
              </View>
            ) : null}

            {historicalItems.length > 0 ? (
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 8 }} />
                  <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>Ya enviados (En cocina)</Text>
                </View>
                <View style={{ gap: 0 }}>
                  {historicalItems.map(item => renderOrderItem(item, false))}
                </View>
              </View>
            ) : null}

            <View style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Receipt size={16} color={colors.ink} />
                <Text style={{ marginLeft: 8, color: colors.ink, fontSize: 14, fontWeight: '800' }}>Notas generales de la cuenta</Text>
              </View>
              {showingCart ? (
                <TextInput
                  value={orderNote}
                  onChangeText={updateOrderNote}
                  placeholder="Ej. Entregar todo junto, mesa necesita periquera..."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={120}
                  style={{ minHeight: 60, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, color: colors.ink, fontSize: 13, fontWeight: '600', padding: 16, ...softShadow }}
                />
              ) : (
                <View style={{ minHeight: 60, backgroundColor: colors.field, borderRadius: 12, padding: 16 }}>
                  <Text style={{ color: pedidoActual?.notas ? colors.ink : colors.muted, fontSize: 13, fontWeight: '600' }}>
                    {pedidoActual?.notas || 'Sin notas registradas para esta cuenta.'}
                  </Text>
                </View>
              )}
            </View>
            {renderTotals()}
          </>
        )}
      </View>
    );
  };

  const renderCustomAlertModal = () => {
    if (!customAlert) return null;

    return (
    <Modal visible transparent animationType="none" onRequestClose={() => setCustomAlert(null)}>
      <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(9, 14, 23, 0.75)' : 'rgba(15, 23, 42, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 320, backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.line, ...modernShadow }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Info size={24} color={colors.brand} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink, marginBottom: 8 }}>{customAlert?.title}</Text>
          <Text style={{ fontSize: 15, color: colors.muted, fontWeight: '600', lineHeight: 22, marginBottom: 24 }}>{customAlert?.message}</Text>
          <TouchableOpacity onPress={() => setCustomAlert(null)} style={{ width: '100%', height: 48, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: '800' }}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    );
  };

  const renderNotifications = () => (
    <Modal visible={notiOpen} transparent animationType="fade" onRequestClose={() => setNotiOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: isDark ? 'rgba(9, 14, 23, 0.75)' : 'rgba(15, 23, 42, 0.4)' }}>
        <View style={{ backgroundColor: colors.pageBg, paddingBottom: BOTTOM_INSET + 18, maxHeight: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, ...modernShadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }}>Alertas</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted, marginTop: 2 }}>{unreadNotifications} pendientes</Text>
            </View>
            <TouchableOpacity onPress={() => setNotiOpen(false)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field }}>
              <X size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <View style={{ borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: realtimeStatus === 'connected' ? colors.successSoft : colors.softOrange }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: realtimeStatus === 'connected' ? colors.success : colors.brand, marginRight: 12 }} />
              <Text style={{ fontWeight: '800', fontSize: 14, color: realtimeStatus === 'connected' ? (isDark ? '#34D399' : '#166534') : (isDark ? '#FBBF24' : '#9a3412') }}>
                {realtimeStatus === 'connected' ? 'Sincronización activa' : realtimeStatus === 'error' ? 'Conexión interrumpida' : 'Conectando al servidor...'}
              </Text>
            </View>
            {notificaciones.length > 0 ? (
              <TouchableOpacity onPress={() => setNotificaciones([])} style={{ padding: 8 }}>
                <Text style={{ fontWeight: '900', fontSize: 13, color: colors.brand }}>Limpiar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {notificaciones.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Bell size={64} color={colors.line} />
              <Text style={{ marginTop: 24, fontSize: 16, fontWeight: '700', color: colors.muted }}>Al día. No hay notificaciones pendientes.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {notificaciones.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  activeOpacity={0.88}
                  onPress={() => openPedidoFromNotification(n)}
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: n.read ? colors.surface : colors.successSoft,
                    borderWidth: n.read ? 0 : 1,
                    borderColor: n.read ? 'transparent' : colors.success,
                    ...softShadow,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: colors.softOrange }}>
                    <Bell size={17} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '900', fontSize: 14, color: colors.ink }}>{n.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 3, color: colors.muted, fontWeight: '700' }}>{n.body}</Text>
                    <Text style={{ fontSize: 10, marginTop: 5, color: colors.brand, fontWeight: '900' }}>{n.is_pickup ? 'Ver pedido' : 'Abrir mesa'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg }}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={{ marginTop: 24, fontWeight: '800', fontSize: 16, color: colors.muted }}>Sincronizando sistema...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: colors.pageBg, fontFamily: WAITER_FONT }}>
      {step === 'mesas' ? renderMesas() : null}
      {step === 'express' ? renderExpress() : null}
      {step === 'productos' ? renderProductos() : null}
      {step === 'promociones' ? renderPromociones() : null}
      {step === 'pedido' ? renderPedido() : null}

      {kitchenNotice ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
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
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: kitchenNotice.action === 'sync_error' ? colors.warning : colors.success,
            paddingHorizontal: 9,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            ...modernShadow,
          }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: kitchenNotice.action === 'sync_error' ? colors.warningSoft : colors.successSoft, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Bell size={15} color={kitchenNotice.action === 'sync_error' ? colors.warning : colors.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: '900' }}>{kitchenNotice.title}</Text>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 1 }}>
              {kitchenNotice.action === 'sync_error'
                ? 'Tocar para reintentar'
                : unreadNotifications > 1 ? `${unreadNotifications} alertas pendientes` : 'Tocar para abrir'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(event) => {
              event?.stopPropagation?.();
              setKitchenNotice(null);
            }}
            style={{ width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field, marginLeft: 6 }}
          >
            <X size={14} color={colors.muted} />
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      {(addedNotice && cartCount > 0 && step !== 'pedido') ? (
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
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.line,
          ...modernShadow,
          zIndex: 9999,
        }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
            <CheckCircle2 size={19} color={colors.success} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: '900' }}>{addedNotice.nombre} añadido</Text>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
              {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'} · {money(mesaDisplayTotal)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setStep('pedido')}
            style={{ height: 34, borderRadius: 10, backgroundColor: colors.brand, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginLeft: 8 }}
          >
            <Receipt size={15} color={colors.onAccent} />
            {!isMobile ? <Text style={{ color: colors.onAccent, fontSize: 12, fontWeight: '900', marginLeft: 6 }}>Ver</Text> : null}
          </TouchableOpacity>
        </View>
      ) : null}

      {customAlert ? renderCustomAlertModal() : null}
      {transferOpen ? renderTransferModal() : null}
      {splitOpen ? renderSplitBillModal() : null}
      {notiOpen ? renderNotifications() : null}
      {menuOpen ? renderSideMenu() : null}
    </View>
  );
}
