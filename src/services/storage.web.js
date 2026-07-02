const memoryStore = {};

export async function getItem(key) {
  if (typeof window === 'undefined') return memoryStore[key] || null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore[key] || null;
  }
}

export async function setItem(key, value) {
  memoryStore[key] = value;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

export async function removeItem(key) {
  delete memoryStore[key];
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
