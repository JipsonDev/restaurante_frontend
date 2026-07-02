import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Sistema de diseno compartido para Morena Mia.
 * Paleta administrativa limpia: blanco, slate y azul profesional.
 */
export const palette = {
  light: {
    bg: '#F6F8FB',
    surface: '#ffffff',
    surfaceAlt: '#F8FAFC',
    soft: '#EEF2F7',
    softer: '#E2E8F0',
    line: '#D8E0EA',
    text: '#0F172A',
    muted: '#475569',
    faint: '#64748B',
    primary: '#2563EB',
    primaryText: '#1D4ED8',
    primarySoft: '#DBEAFE',
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
    bg: '#090E17',
    surface: '#121A2F',
    surfaceAlt: '#102542',
    soft: '#1A243D',
    softer: '#19365c',
    line: '#263554',
    text: '#f8fbff',
    muted: '#94A3B8',
    faint: '#8fa5c3',
    primary: '#60A5FA',
    primaryText: '#93C5FD',
    primarySoft: '#1E3A8A',
    onPrimary: '#FFFFFF',
    accent: '#dcecff',
    accentSoft: '#17365e',
    green: '#34D399',
    greenSoft: '#064E3B',
    amber: '#FBBF24',
    amberSoft: '#451A03',
    red: '#FB7185',
    redSoft: '#450A0A',
    sky: '#b9ddff',
    skySoft: '#12355a',
    shadow: 'rgba(0,0,0,0.65)',
    overlay: 'rgba(3,10,20,0.72)',
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

export const softShadow = (c, level = 1) => {
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


