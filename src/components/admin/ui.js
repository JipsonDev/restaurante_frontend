// Kit de interfaz del panel de administración — estilo admin de comercio (tipo Shopify).
// Reglas: el contenido vive en tarjetas blancas sobre fondo gris; un solo botón principal (carbón) por zona;
// las acciones de tabla son secundarias; los estados son insignias con texto; el azul marca enlaces, foco y selección.
// Movimiento discreto: presión de botones, aparición corta, filas nuevas que destellan y avisos. Respeta "reducir movimiento".
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronLeft, ChevronRight, Info, Minus, MoreHorizontal, Search, X } from 'lucide-react-native';
import { useTheme } from '../../theme';

const WEB = Platform.OS === 'web';
const NATIVE_DRIVER = !WEB;
export const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

// Rejilla de 4 px.
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 };
export const radius = { sm: 6, md: 8, lg: 12, pill: 999 };
const SYSTEM = WEB ? '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif' : undefined;
export const font = { display: SYSTEM, ui: SYSTEM };
export const type = {
  title: { fontFamily: SYSTEM, fontSize: 20, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  h2: { fontFamily: SYSTEM, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  h3: { fontFamily: SYSTEM, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  body: { fontFamily: SYSTEM, fontSize: 13, lineHeight: 20 },
  small: { fontFamily: SYSTEM, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: SYSTEM, fontSize: 12, lineHeight: 16 },
  figure: { fontFamily: SYSTEM, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  num: { fontVariant: ['tabular-nums'] },
};
const inputBorder = c => (c.isDark ? '#5C5C5C' : '#8A8A8A');
// Biselado de tarjetas y botones al estilo admin (solo web; en nativo un borde fino).
const cardShadow = c => (WEB ? { boxShadow: c.isDark ? `0 0 0 1px ${c.line}` : '0 1px 0 0 rgba(26,26,26,0.07), inset 0 1px 0 0 rgba(204,204,204,0.5), inset 0 -1px 0 0 rgba(0,0,0,0.17), inset -1px 0 0 0 rgba(0,0,0,0.13), inset 1px 0 0 0 rgba(0,0,0,0.13)' } : { borderWidth: 1, borderColor: c.line });

// ── Movimiento ──────────────────────────────────────────────────────────────
// Las animaciones se muestran siempre (decisión del producto): no se desactivan aunque el sistema
// operativo tenga activado «reducir movimiento».
export const reduceMotion = () => false;
export function useMotionValue(initial = 0) { return useRef(new Animated.Value(initial)).current; }

// Aparición corta al montar o cuando cambia `trigger`.
export function FadeIn({ children, delay = 0, offset = 4, duration = 160, trigger, style }) {
  const v = useMotionValue(reduceMotion() ? 1 : 0);
  useEffect(() => {
    if (reduceMotion()) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start();
  }, [trigger]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] }]}>{children}</Animated.View>;
}

// Cifra que se actualiza con una transición corta.
export function AnimatedNumber({ value, format = v => String(Math.round(v)), duration = 400, style, ...props }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduceMotion() || typeof requestAnimationFrame === 'undefined') { setShown(target); from.current = target; return; }
    const start = from.current; const t0 = Date.now(); let raf;
    const tick = () => { const p = Math.min(1, (Date.now() - t0) / duration); setShown(start + (target - start) * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); else from.current = target; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <Text {...props} style={[type.num, style]}>{format(shown)}</Text>;
}

// ── Página ─────────────────────────────────────────────────────────────────
// Encabezado de página: título (con regreso opcional), descripción breve y acciones a la derecha.
export function PageHeader({ title, description, actions, meta, onBack, badge }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 700;
  return <View style={{ flexDirection: phone ? 'column' : 'row', alignItems: phone ? 'stretch' : 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.lg, paddingHorizontal: phone ? space.xs : 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1, minWidth: 0 }}>
      {onBack ? <IconButton icon={ChevronLeft} label="Volver" onPress={onBack} size={28} /> : null}
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { color: c.text }]}>{title}</Text>
          {badge || null}
        </View>
        {description ? <Text style={[type.body, { color: c.muted }]}>{description}</Text> : null}
        {meta ? <View style={{ marginTop: space.xs }}>{meta}</View> : null}
      </View>
    </View>
    {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, flexShrink: 0 }}>{actions}</View> : null}
  </View>;
}

// ── Tarjetas ───────────────────────────────────────────────────────────────
// Card: contenedor base. Con `title` dibuja su encabezado; `actions` va a la derecha del título.
export function Card({ children, style, padded = true, title, description, actions, footer, ...props }) {
  const { c } = useTheme();
  return <View {...props} style={[{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }, cardShadow(c), style]}>
    {title ? <CardHeader title={title} description={description} actions={actions} /> : null}
    {padded ? <View style={{ padding: space.lg, paddingTop: title ? 0 : space.lg }}>{children}</View> : children}
    {footer ? <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surfaceAlt }}>{footer}</View> : null}
  </View>;
}

export function CardHeader({ title, description, actions, style }) {
  const { c } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md }, style]}>
    <View style={{ flexShrink: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{title}</Text>
      {description ? <Text style={[type.body, { color: c.muted }]}>{description}</Text> : null}
    </View>
    {actions ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>{actions}</View> : null}
  </View>;
}

// Sección interna de una tarjeta, separada por una línea.
export function CardSection({ children, title, style, flush }) {
  const { c } = useTheme();
  return <View style={[{ borderTopWidth: 1, borderTopColor: c.line, padding: flush ? 0 : space.lg, gap: space.sm }, style]}>
    {title ? <Text style={[type.h3, { color: c.text }]}>{title}</Text> : null}
    {children}
  </View>;
}

export function Divider({ style }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}

// Título de bloque dentro de una tarjeta (compatibilidad con pantallas existentes).
export function SectionTitle({ title, description, action, style }) {
  const { c } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.md }, style]}>
    <View style={{ flexShrink: 1 }}>
      <Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{title}</Text>
      {description ? <Text style={[type.body, { color: c.muted }]}>{description}</Text> : null}
    </View>
    {action}
  </View>;
}

// ── Presión ────────────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Press({ children, style, onPress, disabled, scaleTo = 0.98, hoverStyle, pressedStyle, onHoverIn, onHoverOut, ...props }) {
  const scale = useMotionValue(1);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const to = v => { if (reduceMotion() || scaleTo === 1) return; Animated.timing(scale, { toValue: v, duration: 90, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start(); };
  const state = { hovered, pressed };
  return <AnimatedPressable {...props} disabled={disabled} onPress={onPress}
    onHoverIn={e => { setHovered(true); onHoverIn?.(e); }} onHoverOut={e => { setHovered(false); onHoverOut?.(e); }}
    onPressIn={() => { setPressed(true); to(scaleTo); }} onPressOut={() => { setPressed(false); to(1); }}
    style={[typeof style === 'function' ? style(state) : style, hovered && !disabled ? hoverStyle : null, pressed && !disabled ? pressedStyle : null,
      { transform: [{ scale }] }, WEB ? { cursor: disabled ? 'default' : 'pointer', transitionProperty: 'background-color, border-color, box-shadow, opacity, color', transitionDuration: '100ms' } : null]}>
    {typeof children === 'function' ? children(state) : children}
  </AnimatedPressable>;
}

// ── Botones ────────────────────────────────────────────────────────────────
// variant: primary (carbón) · secondary (blanco biselado) · tertiary/ghost (sin fondo) · plain (enlace azul) · danger (rojo) · ink (alias de primary)
const SIZES = { sm: { h: 28, px: 10, icon: 14, text: 12 }, md: { h: 32, px: 12, icon: 16, text: 13 }, lg: { h: 40, px: 16, icon: 18, text: 14 } };

export function Button({ children, icon: Icon, iconRight: IconRight, variant = 'secondary', size = 'md', loading, disabled, onPress, style, accessibilityLabel, full }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const s = SIZES[size] || SIZES.md;
  const kind = variant === 'ink' ? 'primary' : variant === 'ghost' ? 'tertiary' : variant;
  const v = {
    primary: { bg: c.primary, hover: c.primaryHover, press: c.primaryPressed, fg: c.onPrimary,
      shadow: c.isDark ? 'none' : 'inset 0 -1px 0 1px rgba(0,0,0,0.8), inset 0 0 0 1px #303030, inset 0 0.5px 0 1.5px rgba(255,255,255,0.25)' },
    secondary: { bg: c.surface, hover: c.surfaceAlt, press: c.soft, fg: c.text,
      shadow: c.isDark ? `inset 0 0 0 1px ${c.lineStrong}` : 'inset 0 -1px 0 0 #B5B5B5, inset 0 0 0 1px rgba(0,0,0,0.1), inset 0 0.5px 0 1.5px #FFFFFF' },
    tertiary: { bg: 'transparent', hover: c.soft, press: c.softer, fg: c.text, shadow: 'none' },
    plain: { bg: 'transparent', hover: 'transparent', press: 'transparent', fg: c.interactive, shadow: 'none' },
    danger: { bg: '#C70A24', hover: '#A30A1F', press: '#8E0B21', fg: '#FFFFFF',
      shadow: c.isDark ? 'none' : 'inset 0 -1px 0 1px rgba(0,0,0,0.6), inset 0 0.5px 0 1.5px rgba(255,255,255,0.25)' },
  }[kind] || {};
  const off = disabled || loading;
  const h = width < 700 && size !== 'sm' ? Math.max(s.h, 40) : s.h;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: off, busy: !!loading }} disabled={off} onPress={onPress}
    style={[{ height: h, minWidth: kind === 'plain' ? 0 : h, paddingHorizontal: kind === 'plain' ? 0 : s.px, borderRadius: radius.md, backgroundColor: v.bg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: off && !loading ? 0.45 : 1,
      ...(WEB ? { boxShadow: v.shadow } : kind === 'secondary' ? { borderWidth: 1, borderColor: c.lineStrong } : {}) },
      full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    hoverStyle={{ backgroundColor: v.hover }} pressedStyle={{ backgroundColor: v.press }}>
    {({ hovered }) => <>
      {loading ? <ActivityIndicator size="small" color={v.fg} /> : Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2} /> : null}
      {children ? (typeof children === 'string' || typeof children === 'number'
        ? <Text numberOfLines={1} style={{ fontFamily: SYSTEM, fontSize: s.text, fontWeight: '600', color: v.fg, textDecorationLine: kind === 'plain' && hovered ? 'underline' : 'none' }}>{children}</Text>
        : children) : null}
      {IconRight && !loading ? <IconRight size={s.icon} color={v.fg} strokeWidth={2} /> : null}
    </>}
  </Press>;
}

export function IconButton({ icon: Icon, label, onPress, tone = 'default', size = 32, active, badge, disabled, onInk }) {
  const { c } = useTheme();
  const [hot, setHot] = useState(false);
  const base = onInk ? c.onInk : c.muted;
  const fg = tone === 'danger' ? (hot && !disabled ? c.red : base) : active || hot ? (onInk ? '#FFFFFF' : c.text) : base;
  return <Press onHoverIn={() => setHot(true)} onHoverOut={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} disabled={disabled} onPress={onPress}
    {...(WEB ? { title: label } : {})} scaleTo={0.94}
    style={{ width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? (onInk ? 'rgba(255,255,255,0.12)' : c.softer) : 'transparent', opacity: disabled ? 0.4 : 1 }}
    hoverStyle={{ backgroundColor: onInk ? 'rgba(255,255,255,0.12)' : tone === 'danger' ? c.redSoft : c.soft }}>
    <Icon size={Math.round(size * 0.5)} color={fg} strokeWidth={2} />
    {badge ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#E51C00', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: SYSTEM }}>{badge > 99 ? '99+' : badge}</Text>
    </View> : null}
  </Press>;
}

// Menú de acciones (⋯): lista flotante junto al botón que la abre.
export function ActionMenu({ actions = [], label = 'Más acciones', icon = MoreHorizontal, trigger }) {
  const { c } = useTheme();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const { width: vw } = useWindowDimensions();
  const open = () => ref.current?.measureInWindow?.((x, y, w, h) => setPos({ x, y, w, h }));
  const items = actions.filter(Boolean);
  return <>
    <View ref={ref} collapsable={false}>{trigger ? trigger(open) : <IconButton icon={icon} label={label} onPress={open} />}</View>
    <Modal visible={!!pos} transparent animationType="none" onRequestClose={() => setPos(null)}>
      <Pressable style={{ flex: 1 }} onPress={() => setPos(null)} accessibilityLabel="Cerrar menú" />
      {pos ? <FadeIn duration={120} offset={-4} style={{ position: 'absolute', top: pos.y + pos.h + 4, left: Math.max(8, Math.min(pos.x + pos.w - 220, vw - 228)), width: 220 }}>
        <View accessibilityRole="menu" style={[{ backgroundColor: c.surface, borderRadius: radius.lg, padding: 6, ...(WEB ? { boxShadow: '0 8px 24px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)' } : { borderWidth: 1, borderColor: c.line }) }]}>
          {items.map((a, i) => a.divider ? <View key={`d${i}`} style={{ height: 1, backgroundColor: c.line, marginVertical: 4 }} />
            : <Press key={a.label} accessibilityRole="menuitem" disabled={a.disabled} scaleTo={1} onPress={() => { setPos(null); a.onPress?.(); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 32, paddingHorizontal: 8, borderRadius: radius.md, opacity: a.disabled ? 0.45 : 1 }}
              hoverStyle={{ backgroundColor: a.tone === 'danger' ? c.redSoft : c.soft }}>
              {a.icon ? <a.icon size={16} color={a.tone === 'danger' ? c.red : c.muted} /> : null}
              <Text numberOfLines={1} style={[type.body, { color: a.tone === 'danger' ? c.red : c.text, flex: 1 }]}>{a.label}</Text>
            </Press>)}
        </View>
      </FadeIn> : null}
    </Modal>
  </>;
}

// ── Insignias y estados ────────────────────────────────────────────────────
export function toneColors(c, tone) {
  return {
    neutral: [c.softer, c.isDark ? c.text : c.muted, c.faint], green: [c.greenSoft, c.green, c.greenBright], amber: [c.amberSoft, c.amber, c.amberBright],
    red: [c.redSoft, c.red, c.redBright], sky: [c.skySoft, c.sky, c.skyBright], purple: [c.purpleSoft, c.purple, c.purple],
    gold: [c.amberSoft, c.amber, c.amberBright], pink: [c.pinkSoft, c.pink, c.pink], info: [c.skySoft, c.sky, c.skyBright],
    success: [c.greenSoft, c.green, c.greenBright], warning: [c.amberSoft, c.amber, c.amberBright], attention: [c.amberSoft, c.amber, c.amberBright], critical: [c.redSoft, c.red, c.redBright],
  }[tone] || [c.softer, c.muted, c.faint];
}

// Insignia: fondo suave del tono y texto oscuro del mismo tono. `progress` añade el círculo de avance.
export function Badge({ tone = 'neutral', children, progress, size = 'md' }) {
  const { c } = useTheme();
  const [bg, fg, solid] = toneColors(c, tone);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: size === 'sm' ? 18 : 20, paddingLeft: progress ? 4 : 8, paddingRight: 8, borderRadius: radius.md, backgroundColor: bg }}>
    {progress ? <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: fg, overflow: 'hidden', backgroundColor: progress === 'complete' ? fg : 'transparent' }}>
      {progress === 'partial' ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3.5, backgroundColor: fg }} /> : null}
    </View> : null}
    <Text numberOfLines={1} style={{ fontFamily: SYSTEM, fontSize: 12, lineHeight: 16, fontWeight: '500', color: fg }}>{children}</Text>
  </View>;
}

// Estado (compatibilidad): ahora es una insignia. `pulse` se ignora: el admin no parpadea.
export function Status({ tone = 'neutral', children }) {
  return <Badge tone={tone}>{children}</Badge>;
}
export function Tag({ children, tone = 'neutral' }) { return <Badge tone={tone}>{children}</Badge>; }

// Aviso en línea (banner). tone: info | success | warning | critical.
export function Banner({ tone = 'info', title, children, action, onDismiss, style }) {
  const { c } = useTheme();
  const [, fg] = toneColors(c, tone);
  const soft = c.isDark ? { info: 'rgba(44,110,203,0.14)', success: 'rgba(41,132,90,0.16)', warning: 'rgba(232,164,0,0.12)', critical: 'rgba(229,28,0,0.14)' }
    : { info: '#EAF4FF', success: '#EAFAF0', warning: '#FFF8DB', critical: '#FFF1F0' };
  const edge = c.isDark ? c.line : { info: '#C4E2FF', success: '#B4FED2', warning: '#F0DB8B', critical: '#FFC6BD' }[tone];
  const bg = soft[tone] || soft.info;
  const Icon = tone === 'critical' ? AlertCircle : tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return <View accessibilityRole={tone === 'critical' ? 'alert' : undefined} style={[{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', padding: space.md, borderRadius: radius.lg, backgroundColor: bg, borderWidth: 1, borderColor: edge }, style]}>
    <Icon size={18} color={fg} style={{ marginTop: 1 }} />
    <View style={{ flex: 1, gap: 2 }}>
      {title ? <Text style={[type.h3, { color: c.text }]}>{title}</Text> : null}
      {children ? (typeof children === 'string' ? <Text style={[type.body, { color: c.text }]}>{children}</Text> : children) : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
    {onDismiss ? <IconButton icon={X} label="Cerrar aviso" size={24} onPress={onDismiss} /> : null}
  </View>;
}

// ── Selectores ─────────────────────────────────────────────────────────────
// Grupo de pastillas: la opción activa tiene fondo gris; el indicador se desliza entre opciones.
function PillGroup({ options, value, onChange, accessibilityLabel, style, scroll }) {
  const { c } = useTheme();
  const layouts = useRef({});
  const x = useMotionValue(0); const w = useMotionValue(0);
  const [ready, setReady] = useState(false);
  const move = useCallback((key, instant) => {
    const l = layouts.current[key]; if (!l) return;
    if (instant || reduceMotion()) { x.setValue(l.x); w.setValue(l.width); return; }
    Animated.parallel([Animated.timing(x, { toValue: l.x, duration: 160, easing: EASE_OUT, useNativeDriver: false }), Animated.timing(w, { toValue: l.width, duration: 160, easing: EASE_OUT, useNativeDriver: false })]).start();
  }, []);
  useEffect(() => { move(value); }, [value]);
  const row = <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', gap: 2 }}>
    {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: x, width: w, borderRadius: radius.md, backgroundColor: c.softer }} /> : null}
    {options.map(opt => {
      const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      const selected = o.value === value;
      return <Pressable key={String(o.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
        onLayout={e => { layouts.current[o.value] = e.nativeEvent.layout; if (o.value === value) { move(o.value, true); setReady(true); } }}
        style={({ hovered }) => ({ height: 28, paddingHorizontal: 10, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: hovered && !selected ? c.soft : 'transparent', ...(WEB ? { cursor: 'pointer', transition: 'background-color 100ms' } : {}) })}>
        {o.icon ? <o.icon size={14} color={selected ? c.text : c.muted} /> : null}
        <Text numberOfLines={1} style={[type.body, { color: selected ? c.text : c.muted, fontWeight: '600' }]}>{o.label}</Text>
        {o.count != null ? <Text style={[type.small, type.num, { color: c.faint, fontWeight: '500' }]}>{o.count}</Text> : null}
      </Pressable>;
    })}
  </View>;
  return <View style={[{ alignSelf: 'flex-start', maxWidth: '100%' }, style]}>{scroll ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>{row}</ScrollView> : row}</View>;
}

export function Segmented({ options, value, onChange, accessibilityLabel, style }) {
  return <PillGroup options={options} value={value} onChange={onChange} accessibilityLabel={accessibilityLabel} style={style} scroll />;
}
export function Tabs({ options, value, onChange, style }) {
  const { c } = useTheme();
  const layouts = useRef({}); const x = useMotionValue(0); const w = useMotionValue(0); const [ready, setReady] = useState(false);
  const move = (key, instant) => { const l = layouts.current[key]; if (!l) return; if (instant || reduceMotion()) { x.setValue(l.x); w.setValue(l.width); return; }
    Animated.parallel([Animated.timing(x, { toValue: l.x, duration: 160, easing: EASE_OUT, useNativeDriver: false }), Animated.timing(w, { toValue: l.width, duration: 160, easing: EASE_OUT, useNativeDriver: false })]).start(); };
  useEffect(() => { move(value); }, [value]);
  return <View style={[{ alignSelf: 'stretch', maxWidth: '100%' }, style]}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4 }}>
        {options.map(opt => { const o = typeof opt === 'string' ? { value: opt, label: opt } : opt; const selected = o.value === value;
          return <Pressable key={String(o.value)} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
            onLayout={e => { layouts.current[o.value] = e.nativeEvent.layout; if (selected) { move(o.value, true); setReady(true); } }}
            style={({ hovered }) => ({ height: 36, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md,
              backgroundColor: hovered && !selected ? c.soft : 'transparent', ...(WEB ? { cursor: 'pointer', transition: 'background-color 100ms' } : {}) })}>
            <Text numberOfLines={1} style={[type.body, { color: selected ? c.text : c.muted, fontWeight: '600' }]}>{o.label}</Text>
            {o.count != null ? <Text style={[type.small, type.num, { color: c.faint, fontWeight: '500' }]}>{o.count}</Text> : null}
          </Pressable>; })}
        {ready ? <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, height: 2, left: x, width: w, backgroundColor: c.text, borderRadius: 1 }} /> : null}
      </View>
    </ScrollView>
  </View>;
}

// ── Campos ─────────────────────────────────────────────────────────────────
const fieldBox = (c, focused, error) => ({
  borderRadius: radius.md, borderWidth: 1, borderColor: error ? c.redBright : focused ? c.text : inputBorder(c), backgroundColor: c.isDark ? '#242424' : '#FDFDFD',
  ...(WEB ? { boxShadow: focused ? `0 0 0 2px ${c.surface}, 0 0 0 4px ${c.focus}` : 'none', transition: 'box-shadow 100ms, border-color 100ms' } : {}),
});

export function SearchField({ value, onChangeText, placeholder = 'Buscar…', style, autoFocus, shortcut }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!WEB || !shortcut || typeof document === 'undefined') return;
    const onKey = e => { if (e.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); ref.current?.focus(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingLeft: 10, paddingRight: 4 }, fieldBox(c, focused), style]}>
    <Search size={16} color={c.muted} />
    <TextInput ref={ref} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.faint} autoFocus={autoFocus}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} accessibilityLabel={placeholder}
      style={[type.body, { flex: 1, minWidth: 0, color: c.text, height: 30, ...(WEB ? { outlineStyle: 'none' } : {}) }]} />
    {value ? <IconButton icon={X} label="Limpiar búsqueda" size={24} onPress={() => onChangeText('')} /> : null}
  </View>;
}

export function Field({ label, hint, error, children, style }) {
  const { c } = useTheme();
  return <View style={[{ gap: 4 }, style]}>
    {label ? <Text style={[type.body, { color: c.text }]}>{label}</Text> : null}
    {children}
    {error ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><AlertCircle size={14} color={c.red} /><Text style={[type.body, { color: c.red }]}>{error}</Text></View>
      : hint ? <Text style={[type.body, { color: c.muted }]}>{hint}</Text> : null}
  </View>;
}

export function Input({ style, multiline, error, ...props }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return <TextInput placeholderTextColor={c.faint} {...props} multiline={multiline}
    onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
    style={[type.body, { minHeight: multiline ? 80 : 32, paddingHorizontal: 10, paddingVertical: multiline ? 8 : 0, color: c.text, textAlignVertical: multiline ? 'top' : 'center', ...(WEB ? { outlineStyle: 'none' } : {}) }, fieldBox(c, focused, error), style]} />;
}

export function Checkbox({ checked, indeterminate, onChange, label, disabled }) {
  const { c } = useTheme();
  const on = checked || indeterminate;
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: indeterminate ? 'mixed' : !!checked, disabled }} disabled={disabled}
    onPress={() => onChange?.(!checked)} hitSlop={8}
    style={({ hovered }) => ({ width: 16, height: 16, borderRadius: 4, borderWidth: on ? 0 : 1, borderColor: hovered ? c.text : inputBorder(c), backgroundColor: on ? c.primary : c.surface,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1, ...(WEB ? { cursor: 'pointer' } : {}) })}>
    {indeterminate ? <Minus size={12} color={c.onPrimary} strokeWidth={3} /> : checked ? <Check size={12} color={c.onPrimary} strokeWidth={3} /> : null}
  </Pressable>;
}

// Interruptor.
export function Switch({ value, onValueChange, label, disabled, showLabel = true }) {
  const { c } = useTheme();
  const v = useMotionValue(value ? 1 : 0);
  useEffect(() => { Animated.timing(v, { toValue: value ? 1 : 0, duration: reduceMotion() ? 0 : 140, easing: EASE_OUT, useNativeDriver: false }).start(); }, [value]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: !!value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: disabled ? 0.45 : 1, ...(WEB ? { cursor: 'pointer' } : {}) }}>
    <Animated.View style={{ width: 32, height: 18, borderRadius: 9, padding: 2, backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [c.isDark ? '#5C5C5C' : '#B5B5B5', c.primary] }) }}>
      <Animated.View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.isDark && value ? '#1A1A1A' : '#FFFFFF', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) }] }} />
    </Animated.View>
    {label && showLabel ? <Text style={[type.body, { color: c.text }]}>{label}</Text> : null}
  </Pressable>;
}

// ── Vacíos y carga ─────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Info, title, description, action, compact }) {
  const { c } = useTheme();
  return <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: compact ? space.xl : space.x4 + 8, paddingHorizontal: space.xl, gap: space.xs }}>
    <Icon size={28} color={c.faint} strokeWidth={1.5} style={{ marginBottom: space.sm }} />
    <Text style={[type.h2, { color: c.text, textAlign: 'center' }]}>{title}</Text>
    {description ? <Text style={[type.body, { color: c.muted, textAlign: 'center', maxWidth: 400 }]}>{description}</Text> : null}
    {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
  </View>;
}

export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }) {
  const { c } = useTheme();
  const v = useMotionValue(0.6);
  useEffect(() => { if (reduceMotion()) return; const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: NATIVE_DRIVER }), Animated.timing(v, { toValue: 0.6, duration: 800, useNativeDriver: NATIVE_DRIVER })])); loop.start(); return () => loop.stop(); }, []);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: c.soft, opacity: v }, style]} />;
}

// ── Tabla de índice ────────────────────────────────────────────────────────
// columns: { key, label, flex|width, align, render(row, {hovered}), sortValue?(row), actions? }
// toolbar: lo que va dentro de la tarjeta sobre el encabezado (pestañas, búsqueda, filtros).
// selectable + bulkActions: casillas por fila; al marcar, el encabezado se convierte en barra de acciones en lote.
// Las filas que aparecen después de la primera carga destellan brevemente en azul.
export function DataTable({ columns, rows, keyOf = r => r.id, onRowPress, empty, compact, footer, rowStyle, selectedKey, pageSize = 50, defaultSort, toolbar, selectable, bulkActions = [], bare, style }) {
  const { c } = useTheme();
  const [sort, setSort] = useState(defaultSort || null);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(() => new Set());
  const mounted = useRef(false);
  useEffect(() => { const t = setTimeout(() => { mounted.current = true; }, 600); return () => clearTimeout(t); }, []);
  const sorted = useMemo(() => {
    const col = sort && columns.find(x => x.key === sort.key);
    if (!col?.sortValue) return rows;
    const val = r => { const v = col.sortValue(r); return typeof v === 'string' ? v.toLocaleLowerCase('es') : Number(v ?? -Infinity); };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page > pages - 1) setPage(pages - 1); }, [pages]);
  const shown = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const keys = shown.map((r, i) => keyOf(r, i));
  const pickedRows = sorted.filter((r, i) => picked.has(keyOf(r, i)));
  useEffect(() => { // descarta selecciones de filas que ya no existen
    const live = new Set(sorted.map((r, i) => keyOf(r, i)));
    if ([...picked].some(k => !live.has(k))) setPicked(p => new Set([...p].filter(k => live.has(k))));
  }, [sorted]);
  const allOn = keys.length > 0 && keys.every(k => picked.has(k));
  const someOn = keys.some(k => picked.has(k));
  const toggleAll = () => setPicked(p => { const n = new Set(p); if (allOn) keys.forEach(k => n.delete(k)); else keys.forEach(k => n.add(k)); return n; });
  const toggle = k => setPicked(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const cycle = col => setSort(cur => !cur || cur.key !== col.key ? { key: col.key, dir: 1 } : cur.dir === 1 ? { key: col.key, dir: -1 } : null);
  const gapAfter = new Set(columns.filter((col, i) => col.align === 'right' && columns[i + 1] && columns[i + 1].align !== 'right' && !columns[i + 1].actions).map(col => col.key));
  const cellBox = col => ({ flex: col.width ? undefined : col.flex || 1, width: col.width, minWidth: 0, marginRight: gapAfter.has(col.key) ? space.lg : 0 });
  const align = col => (col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'stretch');

  const header = selectable && someOn
    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, height: 40, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Checkbox checked={allOn} indeterminate={!allOn} onChange={toggleAll} label="Seleccionar todo" />
        <Text style={[type.h3, { color: c.text }]}>{pickedRows.length} {pickedRows.length === 1 ? 'seleccionado' : 'seleccionados'}</Text>
        <View style={{ flex: 1 }} />
        {bulkActions.map(a => <Button key={a.label} size="sm" variant={a.tone === 'danger' ? 'secondary' : 'secondary'} onPress={() => { a.onPress(pickedRows); if (a.clear !== false) setPicked(new Set()); }}>
          {a.tone === 'danger' ? <Text style={{ fontFamily: SYSTEM, fontSize: 12, fontWeight: '600', color: c.red }}>{a.label}</Text> : a.label}
        </Button>)}
      </View>
    : <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, height: 36, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line, gap: space.md }}>
        {selectable ? <Checkbox checked={false} onChange={toggleAll} label="Seleccionar todo" disabled={!keys.length} /> : null}
        {columns.map(col => {
          const active = sort?.key === col.key;
          const label = <Text numberOfLines={1} style={{ fontFamily: SYSTEM, fontSize: 12, fontWeight: '600', color: active ? c.text : c.muted }}>{col.label}</Text>;
          if (!col.sortValue) return <View key={col.key} style={[cellBox(col), { alignItems: align(col) }]}>{label}</View>;
          return <View key={col.key} style={[cellBox(col), { alignItems: align(col) }]}>
            <Pressable onPress={() => cycle(col)} accessibilityRole="button" accessibilityLabel={`Ordenar por ${col.label}${active ? (sort.dir === 1 ? ', ascendente' : ', descendente') : ''}`}
              style={({ hovered }) => ({ flexDirection: col.align === 'right' ? 'row-reverse' : 'row', alignItems: 'center', gap: 2, height: 24, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: radius.sm, backgroundColor: hovered ? c.soft : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) })}>
              {({ hovered }) => <>{label}<Text style={{ fontSize: 11, color: active ? c.text : c.faint, opacity: active || hovered ? 1 : 0 }}>{active && sort.dir === -1 ? '↓' : '↑'}</Text></>}
            </Pressable>
          </View>;
        })}
      </View>;

  const body = <>
    {toolbar ? <View style={{ borderBottomWidth: 1, borderBottomColor: c.line }}>{toolbar}</View> : null}
    {shown.length ? header : null}
    {shown.length ? shown.map((row, i) => { const k = keyOf(row, i); return <TableRow key={k} row={row} index={i} columns={columns} onRowPress={onRowPress} compact={compact}
      selected={(selectedKey != null && k === selectedKey) || picked.has(k)} rowStyle={rowStyle} cellBox={cellBox} align={align} flash={mounted.current}
      check={selectable ? <Checkbox checked={picked.has(k)} onChange={() => toggle(k)} label="Seleccionar fila" /> : null} />; }) : empty}
    {pages > 1 ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surfaceAlt }}>
      <IconButton icon={ChevronLeft} label="Página anterior" size={28} disabled={page === 0} onPress={() => setPage(p => p - 1)} />
      <Text style={[type.body, type.num, { color: c.muted }]}>{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} de {sorted.length}</Text>
      <IconButton icon={ChevronRight} label="Página siguiente" size={28} disabled={page >= pages - 1} onPress={() => setPage(p => p + 1)} />
    </View> : null}
    {footer}
  </>;
  if (bare) return <View style={style}>{body}</View>;
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }, cardShadow(c), style]}>{body}</View>;
}

function TableRow({ row, index, columns, onRowPress, compact, selected, rowStyle, cellBox, align, flash, check }) {
  const { c } = useTheme();
  const [hovered, setHovered] = useState(false);
  const glow = useMotionValue(0);
  useEffect(() => { // fila nueva → destello azul que se apaga
    if (!flash || reduceMotion()) return;
    glow.setValue(1);
    Animated.timing(glow, { toValue: 0, duration: 1400, delay: 200, easing: EASE_OUT, useNativeDriver: false }).start();
  }, []);
  const base = selected ? c.interactiveSoft : hovered ? c.surfaceAlt : c.surface;
  return <Animated.View style={{ backgroundColor: glow.interpolate({ inputRange: [0, 1], outputRange: [base, c.interactiveSoft] }), borderTopWidth: index ? 1 : 0, borderTopColor: c.line }}>
    {(() => {
      const cells = <>{check}{columns.map(col => <View key={col.key} style={[cellBox(col), { alignItems: align(col) }]}>
        {col.render ? col.render(row, { hovered }) : <Text numberOfLines={1} style={[type.body, { color: c.text }]}>{String(row[col.key] ?? '—')}</Text>}
      </View>)}</>;
      const box = { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: compact ? 40 : 48, paddingVertical: compact ? 6 : 8 };
      // Sin acción de fila: un View simple (así los botones de la fila no quedan dentro de un control deshabilitado).
      if (!onRowPress) return <View onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={[box, rowStyle?.(row)]}>{cells}</View>;
      return <Pressable onPress={() => onRowPress(row)} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [box, { backgroundColor: pressed ? c.soft : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) }, rowStyle?.(row)]}>{cells}</Pressable>;
    })()}
  </Animated.View>;
}

// Dos líneas: principal + secundaria.
export function Cell({ title, subtitle, leading, mono }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 }}>
    {leading}
    <View style={{ minWidth: 0, flexShrink: 1 }}>
      <Text numberOfLines={1} style={[type.body, mono ? type.num : null, { color: c.text, fontWeight: '600' }]}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{subtitle}</Text> : null}
    </View>
  </View>;
}

// Avatar cuadrado redondeado, neutro.
export function Avatar({ name = '', size = 32 }) {
  const { c } = useTheme();
  const parts = String(name).trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
  return <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.25), backgroundColor: c.isDark ? '#424242' : '#E3E3E3', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: SYSTEM, fontSize: Math.round(size * 0.4), fontWeight: '600', color: c.text }}>{initials}</Text>
  </View>;
}

// Métrica: etiqueta, cifra y nota opcional.
export function Metric({ label, value, format, note, noteTone, size = 'md', style }) {
  const { c } = useTheme();
  const fs = size === 'lg' ? 28 : size === 'sm' ? 16 : 20;
  const noteColor = noteTone ? toneColors(c, noteTone)[1] : c.muted;
  return <View style={[{ gap: 2, minWidth: 0 }, style]}>
    <Text numberOfLines={1} style={[type.body, { color: c.muted }]}>{label}</Text>
    {typeof value === 'number' ? <AnimatedNumber value={value} format={format} numberOfLines={1} style={[type.figure, { fontSize: fs, lineHeight: Math.round(fs * 1.3), color: c.text }]} />
      : <Text numberOfLines={1} style={[type.figure, { fontSize: fs, lineHeight: Math.round(fs * 1.3), color: c.text }]}>{value}</Text>}
    {note ? <Text numberOfLines={1} style={[type.small, { color: noteColor }]}>{note}</Text> : null}
  </View>;
}

// ── Avisos (toasts) ────────────────────────────────────────────────────────
const ToastContext = createContext({ show: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastItem({ toast, onDone }) {
  const v = useMotionValue(0);
  const close = () => Animated.timing(v, { toValue: 0, duration: reduceMotion() ? 0 : 140, useNativeDriver: NATIVE_DRIVER }).start(() => onDone(toast.id));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: reduceMotion() ? 0 : 180, easing: EASE_OUT, useNativeDriver: NATIVE_DRIVER }).start();
    const t = setTimeout(close, toast.duration || 3500);
    return () => clearTimeout(t);
  }, []);
  const error = toast.tone === 'red';
  return <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    flexDirection: 'row', alignItems: 'center', gap: space.md, maxWidth: 480, paddingVertical: 10, paddingLeft: 16, paddingRight: 8, borderRadius: radius.lg,
    backgroundColor: error ? '#C70A24' : '#303030', ...(WEB ? { boxShadow: '0 8px 20px rgba(0,0,0,0.25)' } : {}) }}>
    <Text style={[type.body, { color: '#FFFFFF', fontWeight: '500', flexShrink: 1 }]}>{toast.message}</Text>
    {toast.action ? <Pressable accessibilityRole="button" onPress={() => { toast.action.onPress(); close(); }}
      style={({ hovered }) => ({ paddingHorizontal: 8, height: 28, justifyContent: 'center', borderRadius: radius.md, backgroundColor: hovered ? 'rgba(255,255,255,0.14)' : 'transparent', ...(WEB ? { cursor: 'pointer' } : {}) })}>
      <Text style={[type.body, { color: '#FFFFFF', fontWeight: '700', textDecorationLine: 'underline' }]}>{toast.action.label}</Text>
    </Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={close} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', ...(WEB ? { cursor: 'pointer' } : {}) }}>
      <X size={16} color="#FFFFFF" />
    </Pressable>
  </Animated.View>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, tone = 'green', duration, action) => setToasts(list => [...list.slice(-2), { id: Date.now() + Math.random(), message, tone, duration: duration || (action ? 5000 : undefined), action }]), []);
  const value = useMemo(() => ({ show }), [show]);
  return <ToastContext.Provider value={value}>
    {children}
    <View pointerEvents="box-none" style={{ position: WEB ? 'fixed' : 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center', gap: space.sm, zIndex: 9999 }}>
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
export const ago = value => {
  const t = new Date(String(value || '').replace(' ', 'T')).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
};
