// Synchronous key/value cache over AsyncStorage (the app's private on-device storage).
// hydrateStorage() loads every key once before the first render; after that reads are
// instant and writes land in memory immediately and on disk in the background.
import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = new Map();

export async function hydrateStorage(keys) {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([key, value]) => {
      if (value != null) cache.set(key, value);
    });
  } catch (e) {
    console.warn('[storage] could not load saved data', e);
  }
}

export const getItem = (key) => (cache.has(key) ? cache.get(key) : null);

export function setItem(key, value) {
  cache.set(key, value);
  return AsyncStorage.setItem(key, value).catch((e) => console.warn('[storage] write failed', e));
}

export function removeItem(key) {
  cache.delete(key);
  return AsyncStorage.removeItem(key).catch(() => {});
}

export function readJSON(key, fallback) {
  try {
    const raw = getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export const writeJSON = (key, value) => setItem(key, JSON.stringify(value));
