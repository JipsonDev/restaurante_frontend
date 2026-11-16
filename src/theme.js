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

// App del mesero — dirección «Comanda»: la libreta de comandas del restaurante.
// Papel y tinta; achiote para la acción principal y lo que requiere cobro; los estados también se
// distinguen por forma (discontinuo = libre, sólido = ocupada, relleno = por cobrar, sello = reservada).
export const comandaPalette = {
  light: {
    bg: '#F7F4EE', surface: '#FFFDF8', surfaceAlt: '#F1ECE2', soft: '#ECE6DA', softer: '#E2DACB',
    line: '#DDD5C6', lineStrong: '#B9AF9C', text: '#1F1D1A', muted: '#6B655C', faint: '#736C61',
    primary: '#B8321A', primaryHover: '#9E2913', primaryPressed: '#86220F', primarySoft: '#F6E1D9', primaryText: '#9E2913', onPrimary: '#FFFFFF',
    ink: '#1F1D1A', onInk: '#FFFDF8',
    green: '#1F6B45', greenSoft: '#DDEEE2', amber: '#9A5B00', amberSoft: '#F6E7C8', red: '#B8321A', redSoft: '#F6E1D9',
    sky: '#2F5D8A', skySoft: '#E1E9F2', purple: '#5B3FA8', purpleSoft: '#E9E3F6', pink: '#A23B6B', pinkSoft: '#F5E1EA',
    focus: 'rgba(184,50,26,0.45)', overlay: 'rgba(31,29,26,0.45)', shadow: 'rgba(31,29,26,0.12)',
  },
  dark: {
    bg: '#1A1917', surface: '#23211E', surfaceAlt: '#2A2825', soft: '#312E2A', softer: '#3A3631',
    line: '#3A3631', lineStrong: '#4D4842', text: '#EDE8E0', muted: '#B3AB9F', faint: '#9C9488',
    primary: '#E0573A', primaryHover: '#EC6B4F', primaryPressed: '#C94A2F', primarySoft: 'rgba(224,87,58,0.18)', primaryText: '#FF8A70', onPrimary: '#1A1917',
    ink: '#EDE8E0', onInk: '#1A1917',
    green: '#7BD9A6', greenSoft: 'rgba(123,217,166,0.14)', amber: '#F2C14E', amberSoft: 'rgba(242,193,78,0.14)', red: '#FF8A70', redSoft: 'rgba(255,138,112,0.16)',
    sky: '#8FB8E8', skySoft: 'rgba(143,184,232,0.14)', purple: '#B7A6F5', purpleSoft: 'rgba(183,166,245,0.16)', pink: '#F08BB0', pinkSoft: 'rgba(240,139,176,0.16)',
    focus: 'rgba(224,87,58,0.55)', overlay: 'rgba(0,0,0,0.6)', shadow: 'rgba(0,0,0,0.45)',
  },
};

export function WaiterAppearance({ children }) {
  const theme = useTheme();
  const c = { ...theme.c, ...comandaPalette[theme.isDark ? 'dark' : 'light'], comanda: true, admin: false, isDark: theme.isDark };
  return <ThemeContext.Provider value={{ ...theme, c }}>{children}</ThemeContext.Provider>;
}

// Estado de mesa en la dirección Comanda: etiqueta, forma del borde y colores.
export function comandaTableMeta(state, c) {
  const map = {
    Libre: { label: 'Libre', shape: 'dashed', bg: 'transparent', border: c.lineStrong, text: c.green, number: c.text },
    Ocupada: { label: 'Ocupada', shape: 'solid', bg: c.surface, border: c.ink, text: c.text, number: c.text },
    Cuenta: { label: 'Por cobrar', shape: 'filled', bg: c.primary, border: c.primary, text: c.onPrimary, number: c.onPrimary },
    Reservada: { label: 'Reservada', shape: 'stamp', bg: c.surface, border: c.purple, text: c.purple, number: c.text },
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
