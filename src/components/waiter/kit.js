// Kit del mesero (marca blanca, estilo app de delivery).
// Neutros de producto, una sola letra (Archivo, incluida en la app) y el color de cada restaurante
// solo donde hay acción: botón principal, pestaña activa, foco y barra del carrito.
// Movimiento corto y sin rebotes: presión 0,97 en 100 ms, hojas con curva de cajón, nada que se repita cientos de veces.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Modal, PanResponder, Platform, Pressable, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { Check, Minus, Plus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

let createPortalSafe = null;
if (Platform.OS === 'web') { try { createPortalSafe = require('react-dom').createPortal; } catch {} }

export const WEB = Platform.OS === 'web';
const ND = !WEB;
export const EASE = Easing.bezier(0.23, 1, 0.32, 1);        // salida fuerte
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_DRAWER = Easing.bezier(0.32, 0.72, 0, 1); // hojas inferiores

// ── Tipografía ─────────────────────────────────────────────────────────────
export const FONT = WEB ? '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;
export const NARROW = FONT;
export const MONO = FONT;

let chromeInjected = false;
// Letra local (sin internet se ve igual) y lo que el navegador dibuja por su cuenta: selección, cursor, foco, barras.
export function useComandaFonts() {
  const { c } = useTheme();
  useEffect(() => {
    if (!WEB || typeof document === 'undefined') return;
    if (!chromeInjected) {
      chromeInjected = true;
      const style = document.createElement('style');
      style.textContent = `@font-face{font-family:"Archivo";src:url("/fonts/Archivo-latin.woff") format("woff");font-weight:100 900;font-stretch:62% 125%;font-style:normal;font-display:swap}
[data-mesero] ::selection{background:var(--mm-brand-soft)}[data-mesero] input,[data-mesero] textarea{caret-color:var(--mm-brand)}
[data-mesero] [tabindex]:focus-visible,[data-mesero] input:focus-visible{outline:2px solid var(--mm-brand) !important;outline-offset:2px}
[data-mesero] *{scrollbar-width:thin;scrollbar-color:var(--mm-scroll) transparent}`;
      document.head.appendChild(style);
    }
    const root = document.documentElement.style;
    root.setProperty('--mm-brand', c.primaryText || '#17171A');
    root.setProperty('--mm-brand-soft', c.primarySoft || '#EDEDEF');
    root.setProperty('--mm-scroll', c.softer || '#D4D4D8');
  }, [c.primaryText, c.primarySoft, c.softer]);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32 };
// Esquinas discretas: nada de píldoras ni tarjetas muy redondeadas (se ven genéricas).
export const radius = { sm: 6, md: 8, lg: 10, xl: 12, sheet: 16, pill: 999 };
export const TOUCH = 48;
export const TOUCH_MAIN = 56;

// Profundidad: casi plana. Nivel 1 separa una tarjeta, 2 algo que flota (barra del carrito), 3 hojas.
export function elevate(c, level = 1) {
  if (c.isDark) return WEB ? { boxShadow: level > 1 ? '0 8px 28px rgba(0,0,0,0.5)' : 'none' } : { elevation: level * 2 };
  if (WEB) {
    const s = { 1: 'none', 2: '0 2px 6px rgba(15,15,18,0.06), 0 8px 24px rgba(15,15,18,0.10)', 3: '0 -4px 12px rgba(15,15,18,0.06), 0 -12px 40px rgba(15,15,18,0.12)' };
    return { boxShadow: s[level] || s[1] };
  }
  return { shadowColor: '#0F0F12', shadowOffset: { width: 0, height: level }, shadowOpacity: 0.06 + 0.02 * level, shadowRadius: 4 * level, elevation: 2 * level };
}

export function T({ style, size = 16, weight = '400', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * (size >= 22 ? 1.2 : 1.36)), fontWeight: weight, color: color || c.text, letterSpacing: size >= 22 ? -0.4 : size >= 18 ? -0.2 : 0 }, style]} />;
}
export function Num({ style, size = 16, weight = '600', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.28), fontWeight: weight, color: color || c.text, fontVariant: ['tabular-nums'], letterSpacing: size >= 22 ? -0.5 : 0 }, style]} />;
}
export function Label({ style, color, size = 14, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: size + 6, fontWeight: '600', color: color || c.muted }, style]} />;
}

export const money = n => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Vibración ──────────────────────────────────────────────────────────────
// iPhone/Android: expo-haptics (impactos y notificaciones nativas; en Android, el motor del sistema
// sin permiso de vibración). Web: Vibration API. Una vibración por evento y siempre junto a un cambio visual.
let Haptics = null;
if (!WEB) { try { Haptics = require('expo-haptics'); } catch { Haptics = null; } }
const PATTERNS = { tap: 8, select: 6, light: 12, medium: 20, success: [0, 18, 60, 24], warning: [0, 30, 80, 30], error: [0, 40, 60, 40] };
const ANDROID = { tap: 'Keyboard_Tap', select: 'Segment_Tick', light: 'Clock_Tick', medium: 'Long_Press', success: 'Confirm', warning: 'Reject', error: 'Reject' };
function nativeHaptic(kind) {
  const H = Haptics;
  if (!H) return false;
  if (Platform.OS === 'android' && H.performAndroidHapticsAsync && H.AndroidHaptics?.[ANDROID[kind]] != null) { H.performAndroidHapticsAsync(H.AndroidHaptics[ANDROID[kind]]).catch(() => {}); return true; }
  const I = H.ImpactFeedbackStyle || {}; const N = H.NotificationFeedbackType || {};
  const run = {
    tap: () => H.selectionAsync?.(), select: () => H.selectionAsync?.(),
    light: () => H.impactAsync?.(I.Light), medium: () => H.impactAsync?.(I.Medium),
    success: () => H.notificationAsync?.(N.Success), warning: () => H.notificationAsync?.(N.Warning), error: () => H.notificationAsync?.(N.Error),
  }[kind];
  if (!run) return false;
  Promise.resolve(run()).catch(() => {});
  return true;
}
export function haptic(kind = 'tap') {
  try {
    if (!WEB && nativeHaptic(kind)) return;
    const p = PATTERNS[kind] ?? 10;
    // En web solo después de que el usuario tocó la página (si no, el navegador lo bloquea y avisa en consola).
    if (WEB) { if (typeof navigator !== 'undefined' && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate(p); return; }
    if (Platform.OS === 'android') Vibration.vibrate(p);
  } catch {}
}

// ── Presión ────────────────────────────────────────────────────────────────
// Se encoge a 0,97 al tocar (100 ms) y vuelve en 160 ms, sin rebote: es una herramienta de trabajo.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Press({ children, style, onPress, onLongPress, disabled, scaleTo = 0.97, sink = 0, hapticKind, hoverStyle, ...props }) {
  const v = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const down = () => Animated.timing(v, { toValue: 1, duration: 100, easing: EASE, useNativeDriver: ND }).start();
  const up = () => Animated.timing(v, { toValue: 0, duration: 160, easing: EASE, useNativeDriver: ND }).start();
  return <AnimatedPressable {...props} disabled={disabled} delayLongPress={400}
    onPress={e => { if (hapticKind) haptic(hapticKind); onPress?.(e); }} onLongPress={onLongPress ? e => { haptic('medium'); onLongPress(e); } : undefined}
    onPressIn={down} onPressOut={up} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={[typeof style === 'function' ? style({ hovered }) : style, hovered && !disabled ? hoverStyle : null,
      { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, sink] }) }] },
      WEB ? { cursor: disabled ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transitionProperty: 'background-color, border-color', transitionDuration: '150ms' } : null]}>
    {typeof children === 'function' ? children({ hovered }) : children}
  </AnimatedPressable>;
}

// ── Botones ────────────────────────────────────────────────────────────────
// primary: color del local · ink: oscuro · outline: blanco con borde · tonal: gris · ghost · danger: rojo suave
export function Button({ children, icon: Icon, iconRight: IconRight, variant = 'outline', size = 'md', onPress, disabled, loading, full, style, accessibilityLabel, hapticKind = 'tap' }) {
  const { c } = useTheme();
  const h = size === 'lg' ? TOUCH_MAIN : size === 'sm' ? 40 : TOUCH;
  const v = {
    primary: { bg: c.primary, fg: c.onPrimary, hover: c.primaryHover, border: c.primary },
    ink: { bg: c.ink, fg: c.onInk, hover: c.isDark ? '#FFFFFF' : '#2C2C31', border: c.ink },
    outline: { bg: c.surfaceAlt, fg: c.text, hover: c.soft, border: 'transparent' },
    tonal: { bg: c.surfaceAlt, fg: c.text, hover: c.soft, border: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.text, hover: c.surfaceAlt, border: 'transparent' },
    danger: { bg: c.redSoft, fg: c.red, hover: c.redSoft, border: c.redSoft },
  }[variant] || { bg: c.surface, fg: c.text, hover: c.surfaceAlt, border: c.lineStrong };
  const off = disabled || loading;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off} onPress={onPress} hapticKind={hapticKind}
    style={[{ minHeight: h, paddingHorizontal: size === 'sm' ? 14 : size === 'lg' ? 20 : 16, borderRadius: radius.md, backgroundColor: v.bg, borderWidth: 0, borderColor: v.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off && !loading ? 0.4 : 1 },
      full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    hoverStyle={{ backgroundColor: v.hover }}>
    {loading ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={size === 'lg' ? 20 : 18} color={v.fg} strokeWidth={2.2} /> : null}
    {children != null ? (typeof children === 'string' || typeof children === 'number'
      ? <T size={size === 'lg' ? 17 : size === 'sm' ? 14 : 15} weight="700" color={v.fg} numberOfLines={1}>{children}</T> : children) : null}
    {IconRight && !loading ? <IconRight size={18} color={v.fg} strokeWidth={2.2} /> : null}
  </Press>;
}

// Un solo color de aviso para todos los contadores (rojo), así nunca compite con el color del local.
export function CountBadge({ value, style, border }) {
  const { c } = useTheme();
  if (!value) return null;
  return <View style={[{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: border || c.surface }, style]}>
    <Num size={10} weight="800" color="#FFFFFF" style={{ lineHeight: 12 }}>{value > 99 ? '99+' : value}</Num>
  </View>;
}

export function IconButton({ icon: Icon, label, onPress, size = 44, badge, tone, disabled, color, filled }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge}` : label} disabled={disabled} onPress={onPress} hapticKind="tap" scaleTo={0.92}
    style={{ width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, backgroundColor: filled ? c.surfaceAlt : 'transparent' }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <Icon size={22} color={color || (tone === 'danger' ? c.red : c.text)} strokeWidth={2} />
    {badge ? <CountBadge value={badge} border={c.bg} style={{ position: 'absolute', top: 4, right: 2 }} /> : null}
  </Press>;
}

// Filtro: píldora gris; elegida, oscura. La cantidad va como texto, no como otra burbuja.
export function Chip({ children, selected, onPress, count, icon: Icon, accessibilityLabel }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} hapticKind="select" scaleTo={0.95}
    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: selected ? c.ink : c.surfaceAlt,
      flexDirection: 'row', alignItems: 'center', gap: 6 }} hoverStyle={selected ? null : { backgroundColor: c.soft }}>
    {Icon ? <Icon size={16} color={selected ? c.onInk : c.text} strokeWidth={2.2} /> : null}
    <T size={15} weight={selected ? '700' : '500'} color={selected ? c.onInk : c.text} numberOfLines={1}>{children}</T>
    {count != null ? <Num size={14} weight="600" color={selected ? c.onInk : c.muted} style={{ opacity: selected ? 0.75 : 1 }}>{count}</Num> : null}
  </Press>;
}

// Pestañas con subrayado (categorías del menú): el subrayado se mueve, el texto activo va oscuro y en negrita.
export function UnderlineTabs({ items, value, onChange, renderIcon }) {
  const { c } = useTheme();
  const [layouts, setLayouts] = useState({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const scroller = useRef(null);
  useEffect(() => {
    const l = layouts[value]; if (!l) return;
    Animated.parallel([
      Animated.timing(x, { toValue: l.x, duration: 200, easing: EASE, useNativeDriver: false }),
      Animated.timing(w, { toValue: l.width, duration: 200, easing: EASE, useNativeDriver: false }),
    ]).start();
    scroller.current?.scrollTo?.({ x: Math.max(0, l.x - 40), animated: true });
  }, [value, layouts[value]?.x, layouts[value]?.width]);
  return <View style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>
    <Animated.ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ paddingHorizontal: 4 }}>
      {items.map(item => {
        const active = item.key === value;
        return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { haptic('select'); onChange(item.key); }}
          onLayout={e => { const { x: lx, width } = e.nativeEvent.layout; setLayouts(prev => prev[item.key]?.x === lx && prev[item.key]?.width === width ? prev : { ...prev, [item.key]: { x: lx, width } }); }}
          style={{ height: 46, paddingHorizontal: 12, justifyContent: 'center', ...(WEB ? { cursor: 'pointer', WebkitTapHighlightColor: 'transparent' } : null) }}>
          <T size={15} weight={active ? '700' : '500'} color={active ? c.text : c.muted} numberOfLines={1}>{item.label}</T>
        </Pressable>;
      })}
      {layouts[value] ? <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: c.primaryText, left: x, width: w }} /> : null}
    </Animated.ScrollView>
  </View>;
}

// ── Superficies ────────────────────────────────────────────────────────────
export function Sheet({ children, style, level = 1, ...props }) {
  const { c } = useTheme();
  return <View {...props} style={[{ backgroundColor: c.surfaceAlt, borderRadius: radius.lg }, level > 1 ? elevate(c, level) : null, style]}>{children}</View>;
}
export function Perforation({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}
export function LeaderLine({ left, right }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ flex: 1, minWidth: 0 }}>{left}</View>
    <View>{right}</View>
  </View>;
}

// ── Insignias ──────────────────────────────────────────────────────────────
// Etiqueta de estado: rectángulo suave con texto del mismo tono.
const SOFT = c => ({ [c.green]: c.greenSoft, [c.amber]: c.amberSoft, [c.red]: c.redSoft, [c.primary]: c.primarySoft, [c.primaryText]: c.primarySoft, [c.purple]: c.purpleSoft, [c.sky]: c.skySoft, [c.muted]: c.surfaceAlt, [c.ink]: c.surfaceAlt, [c.text]: c.surfaceAlt });
export function Stamp({ children, color, animate, size = 13, style, dot = false }) {
  const { c } = useTheme();
  const tone = color || c.muted;
  const bg = SOFT(c)[tone] || c.surfaceAlt;
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => { if (animate) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: ND }).start(); } }, [animate]);
  return <Animated.View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }, style]}>
    {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} /> : null}
    <T size={size} weight="700" color={tone} numberOfLines={1}>{typeof children === 'string' ? children.charAt(0) + children.slice(1).toLowerCase() : children}</T>
  </Animated.View>;
}
export const Badge = Stamp;

// Confirmación breve (p. ej. «Enviada a cocina»): círculo verde con check, sin rebotes.
export function StampBurst({ text, visible, onDone, color }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    haptic('success');
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 220, easing: EASE, useNativeDriver: ND }),
      Animated.delay(800),
      Animated.timing(v, { toValue: 2, duration: 180, easing: EASE, useNativeDriver: ND }),
    ]).start(() => onDone?.());
  }, [visible]);
  if (!visible) return null;
  const tone = color || c.greenFill;
  const label = typeof text === 'string' ? text.charAt(0) + text.slice(1).toLowerCase() : text;
  return <View pointerEvents="none" style={{ position: WEB ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
    <Animated.View accessibilityLiveRegion="assertive" style={[{ alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 24, borderRadius: radius.xl, backgroundColor: c.surface,
      opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.94, 1, 0.98] }) }] }, elevate(c, 2)]}>
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
        <Check size={32} color="#FFFFFF" strokeWidth={3} />
      </View>
      <T size={19} weight="700">{label}</T>
    </Animated.View>
  </View>;
}

// ── Cifras ─────────────────────────────────────────────────────────────────
// Número que rueda: el valor anterior sale y el nuevo entra con desvanecido (200 ms).
export function RollingNumber({ value, format = v => String(v), size = 16, weight = '700', color, style }) {
  const [shown, setShown] = useState(value);
  const [prev, setPrev] = useState(null);
  const v = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  useEffect(() => {
    if (value === shown) return;
    dir.current = Number(value) >= Number(shown) ? 1 : -1;
    setPrev(shown); setShown(value); v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: ND }).start(() => setPrev(null));
  }, [value]);
  const h = Math.round(size * 1.3);
  return <View style={[{ height: h, overflow: 'hidden', justifyContent: 'center' }, style]}>
    {prev != null ? <Animated.View style={{ position: 'absolute', left: 0, right: 0, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h * dir.current] }) }] }}>
      <Num size={size} weight={weight} color={color}>{format(prev)}</Num></Animated.View> : null}
    <Animated.View style={{ opacity: prev != null ? v : 1, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [prev != null ? h * dir.current : 0, 0] }) }] }}>
      <Num size={size} weight={weight} color={color}>{format(shown)}</Num>
    </Animated.View>
  </View>;
}

// Cantidad: bloque gris − n +, sin bordes ni resaltes que se queden pegados al tocar. En 1, el «−» se vuelve papelera (quitar).
export function Tally({ value, onChange, min = 0, max = 99, label = 'Cantidad', size = 'md', removable = false, stretch = false, bg }) {
  const { c } = useTheme();
  const s = size === 'sm' ? 34 : 40;
  const btn = (delta, disabled) => {
    const Icon = delta > 0 ? Plus : removable && value <= 1 ? Trash2 : Minus;
    return <Press accessibilityRole="button" accessibilityLabel={delta > 0 ? `Aumentar ${label.toLowerCase()}` : removable && value <= 1 ? `Quitar ${label.toLowerCase()}` : `Disminuir ${label.toLowerCase()}`} disabled={disabled}
      onPress={() => onChange(Math.max(removable ? 0 : min, Math.min(max, value + delta)))} hapticKind="select" scaleTo={0.88}
      style={{ width: s, height: s, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <Icon size={size === 'sm' ? 16 : 18} color={delta < 0 && removable && value <= 1 ? c.red : c.text} strokeWidth={2.4} />
    </Press>;
  };
  return <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, padding: 2, borderRadius: radius.md, backgroundColor: bg || c.surfaceAlt, alignSelf: stretch ? 'stretch' : 'flex-start', justifyContent: 'space-between' }}>
    {btn(-1, !removable && value <= min)}
    <View style={{ minWidth: 26, alignItems: 'center' }}><RollingNumber value={value} size={size === 'sm' ? 15 : 17} weight="700" /></View>
    {btn(1, value >= max)}
  </View>;
}

// Cantidad compacta: un cuadro con el número; al tocarlo se abre «− n +» y se cierra solo a los 3 s.
// tone="brand" (platos ya pedidos en el menú) o "neutral" (líneas de la cuenta). En 1, el «−» es una papelera.
export function QtyControl({ value, onInc, onDec, label = 'producto', tone = 'neutral', size = 34 }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const keepOpen = () => { clearTimeout(timer.current); setOpen(true); timer.current = setTimeout(() => setOpen(false), 3000); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const bg = tone === 'brand' ? c.primary : c.surfaceAlt;
  const fg = tone === 'brand' ? c.onPrimary : c.text;
  const box = { height: size, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' };
  if (!open) return <Press accessibilityRole="button" accessibilityLabel={`${value} de ${label}. Cambiar cantidad`} onPress={keepOpen} hapticKind="tap" scaleTo={0.9}
    style={[box, { minWidth: size, paddingHorizontal: 6 }]}>
    <Num size={16} weight="800" color={fg}>{value}</Num>
  </Press>;
  const step = (delta, Icon, a11y, color) => <Press accessibilityRole="button" accessibilityLabel={a11y} hapticKind="select" scaleTo={0.85}
    onPress={() => { keepOpen(); delta > 0 ? onInc() : onDec(); }} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Icon size={17} color={color || fg} strokeWidth={2.6} />
  </Press>;
  return <View accessibilityLabel={`Cantidad de ${label}: ${value}`} style={[box, { flexDirection: 'row' }]}>
    {step(-1, value <= 1 ? Trash2 : Minus, value <= 1 ? `Quitar ${label}` : `Quitar uno de ${label}`, value <= 1 && tone !== 'brand' ? c.red : null)}
    <Num size={16} weight="800" color={fg} style={{ minWidth: 20, textAlign: 'center' }}>{value}</Num>
    {step(1, Plus, `Añadir otro ${label}`)}
  </View>;
}

// ── Hoja inferior ──────────────────────────────────────────────────────────
// Sube con curva de cajón (300 ms) y baja más rápido (200 ms); se cierra arrastrando (30 % o un tirón) o tocando el fondo.
let openSheets = 0;
const sheetListeners = new Set();
const notifySheets = () => sheetListeners.forEach(fn => fn(openSheets > 0));

export function BottomSheet({ visible, onClose, title, subtitle, children, footer, maxHeight = '90%', busy }) {
  const { c } = useTheme();
  useEffect(() => {
    if (!visible) return undefined;
    openSheets += 1; notifySheets();
    return () => { openSheets = Math.max(0, openSheets - 1); notifySheets(); };
  }, [visible]);
  const { height: vh, width: vw } = useWindowDimensions();
  const wide = vw >= 760;
  const y = useRef(new Animated.Value(1)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const heightRef = useRef(600);
  useEffect(() => {
    if (visible) { setMounted(true); drag.setValue(0); y.setValue(1); Animated.timing(y, { toValue: 0, duration: 300, easing: EASE_DRAWER, useNativeDriver: ND }).start(); }
    else if (mounted) Animated.timing(y, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: ND }).start(() => setMounted(false));
  }, [visible]);
  const close = () => { if (!busy) onClose?.(); };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy * 0.2),
    onPanResponderRelease: (_, g) => {
      if (g.dy > heightRef.current * 0.3 || g.vy > 0.6) { haptic('light'); close(); }
      else Animated.spring(drag, { toValue: 0, velocity: g.vy, speed: 22, bounciness: 0, useNativeDriver: ND }).start();
    },
  }), [busy]);
  if (!mounted) return null;
  const R = radius.sheet;
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <Animated.View dataSet={{ mesero: 'true' }} style={{ flex: 1, backgroundColor: c.overlay, opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center', padding: wide ? 24 : 0 }}>
      <Pressable accessibilityLabel="Cerrar" onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      <Animated.View onLayout={e => { heightRef.current = e.nativeEvent.layout.height; }} accessibilityViewIsModal
        style={[{ width: '100%', maxWidth: wide ? 560 : undefined, maxHeight, backgroundColor: c.surface, borderTopLeftRadius: R, borderTopRightRadius: R,
          borderBottomLeftRadius: wide ? R : 0, borderBottomRightRadius: wide ? R : 0, overflow: 'hidden',
          transform: [{ translateY: Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(vh, 900)] }), drag) }] }, elevate(c, 3)]}>
        <View {...pan.panHandlers} style={{ paddingTop: 8, paddingHorizontal: space.xl, paddingBottom: title ? space.sm : 4 }}>
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.softer, marginBottom: title ? space.md : 0 }} />
          {title ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <T size={20} weight="700" accessibilityRole="header">{title}</T>
              {subtitle ? <T size={15} color={c.muted} style={{ marginTop: 2 }}>{subtitle}</T> : null}
            </View>
            <IconButton icon={X} label="Cerrar" onPress={close} size={40} disabled={busy} filled />
          </View> : null}
        </View>
        <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg }} style={{ flexShrink: 1 }}>{children}</Animated.ScrollView>
        {footer ? <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>{footer}</View> : null}
      </Animated.View>
    </Animated.View>
  </Modal>;
}

// ── Avisos ─────────────────────────────────────────────────────────────────
// Uno a la vez, compacto, encima de la barra inferior; el nuevo reemplaza al anterior.
const ToastCtx = createContext({ show: () => {}, lift: () => {} });
export const useComandaToast = () => useContext(ToastCtx);
export const useToastLift = () => useContext(ToastCtx).lift;

function ToastItem({ t, onDone }) {
  const v = useRef(new Animated.Value(0)).current;
  const close = useCallback(() => Animated.timing(v, { toValue: 0, duration: 160, easing: EASE, useNativeDriver: ND }).start(() => onDone(t.id)), []);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, easing: EASE, useNativeDriver: ND }).start();
    const timer = setTimeout(close, t.duration || (t.action ? 5000 : 3200));
    return () => clearTimeout(timer);
  }, []);
  const Icon = t.icon;
  const tone = t.tone === 'error' ? '#FF8A80' : t.tone === 'warning' ? '#FBBF24' : t.tone === 'success' ? '#4ADE80' : null;
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 48, paddingLeft: 14, paddingRight: 4, borderRadius: 8,
    backgroundColor: '#1D1D21' }, WEB ? { boxShadow: '0 8px 28px rgba(0,0,0,0.25)' } : { elevation: 12 }]}>
    {Icon ? <Icon size={18} color={tone || '#FFFFFF'} /> : tone ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} /> : null}
    <View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}>
      <T size={15} weight="600" color="#FFFFFF" numberOfLines={2}>{t.message}</T>
      {t.detail ? <T size={13} color="rgba(255,255,255,0.72)" numberOfLines={2}>{t.detail}</T> : null}
    </View>
    {t.action ? <Press accessibilityRole="button" onPress={() => { t.action.onPress(); close(); }} hapticKind="tap" style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' }}>
      <T size={15} weight="700" color="#FFFFFF" style={{ textDecorationLine: 'underline' }}>{t.action.label}</T>
    </Press> : null}
    <Press accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={close} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={18} color="rgba(255,255,255,0.7)" /></Press>
  </Animated.View>;
}

export function ComandaToastProvider({ children, bottomOffset = 84, placement = 'bottom', topOffset = 72 }) {
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState(0);
  const show = useCallback((message, opts = {}) => {
    if (opts.haptic !== false) haptic(opts.tone === 'error' ? 'error' : opts.tone === 'warning' ? 'warning' : 'light');
    setItems([{ id: Date.now() + Math.random(), message, ...opts }]);
  }, []);
  const lift = useCallback(n => setExtra(Number(n) || 0), []);
  const value = useMemo(() => ({ show, lift }), [show, lift]);
  const [sheetOpen, setSheetOpen] = useState(openSheets > 0);
  useEffect(() => { sheetListeners.add(setSheetOpen); return () => { sheetListeners.delete(setSheetOpen); }; }, []);
  const host = <View pointerEvents="box-none" style={[{ position: WEB ? 'fixed' : 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8, zIndex: 2147483000 }, placement === 'top' || sheetOpen ? { top: topOffset } : { bottom: bottomOffset + extra }]}>
    <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 520, gap: 8 }}>
      {items.map(t => <ToastItem key={t.id} t={t} onDone={id => setItems(list => list.filter(x => x.id !== id))} />)}
    </View>
  </View>;
  const portal = WEB && typeof document !== 'undefined' && createPortalSafe ? createPortalSafe(host, document.body) : host;
  return <ToastCtx.Provider value={value}>
    {children}
    {portal}
  </ToastCtx.Provider>;
}

// ── Navegación inferior ────────────────────────────────────────────────────
// Barra fija pegada abajo (como cualquier app): icono + texto; la activa en el color del local. Sin animación al cambiar:
// se toca decenas de veces por turno.
export function TabBar({ items, value, onChange, bottomInset = 0 }) {
  const { c } = useTheme();
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6, paddingBottom: Math.max(bottomInset, 6), paddingHorizontal: 4 }}>
    <View style={{ flexDirection: 'row', maxWidth: 560, width: '100%', alignSelf: 'center', marginHorizontal: 'auto' }}>
      {items.map(item => {
        const active = item.key === value;
        const Icon = item.icon;
        return <Press key={item.key} accessibilityRole="tab" accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label} accessibilityState={{ selected: active }}
          onPress={() => onChange(item.key)} hapticKind="select" scaleTo={0.94} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <View>
            <Icon size={24} color={active ? c.primaryText : c.muted} strokeWidth={active ? 2.3 : 1.9} />
            {item.badge ? <CountBadge value={item.badge} style={{ position: 'absolute', top: -5, right: -12 }} /> : null}
          </View>
          <T size={12} weight={active ? '700' : '500'} color={active ? c.primaryText : c.muted} numberOfLines={1}>{item.label}</T>
        </Press>;
      })}
    </View>
  </View>;
}

// ── Deslizar para actuar ───────────────────────────────────────────────────
// Fila que se arrastra en horizontal para confirmar una acción (borrar, entregar).
// Seguimiento 1:1 con el dedo (sin resorte mientras se arrastra); resistencia elástica en la
// dirección contraria; al soltar, confirma si pasó el 40 % del ancho o hubo un tirón rápido
// (> 0,5 px/ms), y sale con un resorte que conserva la velocidad del dedo. Si no, vuelve rápido.
// Vibra una vez al cruzar el umbral. Siempre debe existir un botón visible con la misma acción.
export function SwipeRow({ children, direction = 'left', onSwipe, label, icon: Icon, color, disabled, radius: r = radius.lg }) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(320);
  const armed = useRef(false);
  const busy = useRef(false);
  const sign = direction === 'left' ? -1 : 1;
  const tone = color || (direction === 'left' ? c.red : c.green);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !disabled && !busy.current && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { x.stopAnimation(); armed.current = false; },
    onPanResponderMove: (_, g) => {
      const along = g.dx * sign;                     // positivo = hacia la acción
      const v = along >= 0 ? along : along * 0.2;    // elástico en la dirección contraria
      x.setValue(v * sign);
      const past = along > width.current * 0.4;
      if (past !== armed.current) { armed.current = past; haptic(past ? 'medium' : 'select'); }
    },
    onPanResponderRelease: (_, g) => {
      const along = g.dx * sign; const vel = g.vx * sign;
      if (along > width.current * 0.4 || (vel > 0.5 && along > 24)) {
        busy.current = true; haptic('success');
        Animated.spring(x, { toValue: sign * (width.current + 40), velocity: g.vx, speed: 20, bounciness: 0, useNativeDriver: ND, restDisplacementThreshold: 2, restSpeedThreshold: 2 })
          .start(() => { onSwipe?.(); setTimeout(() => { x.setValue(0); busy.current = false; }, 260); });
      } else {
        Animated.spring(x, { toValue: 0, velocity: g.vx, speed: 26, bounciness: 4, useNativeDriver: ND }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, speed: 26, bounciness: 4, useNativeDriver: ND }).start(),
  }), [disabled, sign, onSwipe]);
  const progress = x.interpolate({ inputRange: sign < 0 ? [-200, -40, 0] : [0, 40, 200], outputRange: sign < 0 ? [1, 0.35, 0] : [0, 0.35, 1], extrapolate: 'clamp' });
  return <View onLayout={e => { width.current = e.nativeEvent.layout.width; }} style={{ borderRadius: r, overflow: 'hidden' }}>
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: r, backgroundColor: tone, opacity: progress,
      flexDirection: 'row', alignItems: 'center', justifyContent: sign < 0 ? 'flex-end' : 'flex-start', paddingHorizontal: 24, gap: 8 }}>
      {Icon ? <Animated.View style={{ transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }] }}><Icon size={22} color="#FFFFFF" strokeWidth={2.4} /></Animated.View> : null}
      {label ? <T size={15} weight="800" color="#FFFFFF">{label}</T> : null}
    </Animated.View>
    <Animated.View {...pan.panHandlers} style={[{ transform: [{ translateX: x }] }, WEB ? { touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' } : null]}>{children}</Animated.View>
  </View>;
}

// ── Varios ─────────────────────────────────────────────────────────────────
// Punto de conexión: verde con halo en vivo; ámbar con latido al reconectar; rojo sin red.
export function ConnectionDot({ state = 'live', label }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0, duration: state === 'live' ? 1400 : 700, useNativeDriver: ND }), Animated.timing(v, { toValue: 1, duration: 0, useNativeDriver: ND })]));
    loop.start(); return () => loop.stop();
  }, [state]);
  // Conectado es lo normal: no se muestra nada. Solo aparece cuando hay un problema de conexión.
  if (state === 'live') return null;
  const color = state === 'offline' ? c.red : c.amber;
  return <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }] }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
    {label ? <T size={13} color={state === 'live' ? c.muted : color} weight="600" numberOfLines={1}>{label}</T> : null}
  </View>;
}

export function Field({ label, hint, error, style, ...props }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={[{ gap: 6 }, style]}>
    {label ? <Label color={c.text}>{label}</Label> : null}
    <TextInput placeholderTextColor={c.muted} {...props} onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }}
      style={[{ minHeight: TOUCH, borderWidth: 1.5, borderColor: error ? c.red : focus ? c.primaryText : c.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10,
        fontFamily: FONT, fontSize: 16, color: c.text, backgroundColor: focus ? c.surface : c.surfaceAlt, ...(WEB ? { outlineStyle: 'none', transitionProperty: 'border-color, background-color', transitionDuration: '150ms' } : {}) },
        props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]} />
    {error ? <T size={14} color={c.red} weight="600">{error}</T> : hint ? <T size={14} color={c.muted}>{hint}</T> : null}
  </View>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  const { c } = useTheme();
  return <Appear style={{ alignItems: 'center', paddingVertical: space.x3, paddingHorizontal: space.xl, gap: space.sm }}>
    {Icon ? <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Icon size={28} color={c.muted} strokeWidth={1.8} /></View> : null}
    <T size={18} weight="700" style={{ textAlign: 'center' }}>{title}</T>
    {description ? <T size={15} color={c.muted} style={{ textAlign: 'center', maxWidth: 340 }}>{description}</T> : null}
    {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
  </Appear>;
}

// Aparición al montar o al cambiar `trigger`: sube 8 px y aparece en 200 ms.
export function Appear({ children, trigger, delay = 0, style, offset = 8 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 200, delay, easing: EASE, useNativeDriver: ND }).start(); }, [trigger]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }]}>{children}</Animated.View>;
}

// Marca del local en la cabecera: su logo; sin logo, iniciales en su color y el nombre.
export function BrandMark({ name, logo, height = 28 }) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logo]);
  const words = String(name || '').trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w) && !/^(de|del|la|el|y|&)$/i.test(w));
  const initials = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  if (logo && !failed) return <Image source={{ uri: logo }} onError={() => setFailed(true)} accessibilityLabel={name || 'Logo'} resizeMode="contain" style={{ height, width: height * 4, maxWidth: 140 }} />;
  return <View accessibilityLabel={name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
    <View style={{ width: height + 4, height: height + 4, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
      <T size={13} weight="800" color={c.onPrimary}>{initials}</T>
    </View>
    <T size={16} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{name || 'Restaurante'}</T>
  </View>;
}

// Halo que se expande una vez cuando una tarjeta cambia de estado en tiempo real.
export function Ping({ trigger, color, radius: r = radius.lg }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.setValue(0); Animated.timing(v, { toValue: 1, duration: 600, easing: EASE, useNativeDriver: ND }).start();
  }, [trigger]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: r + 2, borderWidth: 3, borderColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }} />;
}
