// Usuarios que ya iniciaron sesion con contrasena en este equipo. El acceso
// rapido por PIN solo se ofrece para ellos (el PIN se valida contra su correo).
export const KNOWN_USERS_KEY = 'mm:known-users';
export const MAX_KNOWN_USERS = 6;

export function parseKnownUsers(raw) {
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list)
      ? list.filter(user => user && typeof user.correo === 'string' && user.correo.includes('@')).slice(0, MAX_KNOWN_USERS)
      : [];
  } catch {
    return [];
  }
}

export function rememberUser(list, user) {
  const correo = String(user?.correo || '').trim().toLowerCase();
  if (!correo.includes('@')) return list;
  const entry = { correo, nombre: String(user.nombre || correo).slice(0, 80), rol: user.rol || null };
  return [entry, ...list.filter(item => item.correo !== correo)].slice(0, MAX_KNOWN_USERS);
}

export function forgetUser(list, correo) {
  const target = String(correo || '').trim().toLowerCase();
  return list.filter(item => item.correo !== target);
}

export function initials(nombre = '') {
  const parts = String(nombre).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
