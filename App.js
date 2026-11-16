import React from 'react';
import { View, ActivityIndicator, Platform, Pressable, Text } from 'react-native';
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
    #root, #main { height: 100%; width: 100%; display: flex; }
    * { box-sizing: border-box; }
    input, textarea { outline: none; }
    [role="button"] { transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease; }
    [role="button"]:focus, [role="tab"]:focus, input:focus, textarea:focus { outline: none; }
    [role="button"]:focus-visible, [role="tab"]:focus-visible { box-shadow: inset 0 0 0 1px #a8b3c780; }
    @media (prefers-reduced-motion: reduce) { [role="button"] { transition: none; } }
    ::-webkit-scrollbar { width: 7px; height: 7px; }
    ::-webkit-scrollbar-thumb { background: #94a3b866; border-radius: 8px; }
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
function UnknownRole({ rol }) {
  const { logout } = useAuth();
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: c.bg }}>
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>Tu cuenta no tiene un módulo asignado</Text>
      <Text style={{ fontSize: 15, color: c.muted, textAlign: 'center', maxWidth: 420 }}>
        El rol «{String(rol || 'sin rol')}» no corresponde a ningún módulo. Pide al administrador que revise tu cuenta.
      </Text>
      <Pressable accessibilityRole="button" onPress={logout}
        style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center', backgroundColor: c.primary }}>
        <Text style={{ color: c.onPrimary, fontSize: 15, fontWeight: '600' }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

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
      // Un rol desconocido nunca debe abrir el panel de administracion.
      return <UnknownRole rol={user.rol} />;
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
