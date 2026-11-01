/**
 * IndexedDB Storage Adapter for Vault Persistence (`TripCountdownSecureStorage`).
 * Enforces that `githubToken` is stripped from any stored payload object while optionally
 * retaining a non-extractable Web Crypto `CryptoKey` + AES-GCM wrapped secret so remembered
 * devices can restore in-memory sync capabilities without ever writing cleartext tokens to disk.
 */

export const VAULT_DB_NAME = 'TripCountdownSecureStorage';
export const VAULT_DB_VERSION = 1;
export const VAULT_STORE_NAME = 'vault_cache';
export const ACTIVE_VAULT_KEY = 'active_vault';

const LEGACY_STORAGE_KEY_PATTERN = /(?:_board_vault_cache_v\d+|trip_countdown_vault_cache_v1)$/;

/**
 * In-memory fallback map used only in headless Node test environments where `indexedDB` is absent.
 * @type {Map<string, Record<string, unknown>>}
 */
const memoryFallbackStore = new Map();

/**
 * Removes any legacy localStorage vault cache entries.
 */
export function purgeLegacyLocalStorageVault() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && LEGACY_STORAGE_KEY_PATTERN.test(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Returns a deep clone of `VaultPayload` with `githubToken` strictly stripped (`null`).
 * @param {import('./config.js').VaultPayload} payload
 * @returns {import('./config.js').VaultPayload}
 */
export function sanitizeVaultPayloadForStorage(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Cannot sanitize malformed vault payload.');
  }
  const clonedPhotos = Array.isArray(payload.photos)
    ? payload.photos.map((photo) => ({
        id: photo.id,
        dataUrl: photo.dataUrl,
        caption: photo.caption || '',
        dateLabel: photo.dateLabel || '',
        palette: photo.palette ? { ...photo.palette } : null
      }))
    : [];

  const clonedTripConfig = payload.tripConfig
    ? JSON.parse(JSON.stringify(payload.tripConfig))
    : undefined;

  const clonedRepo = payload.githubRepo
    ? { ...payload.githubRepo }
    : null;

  return {
    ...(clonedTripConfig ? { tripConfig: clonedTripConfig } : {}),
    photos: clonedPhotos,
    githubToken: null,
    githubRepo: clonedRepo,
    generatedAt: payload.generatedAt || new Date().toISOString()
  };
}

/**
 * Opens the `TripCountdownSecureStorage` IndexedDB database.
 * @returns {Promise<IDBDatabase | null>}
 */
function openVaultDatabase() {
  if (typeof globalThis.indexedDB === 'undefined' || !globalThis.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    try {
      const request = globalThis.indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
          db.createObjectStore(VAULT_STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Atomically persists the sanitized vault payload (with `githubToken` stripped) and optional
 * non-extractable `CryptoKey` + encrypted envelope into IndexedDB (`TripCountdownSecureStorage`).
 *
 * @param {import('./config.js').VaultPayload} payload
 * @param {{
 *   cryptoKey?: CryptoKey | null,
 *   encryptedEnvelope?: Record<string, unknown> | null
 * }} [cryptoContext]
 * @returns {Promise<{
 *   key: string,
 *   payload: import('./config.js').VaultPayload,
 *   cachedAt: number
 * }>}
 */
export async function saveDecryptedVault(payload, cryptoContext = {}) {
  purgeLegacyLocalStorageVault();

  const decryptedVaultWithoutSecrets = sanitizeVaultPayloadForStorage(payload);
  const record = {
    key: ACTIVE_VAULT_KEY,
    payload: decryptedVaultWithoutSecrets,
    cryptoKey: cryptoContext.cryptoKey ?? null,
    encryptedEnvelope: cryptoContext.encryptedEnvelope ?? null,
    cachedAt: Date.now()
  };

  const db = await openVaultDatabase();
  if (!db) {
    memoryFallbackStore.set(ACTIVE_VAULT_KEY, record);
    return {
      key: record.key,
      payload: record.payload,
      cachedAt: record.cachedAt
    };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(VAULT_STORE_NAME);
    store.put(record);

    tx.oncomplete = () => {
      db.close();
      resolve({
        key: record.key,
        payload: record.payload,
        cachedAt: record.cachedAt
      });
    };

    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB transaction failed during saveDecryptedVault.'));
    };
  });
}

/**
 * Loads the raw cached record (`{ key, payload, cryptoKey, encryptedEnvelope, cachedAt }`) from IndexedDB.
 * @returns {Promise<{
 *   key: string,
 *   payload: import('./config.js').VaultPayload,
 *   cryptoKey: CryptoKey | null,
 *   encryptedEnvelope: Record<string, unknown> | null,
 *   cachedAt: number
 * } | null>}
 */
export async function loadVaultCacheRecord() {
  purgeLegacyLocalStorageVault();

  const db = await openVaultDatabase();
  if (!db) {
    const fallbackRecord = memoryFallbackStore.get(ACTIVE_VAULT_KEY);
    return fallbackRecord ? /** @type {any} */ (fallbackRecord) : null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(VAULT_STORE_NAME, 'readonly');
      const store = tx.objectStore(VAULT_STORE_NAME);
      const getReq = store.get(ACTIVE_VAULT_KEY);

      getReq.onsuccess = () => {
        db.close();
        const result = getReq.result;
        if (!result || typeof result !== 'object' || !result.payload) {
          resolve(null);
          return;
        }
        resolve(result);
      };

      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

/**
 * Loads the sanitized `VaultPayload` from IndexedDB (`githubToken` is always `null` on the stored payload).
 * @returns {Promise<import('./config.js').VaultPayload | null>}
 */
export async function loadDecryptedVault() {
  const record = await loadVaultCacheRecord();
  if (!record || !record.payload) {
    return null;
  }
  return sanitizeVaultPayloadForStorage(record.payload);
}

/**
 * Atomically purges the cached vault record from IndexedDB and clears legacy localStorage entries.
 * @returns {Promise<void>}
 */
export async function purgeDecryptedVault() {
  purgeLegacyLocalStorageVault();
  memoryFallbackStore.clear();

  const db = await openVaultDatabase();
  if (!db) {
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(VAULT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(VAULT_STORE_NAME);
      store.delete(ACTIVE_VAULT_KEY);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
