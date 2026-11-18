// Instalar la app (PWA) desde la app del mesero: tarjeta descartable en Mesas, fila en «Más» y,
// en iPhone/iPad (sin botón de instalar), una hoja con los pasos de Safari.
import React, { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { Download, PlusSquare, Share, X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { dismissInstall, getInstallState, installDismissed, onInstallChange, promptInstall } from '../../services/pwa';
import { Appear, BottomSheet, Button, IconButton, Num, T, elevate, haptic, radius, space } from './kit';

export function useInstall() {
  const [state, setState] = useState(() => Platform.OS === 'web' ? getInstallState() : { standalone: true, canPrompt: false, ios: false });
  useEffect(() => { if (Platform.OS !== 'web') return undefined; setState(getInstallState()); return onInstallChange(setState); }, []);
  return { ...state, available: Platform.OS === 'web' && !state.standalone && (state.canPrompt || state.ios) };
}

export function IOSInstallSheet({ visible, onClose }) {
  const { c } = useTheme();
  const step = (n, Icon, title, detail) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Num size={15} weight="800" color={c.primaryText}>{n}</Num></View>
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><T size={16} weight="800">{title}</T>{Icon ? <Icon size={18} color={c.sky} /> : null}</View>
      {detail ? <T size={14} color={c.muted}>{detail}</T> : null}
    </View>
  </View>;
  return <BottomSheet visible={visible} onClose={onClose} title="Instalar en iPhone" subtitle="Safari no tiene botón de instalar; son tres toques."
    footer={<Button variant="ink" full onPress={onClose}>Entendido</Button>}>
    {step(1, Share, 'Toca Compartir', 'El cuadro con la flecha hacia arriba, en la barra de Safari.')}
    {step(2, PlusSquare, 'Agregar a pantalla de inicio', 'Desliza la lista hasta encontrarlo.')}
    {step(3, null, 'Toca «Agregar»', 'Morena Mía aparecerá con su ícono y se abrirá a pantalla completa.')}
  </BottomSheet>;
}

// Abre el diálogo del navegador o, en iPhone, la hoja de pasos.
export function useInstallAction() {
  const install = useInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const run = async () => {
    haptic('medium');
    if (install.canPrompt) { await promptInstall(); return; }
    if (install.ios) setIosOpen(true);
  };
  const sheet = <IOSInstallSheet visible={iosOpen} onClose={() => setIosOpen(false)} />;
  return { install, run, sheet };
}

// Tarjeta en Mesas (se puede descartar; vuelve a ofrecerse a los 14 días).
export function InstallBanner() {
  const { c } = useTheme();
  const { install, run, sheet } = useInstallAction();
  const [hidden, setHidden] = useState(() => Platform.OS !== 'web' || installDismissed());
  if (!install.available || hidden) return sheet;
  return <>
    <Appear style={{ marginBottom: space.lg }}>
      <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }]}>
        <Image source={{ uri: '/icons/icon-192.png' }} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: c.bg }} accessibilityIgnoresInvertColors />
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <View>
            <T size={15} weight="800">Instala Morena Mía</T>
            <T size={13} color={c.muted}>Se abre como app, a pantalla completa y más rápido.</T>
          </View>
          <Button variant="primary" size="sm" icon={Download} onPress={run}>{install.ios ? 'Cómo instalar' : 'Instalar'}</Button>
        </View>
        <IconButton icon={X} label="Ahora no" size={36} color={c.muted} onPress={() => { dismissInstall(); setHidden(true); }} />
      </View>
    </Appear>
    {sheet}
  </>;
}
