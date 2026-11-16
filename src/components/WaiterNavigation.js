// Navegación del mesero, dirección «Comanda».
// Arriba: cabecera compacta (logo, conexión, avisos, perfil). Abajo: pestañas al alcance del pulgar.
// «Más» abre una hoja con Promos, borradores, actualizar, tema y cerrar sesión.
import React from 'react';
import { View } from 'react-native';
import { Bell, BadgePercent, ChefHat, FileText, LogOut, Moon, MoreHorizontal, Receipt, RefreshCw, ShoppingBag, Sun, Users } from 'lucide-react-native';
import Logo from './Logo';
import { connectionState } from '../utils/waiterSync.mjs';
import { useTheme } from '../theme';
import { BottomSheet, ConnectionDot, IconButton, Label, Num, Press, T, TabBar, space } from './waiter/comanda';

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
  return <View style={{ backgroundColor: c.bg, paddingTop: topInset, borderBottomWidth: 1, borderBottomColor: c.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingLeft: phone ? 12 : 20, paddingRight: phone ? 4 : 12, gap: space.sm }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Logo width={phone ? 92 : 112} dark={c.isDark} />
        <ConnectionDot state={conn.state} label={phone && conn.state === 'live' ? null : conn.label} />
      </View>
      <IconButton icon={Bell} label={unread ? `Avisos, ${unread} pendientes` : 'Avisos'} onPress={notifications} badge={unread || null} />
      <Press accessibilityRole="button" accessibilityLabel={`Perfil y más opciones de ${name || 'mesero'}`} onPress={() => setMenuOpen(true)} hapticKind="tap" scaleTo={0.94} sink={0}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
          <T size={13} weight="700">{initialsOf(name)}</T>
        </View>
      </Press>
    </View>
  </View>;
}

// Pestañas inferiores.
export function WaiterBottomBar({ step, navigate, cartCount = 0, expressCount = 0, bottomInset = 0, setMenuOpen }) {
  const items = [
    { key: 'mesas', label: 'Mesas', icon: Users },
    { key: 'productos', label: 'Menú', icon: ChefHat },
    { key: 'pedido', label: 'Comanda', icon: Receipt, badge: cartCount || null },
    { key: 'express', label: 'Express', icon: ShoppingBag, badge: expressCount || null, badgeTone: 'ink' },
    { key: 'mas', label: 'Más', icon: MoreHorizontal },
  ];
  return <TabBar items={items} value={step === 'promociones' ? 'mas' : step} bottomInset={bottomInset} onChange={key => key === 'mas' ? setMenuOpen(true) : navigate(key)} />;
}

// Hoja «Más»: perfil, promociones, borradores y ajustes rápidos.
export function WaiterMoreSheet({ open, onClose, name, navigate, dark, toggleTheme, refresh, logout, draftCount = 0, draftAttention, openDrafts, connection, lastSyncAt, syncing, syncError, contextLabel }) {
  const { c } = useTheme();
  const conn = connectionSummary({ connection, lastSyncAt, syncing, syncError });
  const row = (Icon, label, detail, onPress, tone) => <Press key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { onClose(); onPress(); }} hapticKind="tap"
    style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, borderRadius: 6 }} hoverStyle={{ backgroundColor: c.soft }}>
    <Icon size={22} color={tone || c.text} />
    <View style={{ flex: 1 }}>
      <T size={17} weight="600" color={tone || c.text}>{label}</T>
      {detail ? <T size={14} color={c.muted}>{detail}</T> : null}
    </View>
  </Press>;
  return <BottomSheet visible={open} onClose={onClose} title={name || 'Mesero'} subtitle="Área de servicio">
    <View style={{ gap: 6 }}>
      <ConnectionDot state={conn.state} label={conn.label} />
      {contextLabel ? <T size={14} color={c.muted}>{contextLabel}</T> : null}
    </View>
    <View>
      {row(BadgePercent, 'Promos y combos', 'Ofertas activas para añadir a la comanda', () => navigate('promociones'))}
      {row(FileText, 'Borradores guardados', draftCount ? `${draftCount} en este equipo${draftAttention ? ' · revisar' : ''}` : 'No hay borradores', openDrafts, draftAttention ? c.amber : null)}
      {row(RefreshCw, 'Actualizar datos', 'Vuelve a traer mesas, menú y pedidos', refresh)}
      {row(dark ? Sun : Moon, dark ? 'Usar tema claro' : 'Usar tema oscuro', null, toggleTheme)}
    </View>
    <View style={{ height: 1, backgroundColor: c.line }} />
    {row(LogOut, 'Cerrar sesión', null, logout, c.red)}
  </BottomSheet>;
}
