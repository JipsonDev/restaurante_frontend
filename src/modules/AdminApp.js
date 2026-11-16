import React, { useEffect, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { AlertCircle } from 'lucide-react-native';
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
import CashScreen from '../screens/CashScreen';
import { Button, FadeIn, ToastProvider, space, type } from '../components/admin/ui';
import { TOP_INSET } from '../utils/safeArea';

const WEB = Platform.OS === 'web';

// Detalles del navegador que también son parte del diseño: selección, foco,
// barras de desplazamiento y cifras tabulares, tomados de la paleta del panel.
function useAdminBrowserStyle(c) {
  useEffect(() => {
    if (!WEB || typeof document === 'undefined') return;
    let el = document.getElementById('mm-admin-style');
    if (!el) { el = document.createElement('style'); el.id = 'mm-admin-style'; document.head.appendChild(el); }
    el.textContent = `
      [data-mm-admin] ::selection { background: ${c.primarySoft}; color: ${c.text}; }
      [data-mm-admin] input, [data-mm-admin] textarea { caret-color: ${c.primary}; }
      [data-mm-admin] [role="button"]:focus-visible, [data-mm-admin] [role="tab"]:focus-visible, [data-mm-admin] [role="switch"]:focus-visible,
      [data-mm-admin] a:focus-visible { outline: 2px solid ${c.primary}; outline-offset: 2px; border-radius: 10px; }
      [data-mm-admin] ::-webkit-scrollbar { width: 10px; height: 10px; }
      [data-mm-admin] ::-webkit-scrollbar-thumb { background: ${c.lineStrong}; border-radius: 10px; border: 3px solid ${c.bg}; }
      [data-mm-admin] ::-webkit-scrollbar-track { background: transparent; }
      [data-mm-admin] { scrollbar-color: ${c.lineStrong} transparent; }
      @media (prefers-reduced-motion: reduce) { [data-mm-admin] * { transition: none !important; } }
    `;
  }, [c]);
}

function ReadErrorBanner() {
  const { readError, refreshAll } = useAdmin();
  const { c } = useTheme();
  if (!readError) return null;
  return <FadeIn>
    <View accessibilityRole="alert" style={{ marginHorizontal: space.xxl, marginTop: space.lg, paddingVertical: 10, paddingHorizontal: space.lg, backgroundColor: c.amberSoft, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <AlertCircle size={18} color={c.amber} />
      <Text style={[type.small, { color: c.text, flex: 1 }]}>{readError}</Text>
      <Button size="sm" onPress={refreshAll}>Reintentar</Button>
    </View>
  </FadeIn>;
}

function ActiveScreen({ tab, setActiveTab }) {
  switch (tab) {
    case 'dashboard': return <DashboardScreen setActiveTab={setActiveTab} />;
    case 'menu': return <MenuScreen />;
    case 'extras': return <ExtrasScreen />;
    case 'inventario': return <InventoryScreen />;
    case 'ubicaciones': return <LocationsScreen onNavigate={setActiveTab} />;
    case 'trabajadores': return <TeamScreen />;
    case 'reportes': return <ReportsScreen />;
    case 'configuracion': return <SettingsScreen />;
    case 'auditoria': return <AuditScreen />;
    case 'mesas': return <TablesScreen />;
    case 'pedidos': return <OrdersScreen onNavigate={setActiveTab} />;
    case 'caja': return <CashScreen />;
    default: return <DashboardScreen setActiveTab={setActiveTab} />;
  }
}

function AdminLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 1024;
  useAdminBrowserStyle(c);

  return <AdminProvider>
    <ToastProvider>
      <View dataSet={{ mmAdmin: 'true' }} style={{ flex: 1, flexDirection: isCompact ? 'column' : 'row', paddingTop: isCompact ? TOP_INSET : 0, backgroundColor: c.bg }}>
        {!isCompact && <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Header activeTab={activeTab} onNavigate={setActiveTab} />
          <ReadErrorBanner />
          <View style={{ flex: 1, padding: isCompact ? space.lg : space.x3, paddingBottom: isCompact ? space.sm : space.xxl }}>
            <FadeIn trigger={activeTab} style={{ flex: 1, width: '100%', maxWidth: 1400, alignSelf: 'center' }}>
              <ActiveScreen tab={activeTab} setActiveTab={setActiveTab} />
            </FadeIn>
          </View>
        </View>
        {isCompact && <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} mode="bottom" />}
      </View>
    </ToastProvider>
  </AdminProvider>;
}

export default function AdminApp() {
  // Manrope para títulos y cifras; la fuente del sistema para el resto de la interfaz.
  useFonts({
    'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
    'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  });
  return <AdminAppearance><AdminLayout /></AdminAppearance>;
}
