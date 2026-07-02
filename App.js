import React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NativeWindStyleSheet } from 'nativewind';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import AdminApp    from './src/modules/AdminApp';
import WaiterApp   from './src/modules/WaiterApp';
import KitchenApp  from './src/modules/KitchenApp';
import CashierApp  from './src/modules/CashierApp';
import { registerWebApp } from './src/services/pwa';

// Configuración NativeWind para web
if (Platform.OS === 'web') {
  NativeWindStyleSheet.setOutput({ default: 'native' });
}

// En web, react-native-web monta la app en un <div> que por defecto crece con
// el contenido: por eso el header "seguía" el scroll (scrolleaba el documento
// entero). Fijamos html/body/root a la altura del viewport para que solo los
// ScrollView internos scrolleen y los headers queden fijos.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  registerWebApp();
  const style = document.createElement('style');
  style.textContent = `
    html, body { height: 100%; margin: 0; padding: 0; overflow: hidden;
      overscroll-behavior: none; -webkit-text-size-adjust: 100%; }
    body > div, #root, #main { height: 100%; width: 100%; display: flex; }
    * { box-sizing: border-box; }
    input, textarea { outline: none; }
  `;
  document.head.appendChild(style);
}

/**
 * Router principal: muestra el módulo correcto según el rol del usuario.
 *
 * Roles esperados:
 *   admin   → AdminApp   (panel web completo)
 *   mesero  → WaiterApp  (móvil, tomar pedidos)
 *   cocina  → KitchenApp (tablet KDS)
 *   caja    → CashierApp (punto de cobro)
 */
function RoleRouter() {
  const { user, loading } = useAuth();
  const { c } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  switch (user.rol) {
    case 'admin':   return <AdminApp />;
    case 'mesero':  return <WaiterApp />;
    case 'cocina':  return <KitchenApp />;
    case 'caja':    return <CashierApp />;
    case 'supervisor': return <CashierApp />;
    default:
      return <AdminApp />;
  }
}

export default function App() {
  return (
    <ThemeProvider defaultMode="light">
      <AuthProvider>
        <RoleRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}
