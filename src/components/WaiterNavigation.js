// Navegación del mesero (marca blanca).
// Arriba: marca del local, conexión (solo si hay problema), avisos y perfil. Abajo: barra de pestañas fija.
// «Más» abre una hoja con lo del día, avisos de cocina y ajustes.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Bell, BellRing, BadgePercent, CalendarClock, ChefHat, CloudOff, LayoutGrid, UtensilsCrossed, Download, FileText, Lock, LogOut, Moon, MoreHorizontal, RefreshCw, ShoppingBag, Smartphone, Sun, Users, Vibrate, Volume2 } from 'lucide-react-native';
import { connectionState } from '../utils/waiterSync.mjs';
import { useTheme } from '../theme';
import { BottomSheet, BrandMark, ConnectionDot, IconButton, Label, Num, Press, T, TabBar, space } from './waiter/kit';
import { useInstallAction } from './waiter/install';
import { alertSettings, alertWaiter, keepAwakeSupported, saveAlertSettings, subscribeAlertSettings } from '../services/waiterAlerts';
import { pushStatus, pushSupport, subscribePushStatus, testWebPush } from '../services/webPushClient';

const initialsOf = name => String(name || 'Mesero').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const clock = at => at ? new Date(at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

// Estado de conexión en lenguaje del mesero.
export function connectionSummary({ connection, lastSyncAt, syncing, syncError }) {
  const s = connectionState({ connection, lastSyncAt, syncing, error: syncError });
  if (s.key === 'live') return { state: 'live', label: `En línea${lastSyncAt ? ` · ${clock(lastSyncAt)}` : ''}` };
  if (syncError || s.key === 'offline' || s.key === 'error') return { state: 'offline', label: 'Sin conexión' };
  return { state: 'reconnecting', label: 'Reconectando…' };
}

export default function WaiterNavigation({ width, name, unread, notifications, connection, lastSyncAt, syncing, syncError, topInset = 0, setMenuOpen, delayCount, brand = {}, alertsPending }) {
  const { c } = useTheme();
  const phone = width < 600;
  const conn = connectionSummary({ connection, lastSyncAt, syncing, syncError });
  return <View style={{ backgroundColor: c.bg, paddingTop: topInset }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: phone ? 16 : 20, paddingRight: phone ? 8 : 12, gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <BrandMark name={brand.name} logo={brand.logo} />
        <ConnectionDot state={conn.state} label={phone && conn.state === 'live' ? null : conn.label} />
      </View>
      <View>
        <IconButton icon={Bell} label={unread ? `Avisos, ${unread} pendientes` : alertsPending ? 'Avisos (activa los avisos de plato listo)' : 'Avisos'} onPress={notifications} badge={unread || null} />
        {!unread && alertsPending ? <View pointerEvents="none" style={{ position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: c.red, borderWidth: 2, borderColor: c.bg }} /> : null}
      </View>
      <Press accessibilityRole="button" accessibilityLabel={`Perfil y más opciones de ${name || 'mesero'}`} onPress={() => setMenuOpen(true)} hapticKind="tap" scaleTo={0.94} sink={0}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt }}>
          <T size={13} weight="700" color={c.text}>{initialsOf(name)}</T>
        </View>
      </Press>
    </View>
  </View>;
}

// Pestañas inferiores.
export function WaiterBottomBar({ step, navigate, cartCount = 0, expressCount = 0, bottomInset = 0, setMenuOpen }) {
  const items = [
    { key: 'mesas', label: 'Mesas', icon: LayoutGrid },
    { key: 'productos', label: 'Menú', icon: UtensilsCrossed },
    { key: 'express', label: 'Express', icon: ShoppingBag, badge: expressCount || null },
    { key: 'mas', label: 'Más', icon: MoreHorizontal },
  ];
  return <TabBar items={items} value={step === 'promociones' ? 'mas' : step === 'pedido' ? 'productos' : step} bottomInset={bottomInset} onChange={key => key === 'mas' ? setMenuOpen(true) : navigate(key)} />;
}

// Interruptor simple (sonido, vibración, pantalla encendida).
function Toggle({ value, onChange, label }) {
  const { c } = useTheme();
  return <Press accessibilityRole="switch" accessibilityState={{ checked: !!value }} accessibilityLabel={label} onPress={() => onChange(!value)} hapticKind="select" scaleTo={0.96}
    style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: value ? c.ink : c.softer }}>
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: value ? c.onInk : '#FFFFFF', alignSelf: value ? 'flex-end' : 'flex-start' }} />
  </Press>;
}

// Hoja «Más»: lo del día (reservas, promos, borradores), avisos de cocina y ajustes.
export function WaiterMoreSheet({ open, onClose, name, navigate, dark, toggleTheme, refresh, logout, draftCount = 0, draftAttention, openDrafts, connection, lastSyncAt, syncing, syncError, contextLabel,
  pendingCount = 0, retryQueue, offline, reservationCount = 0, openReservations, alertPermission = 'unsupported', enableAlerts }) {
  const { c } = useTheme();
  const conn = connectionSummary({ connection, lastSyncAt, syncing, syncError });
  const installer = useInstallAction();
  const [alerts, setAlerts] = useState(alertSettings());
  useEffect(() => subscribeAlertSettings(setAlerts), []);
  const [push, setPush] = useState(pushStatus());
  useEffect(() => subscribePushStatus(setPush), []);
  const [testing, setTesting] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [testNote, setTestNote] = useState('');
  const support = pushSupport();
  // Con avisos push activos, la prueba viaja por el servidor: es exactamente el camino de «plato listo».
  const runTest = async () => {
    if (push !== 'active') { alertWaiter('ready', { title: 'Prueba: Mesa 4 lista', body: 'Así suena cuando cocina termina un plato.' }); return; }
    setTesting(true);
    try {
      if (await testWebPush(8)) { setTestNote('Bloquea el teléfono: el aviso llega en unos 8 segundos.'); setTimeout(() => setTestNote(''), 12000); }
      else alertWaiter('ready', { title: 'Prueba: Mesa 4 lista' });
    } catch { alertWaiter('ready', { title: 'Prueba: Mesa 4 lista' }); }
    finally { setTesting(false); }
  };
  const lockState = push === 'active' ? { icon: Lock, tone: c.green, title: 'Con el teléfono bloqueado: activado', detail: 'Los avisos llegan aunque cierres la app.' }
    : support === 'ios-install' ? { icon: Lock, tone: c.amber, title: 'Con el teléfono bloqueado: falta instalar', detail: 'En iPhone, toca Compartir → «Agregar a inicio» y abre la app desde ahí.' }
    : push === 'error' ? { icon: Lock, tone: c.amber, title: 'Con el teléfono bloqueado: no se activó', detail: 'Toca para intentarlo otra vez.', retry: true }
    : support === 'unsupported' ? { icon: Lock, tone: c.muted, title: 'Con el teléfono bloqueado: no disponible', detail: 'Este navegador no lo permite. Usa Chrome en Android o instala la app en iPhone.' }
    : null;
  const row = (Icon, label, detail, onPress, tone, right) => <Press key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { onClose(); onPress(); }} hapticKind="tap"
    style={{ minHeight: 56, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.sm, borderRadius: 8 }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ width: 24, alignItems: 'center' }}><Icon size={20} color={tone === c.red ? c.red : tone === c.amber ? c.amber : c.text} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T size={16} weight="500" color={tone === c.red ? c.red : c.text}>{label}</T>
      {detail ? <T size={14} color={c.muted} numberOfLines={2}>{detail}</T> : null}
    </View>
    {right != null ? <View style={{ minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 8, backgroundColor: tone === c.amber ? c.amberFill : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Num size={13} weight="800" color={tone === c.amber ? c.onAmber : c.text}>{right}</Num></View> : null}
  </Press>;
  const setting = (Icon, label, detail, key) => <View key={key} style={{ minHeight: 56, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.sm }}>
    <View style={{ width: 24, alignItems: 'center' }}><Icon size={20} color={c.text} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T size={16} weight="500">{label}</T>
      {detail ? <T size={14} color={c.muted}>{detail}</T> : null}
    </View>
    <Toggle value={alerts[key]} onChange={v => saveAlertSettings({ [key]: v })} label={label} />
  </View>;
  const section = text => <T size={13} weight="800" color={c.muted} style={{ marginTop: space.md, marginBottom: 2, paddingHorizontal: space.sm }}>{text}</T>;
  return <><BottomSheet visible={open} onClose={onClose} title={name || 'Mesero'} subtitle={offline ? 'Sin internet' : conn.state === 'live' ? 'Área de servicio' : conn.label}>
    <View>
      {pendingCount ? row(CloudOff, pendingCount === 1 ? '1 ronda sin enviar' : `${pendingCount} rondas sin enviar`, 'Guardadas en este teléfono. Toca para reintentar ahora.', retryQueue, c.amber, pendingCount) : null}
      {row(CalendarClock, 'Reservas de hoy', reservationCount ? `${reservationCount} por llegar` : 'Ninguna por llegar', openReservations, null, reservationCount || null)}
      {row(BadgePercent, 'Promos y combos', 'Ofertas activas para añadir al pedido', () => navigate('promociones'))}
      {row(FileText, 'Pedidos guardados', draftCount ? `${draftCount} sin terminar en este teléfono` : 'No hay pedidos a medias', openDrafts, draftAttention ? c.amber : null)}

      <View style={{ height: 1, backgroundColor: c.line, marginVertical: space.sm }} />
      {row(BellRing, 'Avisos de cocina', [alerts.sound ? 'Sonido' : null, alerts.vibrate ? 'vibración' : null].filter(Boolean).join(' y ') || 'Silenciados', () => setAlertsOpen(true))}
      {row(RefreshCw, 'Actualizar datos', 'Vuelve a traer mesas, menú y pedidos', refresh)}
      {row(dark ? Sun : Moon, dark ? 'Usar tema claro' : 'Usar tema oscuro', null, toggleTheme)}
      {installer.install.available ? row(Download, 'Instalar la app', installer.install.ios ? 'Agrégala a la pantalla de inicio del iPhone' : 'Ábrela como app, a pantalla completa', installer.run) : null}
    </View>
    <View style={{ height: 1, backgroundColor: c.line }} />
    {row(LogOut, 'Cerrar sesión', null, logout, c.red)}
  </BottomSheet>
  <BottomSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} title="Avisos de cocina" subtitle="Cuando un plato está listo">
    <View style={{ gap: 2 }}>
      {alertPermission === 'default' ? row(BellRing, 'Permitir avisos del sistema', 'Para enterarte con otra app abierta', enableAlerts) : null}
      {setting(Volume2, 'Sonido', 'Suena cuando un plato está listo', 'sound')}
      {setting(Vibrate, 'Vibración', null, 'vibrate')}
      {keepAwakeSupported() ? setting(Smartphone, 'Pantalla siempre encendida', 'El teléfono no se duerme: no te pierdes avisos', 'keepAwake') : null}
      {lockState ? <Press accessibilityRole={lockState.retry ? 'button' : 'text'} disabled={!lockState.retry} onPress={() => { setAlertsOpen(false); onClose(); enableAlerts(); }} scaleTo={1}
        style={{ minHeight: 56, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.sm }}>
        <View style={{ width: 24, alignItems: 'center' }}><lockState.icon size={20} color={lockState.tone} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={16} weight="600">{lockState.title}</T>
          <T size={14} color={c.muted}>{lockState.detail}</T>
        </View>
      </Press> : null}
      <Press accessibilityRole="button" accessibilityLabel="Probar el aviso" disabled={testing} onPress={runTest} hapticKind={null}
        style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: space.lg, marginLeft: 48, marginTop: 4, borderRadius: 8, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}>
        <T size={15} weight="700">{testing ? 'Enviando…' : 'Probar el aviso'}</T>
      </Press>
      {testNote ? <T size={14} weight="700" color={c.green} accessibilityLiveRegion="polite" style={{ marginLeft: 48, marginTop: 6 }}>{testNote}</T> : null}
      {alertPermission === 'denied' ? <T size={13} color={c.muted} style={{ paddingHorizontal: space.sm, marginTop: 6 }}>El navegador tiene bloqueados los avisos del sistema. Con la app abierta igual suena; para el resto, permite las notificaciones en los ajustes del sitio.</T> : null}

    </View>
  </BottomSheet>{installer.sheet}</>;
}
