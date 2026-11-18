import { Alert as NativeAlert, Platform } from 'react-native';

// En react-native-web Alert.alert no hace nada (los errores de caja quedaban invisibles en el navegador).
// En web: un botón → aviso; dos o más → confirmación (Aceptar = acción, Cancelar = botón «cancel»).
export const Alert = {
  alert(title, message, buttons, options) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const text = [title, message].filter(Boolean).join('\n\n');
      const list = Array.isArray(buttons) ? buttons : [];
      if (list.length >= 2) {
        const cancel = list.find(b => b?.style === 'cancel') || list[0];
        const action = list.find(b => b !== cancel) || list[list.length - 1];
        if (window.confirm(text)) action?.onPress?.(); else cancel?.onPress?.();
        return;
      }
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    NativeAlert.alert(title, message, buttons, options);
  },
};
