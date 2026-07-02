import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AdminProvider } from '../context/AdminContext';
import { useTheme } from '../theme';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import DashboardScreen from '../screens/DashboardScreen';
import MenuScreen from '../screens/MenuScreen';
import AdminSectionScreen from '../screens/AdminSectionScreen';
import { TOP_INSET } from '../utils/safeArea';

function ActiveScreen({ tab, setActiveTab }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardScreen setActiveTab={setActiveTab} />;
    case 'menu':
      return <MenuScreen />;
    default:
      return <AdminSectionScreen tab={tab} setActiveTab={setActiveTab} />;
  }
}

export default function AdminApp() {
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
          <Header activeTab={activeTab} />
          <View style={{ flex: 1, backgroundColor: c.bg, padding: isCompact ? 10 : 18 }}>
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
