import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
export const waiterFont = Platform.OS === 'web' ? { fontFamily: 'Manrope, "Segoe UI", system-ui, sans-serif' } : {};
export const WText = ({ style, ...props }) => <Text {...props} style={[waiterFont, style]} />;
export function WButton({ colors: c, label, children, Icon, onPress, active, disabled, primary, style, ...props }) {
  return <Pressable {...props} {...(Platform.OS === 'web' && active !== undefined ? { 'aria-pressed': active } : {})} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, ...(active === undefined ? {} : { selected: active }) }} disabled={disabled} onPress={onPress} style={({ hovered, pressed }) => [{ minHeight: 44, minWidth: 44, paddingHorizontal: children ? 12 : 0, borderRadius: 6, borderWidth: 1, borderColor: active || primary ? c.brand : c.line, backgroundColor: primary ? c.action || c.brand : active ? c.softOrange : hovered || pressed ? c.elevated : c.surface, opacity: disabled ? 0.45 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, style]}>
    {Icon ? <Icon size={17} strokeWidth={1.6} color={primary ? c.onAccent : c.muted} /> : null}{children ? <WText style={{ color: primary ? c.onAccent : active ? c.brand : c.ink, fontSize: 12 }}>{children}</WText> : null}
  </Pressable>;
}
export function WSearch({ colors: c, label, placeholder, value, onChangeText }) {
  const [focused, setFocused] = useState(false);
  return <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 12, borderWidth: 1, borderColor: focused ? c.brand : c.line, borderRadius: 6, backgroundColor: c.surface }}><Search size={17} color={c.muted} /><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.muted} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...waiterFont, color: c.ink, flex: 1, minWidth: 0, fontSize: 13, paddingHorizontal: 10, minHeight: 44 }} />{value ? <WButton colors={c} label={`Limpiar ${label.toLowerCase()}`} Icon={X} onPress={() => onChangeText('')} style={{ borderWidth: 0, backgroundColor: 'transparent' }} /> : <View style={{ width: 8 }} />}</View>;
}
export function WFilters({ colors: c, items, value, onChange, label }) {
  return <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingBottom: 10 }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityLabel={label}>{items.map(([key, text, count]) => <WButton key={key} colors={c} label={text} active={value === key} onPress={() => onChange(key)}>{text}{count === undefined ? '' : ` · ${count}`}</WButton>)}</ScrollView>;
}
