import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import axios from 'axios';
import { isOwnApiRequest, shouldExpireSession } from '../utils/sessionLogic.mjs';
import * as safeStorage from '../services/storage';
import { KNOWN_USERS_KEY, forgetUser, parseKnownUsers, rememberUser } from '../utils/knownUsers.mjs';

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
    if (token && isOwnApiRequest(config, BASE_URL)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Avisos de cambio de sesion (login/logout). realtime.js se suscribe para
// cerrar el socket del usuario anterior; asi evitamos un import circular.
const sessionListeners = new Set();
export function onSessionChange(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
const notifySessionChange = () => sessionListeners.forEach(listener => { try { listener(); } catch {} });

// Serialize session writes so a late 401 cannot erase a newer login.
let sessionWrites = Promise.resolve();
const writeSession = operation => {
  sessionWrites = sessionWrites.catch(() => {}).then(operation);
  return sessionWrites;
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [knownUsers, setKnownUsers] = useState([]);
  const tokenRef = useRef(null);
  tokenRef.current = token;

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(response => response, async error => {
      if (shouldExpireSession(error, tokenRef.current, BASE_URL)) {
        const failedToken = tokenRef.current;
        await writeSession(async () => {
          if (await safeStorage.getItem('token') !== failedToken) return;
          await safeStorage.removeItem('token');
          await safeStorage.removeItem('user');
          if (tokenRef.current === failedToken) {
            tokenRef.current = null;
            setToken(null);
            setUser(null);
          }
        });
      }
      return Promise.reject(error);
    });
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

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
    safeStorage.getItem(KNOWN_USERS_KEY).then(raw => setKnownUsers(parseKnownUsers(raw))).catch(() => {});
  }, []);

  const saveKnownUsers = async (update) => {
    const current = parseKnownUsers(await safeStorage.getItem(KNOWN_USERS_KEY));
    const next = update(current);
    await safeStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(next));
    setKnownUsers(next);
  };

  const startSession = async (tk, usr) => {
    await writeSession(async () => {
      await safeStorage.setItem('token', tk);
      await safeStorage.setItem('user', JSON.stringify(usr));
    });
    tokenRef.current = tk;
    notifySessionChange();
    await saveKnownUsers(list => rememberUser(list, usr)).catch(() => {});
    setToken(tk);
    setUser(usr);
  };

  const forgetKnownUser = (correo) => saveKnownUsers(list => forgetUser(list, correo)).catch(() => {});

  const login = async (correo, password) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, { correo, password }, { timeout: 15000 });
      const { token: tk, user: usr } = res.data;

      if (res.data.requires_pin_setup) {
        return { success: false, requiresPinSetup: true, message: res.data.message || 'Crea tu PIN rapido.', user: usr };
      }

      await startSession(tk, usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? 'No se pudo conectar. Comprueba tu conexión y avisa al administrador si el problema continúa.' : 'No se pudo iniciar sesión. Inténtalo otra vez.');
      return { success: false, message: msg };
    }
  };

  const loginWithPin = async (correo, pin) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login-pin`, { correo, pin }, { timeout: 15000 });
      const { token: tk, user: usr } = res.data;

      await startSession(tk, usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? 'No se pudo conectar. Comprueba tu conexión y avisa al administrador si el problema continúa.' : 'No se pudo iniciar sesión. Inténtalo otra vez.');
      return { success: false, message: msg };
    }
  };

  const setupPin = async (correo, password, pin) => {
    try {
      const res = await axios.post(`${BASE_URL}/auth/setup-pin`, { correo, password, pin }, { timeout: 15000 });
      const { token: tk, user: usr } = res.data;

      await startSession(tk, usr);
      return { success: true };
    } catch (e) {
      const msg = e.response?.data?.message
        || (e.request ? 'No se pudo conectar. Comprueba tu conexión y avisa al administrador si el problema continúa.' : 'No se pudo crear el PIN. Inténtalo otra vez.');
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    // Antes de borrar la sesión: este teléfono deja de recibir los avisos de esta persona.
    // (require dentro de la función: webPushClient también importa este archivo)
    if (Platform.OS === 'web') { try { await require('../services/webPushClient').disableWebPush(); } catch { /* sin avisos activos */ } }
    await writeSession(async () => {
      await safeStorage.removeItem('token');
      await safeStorage.removeItem('user');
    });
    tokenRef.current = null;
    notifySessionChange();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, loading, knownUsers, login, loginWithPin, setupPin, logout, forgetKnownUser }), [user, token, loading, knownUsers]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
