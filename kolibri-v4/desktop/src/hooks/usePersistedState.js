import { useCallback, useSyncExternalStore } from "react";

const listenersByKey = new Map();
const snapshotCache = new Map();

function readSnapshot(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    const cached = snapshotCache.get(key);
    if (cached?.raw === raw) return cached.value;
    const value = raw === null ? fallback : JSON.parse(raw);
    snapshotCache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

function subscribeToKey(key, listener) {
  const listeners = listenersByKey.get(key) ?? new Set();
  listeners.add(listener);
  listenersByKey.set(key, listeners);

  const onStorage = event => {
    if (event.key !== key) return;
    snapshotCache.delete(key);
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("storage", onStorage);
    listeners.delete(listener);
    if (listeners.size === 0) listenersByKey.delete(key);
  };
}

export function usePersistedState(key, initialValue) {
  const subscribe = useCallback(listener => subscribeToKey(key, listener), [key]);
  const getSnapshot = useCallback(() => readSnapshot(key, initialValue), [initialValue, key]);
  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(nextValue => {
    const previous = readSnapshot(key, initialValue);
    const next = typeof nextValue === "function" ? nextValue(previous) : nextValue;
    try {
      const raw = JSON.stringify(next);
      window.localStorage.setItem(key, raw);
      snapshotCache.set(key, { raw, value: next });
    } catch {
      // The current session remains usable when storage is unavailable.
    }
    listenersByKey.get(key)?.forEach(listener => listener());
  }, [initialValue, key]);

  return [value, setValue];
}
