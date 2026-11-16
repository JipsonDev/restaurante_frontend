export function validateLogin({ mode, correo = '', password = '', pin = '' }) {
  const errors = {};
  if (mode === 'pin') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) errors.correo = 'Elige tu usuario o escribe tu correo.';
    if (!/^\d{4}$/.test(pin)) errors.pin = 'Escribe los 4 dígitos de tu PIN.';
    return errors;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) errors.correo = 'Escribe un correo electrónico válido.';
  if (!password) errors.password = 'Escribe tu contraseña.';
  return errors;
}

export function validatePinSetup(newPin, confirmPin) {
  const errors = {};
  if (!/^\d{4}$/.test(newPin)) errors.newPin = 'El PIN debe tener 4 dígitos.';
  if (newPin !== confirmPin) errors.confirmPin = 'Los PIN no coinciden. Vuelve a confirmarlo.';
  return errors;
}
