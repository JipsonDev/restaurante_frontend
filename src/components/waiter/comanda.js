// Kit «Suave» de la app del mesero: moderno, redondeado y con sombras suaves.
// Tipografía Plus Jakarta Sans (texto y cifras tabulares). Rojo de la marca para la acción principal.
// Microinteracciones siempre activas: presión con resorte, píldora que se desliza en la barra,
// números que ruedan, hojas con resorte que se arrastran, confirmación con check que rebota,
// avisos flotantes y vibración corta en Android/web.
// (Los nombres de los componentes se conservan para que todas las pantallas los usen sin cambios.)
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, PanResponder, Platform, Pressable, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

// createPortal solo existe en web (react-dom); en nativo se usa el árbol normal.
let createPortalSafe = null;
if (Platform.OS === 'web') { try { createPortalSafe = require('react-dom').createPortal; } catch {} }

export const WEB = Platform.OS === 'web';
const ND = !WEB; // useNativeDriver
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

// ── Tipografía ─────────────────────────────────────────────────────────────
export const FONT = WEB ? '"Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, sans-serif' : undefined;
export const NARROW = FONT;
export const MONO = FONT; // las cifras usan la misma letra con números tabulares

let fontsInjected = false;
export function useComandaFonts() {
  useEffect(() => {
    if (!WEB || fontsInjected || typeof document === 'undefined') return;
    fontsInjected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 24, sheet: 28, pill: 999 };
export const TOUCH = 48;     // toque mínimo
export const TOUCH_MAIN = 56; // acción principal

// Sombra suave en capas (web) o elevación (nativo).
export function elevate(c, level = 1) {
  if (c.isDark) return WEB ? { boxShadow: level > 1 ? '0 12px 32px rgba(0,0,0,0.45)' : 'none' } : { elevation: level * 2 };
  if (WEB) {
    const s = { 1: '0 1px 2px rgba(16,24,40,0.05), 0 2px 8px rgba(16,24,40,0.06)', 2: '0 4px 10px rgba(16,24,40,0.06), 0 12px 28px rgba(16,24,40,0.10)', 3: '0 10px 24px rgba(16,24,40,0.10), 0 24px 56px rgba(16,24,40,0.16)' };
    return { boxShadow: s[level] || s[1] };
  }
  return { shadowColor: '#101828', shadowOffset: { width: 0, height: 2 * level }, shadowOpacity: 0.08 + 0.02 * level, shadowRadius: 6 * level, elevation: 2 * level };
}
// Sombra de color para el botón principal.
const glow = (color, c) => (WEB && !c.isDark ? { boxShadow: `0 6px 16px ${color}40, 0 2px 4px ${color}30` } : {});

export function T({ style, size = 16, weight = '400', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.38), fontWeight: weight, color: color || c.text, letterSpacing: size >= 22 ? -0.4 : 0 }, style]} />;
}
// Cifras: misma letra con números tabulares para que no «bailen».
export function Num({ style, size = 16, weight = '600', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: weight, color: color || c.text, fontVariant: ['tabular-nums'], letterSpacing: size >= 22 ? -0.5 : 0 }, style]} />;
}
// Rótulo de sección: texto normal (sin mayúsculas forzadas), semibold y atenuado.
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
// Al presionar se encoge a 0,97 en 100 ms; al soltar vuelve con un pequeño rebote.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Press({ children, style, onPress, onLongPress, disabled, scaleTo = 0.97, sink = 0, hapticKind, hoverStyle, ...props }) {
  const v = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const down = () => Animated.timing(v, { toValue: 1, duration: 100, easing: EASE, useNativeDriver: ND }).start();
  const up = () => Animated.spring(v, { toValue: 0, speed: 22, bounciness: 9, useNativeDriver: ND }).start();
  return <AnimatedPressable {...props} disabled={disabled} delayLongPress={400}
    onPress={e => { if (hapticKind) haptic(hapticKind); onPress?.(e); }} onLongPress={onLongPress ? e => { haptic('medium'); onLongPress(e); } : undefined}
    onPressIn={down} onPressOut={up} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={[typeof style === 'function' ? style({ hovered }) : style, hovered && !disabled ? hoverStyle : null,
      { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, sink] }) }] },
      WEB ? { cursor: disabled ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent', transitionProperty: 'background-color, box-shadow, border-color', transitionDuration: '160ms' } : null]}>
    {typeof children === 'function' ? children({ hovered }) : children}
  </AnimatedPressable>;
}

// ── Botones ────────────────────────────────────────────────────────────────
// variant: primary (rojo de la marca, con brillo) · ink (oscuro) · outline (tonal gris) · ghost · danger (tonal rojo)
export function Button({ children, icon: Icon, iconRight: IconRight, variant = 'outline', size = 'md', onPress, disabled, loading, full, style, accessibilityLabel, hapticKind = 'tap' }) {
  const { c } = useTheme();
  const h = size === 'lg' ? TOUCH_MAIN : size === 'sm' ? 40 : TOUCH;
  const v = {
    primary: { bg: c.primary, fg: c.onPrimary, hover: c.primaryHover },
    ink: { bg: c.ink, fg: c.onInk, hover: c.isDark ? '#FFFFFF' : '#2A2D33' },
    outline: { bg: c.surfaceAlt, fg: c.text, hover: c.soft },
    ghost: { bg: 'transparent', fg: c.text, hover: c.surfaceAlt },
    danger: { bg: c.redSoft, fg: c.red, hover: c.redSoft },
  }[variant];
  const off = disabled || loading;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off} onPress={onPress} hapticKind={hapticKind}
    style={[{ minHeight: h, paddingHorizontal: size === 'sm' ? 14 : size === 'lg' ? 22 : 18, borderRadius: radius.pill, backgroundColor: v.bg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off && !loading ? 0.45 : 1 }, variant === 'primary' && !off ? glow(c.primary, c) : null,
      full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    hoverStyle={{ backgroundColor: v.hover }}>
    {loading ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={size === 'lg' ? 20 : 18} color={v.fg} strokeWidth={2.2} /> : null}
    {children != null ? (typeof children === 'string' || typeof children === 'number'
      ? <T size={size === 'lg' ? 17 : size === 'sm' ? 14 : 15} weight="700" color={v.fg} numberOfLines={1}>{children}</T> : children) : null}
    {IconRight && !loading ? <IconRight size={18} color={v.fg} strokeWidth={2.2} /> : null}
  </Press>;
}

export function IconButton({ icon: Icon, label, onPress, size = TOUCH, badge, tone, disabled, color, filled }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hapticKind="tap" scaleTo={0.9}
    style={{ width: size, height: size, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, backgroundColor: filled ? c.surfaceAlt : 'transparent' }} hoverStyle={{ backgroundColor: c.surfaceAlt }}>
    <Icon size={22} color={color || (tone === 'danger' ? c.red : c.text)} strokeWidth={2} />
    {badge ? <View style={{ position: 'absolute', top: 5, right: 3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
      <Num size={10} weight="800" color={c.onPrimary}>{badge > 99 ? '99+' : badge}</Num>
    </View> : null}
  </Press>;
}

// Filtro o elección: píldora gris; seleccionada, oscura con texto blanco.
export function Chip({ children, selected, onPress, count, icon: Icon, accessibilityLabel }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} hapticKind="select" scaleTo={0.94}
    style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: selected ? c.ink : c.surfaceAlt,
      flexDirection: 'row', alignItems: 'center', gap: 7 }} hoverStyle={selected ? null : { backgroundColor: c.soft }}>
    {Icon ? <Icon size={16} color={selected ? c.onInk : c.text} strokeWidth={2.2} /> : null}
    <T size={15} weight={selected ? '700' : '600'} color={selected ? c.onInk : c.text} numberOfLines={1}>{children}</T>
    {count != null ? <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: selected ? 'rgba(255,255,255,0.18)' : c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Num size={12} weight="700" color={selected ? c.onInk : c.muted}>{count}</Num>
    </View> : null}
  </Press>;
}

// ── Superficies ────────────────────────────────────────────────────────────
// Tarjeta: blanca, muy redondeada, con sombra suave (en oscuro, borde fino).
export function Sheet({ children, style, level = 1, ...props }) {
  const { c } = useTheme();
  return <View {...props} style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.isDark ? c.line : 'rgba(16,24,40,0.04)' }, elevate(c, level), style]}>{children}</View>;
}
// Separador fino.
export function Perforation({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}
// Fila con texto a la izquierda y valor a la derecha.
export function LeaderLine({ left, right }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ flex: 1, minWidth: 0 }}>{left}</View>
    <View>{right}</View>
  </View>;
}

// ── Insignias ──────────────────────────────────────────────────────────────
// Píldora de estado con tinte suave y punto. Con `animate`, aparece con un pequeño rebote.
const SOFT = c => ({ [c.onPrimary]: 'rgba(255,255,255,0.22)', [c.green]: c.greenSoft, [c.amber]: c.amberSoft, [c.red]: c.redSoft, [c.primary]: c.primarySoft, [c.purple]: c.purpleSoft, [c.sky]: c.skySoft, [c.muted]: c.surfaceAlt, [c.ink]: c.surfaceAlt, [c.text]: c.surfaceAlt });
export function Stamp({ children, color, animate, size = 13, style, dot = true }) {
  const { c } = useTheme();
  const tone = color || c.primary;
  const bg = SOFT(c)[tone] || c.surfaceAlt;
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => { if (animate) { v.setValue(0); haptic('success'); Animated.spring(v, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: ND }).start(); } }, [animate]);
  return <Animated.View style={[{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3,
    opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }, style]}>
    {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} /> : null}
    <T size={size} weight="700" color={tone} numberOfLines={1}>{typeof children === 'string' ? children.charAt(0) + children.slice(1).toLowerCase() : children}</T>
  </Animated.View>;
}

// Confirmación central (p. ej. «Enviada»): círculo que rebota con un check que se dibuja, y se desvanece.
export function StampBurst({ text, visible, onDone, color }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    haptic('success');
    v.setValue(0); ring.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(v, { toValue: 1, speed: 12, bounciness: 14, useNativeDriver: ND }),
        Animated.delay(750),
        Animated.timing(v, { toValue: 2, duration: 220, easing: EASE, useNativeDriver: ND }),
      ]),
      Animated.timing(ring, { toValue: 1, duration: 650, easing: EASE, useNativeDriver: ND }),
    ]).start(() => onDone?.());
  }, [visible]);
  if (!visible) return null;
  const tone = color || c.green;
  const label = typeof text === 'string' ? text.charAt(0) + text.slice(1).toLowerCase() : text;
  return <View pointerEvents="none" style={{ position: WEB ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
    <Animated.View accessibilityLiveRegion="assertive" style={[{ alignItems: 'center', gap: 12, paddingHorizontal: 32, paddingVertical: 24, borderRadius: radius.xl, backgroundColor: c.surface,
      opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.7, 1, 0.94] }) }] }, elevate(c, 3)]}>
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: tone,
          opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }} />
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tone, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={34} color="#FFFFFF" strokeWidth={3} />
        </View>
      </View>
      <T size={20} weight="800">{label}</T>
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

// Cantidad: píldora gris con botones redondos − n +.
export function Tally({ value, onChange, min = 0, max = 99, label = 'Cantidad' }) {
  const { c } = useTheme();
  const btn = (delta, glyph, disabled) => <Press accessibilityRole="button" accessibilityLabel={`${delta > 0 ? 'Aumentar' : 'Disminuir'} ${label.toLowerCase()}`} disabled={disabled}
    onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))} hapticKind="select" scaleTo={0.86}
    style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: delta > 0 ? c.ink : c.surface, opacity: disabled ? 0.35 : 1 }, delta > 0 ? null : elevate(c, 1)]}>
    <T size={22} weight="600" color={delta > 0 ? c.onInk : c.text} style={{ lineHeight: 24 }}>{glyph}</T>
  </Press>;
  return <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: c.surfaceAlt, alignSelf: 'flex-start' }}>
    {btn(-1, '−', value <= min)}
    <View style={{ minWidth: 34, alignItems: 'center' }}><RollingNumber value={value} size={18} weight="800" /></View>
    {btn(1, '+', value >= max)}
  </View>;
}

// ── Hoja inferior ──────────────────────────────────────────────────────────
// Sube con resorte; se cierra arrastrando hacia abajo (sigue al dedo, cierra al 30 % o con un tirón) o tocando el fondo.
export function BottomSheet({ visible, onClose, title, subtitle, children, footer, maxHeight = '88%', busy }) {
  const { c } = useTheme();
  const { height: vh, width: vw } = useWindowDimensions();
  const wide = vw >= 760;
  const y = useRef(new Animated.Value(1)).current; // 0 abierta, 1 cerrada
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const heightRef = useRef(600);
  useEffect(() => {
    if (visible) { setMounted(true); drag.setValue(0); y.setValue(1); Animated.spring(y, { toValue: 0, speed: 14, bounciness: 5, useNativeDriver: ND }).start(); }
    else if (mounted) Animated.timing(y, { toValue: 1, duration: 220, easing: EASE, useNativeDriver: ND }).start(() => setMounted(false));
  }, [visible]);
  const close = () => { if (!busy) onClose?.(); };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy * 0.2),
    onPanResponderRelease: (_, g) => {
      if (g.dy > heightRef.current * 0.3 || g.vy > 0.6) { haptic('light'); close(); }
      else Animated.spring(drag, { toValue: 0, speed: 20, bounciness: 8, useNativeDriver: ND }).start();
    },
  }), [busy]);
  if (!mounted) return null;
  const R = radius.sheet;
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <Animated.View style={[{ flex: 1, backgroundColor: c.overlay, opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center', padding: wide ? 24 : 0 },
      null]}>
      <Pressable accessibilityLabel="Cerrar" onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      <Animated.View onLayout={e => { heightRef.current = e.nativeEvent.layout.height; }} accessibilityViewIsModal
        style={[{ width: '100%', maxWidth: wide ? 560 : undefined, maxHeight, backgroundColor: c.surface, borderTopLeftRadius: R, borderTopRightRadius: R,
          borderBottomLeftRadius: wide ? R : 0, borderBottomRightRadius: wide ? R : 0, overflow: 'hidden',
          transform: [{ translateY: Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(vh, 900)] }), drag) }] }, elevate(c, 3)]}>
        <View {...pan.panHandlers} style={{ paddingTop: 10, paddingHorizontal: space.xl, paddingBottom: title ? space.sm : 4 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.softer, marginBottom: title ? space.md : 0 }} />
          {title ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={21} weight="800" accessibilityRole="header">{title}</T>
              {subtitle ? <T size={15} color={c.muted}>{subtitle}</T> : null}
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
// Píldora flotante oscura que sube con resorte sobre la barra inferior; con acción dura 5 s.
const ToastCtx = createContext({ show: () => {}, lift: () => {} });
export const useComandaToast = () => useContext(ToastCtx);
export const useToastLift = () => useContext(ToastCtx).lift;

function ToastItem({ t, onDone }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  const close = useCallback(() => Animated.timing(v, { toValue: 0, duration: 180, easing: EASE, useNativeDriver: ND }).start(() => onDone(t.id)), []);
  useEffect(() => {
    Animated.spring(v, { toValue: 1, speed: 16, bounciness: 9, useNativeDriver: ND }).start();
    const timer = setTimeout(close, t.duration || (t.action ? 5000 : 3200));
    return () => clearTimeout(timer);
  }, []);
  const Icon = t.icon;
  const tone = t.tone === 'error' ? '#FF8A70' : t.tone === 'warning' ? '#F5C451' : t.tone === 'success' ? '#5FD69A' : null;
  const bg = c.isDark ? '#2A2C32' : '#16181D';
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 48, paddingLeft: 14, paddingRight: 4, borderRadius: radius.lg,
    backgroundColor: bg }, WEB ? { boxShadow: '0 12px 32px rgba(0,0,0,0.28)' } : { elevation: 12 }]}>
    {Icon ? <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={tone || '#FFFFFF'} /></View>
      : tone ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} /> : null}
    <View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}>
      <T size={14} weight="700" color="#FFFFFF" numberOfLines={2}>{t.message}</T>
      {t.detail ? <T size={12} color="#FFFFFF" style={{ opacity: 0.7 }} numberOfLines={1}>{t.detail}</T> : null}
    </View>
    {t.action ? <Press accessibilityRole="button" onPress={() => { t.action.onPress(); close(); }} hapticKind="tap" style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
      <T size={15} weight="800" color="#FFFFFF">{t.action.label}</T>
    </Press> : null}
    <Press accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={close} style={{ width: 40, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}><X size={18} color="rgba(255,255,255,0.7)" /></Press>
  </Animated.View>;
}

export function ComandaToastProvider({ children, bottomOffset = 84, placement = 'bottom', topOffset = 72 }) {
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState(0);
  const show = useCallback((message, opts = {}) => {
    if (opts.haptic !== false) haptic(opts.tone === 'error' ? 'error' : opts.tone === 'warning' ? 'warning' : 'light');
    setItems(list => [...list.slice(-1), { id: Date.now() + Math.random(), message, ...opts }]);
  }, []);
  const lift = useCallback(n => setExtra(Number(n) || 0), []);
  const value = useMemo(() => ({ show, lift }), [show, lift]);
  const host = <View pointerEvents="box-none" style={[{ position: WEB ? 'fixed' : 'absolute', left: 12, right: 12, alignItems: 'center', gap: 8, zIndex: 2147483000 }, placement === 'top' ? { top: topOffset } : { bottom: bottomOffset + extra }]}>
    <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 520, gap: 8 }}>
      {items.map(t => <ToastItem key={t.id} t={t} onDone={id => setItems(list => list.filter(x => x.id !== id))} />)}
    </View>
  </View>;
  // En web los avisos se montan directamente en <body> para quedar por encima de las hojas abiertas.
  const portal = WEB && typeof document !== 'undefined' && createPortalSafe ? createPortalSafe(host, document.body) : host;
  return <ToastCtx.Provider value={value}>
    {children}
    {portal}
  </ToastCtx.Provider>;
}

// ── Navegación inferior ────────────────────────────────────────────────────
// Barra flotante tipo píldora con vidrio esmerilado; una píldora roja suave se desliza bajo la pestaña activa
// (resorte) y el icono activo da un pequeño salto.
function TabItem({ item, active, onPress }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: active ? 1 : 0, speed: 18, bounciness: 12, useNativeDriver: ND }).start(); }, [active]);
  const Icon = item.icon;
  return <Press accessibilityRole="tab" accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label} accessibilityState={{ selected: active }}
    onPress={onPress} hapticKind="select" scaleTo={0.88} style={{ flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
      <Icon size={22} color={active ? c.primary : c.muted} strokeWidth={active ? 2.4 : 1.9} />
      {item.badge ? <View style={{ position: 'absolute', top: -6, right: -13, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: item.badgeTone === 'ink' ? c.ink : c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
        <RollingNumber value={item.badge} size={10} weight="800" color={item.badgeTone === 'ink' ? c.onInk : c.onPrimary} />
      </View> : null}
    </Animated.View>
    <T size={11} weight={active ? '800' : '600'} color={active ? c.primary : c.muted} numberOfLines={1}>{item.label}</T>
  </Press>;
}

export function TabBar({ items, value, onChange, bottomInset = 0 }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, items.findIndex(i => i.key === value));
  const seg = w / items.length;
  useEffect(() => { if (w) Animated.spring(x, { toValue: index * seg, speed: 16, bounciness: 7, useNativeDriver: ND }).start(); }, [index, w, items.length]);
  return <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: Math.max(bottomInset, 8), backgroundColor: 'transparent' }}>
    <View onLayout={e => setW(e.nativeEvent.layout.width - 12)} accessibilityRole="tablist"
      style={[{ flexDirection: 'row', padding: 6, borderRadius: radius.pill, backgroundColor: c.glass, borderWidth: 1, borderColor: c.isDark ? c.line : 'rgba(16,24,40,0.06)', maxWidth: 560, width: '100%', alignSelf: 'center' },
        WEB ? { backdropFilter: 'saturate(180%) blur(18px)', WebkitBackdropFilter: 'saturate(180%) blur(18px)' } : null, elevate(c, 2)]}>
      {w ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 6, bottom: 6, left: 6, width: seg, borderRadius: radius.pill, backgroundColor: c.primarySoft, transform: [{ translateX: x }] }} /> : null}
      {items.map(item => <TabItem key={item.key} item={item} active={item.key === value} onPress={() => onChange(item.key)} />)}
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
  const color = state === 'live' ? c.greenDot : state === 'offline' ? c.red : c.amber;
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
    <TextInput placeholderTextColor={c.faint} {...props} onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }}
      style={[{ minHeight: TOUCH, borderWidth: 2, borderColor: error ? c.red : focus ? c.primary : 'transparent', borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10,
        fontFamily: FONT, fontSize: 16, color: c.text, backgroundColor: focus ? c.surface : c.surfaceAlt, ...(WEB ? { outlineStyle: 'none', transitionProperty: 'border-color, background-color, box-shadow', transitionDuration: '160ms', boxShadow: focus ? `0 0 0 4px ${c.focus}` : 'none' } : {}) },
        props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]} />
    {error ? <T size={14} color={c.red} weight="600">{error}</T> : hint ? <T size={14} color={c.muted}>{hint}</T> : null}
  </View>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  const { c } = useTheme();
  return <Appear style={{ alignItems: 'center', paddingVertical: space.x3, paddingHorizontal: space.xl, gap: space.sm }}>
    {Icon ? <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}><Icon size={30} color={c.muted} strokeWidth={1.8} /></View> : null}
    <T size={18} weight="800" style={{ textAlign: 'center' }}>{title}</T>
    {description ? <T size={15} color={c.muted} style={{ textAlign: 'center', maxWidth: 360 }}>{description}</T> : null}
    {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
  </Appear>;
}

// Aparición al montar o al cambiar `trigger`: sube 12 px, escala 0,98→1 y aparece en 320 ms.
export function Appear({ children, trigger, delay = 0, style, offset = 12 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 320, delay, easing: EASE, useNativeDriver: ND }).start(); }, [trigger]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>{children}</Animated.View>;
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
