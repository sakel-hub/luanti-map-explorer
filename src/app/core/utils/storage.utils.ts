/**
 * Safe LocalStorage accessor utilities that handle SSR/Node environments,
 * disabled cookies/storage, and storage quota exceeded errors gracefully.
 */

const inMemoryFallback = new Map<string, string>();

export function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Storage access denied or disabled
  }
  return inMemoryFallback.get(key) ?? null;
}

export function safeSetItem(key: string, value: string): boolean {
  inMemoryFallback.set(key, value);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return true;
    }
  } catch {
    // Storage access denied or quota exceeded
  }
  return false;
}

export function safeRemoveItem(key: string): boolean {
  inMemoryFallback.delete(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return true;
    }
  } catch {
    // Storage access denied
  }
  return false;
}

export function safeClearStorage(): void {
  inMemoryFallback.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  } catch {
    // Storage access denied
  }
}


