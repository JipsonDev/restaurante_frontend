import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Sistema de diseno compartido para Morena Mia.
 * Paleta administrativa limpia: blanco, slate y azul profesional.
 */
export const palette = {
  light: {
    bg: '#F5F6FC',
    surface: '#ffffff',
    surfaceAlt: '#F8FAFC',
    soft: '#EEF2F7',
    softer: '#E2E8F0',
    line: '#D8E0EA',
    text: '#0F172A',
    muted: '#475569',
    faint: '#64748B',
    primary: '#4F46E5',
    primaryText: '#4338CA',
    primarySoft: '#EEF2FF',
    onPrimary: '#ffffff',
    accent: '#0F172A',
    accentSoft: '#eef2ff',
    green: '#059669',
    greenSoft: '#ecfdf5',
    amber: '#d97706',
    amberSoft: '#fffbeb',
    red: '#e11d48',
    redSoft: '#fff1f2',
    sky: '#0284c7',
    skySoft: '#f0f9ff',
    shadow: 'rgba(15,23,42,0.10)',
    overlay: 'rgba(15,23,42,0.45)',
    isDark: false,
  },
  dark: {
    bg: '#0B1220',
    secondary: '#111B2D',
    surface: '#1A2740',
    surfaceAlt: '#243754',
    soft: '#111B2D',
    softer: '#243754',
    line: '#2C4561',
    text: '#F7F4E9',
    muted: '#A8B3C7',
    faint: '#64748B',
    primary: '#F6B325',
    primaryHover: '#D99A1F',
    primaryText: '#F6B325',
    primarySoft: '#3C301B',
    onPrimary: '#0B1220',
    accent: '#F6B325',
    accentSoft: '#3C301B',
    green: '#2ECC71',
    greenSoft: '#153B30',
    amber: '#F59E0B',
    amberSoft: '#3E3019',
    pink: '#F472B6',
    pinkSoft: '#3D2640',
    red: '#EF4444',
    redSoft: '#3D252E',
    purple: '#8B5CF6',
    purpleSoft: '#30264A',
    sky: '#58BCF5',
    skySoft: '#173A55',
    shadow: 'rgba(3,8,17,0.35)',
    overlay: 'rgba(5,11,23,0.76)',
    isDark: true,
  },
};

const STORAGE_KEY = 'mm:theme';
const memoryStore = {};

const themeStorage = {
  async getItem(key) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { return window.localStorage.getItem(key); } catch { return memoryStore[key] || null; }
    }
    return memoryStore[key] || null;
  },
  async setItem(key, value) {
    memoryStore[key] = value;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.localStorage.setItem(key, value); } catch {}
    }
  },
};

const ThemeContext = createContext({
  mode: 'light',
  c: palette.light,
  isDark: false,
  toggle: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children, defaultMode = 'light' }) {
  const [mode, setMode] = useState(defaultMode);

  useEffect(() => {
    (async () => {
      try {
        const saved = await themeStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') setMode(saved);
      } catch {
        // sin persistencia disponible: se queda con defaultMode
      }
    })();
  }, []);

  const persist = async (next) => {
    try {
      await themeStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignorar errores de almacenamiento
    }
  };

  const value = useMemo(() => {
    const apply = (next) => { setMode(next); persist(next); };
    return {
      mode,
      c: palette[mode] || palette.light,
      isDark: mode === 'dark',
      setMode: apply,
      toggle: () => apply(mode === 'dark' ? 'light' : 'dark'),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

// Panel de administración: azul noche + dorado (la marca del inicio de sesión).
// Neutros fríos teñidos de azul; el dorado se reserva para acción primaria,
// selección y foco. Contrastes AA verificados para texto (>= 4.5:1).
// Panel de administración — paleta «carbón y azul» (estilo admin de comercio):
// gris neutro de fondo, tarjetas blancas, botón principal carbón, azul para enlaces, foco y selección.
// Los estados usan insignias de fondo suave con texto oscuro del mismo tono.
export const adminPalette = {
  light: {
    bg: '#F1F1F1', surface: '#FFFFFF', surfaceAlt: '#F7F7F7', soft: '#EBEBEB', softer: '#E3E3E3',
    line: '#E3E3E3', lineStrong: '#CCCCCC',
    text: '#303030', muted: '#616161', faint: '#757575',
    primary: '#303030', primaryHover: '#1A1A1A', primaryPressed: '#141414', onPrimary: '#FFFFFF',
    interactive: '#005BD3', interactiveHover: '#004299', interactiveSoft: '#EAF4FF',
    primaryText: '#005BD3', primarySoft: '#EAF4FF',
    ink: '#1A1A1A', onInk: '#E3E3E3', navigationActive: '#FFFFFF', accent: '#005BD3', accentSoft: '#EAF4FF',
    gold: '#E8A400', goldHover: '#C98E00', onGold: '#303030',
    green: '#0C5132', greenBright: '#29845A', greenSoft: '#CDFEE1',
    amber: '#5E4200', amberBright: '#E8A400', amberSoft: '#FFEF9D',
    red: '#8E0B21', redBright: '#E51C00', redSoft: '#FEDAD9',
    sky: '#00527C', skyBright: '#2C6ECB', skySoft: '#E0F0FF',
    purple: '#5E35B1', purpleSoft: '#EEE5FF', pink: '#9F2D63', pinkSoft: '#FDE7F1',
    focus: 'rgba(0,91,211,0.45)', overlay: 'rgba(0,0,0,0.5)', shadow: 'rgba(0,0,0,0.07)',
    error: '#8E0B21', paper: '#FFFFFF',
  },
  dark: {
    bg: '#1A1A1A', surface: '#2A2A2A', surfaceAlt: '#303030', soft: '#383838', softer: '#424242',
    line: '#3A3A3A', lineStrong: '#4D4D4D',
    text: '#E3E3E3', muted: '#B5B5B5', faint: '#9A9A9A',
    primary: '#E3E3E3', primaryHover: '#FFFFFF', primaryPressed: '#CCCCCC', onPrimary: '#1A1A1A',
    interactive: '#5AA0FF', interactiveHover: '#80B7FF', interactiveSoft: 'rgba(90,160,255,0.16)',
    primaryText: '#5AA0FF', primarySoft: 'rgba(90,160,255,0.16)',
    ink: '#0F0F0F', onInk: '#E3E3E3', navigationActive: '#303030', accent: '#5AA0FF', accentSoft: 'rgba(90,160,255,0.16)',
    gold: '#E8A400', goldHover: '#F5B921', onGold: '#1A1A1A',
    green: '#7EE2A8', greenBright: '#29845A', greenSoft: 'rgba(41,132,90,0.25)',
    amber: '#F5D45E', amberBright: '#E8A400', amberSoft: 'rgba(232,164,0,0.2)',
    red: '#FF9C8F', redBright: '#E51C00', redSoft: 'rgba(229,28,0,0.22)',
    sky: '#8CCBFF', skyBright: '#2C6ECB', skySoft: 'rgba(44,110,203,0.25)',
    purple: '#C7A6FF', purpleSoft: 'rgba(110,63,201,0.28)', pink: '#F49AC1', pinkSoft: 'rgba(159,45,99,0.28)',
    focus: 'rgba(90,160,255,0.55)', overlay: 'rgba(0,0,0,0.6)', shadow: 'rgba(0,0,0,0.4)',
    error: '#FF9C8F', paper: '#2A2A2A',
  },
};

// Scope administration styling without changing the operational modules.
export function AdminAppearance({ children }) {
  const theme = useTheme();
  const c = { ...theme.c, ...adminPalette[theme.isDark ? 'dark' : 'light'], admin: true, isDark: theme.isDark };
  return <ThemeContext.Provider value={{ ...theme, c }}>{children}</ThemeContext.Provider>;
}

// App del mesero — dirección «Suave»: fondo blanco, tarjetas redondeadas con sombras suaves,
// el rojo de la marca (más vivo) para la acción principal y lo que hay que cobrar.
// Los estados de mesa usan color + punto + texto (nunca solo color).
export const comandaPalette = {
  light: {
    bg: '#FFFFFF', surface: '#FFFFFF', surfaceAlt: '#F4F5F7', soft: '#EEF0F3', softer: '#E4E7EC',
    line: '#ECEEF2', lineStrong: '#D5D9E0', text: '#14161A', muted: '#5F6672', faint: '#8A919C',
    primary: '#D63B20', primaryHover: '#C2341B', primaryPressed: '#A92C16', primarySoft: '#FDECE8', primaryText: '#B8321A', onPrimary: '#FFFFFF',
    ink: '#14161A', onInk: '#FFFFFF',
    green: '#0F7B3E', greenDot: '#12A150', greenSoft: '#E7F6EC', amber: '#A15C00', amberSoft: '#FFF3DC', red: '#C8341B', redSoft: '#FDECE8',
    sky: '#2563C9', skySoft: '#E8F0FD', purple: '#6D4AD1', purpleSoft: '#F0EBFD', pink: '#B33A73', pinkSoft: '#FCEAF2',
    focus: 'rgba(214,59,32,0.35)', overlay: 'rgba(15,17,21,0.42)', shadow: 'rgba(16,24,40,0.08)', glass: 'rgba(255,255,255,0.82)',
  },
  dark: {
    bg: '#0F1012', surface: '#1A1B1F', surfaceAlt: '#23252A', soft: '#2A2C32', softer: '#33363D',
    line: '#2A2C32', lineStrong: '#3A3D45', text: '#F2F3F5', muted: '#A4AAB4', faint: '#7E848F',
    primary: '#D63B20', primaryHover: '#E2492D', primaryPressed: '#BF3219', primarySoft: 'rgba(214,59,32,0.2)', primaryText: '#FF8A70', onPrimary: '#FFFFFF',
    ink: '#F2F3F5', onInk: '#16171A',
    green: '#5FD69A', greenDot: '#3CCB7F', greenSoft: 'rgba(95,214,154,0.14)', amber: '#F5C451', amberSoft: 'rgba(245,196,81,0.14)', red: '#FF8A70', redSoft: 'rgba(255,138,112,0.16)',
    sky: '#8DB7F5', skySoft: 'rgba(141,183,245,0.14)', purple: '#B9A5FA', purpleSoft: 'rgba(185,165,250,0.16)', pink: '#F38BB7', pinkSoft: 'rgba(243,139,183,0.16)',
    focus: 'rgba(255,106,77,0.45)', overlay: 'rgba(0,0,0,0.6)', shadow: 'rgba(0,0,0,0.5)', glass: 'rgba(26,27,31,0.8)',
  },
};

export function WaiterAppearance({ children }) {
  const theme = useTheme();
  const c = { ...theme.c, ...comandaPalette[theme.isDark ? 'dark' : 'light'], comanda: true, admin: false, isDark: theme.isDark };
  return <ThemeContext.Provider value={{ ...theme, c }}>{children}</ThemeContext.Provider>;
}

// Estado de mesa: etiqueta, punto de color y tinte de la tarjeta.
export function comandaTableMeta(state, c) {
  const map = {
    Libre: { label: 'Libre', shape: 'free', bg: c.surface, border: c.line, text: c.green, dot: c.greenDot, tint: c.greenSoft, number: c.text },
    Ocupada: { label: 'Ocupada', shape: 'busy', bg: c.surface, border: c.line, text: c.sky, dot: c.sky, tint: c.skySoft, number: c.text },
    Cuenta: { label: 'Por cobrar', shape: 'filled', bg: c.primary, border: c.primary, text: c.onPrimary, dot: c.onPrimary, tint: c.primarySoft, number: c.onPrimary },
    Reservada: { label: 'Reservada', shape: 'reserved', bg: c.surface, border: c.line, text: c.purple, dot: c.purple, tint: c.purpleSoft, number: c.text },
  };
  return map[state] || map.Libre;
}

export const softShadow = (c, level = 1) => {
  if (c.admin) return Platform.OS === 'web' ? { boxShadow: c.isDark ? 'none' : `0 ${level}px ${3 * level}px ${c.shadow}` } : { elevation: 0 };
  if (Platform.OS === 'web') {
    const a = c.isDark ? 0.4 : 0.08 + level * 0.02;
    return { boxShadow: `0 ${2 * level}px ${8 * level}px rgba(0,0,0,${a})` };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 * level },
    shadowOpacity: c.isDark ? 0.4 : 0.08,
    shadowRadius: 6 * level,
    elevation: 2 * level,
  };
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isPhone = width < 700;
  const isTablet = width >= 700 && width < 1024;
  const isDesktop = width >= 1024;
  const cols = isDesktop ? 4 : isTablet ? 3 : 2;
  return { width, height, isPhone, isTablet, isDesktop, cols };
}

export function gridWidth(cols) {
  const map = { 1: '100%', 2: '48%', 3: '31.5%', 4: '23.5%', 5: '18.5%' };
  return map[cols] || '48%';
}

// Operational modules share the same palette as administration and billing.
export const operationalColors = Object.fromEntries(Object.entries(palette).map(([mode, c]) => [mode, {
  pageBg: c.bg, secondary: c.secondary || c.surface, elevated: c.surfaceAlt, surface: c.surface, field: c.soft, line: c.line, ink: c.text,
  muted: c.muted, faint: c.faint, brand: c.primary, softOrange: c.primarySoft,
  brandHover: c.primaryHover || c.primaryText, promotion: c.purple || '#7C3AED', promotionSoft: c.purpleSoft || '#EDE9FE',
  onAccent: c.onPrimary, danger: c.red, success: c.green, successSoft: c.greenSoft,
  warning: c.amber, warningSoft: c.amberSoft, info: c.sky, infoSoft: c.skySoft,
  isDark: c.isDark,
}]));

export function tableStatusMeta(state, dark = false) {
  const states = {
    Libre: ['Disponible', '#059669', '#DDF8ED', '#047857', '#064E3B', '#6EE7B7', '#34D399'],
    Ocupada: ['Ocupada', '#D97706', '#FFF1D6', '#92400E', '#422B12', '#FCD34D', '#F59E0B'],
    Cuenta: ['Por cobrar', '#E11D48', '#FFE4ED', '#BE123C', '#46172B', '#FDA4AF', '#F43F5E'],
    Reservada: ['Reservada', '#7C3AED', '#EDE9FE', '#6D28D9', '#302050', '#C4B5FD', '#8B5CF6'],
  };
  const [label, dot, bg, text, , , model] = states[state] || states.Libre;
  const stateColors = {
    Libre: { bg: '#153B30', text: '#2ECC71', model: '#2ECC71' },
    Ocupada: { bg: '#3E3019', text: '#F59E0B', model: '#F59E0B' },
    Cuenta: { bg: '#3D2640', text: '#F472B6', model: '#F472B6' },
    Reservada: { bg: '#30264A', text: '#B79AFF', model: '#8B5CF6' },
  };
  const status = stateColors[state] || stateColors.Libre;
  return dark
    ? { label, dot: status.model, bg: status.bg, text: status.text, border: status.bg, model: status.model }
    : { label, dot, bg, text, border: bg, model };
}
