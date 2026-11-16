import React, { forwardRef } from 'react';
import * as RN from 'react-native';
import { useTheme } from '../theme';

// Existing forms share layout utilities; resolve their color utilities through
// the admin palette so modal portals work in both native and web dark mode.
function themed(Component, kind) {
  return forwardRef(function AdminPrimitive({ adminClassName = '', style, ...props }, ref) {
    const { c } = useTheme();
    const resolved = {};
    const classes = adminClassName.split(/\s+/).filter(token => {
      const match = /^(bg|text|border)-(white|black|slate|gray|blue|indigo|red|emerald|green|amber)(?:-(\d+))?(?:\/(\d+))?$/.exec(token);
      if (!match) return true;
      const [, type, family, level, alpha] = match;
      const property = type === 'bg' ? 'backgroundColor' : type === 'text' ? 'color' : 'borderColor';
      const neutral = ['slate', 'gray', 'white'].includes(family);
      let color;
      if (family === 'black' && type === 'bg' && alpha) color = c.overlay;
      else if (type === 'border') color = c.line;
      else if (neutral && type === 'bg') color = family === 'white' ? c.surface : c.soft;
      else if (neutral && type === 'text') color = family === 'white' ? c.onPrimary : Number(level) >= 700 ? c.text : c.muted;
      else {
        const key = ['blue','indigo'].includes(family) ? 'primary' : ['green','emerald'].includes(family) ? 'green' : family;
        color = type === 'bg' && Number(level) <= 200 ? c[`${key}Soft`] : c[key];
        if (type === 'text' && key === 'primary') color = c.primaryText;
      }
      if (!color) return true;
      resolved[property] = color;
      return false;
    }).map(token => token === 'font-extrabold' ? 'font-semibold' : token).join(' ');
    return <Component ref={ref} {...props} {...(kind === 'input' ? { placeholderTextColor: c.faint } : {})} className={classes} style={[kind === 'text' ? { color: c.text } : null, kind === 'input' ? { color: c.text, minHeight: 44 } : null, resolved, style]} />;
  });
}
export const View = themed(RN.View, 'view');
export const Text = themed(RN.Text, 'text');
export const TextInput = themed(RN.TextInput, 'input');
export const TouchableOpacity = themed(RN.TouchableOpacity, 'button');
export const ScrollView = themed(RN.ScrollView, 'scroll');

export const Image = themed(RN.Image, 'image');
