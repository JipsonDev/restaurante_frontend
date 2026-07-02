import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Download, Smartphone, X } from 'lucide-react-native';
import { isWebPwaStandalone } from '../services/pwa';

export default function PwaInstallPrompt({
  role = 'equipo',
  compact = false,
  dark = false,
  style,
}) {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    setStandalone(isWebPwaStandalone());

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setDismissed(false);
    };

    const handleInstalled = () => {
      setStandalone(true);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const copy = useMemo(() => {
    if (role === 'cocina') {
      return {
        title: 'Descarga la web app de cocina',
        body: 'Instalala en esta tablet para recibir y revisar pedidos sin abrir el navegador cada vez.',
      };
    }
    if (role === 'mesero') {
      return {
        title: 'Descarga la web app del mesero',
        body: 'Instalala en el celular para tomar pedidos y ver alertas de cocina mas rapido.',
      };
    }
    return {
      title: 'Descarga la web app',
      body: 'Instala Morena Mia POS para entrar directo al sistema desde este equipo.',
    };
  }, [role]);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
  };

  if (Platform.OS !== 'web' || standalone || dismissed) return null;

  const colors = dark
    ? {
        bg: 'rgba(15, 23, 42, 0.92)',
        border: 'rgba(148, 163, 184, 0.28)',
        iconBg: 'rgba(37, 99, 235, 0.22)',
        text: '#F8FAFC',
        muted: '#CBD5E1',
        primary: '#2563EB',
        primaryText: '#FFFFFF',
        ghost: 'rgba(255, 255, 255, 0.08)',
      }
    : {
        bg: '#FFFFFF',
        border: '#D8E1EE',
        iconBg: '#DBEAFE',
        text: '#0F172A',
        muted: '#64748B',
        primary: '#2563EB',
        primaryText: '#FFFFFF',
        ghost: '#EFF4FA',
      };

  const shadow = Platform.select({
    web: { boxShadow: dark ? '0 18px 48px rgba(0,0,0,0.22)' : '0 14px 34px rgba(15,23,42,0.10)' },
    default: { elevation: 4 },
  });

  return (
    <View
      style={[
        {
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
          padding: compact ? 10 : 14,
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'center',
          gap: 12,
          ...shadow,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Smartphone size={21} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
            {copy.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 3 }}>
            {installEvent ? copy.body : 'En Chrome/Edge usa Instalar app; en iPhone/iPad: Compartir > Agregar a pantalla de inicio.'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: compact ? 'flex-end' : 'center' }}>
        {installEvent ? (
          <TouchableOpacity
            onPress={handleInstall}
            style={{ height: 40, borderRadius: 11, backgroundColor: colors.primary, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <Download size={16} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: '900', marginLeft: 7 }}>Descargar</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => setDismissed(true)}
          style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: colors.ghost, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
