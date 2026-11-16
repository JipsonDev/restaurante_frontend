import { Platform, StyleSheet } from 'react-native';

// Paleta "azul noche y dorado", la misma del modo oscuro de la app.
// Contrastes verificados (WCAG AA): textos >= 4.5:1 y bordes de campos >= 3:1.
export const loginColors = {
  canvas: '#0B1220', paper: '#111B2D', field: '#17243A', fieldHover: '#1D2C46', line: '#5B6F8C', hairline: '#22324A', ink: '#F7F4E9', muted: '#A8B3C7', faint: '#8E9FB7', gold: '#F6B325', goldHover: '#FFC54F', onGold: '#111827', goldSoft: 'rgba(246,179,37,0.12)', error: '#FFABB4', errorSoft: '#352130', focus: '#F6B325', heroBg: '#0E1729', glowA: 'rgba(246,179,37,0.16)', glowB: 'rgba(88,188,245,0.18)', isDark: true,
};
export const loginType = { regular: 'Manrope-Regular', medium: 'Manrope-Medium' };
const c = loginColors;
const type = loginType;
const web = (style) => Platform.select({ web: style, default: {} });

export const loginStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.canvas },
  layout: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },


  heroGlow: { ...StyleSheet.absoluteFillObject, ...web({ backgroundImage: `radial-gradient(120% 80% at 0% 100%, ${c.glowA} 0%, transparent 55%), radial-gradient(90% 70% at 100% 0%, ${c.glowB} 0%, transparent 60%)` }) },


  formArea: { width: '100%', backgroundColor: c.paper },
  formCard: { borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: c.hairline },
  form: { width: '100%', gap: 22 },
  title: { color: c.ink, fontFamily: type.medium, fontSize: 26, lineHeight: 34, letterSpacing: -0.5 },
  description: { color: c.muted, fontFamily: type.regular, fontSize: 15, lineHeight: 22 },
  fields: { gap: 18 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: type.medium, fontSize: 14, lineHeight: 20, color: c.ink },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: c.field, borderWidth: 1, borderColor: c.line, borderRadius: 10, borderCurve: 'continuous', paddingLeft: 14, paddingRight: 4, gap: 10 },
  input: { minHeight: 50, flex: 1, minWidth: 0, paddingVertical: 13, fontFamily: type.regular, fontSize: 16, color: c.ink, ...web({ outlineStyle: 'none', caretColor: c.gold }) },
  fieldError: { color: c.error, fontFamily: type.regular, fontSize: 13, lineHeight: 18 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  submit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: c.gold, borderRadius: 10, borderCurve: 'continuous', flexDirection: 'row', gap: 10 },
  submitText: { color: c.onGold, fontFamily: type.medium, fontSize: 16, lineHeight: 24 },
  status: { backgroundColor: c.errorSoft, borderRadius: 10, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'flex-start' },
  statusText: { color: c.error, fontFamily: type.regular, flex: 1, fontSize: 14, lineHeight: 20 },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  help: { color: c.muted, fontFamily: type.regular, fontSize: 13, lineHeight: 20 },

  // Pantalla de bloqueo (TPV): reloj, avatares y teclado circular
  lock: { width: '100%', maxWidth: 520, alignItems: 'center', gap: 28 },
  clock: { color: c.ink, fontFamily: type.regular, fontSize: 72, lineHeight: 80, letterSpacing: -3, ...web({ fontVariantNumeric: 'tabular-nums' }) },
  clockDate: { color: c.muted, fontFamily: type.regular, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  tile: { width: 104, alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous' },
  tileAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  tileInitials: { fontFamily: type.medium, fontSize: 22, lineHeight: 28 },
  tileName: { fontFamily: type.medium, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  tileRole: { fontFamily: type.regular, fontSize: 12, lineHeight: 16, color: c.faint, textAlign: 'center' },

  // PIN
  pinCells: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 6 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22, rowGap: 16, width: 284 },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: c.ink, fontFamily: type.regular, fontSize: 30, lineHeight: 36 },
  keySub: { color: c.faint, fontFamily: type.medium, fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 8 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 999 },
  linkText: { color: c.muted, fontFamily: type.medium, fontSize: 14, lineHeight: 20 },
});
