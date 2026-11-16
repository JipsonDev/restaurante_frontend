import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Menu, X, Users, Receipt, ChefHat, BadgePercent, Bell, Sun, Moon, RefreshCw, LogOut, ChevronRight, ShoppingBag, FileText } from 'lucide-react-native';
import Logo from './Logo';
import { connectionState } from '../utils/waiterSync.mjs';

const items = [['mesas', 'Mesas', 'Salón y mesas', Users], ['express', 'Express', 'Express y delivery', ShoppingBag], ['productos', 'Menú', 'Catálogo de productos', ChefHat], ['promociones', 'Promos', 'Ofertas y combos', BadgePercent], ['pedido', 'Pedido', 'Comanda actual', Receipt]];
const font = Platform.OS === 'web' ? { fontFamily: 'Manrope, "Segoe UI", system-ui, sans-serif' } : {};
const Label = ({ style, ...props }) => <Text {...props} style={[font, style]} />;
function IconButton({ label, onPress, Icon, c, badge, expanded, badgeColor, badgeTextColor }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress} style={({ pressed, hovered }) => ({ width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed || hovered ? c.elevated : 'transparent' })}>
    <Icon size={21} strokeWidth={1.8} color={c.ink} />
    {badge > 0 ? <View style={{ position: 'absolute', right: 2, top: 2, backgroundColor: badgeColor || c.danger, borderWidth: 2, borderColor: c.surface, borderRadius: 10, minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center' }}><Label style={{ color: badgeTextColor || (c.isDark ? '#291820' : '#fff'), fontSize: 9, fontWeight: '500' }}>{badge > 9 ? '9+' : badge}</Label></View> : null}
  </Pressable>;
}

export default function WaiterNavigation({ colors: c, width, step, navigate, menuOpen, setMenuOpen, name, dark, toggleTheme, unread, notifications, refresh, logout, connection, expressCount, cartCount = 0, draftCount = 0, draftAttention = false, openDrafts, contextLabel, topInset = 0, bottomInset = 0, lastSyncAt, syncing, syncError, delayCount = 0 }) {
  const phone = width < 600;
  const showDrafts = draftCount > 0 || draftAttention;
  // Drafts remain in the drawer when zoom leaves too little room in the header.
  const showHeaderDrafts = showDrafts && width >= 300;
  const inline = width >= 1280;
  const state = connectionState({connection,lastSyncAt,syncing,error:syncError});
  const connected = state.key === 'live';
  const status = state.label;
  const syncLabel = lastSyncAt ? `Actualizado: ${new Date(lastSyncAt).toDateString()===new Date().toDateString()?new Date(lastSyncAt).toLocaleTimeString('es-EC',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):new Date(lastSyncAt).toLocaleString('es-EC')}` : 'Actualizado: pendiente';
  const initials = String(name || 'Mesero').trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const navItems = (drawer = false) => items.map(([key, label, detail, Icon]) => {
    const active = step === key;
    return <Pressable key={key} accessibilityRole="button" accessibilityLabel={drawer ? detail : label} accessibilityState={{ selected: active }} onPress={() => { setMenuOpen(false); navigate(key); }}
      style={({ pressed, hovered }) => ({ flex: drawer ? undefined : 1, minWidth: 0, minHeight: drawer ? 48 : phone ? 52 : 46, paddingHorizontal: drawer ? 14 : 4, paddingVertical: 8, borderRadius: drawer || inline ? 10 : 0, flexDirection: drawer || !phone ? 'row' : 'column', alignItems: 'center', justifyContent: drawer ? 'flex-start' : 'center', gap: drawer ? 12 : phone ? 5 : 8, backgroundColor: active && (drawer || inline) ? c.softOrange : pressed || hovered ? c.field : 'transparent', borderBottomWidth: drawer || inline ? 0 : 3, borderBottomColor: active ? c.brand : 'transparent' })}>
      <View><Icon size={drawer ? 20 : phone ? 20 : 18} strokeWidth={active ? 2.1 : 1.7} color={active ? c.brand : c.muted} />{!drawer && key === 'express' && expressCount > 0 ? <View style={{ position: 'absolute', right: -4, top: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand }} /> : null}</View>
      <Label numberOfLines={1} style={{ color: active ? c.brand : c.muted, fontWeight: active ? '600' : '400', fontSize: drawer ? 14 : phone ? 11 : 13, flex: drawer ? 1 : undefined }}>{drawer ? detail : label}</Label>
      {key === 'pedido' && cartCount > 0 ? <View style={{ backgroundColor: c.softOrange, minWidth: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center', position: phone && !drawer ? 'absolute' : undefined, top: phone && !drawer ? 1 : undefined, right: phone && !drawer ? 8 : undefined }}><Label style={{ color: c.isDark ? c.brand : c.ink, fontSize: 10 }}>{cartCount}</Label></View> : null}
      {drawer ? <ChevronRight size={15} color={active ? c.brand : c.faint} /> : null}
    </Pressable>;
  });
  const connectionLabel = <View style={{gap:4,minWidth:0}}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connected ? c.success : c.warning }} /><Label style={{ color: c.muted, fontSize: 11,flexShrink:1 }}>{status}</Label></View><Label accessibilityLabel={`Última sincronización de mesas y pedidos: ${syncLabel.replace('Actualizado: ','')}`} style={{color:c.muted,fontSize:10}}>{syncLabel}</Label></View>;
  return <>
    <View style={{ backgroundColor: c.secondary, borderBottomWidth: 1, borderBottomColor: c.line, flexShrink: 0, paddingTop: topInset }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: phone ? 64 : 72, paddingHorizontal: phone ? 12 : 24, gap: phone ? 6 : 14 }}>
        <IconButton label="Abrir menú" expanded={menuOpen} Icon={Menu} onPress={() => setMenuOpen(true)} c={c} />
        <View style={{ flex: inline ? undefined : 1, minWidth: 0, alignItems: phone ? 'center' : 'flex-start', justifyContent: 'center' }}><Logo width={phone ? Math.max(100, Math.min(156, width - (showHeaderDrafts ? 174 : 124))) : 165} dark={dark} /></View>
        {inline ? <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>{navItems()}</View> : null}
        {!phone ? <View style={{ alignItems: 'flex-end', gap: 5, maxWidth: inline ? 140 : 190 }}><Label numberOfLines={1} style={{ color: c.ink, fontSize: 13, fontWeight: '600' }}>{name}</Label>{connectionLabel}</View> : null}
        {!phone ? <IconButton label={dark ? 'Usar tema claro' : 'Usar tema oscuro'} Icon={dark ? Sun : Moon} onPress={toggleTheme} c={c} /> : null}
        {showHeaderDrafts ? <IconButton label={`Ver borradores (${draftCount})${draftAttention ? ' · atención pendiente' : ''}`} Icon={FileText} onPress={openDrafts} c={c} badge={draftCount || 1} badgeColor={draftAttention ? c.warning : c.brand} badgeTextColor={c.onAccent} /> : null}
        <IconButton label="Ver notificaciones" Icon={Bell} onPress={notifications} c={c} badge={unread} badgeColor={delayCount?c.warning:undefined} badgeTextColor={delayCount?c.onAccent:undefined} />
      </View>
      {!inline ? <View style={{ flexDirection: 'row', paddingHorizontal: phone ? 8 : 24, borderTopWidth: 1, borderTopColor: c.line }}>{navItems()}</View> : null}
      {phone?<View style={{paddingHorizontal:16,paddingVertical:7,borderTopWidth:1,borderColor:c.line,flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'space-between'}}><Label style={{color:connected?c.muted:c.warning,fontSize:10}}>{status}</Label><Label accessibilityLabel={`Última sincronización de mesas y pedidos: ${syncLabel.replace('Actualizado: ','')}`} style={{color:c.muted,fontSize:10}}>{syncLabel}</Label></View>:null}
    </View>
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: dark ? '#050B17BB' : '#13233866' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú lateral" onPress={() => setMenuOpen(false)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
        <View accessibilityViewIsModal style={{ width: Math.min(width - 24, 300), height: '100%', backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.line, paddingTop: topInset }}>
          <View style={{ paddingHorizontal: 18, minHeight: 76, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.line }}><Logo width={170} dark={dark} /><IconButton label="Cerrar menú" Icon={X} onPress={() => setMenuOpen(false)} c={c} /></View>
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: bottomInset + 20, flexGrow: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.softOrange, justifyContent: 'center', alignItems: 'center' }}><Label style={{ color: c.brand, fontWeight: '700', fontSize: 15 }}>{initials}</Label></View>
              <View style={{ flex: 1, gap: 5 }}><Label numberOfLines={1} style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{name}</Label><Label style={{ color: c.muted, fontSize: 11 }}>ÁREA DE SERVICIO</Label></View>
            </View>
            <View style={{ padding: 14, borderRadius: 10, backgroundColor: c.field, gap: 9, marginBottom: 22 }}>{connectionLabel}<Label style={{ color: c.ink, fontSize: 12, lineHeight: 18 }}>{contextLabel}</Label></View>
            <Label style={{ fontSize: 10, letterSpacing: 1.4, color: c.faint, marginBottom: 10, paddingLeft: 14 }}>ESPACIO DE TRABAJO</Label>
            <View style={{ gap: 4 }}>{navItems(true)}</View>
            {showDrafts ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir borradores guardados" onPress={() => { setMenuOpen(false); openDrafts(); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}><FileText size={19} color={c.brand} /><Label style={{ color: c.ink, fontSize: 13 }}>Borradores guardados · {draftCount}</Label></Pressable> : null}
            <View style={{ height: 1, backgroundColor: c.line, marginVertical: 18 }} />
            {[[RefreshCw, 'Actualizar datos', refresh], [dark ? Sun : Moon, dark ? 'Usar tema claro' : 'Usar tema oscuro', toggleTheme]].map(([Icon, label, action]) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => { setMenuOpen(false); action(); }} style={({ pressed, hovered }) => ({ minHeight: 48, borderRadius: 10, flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 14, backgroundColor: pressed || hovered ? c.elevated : 'transparent' })}><Icon size={19} color={c.muted} /><Label style={{ color: c.ink, fontSize: 13 }}>{label}</Label></Pressable>)}
            <View style={{ flex: 1, minHeight: 24 }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" onPress={logout} style={({ pressed }) => ({ minHeight: 48, borderRadius: 10, backgroundColor: pressed ? c.field : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 })}><LogOut size={19} color={c.danger} /><Label style={{ color: c.danger, fontSize: 13 }}>Cerrar sesión</Label></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
