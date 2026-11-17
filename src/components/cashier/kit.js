// Kit visual de Caja — «Comprobante»: papel blanco, tinta negra y numeración en rojo.
// Cada cuenta se lee como el comprobante que va a emitirse. Cifras siempre tabulares.
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Delete, X } from 'lucide-react-native';
import { Press, haptic, EASE } from '../waiter/comanda';

export const WEB = Platform.OS === 'web';
export { haptic };
const ND = !WEB;

export const FONT = WEB ? '"Archivo", "Segoe UI", system-ui, -apple-system, sans-serif' : undefined;
let fontsInjected = false;
export function useCajaFonts() {
  useEffect(() => {
    if (!WEB || fontsInjected || typeof document === 'undefined') return;
    fontsInjected = true;
    // Archivo va dentro de la app (public/fonts, licencia OFL): sin internet la caja se ve igual.
    // Selección, cursor y barras de desplazamiento con la paleta de caja.
    const style = document.createElement('style');
    style.textContent = `@font-face{font-family:"Archivo";src:url("/fonts/Archivo-latin.woff") format("woff");font-weight:100 900;font-stretch:62% 125%;font-style:normal;font-display:swap}
[data-caja] ::selection{background:#2457C533}[data-caja] input,[data-caja] textarea{caret-color:#2457C5}
[data-caja] input:focus-visible,[data-caja] textarea:focus-visible{outline:2px solid #2457C5 !important;outline-offset:2px}
[data-caja] [tabindex]:focus-visible{outline:2px solid #2457C5 !important;outline-offset:2px}
[data-caja] *{scrollbar-width:thin;scrollbar-color:#CDD0D5 transparent}[data-caja-dark] *{scrollbar-color:#3A3D43 transparent}`;
    document.head.appendChild(style);
  }, []);
}

export const tokens = {
  light: {
    isDark: false,
    ground: '#ECEDEF', paper: '#FFFFFF', paperAlt: '#F6F7F8', hover: '#F1F2F4',
    ink: '#16171A', onInk: '#FFFFFF', inkMuted: '#A9ADB4', inkLine: '#2C2E33',
    text: '#16171A', muted: '#565A61', faint: '#6B6F77',
    line: '#E3E4E8', rule: '#CDD0D5',
    serial: '#D63B20', serialZero: '#E3B2A7', serialSoft: '#FCEDE9',
    green: '#15703F', greenSoft: '#E5F3EA', amber: '#8F5300', amberSoft: '#FCEFD9',
    red: '#B3261E', redSoft: '#FBE9E7', blue: '#2457C5', blueSoft: '#E8EEFB', focus: 'rgba(36,87,197,0.28)',
    overlay: 'rgba(16,17,20,0.48)',
  },
  dark: {
    isDark: true,
    ground: '#0C0D0F', paper: '#16171A', paperAlt: '#1C1D21', hover: '#22242A',
    ink: '#08090A', onInk: '#F1F1EF', inkMuted: '#8D9097', inkLine: '#24262B',
    text: '#F1F1EF', muted: '#B0B3B9', faint: '#979AA1',
    line: '#2A2C31', rule: '#3A3D43',
    serial: '#FF7A5C', serialZero: '#6B3A30', serialSoft: '#2C1A16',
    green: '#62C48F', greenSoft: '#14271C', amber: '#EBB04A', amberSoft: '#2B2112',
    red: '#FF8A80', redSoft: '#2E1715', blue: '#8DB0FF', blueSoft: '#17213A', focus: 'rgba(141,176,255,0.30)',
    overlay: 'rgba(0,0,0,0.62)',
  },
};

// Pantalla táctil: objetivos de 44 px como mínimo (con ratón se permite algo más compacto).
export const TOUCH = !WEB || (typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
export const tap = (mouse) => TOUCH ? Math.max(44, mouse) : mouse;
export const sp = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const r = { sm: 4, md: 6, lg: 8 };
export const money = n => `$${Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const toNum = v => Number(String(v ?? '').replace(',', '.'));

// ── Texto ─────────────────────────────────────────────────────────────────
export function T({ c, size = 14, weight = '400', color, style, ...props }) {
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.4), fontWeight: weight, color: color || c.text }, style]} />;
}
export function Num({ c, size = 14, weight = '600', color, style, ...props }) {
  return <Text {...props} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: weight, color: color || c.text, fontVariant: ['tabular-nums'], letterSpacing: size >= 28 ? -0.6 : 0 }, style]} />;
}
// Etiqueta de celda (la línea pequeña sobre cada dato de un comprobante).
export function Lbl({ c, children, style, color }) {
  return <Text style={[{ fontFamily: FONT, fontSize: 12, lineHeight: 16, fontWeight: '500', color: color || c.faint }, style]}>{children}</Text>;
}

// ── Número de comprobante: ceros tenues, dígitos en rojo ─────────────────────
export function Serial({ c, value, size = 15, weight = '700', style, muted }) {
  if (!value) return <Num c={c} size={size} color={c.faint} style={style}>Sin número</Num>;
  const s = String(value);
  const m = s.match(/^(.*?)(\d+)$/);
  const prefix = m ? m[1] : '';
  const digits = m ? m[2] : s;
  const lead = digits.match(/^0*/)[0];
  const rest = digits.slice(lead.length) || '0';
  const ink = muted ? c.muted : c.serial;
  return <Text accessibilityLabel={`Comprobante ${prefix}${Number(rest)}`} style={[{ fontFamily: FONT, fontSize: size, lineHeight: Math.round(size * 1.25), fontWeight: weight, fontVariant: ['tabular-nums'], letterSpacing: 0.4 }, style]}>
    <Text style={{ color: c.muted, fontWeight: '600' }}>{prefix}</Text>
    <Text style={{ color: muted ? c.line : c.serialZero }}>{lead.slice(0, lead.length - (rest === '0' ? 1 : 0))}</Text>
    <Text style={{ color: ink }}>{rest}</Text>
  </Text>;
}

// ── Botones ───────────────────────────────────────────────────────────────
export function Kbd({ c, children, light }) {
  if (!WEB) return null;
  return <View style={{ paddingHorizontal: 5, minWidth: 20, height: 18, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: light ? 'rgba(255,255,255,0.35)' : c.rule, backgroundColor: light ? 'rgba(255,255,255,0.08)' : c.paperAlt }}>
    <Text style={{ fontFamily: FONT, fontSize: 11, fontWeight: '600', color: light ? 'rgba(255,255,255,0.85)' : c.muted }}>{children}</Text>
  </View>;
}

const VARIANTS = c => ({
  ink: { bg: c.isDark ? c.onInk : c.ink, fg: c.isDark ? c.ink : c.onInk, border: 'transparent', hover: c.isDark ? '#FFFFFF' : '#2A2C31' },
  paid: { bg: c.green, fg: c.isDark ? '#08130C' : '#FFFFFF', border: 'transparent', hover: c.green },
  outline: { bg: c.paper, fg: c.text, border: c.rule, hover: c.hover },
  ghost: { bg: 'transparent', fg: c.text, border: 'transparent', hover: c.hover },
  danger: { bg: c.redSoft, fg: c.red, border: 'transparent', hover: c.redSoft },
  dangerSolid: { bg: c.red, fg: '#FFFFFF', border: 'transparent', hover: c.red },
});
export function Btn({ c, children, icon: Icon, variant = 'outline', size = 'md', onPress, disabled, loading, full, style, kbd, accessibilityLabel }) {
  const off = disabled && !loading && (variant === 'ink' || variant === 'paid' || variant === 'dangerSolid');
  const v = off ? { bg: c.line, fg: c.muted, border: 'transparent', hover: c.line } : VARIANTS(c)[variant];
  const h = size === 'lg' ? 56 : size === 'sm' ? tap(36) : 44;
  const fs = size === 'lg' ? 17 : size === 'sm' ? 13 : 14;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)} accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
    onPress={onPress} disabled={disabled || loading} scaleTo={0.98} hoverStyle={{ backgroundColor: v.hover }}
    style={[{ minHeight: h, paddingHorizontal: size === 'sm' ? 12 : 16, borderRadius: r.md, borderWidth: 1, borderColor: v.border, backgroundColor: v.bg,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled && !off ? 0.42 : 1, alignSelf: full ? 'stretch' : undefined }, full ? { flexGrow: 1, flexShrink: 1, minWidth: 0 } : null, style]}>
    {Icon ? <Icon size={size === 'lg' ? 20 : 17} color={v.fg} strokeWidth={2} /> : null}
    {children != null ? <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT, fontSize: fs, fontWeight: '700', color: v.fg, fontVariant: ['tabular-nums'] }}>{loading ? 'Procesando…' : children}</Text> : null}
    {kbd ? <Kbd c={c} light={!off && (variant === 'ink' && !c.isDark || variant === 'paid' || variant === 'dangerSolid')}>{kbd}</Kbd> : null}
  </Press>;
}
export function IconBtn({ c, icon: Icon, label, onPress, color, size = 40, disabled, onInk }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} scaleTo={0.94}
    hoverStyle={{ backgroundColor: onInk ? 'rgba(255,255,255,0.08)' : c.hover }}
    style={{ width: tap(size), height: tap(size), borderRadius: r.md, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <Icon size={18} color={color || (onInk ? c.inkMuted : c.muted)} />
  </Press>;
}

// Control segmentado (métodos, modos). Lo activo va en tinta.
export function Seg({ c, options, value, onChange, disabled, wrap, size = 'md', label }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: wrap ? 6 : 0, padding: wrap ? 0 : 3, borderRadius: r.lg, backgroundColor: wrap ? 'transparent' : c.paperAlt, borderWidth: wrap ? 0 : 1, borderColor: c.line }}>
    {options.map(o => {
      const on = o.value === value;
      const Icon = o.icon;
      return <Press key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} accessibilityLabel={o.a11y || o.label} disabled={disabled}
        onPress={() => { if (!on) haptic('select'); onChange(o.value); }} scaleTo={0.97} hoverStyle={on ? null : { backgroundColor: c.hover }}
        style={{ flexGrow: 1, flexBasis: wrap ? (o.basis || '30%') : 0, minHeight: size === 'sm' ? tap(36) : 44, paddingHorizontal: 10, borderRadius: r.md, flexDirection: 'row', gap: 6,
          alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (c.isDark ? c.onInk : c.ink) : wrap ? c.paper : 'transparent', borderWidth: wrap ? 1 : 0, borderColor: on ? 'transparent' : c.rule }}>
        {Icon ? <Icon size={16} color={on ? (c.isDark ? c.ink : c.onInk) : c.muted} /> : null}
        <Text numberOfLines={1} style={{ fontFamily: FONT, fontSize: size === 'sm' ? 13 : 14, fontWeight: on ? '700' : '600', color: on ? (c.isDark ? c.ink : c.onInk) : c.muted }}>{o.label}</Text>
        {o.count != null ? <Text style={{ fontFamily: FONT, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'], color: on ? (c.isDark ? c.ink : c.inkMuted) : c.faint }}>{o.count}</Text> : null}
      </Press>;
    })}
  </View>;
}

export function Badge({ c, tone = 'neutral', children }) {
  const map = { neutral: [c.paperAlt, c.muted], green: [c.greenSoft, c.green], amber: [c.amberSoft, c.amber], red: [c.redSoft, c.red], blue: [c.blueSoft, c.blue], serial: [c.serialSoft, c.serial] };
  const [bg, fg] = map[tone] || map.neutral;
  return <View style={{ paddingHorizontal: 7, height: 22, borderRadius: r.sm, backgroundColor: bg, justifyContent: 'center', alignSelf: 'flex-start' }}>
    <Text numberOfLines={1} style={{ fontFamily: FONT, fontSize: 12, fontWeight: '700', color: fg }}>{children}</Text>
  </View>;
}

// ── Celdas rayadas: el bloque de datos de un comprobante ─────────────────────
export function Cells({ c, children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.rule }, style]}>{children}</View>;
}
export function Cell({ c, label, children, basis = '50%', grow = 1, style }) {
  return <View style={[{ flexBasis: basis, flexGrow: grow, minWidth: 0, paddingHorizontal: 12, paddingVertical: 8, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.rule, gap: 2 }, style]}>
    <Lbl c={c}>{label}</Lbl>
    {typeof children === 'string' ? <T c={c} size={14} weight="600" numberOfLines={1}>{children}</T> : children}
  </View>;
}
// Celda editable: el campo vive dentro de la retícula.
export function CellInput({ c, label, basis, grow, error, inputRef, ...props }) {
  return <Cell c={c} label={label} basis={basis} grow={grow} style={error ? { backgroundColor: c.redSoft } : null}>
    <TextInput ref={inputRef} accessibilityLabel={label} placeholderTextColor={c.faint} {...props}
      style={[{ fontFamily: FONT, fontSize: 15, fontWeight: '600', color: c.text, paddingVertical: 2, minHeight: 26, fontVariant: ['tabular-nums'] }, WEB ? { outlineStyle: 'none' } : null]} />
  </Cell>;
}

// Campo con etiqueta (formularios de diálogo).
export function Field({ c, label, hint, error, style, inputRef, big, ...props }) {
  const [focus, setFocus] = React.useState(false);
  return <View style={[{ gap: 6 }, style]}>
    {label ? <T c={c} size={13} weight="600" color={c.muted}>{label}</T> : null}
    <TextInput ref={inputRef} accessibilityLabel={label || props.placeholder} placeholderTextColor={c.faint} {...props}
      onFocus={e => { setFocus(true); props.onFocus?.(e); }} onBlur={e => { setFocus(false); props.onBlur?.(e); }}
      style={[{ minHeight: big ? 56 : 44, paddingHorizontal: 12, paddingVertical: props.multiline ? 10 : 0, borderRadius: r.md, borderWidth: 1,
        borderColor: error ? c.red : focus ? c.blue : c.rule, backgroundColor: c.paper, color: c.text, fontFamily: FONT, fontSize: big ? 24 : 15,
        fontWeight: big ? '700' : '500', fontVariant: ['tabular-nums'], textAlignVertical: props.multiline ? 'top' : 'center' },
        WEB ? { outlineStyle: 'none', boxShadow: focus ? `0 0 0 3px ${c.focus}` : 'none', transitionProperty: 'border-color, box-shadow', transitionDuration: '150ms' } : null]} />
    {error ? <T c={c} size={13} color={c.red}>{error}</T> : hint ? <T c={c} size={13} color={c.faint}>{hint}</T> : null}
  </View>;
}

// Fila de totales (caja de totales a la derecha del comprobante).
export function TotalRow({ c, label, value, strong, tone, note }) {
  const color = tone === 'green' ? c.green : tone === 'amber' ? c.amber : tone === 'red' ? c.red : c.text;
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingVertical: strong ? 10 : 6, paddingHorizontal: 12,
    borderTopWidth: strong ? 1 : 0, borderColor: c.rule, backgroundColor: strong ? c.paperAlt : 'transparent' }}>
    <T c={c} size={strong ? 15 : 14} weight={strong ? '800' : '500'} color={strong ? c.text : c.muted}>{label}{note ? <Text style={{ color: c.faint, fontWeight: '400' }}>{`  ${note}`}</Text> : null}</T>
    <Num c={c} size={strong ? 20 : 14} weight={strong ? '800' : '600'} color={color}>{typeof value === 'number' ? money(value) : value}</Num>
  </View>;
}

// ── Teclado numérico de cobro ───────────────────────────────────────────────
export function applyKey(current, key) {
  let s = String(current ?? '');
  if (key === 'back') return s.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') return s.includes('.') ? s : (s || '0') + '.';
  if (s.includes('.') && s.split('.')[1].length >= 2) return s;
  if (s === '0' && key !== '.') s = '';
  if (s.replace('.', '').length >= 7) return s;
  return s + key;
}
export function Keypad({ c, onKey, disabled, compact }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];
  const h = compact ? 46 : 54;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.rule, borderRadius: r.md, overflow: 'hidden' }}>
    {keys.map(k => <Press key={k} accessibilityRole="button" accessibilityLabel={k === 'back' ? 'Borrar' : k === '.' ? 'Punto decimal' : k} disabled={disabled}
      onPress={() => { haptic('tap'); onKey(k); }} onLongPress={k === 'back' ? () => onKey('clear') : undefined} scaleTo={0.96} hoverStyle={{ backgroundColor: c.hover }}
      style={{ width: '33.333%', height: h, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.rule, backgroundColor: c.paper, opacity: disabled ? 0.45 : 1 }}>
      {k === 'back' ? <Delete size={20} color={c.muted} /> : <Text style={{ fontFamily: FONT, fontSize: compact ? 19 : 21, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>{k === '.' ? ',' : k}</Text>}
    </Press>)}
  </View>;
}

// ── Diálogo: centrado en pantallas anchas, hoja inferior en celular ─────────
export function Dialog({ c, visible, onClose, title, subtitle, children, footer, width = 520, busy, icon: Icon, tone }) {
  const { width: W, height: H } = useWindowDimensions();
  const sheet = W < 640;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (visible) { a.setValue(0); Animated.timing(a, { toValue: 1, duration: 200, easing: EASE, useNativeDriver: ND }).start(); } }, [visible]);
  useEffect(() => {
    if (!WEB || !visible) return;
    const key = e => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose?.(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [visible, busy, onClose]);
  const enter = sheet ? { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }
    : { transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] };
  const toneColor = tone === 'red' ? c.red : tone === 'amber' ? c.amber : tone === 'green' ? c.green : c.text;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => !busy && onClose?.()} statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: sheet ? 'flex-end' : 'center', alignItems: 'center', padding: sheet ? 0 : 24 }}>
      <Pressable accessibilityLabel="Cerrar" onPress={() => !busy && onClose?.()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Animated.View accessibilityViewIsModal style={[{ width: '100%', maxWidth: sheet ? undefined : width, maxHeight: sheet ? H * 0.92 : H - 48, backgroundColor: c.paper,
        borderRadius: sheet ? 0 : r.lg, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden', opacity: a },
        WEB ? { boxShadow: '0 24px 64px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.12)' } : { elevation: 12 }, enter]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, borderBottomWidth: 1, borderColor: c.line }}>
          {Icon ? <View style={{ paddingTop: 2 }}><Icon size={20} color={toneColor} /></View> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <T c={c} size={18} weight="800" accessibilityRole="header">{title}</T>
            {subtitle ? <T c={c} size={13} color={c.muted}>{subtitle}</T> : null}
          </View>
          <IconBtn c={c} icon={X} label="Cerrar" onPress={onClose} disabled={busy} size={36} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>{children}</ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.paperAlt }}>{footer}</View> : null}
      </Animated.View>
    </View>
  </Modal>;
}

export function Empty({ c, icon: Icon, title, description, action }) {
  return <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 }}>
    {Icon ? <Icon size={28} color={c.faint} strokeWidth={1.6} /> : null}
    <T c={c} size={16} weight="700" style={{ textAlign: 'center' }}>{title}</T>
    {description ? <T c={c} size={14} color={c.muted} style={{ textAlign: 'center', maxWidth: 340 }}>{description}</T> : null}
    {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
  </View>;
}

// Esqueleto de carga (barra gris que respira).
export function Skel({ c, w = '100%', h = 14, style }) {
  const a = useRef(new Animated.Value(0.5)).current;
  useEffect(() => { const l = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: ND }), Animated.timing(a, { toValue: 0.5, duration: 700, useNativeDriver: ND })])); l.start(); return () => l.stop(); }, []);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r.sm, backgroundColor: c.line, opacity: a }, style]} />;
}

export { Press };
