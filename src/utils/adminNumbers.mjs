export function adminNumber(value, label, decimals = 2) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`${label}: escribe un número válido mayor o igual a cero.`);
  const number = Number(text), scaled = number * 10 ** decimals;
  if (!Number.isFinite(number) || number > 9999999 || Math.abs(scaled - Math.round(scaled)) > 0.00001) {
    throw new Error(`${label}: usa como máximo ${decimals} decimales y un valor hasta 9999999.`);
  }
  return number;
}
