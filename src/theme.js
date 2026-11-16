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
export const adminPalette = {
  light: {
    bg: '#F3F5F8', surface: '#FFFFFF', surfaceAlt: '#F7F8FA', soft: '#EDF0F4', softer: '#E2E6EC',
    line: '#E1E5EB', lineStrong: '#C9D0DA',
    text: '#0E1726', muted: '#4A5568', faint: '#667085',
    primary: '#F6B325', primaryHover: '#E9A513', primaryPressed: '#D99A0B', primaryText: '#8A5A00', primarySoft: '#FEF4DC', onPrimary: '#0E1726',
    ink: '#0E1726', onInk: '#FFFFFF', navigationActive: '#EEF1F6', accent: '#F6B325', accentSoft: '#FEF4DC',
    gold: '#F6B325', goldHover: '#E9A513', onGold: '#0E1726',
    green: '#137535', greenBright: '#22A35A', greenSoft: '#E6F4EB',
    amber: '#94570A', amberBright: '#E9A513', amberSoft: '#FDF1DB',
    red: '#C0261C', redBright: '#E5484D', redSoft: '#FCEBEA',
    sky: '#1F5FBF', skyBright: '#3B82F6', skySoft: '#E7EFFB',
    purple: '#6B3FD1', purpleSoft: '#EFEAFB', pink: '#B4235F', pinkSoft: '#FBE9F0',
    focus: 'rgba(246,179,37,0.55)', overlay: 'rgba(14,23,38,0.42)', shadow: 'rgba(14,23,38,0.08)',
    error: '#C0261C', paper: '#FFFFFF',
  },
  dark: {
    bg: '#0B1220', surface: '#111B2D', surfaceAlt: '#16233A', soft: '#1A2740', softer: '#22324A',
    line: '#1F2E45', lineStrong: '#2E4260',
    text: '#F3F1EA', muted: '#A8B3C7', faint: '#8E9FB7',
    primary: '#F6B325', primaryHover: '#FFC54F', primaryPressed: '#E9A513', primaryText: '#F6B325', primarySoft: 'rgba(246,179,37,0.12)', onPrimary: '#111827',
    ink: '#F3F1EA', onInk: '#0B1220', navigationActive: '#16233A', accent: '#F6B325', accentSoft: 'rgba(246,179,37,0.12)',
    gold: '#F6B325', goldHover: '#FFC54F', onGold: '#111827',
    green: '#4ADE80', greenBright: '#22C55E', greenSoft: 'rgba(74,222,128,0.12)',
    amber: '#FBBF24', amberBright: '#F59E0B', amberSoft: 'rgba(251,191,36,0.12)',
    red: '#FF8A85', redBright: '#EF4444', redSoft: 'rgba(255,138,133,0.12)',
    sky: '#7DB4FF', skyBright: '#3B82F6', skySoft: 'rgba(125,180,255,0.12)',
    purple: '#B79AFF', purpleSoft: 'rgba(183,154,255,0.12)', pink: '#F49AC1', pinkSoft: 'rgba(244,154,193,0.12)',
    focus: 'rgba(246,179,37,0.6)', overlay: 'rgba(3,7,15,0.7)', shadow: 'rgba(0,0,0,0.35)',
    error: '#FF8A85', paper: '#111B2D',
  },
};

// Scope administration styling without changing the operational modules.
export function AdminAppearance({ children }) {
  const theme = useTheme();
  const c = { ...theme.c, ...adminPalette[theme.isDark ? 'dark' : 'light'], admin: true, isDark: theme.isDark };
  return <ThemeContext.Provider value={{ ...theme, c }}>{children}</ThemeContext.Provider>;
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
