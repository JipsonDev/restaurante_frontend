import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator, Animated, Platform, SafeAreaView, ScrollView,
  Text as RNText, TouchableOpacity, View, useWindowDimensions, Vibration
} from 'react-native';
import {
  Bell, CheckCircle2, ChefHat, Clock, Flame, LogOut, Moon,
  PackageCheck, Printer, RefreshCw, Soup, Sun, Timer, Info,
  Layers, LayoutGrid, Megaphone, Volume2, VolumeX, X, Play
} from 'lucide-react-native';
import axios from 'axios';

// TUS RUTAS Y CONTEXTOS REALES
import { BASE_URL, useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';
import { ALERT_TONES, installWebAudioUnlock, playWebAlertTone, unlockWebAudio } from '../services/webAudioAlerts';

const WAITER_FONT = Platform.select({
  web: 'Inter, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  android: 'sans-serif',
  default: undefined,
});

const Text = ({ style, ...props }) => (
  <RNText {...props} style={[WAITER_FONT ? { fontFamily: WAITER_FONT } : null, style]} />
);

const UI_COLORS = {
  light: {
    pageBg: '#f8fafc', surface: '#ffffff', field: '#f1f5f9', line: '#e2e8f0', ink: '#0f172a',
    muted: '#64748b', faint: '#94a3b8', brand: '#ea580c', softOrange: '#ffedd5', onAccent: '#ffffff',
    danger: '#ef4444', success: '#16a34a', successSoft: '#dcfce7', warning: '#f59e0b',
    warningSoft: '#fef3c7', info: '#3b82f6', infoSoft: '#dbeafe'
  },
  dark: {
    pageBg: '#090E17', surface: '#121A2F', field: '#1A243D', line: '#263554', ink: '#F8FAFC',
    muted: '#94A3B8', faint: '#475569', brand: '#FF7A00', softOrange: '#2B1C15', onAccent: '#FFFFFF',
    danger: '#FB7185', success: '#34D399', successSoft: '#064E3B', warning: '#FBBF24',
    warningSoft: '#451A03', info: '#60A5FA', infoSoft: '#1E3A8A'
  }
};

const modernShadow = Platform.select({
  web: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.15)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }
});

const softShadow = Platform.select({
  web: { boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.1)' },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 }
});

const normalize = (estado) => ({
  Pendiente: 'PENDIENTE',
  'En preparación': 'PREPARANDO',
  'En preparacion': 'PREPARANDO',
  Listo: 'LISTO',
  Entregado: 'ENTREGADO',
  Completado: 'PAGADO',
  Pagado: 'PAGADO',
  Cancelado: 'CANCELADO',
}[estado] || estado);

const isToday = (date) => new Date(date).toDateString() === new Date().toDateString();

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const modifierLabel = (mod) => `${mod.nombre}${Number(mod.precio_extra || 0) ? ` +${money(mod.precio_extra)}` : ''}`;

const isPickupOrder = (order) => !order?.mesa_id || ['Para llevar', 'Delivery'].includes(order?.tipo);
const orderTargetLabel = (order) => (
  isPickupOrder(order)
    ? `${order?.tipo === 'Delivery' ? 'Delivery' : 'Para llevar'} #${order?.id || '-'} ${order?.cliente_nombre || ''}`.trim()
    : `Mesa ${order?.mesa_numero || order?.mesa_id || '-'}`
);
const orderPickupDetail = (order) => {
  if (!isPickupOrder(order)) return '';
  if (order?.tipo === 'Delivery') {
    return [
      order.delivery_telefono,
      order.delivery_direccion,
      order.delivery_referencia,
      order.cliente_dato,
    ].filter(Boolean).join(' - ') || 'Delivery';
  }
  return order?.cliente_dato || 'Para recoger';
};

const COLUMNS = [
  { key: 'PENDIENTE', title: 'Nuevos', icon: Bell, action: 'Tomar orden', next: 'PREPARANDO' },
  { key: 'PREPARANDO', title: 'Preparando', icon: Soup, action: 'Despachar', next: 'LISTO' },
  { key: 'LISTO', title: 'Listos (Entrega)', icon: CheckCircle2, action: null, next: null },
  { key: 'ENTREGADO', title: 'Historial', icon: Printer, action: null, next: null },
];

const BlinkingTicket = ({ children, isSOS }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop;
    if (isSOS) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true })
        ])
      );
      loop.start();
    } else {
      fadeAnim.setValue(1);
    }
    return () => loop && loop.stop();
  }, [isSOS, fadeAnim]);

  return <Animated.View style={{ opacity: fadeAnim }}>{children}</Animated.View>;
};

export default function KitchenApp() {
  const { logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const { width } = useWindowDimensions();
  const colors = isDark ? UI_COLORS.dark : UI_COLORS.light;

  const isWide = width >= 1100;
  const isCompact = width < 900;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [viewMode, setViewMode] = useState('tickets'); 
  const [sosOrdersList, setSosOrdersList] = useState(new Set());
  
  const [toast, setToast] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');

  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const isMutedRef = useRef(isMuted);
  const prevPendingIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  const realtimeStatusRef = useRef('connecting');

  useEffect(() => {
    installWebAudioUnlock();
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const showToast = (title, message, isError = false) => {
    setToast({ title, message, isError });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/pedidos?history=1`);
      setOrders(res.data || []);
      setLastRefresh(new Date());
    } catch (error) {
      if (!silent) showToast('Error de conexión', error.response?.data?.message || 'Revisa el backend.', true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const timer = setInterval(() => loadOrders(true), 15000);
    const client = getRealtimeSocket();
    const onConnect = () => {
      setRealtimeStatus('connected');
      loadOrders(true);
    };
    const onDisconnect = () => setRealtimeStatus('disconnected');
    const onConnectError = () => setRealtimeStatus('error');

    setRealtimeStatus(client.connected ? 'connected' : 'connecting');
    client.on('connect', onConnect);
    client.on('disconnect', onDisconnect);
    client.on('connect_error', onConnectError);

    const unsubscribers = [
      subscribeRealtime(REALTIME_EVENTS.ORDER_CREATED, () => loadOrders(true)),
      subscribeRealtime(REALTIME_EVENTS.ORDER_UPDATED, () => loadOrders(true)),
      subscribeRealtime(REALTIME_EVENTS.PRINT_COMANDA, () => loadOrders(true)),
    ];
    return () => {
      clearInterval(timer);
      client.off('connect', onConnect);
      client.off('disconnect', onDisconnect);
      client.off('connect_error', onConnectError);
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, []);

  const prepMinutes = (order) => {
    const start = order.preparando_at || order.created_at;
    return Math.max(0, Math.round((Date.now() - new Date(start).getTime()) / 60000));
  };

  useEffect(() => {
    const currentSos = new Set();
    let newSosDetected = false;

    orders.forEach(o => {
      const state = normalize(o.estado);
      const isOrderToday = isToday(o.created_at);
      
      if (isOrderToday && (state === 'PENDIENTE' || state === 'PREPARANDO')) {
        if (prepMinutes(o) >= 20) {
          currentSos.add(o.id);
          if (!sosOrdersList.has(o.id)) newSosDetected = true;
        }
      }
    });

    if (newSosDetected && !isMutedRef.current && audioEnabled) {
      if (Platform.OS === 'web') {
        playWebAlertTone({ ...ALERT_TONES.SYNC_ERROR, frequencies: [988, 784, 988], type: 'triangle', volume: 0.28 });
      } else {
        Vibration.vibrate([500, 500, 500]);
      }
    }
    setSosOrdersList(currentSos);
  }, [orders, audioEnabled]);

  const tableCounts = useMemo(() => {
    const counts = {};
    orders.forEach(o => {
      const state = normalize(o.estado);
      const isOrderToday = isToday(o.created_at);
      const hasItems = (o.items || []).some((item) => Number(item.cantidad || 0) > 0);
      if (hasItems && isOrderToday && ['PENDIENTE', 'PREPARANDO', 'LISTO'].includes(state)) {
        const tableId = orderTargetLabel(o);
        counts[tableId] = (counts[tableId] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const grouped = useMemo(() => {
    const result = { PENDIENTE: [], PREPARANDO: [], LISTO: [], ENTREGADO: {} };
    for (const order of orders) {
      const state = normalize(order.estado);
      const isOrderToday = isToday(order.created_at);
      const hasItems = (order.items || []).some((item) => Number(item.cantidad || 0) > 0);
      if (!hasItems) continue;

      if (state === 'PAGADO' || state === 'ENTREGADO' || state === 'CANCELADO' || !isOrderToday) {
        let dayStr = 'Hoy';
        if (!isOrderToday) {
          const d = new Date(order.created_at);
          dayStr = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
          dayStr = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
        }
        if (!result.ENTREGADO[dayStr]) result.ENTREGADO[dayStr] = [];
        result.ENTREGADO[dayStr].push(order);
      } else if (result[state]) {
        result[state].push(order);
      }
    }
    return result;
  }, [orders]);

  useEffect(() => {
    const pendingOrders = grouped.PENDIENTE || [];
    const currentPendingIds = new Set(pendingOrders.map((order) => Number(order.id)));
    
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      prevPendingIds.current = currentPendingIds;
      return;
    }

    const newOrders = pendingOrders.filter((order) => !prevPendingIds.current.has(Number(order.id)));

    if (newOrders.length) {
      if (!isMutedRef.current && audioEnabled) {
        if (Platform.OS === 'web') {
          const hasPickup = newOrders.some(isPickupOrder);
          playWebAlertTone(hasPickup ? ALERT_TONES.PICKUP_NEW : ALERT_TONES.ORDER_NEW);
        } else {
          Vibration.vibrate([200, 100, 200]);
        }
      }
      const hasPickup = newOrders.some(isPickupOrder);
      showToast(
        hasPickup ? 'Nuevo pedido para llevar/delivery' : 'Nuevo pedido de mesa',
        newOrders.map(orderTargetLabel).slice(0, 2).join(', ')
      );
    }
    prevPendingIds.current = currentPendingIds;
  }, [grouped.PENDIENTE, audioEnabled]);

  useEffect(() => {
    const previous = realtimeStatusRef.current;
    realtimeStatusRef.current = realtimeStatus;
    if (previous === realtimeStatus || realtimeStatus === 'connected' || realtimeStatus === 'connecting') return;

    if (!isMutedRef.current && audioEnabled && Platform.OS === 'web') {
      playWebAlertTone(ALERT_TONES.SYNC_ERROR);
    }
    showToast(
      'Error de sincronizacion',
      realtimeStatus === 'error' ? 'No se pudo conectar con el servidor.' : 'La cocina perdio conexion en tiempo real.',
      true
    );
  }, [realtimeStatus, audioEnabled]);

  const updateOrder = async (id, estado) => {
    try {
      await axios.put(`${BASE_URL}/pedidos/${id}`, { estado });
      await loadOrders(true);
    } catch (error) {
      showToast('Error', error.response?.data?.message || 'No se pudo actualizar.', true);
    }
  };

  const pingWaiter = async (order) => {
    try {
      await axios.post(`${BASE_URL}/pedidos/${order.id}/ping`).catch(() => {}); 
      showToast('¡Aviso Enviado!', `Se notificó al mesero: ${orderTargetLabel(order)}.`);
    } catch (error) {
      showToast('Error', 'No se pudo enviar el aviso al mesero.', true);
    }
  };

  const printText = (text) => {
    showToast('Imprimiendo', 'Enviando comanda a impresora...');
  };

  const printAllPending = () => {
    if (grouped.PENDIENTE.length + grouped.PREPARANDO.length === 0) {
      showToast('Sin comandas', 'No hay comandas pendientes para imprimir.', true);
      return;
    }
    printText('Impresión por lotes enviada');
  };

  const batchItems = useMemo(() => {
    const itemsMap = {};
    orders.forEach(order => {
      const state = normalize(order.estado);
      const isOrderToday = isToday(order.created_at);
      
      if (isOrderToday && (state === 'PENDIENTE' || state === 'PREPARANDO')) {
        (order.items || []).forEach(item => {
          const modsString = (item.modificadores || []).map(m => modifierLabel(m)).sort().join(' | ');
          const key = `${item.nombre}::${item.notas || ''}::${modsString}`;
          if (!itemsMap[key]) {
            itemsMap[key] = { id: key, nombre: item.nombre, notas: item.notas, modificadores: item.modificadores || [], cantidad: 0, mesas: new Set() };
          }
          itemsMap[key].cantidad += Number(item.cantidad || 0);
          itemsMap[key].mesas.add(orderTargetLabel(order));
        });
      }
    });
    return Object.values(itemsMap).sort((a, b) => b.cantidad - a.cantidad);
  }, [orders]);

  const stats = {
    nuevos: grouped.PENDIENTE.length,
    prep: grouped.PREPARANDO.length,
    listos: grouped.LISTO.length,
    completados: (grouped.ENTREGADO['Hoy'] || []).length, 
  };

  const elapsed = (createdAt) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000));
    if (mins < 1) return 'Hace segs';
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `Hace ${hours}h ${remainingMins}m`;
    }
    return `Hace ${mins} min`;
  };

  const kitchenSemaphore = (order) => {
    const state = normalize(order.estado);
    if (state !== 'PREPARANDO' && state !== 'PENDIENTE') return { borderColor: colors.line, backgroundColor: colors.surface, borderWidth: 1 };
    
    const mins = prepMinutes(order);
    if (mins >= 20) return { borderColor: colors.danger, backgroundColor: isDark ? '#450A0A' : '#fee2e2', borderWidth: 2 };
    if (mins >= 15) return { borderColor: colors.danger, backgroundColor: isDark ? '#450A0A' : colors.danger + '1A', borderWidth: 2 };
    if (mins >= 10) return { borderColor: colors.warning, backgroundColor: colors.warningSoft, borderWidth: 2 };
    return { borderColor: colors.success, backgroundColor: colors.successSoft, borderWidth: 2 };
  };

  const getColColor = (key) => {
    if (key === 'PENDIENTE') return colors.danger;
    if (key === 'PREPARANDO') return colors.warning;
    if (key === 'LISTO') return colors.success;
    return colors.muted;
  };

  const renderMetric = (label, value, IconComponent, colorKey) => {
    const color = getColColor(colorKey);
    return (
      <View style={{ flexGrow: 1, flexBasis: isCompact ? '47%' : 150, minWidth: isCompact ? 0 : 150, backgroundColor: colors.surface, borderRadius: 12, padding: isCompact ? 10 : 16, borderWidth: 1, borderColor: colors.line, ...softShadow, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: isCompact ? 36 : 48, height: isCompact ? 36 : 48, borderRadius: isCompact ? 10 : 16, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: `${color}1f` }}>
          <IconComponent size={isCompact ? 18 : 24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: isCompact ? 18 : 20, fontWeight: '900', color }}>{value}</Text>
          <Text style={{ fontWeight: '800', fontSize: isCompact ? 12 : 14, color: colors.ink }} numberOfLines={1}>{label}</Text>
        </View>
      </View>
    );
  };

  const renderOrder = (order, col) => {
    const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const semaphore = kitchenSemaphore(order);
    const colColor = getColColor(col.key);
    const isSOS = sosOrdersList.has(order.id);
    
    const tableId = orderTargetLabel(order);
    const isAdicional = tableCounts[tableId] > 1;

    return (
      <BlinkingTicket isSOS={isSOS} key={`ticket-${order.id}`}>
        <View style={{ borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: semaphore.borderWidth, borderColor: semaphore.borderColor, backgroundColor: semaphore.backgroundColor, ...softShadow }}>
          
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {isSOS && (
              <View style={{ backgroundColor: colors.danger, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                <Flame size={12} color={colors.onAccent} />
                <Text style={{ color: colors.onAccent, fontSize: 10, fontWeight: '900', marginLeft: 4 }}>RETRASO CRÍTICO</Text>
              </View>
            )}
            {isAdicional && (
              <View style={{ backgroundColor: colors.warningSoft, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.warning }}>
                <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '900' }}>+ ADICIONAL</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontWeight: '900', fontSize: 16, color: colColor }} numberOfLines={1}>{tableId}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 2 }}>{itemCount} productos</Text>
              {isPickupOrder(order) ? (
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, marginTop: 2 }} numberOfLines={1}>{orderPickupDetail(order)}</Text>
              ) : null}
            </View>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted }}>{new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>

          {!['PAGADO', 'CANCELADO', 'ENTREGADO'].includes(normalize(order.estado)) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Timer size={14} color={isSOS ? colors.danger : colColor} />
              <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '900', color: isSOS ? colors.danger : colColor }}>{elapsed(order.preparando_at || order.created_at)}</Text>
            </View>
          )}

          <View style={{ marginBottom: 12 }}>
            {(order.items || []).map((item, idx) => (
              <View key={`${order.id}-${idx}`} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>{item.cantidad}x {item.nombre}</Text>
                {(item.modificadores || []).map((mod) => (
                  <Text key={`${order.id}-${idx}-${mod.id || mod.nombre}`} style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginTop: 2, paddingLeft: 8 }}>{mod.tipo === 'EXTRA' ? '+' : mod.tipo === 'EXCLUSION' ? '-' : '*'} {modifierLabel(mod)}</Text>
                ))}
                {item.notas ? <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warning, marginTop: 2, paddingLeft: 8 }}>Nota: {item.notas}</Text> : null}
              </View>
            ))}
          </View>

          {order.notas ? (
            <View style={{ backgroundColor: colors.field, borderRadius: 10, padding: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{order.notas}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity onPress={() => printText('Imprimiendo')} style={{ borderRadius: 10, paddingHorizontal: 14, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line }}>
              <Printer size={16} color={colors.ink} />
            </TouchableOpacity>
            
            {normalize(order.estado) === 'LISTO' && (
               <TouchableOpacity onPress={() => pingWaiter(order)} style={{ flex: 1, minWidth: '40%', height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.info }}>
                 <Megaphone size={14} color={colors.info} />
                 <Text style={{ color: colors.info, fontSize: 12, fontWeight: '900', marginLeft: 6 }}>Avisar</Text>
               </TouchableOpacity>
            )}

            {col.action ? (
              <TouchableOpacity onPress={() => updateOrder(order.id, col.next)} style={{ flex: 1, minWidth: '40%', height: 40, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colColor }}>
                <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: '900' }}>{col.action}</Text>
              </TouchableOpacity>
            ) : (
              normalize(order.estado) !== 'LISTO' && (
                <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.muted }}>{normalize(order.estado)}</Text>
                </View>
              )
            )}
          </View>
        </View>
      </BlinkingTicket>
    );
  };

  const renderBatchCooking = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: isCompact ? 12 : 16, paddingBottom: BOTTOM_INSET + 32 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: isCompact ? 14 : 24, borderWidth: 1, borderColor: colors.line, ...modernShadow }}>
        <View style={{ flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'flex-start' : 'center', marginBottom: 24, borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center', marginRight: isCompact ? 0 : 16, marginBottom: isCompact ? 10 : 0 }}>
            <Layers size={24} color={colors.brand} />
          </View>
          <View style={{ minWidth: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink }}>Resumen de Plancha</Text>
            <Text style={{ fontSize: 14, color: colors.muted, fontWeight: '600', marginTop: 2 }}>Total de productos agrupados (Nuevos + Preparando)</Text>
          </View>
        </View>

        {batchItems.length === 0 ? (
           <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <CheckCircle2 size={64} color={colors.line} />
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 16 }}>Todo bajo control</Text>
              <Text style={{ color: colors.muted, fontWeight: '600', marginTop: 8 }}>No hay productos pendientes por preparar.</Text>
           </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {batchItems.map(item => (
              <View key={item.id} style={{ flexBasis: isCompact ? '100%' : '48%', flexGrow: 1, minWidth: 0, backgroundColor: colors.field, borderRadius: 14, padding: isCompact ? 12 : 16, borderWidth: 1, borderColor: colors.line }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <View style={{ flex: 1, paddingRight: 16 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink }}>{item.nombre}</Text>
                      {item.notas ? (
                        <View style={{ backgroundColor: colors.warningSoft, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.warning }}>Nota: {item.notas}</Text>
                        </View>
                      ) : null}
                      {item.modificadores.length > 0 ? (
                        <View style={{ marginTop: 8 }}>
                          {item.modificadores.map((mod, idx) => (
                             <Text key={idx} style={{ fontSize: 13, color: colors.muted, fontWeight: '700', marginTop: 2 }}>• {modifierLabel(mod)}</Text>
                          ))}
                        </View>
                      ) : null}
                   </View>
                   <View style={{ backgroundColor: colors.brand, borderRadius: 12, minWidth: 48, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', ...softShadow }}>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: colors.onAccent }}>{item.cantidad}</Text>
                   </View>
                </View>
                <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center' }}>
                   <Text style={{ fontSize: 13, color: colors.muted, fontWeight: '700' }}>Para Mesas: </Text>
                   <Text style={{ fontSize: 14, color: colors.ink, fontWeight: '900' }}>{Array.from(item.mesas).sort((a,b)=>a-b).join(', ')}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: TOP_INSET, backgroundColor: colors.pageBg }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: TOP_INSET, backgroundColor: colors.pageBg }}>
      
      {toast && (
        <View style={{ position: 'absolute', top: TOP_INSET + 10, alignSelf: 'center', zIndex: 100, elevation: 10 }}>
          <View style={{ backgroundColor: toast.isError ? colors.danger : colors.surface, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', ...modernShadow, minWidth: 280, maxWidth: '90%', borderWidth: 1, borderColor: toast.isError ? colors.danger : colors.line }}>
            {toast.isError ? <X size={18} color={colors.onAccent} /> : <CheckCircle2 size={18} color={colors.success} />}
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: toast.isError ? colors.onAccent : colors.ink }}>{toast.title}</Text>
              <Text style={{ fontSize: 12, color: toast.isError ? colors.onAccent : colors.muted, marginTop: 2 }}>{toast.message}</Text>
            </View>
          </View>
        </View>
      )}

      {/* HEADER */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.line, zIndex: 10 }}>
        <View style={{ flexDirection: isCompact ? 'column' : 'row', alignItems: isCompact ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isCompact ? 14 : 0, marginRight: isCompact ? 0 : 16, flexShrink: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.softOrange, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={22} color={colors.brand} />
            </View>
            <View style={{ marginLeft: 12, flexShrink: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.ink }} numberOfLines={1}>Cocina</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted }} numberOfLines={1}>Gestiona los pedidos</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }} style={isCompact ? { width: '100%' } : { flexShrink: 0 }}>
            
            {!audioEnabled && (
              <TouchableOpacity onPress={() => { setAudioEnabled(true); unlockWebAudio().catch(() => null); showToast('Sonido Activado', 'Las alertas sonoras están listas.'); }} style={{ height: 40, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.success }}>
                <Play size={16} color={colors.success} />
                {!isCompact && <Text style={{ fontWeight: '900', fontSize: 13, marginLeft: 6, color: colors.success }}>Audio</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setIsMuted(!isMuted)} style={{ height: 40, width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isMuted ? colors.danger + '1A' : colors.field, borderWidth: 1, borderColor: isMuted ? colors.danger : colors.line }}>
              {isMuted ? <VolumeX size={18} color={colors.danger} /> : <Volume2 size={18} color={colors.ink} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setViewMode(viewMode === 'tickets' ? 'batch' : 'tickets')} style={{ height: 40, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: viewMode === 'batch' ? colors.softOrange : colors.field, borderWidth: 1, borderColor: viewMode === 'batch' ? colors.brand : colors.line }}>
              {viewMode === 'tickets' ? <Layers size={16} color={colors.brand} /> : <LayoutGrid size={16} color={colors.brand} />}
              {!isCompact && <Text style={{ fontWeight: '900', fontSize: 13, marginLeft: 6, color: viewMode === 'batch' ? colors.brand : colors.ink }}>{viewMode === 'tickets' ? 'Plancha' : 'Tickets'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={toggle} style={{ height: 40, width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line }}>
              {isDark ? <Sun size={18} color={colors.ink} /> : <Moon size={18} color={colors.ink} />}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => loadOrders()} style={{ height: 40, width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line }}>
              <RefreshCw size={18} color={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity onPress={printAllPending} style={{ height: 40, width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line }}>
              <Printer size={18} color={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity onPress={logout} style={{ height: 40, width: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#450A0A' : colors.danger }}>
              <LogOut size={18} color={colors.onAccent} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <View style={{ padding: isCompact ? 10 : 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{
          width: '100%',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: realtimeStatus === 'connected' ? colors.success : colors.warning,
          backgroundColor: realtimeStatus === 'connected' ? colors.successSoft : colors.warningSoft,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <View style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: realtimeStatus === 'connected' ? colors.success : colors.warning,
            marginRight: 10,
          }} />
          <Text style={{ color: colors.ink, fontWeight: '900', flex: 1 }}>
            {realtimeStatus === 'connected' ? 'Cocina sincronizada en tiempo real' : 'Reconectando cocina al servidor...'}
          </Text>
          <TouchableOpacity onPress={() => loadOrders(true)}>
            <Text style={{ color: colors.brand, fontWeight: '900' }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        {renderMetric('Nuevos', stats.nuevos, Flame, 'PENDIENTE')}
        {renderMetric('Preparando', stats.prep, Soup, 'PREPARANDO')}
        {renderMetric('Listos', stats.listos, PackageCheck, 'LISTO')}
        {renderMetric('Entregados', stats.completados, Printer, 'ENTREGADO')}
      </View>

      {/* SOLUCIÓN: Scroll adaptable. Si es móvil, se hace todo de forma vertical apilando las columnas */}
      {viewMode === 'batch' ? renderBatchCooking() : (
        <ScrollView 
          horizontal={!isCompact} 
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          decelerationRate="normal"
          contentContainerStyle={{ 
            paddingHorizontal: isCompact ? 12 : 16, 
            paddingBottom: BOTTOM_INSET + 32, 
            gap: 16,
            flexDirection: isCompact ? 'column' : 'row' 
          }}
          style={{ flex: 1 }}
        >
          {COLUMNS.map((col) => {
            const Icon = col.icon;
            const isHistory = col.key === 'ENTREGADO';
            const list = isHistory ? [] : (grouped[col.key] || []);
            const historyDays = isHistory ? Object.keys(grouped.ENTREGADO) : [];
            const itemsCount = isHistory ? Object.values(grouped.ENTREGADO).reduce((sum, arr) => sum + arr.length, 0) : list.length;
            const colColor = getColColor(col.key);
            
            // Función auxiliar para renderizar el listado
            const renderColContent = () => (
              <View style={{ paddingBottom: 10 }}>
                {isHistory ? (
                  historyDays.length > 0 ? (
                    historyDays.map(day => (
                      <View key={day} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                           <View style={{ height: 1, flex: 1, backgroundColor: colors.line }} />
                           <Text style={{ marginHorizontal: 10, fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' }}>{day}</Text>
                           <View style={{ height: 1, flex: 1, backgroundColor: colors.line }} />
                        </View>
                        {grouped.ENTREGADO[day].map((order) => renderOrder(order, col))}
                      </View>
                    ))
                  ) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }}>
                      <Clock size={32} color={colors.line} />
                      <Text style={{ fontWeight: '800', fontSize: 13, marginTop: 10, color: colors.muted }}>Sin historial</Text>
                    </View>
                  )
                ) : (
                  list.length ? list.map((order) => renderOrder(order, col)) : (
                    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 30 }}>
                      <Clock size={32} color={colors.line} />
                      <Text style={{ fontWeight: '800', fontSize: 13, marginTop: 10, color: colors.muted }}>Vacío</Text>
                    </View>
                  )
                )}
              </View>
            );

            return (
              <View key={col.key} style={{ 
                  width: isCompact ? '100%' : 360, 
                  flex: isCompact ? 0 : 1, // En móvil no ocupa flex 1, sino el tamaño de su contenido
                  borderRadius: 16, 
                  padding: 12, 
                  backgroundColor: colors.surface, 
                  borderWidth: 1, 
                  borderColor: colors.line, 
                  ...modernShadow 
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${colColor}1f`, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={colColor} />
                    </View>
                    <Text style={{ fontWeight: '900', fontSize: 15, marginLeft: 10, color: colors.ink }}>{col.title}</Text>
                  </View>
                  <View style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colColor }}>
                    <Text style={{ color: colors.onAccent, fontSize: 12, fontWeight: '900' }}>{itemsCount}</Text>
                  </View>
                </View>
                
                {/* En móvil no queremos ScrollView anidados horizontalmente ni verticalmente, dejamos fluir el contenido. En escritorio sí. */}
                {isCompact ? renderColContent() : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {renderColContent()}
                  </ScrollView>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {viewMode === 'tickets' && (
        <View style={{ 
          paddingHorizontal: 16, 
          paddingVertical: isCompact ? 10 : 12, 
          backgroundColor: colors.surface, 
          borderTopWidth: 1, 
          borderColor: colors.line,
          flexDirection: 'row',
          alignItems: 'center',
          paddingBottom: Platform.OS === 'ios' ? BOTTOM_INSET : 12
        }}>
          <Info size={16} color={colors.brand} style={{ marginRight: 10 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>
              <Text style={{ color: colors.success }}>Verde:</Text> 0-10m   •   
              <Text style={{ color: colors.warning }}> Amarillo:</Text> 10-15m   •   
              <Text style={{ color: colors.danger }}> Rojo:</Text> 15-20m   •   
              <Text style={{ color: colors.danger, fontWeight: '900' }}> Parpadeo:</Text> +20m
            </Text>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}
