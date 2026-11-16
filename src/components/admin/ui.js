// Kit de interfaz del panel de administración.
// Un solo vocabulario para botones, campos, tablas, estados y movimiento.
// Microinteracciones: presión con escala, hover suave, indicadores que se deslizan,
// cifras que cuentan, entradas sutiles y avisos (toasts). Todo respeta "reducir movimiento".
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

const WEB = Platform.OS === 'web';
const NATIVE_DRIVER = !WEB;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 };
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };
export const font = {
  display: 'Manrope-Medium',
  ui: WEB ? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' : undefined,
};
export const type = {
  title: { fontFamily: font.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  h2: { fontFamily: font.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h3: { fontFamily: font.ui, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  body: { fontFamily: font.ui, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: font.ui, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.ui, fontSize: 12, lineHeight: 16 },
  figure: { fontFamily: font.display, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  num: { fontVariant: ['tabular-nums'] },
};

// ── Movimiento ──────────────────────────────────────────────────────────────
let reduceMotionCache = false;
AccessibilityInfo.isReduceMotionEnabled?.().then(v => { reduceMotionCache = !!v; }).catch(() => {});
if (WEB && typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotionCache = mq.matches;
  mq.addEventListener?.('change', e => { reduceMotionCache = e.matches; });
}
export const reduceMotion = () => reduceMotionCache;

export function useMotionValue(initial = 0) {
  return useRef(new Animated.Value(initial)).current;
}

// Aparición sutil al montar o cuando cambia `trigger` (p. ej. al cambiar de sección).
export function FadeIn({ children, delay = 0, offset = 6, duration = 220, trigger, style }) {
  const v = useMotionValue(reduceMotion() ? 1 : 0);
  useEffect(() => {
    if (reduceMotion()) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start();
  }, [trigger]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }]}>{children}</Animated.View>;
}

// Número que cuenta hasta su valor (y vuelve a contar cuando cambia).
export function AnimatedNumber({ value, format = v => String(Math.round(v)), duration = 650, style, ...props }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduceMotion() || typeof requestAnimationFrame === 'undefined') { setShown(target); from.current = target; return; }
    const start = from.current; const t0 = Date.now(); let raf;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <Text {...props} style={[type.num, style]}>{format(shown)}</Text>;
}

// ── Superficies ─────────────────────────────────────────────────────────────
export function Card({ children, style, padded = true, ...props }) {
  const { c } = useTheme();
  return <View {...props} style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: radius.lg }, padded ? { padding: space.xl } : null, style]}>{children}</View>;
}

export function Divider({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}

export function PageHeader({ title, description, actions, meta }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.lg, marginBottom: space.xxl }}>
    <View style={{ flexShrink: 1, minWidth: 220, gap: space.xs }}>
      <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>{title}</Text>
      {description ? <Text style={[type.body, { color: c.muted, maxWidth: 640 }]}>{description}</Text> : null}
      {meta ? <View style={{ marginTop: space.xs }}>{meta}</View> : null}
    </View>
    {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, flexShrink: 1, maxWidth: '100%' }}>{actions}</View> : null}
  </View>;
}

export function SectionTitle({ title, description, action, style }) {
  const { c } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.md }, style]}>
    <View style={{ flexShrink: 1 }}>
      <Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{title}</Text>
      {description ? <Text style={[type.small, { color: c.muted, marginTop: 2 }]}>{description}</Text> : null}
    </View>
    {action}
  </View>;
}

// ── Presión: escala + fondo en hover/press ──────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Press({ children, style, onPress, disabled, scaleTo = 0.97, hoverStyle, pressedStyle, onHoverIn, onHoverOut, ...props }) {
  const scale = useMotionValue(1);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const to = v => { if (reduceMotion()) return; Animated.spring(scale, { toValue: v, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start(); };
  const state = { hovered, pressed };
  return <AnimatedPressable {...props} disabled={disabled} onPress={onPress}
    onHoverIn={e => { setHovered(true); onHoverIn?.(e); }} onHoverOut={e => { setHovered(false); onHoverOut?.(e); }}
    onPressIn={() => { setPressed(true); to(scaleTo); }} onPressOut={() => { setPressed(false); to(1); }}
    style={[typeof style === 'function' ? style(state) : style, hovered && !disabled ? hoverStyle : null, pressed && !disabled ? pressedStyle : null,
      { transform: [{ scale }] }, WEB ? { cursor: disabled ? 'not-allowed' : 'pointer', transitionProperty: 'background-color, border-color, box-shadow, opacity', transitionDuration: '150ms' } : null]}>
    {typeof children === 'function' ? children(state) : children}
  </AnimatedPressable>;
}

const SIZES = { sm: { h: 34, px: 12, icon: 15, text: 13 }, md: { h: 40, px: 14, icon: 16, text: 14 }, lg: { h: 48, px: 18, icon: 18, text: 15 } };

export function Button({ children, icon: Icon, iconRight: IconRight, variant = 'secondary', size = 'md', loading, disabled, onPress, style, accessibilityLabel, full }) {
  const { c } = useTheme();
  const s = SIZES[size];
  const v = {
    primary: { bg: c.primary, hover: c.primaryHover, press: c.primaryPressed || c.primaryHover, fg: c.onPrimary, border: c.primary },
    ink: { bg: c.ink, hover: c.isDark ? '#FFFFFF' : '#1B2840', press: c.ink, fg: c.onInk, border: c.ink },
    secondary: { bg: c.surface, hover: c.surfaceAlt, press: c.soft, fg: c.text, border: c.lineStrong || c.line },
    ghost: { bg: 'transparent', hover: c.soft, press: c.softer || c.soft, fg: c.text, border: 'transparent' },
    danger: { bg: c.red, hover: c.redBright || c.red, press: c.red, fg: '#FFFFFF', border: c.red },
  }[variant];
  const off = disabled || loading;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off} onPress={onPress}
    style={[{ height: s.h, paddingHorizontal: s.px, borderRadius: radius.md, borderWidth: 1, borderColor: v.border, backgroundColor: v.bg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, opacity: off && !loading ? 0.5 : 1 }, full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    hoverStyle={{ backgroundColor: v.hover }} pressedStyle={{ backgroundColor: v.press }}>
    {loading ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2} /> : null}
    {children ? <Text numberOfLines={1} style={{ fontFamily: font.ui, fontSize: s.text, fontWeight: '600', color: v.fg }}>{children}</Text> : null}
    {IconRight && !loading ? <IconRight size={s.icon} color={v.fg} strokeWidth={2} /> : null}
  </Press>;
}

export function IconButton({ icon: Icon, label, onPress, tone = 'default', size = 36, active, badge, disabled }) {
  const { c } = useTheme();
  const [hot, setHot] = useState(false);
  const fg = tone === 'danger' ? (hot && !disabled ? c.red : c.muted) : active || hot ? c.text : c.muted;
  return <Press onHoverIn={() => setHot(true)} onHoverOut={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress}
    {...(WEB ? { title: label } : {})}
    style={{ width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.soft : 'transparent', opacity: disabled ? 0.45 : 1 }}
    hoverStyle={{ backgroundColor: tone === 'danger' ? c.redSoft : c.soft }}>
    <Icon size={Math.round(size * 0.47)} color={fg} strokeWidth={2} />
    {badge ? <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface }}>
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', fontFamily: font.ui }}>{badge > 99 ? '99+' : badge}</Text>
    </View> : null}
  </Press>;
}

// ── Estados ────────────────────────────────────────────────────────────────
export function toneColors(c, tone) {
  return {
    neutral: [c.soft, c.muted, c.faint], green: [c.greenSoft, c.green, c.greenBright || c.green], amber: [c.amberSoft, c.amber, c.amberBright || c.amber],
    red: [c.redSoft, c.red, c.redBright || c.red], sky: [c.skySoft, c.sky, c.skyBright || c.sky], purple: [c.purpleSoft, c.purple, c.purple],
    gold: [c.primarySoft, c.primaryText, c.primary], pink: [c.pinkSoft, c.pink, c.pink],
  }[tone] || [c.soft, c.muted, c.faint];
}

// Estado = punto + texto (nunca solo color).
export function Status({ tone = 'neutral', children, solid, pulse }) {
  const { c } = useTheme();
  const [bg, fg, dot] = toneColors(c, tone);
  const p = useMotionValue(1);
  useEffect(() => {
    if (!pulse || reduceMotion()) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(p, { toValue: 0.35, duration: 900, useNativeDriver: NATIVE_DRIVER }), Animated.timing(p, { toValue: 1, duration: 900, useNativeDriver: NATIVE_DRIVER })]));
    loop.start(); return () => loop.stop();
  }, [pulse]);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: solid ? 8 : 0, height: solid ? 22 : undefined, borderRadius: radius.pill, backgroundColor: solid ? bg : 'transparent' }}>
    <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot, opacity: p }} />
    <Text numberOfLines={1} style={[type.micro, { color: fg, fontWeight: '600' }]}>{children}</Text>
  </View>;
}

export function Tag({ children, tone = 'neutral' }) {
  const { c } = useTheme();
  const [bg, fg] = toneColors(c, tone);
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, height: 22, borderRadius: radius.sm, backgroundColor: bg, justifyContent: 'center' }}>
    <Text numberOfLines={1} style={[type.micro, { color: fg, fontWeight: '600' }]}>{children}</Text>
  </View>;
}

// ── Selector segmentado con indicador que se desliza ───────────────────────
export function Segmented({ options, value, onChange, size = 'md', accessibilityLabel, style }) {
  const { c } = useTheme();
  const layouts = useRef({});
  const x = useMotionValue(0); const w = useMotionValue(0);
  const [ready, setReady] = useState(false);
  const move = useCallback((key, instant) => {
    const l = layouts.current[key]; if (!l) return;
    if (instant || reduceMotion()) { x.setValue(l.x); w.setValue(l.width); return; }
    Animated.parallel([
      Animated.timing(x, { toValue: l.x, duration: 220, easing: EASE_OUT, useNativeDriver: false }),
      Animated.timing(w, { toValue: l.width, duration: 220, easing: EASE_OUT, useNativeDriver: false }),
    ]).start();
  }, []);
  useEffect(() => { move(value); }, [value]);
  const h = size === 'sm' ? 30 : 36;
  return <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[{ flexDirection: 'row', alignSelf: 'flex-start', padding: 3, borderRadius: radius.md, backgroundColor: c.soft }, style]}>
    {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 3, bottom: 3, left: x, width: w, borderRadius: radius.md - 3, backgroundColor: c.surface,
      ...(WEB ? { boxShadow: c.isDark ? 'none' : `0 1px 2px ${c.shadow}` } : {}) }} /> : null}
    {options.map(opt => {
      const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      const selected = o.value === value;
      return <Pressable key={String(o.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
        onLayout={e => { layouts.current[o.value] = e.nativeEvent.layout; if (o.value === value) { move(o.value, true); setReady(true); } }}
        style={({ hovered }) => ({ height: h, paddingHorizontal: size === 'sm' ? 10 : 14, borderRadius: radius.md - 3, flexDirection: 'row', alignItems: 'center', gap: 6, ...(WEB ? { cursor: 'pointer' } : {}), opacity: hovered && !selected ? 0.8 : 1 })}>
        {o.icon ? <o.icon size={14} color={selected ? c.text : c.muted} /> : null}
        <Text numberOfLines={1} style={[size === 'sm' ? type.micro : type.small, { color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '500' }]}>{o.label}</Text>
        {o.count != null ? <Text style={[type.micro, type.num, { color: c.faint }]}>{o.count}</Text> : null}
      </Pressable>;
    })}
  </View>;
}

// Pestañas con subrayado que se desliza.
export function Tabs({ options, value, onChange, style }) {
  const { c } = useTheme();
  const layouts = useRef({}); const x = useMotionValue(0); const w = useMotionValue(0); const [ready, setReady] = useState(false);
  const move = (key, instant) => { const l = layouts.current[key]; if (!l) return; if (instant || reduceMotion()) { x.setValue(l.x); w.setValue(l.width); return; }
    Animated.parallel([Animated.timing(x, { toValue: l.x, duration: 220, easing: EASE_OUT, useNativeDriver: false }), Animated.timing(w, { toValue: l.width, duration: 220, easing: EASE_OUT, useNativeDriver: false })]).start(); };
  useEffect(() => { move(value); }, [value]);
  return <View style={[{ borderBottomWidth: 1, borderBottomColor: c.line }, style]}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: -1 }}>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: space.xl, paddingBottom: 1 }}>
      {options.map(opt => { const o = typeof opt === 'string' ? { value: opt, label: opt } : opt; const selected = o.value === value;
        return <Pressable key={String(o.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
          onLayout={e => { layouts.current[o.value] = e.nativeEvent.layout; if (selected) { move(o.value, true); setReady(true); } }}
          style={({ hovered }) => ({ height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, ...(WEB ? { cursor: 'pointer' } : {}), opacity: hovered && !selected ? 0.75 : 1 })}>
          <Text style={[type.small, { color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '500' }]}>{o.label}</Text>
          {o.count != null ? <Text style={[type.micro, type.num, { color: c.faint }]}>{o.count}</Text> : null}
        </Pressable>; })}
      {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, height: 2, left: x, width: w, backgroundColor: c.primary, borderRadius: 2 }} /> : null}
    </View>
    </ScrollView>
  </View>;
}

// ── Campos ──────────────────────────────────────────────────────────────────
export function SearchField({ value, onChangeText, placeholder = 'Buscar…', style, autoFocus, shortcut }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!WEB || !shortcut || typeof document === 'undefined') return;
    const onKey = e => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); ref.current?.focus(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 40, paddingLeft: 12, paddingRight: 6, borderRadius: radius.md, borderWidth: 1,
    borderColor: focused ? c.primary : c.line, backgroundColor: c.surface, ...(WEB ? { boxShadow: focused ? `0 0 0 3px ${c.focus}` : 'none', transition: 'box-shadow 150ms, border-color 150ms' } : {}) }, style]}>
    <Search size={16} color={c.faint} />
    <TextInput ref={ref} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.faint} autoFocus={autoFocus}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} accessibilityLabel={placeholder}
      style={[type.body, { flex: 1, minWidth: 0, color: c.text, height: 38, ...(WEB ? { outlineStyle: 'none' } : {}) }]} />
    {value ? <IconButton icon={X} label="Limpiar búsqueda" size={28} onPress={() => onChangeText('')} />
      : shortcut && WEB ? <View style={{ paddingHorizontal: 6, height: 20, borderRadius: 4, borderWidth: 1, borderColor: c.line, justifyContent: 'center', marginRight: 4 }}><Text style={[type.micro, { color: c.faint }]}>/</Text></View> : null}
  </View>;
}

export function Field({ label, hint, error, children, style }) {
  const { c } = useTheme();
  return <View style={[{ gap: 6 }, style]}>
    {label ? <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>{label}</Text> : null}
    {children}
    {error ? <Text style={[type.micro, { color: c.red }]}>{error}</Text> : hint ? <Text style={[type.micro, { color: c.faint }]}>{hint}</Text> : null}
  </View>;
}

export function Input({ style, multiline, error, ...props }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return <TextInput placeholderTextColor={c.faint} {...props} multiline={multiline}
    onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    style={[type.body, { minHeight: multiline ? 88 : 40, paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, borderRadius: radius.md, borderWidth: 1,
      borderColor: error ? c.red : focused ? c.primary : c.line, backgroundColor: c.surface, color: c.text, textAlignVertical: multiline ? 'top' : 'center',
      ...(WEB ? { outlineStyle: 'none', boxShadow: focused ? `0 0 0 3px ${error ? c.redSoft : c.focus}` : 'none', transition: 'box-shadow 150ms, border-color 150ms' } : {}) }, style]} />;
}

// Interruptor con perilla animada.
export function Switch({ value, onValueChange, label, disabled, showLabel = true }) {
  const { c } = useTheme();
  const v = useMotionValue(value ? 1 : 0);
  useEffect(() => { Animated.timing(v, { toValue: value ? 1 : 0, duration: reduceMotion() ? 0 : 180, easing: EASE_OUT, useNativeDriver: false }).start(); }, [value]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: !!value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: disabled ? 0.5 : 1, ...(WEB ? { cursor: 'pointer' } : {}) }}>
    <Animated.View style={{ width: 38, height: 22, borderRadius: 11, padding: 2, backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [c.softer || c.line, c.green] }) }}>
      <Animated.View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) }],
        ...(WEB ? { boxShadow: '0 1px 2px rgba(0,0,0,0.25)' } : {}) }} />
    </Animated.View>
    {label && showLabel ? <Text style={[type.small, { color: c.text }]}>{label}</Text> : null}
  </Pressable>;
}

// ── Vacíos y carga ─────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Info, title, description, action, compact }) {
  const { c } = useTheme();
  return <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: compact ? space.xl : space.x4, paddingHorizontal: space.xl, gap: space.sm }}>
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs }}><Icon size={20} color={c.muted} /></View>
    <Text style={[type.h3, { color: c.text, textAlign: 'center' }]}>{title}</Text>
    {description ? <Text style={[type.small, { color: c.muted, textAlign: 'center', maxWidth: 380 }]}>{description}</Text> : null}
    {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
  </View>;
}

export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }) {
  const { c } = useTheme();
  const v = useMotionValue(0.5);
  useEffect(() => { if (reduceMotion()) return; const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER }), Animated.timing(v, { toValue: 0.5, duration: 700, useNativeDriver: NATIVE_DRIVER })])); loop.start(); return () => loop.stop(); }, []);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: c.soft, opacity: v }, style]} />;
}

// ── Tabla de datos ─────────────────────────────────────────────────────────
// columns: [{ key, label, flex, width, align, render(row) }]
// Tabla de datos.
// columns: { key, label, flex|width, align, render(row), sortValue?(row), actions? }
// - Encabezados con sortValue se pueden ordenar (asc → desc → original).
// - Las columnas `actions` se atenúan y se encienden al pasar el cursor por la fila (en táctil siempre visibles).
// - Las filas nuevas entran con un desvanecido corto y escalonado; se muestran de `pageSize` en `pageSize`.
export function DataTable({ columns, rows, keyOf = r => r.id, onRowPress, empty, compact, footer, rowStyle, selectedKey, pageSize = 50, defaultSort }) {
  const { c } = useTheme();
  const [sort, setSort] = useState(defaultSort || null); // { key, dir: 1|-1 }
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = sort && columns.find(x => x.key === sort.key);
    if (!col?.sortValue) return rows;
    const val = r => { const v = col.sortValue(r); return typeof v === 'string' ? v.toLocaleLowerCase('es') : Number(v ?? -Infinity); };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, sort, columns]);
  const cycle = col => setSort(cur => !cur || cur.key !== col.key ? { key: col.key, dir: 1 } : cur.dir === 1 ? { key: col.key, dir: -1 } : null);
  const shown = sorted.slice(0, limit);
  const gapAfter = new Set(columns.filter((col, i) => col.align === 'right' && columns[i + 1] && columns[i + 1].align !== 'right' && !columns[i + 1].actions).map(col => col.key));
  const cellBox = col => ({ flex: col.width ? undefined : col.flex || 1, width: col.width, minWidth: 0, marginRight: gapAfter.has(col.key) ? space.xl : 0 });
  return <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surface }}>
    <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, height: 40, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line, gap: space.md }}>
      {columns.map(col => {
        const active = sort?.key === col.key;
        const label = <Text numberOfLines={1} style={[type.micro, { color: active ? c.text : c.muted, fontWeight: '600', letterSpacing: 0.2 }]}>{col.label}</Text>;
        if (!col.sortValue) return <View key={col.key} style={[cellBox(col), { alignItems: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }]}>{label}</View>;
        return <View key={col.key} style={[cellBox(col), { alignItems: col.align === 'right' ? 'flex-end' : 'flex-start' }]}>
          <Pressable onPress={() => cycle(col)} accessibilityRole="button" accessibilityLabel={`Ordenar por ${col.label}${active ? (sort.dir === 1 ? ', ascendente' : ', descendente') : ''}`}
            style={({ hovered }) => ({ flexDirection: col.align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 6, marginHorizontal: -6, borderRadius: radius.sm, backgroundColor: hovered ? c.soft : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) })}>
            {({ hovered }) => <>{label}<SortGlyph dir={active ? sort.dir : 0} visible={active || hovered} c={c} /></>}
          </Pressable>
        </View>;
      })}
    </View>
    {shown.length ? shown.map((row, i) => <TableRow key={keyOf(row, i)} row={row} index={i} columns={columns} onRowPress={onRowPress} compact={compact}
      selected={selectedKey != null && keyOf(row, i) === selectedKey} rowStyle={rowStyle} cellBox={cellBox} />) : empty}
    {sorted.length > limit ? <Pressable onPress={() => setLimit(l => l + pageSize)} accessibilityRole="button"
      style={({ hovered }) => ({ height: 44, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: hovered ? c.surfaceAlt : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) })}>
      <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>Mostrar {Math.min(pageSize, sorted.length - limit)} más <Text style={{ color: c.faint, fontWeight: '400' }}>· {shown.length} de {sorted.length}</Text></Text>
    </Pressable> : null}
    {footer}
  </View>;
}

function SortGlyph({ dir, visible, c }) {
  return <Text style={{ width: 10, fontSize: 10, lineHeight: 12, color: dir ? c.text : c.faint, opacity: visible ? 1 : 0, ...(WEB ? { transition: 'opacity 120ms' } : {}) }}>{dir === -1 ? '↓' : '↑'}</Text>;
}

function TableRow({ row, index, columns, onRowPress, compact, selected, rowStyle, cellBox }) {
  const { c } = useTheme();
  const [hovered, setHovered] = useState(false);
  const v = useMotionValue(reduceMotion() ? 1 : 0);
  useEffect(() => {
    if (reduceMotion()) return;
    Animated.timing(v, { toValue: 1, duration: 200, delay: Math.min(index, 10) * 18, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start();
  }, []);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
    <Pressable disabled={!onRowPress} onPress={() => onRowPress?.(row)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: compact ? 44 : 56, paddingVertical: compact ? 6 : 10,
        borderTopWidth: index ? 1 : 0, borderTopColor: c.line, backgroundColor: selected ? c.primarySoft : pressed ? c.soft : hovered ? c.surfaceAlt : 'transparent',
        ...(WEB ? { cursor: onRowPress ? 'pointer' : 'default', transition: 'background-color 120ms' } : {}) }, rowStyle?.(row)]}>
      {columns.map(col => <View key={col.key} style={[cellBox(col), { alignItems: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' },
        col.actions && WEB ? { opacity: hovered || selected ? 1 : 0.5, transition: 'opacity 140ms' } : null]}>
        {col.render ? col.render(row, { hovered }) : <Text numberOfLines={1} style={[type.body, { color: c.text }]}>{String(row[col.key] ?? '—')}</Text>}
      </View>)}
    </Pressable>
  </Animated.View>;
}

// Dos líneas: principal + secundaria.
export function Cell({ title, subtitle, leading, mono }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}>
    {leading}
    <View style={{ minWidth: 0, flexShrink: 1 }}>
      <Text numberOfLines={1} style={[type.body, mono ? type.num : null, { color: c.text, fontWeight: '600' }]}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={[type.micro, { color: c.faint, marginTop: 1 }]}>{subtitle}</Text> : null}
    </View>
  </View>;
}

export function Avatar({ name = '', size = 32, tone }) {
  const { c } = useTheme();
  const parts = String(name).trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  const [bg, fg] = tone ? toneColors(c, tone) : [c.soft, c.text];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: font.ui, fontSize: Math.round(size * 0.38), fontWeight: '600', color: fg }}>{initials}</Text>
  </View>;
}

// Métrica: etiqueta, cifra que cuenta y nota opcional.
export function Metric({ label, value, format, note, noteTone, size = 'md', style }) {
  const { c } = useTheme();
  const fs = size === 'lg' ? 40 : size === 'sm' ? 20 : 26;
  const noteColor = noteTone ? toneColors(c, noteTone)[1] : c.faint;
  return <View style={[{ gap: 4, minWidth: 0 }, style]}>
    <Text numberOfLines={1} style={[type.small, { color: c.muted }]}>{label}</Text>
    {typeof value === 'number' ? <AnimatedNumber value={value} format={format} numberOfLines={1} style={[type.figure, { fontSize: fs, lineHeight: fs * 1.15, color: c.text }]} />
      : <Text numberOfLines={1} style={[type.figure, { fontSize: fs, lineHeight: fs * 1.15, color: c.text }]}>{value}</Text>}
    {note ? <Text numberOfLines={1} style={[type.micro, { color: noteColor }]}>{note}</Text> : null}
  </View>;
}

// ── Avisos (toasts) ────────────────────────────────────────────────────────
const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastItem({ toast, onDone }) {
  const { c } = useTheme();
  const v = useMotionValue(0);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduceMotion() ? 0 : 220, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start();
    const t = setTimeout(() => Animated.timing(v, { toValue: 0, duration: reduceMotion() ? 0 : 180, useNativeDriver: NATIVE_DRIVER }).start(() => onDone(toast.id)), toast.duration || 3200);
    return () => clearTimeout(t);
  }, []);
  const Icon = toast.tone === 'red' ? AlertCircle : toast.tone === 'green' ? CheckCircle2 : Info;
  const [, fg] = toneColors(c, toast.tone || 'neutral');
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
    flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 260, maxWidth: 420, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
    backgroundColor: c.isDark ? c.softer : '#0E1726', ...(WEB ? { boxShadow: '0 8px 24px rgba(14,23,38,0.18)' } : {}) }}>
    <Icon size={18} color={toast.tone === 'red' ? '#FF8A85' : toast.tone === 'green' ? '#4ADE80' : '#F6B325'} />
    <Text style={[type.small, { color: '#F3F1EA', flex: 1 }]}>{toast.message}</Text>
    {toast.action ? <Pressable accessibilityRole="button" onPress={() => { toast.action.onPress(); Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: NATIVE_DRIVER }).start(() => onDone(toast.id)); }}
      style={({ hovered }) => ({ paddingHorizontal: 10, height: 30, justifyContent: 'center', borderRadius: radius.sm, backgroundColor: hovered ? 'rgba(255,255,255,0.12)' : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) })}>
      <Text style={[type.small, { color: '#F6B325', fontWeight: '700' }]}>{toast.action.label}</Text>
    </Pressable> : null}
  </Animated.View>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, tone = 'green', duration, action) => setToasts(list => [...list.slice(-2), { id: Date.now() + Math.random(), message, tone, duration: duration || (action ? 5000 : undefined), action }]), []);
  const value = useMemo(() => ({ show }), [show]);
  return <ToastContext.Provider value={value}>
    {children}
    <View pointerEvents="box-none" style={{ position: WEB ? 'fixed' : 'absolute', right: 20, bottom: 20, left: 20, alignItems: 'flex-end', gap: space.sm, zIndex: 9999 }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} onDone={id => setToasts(list => list.filter(x => x.id !== id))} />)}
    </View>
  </ToastContext.Provider>;
}

// ── Formato ────────────────────────────────────────────────────────────────
export const money = (n, opts = {}) => {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('es-EC', { minimumFractionDigits: opts.decimals ?? 2, maximumFractionDigits: opts.decimals ?? 2 });
};
export const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;

// "hace 5 min", "hace 2 h", "hace 3 d"
export const ago = value => {
  const t = new Date(String(value || '').replace(' ', 'T')).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};
