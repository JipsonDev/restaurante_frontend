// Componentes de formulario y diálogo del panel. Misma API de siempre, construidos sobre el kit
// (components/admin/ui) con el estilo de admin de comercio: campos con borde definido, avisos tipo banner
// y diálogos con encabezado, cuerpo y pie separados.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme';
import { BOTTOM_INSET } from '../utils/safeArea';
import { Banner, Button, EASE_OUT, IconButton, Press, radius, reduceMotion, space, type } from './admin/ui';

const WEB = Platform.OS === 'web';
// Un aviso de error dentro de un diálogo hace que el diálogo "niegue" con un pequeño temblor.
const ModalFx = createContext(null);

export function MenuButton({ children, icon, onPress, primary, danger, disabled, busy, label, style }) {
  if (!children && icon) return <IconButton icon={icon} label={label} onPress={onPress} disabled={disabled || busy} tone={danger ? 'danger' : 'default'} />;
  return <Button icon={icon} onPress={onPress} disabled={disabled} loading={busy} accessibilityLabel={label}
    variant={primary ? 'primary' : danger ? 'danger' : 'secondary'} style={style}>{children}</Button>;
}

// Opción seleccionable (filtros y elecciones en formularios): la activa queda con fondo gris y borde oscuro.
export function MenuChip({ children, selected, onPress, color, background }) {
  const { c } = useTheme();
  return <Press accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} scaleTo={0.97}
    style={{ height: 28, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? c.text : c.lineStrong,
      backgroundColor: selected ? (background || c.softer) : c.surface, paddingHorizontal: 10, justifyContent: 'center' }}
    hoverStyle={selected ? null : { backgroundColor: c.surfaceAlt, borderColor: c.muted }}>
    <Text numberOfLines={1} style={[type.body, { color: selected ? (color || c.text) : c.text, fontWeight: selected ? '600' : '400' }]}>{children}</Text>
  </Press>;
}

export function MenuField({ label, hint, style, containerStyle, error, ...props }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? c.redBright : focused ? c.text : (c.isDark ? '#5C5C5C' : '#8A8A8A');
  return <View style={[{ gap: 4, flexShrink: 0, minWidth: 0 }, containerStyle]}>
    <Text style={[type.body, { color: c.text }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.faint} {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={[type.body, { minHeight: 32, backgroundColor: c.isDark ? '#242424' : '#FDFDFD', borderWidth: 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6, color: c.text,
        ...(WEB ? { outlineStyle: 'none', boxShadow: focused ? `0 0 0 2px ${c.surface}, 0 0 0 4px ${c.focus}` : 'none', transition: 'box-shadow 100ms, border-color 100ms' } : {}) },
        props.multiline && { minHeight: 80, textAlignVertical: 'top' }, style]} />
    {!!error && <Text style={[type.body, { color: c.red }]}>{error}</Text>}
    {!!hint && !error && <Text style={[type.body, { color: c.muted }]}>{hint}</Text>}
  </View>;
}

// Aviso en línea. `danger` = error (y hace temblar el diálogo que lo contiene).
export function MenuNotice({ children, danger }) {
  const fx = useContext(ModalFx);
  const v = useRef(new Animated.Value(reduceMotion() ? 1 : 0)).current;
  const text = typeof children === 'string' ? children : '';
  useEffect(() => {
    if (!reduceMotion()) { v.setValue(0); Animated.timing(v, { toValue: 1, duration: 160, easing: EASE_OUT, useNativeDriver: !WEB }).start(); }
    if (danger) fx?.shake();
  }, [danger, text]);
  return <Animated.View accessibilityLiveRegion={danger ? 'assertive' : undefined} style={{ opacity: v }}>
    <Banner tone={danger ? 'critical' : 'info'}>{children}</Banner>
  </Animated.View>;
}

export function MenuSection({ title, subtitle, children }) {
  const { c } = useTheme();
  return <View style={{ gap: space.md }}>
    <View>
      <Text style={[type.h2, { color: c.text }]}>{title}</Text>
      {!!subtitle && <Text style={[type.body, { color: c.muted }]}>{subtitle}</Text>}
    </View>
    {children}
  </View>;
}

// Diálogo: entra con escala y opacidad (180 ms) y sale más rápido (120 ms); en celular es una hoja inferior.
// Mientras sale conserva el último contenido. tone="danger" (o un título que empieza por Eliminar/Anular…)
// lo convierte en una confirmación compacta con «¿Eliminar X?».
const DANGER_TITLE = /^(eliminar|anular|cancelar pedido|quitar|desactivar|cerrar caja)/i;
export function MenuModal({ visible, title, subtitle, close, footer, children, tabs, maxWidth = 620, busy = false, tone }) {
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
      if (!reduceMotion()) Animated.timing(v, { toValue: 1, duration: phone ? 260 : 180, easing: phone ? Easing.bezier(0.32, 0.72, 0, 1) : EASE_OUT, useNativeDriver: !WEB }).start();
    } else if (mounted) {
      if (reduceMotion()) { setMounted(false); return; }
      Animated.timing(v, { toValue: 0, duration: 120, easing: EASE_OUT, useNativeDriver: !WEB }).start(() => setMounted(false));
    }
  }, [visible]);
  const fx = useRef({ shake: () => {
    if (reduceMotion()) return;
    shakeX.setValue(0);
    Animated.sequence([6, -5, 4, -2, 0].map(x => Animated.timing(shakeX, { toValue: x, duration: 50, useNativeDriver: !WEB }))).start();
  } }).current;
  if (!mounted || !last.current) return null;
  const view = last.current;
  const danger = view.tone === 'danger' || (!view.tone && DANGER_TITLE.test(String(view.title || '')));
  const requestClose = () => { if (!busy && visible) close(); };
  // Solo reescribe «Eliminar insumo» + «Maracuyá» → «¿Eliminar Maracuyá?» cuando el subtítulo es un nombre corto.
  const del = danger && /^eliminar\s+\S+$/i.test(String(view.title || '')) && view.subtitle && String(view.subtitle).length <= 40 && !/[.:;!?]/.test(String(view.subtitle));
  const dTitle = del ? `¿Eliminar ${view.subtitle}?` : view.title;
  const dSub = del ? 'Esta acción no se puede deshacer.' : view.subtitle;
  const boxWidth = danger ? Math.min(maxWidth, 460) : maxWidth;
  return <Modal visible transparent animationType="none" onRequestClose={requestClose}>
    <ModalFx.Provider value={fx}>
    <Animated.View style={{ flex: 1, backgroundColor: c.overlay, opacity: v, padding: phone ? 0 : 24, justifyContent: phone ? 'flex-end' : 'center', alignItems: 'center' }}>
      <Pressable accessibilityLabel="Cerrar" onPress={requestClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(WEB ? { cursor: 'default' } : {}) }} />
      <Animated.View accessibilityViewIsModal accessibilityRole={WEB ? 'dialog' : undefined} accessibilityLabel={dTitle} style={{ backgroundColor: c.surface, width: '100%', maxWidth: boxWidth, maxHeight: phone ? '92%' : '88%', overflow: 'hidden',
        borderRadius: radius.lg + 4, borderBottomLeftRadius: phone ? 0 : radius.lg + 4, borderBottomRightRadius: phone ? 0 : radius.lg + 4,
        ...(WEB ? { boxShadow: '0 20px 40px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)' } : {}),
        transform: [{ translateX: shakeX }, ...(phone ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }]
          : [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }])] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, paddingRight: space.sm, minHeight: 52, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <View style={{ flex: 1, minWidth: 0, paddingVertical: space.md }}>
            <Text accessibilityRole="header" style={[type.h2, { color: c.text }]}>{dTitle}</Text>
            {!!dSub && !danger && <Text numberOfLines={2} style={[type.body, { color: c.muted }]}>{dSub}</Text>}
          </View>
          <IconButton icon={X} label="Cerrar" onPress={requestClose} disabled={busy} size={28} />
        </View>
        {view.tabs ? <View style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: c.line }}>{view.tabs}</View> : null}
        {(!!view.children || (danger && dSub)) && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }} style={{ flexShrink: 1 }}>
          {danger && dSub ? <Text style={[type.body, { color: c.text }]}>{dSub}</Text> : null}
          {view.children}
        </ScrollView>}
        {!!view.footer && <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: (phone ? BOTTOM_INSET : 0) + space.md, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface, gap: 10 }}>{view.footer}</View>}
      </Animated.View>
    </Animated.View>
    </ModalFx.Provider>
  </Modal>;
}
