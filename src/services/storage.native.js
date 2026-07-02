import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = {};

export async function getItem(key) {
  try {
    const value = await AsyncStorage.getItem(key).catch(() => null);
    return value ?? (memoryStore[key] || null);
  } catch {
    return memoryStore[key] || null;
  }
}

export async function setItem(key, value) {
  memoryStore[key] = value;
  try {
    await AsyncStorage.setItem(key, value).catch(() => {});
  } catch {
    console.warn('Fallback a memoria activado (Error de storage nativo)');
  }
}

export async function removeItem(key) {
  delete memoryStore[key];
  try {
    await AsyncStorage.removeItem(key).catch(() => {});
  } catch {}
}
