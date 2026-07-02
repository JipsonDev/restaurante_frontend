import { Platform, StatusBar } from 'react-native';

export const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
export const BOTTOM_INSET = Platform.OS === 'android' ? 30 : Platform.OS === 'ios' ? 22 : 0;

export const withBottomInset = (extra = 0) => ({ paddingBottom: BOTTOM_INSET + extra });
export const withScreenInsets = (extraBottom = 0) => ({
  paddingTop: TOP_INSET,
  paddingBottom: BOTTOM_INSET + extraBottom,
});
