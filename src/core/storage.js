/**
 * Storage layer.
 *
 * Everything the app persists goes through a small adapter interface so that a
 * future cloud/account backend can be dropped in without touching app logic:
 *
 *   interface StorageAdapter {
 *     get(key): any | null
 *     set(key, value): void
 *     remove(key): void
 *     keys(): string[]
 *   }
 *
 * Today: LocalStorageAdapter (works offline, zero cost, no account).
 * Later: RemoteAdapter that mirrors writes to an API and merges on login.
 */

const NS = 'masar.v1.';

export class MemoryAdapter {
  constructor() { this.map = new Map(); }
  get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  set(key, value) { this.map.set(key, value); }
  remove(key) { this.map.delete(key); }
  keys() { return [...this.map.keys()]; }
}

export class LocalStorageAdapter {
  constructor(ns = NS) { this.ns = ns; }
  get(key) {
    try {
      const raw = localStorage.getItem(this.ns + key);
      return raw === null ? null : JSON.parse(raw);
    } catch { return null; }
  }
  set(key, value) {
    try { localStorage.setItem(this.ns + key, JSON.stringify(value)); return true; }
    catch { return false; } // private mode / quota exceeded — app keeps working in memory
  }
  remove(key) { try { localStorage.removeItem(this.ns + key); } catch { /* ignore */ } }
  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.ns)) out.push(k.slice(this.ns.length));
      }
    } catch { /* ignore */ }
    return out;
  }
}

export function isPersistent() {
  try {
    const k = '__masar_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

export function createAdapter() {
  return isPersistent() ? new LocalStorageAdapter() : new MemoryAdapter();
}
