// Componentes de formulario y diálogo del panel. Misma API de siempre, construidos
// sobre el kit del panel (components/admin/ui) para que todas las secciones hablen igual.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { AlertCircle, Info, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../theme';
import { BOTTOM_INSET } from '../utils/safeArea';
import { Button, EASE_OUT, IconButton, Press, radius, reduceMotion, space, type } from './admin/ui';

const WEB = Platform.OS === 'web';
// Un aviso de error dentro de un diálogo hace que el diálogo "niegue" con un pequeño temblor.
const ModalFx = createContext(null);

export function MenuButton({ children, icon, onPress, primary, danger, disabled, busy, label, style }) {
  if (!children && icon) return <IconButton icon={icon} label={label} onPress={onPress} disabled={disabled || busy} tone={danger ? 'danger' : 'default'} size={40} />;
  return <Button icon={icon} onPress={onPress} disabled={disabled} loading={busy} accessibilityLabel={label}
    variant={primary ? 'primary' : danger ? 'danger' : 'secondary'} style={style}>{children}</Button>;
}

// Filtro seleccionable: suave en reposo, con punto dorado cuando está activo.
export function MenuChip({ children, selected, onPress, color, background }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} scaleTo={0.96}
    style={{ height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? c.primary : c.line,
      backgroundColor: selected ? (background || c.primarySoft) : c.surface, paddingHorizontal: 14, justifyContent: 'center' }}
    hoverStyle={selected ? null : { borderColor: c.lineStrong, backgroundColor: c.surfaceAlt }}>
    <Text numberOfLines={1} style={[type.small, { color: selected ? (color || c.text) : c.muted, fontWeight: selected ? '600' : '500' }]}>{children}</Text>
  </Press>;
}

export function MenuField({ label, hint, style, containerStyle, ...props }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={[{ gap: 6, flexShrink: 0, minWidth: 0 }, containerStyle]}>
    <Text style={[type.small, { color: c.text, fontWeight: '600' }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.faint} {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={[type.body, { minHeight: 42, backgroundColor: c.surface, borderWidth: 1, borderColor: focused ? c.primary : c.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: c.text,
        ...(WEB ? { outlineStyle: 'none', boxShadow: focused ? `0 0 0 3px ${c.focus}` : 'none', transition: 'box-shadow 150ms, border-color 150ms' } : {}) },
        props.multiline && { minHeight: 88, textAlignVertical: 'top' }, style]} />
    {!!hint && <Text style={[type.micro, { color: c.faint }]}>{hint}</Text>}
  </View>;
}

export function MenuNotice({ children, danger }) {
  const { c } = useTheme();
  const fx = useContext(ModalFx);
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  const text = typeof children === 'string' ? children : '';
  useEffect(() => {
    if (!reduceMotion()) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 180, easing: EASE_OUT, useNativeDriver: !WEB }).start(); }
    if (danger) fx?.shake();
  }, [danger, text]);
  const Icon = danger ? AlertCircle : Info;
  return <Animated.View accessibilityRole={danger ? 'alert' : undefined} accessibilityLiveRegion={danger ? 'assertive' : undefined}
    style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }], flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: danger ? c.redSoft : c.surfaceAlt, borderWidth: 1, borderColor: danger ? 'transparent' : c.line, padding: 12, borderRadius: radius.md }}>
    <Icon size={16} color={danger ? c.red : c.muted} style={{ marginTop: 1 }} />
    <Text style={[type.small, { flex: 1, color: danger ? c.red : c.text }]}>{children}</Text>
  </Animated.View>;
}

export function MenuSection({ title, subtitle, children }) {
  const { c } = useTheme();
  return <View style={{ gap: space.lg }}>
    <View>
      <Text style={[type.h3, { color: c.text }]}>{title}</Text>
      {!!subtitle && <Text style={[type.small, { color: c.muted, marginTop: 4 }]}>{subtitle}</Text>}
    </View>
    {children}
  </View>;
}

// Diálogo: entra con escala y opacidad (220 ms) y sale más rápido (150 ms); en celular es una hoja inferior.
// Mientras sale conserva el último contenido, para que no parpadee con datos vacíos.
// tone="danger" (o un título que empieza por Eliminar/Anular…) lo convierte en una confirmación compacta.
const DANGER_TITLE = /^(eliminar|anular|cancelar pedido|quitar|desactivar|cerrar caja)/i;
export function MenuModal({ visible, title, subtitle, close, footer, children, tabs, maxWidth = 640, busy = false, tone }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < 680;
  const v = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const last = useRef(null);
  if (visible) last.current = { title, subtitle, footer, children, tabs, tone };
  useEffect(() => {
    if (visible) {
      setMounted(true);
      v.setValue(reduceMotion() ? 1 : 0);
      if (!reduceMotion()) Animated.timing(v, { toValue: 1, duration: phone ? 300 : 220, easing: phone ? Easing.bezier(0.32, 0.72, 0, 1) : EASE_OUT, useNativeDriver: !WEB }).start();
    } else if (mounted) {
      if (reduceMotion()) { setMounted(false); return; }
      Animated.timing(v, { toValue: 0, duration: 150, easing: EASE_OUT, useNativeDriver: !WEB }).start(() => setMounted(false));
    }
  }, [visible]);
  const fx = useRef({ shake: () => {
    if (reduceMotion()) return;
    shakeX.setValue(0);
    Animated.sequence([6, -5, 4, -2, 0].map(x => Animated.timing(shakeX, { toValue: x, duration: 55, useNativeDriver: !WEB }))).start();
  } }).current;
  if (!mounted || !last.current) return null;
  const view = last.current;
  const danger = view.tone === 'danger' || (!view.tone && DANGER_TITLE.test(String(view.title || '')));
  const requestClose = () => { if (!busy && visible) close(); };
  // "Eliminar insumo" + nombre → "¿Eliminar Maracuyá?" + consecuencia clara.
  const del = danger && /^eliminar\s+\S+$/i.test(String(view.title || '')) && view.subtitle;
  const dTitle = del ? `¿Eliminar ${view.subtitle}?` : view.title;
  const dSub = del ? 'Esta acción no se puede deshacer.' : view.subtitle;
  const width_ = danger ? Math.min(maxWidth, 460) : maxWidth;
  return <Modal visible transparent animationType="none" onRequestClose={requestClose}>
    <ModalFx.Provider value={fx}>
    <Animated.View style={{ flex: 1, backgroundColor: c.overlay, opacity: v, padding: phone ? 0 : 24, justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center' }}>
      <Pressable accessibilityLabel="Cerrar" onPress={requestClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(WEB ? { cursor: 'default' } : {}) }} />
      <Animated.View accessibilityViewIsModal accessibilityLabel={view.title} style={{ backgroundColor: c.surface, width: '100%', maxWidth: width_, maxHeight: phone ? '92%' : '90%', overflow: 'hidden',
        borderRadius: radius.lg + 2, borderBottomLeftRadius: phone ? 0 : radius.lg + 2, borderBottomRightRadius: phone ? 0 : radius.lg + 2, borderWidth: 1, borderColor: c.line,
        ...(WEB ? { boxShadow: c.isDark ? '0 24px 64px rgba(0,0,0,0.55)' : '0 1px 2px rgba(14,23,38,0.06), 0 24px 64px rgba(14,23,38,0.20)' } : {}),
        transform: [{ translateX: shakeX }, ...(phone ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }]
          : [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }])] }}>
        {phone ? <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.lineStrong }} /></View> : null}
        {danger ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.lg, padding: space.xl, paddingBottom: view.children ? space.md : space.xl }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.redSoft, alignItems: 'center', justifyContent: 'center' }}><Trash2 size={18} color={c.red} /></View>
            <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <Text accessibilityRole="header" style={[type.h3, { color: c.text, fontWeight: '600' }]}>{dTitle}</Text>
              {!!dSub && <Text style={[type.body, { color: c.muted, marginTop: 4 }]}>{dSub}</Text>}
            </View>
          </View>
          : <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingTop: phone ? space.md : space.xl, paddingBottom: view.children ? space.lg : space.xl, borderBottomWidth: view.children ? 1 : 0, borderBottomColor: c.line }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text accessibilityRole="header" style={[type.h2, { color: c.text, fontWeight: '600' }]}>{view.title}</Text>
              {!!view.subtitle && <Text style={[type.small, { color: c.muted, marginTop: 4 }]}>{view.subtitle}</Text>}
            </View>
            <IconButton icon={X} label="Cerrar" onPress={requestClose} disabled={busy} size={34} />
          </View>}
        {view.tabs}
        {!!view.children && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingTop: danger ? 0 : space.xl, paddingLeft: danger && !phone ? space.xl + 40 + space.lg : space.xl, gap: space.lg }} style={{ flexShrink: 1 }}>{view.children}</ScrollView>}
        {!!view.footer && <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: (phone ? BOTTOM_INSET : 0) + space.lg, borderTopWidth: danger ? 0 : 1, borderTopColor: c.line, backgroundColor: c.surface, gap: 10 }}>{view.footer}</View>}
      </Animated.View>
    </Animated.View>
    </ModalFx.Provider>
  </Modal>;
}
