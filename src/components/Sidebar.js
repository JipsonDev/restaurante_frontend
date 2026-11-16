import React, { useEffect, useState } from 'react';
import { ScrollView, Text, Pressable, View, Modal, Platform } from 'react-native';
import { Banknote, Menu, X, LayoutDashboard, LayoutGrid, LogOut, MapPin, Package, CirclePlus, Settings2, ShieldCheck, ShoppingBag, ChartNoAxesCombined, UsersRound, UtensilsCrossed, PanelLeftClose, PanelLeftOpen, ArrowUpRight, ChevronRight } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import Logo from './Logo';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const GROUPS = [
  { title: 'Operación', items: [
    { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard, tone: 'primary' },
    { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag, tone: 'amber' },
    { key: 'caja', label: 'Caja', icon: Banknote, tone: 'green' },
    { key: 'mesas', label: 'Mesas', icon: LayoutGrid, tone: 'sky' },
  ] },
  { title: 'Catálogo', items: [
    { key: 'menu', label: 'Menú', icon: UtensilsCrossed, tone: 'primary' },
    { key: 'extras', label: 'Extras', icon: CirclePlus, tone: 'purple' },
    { key: 'inventario', label: 'Inventario', icon: Package, tone: 'amber' },
    { key: 'ubicaciones', label: 'Ubicaciones', icon: MapPin, tone: 'sky' },
  ] },
  { title: 'Administración', items: [
    { key: 'trabajadores', label: 'Equipo', icon: UsersRound, tone: 'purple' },
    { key: 'reportes', label: 'Reportes', icon: ChartNoAxesCombined, tone: 'green' },
    { key: 'auditoria', label: 'Auditoría', icon: ShieldCheck, tone: 'sky' },
    { key: 'configuracion', label: 'Ajustes', icon: Settings2, tone: 'muted' },
  ] },
];
const NAV = GROUPS.flatMap(group => group.items);
const STORAGE = 'mm:admin-sidebar-collapsed';

function CoffeeMark({ size = 34, color }) {
  return <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Path d="M10 21h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9V21Z M32 23h3a6 6 0 0 1 0 12h-4 M7 43h31 M16 16c-5-5 5-7 0-12 M24 16c-5-5 5-7 0-12" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M32 7c4-3 8-2 10-1-1 4-5 7-9 6l-1-5Z M29 16l10-8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>;
}
function Ornament({ color }) {
  return <Svg width={105} height={96} viewBox="0 0 105 96" style={{ position: 'absolute', right: -12, top: -12 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Circle cx={77} cy={22} r={47} stroke={color} opacity={0.1} strokeWidth={1} fill="none" />
    <Circle cx={77} cy={22} r={32} stroke={color} opacity={0.12} strokeWidth={1} fill="none" />
    <Path d="M19 93C33 59 67 69 91 33M48 71c-9-18-5-31 3-37 10 14 11 25-3 37ZM65 58c-1-19 5-26 17-29 3 14-2 23-17 29Z" stroke={color} opacity={0.15} strokeWidth={1.5} fill="none" />
  </Svg>;
}

export default function Sidebar({ activeTab, setActiveTab, mode = 'side' }) {
  const { user, logout } = useAuth();
  const { pedidos, syncStatus } = useAdmin();
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') try { return window.localStorage.getItem(STORAGE) === '1'; } catch {}
    return false;
  });
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') try { window.localStorage.setItem(STORAGE, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);
  const small = mode === 'side' && collapsed;
  const connected = syncStatus === 'connected';
  const openOrders = pedidos.filter(p => !['PAGADO','CANCELADO'].includes(String(p.estado).toUpperCase())).length;
  const navigate = key => { setActiveTab(key); setOpen(false); };
  const primary = ['dashboard','pedidos','caja','menu'].map(key => NAV.find(item => item.key === key));
  const panel = <View style={{ width: mode === 'side' ? small ? 70 : 212 : '100%', flex: mode === 'side' ? undefined : 1, flexShrink: 0, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.line }}>
    <View style={{ paddingTop: mode === 'side' ? 17 : TOP_INSET + 18, paddingHorizontal: small ? 10 : 14, paddingBottom: 13, alignItems: small ? 'center' : 'stretch', gap: 13 }}>
      {small ? <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><CoffeeMark size={30} color={c.primaryText} /></View> : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Logo width={128} dark={c.isDark} style={!c.isDark ? { tintColor: c.text } : undefined} />
        {mode === 'side' ? <Pressable accessibilityRole="button" accessibilityLabel="Contraer navegación" accessibilityState={{ expanded: true }} onPress={() => setCollapsed(true)} style={({ hovered }) => ({ width: 32, height: 32, borderRadius: 8, backgroundColor: hovered ? c.soft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' })}><PanelLeftClose size={16} color={c.muted} /></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Cerrar navegación" onPress={() => setOpen(false)} style={{ padding: 9, borderRadius: 8, backgroundColor: c.surfaceAlt }}><X size={18} color={c.muted} /></Pressable>}
      </View>}
      {!small && <LinearGradient colors={c.isDark ? ['#25364E','#17243A'] : ['#FFF7E1','#FFFDF7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderWidth: 1, borderColor: c.isDark ? c.line : '#F3E4BD', borderRadius: 11, padding: 11, overflow: 'hidden' }}>
        <Ornament color={c.primaryText} />
        <Text style={{ color: c.primaryText, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }}>MORENA MIA</Text>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', marginTop: 4 }}>Panel de administración</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: connected ? c.green : c.amber }} /><Text numberOfLines={1} style={{ color: c.muted, fontSize: 9 }}>{connected ? 'Conectado al restaurante' : 'Conexión en recuperación'}</Text></View>
      </LinearGradient>}
      {mode === 'side' && small && <Pressable accessibilityRole="button" accessibilityLabel="Expandir navegación" accessibilityState={{ expanded: false }} onPress={() => setCollapsed(false)} style={({ hovered }) => ({ width: 42, height: 32, alignSelf: 'center', borderRadius: 8, backgroundColor: hovered ? c.soft : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' })}><PanelLeftOpen size={17} color={c.muted} /></Pressable>}
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: small ? 7 : 9, paddingBottom: 12 }}>
      {GROUPS.map((group, index) => <View key={group.title} style={{ marginBottom: 12 }}>
        {!small ? <Text style={{ paddingHorizontal: 10, marginBottom: 6, color: c.muted, fontSize: 8, fontWeight: '600', letterSpacing: 1.4 }}>{group.title.toUpperCase()}</Text> : index > 0 && <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: 10, marginBottom: 9 }} />}
        {group.items.map(({ key, label, icon: Icon, tone }) => {
          const selected = activeTab === key;
          const color = tone === 'primary' ? c.primaryText : c[tone] || c.muted;
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => navigate(key)} style={({ hovered, pressed }) => ({ minHeight: small ? 46 : 43, marginBottom: 2, borderRadius: 9, paddingHorizontal: small ? 2 : 8, paddingVertical: small ? 5 : 5, gap: small ? 0 : 9, flexDirection: 'row', alignItems: 'center', justifyContent: small ? 'center' : 'flex-start', backgroundColor: selected ? c.navigationActive || c.primarySoft : hovered ? c.surfaceAlt : 'transparent', opacity: pressed ? 0.72 : 1, borderWidth: 1, borderColor: selected ? c.isDark ? '#71551F' : '#F1DEAA' : 'transparent', overflow: 'hidden' })}>
            <View style={{ width: small ? 27 : 30, height: small ? 26 : 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.primary : c[`${tone}Soft`] || c.surfaceAlt }}><Icon size={17} strokeWidth={selected ? 2 : 1.7} color={selected ? c.onPrimary : color} /></View>
            {!small && <Text numberOfLines={1} style={{ flex: 1, color: selected ? c.text : c.muted, fontSize: 12, fontWeight: selected ? '700' : '500' }}>{label}</Text>}
            {!small && key === 'pedidos' && openOrders > 0 && <View style={{ minWidth: 22, height: 22, borderRadius: 7, paddingHorizontal: 5, backgroundColor: selected ? c.primary : c.amberSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: selected ? c.onPrimary : c.amber, fontSize: 10, fontWeight: '700' }}>{openOrders > 99 ? '99+' : openOrders}</Text></View>}
            {!small && selected && key !== 'pedidos' && <ChevronRight size={14} color={c.primaryText} />}
          </Pressable>;
        })}
      </View>)}
      {!small && <Pressable accessibilityRole="button" accessibilityLabel="Ver reportes del restaurante" onPress={() => navigate('reportes')} style={({ hovered }) => ({ borderRadius: 9, padding: 10, backgroundColor: hovered ? c.soft : c.surfaceAlt, flexDirection: 'row', alignItems: 'center', gap: 8 })}><ChartNoAxesCombined size={18} color={c.primaryText} /><View style={{ flex: 1 }}><Text style={{ fontSize: 10, color: c.text, fontWeight: '600' }}>El pulso de tu negocio</Text><Text style={{ fontSize: 9, color: c.muted, marginTop: 3 }}>Consulta tus reportes</Text></View><ArrowUpRight size={14} color={c.muted} /></Pressable>}
    </ScrollView>
    <View style={{ padding: small ? 8 : 10, borderTopWidth: 1, borderTopColor: c.line, flexDirection: small ? 'column' : 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>{(user?.nombre || 'A')[0].toUpperCase()}</Text></View>
      {!small && <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{user?.nombre || 'Administrador'}</Text><Text style={{ color: c.muted, fontSize: 10, marginTop: 3 }}>Administrador</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={logout} style={({ hovered }) => ({ padding: 9, borderRadius: 8, backgroundColor: hovered ? c.redSoft : c.surfaceAlt })}><LogOut size={17} color={c.muted} /></Pressable>
    </View>
  </View>;
  if (mode === 'side') return panel;
  return <>
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: BOTTOM_INSET, paddingHorizontal: 8, paddingTop: 5 }}>
      {[...primary, { key: 'more', label: 'Más', icon: Menu }].map(({ key, label, icon: Icon }) => {
        const selected = key === 'more' ? open || !primary.some(item => item.key === activeTab) : key === activeTab;
        return <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === 'more' ? 'Más secciones' : label} accessibilityState={{ selected }} onPress={() => key === 'more' ? setOpen(true) : navigate(key)} style={{ flex: 1, minHeight: 59, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <View style={{ width: 42, height: 28, borderRadius: 9, backgroundColor: selected ? c.primarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Icon size={19} color={selected ? c.primaryText : c.muted} strokeWidth={selected ? 2 : 1.7} /></View><Text style={{ fontSize: 10, color: selected ? c.primaryText : c.muted, fontWeight: selected ? '700' : '500' }}>{label}</Text>
        </Pressable>;
      })}
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: c.overlay, flexDirection: 'row' }}><View style={{ width: '88%', maxWidth: 320, paddingBottom: BOTTOM_INSET }}>{panel}</View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setOpen(false)} style={{ flex: 1 }} /></View>
    </Modal>
  </>;
}
