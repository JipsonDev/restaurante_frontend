// Cocina (KDS) — dirección «Suave», la misma familia visual que la app del mesero.
// Tablet: tablero de 3 columnas (Nuevas · En preparación · Listas). Celular: pestañas con una columna.
// «Por plato» suma cada producto pendiente. Historial e impresión viven en hojas, no ocupan pantalla.
// Funciones: sonido y vibración al llegar rondas, semáforo según el límite de Ajustes › Atención,
// platos que se tachan, deslizar para avanzar, deshacer «Listo», avisar al mesero y pantalla siempre encendida.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import {
  BellRing, Check, ChefHat, History, Layers, LayoutGrid, LogOut, Moon, MoreHorizontal, Printer,
  RefreshCw, RotateCcw, Soup, Sun, Sunrise, Volume2, VolumeX, CheckCheck, Inbox,
} from 'lucide-react-native';
import axios from 'axios';
import { BASE_URL, useAuth } from '../context/AuthContext';
import { WaiterAppearance, useTheme } from '../theme';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';
import { REALTIME_EVENTS, getRealtimeSocket, subscribeRealtime } from '../services/realtime';
import { ALERT_TONES, installWebAudioUnlock, playWebAlertTone, unlockWebAudio } from '../services/webAudioAlerts';
import { allDayItems, createRefreshQueue, isCriticalNote, kitchenBoard, kitchenRounds, pendingSignature, shortDuration, waitMinutes } from '../utils/kitchenLogic.mjs';
import { KitchenTicket, clearDoneItems, ticketTarget } from '../components/kitchen/ticket';
import {
  Appear, BottomSheet, Button, Chip, ComandaToastProvider, ConnectionDot, EmptyState, IconButton, Num, Press, RollingNumber,
  T, elevate, haptic, radius, space, useComandaFonts, useComandaToast,
} from '../components/waiter/comanda';

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
  const [sheet, setSheet] = useState(null); // 'menu' | 'historial' | 'impresion'
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
      data => { setRounds(kitchenRounds(data)); setLoadError(false); setLoading(false); setOptimistic({}); },
      () => { setLoadError(true); setLoading(false); },
    );
    const load = () => refreshQueue.current?.refresh();
    load();
    axios.get(`${BASE_URL}/configuracion`).then(({ data }) => setLimits({
      espera: Number(data?.alerta_espera_minutos) || 20, lista: Number(data?.alerta_lista_minutos) || 5, activas: String(data?.alertas_demora_activas ?? '1') !== '0',
    })).catch(() => {});
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
    const unsub = [REALTIME_EVENTS.ORDER_CREATED, REALTIME_EVENTS.ORDER_UPDATED, REALTIME_EVENTS.PRINT_COMANDA].map(ev => subscribeRealtime(ev, () => load()));
    return () => {
      clearInterval(poll); clearInterval(clock); refreshQueue.current?.stop();
      client.off('connect', onConnect); client.off('disconnect', onDisconnect); client.off('connect_error', onError);
      unsub.forEach(u => u && u());
    };
  }, []);

  const live = useMemo(() => rounds.map(r => optimistic[r.id] ? { ...r, estado: optimistic[r.id] } : r), [rounds, optimistic]);
  const board = useMemo(() => kitchenBoard(live), [live]);
  const dishes = useMemo(() => allDayItems(live, ticketTarget), [live]);
  const counts = { PENDIENTE: board.PENDIENTE.length, PREPARANDO: board.PREPARANDO.length, LISTO: board.LISTO.length };
  const roundsPerAccount = useMemo(() => {
    const m = {}; for (const r of [...board.PENDIENTE, ...board.PREPARANDO, ...board.LISTO]) m[r.pedido_id] = (m[r.pedido_id] || 0) + 1; return m;
  }, [board]);

  // Llegan rondas nuevas: sonido, vibración, aviso y marca «Nueva».
  useEffect(() => {
    if (loading) return;
    const sigs = new Set(board.PENDIENTE.map(pendingSignature));
    if (prevSignatures.current) {
      const fresh = board.PENDIENTE.filter(r => !prevSignatures.current.has(pendingSignature(r)));
      if (fresh.length) {
        const pickup = fresh.some(r => !r.mesa_id);
        sound(pickup ? ALERT_TONES.PICKUP_NEW : ALERT_TONES.ORDER_NEW);
        haptic('success');
        const at = Date.now();
        setNewIds(prev => { const n = { ...prev }; fresh.forEach(r => { n[r.id] = at; }); return n; });
        toast.show(fresh.length === 1 ? `Nueva ronda: ${ticketTarget(fresh[0])}` : `${fresh.length} rondas nuevas`, {
          tone: 'success', icon: BellRing, detail: fresh.length > 1 ? fresh.slice(0, 3).map(ticketTarget).join(' · ') : `${(fresh[0].items || []).reduce((s, i) => s + Number(i.cantidad || 0), 0)} platos`,
          action: board3 || tab === 'PENDIENTE' ? undefined : { label: 'Ver', onPress: () => setTab('PENDIENTE') },
        });
      }
    }
    prevSignatures.current = sigs;
  }, [board.PENDIENTE, loading]);

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
  const markReady = async r => {
    const ok = await move(r, 'LISTO');
    if (!ok) return;
    clearDoneItems(r.id);
    toast.show(`${ticketTarget(r)} lista`, { tone: 'success', icon: CheckCheck, detail: 'Se avisó al mesero', action: { label: 'Deshacer', onPress: () => recall(r) } });
  };
  const recall = async r => { const ok = await move(r, 'PREPARANDO'); if (ok) toast.show(`${ticketTarget(r)} volvió a preparación`, { icon: RotateCcw }); };
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
  const ticket = (r, compact) => {
    const state = String(r.estado).toUpperCase();
    const isBusy = busy.has(r.id);
    const common = { key: r.id, round: r, now, limit: limits.espera, listoLimit: limits.lista, busy: isBusy, isNew: !!newIds[r.id], extraRound: roundsPerAccount[r.pedido_id] > 1, compact };
    const printBtn = { icon: Printer, label: `Imprimir comanda de ${ticketTarget(r)}`, onPress: () => print([r]) };
    if (state === 'PENDIENTE') return <KitchenTicket {...common} secondary={[printBtn]}
      action={{ label: 'Empezar', icon: Soup, variant: isDark ? 'outline' : 'ink', onPress: () => start(r) }}
      swipe={{ label: 'Empezar', icon: Soup, color: c.primary, onSwipe: () => start(r) }} />;
    if (state === 'PREPARANDO') return <KitchenTicket {...common} secondary={[printBtn]}
      action={{ label: 'Marcar lista', allDoneLabel: 'Todo listo · avisar', icon: Check, variant: 'primary', haptic: 'success', onPress: () => markReady(r) }}
      swipe={{ label: 'Lista', icon: Check, color: c.greenDot, onSwipe: () => markReady(r) }} />;
    return <KitchenTicket {...common} secondary={[{ icon: RotateCcw, text: 'Volver', label: `Volver a preparación: ${ticketTarget(r)}`, onPress: () => recall(r) }]}
      action={{ label: 'Avisar', icon: BellRing, variant: 'primary', onPress: () => ping(r) }} />;
  };

  const emptyFor = key => key === 'PENDIENTE'
    ? <EmptyState icon={Inbox} title="Sin rondas nuevas" description="Cuando un mesero envíe una ronda sonará y aparecerá aquí." />
    : key === 'PREPARANDO' ? <EmptyState icon={ChefHat} title="Nada en preparación" description="Toca «Empezar» en una ronda nueva." />
      : <EmptyState icon={CheckCheck} title="Todo servido" description="Las rondas listas esperan aquí al mesero." />;

  const column = col => <View key={col.key} style={{ flex: 1, minWidth: 0, backgroundColor: c.isDark ? '#141519' : c.surfaceAlt, borderRadius: radius.xl, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colTone(col.key) }} />
      <T size={17} weight="800" style={{ flex: 1 }} numberOfLines={1}>{col.title}</T>
      <View style={{ minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 13, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <RollingNumber value={counts[col.key]} size={14} weight="800" />
      </View>
    </View>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, paddingTop: 4, gap: space.md, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
      {board[col.key].length ? board[col.key].map(r => <Appear key={r.id}>{ticket(r, width < 1200)}</Appear>) : emptyFor(col.key)}
    </ScrollView>
  </View>;

  const dishesView = <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: pad, gap: space.md, paddingBottom: BOTTOM_INSET + 32, flexDirection: board3 ? 'row' : 'column', flexWrap: 'wrap' }}>
    {!dishes.length ? <View style={{ width: '100%' }}><EmptyState icon={LayoutGrid} title="Nada por preparar" description="Aquí se suman los platos de todas las rondas nuevas y en preparación." /></View> : null}
    {dishes.map((d, i) => <Appear key={d.key} delay={Math.min(i, 10) * 25} style={board3 ? { width: width >= 1300 ? '32.4%' : '48.9%' } : null}>
      <View style={[{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.isDark ? c.line : 'rgba(16,24,40,0.05)' }, elevate(c, 1)]}>
        <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Num size={32} weight="800">{d.cantidad}</Num>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <T size={21} weight="800">{d.nombre}</T>
          {d.modificadores.length ? <T size={14} weight="600" color={c.muted}>{d.modificadores.join(' · ')}</T> : null}
          {d.notas ? <T size={14} weight="800" color={isCriticalNote(d.notas) ? c.red : c.amber}>{isCriticalNote(d.notas) ? '⚠ ' : ''}{d.notas}</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {d.destinos.map(x => <View key={x.nombre} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
              <T size={14} weight="700">{x.nombre} · {x.cantidad}</T>
            </View>)}
            {d.nuevas ? <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.primary }}><T size={13} weight="800" color={c.onPrimary}>{d.nuevas} sin empezar</T></View> : null}
          </View>
        </View>
      </View>
    </Appear>)}
  </ScrollView>;

  // ── Pantalla ─────────────────────────────────────────────────────────────
  const conn = realtime === 'connected' && !loadError ? { state: 'live', label: 'En vivo' } : loadError || realtime === 'error' ? { state: 'offline', label: 'Sin conexión' } : { state: 'reconnecting', label: 'Reconectando…' };
  const header = <View style={{ paddingTop: TOP_INSET, backgroundColor: c.bg }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingHorizontal: pad }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><ChefHat size={21} color={c.primaryText} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={phone ? 20 : 22} weight="800" accessibilityRole="header" numberOfLines={1}>Cocina</T>
        <ConnectionDot state={conn.state} label={conn.label} />
      </View>
      {!phone ? <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
        {[['tablero', 'Tablero', Layers], ['platos', 'Por plato', LayoutGrid]].map(([k, l, I]) => <Chip key={k} selected={view === k} icon={I} onPress={() => setView(k)}>{l}</Chip>)}
      </View> : <IconButton icon={view === 'tablero' ? LayoutGrid : Layers} label={view === 'tablero' ? 'Ver por plato' : 'Ver tablero'} onPress={() => setView(view === 'tablero' ? 'platos' : 'tablero')} />}
      <IconButton icon={muted ? VolumeX : Volume2} label={muted ? 'Activar sonido' : 'Silenciar'} color={muted ? c.red : c.text} onPress={() => { unlockWebAudio().catch(() => {}); setMuted(m => !m); }} />
      {!phone || printErrors ? <IconButton icon={Printer} label={printErrors ? `Impresión: ${printErrors} con error` : 'Impresión'} badge={printErrors || null} onPress={() => setSheet('impresion')} /> : null}
      {!phone ? <IconButton icon={History} label="Entregadas hoy" onPress={() => setSheet('historial')} /> : null}
      <IconButton icon={MoreHorizontal} label="Más opciones" onPress={() => setSheet('menu')} />
    </View>
    {!board3 && view === 'tablero' ? <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, marginHorizontal: pad, marginBottom: space.sm, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
      {COLS.map(col => {
        const on = tab === col.key;
        return <Press key={col.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${col.title}: ${counts[col.key]}`} onPress={() => setTab(col.key)} hapticKind="select" scaleTo={0.95}
          style={[{ flex: 1, minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? c.surface : 'transparent' }, on ? elevate(c, 1) : null]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colTone(col.key) }} />
          <T size={14} weight={on ? '800' : '600'} numberOfLines={1}>{col.short}</T>
          <Num size={13} weight="800" color={on ? c.text : c.muted}>{counts[col.key]}</Num>
        </Press>;
      })}
    </View> : null}
  </View>;

  if (loading) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
    <ActivityIndicator size="large" color={c.primary} /><T color={c.muted}>Cargando la cocina…</T>
  </View>;

  const history = board.ENTREGADO.filter(r => new Date(String(r.created_at).replace(' ', 'T')).toDateString() === new Date().toDateString());
  const pendingToPrint = [...board.PENDIENTE, ...board.PREPARANDO];
  const menuRow = (Icon, label, detail, onPress, tone) => <Press key={label} accessibilityRole="button" onPress={() => { setSheet(null); onPress(); }} hapticKind="tap"
    style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: 18 }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tone === c.red ? c.redSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={tone || c.text} /></View>
    <View style={{ flex: 1 }}><T size={17} weight="700" color={tone || c.text}>{label}</T>{detail ? <T size={14} color={c.muted}>{detail}</T> : null}</View>
  </Press>;

  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    {header}
    {loadError ? <Appear style={{ marginHorizontal: pad, marginBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingLeft: space.lg, borderRadius: radius.lg, backgroundColor: c.redSoft }}>
        <T size={14} weight="700" color={c.red} style={{ flex: 1 }}>No se pudo actualizar la cocina. Lo que ves puede estar desactualizado.</T>
        <Button size="sm" variant="primary" icon={RefreshCw} onPress={() => refreshQueue.current?.refresh()}>Reintentar</Button>
      </View>
    </Appear> : null}
    {view === 'platos' ? dishesView : board3
      ? <View style={{ flex: 1, flexDirection: 'row', gap: space.md, paddingHorizontal: pad, paddingBottom: Math.max(BOTTOM_INSET, space.lg) }}>{COLS.map(column)}</View>
      : <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 4, paddingBottom: BOTTOM_INSET + 32, gap: space.md }}>
        <T size={13} color={c.muted}>{COLS.find(x => x.key === tab)?.hint}</T>
        {board[tab].length ? board[tab].map(r => <Appear key={r.id}>{ticket(r, true)}</Appear>) : emptyFor(tab)}
      </ScrollView>}

    <BottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title="Cocina" subtitle={conn.label}>
      <View>
        {phone ? menuRow(History, 'Entregadas hoy', `${history.length} rondas`, () => setTimeout(() => setSheet('historial'), 250)) : null}
        {phone ? menuRow(Printer, 'Impresión de comandas', printErrors ? `${printErrors} con error` : 'Estado de la cola', () => setTimeout(() => setSheet('impresion'), 250)) : null}
        {menuRow(Printer, 'Imprimir pendientes', `${pendingToPrint.length} comandas nuevas y en preparación`, () => print(pendingToPrint))}
        {wake.supported ? menuRow(Sunrise, keepAwake ? 'Pantalla siempre encendida: sí' : 'Pantalla siempre encendida: no', keepAwake ? (wake.active ? 'La tablet no se apagará sola' : 'Se activa al tocar la pantalla') : 'La tablet puede apagarse sola', () => setKeepAwake(v => !v)) : null}
        {menuRow(isDark ? Sun : Moon, isDark ? 'Usar tema claro' : 'Usar tema oscuro', null, toggleTheme)}
        {menuRow(RefreshCw, 'Actualizar', 'Vuelve a traer las rondas', () => refreshQueue.current?.refresh())}
      </View>
      <View style={{ height: 1, backgroundColor: c.line }} />
      {menuRow(LogOut, 'Cerrar sesión', null, logout, c.red)}
    </BottomSheet>

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
      {(printStatus?.jobs || []).filter(j => ['ERROR', 'REVISAR'].includes(j.estado)).slice(0, 5).map(j => <View key={j.id} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.redSoft }}>
        <T size={14} weight="700" color={c.red}>Comanda del pedido #{j.pedido_id}: {j.error || j.estado}</T>
      </View>)}
    </BottomSheet>
  </View>;
}

export default function KitchenApp() {
  return <WaiterAppearance>
    <ComandaToastProvider placement="top" topOffset={72 + TOP_INSET}>
      <Kitchen />
    </ComandaToastProvider>
  </WaiterAppearance>;
}
