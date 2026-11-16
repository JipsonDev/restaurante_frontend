import React, { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { loginColors as c, loginStyles as s } from './loginStyles';

// El autocompletado de Chrome/Edge/Safari pinta los campos de celeste y el texto
// de negro, rompiendo el tema oscuro. Se sobrescribe una sola vez con CSS (solo web).
const AUTOFILL_STYLE_ID = 'mm-login-autofill';
function injectAutofillStyle() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById(AUTOFILL_STYLE_ID)) return;
  const sel = state => `[data-login-field="true"] input:-webkit-autofill${state}`;
  const style = document.createElement('style');
  style.id = AUTOFILL_STYLE_ID;
  style.textContent = `
    ${['', ':hover', ':focus', ':active'].map(sel).join(',\n    ')} {
      -webkit-box-shadow: 0 0 0 1000px ${c.field} inset !important;
      box-shadow: 0 0 0 1000px ${c.field} inset !important;
      -webkit-text-fill-color: ${c.ink} !important;
      caret-color: ${c.gold};
      transition: background-color 9999s ease-out 0s, color 9999s ease-out 0s;
    }
    ${sel('::first-line')} { font-family: 'Manrope-Regular', sans-serif; font-size: 16px; }
    [data-login-field="true"] input:autofill { background-color: ${c.field} !important; color: ${c.ink} !important; }
  `;
  document.head.appendChild(style);
}

export default function LoginField({ id, label, icon: Icon, trailing, inputRef, error, ...props }) {
  const [focused, setFocused] = useState(false);
  injectAutofillStyle();
  return <View style={s.fieldGroup}>
    <Text nativeID={`${id}-label`} style={s.label}>{label}</Text>
    <View dataSet={{ loginField: 'true' }} style={[s.field, { borderColor: error ? c.error : focused ? c.focus : c.line }]}>
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
