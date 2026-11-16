import React, { useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { AdminProvider, useAdmin } from '../context/AdminContext';
import { useTheme, AdminAppearance } from '../theme';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DashboardScreen from '../screens/DashboardScreen';
import MenuScreen from '../screens/MenuScreen';
import TablesScreen from '../screens/TablesScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ExtrasScreen from '../screens/ExtrasScreen';
import InventoryScreen from '../screens/InventoryScreen';
import LocationsScreen from '../screens/LocationsScreen';
import TeamScreen from '../screens/TeamScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuditScreen from '../screens/AuditScreen';
import AdminSectionScreen from '../screens/AdminSectionScreen';
import { TOP_INSET } from '../utils/safeArea';

function ReadErrorBanner() {
  const { readError, refreshAll } = useAdmin();
  const { c } = useTheme();
  if (!readError) return null;
  return <View accessibilityRole="alert" style={{ margin: 10, padding: 12, backgroundColor: c.surface, borderColor: c.amber, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Text style={{ color: c.text, flex: 1 }}>{readError}</Text>
    <Pressable accessibilityRole="button" onPress={refreshAll} style={{ padding: 12 }}><Text style={{ color: c.primaryText, fontWeight: '700' }}>Reintentar</Text></Pressable>
  </View>;
}

function ActiveScreen({ tab, setActiveTab }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardScreen setActiveTab={setActiveTab} />;
    case 'menu':
      return <MenuScreen />;
    case 'extras':
      return <ExtrasScreen />;
    case 'inventario':
      return <InventoryScreen />;
    case 'ubicaciones':
      return <LocationsScreen onNavigate={setActiveTab} />;
    case 'trabajadores':
      return <TeamScreen />;
    case 'reportes':
      return <ReportsScreen />;
    case 'configuracion':
      return <SettingsScreen />;
    case 'auditoria':
      return <AuditScreen />;
    case 'mesas':
      return <TablesScreen />;
    case 'pedidos':
      return <OrdersScreen onNavigate={setActiveTab} />;
    default:
      return <AdminSectionScreen tab={tab} setActiveTab={setActiveTab} />;
  }
}

function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 1024;

  return (
    <AdminProvider>
      <View
        style={{
          flex: 1,
          flexDirection: isCompact ? 'column' : 'row',
          paddingTop: isCompact ? TOP_INSET : 0,
          backgroundColor: c.bg,
        }}
      >
        {!isCompact && <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Header activeTab={activeTab} onNavigate={setActiveTab} />
          <ReadErrorBanner />
          <View style={{ flex: 1, backgroundColor: c.bg, padding: isCompact ? 16 : 28 }}>
            <View style={{ flex: 1, width: '100%', maxWidth: 1480, alignSelf: 'center' }}>
              <ActiveScreen tab={activeTab} setActiveTab={setActiveTab} />
            </View>
          </View>
        </View>
        {isCompact && <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} mode="bottom" />}
      </View>
    </AdminProvider>
  );
}

export default function AdminApp() {
  return <AdminAppearance><AdminLayout /></AdminAppearance>;
}
