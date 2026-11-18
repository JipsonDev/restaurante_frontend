// Cocina (KDS) — dirección «Suave», la misma familia visual que la app del mesero.
// Tablet: tablero de 3 columnas (Nuevas · En preparación · Listas). Celular: pestañas con una columna.
// «Por plato» suma cada producto pendiente. Historial e impresión viven en hojas, no ocupan pantalla.
// Funciones: sonido y vibración al llegar rondas, semáforo según el límite de Ajustes › Atención,
// platos que se tachan, deslizar para avanzar, deshacer «Listo», avisar al mesero y pantalla siempre encendida.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import {
  BellRing, Check, ChefHat, History, Layers, LayoutGrid, LogOut, Moon, MoreHorizontal, Printer,
  RefreshCw, RotateCcw, Soup, Sun, Sunrise, Volume2, VolumeX, CheckCheck, Inbox, Ban, MapPin, Search, AlertTriangle,
} from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL, assetUrl, useAuth } from '../context/AuthContext';
import { MeseroAppearance, setBrandColor, useTheme } from '../theme';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';
import { ALERT_TONES, installWebAudioUnlock, isWebAudioUnlocked, playWebAlertTone, unlockWebAudio } from '../services/webAudioAlerts';
import { allDayItems, createRefreshQueue, isCriticalNote, kitchenBoard, kitchenRounds, pendingSignature, shortDuration, waitMinutes } from '../utils/kitchenLogic.mjs';
import { KitchenTicket, itemDone, ticketTarget } from '../components/kitchen/ticket';
import { normalize as normalizeText } from '../utils/waiterFavorites.mjs';
import {
  Appear, BottomSheet, BrandMark, Button, Chip, ComandaToastProvider, ConnectionDot, EmptyState, IconButton, Num, Press, RollingNumber,
  Field, T, UnderlineTabs, elevate, haptic, radius, space, useComandaFonts, useComandaToast,
} from '../components/waiter/kit';

// Estación de un plato: la del producto o «Cocina» si no tiene.
const GENERAL = 'Cocina';
const stationOf = item => item?.estacion || GENERAL;

const WEB = Platform.OS === 'web';
const COLS = [
  { key: 'PENDIENTE', title: 'Nuevas', short: 'Nuevas', hint: 'Toca «Empezar» o desliza →', tone: 'primary' },
  { key: 'PREPARANDO', title: 'En preparación', short: 'En curso', hint: 'Tacha los platos; «Listo» avisa al mesero', tone: 'amber' },
  { key: 'LISTO', title: 'Listas para servir', short: 'Listas', hint: 'Esperando al mesero', tone: 'green' },
];
const NEW_MS = 90000; // una ronda se marca «Nueva» durante 90 s

// Pantalla siempre encendida (Wake Lock API). Se vuelve a pedir al regresar a la pestaña.
function useWakeLock(enabled) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!WEB || typeof navigator === 'undefined' || !navigator.wakeLock || !enabled) { setActive(false); return undefined; }
    let lock = null; let cancelled = false;
    const request = async () => {
      try { lock = await navigator.wakeLock.request('screen'); if (!cancelled) setActive(true); lock.addEventListener?.('release', () => setActive(false)); }
      catch { setActive(false); }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); lock?.release?.().catch(() => {}); };
  }, [enabled]);
  return { supported: WEB && typeof navigator !== 'undefined' && !!navigator.wakeLock, active };
}

function Kitchen() {
  useComandaFonts();
  const { c, isDark, toggle: toggleTheme } = useTheme();
  const { logout } = useAuth();
  const toast = useComandaToast();
  const { width } = useWindowDimensions();
  const board3 = width >= 900;
  const [brand, setBrand] = useState({ name: '', logo: null });
  const phone = width < 600;
  const pad = phone ? 12 : 20;

  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState('tablero'); // tablero | platos
  const [tab, setTab] = useState('PENDIENTE');
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('mm-kds-muted') === '1'; } catch { return false; } });
  const [keepAwake, setKeepAwake] = useState(() => { try { return localStorage.getItem('mm-kds-awake') !== '0'; } catch { return true; } });
  const [limits, setLimits] = useState({ espera: 20, lista: 5, activas: true });
  const [realtime, setRealtime] = useState('connecting');
  const [busy, setBusy] = useState(() => new Set());
  const [optimistic, setOptimistic] = useState({}); // ronda -> estado mientras responde el servidor
  const [newIds, setNewIds] = useState({}); // ronda -> hora de llegada
  const [printStatus, setPrintStatus] = useState(null);
  const [sheet, setSheet] = useState(null); // 'menu' | 'historial' | 'impresion' | 'estacion' | 'agotados'
  const [station, setStation] = useState(() => { try { return localStorage.getItem('mm-kds-estacion') || 'Todas'; } catch { return 'Todas'; } });
  useEffect(() => { try { localStorage.setItem('mm-kds-estacion', station); } catch {} }, [station]);
  const [itemOpt, setItemOpt] = useState({}); // plato -> listo mientras responde el servidor
  const [products, setProducts] = useState([]);
  const [productQuery, setProductQuery] = useState('');
  const [toSoldOut, setToSoldOut] = useState(null); // plato elegido con pulsación larga
  const refreshQueue = useRef(null);
  const prevSignatures = useRef(null);
  const lateSeen = useRef(new Set());
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; try { localStorage.setItem('mm-kds-muted', muted ? '1' : '0'); } catch {} }, [muted]);
  useEffect(() => { try { localStorage.setItem('mm-kds-awake', keepAwake ? '1' : '0'); } catch {} }, [keepAwake]);
  const wake = useWakeLock(keepAwake);

  const sound = useCallback(tone => {
    if (mutedRef.current) return;
    if (WEB) playWebAlertTone(tone);
  }, []);

  // ── Datos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    installWebAudioUnlock();
    refreshQueue.current = createRefreshQueue(
      async () => {
        const { data } = await axios.get(`${BASE_URL}/pedidos?cocina=1`);
        if (!Array.isArray(data)) throw new Error('Respuesta de pedidos inválida.');
        return data;
      },
      data => { setRounds(kitchenRounds(data)); setLoadError(false); setLoading(false); setOptimistic({}); setItemOpt({}); },
      () => { setLoadError(true); setLoading(false); },
    );
    const load = () => refreshQueue.current?.refresh();
    load();
    axios.get(`${BASE_URL}/configuracion`).then(({ data }) => {
      setLimits({ espera: Number(data?.alerta_espera_minutos) || 20, lista: Number(data?.alerta_lista_minutos) || 5, activas: String(data?.alertas_demora_activas ?? '1') !== '0' });
      setBrandColor(data?.color_marca || null);
      setBrand({ name: data?.nombre_restaurante || '', logo: data?.logo_url ? assetUrl(data.logo_url) : null });
    }).catch(() => {});
    const loadPrint = () => axios.get(`${BASE_URL}/impresiones/estado`).then(({ data }) => setPrintStatus(data)).catch(() => setPrintStatus(s => s ? { ...s, error: true } : { error: true }));
    loadPrint();
    const poll = setInterval(() => { load(); loadPrint(); }, 20000);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    const client = getRealtimeSocket();
    const onConnect = () => { setRealtime('connected'); load(); };
    const onDisconnect = () => setRealtime('disconnected');
    const onError = () => setRealtime('error');
    setRealtime(client.connected ? 'connected' : 'connecting');
    client.on('connect', onConnect); client.on('disconnect', onDisconnect); client.on('connect_error', onError);
    const loadProducts = () => axios.get(`${BASE_URL}/productos`).then(({ data }) => Array.isArray(data) && setProducts(data)).catch(() => {});
    loadProducts();
    const unsub = [REALTIME_EVENTS.ORDER_CREATED, REALTIME_EVENTS.ORDER_UPDATED, REALTIME_EVENTS.PRINT_COMANDA].map(ev => subscribeRealtime(ev, () => load()));
    unsub.push(subscribeRealtime(REALTIME_EVENTS.CATALOG_UPDATED, (payload = {}) => {
      if (payload.action === 'stock' && Array.isArray(payload.productos)) {
        const byId = new Map(payload.productos.map(p => [Number(p.producto_id), Number(p.stock_disponible)]));
        setProducts(prev => prev.map(p => byId.has(Number(p.id)) ? { ...p, stock_disponible: byId.get(Number(p.id)) } : p));
        return;
      }
      if (!payload.producto_id) return;
      setProducts(prev => prev.map(p => Number(p.id) === Number(payload.producto_id) ? { ...p, agotado: payload.agotado ? 1 : 0 } : p));
    }));
    return () => {
      clearInterval(poll); clearInterval(clock); refreshQueue.current?.stop();
      client.off('connect', onConnect); client.off('disconnect', onDisconnect); client.off('connect_error', onError);
      unsub.forEach(u => u && u());
    };
  }, []);

  const live = useMemo(() => rounds.map(r => optimistic[r.id] ? { ...r, estado: optimistic[r.id] } : r), [rounds, optimistic]);
  // Estaciones conocidas: las de los productos y las de los platos en curso.
  const stations = useMemo(() => {
    const set = new Set([GENERAL]);
    products.forEach(p => p.estacion && set.add(p.estacion));
    live.forEach(r => (r.items || []).forEach(i => i.estacion && set.add(i.estacion)));
    return [...set].sort((a, b) => a === GENERAL ? -1 : b === GENERAL ? 1 : a.localeCompare(b, 'es'));
  }, [products, live]);
  // Con una estación elegida, cada ronda muestra solo sus platos; si no tiene ninguno, no aparece.
  // Su columna depende de esos platos: todos listos → «Listas», aunque el resto de la ronda siga en cocina.
  const scoped = useMemo(() => {
    if (station === 'Todas') return live;
    return live.map(r => {
      const items = (r.items || []).filter(i => stationOf(i) === station && Number(i.cantidad || 0) > 0);
      if (!items.length) return null;
      const st = String(r.estado).toUpperCase();
      let estado = st;
      if (st === 'PREPARANDO' || st === 'LISTO') estado = items.every(i => itemDone(i, itemOpt)) ? 'LISTO' : 'PREPARANDO';
      return { ...r, estado, items, _roundEstado: st };
    }).filter(Boolean);
  }, [live, station, itemOpt]);
  const board = useMemo(() => kitchenBoard(scoped), [scoped]);
  const dishes = useMemo(() => allDayItems(scoped, ticketTarget), [scoped]);
  const counts = { PENDIENTE: board.PENDIENTE.length, PREPARANDO: board.PREPARANDO.length, LISTO: board.LISTO.length };
  // «2ª ronda» solo cuando otra ronda de la misma cuenta está en OTRA columna (si no, es ruido).
  const splitAccount = useMemo(() => {
    const cols = {};
    for (const [k, list] of Object.entries({ PENDIENTE: board.PENDIENTE, PREPARANDO: board.PREPARANDO, LISTO: board.LISTO })) for (const r of list) (cols[r.pedido_id] ||= new Set()).add(k);
    return id => (cols[id]?.size || 0) > 1;
  }, [board]);
  const entered = useRef(new Set()); // rondas que ya hicieron su entrada (no se repite al cambiar de columna o vista)
  const [audioReady, setAudioReady] = useState(isWebAudioUnlocked());
  useEffect(() => {
    if (audioReady || typeof window === 'undefined') return undefined;
    const check = () => setTimeout(() => setAudioReady(isWebAudioUnlocked()), 60);
    window.addEventListener('pointerdown', check); window.addEventListener('keydown', check);
    return () => { window.removeEventListener('pointerdown', check); window.removeEventListener('keydown', check); };
  }, [audioReady]);

  const prevStation = useRef(station);
  // Llegan rondas nuevas: sonido, vibración, aviso y marca «Nueva».
  useEffect(() => {
    if (loading) return;
    const sigs = new Set(board.PENDIENTE.map(pendingSignature));
    // Cambiar de estación no es «llegar»: se reinicia la referencia sin sonar.
    if (prevStation.current !== station) { prevStation.current = station; prevSignatures.current = sigs; return; }
    if (prevSignatures.current) {
      const fresh = board.PENDIENTE.filter(r => !prevSignatures.current.has(pendingSignature(r)));
      if (fresh.length) {
        const pickup = fresh.some(r => !r.mesa_id);
        sound(pickup ? ALERT_TONES.PICKUP_NEW : ALERT_TONES.ORDER_NEW);
        const at = Date.now();
        setNewIds(prev => { const n = { ...prev }; fresh.forEach(r => { n[r.id] = at; }); return n; });
        toast.show(fresh.length === 1 ? `Nueva ronda: ${ticketTarget(fresh[0])}` : `${fresh.length} rondas nuevas`, {
          tone: 'success', icon: BellRing, detail: fresh.length > 1 ? fresh.slice(0, 3).map(ticketTarget).join(' · ') : `${(fresh[0].items || []).reduce((s, i) => s + Number(i.cantidad || 0), 0)} platos`,
          action: board3 || tab === 'PENDIENTE' ? undefined : { label: 'Ver', onPress: () => setTab('PENDIENTE') },
        });
      }
    }
    prevSignatures.current = sigs;
  }, [board.PENDIENTE, loading, station]);

  // Se olvida la marca «Nueva» pasado un rato.
  useEffect(() => { setNewIds(prev => { const n = {}; for (const [k, t] of Object.entries(prev)) if (now - t < NEW_MS) n[k] = t; return Object.keys(n).length === Object.keys(prev).length ? prev : n; }); }, [now]);

  // Demora: una alerta por ronda cuando pasa el límite configurado.
  const lateReady = useRef(false); // las que ya venían tarde al abrir la pantalla no suenan
  useEffect(() => {
    if (!limits.activas || loading) return;
    for (const r of [...board.PENDIENTE, ...board.PREPARANDO]) {
      if (waitMinutes(r, now) >= limits.espera && !lateSeen.current.has(r.id)) {
        lateSeen.current.add(r.id);
        if (lateReady.current) {
          sound({ ...ALERT_TONES.SYNC_ERROR, frequencies: [988, 784, 988], type: 'triangle', volume: 0.28 });
          haptic('warning');
          toast.show(`${ticketTarget(r)} pasa de ${limits.espera} min`, { tone: 'warning', icon: History });
        }
      }
    }
    lateReady.current = true;
  }, [now, board.PENDIENTE, board.PREPARANDO, limits, loading]);

  // ── Acciones ─────────────────────────────────────────────────────────────
  const setBusyFor = (id, on) => setBusy(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  const move = useCallback(async (r, estado, { quiet } = {}) => {
    if (busy.has(r.id)) return false;
    setBusyFor(r.id, true);
    setOptimistic(prev => ({ ...prev, [r.id]: estado })); // la tarjeta cambia de columna al instante
    try {
      await axios.put(`${BASE_URL}/pedidos/${r.pedido_id}/rondas/${r.ronda_id || r.id}`, { estado });
      return true;
    } catch (error) {
      setOptimistic(prev => { const n = { ...prev }; delete n[r.id]; return n; });
      if (!quiet) toast.show(error.response?.data?.message || 'No se pudo actualizar la ronda.', { tone: 'error' });
      return false;
    } finally {
      setBusyFor(r.id, false);
      refreshQueue.current?.refresh();
    }
  }, [busy]);

  const start = r => move(r, 'PREPARANDO');
  // Marca o desmarca platos sueltos en el servidor (se ve igual en todas las tablets).
  const setItems = useCallback(async (r, ids, listo, { quiet } = {}) => {
    if (!ids.length) return null;
    setItemOpt(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = listo; }); return n; });
    try {
      const { data } = await axios.put(`${BASE_URL}/pedidos/${r.pedido_id}/rondas/${r.ronda_id || r.id}/platos`, { ids, listo });
      return data;
    } catch (error) {
      setItemOpt(prev => { const n = { ...prev }; ids.forEach(id => { delete n[id]; }); return n; });
      if (!quiet) toast.show(error.response?.data?.message || 'No se pudo marcar el plato.', { tone: 'error' });
      return null;
    } finally { refreshQueue.current?.refresh(); }
  }, []);
  const toggleItem = async (r, item) => {
    const next = !itemDone(item, itemOpt);
    const data = await setItems(r, [item.id], next);
    if (data?.ronda_lista && station === 'Todas') toast.show(`${ticketTarget(r)} lista`, { tone: 'success', icon: CheckCheck, detail: 'Todos los platos listos · se avisó al mesero', action: { label: 'Deshacer', onPress: () => setItems(r, [item.id], false) } });
  };
  // Con estación: «Marcar lista» marca solo los platos de esa estación.
  const markReady = async r => {
    if (station !== 'Todas') {
      const ids = (r.items || []).filter(i => !itemDone(i, itemOpt)).map(i => i.id);
      const data = await setItems(r, ids, true);
      if (data) toast.show(`${station}: ${ticketTarget(r)} lista`, { tone: 'success', icon: CheckCheck, detail: data.ronda_lista ? 'Ronda completa · se avisó al mesero' : 'Se avisó al mesero de estos platos', action: { label: 'Deshacer', onPress: () => setItems(r, ids, false) } });
      return;
    }
    const ok = await move(r, 'LISTO');
    if (!ok) return false;
    toast.show(`${ticketTarget(r)} lista`, { tone: 'success', icon: CheckCheck, detail: 'Se avisó al mesero', action: { label: 'Deshacer', onPress: () => recall(r) } });
    return true;
  };
  const recall = async r => {
    if (station !== 'Todas') { const data = await setItems(r, (r.items || []).map(i => i.id), false); if (data) toast.show(`${ticketTarget(r)} volvió a preparación`, { icon: RotateCcw }); return; }
    const ok = await move(r, 'PREPARANDO'); if (ok) toast.show(`${ticketTarget(r)} volvió a preparación`, { icon: RotateCcw });
  };
  // Agotado: el mesero lo ve al instante como «Agotado» y no se puede pedir.
  const setSoldOut = async (productId, agotado) => {
    setProducts(prev => prev.map(p => Number(p.id) === Number(productId) ? { ...p, agotado: agotado ? 1 : 0 } : p));
    try {
      const { data } = await axios.put(`${BASE_URL}/productos/${productId}/agotado`, { agotado });
      haptic(agotado ? 'warning' : 'success');
      toast.show(agotado ? `${data.nombre} agotado` : `${data.nombre} disponible otra vez`, { tone: agotado ? 'warning' : 'success', icon: Ban, detail: agotado ? 'Los meseros ya lo ven como «Agotado»' : null,
        action: { label: 'Deshacer', onPress: () => setSoldOut(productId, !agotado) } });
    } catch (error) {
      setProducts(prev => prev.map(p => Number(p.id) === Number(productId) ? { ...p, agotado: agotado ? 0 : 1 } : p));
      toast.show(error.response?.data?.message || 'No se pudo cambiar el producto.', { tone: 'error' });
    }
  };
  const ping = async r => {
    if (busy.has(r.id)) return;
    setBusyFor(r.id, true);
    try { await axios.post(`${BASE_URL}/pedidos/${r.pedido_id}/ping`); toast.show(`Aviso enviado: ${ticketTarget(r)}`, { tone: 'success', icon: BellRing }); }
    catch (error) { toast.show(error.response?.data?.message || 'No se pudo avisar al mesero.', { tone: 'error' }); }
    finally { setBusyFor(r.id, false); }
  };
  const [printing, setPrinting] = useState(false);
  const print = async list => {
    if (printing || !list.length) { if (!list.length) toast.show('No hay comandas pendientes para imprimir.', { tone: 'warning' }); return; }
    setPrinting(true); let sent = 0;
    try {
      for (const r of list) { await axios.post(`${BASE_URL}/pedidos/${r.pedido_id}/imprimir-comanda`, { ronda_id: r.ronda_id || r.id }); sent += 1; }
      toast.show(sent === 1 ? 'Comanda enviada a la impresora' : `${sent} comandas enviadas a la impresora`, { tone: 'success', icon: Printer });
    } catch (error) { toast.show(`${sent} enviadas. ${error.response?.data?.message || 'No se pudieron enviar las demás.'}`, { tone: 'error' }); }
    finally { setPrinting(false); }
  };
  const printErrors = Number(printStatus?.counts?.ERROR || 0) + Number(printStatus?.counts?.REVISAR || 0);

  const colTone = key => key === 'PENDIENTE' ? c.primary : key === 'PREPARANDO' ? c.amber : c.green;
  // ── Piezas ───────────────────────────────────────────────────────────────
  const ticket = r => {
    const state = String(r.estado).toUpperCase();
    const isBusy = busy.has(r.id);
    const fresh = state === 'PENDIENTE' && !!newIds[r.id];
    const animateIn = fresh && !entered.current.has(r.id);
    if (fresh) entered.current.add(r.id);
    const common = { key: r.id, round: r, items: r.items, now, limit: limits.espera, listoLimit: limits.lista, busy: isBusy, isNew: fresh, animateIn, extraRound: splitAccount(r.pedido_id),
      optimistic: itemOpt, onToggleItem: toggleItem, onLongPressItem: item => setToSoldOut(item),
      station: station === 'Todas' && r._roundEstado == null ? null : station !== 'Todas' && r._roundEstado === 'PREPARANDO' && state === 'LISTO' ? 'El resto sigue en cocina' : null };
    const printBtn = { icon: Printer, label: `Imprimir comanda de ${ticketTarget(r)}`, onPress: () => print([r]) };
    if (state === 'PENDIENTE') return <KitchenTicket {...common} secondary={[printBtn]}
      action={{ label: 'Empezar', icon: Soup, variant: 'graphite', onPress: () => start(r) }}
      swipe={{ label: 'Empezar', icon: Soup, color: c.brandIsAlarm ? c.ink : c.primary, onSwipe: () => start(r) }} />;
    if (state === 'PREPARANDO') return <KitchenTicket {...common} secondary={[printBtn]}
      action={{ label: 'Marcar lista', allDoneLabel: 'Todo listo · avisar', icon: Check, variant: c.brandIsAlarm ? 'graphite' : 'primary', onPress: () => markReady(r) }}
      swipe={{ label: 'Lista', icon: Check, color: c.greenDot, onSwipe: () => markReady(r) }} />;
    return <KitchenTicket {...common} secondary={[{ icon: RotateCcw, text: 'Volver', label: `Volver a preparación: ${ticketTarget(r)}`, onPress: () => recall(r) }]}
      action={{ label: 'Avisar otra vez', icon: BellRing, variant: 'outline', style: { backgroundColor: c.bg }, onPress: () => ping(r) }} />;
  };

  const emptyFor = key => key === 'PENDIENTE'
    ? <EmptyState icon={Inbox} title="Sin rondas nuevas" description="Cuando un mesero envíe una ronda sonará y aparecerá aquí." />
    : key === 'PREPARANDO' ? <EmptyState icon={ChefHat} title="Nada en preparación" description="Toca «Empezar» en una ronda nueva." />
      : <EmptyState icon={CheckCheck} title="Todo servido" description="Las rondas listas esperan aquí al mesero." />;

  // Columna: título y número; los tickets apilados. Sin fondo ni bordes.
  const column = col => <View key={col.key} style={{ flex: 1, minWidth: 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 2, paddingTop: space.sm, paddingBottom: space.sm }}>
      <T size={16} weight="700" numberOfLines={1}>{col.title}</T>
      <RollingNumber value={counts[col.key]} size={15} weight="600" color={c.muted} />
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.sm, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
      {board[col.key].length ? board[col.key].map(r => <View key={r.id}>{ticket(r)}</View>) : emptyFor(col.key)}
    </ScrollView>
  </View>;
  // Una sola columna (tablet vertical o celular): tickets en cuadrícula de ~340 px, no a todo el ancho.
  const perRow = Math.max(1, Math.floor((width - pad * 2 + space.sm) / (340 + space.sm)));
  const ticketW = perRow > 1 ? Math.floor((width - pad * 2 - space.sm * (perRow - 1)) / perRow) : null;

  const dishCols = width >= 1300 ? 3 : board3 ? 2 : 1;
  const dishW = dishCols > 1 ? Math.floor((width - pad * 2 - space.md * (dishCols - 1)) / dishCols) : null;
  const dishesView = <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: pad, gap: space.md, paddingBottom: BOTTOM_INSET + 32, flexDirection: dishCols > 1 ? 'row' : 'column', flexWrap: dishCols > 1 ? 'wrap' : 'nowrap' }}>
    {!dishes.length ? <View style={{ width: '100%' }}><EmptyState icon={LayoutGrid} title="Nada por preparar" description="Aquí se suman los platos de todas las rondas nuevas y en preparación." /></View> : null}
    {dishes.map(d => <View key={d.key} style={dishW ? { width: dishW } : null}>
      <View style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }}>
        <View style={{ minWidth: 44, height: 44, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Num size={22} weight="800">{d.cantidad}</Num>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <T size={17} weight="700">{d.nombre}</T>
          {d.modificadores.length ? <T size={14} weight="600" color={c.muted}>{d.modificadores.join(' · ')}</T> : null}
          {d.notas ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{isCriticalNote(d.notas) ? <AlertTriangle size={14} color={c.red} /> : null}<T size={14} weight="700" color={isCriticalNote(d.notas) ? c.red : c.amber}>{d.notas}</T></View> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {d.destinos.map(x => <View key={x.nombre} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: c.bg }}>
              <T size={13} weight="600">{d.destinos.length === 1 ? x.nombre : `${x.nombre} · ${x.cantidad}`}</T>
            </View>)}
            {d.nuevas ? <T size={13} weight="700" style={{ alignSelf: 'center' }}>{d.nuevas} sin empezar</T> : null}
          </View>
        </View>
      </View>
    </View>)}
  </ScrollView>;

  // ── Pantalla ─────────────────────────────────────────────────────────────
  const conn = realtime === 'connected' && !loadError ? { state: 'live', label: 'En vivo' } : loadError || realtime === 'error' ? { state: 'offline', label: 'Sin conexión' } : { state: 'reconnecting', label: 'Reconectando…' };
  const header = <View style={{ paddingTop: TOP_INSET, backgroundColor: c.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingHorizontal: pad }}>
      {/* En celular no hay espacio: solo el logo (si hay). En tablet, logo o iniciales + nombre. */}
      {brand.logo || brand.name ? <BrandMark name={brand.name} logo={brand.logo} compact={width < 1000} height={phone ? 24 : 28} /> : null}
      <View style={{ flex: 1, minWidth: 64, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <T size={phone ? 18 : 20} weight="700" accessibilityRole="header" numberOfLines={1}>{station === 'Todas' ? 'Cocina' : station}</T>
        {conn.state !== 'live' ? <View accessibilityLabel={conn.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: conn.state === 'offline' ? c.red : c.amber }} />
          {!phone ? <T size={13} weight="600" color={conn.state === 'offline' ? c.red : c.amber}>{conn.label}</T> : null}
        </View> : null}
      </View>
      <Press accessibilityRole="button" accessibilityLabel={`Estación: ${station === 'Todas' ? 'todas' : station}. Cambiar`} onPress={() => setSheet('estacion')} hapticKind="tap" scaleTo={0.95}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: phone ? 10 : 14, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
        <MapPin size={16} color={c.text} />
        {!phone ? <T size={14} weight="600">{station === 'Todas' ? 'Todas las estaciones' : station}</T> : null}
      </Press>
      {!phone ? <View style={{ flexDirection: 'row', gap: 4 }}>
        {[['tablero', 'Tablero', Layers], ['platos', 'Por plato', LayoutGrid]].map(([k, l, I]) => <Chip key={k} selected={view === k} icon={I} onPress={() => setView(k)}>{l}</Chip>)}
      </View> : <IconButton icon={view === 'tablero' ? LayoutGrid : Layers} label={view === 'tablero' ? 'Ver por plato' : 'Ver tablero'} onPress={() => setView(view === 'tablero' ? 'platos' : 'tablero')} />}
      {muted && !phone ? <T size={14} weight="700" color={c.red}>Sin sonido</T> : null}
      <IconButton icon={muted ? VolumeX : Volume2} label={muted ? 'Activar sonido' : 'Silenciar'} color={muted ? c.red : c.text} onPress={() => { unlockWebAudio().then(() => setAudioReady(isWebAudioUnlocked())).catch(() => {}); setMuted(m => !m); }} />
      {!phone || printErrors ? <IconButton icon={Printer} label={printErrors ? `Impresión: ${printErrors} con error` : 'Impresión'} badge={printErrors || null} onPress={() => setSheet('impresion')} /> : null}
      {!phone ? <IconButton icon={History} label="Entregadas hoy" onPress={() => setSheet('historial')} /> : null}
      <IconButton icon={MoreHorizontal} label="Más opciones" onPress={() => setSheet('menu')} />
    </View>
    {!board3 && view === 'tablero' ? <View style={{ marginHorizontal: pad, marginBottom: space.sm }}>
      <UnderlineTabs items={COLS.map(col => ({ key: col.key, label: `${col.short} ${counts[col.key]}` }))} value={tab} onChange={setTab} />
    </View> : null}
  </View>;

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
    <ActivityIndicator size="large" color={c.primary} /><T color={c.muted}>Cargando la cocina…</T>
  </View>;

  const history = board.ENTREGADO.filter(r => new Date(String(r.created_at).replace(' ', 'T')).toDateString() === new Date().toDateString());
  const pendingToPrint = [...board.PENDIENTE, ...board.PREPARANDO];
  // Sin stock en inventario: agotado solo, sin que nadie lo marque (vuelve solo al reponer).
  const noStock = p => p.stock_disponible != null && Number(p.stock_disponible) <= 0;
  const soldOut = products.filter(p => Number(p.agotado) === 1 || noStock(p));
  const productList = products
    .filter(p => !productQuery || normalizeText(`${p.nombre} ${p.estacion || ''} ${p.categoria_nombre || ''}`).includes(normalizeText(productQuery)))
    .filter(p => station === 'Todas' || (p.estacion || GENERAL) === station || Number(p.agotado) === 1 || noStock(p))
    .sort((a, b) => Number(Number(b.agotado) === 1 || noStock(b)) - Number(Number(a.agotado) === 1 || noStock(a)) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const productOfItem = item => products.find(p => Number(p.id) === Number(item?.producto_id));
  const menuRow = (Icon, label, detail, onPress, tone) => <Press key={label} accessibilityRole="button" onPress={() => { setSheet(null); onPress(); }} hapticKind="tap"
    style={{ minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.sm, borderRadius: radius.md }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ width: 24, alignItems: 'center' }}><Icon size={20} color={tone || c.text} /></View>
    <View style={{ flex: 1 }}><T size={16} weight="500" color={tone || c.text}>{label}</T>{detail ? <T size={14} color={c.muted}>{detail}</T> : null}</View>
  </Press>;

  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    {header}
    {/* Tras recargar, el navegador no deja sonar hasta el primer toque: se avisa para que no lleguen rondas en silencio. */}
    {!audioReady && !muted ? <Press accessibilityRole="button" onPress={() => unlockWebAudio().then(() => setAudioReady(isWebAudioUnlocked())).catch(() => {})} scaleTo={0.99}
      style={{ marginHorizontal: pad, marginBottom: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: c.amberSoft, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <VolumeX size={18} color={c.amber} /><T size={14} weight="700" color={c.amber} style={{ flex: 1 }}>Toca aquí para activar el sonido de las rondas nuevas</T>
    </Press> : null}
    {loadError ? <Appear style={{ marginHorizontal: pad, marginBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingLeft: space.lg, borderRadius: radius.lg, backgroundColor: c.redSoft }}>
        <T size={14} weight="700" color={c.red} style={{ flex: 1 }}>No se pudo actualizar la cocina. Lo que ves puede estar desactualizado.</T>
        <Button size="sm" variant="primary" icon={RefreshCw} onPress={() => refreshQueue.current?.refresh()}>Reintentar</Button>
      </View>
    </Appear> : null}
    {view === 'platos' ? dishesView : board3
      ? <View style={{ flex: 1, flexDirection: 'row', gap: space.lg, paddingHorizontal: pad, paddingBottom: Math.max(BOTTOM_INSET, space.lg) }}>{COLS.map(column)}</View>
      : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: BOTTOM_INSET + 32, gap: space.md }}>
        {board[tab].length ? perRow > 1
          // Varias columnas apiladas (sin huecos por la altura de cada ticket).
          ? <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            {Array.from({ length: perRow }, (_, col) => <View key={col} style={{ flex: 1, minWidth: 0, gap: space.sm }}>
              {board[tab].filter((_, i) => i % perRow === col).map(r => <View key={r.id}>{ticket(r)}</View>)}
            </View>)}
          </View>
          : <View style={{ gap: space.sm }}>{board[tab].map(r => <View key={r.id}>{ticket(r)}</View>)}</View>
          : emptyFor(tab)}
      </ScrollView>}

    <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title="Cocina" subtitle={conn.label}>
      <View>
        {phone ? menuRow(History, 'Entregadas hoy', `${history.length} rondas`, () => setTimeout(() => setSheet('historial'), 250)) : null}
        {phone ? menuRow(Printer, 'Impresión de comandas', printErrors ? `${printErrors} con error` : 'Estado de la cola', () => setTimeout(() => setSheet('impresion'), 250)) : null}
        {menuRow(Ban, 'Agotar productos', `${soldOut.length ? `${soldOut.length} agotados ahora` : 'Marca lo que se acabó; los meseros lo ven al instante'}`, () => setTimeout(() => setSheet('agotados'), 250))}
        {menuRow(MapPin, 'Estación de esta tablet', station === 'Todas' ? 'Todas las estaciones' : station, () => setTimeout(() => setSheet('estacion'), 250))}
        {menuRow(Printer, 'Imprimir pendientes', `${pendingToPrint.length} comandas nuevas y en preparación`, () => print(pendingToPrint))}
        {wake.supported ? menuRow(Sunrise, keepAwake ? 'Pantalla siempre encendida: sí' : 'Pantalla siempre encendida: no', keepAwake ? (wake.active ? 'La tablet no se apagará sola' : 'Se activa al tocar la pantalla') : 'La tablet puede apagarse sola', () => setKeepAwake(v => !v)) : null}
        {menuRow(isDark ? Sun : Moon, isDark ? 'Usar tema claro' : 'Usar tema oscuro', null, toggleTheme)}
        {menuRow(RefreshCw, 'Actualizar', 'Vuelve a traer las rondas', () => refreshQueue.current?.refresh())}
      </View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      {menuRow(LogOut, 'Cerrar sesión', null, logout, c.red)}
    </BottomSheet>

    <BottomSheet visible={sheet === 'estacion'} onClose={() => setSheet(null)} title="Estación de esta tablet" subtitle="Cada tablet muestra solo los platos de su estación. Se guarda en este equipo.">
      <View style={{ gap: space.sm }}>
        {['Todas', ...stations].map(st => <Press key={st} accessibilityRole="radio" accessibilityState={{ checked: station === st }} onPress={() => { setStation(st); setSheet(null); haptic('select'); }} hapticKind={null}
          style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }}>
          <MapPin size={18} color={c.muted} />
          <View style={{ flex: 1 }}>
            <T size={16} weight="600">{st === 'Todas' ? 'Todas las estaciones' : st}</T>
            <T size={13} color={c.muted}>{st === 'Todas' ? 'Ve las rondas completas' : st === GENERAL ? 'Platos sin estación asignada' : `${products.filter(p => p.estacion === st).length} productos`}</T>
          </View>
          {station === st ? <Check size={20} color={c.text} strokeWidth={2.6} /> : null}
        </Press>)}
      </View>
      <T size={13} color={c.muted}>Las estaciones se asignan a cada producto en el panel de administración (Menú › editar producto › Estación).</T>
    </BottomSheet>

    <BottomSheet visible={sheet === 'agotados'} onClose={() => { setSheet(null); setProductQuery(''); }} title="Agotar productos" subtitle={soldOut.length ? `${soldOut.length} agotados · los meseros los ven como «Agotado»` : 'Toca un producto cuando se acabe; los meseros lo ven al instante.'}>
      <Field value={productQuery} onChangeText={setProductQuery} placeholder="Buscar producto" accessibilityLabel="Buscar producto para agotar" />
      <View style={{ gap: 6 }}>
        {productList.slice(0, 120).map(p => {
          const out = Number(p.agotado) === 1;
          const empty = !out && noStock(p);
          const units = Number(p.stock_disponible);
          return <Press key={p.id} accessibilityRole="switch" accessibilityState={{ checked: out || empty, disabled: empty }} disabled={empty}
            accessibilityLabel={`${p.nombre}: ${out ? 'agotado' : empty ? 'sin stock en inventario' : 'disponible'}`} onPress={() => setSoldOut(p.id, !out)} hapticKind={null}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} weight="600" numberOfLines={1} color={out || empty ? c.muted : c.text} style={out || empty ? { textDecorationLine: 'line-through' } : null}>{p.nombre}</T>
              <T size={13} color={c.muted} numberOfLines={1}>{empty ? 'Se acabó en inventario · vuelve solo al reponer' : [p.estacion || GENERAL, p.categoria_nombre, Number.isFinite(units) && units > 0 && units <= 5 ? `quedan ${units}` : null].filter(Boolean).join(' · ')}</T>
            </View>
            {out ? <View style={{ paddingHorizontal: 10, height: 30, borderRadius: radius.sm, justifyContent: 'center', backgroundColor: c.redFill }}>
              <T size={13} weight="700" color={c.onRed}>Agotado</T>
            </View> : empty ? <T size={13} weight="700" color={c.red}>Sin stock</T> : null}
          </Press>;
        })}
        {!productList.length ? <EmptyState icon={Search} title="Sin productos" description="Prueba con otro nombre." /> : null}
      </View>
    </BottomSheet>

    <BottomSheet visible={!!toSoldOut} onClose={() => setToSoldOut(null)} title={toSoldOut ? `¿Se acabó ${toSoldOut.nombre}?` : ''} subtitle="Los meseros lo verán como «Agotado» y no podrán pedirlo hasta que lo vuelvas a habilitar."
      footer={<View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button variant="outline" size="lg" style={{ flex: 1 }} onPress={() => setToSoldOut(null)}>Cancelar</Button>
        <Button variant="primary" size="lg" icon={Ban} style={{ flex: 2 }} onPress={() => { const prod = productOfItem(toSoldOut); setToSoldOut(null); if (prod) setSoldOut(prod.id, true); else toast.show('No se encontró el producto en el menú.', { tone: 'error' }); }}>Marcar agotado</Button>
      </View>}>{null}</BottomSheet>

    <BottomSheet visible={sheet === 'historial'} onClose={() => setSheet(null)} title="Entregadas hoy" subtitle={`${history.length} ${history.length === 1 ? 'ronda' : 'rondas'}`}>
      {history.length ? history.slice(0, 80).map(r => <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="800" numberOfLines={1}>{ticketTarget(r)}</T>
          <T size={13} color={c.muted} numberOfLines={1}>{(r.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(' · ')}</T>
        </View>
        <T size={13} weight="700" color={c.muted}>{new Date(String(r.created_at).replace(' ', 'T')).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</T>
      </View>) : <EmptyState icon={History} title="Aún no hay entregas hoy" />}
    </BottomSheet>

    <BottomSheet visible={sheet === 'impresion'} onClose={() => setSheet(null)} title="Impresión de comandas" subtitle="Cola automática del agente de impresión"
      footer={<Button variant="ink" size="lg" full icon={Printer} loading={printing} onPress={() => print(pendingToPrint)}>{`Imprimir pendientes (${pendingToPrint.length})`}</Button>}>
      {printStatus?.error && !printStatus?.counts ? <T size={15} weight="700" color={c.red}>No se pudo consultar la cola de impresión.</T> : null}
      {printStatus?.counts ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {[['PENDIENTE', 'En cola', c.sky], ['PROCESANDO', 'Imprimiendo', c.amber], ['ENVIADO', 'Impresas', c.green], ['ERROR', 'Con error', c.red], ['REVISAR', 'Por revisar', c.red]].map(([k, l, tone]) =>
          <View key={k} style={{ minWidth: 96, flexGrow: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }}>
            <Num size={24} weight="800" color={Number(printStatus.counts[k] || 0) && (k === 'ERROR' || k === 'REVISAR') ? tone : c.text}>{Number(printStatus.counts[k] || 0)}</Num>
            <T size={13} weight="600" color={c.muted}>{l}</T>
          </View>)}
      </View> : !printStatus ? <ActivityIndicator color={c.primary} /> : null}
      {(printStatus?.jobs || []).filter(j => ['ERROR', 'REVISAR'].includes(j.estado)).slice(0, 5).map(j => <View key={j.id} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.surfaceAlt }}>
        <T size={14} weight="700" color={c.red}>Comanda del pedido #{j.pedido_id}: {j.error || j.estado}</T>
      </View>)}
    </BottomSheet>
  </View>;
}

export default function KitchenApp() {
  return <MeseroAppearance>
    <ComandaToastProvider placement={Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 900 ? 'bottom' : 'top'} bottomOffset={16} topOffset={72 + TOP_INSET}>
      <Kitchen />
    </ComandaToastProvider>
  </MeseroAppearance>;
}
