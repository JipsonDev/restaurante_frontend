import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AlertTriangle, ArrowRight, Bell, CalendarClock, ClipboardList, CornerDownLeft, LogOut, Moon, Search, Sun, UtensilsCrossed, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import { dayOf, isLate, localStamp, minutesUntil, timeOf } from '../utils/reservationLogic.mjs';
import { ActionMenu, Avatar, EASE_OUT, IconButton, Press, font, money, radius, reduceMotion, space, type } from './admin/ui';
import { NAV, navItem } from './admin/nav';
import Logo from './Logo';

const WEB = Platform.OS === 'web';
const normalize = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isPickup = order => !order?.mesa_id || ['Delivery', 'Para llevar', 'Express'].includes(order?.tipo);
const orderTarget = order => isPickup(order) ? `${order.tipo === 'Delivery' ? 'Delivery' : 'Para llevar'} #${order.id}` : `Mesa ${order.mesa_numero || order.mesa_id}`;
const OPEN = order => !['PAGADO', 'CANCELADO'].includes(String(order.estado || '').toUpperCase());

// Panel que cae desde la barra superior (búsqueda y alertas).
function Popover({ visible, onClose, children, width = 600, align = 'center' }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (visible) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: reduceMotion() ? 0 : 140, easing: EASE_OUT, useNativeDriver: !WEB }).start(); } }, [visible]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <Pressable accessibilityLabel="Cerrar" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: align === 'right' ? 'flex-end' : 'center', paddingTop: 52, paddingHorizontal: 8, ...(WEB ? { cursor: 'default' } : {}) }}>
      <Animated.View onStartShouldSetResponder={() => true} style={{ width: '100%', maxWidth: width, maxHeight: '75%', borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface,
        opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
        ...(WEB ? { boxShadow: '0 12px 32px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)', cursor: 'auto' } : { borderWidth: 1, borderColor: c.line }) }}>
        {children}
      </Animated.View>
    </Pressable>
  </Modal>;
}

// Paleta de comandos: secciones, productos y cuentas abiertas. Ctrl/⌘+K o "/".
function CommandPalette({ open, onClose, onNavigate }) {
  const { c } = useTheme();
  const { productos, pedidos } = useAdmin();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  useEffect(() => { if (open) { setQuery(''); setIndex(0); } }, [open]);
  const results = useMemo(() => {
    const q = normalize(query.trim());
    const sections = NAV.filter(n => !q || normalize(`${n.label} ${n.description}`).includes(q)).map(n => ({ id: `s-${n.key}`, group: 'Secciones', icon: n.icon, title: n.label, subtitle: n.description, run: () => onNavigate(n.key) }));
    if (!q) return sections;
    const products = productos.filter(p => normalize(`${p.nombre} ${p.categoria_nombre}`).includes(q)).slice(0, 5)
      .map(p => ({ id: `p-${p.id}`, group: 'Productos', icon: UtensilsCrossed, title: p.nombre, subtitle: `${p.categoria_nombre || 'Sin categoría'} · ${money(p.precio)}`, run: () => onNavigate('menu') }));
    const orders = pedidos.filter(OPEN).filter(o => normalize(`${o.id} ${orderTarget(o)} ${o.mesero_nombre} ${o.cliente_nombre}`).includes(q)).slice(0, 5)
      .map(o => ({ id: `o-${o.id}`, group: 'Cuentas abiertas', icon: ClipboardList, title: `${orderTarget(o)} · #${o.id}`, subtitle: `${o.mesero_nombre || 'Sin mesero'} · ${money(o.total)}`, run: () => onNavigate('pedidos') }));
    return [...sections, ...orders, ...products];
  }, [query, productos, pedidos]);
  const choose = r => { onClose(); r?.run(); };
  const onKey = e => {
    const key = e.nativeEvent?.key;
    if (key === 'ArrowDown') { e.preventDefault?.(); setIndex(i => Math.min(results.length - 1, i + 1)); }
    if (key === 'ArrowUp') { e.preventDefault?.(); setIndex(i => Math.max(0, i - 1)); }
    if (key === 'Escape') onClose();
  };
  let lastGroup = null;
  return <Popover visible={open} onClose={onClose}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, height: 56, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Search size={18} color={c.muted} />
      <TextInput autoFocus value={query} onChangeText={t => { setQuery(t); setIndex(0); }} onKeyPress={onKey} onSubmitEditing={() => choose(results[index])}
        placeholder="Ir a una sección, buscar un producto o una cuenta…" placeholderTextColor={c.faint} accessibilityLabel="Buscar en el panel"
        style={[type.body, { flex: 1, fontSize: 15, color: c.text, height: 54, ...(WEB ? { outlineStyle: 'none' } : {}) }]} />
      <IconButton icon={X} label="Cerrar búsqueda" size={30} onPress={onClose} />
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.sm }}>
      {results.map((r, i) => {
        const header = r.group !== lastGroup ? r.group : null; lastGroup = r.group;
        const Icon = r.icon; const active = i === index;
        return <View key={r.id}>
          {header ? <Text style={[type.micro, { color: c.faint, paddingHorizontal: space.md, paddingTop: i ? space.md : space.xs, paddingBottom: space.xs }]}>{header}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => choose(r)} onHoverIn={() => setIndex(i)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, height: 48, borderRadius: radius.md, backgroundColor: active ? c.soft : 'transparent' }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}><Icon size={15} color={c.muted} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[type.small, { color: c.text, fontWeight: '600' }]}>{r.title}</Text>
              <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{r.subtitle}</Text>
            </View>
            {active ? <CornerDownLeft size={15} color={c.faint} /> : null}
          </Pressable>
        </View>;
      })}
      {!results.length ? <Text style={[type.small, { color: c.muted, textAlign: 'center', paddingVertical: space.x3 }]}>Nada coincide con “{query}”.</Text> : null}
    </ScrollView>
    {WEB ? <View style={{ flexDirection: 'row', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surfaceAlt }}>
      {[['↑↓', 'moverse'], ['Enter', 'abrir'], ['Esc', 'cerrar']].map(([k, l]) => <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ paddingHorizontal: 6, height: 20, borderRadius: 4, borderWidth: 1, borderColor: c.line, justifyContent: 'center', backgroundColor: c.surface }}><Text style={[type.micro, { color: c.muted }]}>{k}</Text></View>
        <Text style={[type.micro, { color: c.faint }]}>{l}</Text>
      </View>)}
    </View> : null}
  </Popover>;
}

function Alerts({ open, onClose, items, onNavigate }) {
  const { c } = useTheme();
  return <Popover visible={open} onClose={onClose} width={400} align="right">
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, height: 56, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Text style={[type.h3, { color: c.text }]}>Necesita atención</Text>
      <IconButton icon={X} label="Cerrar alertas" size={30} onPress={onClose} />
    </View>
    <ScrollView contentContainerStyle={{ padding: space.sm }}>
      {items.length ? items.map(n => { const Icon = n.icon; return <Press key={n.id} accessibilityRole="button" onPress={() => { onClose(); onNavigate(n.target); }} scaleTo={0.99}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md }} hoverStyle={{ backgroundColor: c.soft }}>
        <Icon size={17} color={n.tone === 'red' ? c.red : n.tone === 'amber' ? c.amber : c.muted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[type.small, { color: c.text, fontWeight: '600' }]}>{n.title}</Text>
          <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{n.body}</Text>
        </View>
        <ArrowRight size={15} color={c.faint} />
      </Press>; })
        : <Text style={[type.small, { color: c.muted, textAlign: 'center', paddingVertical: space.x3 }]}>Todo en orden. No hay nada pendiente.</Text>}
    </ScrollView>
  </Popover>;
}

export default function Header({ activeTab, onNavigate }) {
  const { pedidos, productos, mesas, inventario, reservas = [], syncStatus } = useAdmin();
  const { c, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 1024;
  const [palette, setPalette] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const item = navItem(activeTab);
  useEffect(() => {
    if (!WEB || typeof document === 'undefined') return;
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      else if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) { e.preventDefault(); setPalette(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const alerts = useMemo(() => {
    const now = Date.now();
    const toCharge = pedidos.filter(p => OPEN(p) && (p.cuenta_solicitada_at || p.estado === 'ENTREGADO'));
    const slow = pedidos.filter(p => OPEN(p) && ['PENDIENTE', 'PREPARANDO'].includes(String(p.estado).toUpperCase()) && now - new Date(String(p.created_at).replace(' ', 'T')).getTime() > 20 * 60000);
    const lowStock = (inventario || []).filter(i => Number(i.stock_minimo) > 0 && Number(i.stock_disponible ?? i.stock) <= Number(i.stock_minimo));
    const busyTable = r => r.mesa_id != null && ['Ocupada', 'Cuenta'].includes(mesas.find(t => Number(t.id) === Number(r.mesa_id))?.estado);
    const stamp = localStamp(), soon = reservas.filter(r => ['PENDIENTE', 'CONFIRMADA'].includes(r.estado) && dayOf(r.fecha_hora) === dayOf(stamp))
      .filter(r => { const m = minutesUntil(r, stamp); return m != null && m <= 30 && m >= -60; });
    return [
      ...slow.map(p => ({ id: `w-${p.id}`, tone: 'red', icon: AlertTriangle, title: `${orderTarget(p)} lleva más de 20 min`, body: `Pedido #${p.id} · ${String(p.estado).toLowerCase()}`, target: 'pedidos' })),
      ...soon.map(r => { const late = isLate(r, stamp), m = minutesUntil(r, stamp); return { id: `r-${r.id}`, tone: late ? 'red' : busyTable(r) ? 'amber' : 'neutral', icon: CalendarClock,
        title: late ? `${r.cliente_nombre} lleva ${-m} min de retraso` : busyTable(r) ? `Mesa ${r.mesa_numero} ocupada · reserva en ${Math.max(m, 0)} min` : `${r.cliente_nombre} llega ${m > 0 ? `en ${m} min` : 'ahora'}`, body: busyTable(r) ? `${r.cliente_nombre} · ${timeOf(r.fecha_hora)} · ${r.personas} personas` : `Reserva ${timeOf(r.fecha_hora)} · ${r.personas} personas · ${r.mesa_id != null ? `mesa ${r.mesa_numero}` : 'sin mesa'}`, target: 'reservas' }; }),
      ...toCharge.map(p => ({ id: `c-${p.id}`, tone: 'amber', icon: ClipboardList, title: `${orderTarget(p)} por cobrar`, body: `${money(Number(p.total) - Number(p.abonado || 0))} pendientes`, target: 'caja' })),
      ...lowStock.map(i => ({ id: `s-${i.id}`, tone: 'amber', icon: AlertTriangle, title: `Stock bajo: ${i.nombre}`, body: `Quedan ${Number(i.stock_disponible ?? i.stock)} ${i.unidad || ''} (mínimo ${Number(i.stock_minimo)})`, target: 'inventario' })),
    ];
  }, [pedidos, productos, mesas, inventario, reservas]);

  return <View style={{ height: 56, paddingLeft: compact ? 12 : 16, paddingRight: compact ? 8 : 12, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: '#1A1A1A' }}>
    <View style={{ width: compact ? undefined : 224, flex: compact ? 1 : undefined }}><Logo width={compact ? 96 : 112} dark /></View>
    {!compact ? <View style={{ flex: 1, alignItems: 'center' }}>
      <Press accessibilityRole="button" accessibilityLabel="Buscar en el panel" onPress={() => setPalette(true)} scaleTo={1}
        style={{ width: '100%', maxWidth: 560, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#4A4A4A', backgroundColor: '#303030', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 12 }}
        hoverStyle={{ borderColor: '#6B6B6B', backgroundColor: '#383838' }}>
        <Search size={16} color="#B5B5B5" />
        <Text numberOfLines={1} style={[type.body, { color: '#B5B5B5', flex: 1 }]}>Buscar</Text>
        {WEB ? <View style={{ flexDirection: 'row', gap: 4 }}>{['Ctrl', 'K'].map(k => <View key={k} style={{ paddingHorizontal: 5, height: 20, borderRadius: 4, backgroundColor: '#4A4A4A', justifyContent: 'center' }}><Text style={[type.small, { color: '#E3E3E3', fontSize: 11 }]}>{k}</Text></View>)}</View> : null}
      </Press>
    </View> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, width: compact ? undefined : 224, justifyContent: 'flex-end' }}>
      {syncStatus === 'disconnected' || syncStatus === 'error' ? <View accessibilityLiveRegion="polite" style={{ paddingHorizontal: 8 }}>
        <Text style={[type.small, { color: '#FFD79D' }]}>{compact ? 'Sin conexión' : 'Sin conexión · reintentando'}</Text>
      </View> : null}
      {compact ? <IconButton icon={Search} label="Buscar en el panel" onInk onPress={() => setPalette(true)} /> : null}
      <IconButton icon={Bell} label="Ver lo que necesita atención" onInk onPress={() => setAlertsOpen(true)} badge={alerts.length || null} />
      <ActionMenu label="Cuenta" actions={[
        { label: isDark ? 'Usar modo claro' : 'Usar modo oscuro', icon: isDark ? Sun : Moon, onPress: toggle },
        { divider: true },
        { label: 'Cerrar sesión', icon: LogOut, onPress: logout },
      ]} trigger={open => <Press accessibilityRole="button" accessibilityLabel={`Cuenta de ${user?.nombre || 'administración'}`} onPress={open} scaleTo={0.97}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 4, paddingRight: compact ? 4 : 10, borderRadius: 10 }} hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <Avatar name={user?.nombre || 'Admin'} size={28} />
        {!compact ? <Text numberOfLines={1} style={[type.body, { color: '#E3E3E3', fontWeight: '600', maxWidth: 140 }]}>{user?.nombre || 'Administración'}</Text> : null}
      </Press>} />
    </View>
    <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={onNavigate} />
    <Alerts open={alertsOpen} onClose={() => setAlertsOpen(false)} items={alerts} onNavigate={onNavigate} />
  </View>;
}
