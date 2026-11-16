// Kit «Comanda» de la app del mesero: la libreta de comandas hecha interfaz.
// Papel, tinta, achiote y sellos. Tipografía Archivo (texto) + JetBrains Mono (números y precios).
// Microinteracciones siempre activas: presión que «hunde» el papel, contador que rueda, sello que cae,
// hoja inferior que se arrastra, avisos que suben, indicador que se desliza. Vibración corta en Android/web.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, PanResponder, Platform, Pressable, Text, TextInput, Vibration, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme';

// createPortal solo existe en web (react-dom); en nativo se usa el árbol normal.
let createPortalSafe = null;
if (Platform.OS === 'web') { try { createPortalSafe = require('react-dom').createPortal; } catch {} }

export const WEB = Platform.OS === 'web';
const ND = !WEB; // useNativeDriver
export const EASE = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

// ── Tipografía ─────────────────────────────────────────────────────────────
export const FONT = WEB ? '"Archivo", "Segoe UI", system-ui, sans-serif' : undefined;
export const NARROW = WEB ? '"Archivo Narrow", "Archivo", "Segoe UI", system-ui, sans-serif' : undefined;
export const MONO = WEB ? '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace' : Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined });

let fontsInjected = false;
export function useComandaFonts() {
  useEffect(() => {
    if (!WEB || fontsInjected || typeof document === 'undefined') return;
    fontsInjected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Archivo+Narrow:wght@600;700&family=JetBrains+Mono:wght@500;700&display=swap';
    document.head.appendChild(link);
  }, []);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32 };
export const radius = { sm: 4, md: 6, lg: 10, sheet: 16, pill: 999 };
export const TOUCH = 48;     // toque mínimo
export const TOUCH_MAIN = 56; // acción principal

export function T({ style, size = 16, weight = '400', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.35), fontWeight: weight, color: color || c.text }, style]} />;
}
// Números y precios: monoespaciada con cifras tabulares.
export function Num({ style, size = 16, weight = '500', color, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: MONO, fontSize: size, lineHeight: Math.round(size * 1.3), fontWeight: weight, color: color || c.text, fontVariant: ['tabular-nums'] }, style]} />;
}
// Rótulo estrecho en mayúsculas, como el encabezado impreso de la libreta.
export function Label({ style, color, size = 13, ...props }) {
  const { c } = useTheme();
  return <Text {...props} style={[{ fontFamily: NARROW, fontSize: size, lineHeight: size + 4, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: color || c.muted }, style]} />;
}

export const money = n => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Vibración ──────────────────────────────────────────────────────────────
const PATTERNS = { tap: 8, select: 6, light: 12, medium: 20, success: [0, 18, 60, 24], warning: [0, 30, 80, 30] };
export function haptic(kind = 'tap') {
  const p = PATTERNS[kind] ?? 10;
  try {
    if (WEB) { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(p); return; }
    if (Platform.OS === 'android') Vibration.vibrate(p);
  } catch {}
}

// ── Presión ────────────────────────────────────────────────────────────────
// Al presionar, el papel «se hunde»: escala 0,98 y baja 1 px en 90 ms; al soltar vuelve con resorte.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Press({ children, style, onPress, onLongPress, disabled, scaleTo = 0.98, sink = 1, hapticKind, hoverStyle, ...props }) {
  const v = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const down = () => Animated.timing(v, { toValue: 1, duration: 90, easing: EASE, useNativeDriver: ND }).start();
  const up = () => Animated.spring(v, { toValue: 0, speed: 28, bounciness: 6, useNativeDriver: ND }).start();
  return <AnimatedPressable {...props} disabled={disabled} delayLongPress={400}
    onPress={e => { if (hapticKind) haptic(hapticKind); onPress?.(e); }} onLongPress={onLongPress ? e => { haptic('medium'); onLongPress(e); } : undefined}
    onPressIn={down} onPressOut={up} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    style={[typeof style === 'function' ? style({ hovered }) : style, hovered && !disabled ? hoverStyle : null,
      { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, sink] }) }] },
      WEB ? { cursor: disabled ? 'default' : 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent' } : null]}>
    {typeof children === 'function' ? children({ hovered }) : children}
  </AnimatedPressable>;
}

// ── Botones ────────────────────────────────────────────────────────────────
// variant: primary (achiote) · ink (tinta) · outline (borde de tinta) · ghost · danger
export function Button({ children, icon: Icon, iconRight: IconRight, variant = 'outline', size = 'md', onPress, disabled, loading, full, style, accessibilityLabel, hapticKind = 'tap' }) {
  const { c } = useTheme();
  const h = size === 'lg' ? TOUCH_MAIN : size === 'sm' ? 40 : TOUCH;
  const v = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary, hover: c.primaryHover },
    ink: { bg: c.ink, fg: c.onInk, border: c.ink, hover: c.isDark ? '#FFFFFF' : '#000000' },
    outline: { bg: c.surface, fg: c.text, border: c.ink, hover: c.surfaceAlt },
    ghost: { bg: 'transparent', fg: c.text, border: 'transparent', hover: c.soft },
    danger: { bg: c.surface, fg: c.red, border: c.red, hover: c.redSoft },
  }[variant];
  const off = disabled || loading;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off} onPress={onPress} hapticKind={hapticKind}
    style={[{ minHeight: h, paddingHorizontal: size === 'sm' ? 12 : 16, borderRadius: radius.md, borderWidth: variant === 'outline' ? 1.5 : 1, borderColor: v.border, backgroundColor: v.bg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off && !loading ? 0.45 : 1 }, full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    hoverStyle={{ backgroundColor: v.hover }}>
    {loading ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={size === 'lg' ? 20 : 18} color={v.fg} strokeWidth={2.2} /> : null}
    {children != null ? (typeof children === 'string' || typeof children === 'number'
      ? <T size={size === 'lg' ? 17 : size === 'sm' ? 14 : 15} weight="700" color={v.fg} numberOfLines={1}>{children}</T> : children) : null}
    {IconRight && !loading ? <IconRight size={18} color={v.fg} strokeWidth={2.2} /> : null}
  </Press>;
}

export function IconButton({ icon: Icon, label, onPress, size = TOUCH, badge, tone, disabled, color }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hapticKind="tap" scaleTo={0.92} sink={0}
    style={{ width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }} hoverStyle={{ backgroundColor: c.soft }}>
    <Icon size={22} color={color || (tone === 'danger' ? c.red : c.text)} strokeWidth={2} />
    {badge ? <View style={{ position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
      <Num size={10} weight="700" color={c.onPrimary}>{badge > 99 ? '99+' : badge}</Num>
    </View> : null}
  </Press>;
}

// Filtro o elección: la selección es tinta (nunca un color de estado).
export function Chip({ children, selected, onPress, count, icon: Icon, accessibilityLabel }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} hapticKind="select" scaleTo={0.96}
    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? c.ink : c.lineStrong, backgroundColor: selected ? c.ink : 'transparent',
      flexDirection: 'row', alignItems: 'center', gap: 6 }} hoverStyle={selected ? null : { borderColor: c.ink }}>
    {Icon ? <Icon size={16} color={selected ? c.onInk : c.text} /> : null}
    <T size={15} weight={selected ? '700' : '500'} color={selected ? c.onInk : c.text} numberOfLines={1}>{children}</T>
    {count != null ? <Num size={13} color={selected ? c.onInk : c.muted}>{count}</Num> : null}
  </Press>;
}

// ── Papel ──────────────────────────────────────────────────────────────────
// Hoja: superficie de papel con borde fino y esquinas casi rectas.
export function Sheet({ children, style, ...props }) {
  const { c } = useTheme();
  return <View {...props} style={[{ backgroundColor: c.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: c.line }, style]}>{children}</View>;
}
// Línea perforada (separador de comanda).
export function Perforation({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: c.lineStrong }, style]} />;
}
// Línea de comanda: «Batido de mora ····· 2,80».
export function LeaderLine({ left, right, dim }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
    <View style={{ flexShrink: 1 }}>{left}</View>
    <View style={{ flex: 1, minWidth: 12, marginBottom: 5, borderBottomWidth: 1.5, borderStyle: 'dotted', borderColor: dim ? c.line : c.lineStrong }} />
    <View>{right}</View>
  </View>;
}

// ── Sello ──────────────────────────────────────────────────────────────────
// Sello de goma: estático (etiqueta con borde) o animado al aparecer (cae: escala 1,15→1, gira −6°).
export function Stamp({ children, color, animate, rotate = -6, size = 13, style }) {
  const { c } = useTheme();
  const tone = color || c.primary;
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => { if (animate) { v.setValue(0); haptic('success'); Animated.spring(v, { toValue: 1, speed: 16, bounciness: 9, useNativeDriver: ND }).start(); } }, [animate]);
  return <Animated.View style={[{ alignSelf: 'flex-start', borderWidth: 2, borderColor: tone, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1,
    opacity: v, transform: [{ rotate: `${rotate}deg` }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }] }, style]}>
    <Label size={size} color={tone}>{children}</Label>
  </Animated.View>;
}

// Sello grande que cae en el centro de la pantalla (p. ej. «ENVIADA»): aparece, queda 900 ms y se desvanece.
export function StampBurst({ text, visible, onDone, color }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    haptic('success');
    v.setValue(0);
    Animated.sequence([
      Animated.spring(v, { toValue: 1, speed: 14, bounciness: 10, useNativeDriver: ND }),
      Animated.delay(900),
      Animated.timing(v, { toValue: 2, duration: 220, easing: EASE, useNativeDriver: ND }),
    ]).start(() => onDone?.());
  }, [visible]);
  if (!visible) return null;
  const tone = color || c.primary;
  return <View pointerEvents="none" style={{ position: WEB ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20000 }}>
    <Animated.View accessibilityLiveRegion="assertive" style={{ borderWidth: 4, borderColor: tone, borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 8, backgroundColor: c.isDark ? 'rgba(26,25,23,0.85)' : 'rgba(255,253,248,0.9)',
      opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
      transform: [{ rotate: '-8deg' }, { scale: v.interpolate({ inputRange: [0, 1, 2], outputRange: [1.6, 1, 0.96] }) }] }}>
      <Label size={34} color={tone} style={{ lineHeight: 40, letterSpacing: 2 }}>{text}</Label>
    </Animated.View>
  </View>;
}

// ── Cifras ─────────────────────────────────────────────────────────────────
// Número que rueda: al cambiar, el valor anterior sale hacia arriba y el nuevo entra desde abajo (180 ms).
export function RollingNumber({ value, format = v => String(v), size = 16, weight = '700', color, style }) {
  const [shown, setShown] = useState(value);
  const [prev, setPrev] = useState(null);
  const v = useRef(new Animated.Value(1)).current;
  const dir = useRef(1);
  useEffect(() => {
    if (value === shown) return;
    dir.current = Number(value) >= Number(shown) ? 1 : -1;
    setPrev(shown); setShown(value); v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 180, easing: EASE, useNativeDriver: ND }).start(() => setPrev(null));
  }, [value]);
  const h = Math.round(size * 1.3);
  return <View style={[{ height: h, overflow: 'hidden', justifyContent: 'center' }, style]}>
    {prev != null ? <Animated.View style={{ position: 'absolute', left: 0, right: 0, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -h * dir.current] }) }] }}>
      <Num size={size} weight={weight} color={color}>{format(prev)}</Num></Animated.View> : null}
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [prev != null ? h * dir.current : 0, 0] }) }] }}>
      <Num size={size} weight={weight} color={color}>{format(shown)}</Num>
    </Animated.View>
  </View>;
}

// Cantidad − n +, con número que rueda.
export function Tally({ value, onChange, min = 0, max = 99, label = 'Cantidad' }) {
  const { c } = useTheme();
  const btn = (delta, glyph, disabled) => <Press accessibilityRole="button" accessibilityLabel={`${delta > 0 ? 'Aumentar' : 'Disminuir'} ${label.toLowerCase()}`} disabled={disabled}
    onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))} hapticKind="select" scaleTo={0.9} sink={0}
    style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
    <Num size={22} weight="700">{glyph}</Num>
  </Press>;
  return <View accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: c.ink, borderRadius: radius.md, alignSelf: 'flex-start' }}>
    {btn(-1, '−', value <= min)}
    <View style={{ minWidth: 36, alignItems: 'center' }}><RollingNumber value={value} size={20} /></View>
    {btn(1, '+', value >= max)}
  </View>;
}

// ── Hoja inferior ──────────────────────────────────────────────────────────
// Sube con resorte; se cierra arrastrando hacia abajo (1:1, cierra al 30 % o a > 0,6 px/ms) o tocando el fondo.
export function BottomSheet({ visible, onClose, title, subtitle, children, footer, maxHeight = '88%', busy }) {
  const { c } = useTheme();
  const { height: vh, width: vw } = useWindowDimensions();
  const wide = vw >= 760;
  const y = useRef(new Animated.Value(1)).current; // 0 abierta, 1 cerrada
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const heightRef = useRef(600);
  useEffect(() => {
    if (visible) { setMounted(true); drag.setValue(0); y.setValue(1); Animated.spring(y, { toValue: 0, speed: 16, bounciness: 3, useNativeDriver: ND }).start(); }
    else if (mounted) Animated.timing(y, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: ND }).start(() => setMounted(false));
  }, [visible]);
  const close = () => { if (!busy) onClose?.(); };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy * 0.2),
    onPanResponderRelease: (_, g) => {
      if (g.dy > heightRef.current * 0.3 || g.vy > 0.6) { haptic('light'); close(); }
      else Animated.spring(drag, { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: ND }).start();
    },
  }), [busy]);
  if (!mounted) return null;
  return <Modal visible transparent animationType="none" onRequestClose={close}>
    <Animated.View style={{ flex: 1, backgroundColor: c.overlay, opacity: y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
      <Pressable accessibilityLabel="Cerrar" onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
      <Animated.View onLayout={e => { heightRef.current = e.nativeEvent.layout.height; }} accessibilityViewIsModal
        style={{ width: '100%', maxWidth: wide ? 560 : undefined, maxHeight, backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          borderBottomLeftRadius: wide ? radius.sheet : 0, borderBottomRightRadius: wide ? radius.sheet : 0, overflow: 'hidden',
          transform: [{ translateY: Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(vh, 900)] }), drag) }],
          ...(WEB ? { boxShadow: '0 -8px 30px rgba(0,0,0,0.18)' } : { elevation: 16 }) }}>
        <View {...pan.panHandlers} style={{ paddingTop: 8, paddingHorizontal: space.lg, paddingBottom: title ? space.md : 4 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong, marginBottom: title ? space.md : 0 }} />
          {title ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={20} weight="700" accessibilityRole="header">{title}</T>
              {subtitle ? <T size={15} color={c.muted}>{subtitle}</T> : null}
            </View>
            <IconButton icon={X} label="Cerrar" onPress={close} size={40} disabled={busy} />
          </View> : null}
        </View>
        {title ? <Perforation /> : null}
        <Animated.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }} style={{ flexShrink: 1 }}>{children}</Animated.ScrollView>
        {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>{footer}</View> : null}
      </Animated.View>
    </Animated.View>
  </Modal>;
}

// ── Avisos ─────────────────────────────────────────────────────────────────
// Suben desde abajo (sobre la barra de navegación) con resorte; con acción duran 5 s.
const ToastCtx = createContext({ show: () => {}, lift: () => {} });
export const useComandaToast = () => useContext(ToastCtx);
// Desplaza los avisos hacia arriba (p. ej. sobre una barra fija de acción).
export const useToastLift = () => useContext(ToastCtx).lift;

function ToastItem({ t, onDone, bottom }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;
  const close = useCallback(() => Animated.timing(v, { toValue: 0, duration: 160, easing: EASE, useNativeDriver: ND }).start(() => onDone(t.id)), []);
  useEffect(() => {
    Animated.spring(v, { toValue: 1, speed: 18, bounciness: 7, useNativeDriver: ND }).start();
    const timer = setTimeout(close, t.duration || (t.action ? 5000 : 3200));
    return () => clearTimeout(timer);
  }, []);
  const Icon = t.icon;
  const tone = t.tone === 'error' ? c.red : t.tone === 'warning' ? c.amber : t.tone === 'success' ? c.green : null;
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingLeft: space.lg, paddingRight: 6, borderRadius: radius.md,
    backgroundColor: c.ink, ...(WEB ? { boxShadow: '0 8px 24px rgba(0,0,0,0.25)' } : { elevation: 12 }) }}>
    {Icon ? <Icon size={20} color={tone || c.onInk} /> : tone ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} /> : null}
    <View style={{ flex: 1, minWidth: 0, paddingVertical: 10 }}>
      <T size={15} weight="600" color={c.onInk}>{t.message}</T>
      {t.detail ? <T size={13} color={c.onInk} style={{ opacity: 0.75 }}>{t.detail}</T> : null}
    </View>
    {t.action ? <Press accessibilityRole="button" onPress={() => { t.action.onPress(); close(); }} hapticKind="tap" style={{ minHeight: TOUCH, paddingHorizontal: 12, justifyContent: 'center' }}>
      <T size={15} weight="700" color={c.isDark ? c.primary : '#FFB199'} style={{ textDecorationLine: 'underline' }}>{t.action.label}</T>
    </Press> : null}
    <Press accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={close} style={{ width: 40, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={c.onInk} /></Press>
  </Animated.View>;
}

export function ComandaToastProvider({ children, bottomOffset = 84 }) {
  const [items, setItems] = useState([]);
  const [extra, setExtra] = useState(0);
  const show = useCallback((message, opts = {}) => {
    if (opts.haptic !== false) haptic(opts.tone === 'error' ? 'warning' : 'light');
    setItems(list => [...list.slice(-1), { id: Date.now() + Math.random(), message, ...opts }]);
  }, []);
  const lift = useCallback(n => setExtra(Number(n) || 0), []);
  const value = useMemo(() => ({ show, lift }), [show, lift]);
  const host = <View pointerEvents="box-none" style={{ position: WEB ? 'fixed' : 'absolute', left: 12, right: 12, bottom: bottomOffset + extra, alignItems: 'center', gap: 8, zIndex: 2147483000 }}>
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
// Barra de pestañas al alcance del pulgar; una raya de tinta se desliza sobre la pestaña activa (200 ms).
export function TabBar({ items, value, onChange, bottomInset = 0 }) {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const index = Math.max(0, items.findIndex(i => i.key === value));
  useEffect(() => { if (w) Animated.timing(x, { toValue: index * (w / items.length), duration: 200, easing: EASE_IN_OUT, useNativeDriver: ND }).start(); }, [index, w, items.length]);
  return <View onLayout={e => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist"
    style={{ flexDirection: 'row', backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: bottomInset }}>
    {w ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -1, left: 0, width: w / items.length, height: 3, alignItems: 'center', transform: [{ translateX: x }] }}>
      <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: c.ink }} />
    </Animated.View> : null}
    {items.map(item => {
      const active = item.key === value;
      const Icon = item.icon;
      return <Press key={item.key} accessibilityRole="tab" accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label} accessibilityState={{ selected: active }}
        onPress={() => onChange(item.key)} hapticKind="select" scaleTo={0.92} sink={0} style={{ flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <View>
          <Icon size={22} color={active ? c.text : c.muted} strokeWidth={active ? 2.4 : 1.8} />
          {item.badge ? <View style={{ position: 'absolute', top: -6, right: -14, minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: item.badgeTone === 'ink' ? c.ink : c.primary, alignItems: 'center', justifyContent: 'center' }}>
            <RollingNumber value={item.badge} size={11} color={item.badgeTone === 'ink' ? c.onInk : c.onPrimary} />
          </View> : null}
        </View>
        <T size={12} weight={active ? '700' : '500'} color={active ? c.text : c.muted} numberOfLines={1}>{item.label}</T>
      </Press>;
    })}
  </View>;
}

// ── Varios ─────────────────────────────────────────────────────────────────
// Punto de conexión: verde fijo en vivo; ámbar con latido cuando reconecta; rojo sin red.
export function ConnectionDot({ state = 'live', label }) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === 'live') { v.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 0.3, duration: 600, useNativeDriver: ND }), Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: ND })]));
    loop.start(); return () => loop.stop();
  }, [state]);
  const color = state === 'live' ? c.green : state === 'offline' ? c.red : c.amber;
  return <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, opacity: v }} />
    {label ? <T size={13} color={state === 'live' ? c.muted : color} weight="600" numberOfLines={1}>{label}</T> : null}
  </View>;
}

export function Field({ label, hint, error, style, ...props }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return <View style={[{ gap: 6 }, style]}>
    {label ? <Label color={c.text}>{label}</Label> : null}
    <TextInput placeholderTextColor={c.faint} {...props} onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }}
      style={[{ minHeight: TOUCH, borderWidth: 1.5, borderColor: error ? c.red : focus ? c.ink : c.lineStrong, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
        fontFamily: FONT, fontSize: 16, color: c.text, backgroundColor: c.surface, ...(WEB ? { outlineStyle: 'none' } : {}) }, props.multiline ? { minHeight: 88, textAlignVertical: 'top' } : null]} />
    {error ? <T size={14} color={c.red} weight="600">{error}</T> : hint ? <T size={14} color={c.muted}>{hint}</T> : null}
  </View>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  const { c } = useTheme();
  return <View style={{ alignItems: 'center', paddingVertical: space.x3, paddingHorizontal: space.xl, gap: space.sm }}>
    {Icon ? <Icon size={32} color={c.faint} strokeWidth={1.5} /> : null}
    <T size={18} weight="700" style={{ textAlign: 'center' }}>{title}</T>
    {description ? <T size={15} color={c.muted} style={{ textAlign: 'center', maxWidth: 360 }}>{description}</T> : null}
    {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
  </View>;
}

// Aparición corta al montar o al cambiar `trigger` (sube 8 px y aparece en 220 ms).
export function Appear({ children, trigger, delay = 0, style, offset = 8 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 220, delay, easing: EASE, useNativeDriver: ND }).start(); }, [trigger]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }]}>{children}</Animated.View>;
}

// Anillo que se expande una vez (cambio de estado por tiempo real): escala 1→1,08, opacidad 0,6→0, 450 ms.
export function Ping({ trigger, color, radius: r = radius.sm }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.setValue(0); Animated.timing(v, { toValue: 1, duration: 450, easing: EASE, useNativeDriver: ND }).start();
  }, [trigger]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: r + 2, borderWidth: 2, borderColor: color,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }} />;
}
