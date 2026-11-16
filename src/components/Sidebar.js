import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import Logo from './Logo';
import { Avatar, EASE_OUT, IconButton, Press, font, reduceMotion, space, type } from './admin/ui';
import { MOBILE_PRIMARY, NAV, NAV_GROUPS } from './admin/nav';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const STORAGE = 'mm:admin-sidebar-collapsed';
const ROLE = { admin: 'Administración', supervisor: 'Supervisión', caja: 'Caja' };
const WEB = Platform.OS === 'web';

function readCollapsed() {
  if (WEB && typeof window !== 'undefined') try { return window.localStorage.getItem(STORAGE) === '1'; } catch {}
  return false;
}

function NavItem({ item, selected, collapsed, badge, onPress }) {
  const { c } = useTheme();
  const Icon = item.icon;
  return <Press accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={onPress} scaleTo={0.98}
    {...(WEB && collapsed ? { title: item.label } : {})}
    style={{ height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: collapsed ? 0 : 12, justifyContent: collapsed ? 'center' : 'flex-start',
      backgroundColor: selected ? c.navigationActive : 'transparent' }}
    hoverStyle={selected ? null : { backgroundColor: c.soft }}>
    <Icon size={18} strokeWidth={selected ? 2.2 : 1.9} color={selected ? c.text : c.muted} />
    {!collapsed ? <Text numberOfLines={1} style={[type.body, { flex: 1, color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '500' }]}>{item.label}</Text> : null}
    {badge ? (collapsed
      ? <View style={{ position: 'absolute', top: 7, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
      : <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: selected ? c.primary : c.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[type.micro, type.num, { color: selected ? c.onPrimary : c.text, fontWeight: '700' }]}>{badge}</Text>
      </View>) : null}
  </Press>;
}

function Panel({ activeTab, navigate, collapsed, setCollapsed, mode }) {
  const { user, logout } = useAuth();
  const { pedidos } = useAdmin();
  const { c } = useTheme();
  const openOrders = pedidos.filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado).toUpperCase())).length;
  const small = mode === 'side' && collapsed;

  // Indicador dorado que se desliza hasta el elemento activo.
  const positions = useRef({});
  const y = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const moveTo = (key, instant) => {
    const pos = positions.current[key]; if (pos == null) return;
    if (instant || reduceMotion()) y.setValue(pos);
    else Animated.timing(y, { toValue: pos, duration: 240, easing: EASE_OUT, useNativeDriver: !WEB }).start();
  };
  useEffect(() => { moveTo(activeTab); }, [activeTab]);

  return <View style={{ width: mode === 'side' ? (small ? 68 : 236) : '100%', flex: mode === 'side' ? undefined : 1, backgroundColor: c.surface, borderRightWidth: mode === 'side' ? 1 : 0, borderRightColor: c.line }}>
    <View style={{ height: 64, paddingHorizontal: small ? 0 : 16, flexDirection: 'row', alignItems: 'center', justifyContent: small ? 'center' : 'space-between', paddingTop: mode === 'side' ? 0 : TOP_INSET }}>
      {!small ? <Logo width={118} dark={c.isDark} style={!c.isDark ? { tintColor: c.text } : undefined} /> : null}
      {mode === 'side'
        ? <IconButton icon={small ? PanelLeftOpen : PanelLeftClose} label={small ? 'Expandir menú' : 'Contraer menú'} size={32} onPress={() => setCollapsed(!small)} />
        : null}
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: small ? 10 : 12, paddingBottom: space.lg }}>
      <View>
        {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', left: small ? -10 : -12, top: 0, width: 3, height: 22, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: c.primary,
          transform: [{ translateY: y }] }} /> : null}
        {NAV_GROUPS.map((group, gi) => <View key={group.title} style={{ marginTop: gi ? space.lg : space.xs }}>
          {!small ? <Text style={[type.micro, { color: c.faint, paddingHorizontal: 12, marginBottom: 6, fontWeight: '500' }]}>{group.title}</Text>
            : gi ? <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: 10, marginBottom: space.sm }} /> : null}
          <View style={{ gap: 2 }}>
            {group.items.map(item => <NavItem key={item.key} item={item} collapsed={small} selected={activeTab === item.key}
              badge={item.key === 'pedidos' && openOrders ? openOrders : null} onPress={() => navigate(item.key)} />)}
          </View>
        </View>)}
        <NavMeasure groups={NAV_GROUPS} small={small} onMeasured={map => { positions.current = map; moveTo(activeTab, true); setReady(true); }} />
      </View>
    </ScrollView>
    <View style={{ padding: small ? 10 : 12, borderTopWidth: 1, borderTopColor: c.line, flexDirection: small ? 'column' : 'row', alignItems: 'center', gap: space.sm, paddingBottom: (mode === 'side' ? 12 : BOTTOM_INSET + 12) }}>
      <Avatar name={user?.nombre || 'Admin'} size={34} tone="gold" />
      {!small ? <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[type.small, { color: c.text, fontWeight: '600' }]}>{user?.nombre || 'Administrador'}</Text>
        <Text numberOfLines={1} style={[type.micro, { color: c.faint }]}>{ROLE[user?.rol] || 'Administración'}</Text>
      </View> : null}
      <IconButton icon={LogOut} label="Cerrar sesión" size={34} onPress={logout} />
    </View>
  </View>;
}

// Calcula la posición vertical (centrada) de cada elemento de navegación a partir de la
// geometría fija del menú, sin depender del orden de los eventos de layout.
function NavMeasure({ groups, small, onMeasured }) {
  useEffect(() => {
    const map = {}; let yPos = 0;
    groups.forEach((group, gi) => {
      yPos += gi ? space.lg : space.xs;
      yPos += small ? (gi ? 1 + space.sm : 0) : 16 + 6;
      group.items.forEach((item, ii) => { map[item.key] = yPos + 9; yPos += 40 + (ii < group.items.length - 1 ? 2 : 0); });
    });
    onMeasured(map);
  }, [small]);
  return null;
}

export default function Sidebar({ activeTab, setActiveTab, mode = 'side' }) {
  const { c } = useTheme();
  const { pedidos } = useAdmin();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = value => { setCollapsedState(value); if (WEB) try { window.localStorage.setItem(STORAGE, value ? '1' : '0'); } catch {} };
  const navigate = key => { setActiveTab(key); setOpen(false); };

  if (mode === 'side') return <Panel activeTab={activeTab} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} mode="side" />;

  const openOrders = pedidos.filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado).toUpperCase())).length;
  const primary = MOBILE_PRIMARY.map(key => NAV.find(item => item.key === key));
  const onPrimary = primary.some(item => item.key === activeTab);
  return <>
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: BOTTOM_INSET, paddingHorizontal: 6, paddingTop: 6 }}>
      {[...primary, { key: 'more', label: 'Más', icon: Menu }].map(({ key, label, icon: Icon }) => {
        const selected = key === 'more' ? open || !onPrimary : key === activeTab;
        return <Press key={key} accessibilityRole="button" accessibilityLabel={key === 'more' ? 'Más secciones' : label} accessibilityState={{ selected }}
          onPress={() => key === 'more' ? setOpen(true) : navigate(key)} scaleTo={0.92}
          style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <View style={{ width: 48, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.primarySoft : 'transparent' }}>
            <Icon size={20} strokeWidth={selected ? 2.2 : 1.9} color={selected ? c.text : c.muted} />
            {key === 'pedidos' && openOrders ? <View style={{ position: 'absolute', top: 2, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, borderWidth: 1.5, borderColor: c.surface }} /> : null}
          </View>
          <Text style={[type.micro, { color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '500', fontSize: 11 }]}>{label}</Text>
        </Press>;
      })}
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: c.overlay, flexDirection: 'row' }}>
        <View style={{ width: '86%', maxWidth: 320 }}>
          <Panel activeTab={activeTab} navigate={navigate} collapsed={false} setCollapsed={() => {}} mode="sheet" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setOpen(false)} style={{ flex: 1, alignItems: 'flex-end', padding: 16, paddingTop: TOP_INSET + 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><X size={20} color={c.text} /></View>
        </Pressable>
      </View>
    </Modal>
  </>;
}
