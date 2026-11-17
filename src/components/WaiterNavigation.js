// Navegación del mesero, dirección «Suave».
// Arriba: cabecera limpia (logo, conexión, avisos, perfil). Abajo: barra flotante tipo píldora al alcance del pulgar.
// «Más» abre una hoja con Promos, borradores, actualizar, tema y cerrar sesión.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Bell, BellRing, BadgePercent, CalendarClock, ChefHat, CloudOff, Download, FileText, LogOut, Moon, MoreHorizontal, RefreshCw, ShoppingBag, Smartphone, Sun, Users, Vibrate, Volume2 } from 'lucide-react-native';
import Logo from './Logo';
import { connectionState } from '../utils/waiterSync.mjs';
import { useTheme } from '../theme';
import { BottomSheet, ConnectionDot, IconButton, Label, Num, Press, T, TabBar, space } from './waiter/comanda';
import { useInstallAction } from './waiter/install';
import { alertSettings, alertWaiter, keepAwakeSupported, saveAlertSettings, subscribeAlertSettings } from '../services/waiterAlerts';

const initialsOf = name => String(name || 'Mesero').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const clock = at => at ? new Date(at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

// Estado de conexión en lenguaje del mesero.
export function connectionSummary({ connection, lastSyncAt, syncing, syncError }) {
  const s = connectionState({ connection, lastSyncAt, syncing, error: syncError });
  if (s.key === 'live') return { state: 'live', label: `En línea${lastSyncAt ? ` · ${clock(lastSyncAt)}` : ''}` };
  if (syncError || s.key === 'offline' || s.key === 'error') return { state: 'offline', label: 'Sin conexión' };
  return { state: 'reconnecting', label: 'Reconectando…' };
}

export default function WaiterNavigation({ width, name, unread, notifications, connection, lastSyncAt, syncing, syncError, topInset = 0, setMenuOpen, delayCount }) {
  const { c } = useTheme();
  const phone = width < 600;
  const conn = connectionSummary({ connection, lastSyncAt, syncing, syncError });
  return <View style={{ backgroundColor: c.bg, paddingTop: topInset }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: phone ? 12 : 20, paddingRight: phone ? 4 : 12, gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Logo width={phone ? 92 : 112} dark={c.isDark} />
        <ConnectionDot state={conn.state} label={phone && conn.state === 'live' ? null : conn.label} />
      </View>
      <IconButton icon={Bell} label={unread ? `Avisos, ${unread} pendientes` : 'Avisos'} onPress={notifications} badge={unread || null} />
      <Press accessibilityRole="button" accessibilityLabel={`Perfil y más opciones de ${name || 'mesero'}`} onPress={() => setMenuOpen(true)} hapticKind="tap" scaleTo={0.94} sink={0}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft }}>
          <T size={14} weight="800" color={c.primaryText}>{initialsOf(name)}</T>
        </View>
      </Press>
    </View>
  </View>;
}

// Pestañas inferiores.
export function WaiterBottomBar({ step, navigate, cartCount = 0, expressCount = 0, bottomInset = 0, setMenuOpen }) {
  const items = [
    { key: 'mesas', label: 'Mesas', icon: Users },
    { key: 'productos', label: 'Menú', icon: ChefHat, badge: cartCount || null },
    { key: 'express', label: 'Express', icon: ShoppingBag, badge: expressCount || null, badgeTone: 'ink' },
    { key: 'mas', label: 'Más', icon: MoreHorizontal },
  ];
  return <TabBar items={items} value={step === 'promociones' ? 'mas' : step === 'pedido' ? 'productos' : step} bottomInset={bottomInset} onChange={key => key === 'mas' ? setMenuOpen(true) : navigate(key)} />;
}

// Interruptor simple (sonido, vibración, pantalla encendida).
function Toggle({ value, onChange, label }) {
  const { c } = useTheme();
  return <Press accessibilityRole="switch" accessibilityState={{ checked: !!value }} accessibilityLabel={label} onPress={() => onChange(!value)} hapticKind="select" scaleTo={0.96}
    style={{ width: 52, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center', backgroundColor: value ? c.primary : c.line }}>
    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignSelf: value ? 'flex-end' : 'flex-start' }} />
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
  const row = (Icon, label, detail, onPress, tone, right) => <Press key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { onClose(); onPress(); }} hapticKind="tap"
    style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: 18 }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: tone === c.red ? c.redSoft : tone === c.amber ? c.amberSoft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={tone || c.text} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T size={17} weight="600" color={tone === c.red ? c.red : c.text}>{label}</T>
      {detail ? <T size={14} color={c.muted} numberOfLines={2}>{detail}</T> : null}
    </View>
    {right != null ? <View style={{ minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: tone === c.amber ? c.amber : c.ink, alignItems: 'center', justifyContent: 'center' }}><Num size={13} weight="800" color={tone === c.amber ? '#FFFFFF' : c.onInk}>{right}</Num></View> : null}
  </Press>;
  const setting = (Icon, label, detail, key) => <View key={key} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm }}>
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon size={20} color={c.text} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <T size={17} weight="600">{label}</T>
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

      {section('Avisos de cocina')}
      {alertPermission === 'default' ? row(BellRing, 'Permitir avisos del sistema', 'Para enterarte con otra app abierta', enableAlerts, c.primaryText) : null}
      {setting(Volume2, 'Sonido', 'Suena cuando un plato está listo', 'sound')}
      {setting(Vibrate, 'Vibración', null, 'vibrate')}
      {keepAwakeSupported() ? setting(Smartphone, 'Pantalla siempre encendida', 'El teléfono no se duerme: no te pierdes avisos', 'keepAwake') : null}
      <Press accessibilityRole="button" accessibilityLabel="Probar el aviso" onPress={() => alertWaiter('ready', { title: 'Prueba: Mesa 4 lista', body: 'Así suena cuando cocina termina un plato.' })} hapticKind={null}
        style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: space.lg, marginLeft: 62, borderRadius: 22, backgroundColor: c.surfaceAlt, justifyContent: 'center' }}>
        <T size={15} weight="700">Probar el aviso</T>
      </Press>
      {alertPermission === 'denied' ? <T size={13} color={c.muted} style={{ paddingHorizontal: space.sm, marginTop: 6 }}>El navegador tiene bloqueados los avisos del sistema. Con la app abierta igual suena; para el resto, permite las notificaciones en los ajustes del sitio.</T> : null}

      {section('Ajustes')}
      {row(RefreshCw, 'Actualizar datos', 'Vuelve a traer mesas, menú y pedidos', refresh)}
      {row(dark ? Sun : Moon, dark ? 'Usar tema claro' : 'Usar tema oscuro', null, toggleTheme)}
      {installer.install.available ? row(Download, 'Instalar la app', installer.install.ios ? 'Agrégala a la pantalla de inicio del iPhone' : 'Ábrela como app, a pantalla completa', installer.run) : null}
    </View>
    <View style={{ height: 1, backgroundColor: c.line }} />
    {row(LogOut, 'Cerrar sesión', null, logout, c.red)}
  </BottomSheet>{installer.sheet}</>;
}
