import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme';
import { BOTTOM_INSET } from '../utils/safeArea';

export function MenuButton({ children, icon: Icon, onPress, primary, danger, disabled, busy, label, style }) {
  const { c } = useTheme();
  const color = primary ? c.onPrimary : danger ? c.red : c.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label || (typeof children === 'string' ? children : undefined)} accessibilityState={{ disabled: !!(disabled || busy) }} disabled={disabled || busy} onPress={onPress} style={({ hovered }) => [{ minHeight: 42, paddingHorizontal: children ? 14 : 11, borderRadius: 8, borderWidth: 1, borderColor: primary ? c.primary : danger ? c.redSoft : c.line, backgroundColor: primary ? (hovered ? c.primaryHover || c.primary : c.primary) : danger ? c.redSoft : hovered ? c.soft : c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: disabled || busy ? 0.55 : 1 }, style]}>
    {busy ? <ActivityIndicator size="small" color={color} /> : Icon && <Icon size={17} color={color} strokeWidth={1.8} />}
    {!!children && <Text style={{ color, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{children}</Text>}
  </Pressable>;
}
export function MenuChip({ children, selected, onPress, color, background }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 40, borderRadius: 7, borderWidth: 1, borderColor: selected ? c.primary : c.line, backgroundColor: selected ? background || c.primarySoft : c.surface, paddingHorizontal: 12, justifyContent: 'center' }}><Text style={{ color: selected ? color || c.primaryText : c.muted, fontSize: 12, fontWeight: selected ? '600' : '400' }}>{children}</Text></Pressable>;
}
export function MenuField({ label, hint, style, containerStyle, ...props }) {
  const { c } = useTheme();
  return <View style={[{ gap: 6, flexShrink: 0, minWidth: 0 }, containerStyle]}>
    <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...props} style={[{ minHeight: 44, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 14 }, props.multiline && { minHeight: 86, textAlignVertical: 'top' }, style]} />
    {!!hint && <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>{hint}</Text>}
  </View>;
}
export function MenuNotice({ children, danger }) {
  const { c } = useTheme();
  return <View accessibilityRole={danger ? 'alert' : undefined} style={{ backgroundColor: danger ? c.redSoft : c.primarySoft, padding: 12, borderRadius: 8 }}><Text style={{ color: danger ? c.red : c.primaryText, fontSize: 12, lineHeight: 18 }}>{children}</Text></View>;
}
export function MenuSection({ title, subtitle, children }) {
  const { c } = useTheme();
  return <View style={{ gap: 16 }}><View><Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>{!!subtitle && <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{subtitle}</Text>}</View>{children}</View>;
}
export function MenuModal({ visible, title, subtitle, close, footer, children, tabs, maxWidth = 860, busy = false }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  // Unmount closed dialogs before their cleared props can appear during a fade-out.
  if (!visible) return null;
  const requestClose = () => { if (!busy) close(); };
  return <Modal visible transparent animationType="none" onRequestClose={requestClose}>
    <View style={{ flex: 1, backgroundColor: c.overlay, padding: width < 680 ? 10 : 24, justifyContent: 'center', alignItems: 'center' }}>
      <View accessibilityViewIsModal accessibilityLabel={title} style={{ backgroundColor: c.surface, borderRadius: 12, width: '100%', maxWidth, maxHeight: '94%', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderBottomWidth: children ? 1 : 0, borderBottomColor: c.line }}><View style={{ flex: 1 }}><Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{title}</Text>{!!subtitle && <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 5 }}>{subtitle}</Text>}</View><MenuButton icon={X} label={`Cerrar ${title}`} disabled={busy} onPress={requestClose} /></View>
        {tabs}
        {!!children && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }} style={{ flexShrink: 1 }}>{children}</ScrollView>}
        {!!footer && <View style={{ padding: 14, paddingBottom: BOTTOM_INSET + 14, borderTopWidth: 1, borderTopColor: c.line, gap: 10 }}>{footer}</View>}
      </View>
    </View>
  </Modal>;
}
