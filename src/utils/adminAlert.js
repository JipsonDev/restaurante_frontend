import { Alert as NativeAlert, Platform } from 'react-native';

// React Native Web's Alert.alert is a no-op. Native dialogs retain their callbacks.
export const Alert = {
  alert(title, message, buttons, options) {
    if (Platform.OS === 'web') {
      window.alert([title, message].filter(Boolean).join('\n\n'));
      return;
    }
    NativeAlert.alert(title, message, buttons, options);
  },
};
