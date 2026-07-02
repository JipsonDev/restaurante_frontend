import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import axios from 'axios';
import * as safeStorage from '../services/storage';

const ENV_API_HOST = process.env.EXPO_PUBLIC_API_HOST;
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

const BUNDLE_HOST = (() => {
  if (Platform.OS === 'web') return null;
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const match = scriptURL.match(/^[a-z]+:\/\/([^:/]+)/i);
  return match?.[1] || null;
})();

const cleanUrl = (url) => {
  if (!url) return null;
  return url.replace(/\/api\/?$/, '').replace(/\/$/, '');
};

const getApiOrigin = () => {
  if (ENV_API_URL) return cleanUrl(ENV_API_URL);
  if (ENV_API_HOST) return cleanUrl(ENV_API_HOST);

  const localHost = BUNDLE_HOST || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${localHost}:3000`;
};

export const API_ORIGIN = getApiOrigin();
export const BASE_URL = `${API_ORIGIN}/api`;


export const assetUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

axios.interceptors.request.use(
  async (config) => {
    const token = await safeStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await safeStorage.removeItem('token');
      await safeStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await safeStorage.getItem('token');
        const savedUser = await safeStorage.getItem('user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.log('Error restaurando sesion:', e.message);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (correo, password) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { correo, password });
      const { token: tk, user: usr } = res.data;

      if (res.data.requires_pin_setup) {
        return { success: false, requiresPinSetup: true, message: res.data.message || 'Crea tu PIN rapido.', user: usr };
      }

      await safeStorage.setItem('token', tk);
      await safeStorage.setItem('user', JSON.stringify(usr));

      setToken(tk);
      setUser(usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? `No se pudo conectar al backend (${BASE_URL}). Revisa que backend y Expo esten en la misma red.` : 'Credenciales incorrectas');
      return { success: false, message: msg };
    }
  };

  const loginWithPin = async (pin) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login-pin`, { pin });
      const { token: tk, user: usr } = res.data;

      await safeStorage.setItem('token', tk);
      await safeStorage.setItem('user', JSON.stringify(usr));

      setToken(tk);
      setUser(usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? `No se pudo conectar al backend (${BASE_URL}). Revisa que backend y Expo esten en la misma red.` : 'PIN incorrecto');
      return { success: false, message: msg };
    }
  };

  const setupPin = async (correo, password, pin) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/setup-pin`, { correo, password, pin });
      const { token: tk, user: usr } = res.data;

      await safeStorage.setItem('token', tk);
      await safeStorage.setItem('user', JSON.stringify(usr));

      setToken(tk);
      setUser(usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? `No se pudo conectar al backend (${BASE_URL}). Revisa que backend y Expo esten en la misma red.` : 'No se pudo crear el PIN');
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    await safeStorage.removeItem('token');
    await safeStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, loading, login, loginWithPin, setupPin, logout }), [user, token, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
