// Navegación del panel al estilo admin de comercio: columna gris clara con elementos compactos;
// el activo queda en blanco con texto en negrita. Ajustes se fija abajo. En celular, barra inferior + «Más».
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Menu, X } from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import { useTheme } from '../theme';
import { Press, space, type } from './admin/ui';
import { MOBILE_PRIMARY, NAV, NAV_GROUPS } from './admin/nav';
import { BOTTOM_INSET, TOP_INSET } from '../utils/safeArea';

const PINNED = 'configuracion';

function NavItem({ item, selected, badge, onPress }) {
  const { c } = useTheme();
  const Icon = item.icon;
  return <Press accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }} onPress={onPress} scaleTo={1}
    style={{ height: 32, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8,
      backgroundColor: selected ? c.navigationActive : 'transparent',
      ...(selected && !c.isDark ? { boxShadow: '0 1px 0 0 rgba(0,0,0,0.05)' } : {}) }}
    hoverStyle={selected ? null : { backgroundColor: c.isDark ? '#2A2A2A' : '#F7F7F7' }}>
    <Icon size={16} strokeWidth={2} color={selected ? c.text : c.muted} />
    <Text numberOfLines={1} style={[type.body, { flex: 1, color: c.text, fontWeight: selected ? '700' : '500' }]}>{item.label}</Text>
    {badge ? <View style={{ minWidth: 20, height: 18, paddingHorizontal: 6, borderRadius: 6, backgroundColor: selected ? c.softer : c.isDark ? '#383838' : '#DCDCDC', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[type.small, type.num, { color: c.text, fontWeight: '600' }]}>{badge}</Text>
    </View> : null}
  </Press>;
}

function Panel({ activeTab, navigate, sheet }) {
  const { pedidos, reservas = [] } = useAdmin();
  const { c } = useTheme();
  const openOrders = pedidos.filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado).toUpperCase())).length;
  const today = new Date(); const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayRes = reservas.filter(r => String(r.fecha_hora).startsWith(day) && ['PENDIENTE', 'CONFIRMADA'].includes(r.estado)).length;
  const badgeFor = key => key === 'pedidos' ? openOrders || null : key === 'reservas' ? todayRes || null : null;
  const pinned = NAV.find(item => item.key === PINNED);
  return <View style={{ width: sheet ? '100%' : 240, flex: sheet ? 1 : undefined, backgroundColor: c.isDark ? '#1F1F1F' : '#EBEBEB', borderRightWidth: c.isDark ? 1 : 0, borderRightColor: c.line, paddingTop: sheet ? TOP_INSET + space.md : space.md }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.sm, paddingBottom: space.lg }}>
      {NAV_GROUPS.map((group, gi) => <View key={group.title} style={{ marginTop: gi ? space.lg : 0 }}>
        {gi ? <Text style={[type.small, { color: c.muted, paddingHorizontal: 8, marginBottom: 4, fontWeight: '600' }]}>{group.title}</Text> : null}
        <View style={{ gap: 1 }}>
          {group.items.filter(item => item.key !== PINNED).map(item => <NavItem key={item.key} item={item} selected={activeTab === item.key}
            badge={badgeFor(item.key)} onPress={() => navigate(item.key)} />)}
        </View>
      </View>)}
    </ScrollView>
    {pinned ? <View style={{ paddingHorizontal: space.sm, paddingVertical: space.sm, paddingBottom: sheet ? BOTTOM_INSET + space.sm : space.sm }}>
      <NavItem item={pinned} selected={activeTab === PINNED} onPress={() => navigate(PINNED)} />
    </View> : null}
  </View>;
}

export default function Sidebar({ activeTab, setActiveTab, mode = 'side' }) {
  const { c } = useTheme();
  const { pedidos } = useAdmin();
  const [open, setOpen] = useState(false);
  const navigate = key => { setActiveTab(key); setOpen(false); };

  if (mode === 'side') return <Panel activeTab={activeTab} navigate={navigate} />;

  const openOrders = pedidos.filter(p => !['PAGADO', 'CANCELADO'].includes(String(p.estado).toUpperCase())).length;
  const primary = MOBILE_PRIMARY.map(key => NAV.find(item => item.key === key));
  const onPrimary = primary.some(item => item.key === activeTab);
  return <>
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: BOTTOM_INSET, paddingHorizontal: 4, paddingTop: 4 }}>
      {[...primary, { key: 'more', label: 'Más', icon: Menu }].map(({ key, label, icon: Icon }) => {
        const selected = key === 'more' ? open || !onPrimary : key === activeTab;
        return <Press key={key} accessibilityRole="button" accessibilityLabel={key === 'more' ? 'Más secciones' : label} accessibilityState={{ selected }}
          onPress={() => key === 'more' ? setOpen(true) : navigate(key)} scaleTo={0.94}
          style={{ flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <View>
            <Icon size={20} strokeWidth={selected ? 2.4 : 1.8} color={selected ? c.text : c.muted} />
            {key === 'pedidos' && openOrders ? <View style={{ position: 'absolute', top: -3, right: -10, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: c.surface, fontSize: 10, fontWeight: '700' }}>{openOrders}</Text>
            </View> : null}
          </View>
          <Text style={[type.small, { color: selected ? c.text : c.muted, fontWeight: selected ? '700' : '500', fontSize: 11 }]}>{label}</Text>
        </Press>;
      })}
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: c.overlay, flexDirection: 'row' }}>
        <View style={{ width: '82%', maxWidth: 300 }}>
          <Panel activeTab={activeTab} navigate={navigate} sheet />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setOpen(false)} style={{ flex: 1, alignItems: 'flex-end', padding: 16, paddingTop: TOP_INSET + 16 }}>
          <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={c.text} /></View>
        </Pressable>
      </View>
    </Modal>
  </>;
}
