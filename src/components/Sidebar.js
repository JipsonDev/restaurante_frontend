import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  DollarSign,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  PlusCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
  Utensils,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import Logo from './Logo';
import { BOTTOM_INSET } from '../utils/safeArea';

const GROUPS = [
  {
    title: 'Operacion',
    items: [
      { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
      { key: 'pedidos', label: 'Pedidos', icon: ShoppingBag },
      { key: 'caja', label: 'Caja', icon: DollarSign },
      { key: 'mesas', label: 'Mesas', icon: LayoutGrid },
    ],
  },
  {
    title: 'Catalogos',
    items: [
      { key: 'menu', label: 'Menu', icon: Utensils },
      { key: 'extras', label: 'Extras', icon: PlusCircle },
      { key: 'inventario', label: 'Inventario', icon: Package },
      { key: 'ubicaciones', label: 'Ubicaciones', icon: MapPin },
    ],
  },
  {
    title: 'Auditoria',
    items: [
      { key: 'auditoria', label: 'Seguridad', icon: ShieldCheck },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { key: 'trabajadores', label: 'Equipo', icon: Users },
      { key: 'reportes', label: 'Reportes', icon: TrendingUp },
      { key: 'configuracion', label: 'Ajustes', icon: Settings },
    ],
  },
];

const NAV = GROUPS.flatMap((group) => group.items);

export default function Sidebar({ activeTab, setActiveTab, mode = 'side' }) {
  const { user, logout } = useAuth();
  const { c } = useTheme();

  if (mode === 'bottom') {
    return (
      <View style={{ paddingBottom: BOTTOM_INSET, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8 }}>
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setActiveTab(key)}
                style={{ minWidth: 84, height: 58, borderRadius: 10, marginRight: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.primarySoft : c.surfaceAlt, borderWidth: 1, borderColor: active ? c.primary : c.line }}
              >
                <Icon size={18} color={active ? c.primaryText : c.muted} />
                <Text style={{ marginTop: 4, color: active ? c.primaryText : c.muted, fontSize: 11, fontWeight: '900' }} numberOfLines={1}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ width: 276, backgroundColor: c.surface, borderRightWidth: 1, borderRightColor: c.line }}>
      <View style={{ paddingHorizontal: 22, paddingVertical: 22, borderBottomWidth: 1, borderBottomColor: c.line, alignItems: 'center' }}>
        <Logo height={64} dark={c.isDark} />
        <Text style={{ color: c.faint, fontSize: 12, fontWeight: '800', marginTop: 10, textAlign: 'center' }}>Panel administrativo</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
        {GROUPS.map((group) => (
          <View key={group.title} style={{ marginBottom: 18 }}>
            <Text style={{ color: c.faint, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, marginBottom: 8, paddingHorizontal: 8, textTransform: 'uppercase' }}>
              {group.title}
            </Text>
            {group.items.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActiveTab(key)}
                  style={{
                    height: 44,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    marginBottom: 5,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: active ? c.primarySoft : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? c.primary : 'transparent',
                  }}
                >
                  {active ? <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: c.primary, marginRight: 10 }} /> : null}
                  <Icon size={18} color={active ? c.primaryText : c.muted} />
                  <Text style={{ marginLeft: 12, color: active ? c.primaryText : c.text, fontSize: 14, fontWeight: active ? '900' : '800' }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: c.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft }}>
            <Text style={{ color: c.primaryText, fontWeight: '900' }}>{(user?.nombre || 'A').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: c.text, fontWeight: '900' }} numberOfLines={1}>{user?.nombre || 'Administrador'}</Text>
            <Text style={{ color: c.faint, fontSize: 12, fontWeight: '800' }}>{user?.rol || 'admin'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={{ height: 42, borderRadius: 12, backgroundColor: c.redSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
          <LogOut size={16} color={c.red} />
          <Text style={{ color: c.red, fontWeight: '900', marginLeft: 8 }}>Cerrar sesion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
