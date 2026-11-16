export const TEAM_ROLES = Object.freeze(['admin', 'supervisor', 'mesero', 'cocina', 'caja']);

export function teamGroup(role) {
  return role === 'admin' || role === 'supervisor' ? 'administracion' : role;
}

export function teamPayload(form, { editing = false, workers = [], workerId = null, currentUserId = null } = {}) {
  const nombre = String(form.nombre || '').trim();
  const correo = String(form.correo || '').trim().toLowerCase();
  const password = String(form.password || '');
  const pin = String(form.pin || '');
  if (!nombre) throw new Error('Escribe el nombre del trabajador.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Escribe un correo válido.');
  if (!TEAM_ROLES.includes(form.rol)) throw new Error('Selecciona un rol válido.');
  if (!editing && !password) throw new Error('Crea una contraseña para el nuevo usuario.');
  if (password && password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if (pin && !/^\d{4}$/.test(pin)) throw new Error('El PIN rápido debe tener exactamente 4 dígitos.');
  if (workers.some(worker => Number(worker.id) !== Number(workerId) && String(worker.correo || '').trim().toLowerCase() === correo)) {
    throw new Error('Ya existe un usuario con ese correo.');
  }
  if (workerId != null && currentUserId != null && Number(workerId) === Number(currentUserId) && (form.rol !== 'admin' || !form.activo)) {
    throw new Error('No puedes desactivar tu propio usuario ni quitarte el rol de administrador.');
  }
  return {
    nombre, correo, rol: form.rol, activo: form.activo ? 1 : 0,
    ...(password ? { password } : {}),
    ...(pin ? { pin } : form.clearPin ? { pin: '' } : {}),
  };
}
