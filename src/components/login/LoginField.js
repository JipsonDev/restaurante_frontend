import React, { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { loginColors as c, loginStyles as s } from './loginStyles';

export default function LoginField({ id, label, icon: Icon, trailing, inputRef, error, ...props }) {
  const [focused, setFocused] = useState(false);
  return <View style={s.fieldGroup}>
    <Text nativeID={`${id}-label`} style={s.label}>{label}</Text>
    <View style={[s.field, { borderColor: error ? c.error : focused ? c.focus : c.line }]}>
      <Icon size={17} color={error ? c.error : c.muted} />
      <TextInput
        ref={inputRef}
        nativeID={id}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        {...(Platform.OS === 'web' ? { 'aria-describedby': error ? `${id}-error` : undefined, 'aria-invalid': !!error } : {})}
        placeholderTextColor={c.faint}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={s.input}
        {...props}
      />
      {trailing}
    </View>
    {error ? <Text nativeID={`${id}-error`} accessibilityLiveRegion="polite" style={s.fieldError}>{error}</Text> : null}
  </View>;
}
