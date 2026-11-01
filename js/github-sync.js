/**
 * GitHub-Native Live State Synchronization & Offline Queue with AES-256-GCM State Encryption.
 * Encrypts LiveStatePayload when a vault CryptoKey is present so remote live-state.json
 * and local cache never expose plaintext locations or custom milestones.
 */

import { decryptJsonWithKey, encryptJsonWithKey } from './crypto-vault.js';

const LIVE_STATE_STORAGE_KEY = 'trip_countdown_live_state_v2';
const PENDING_SYNC_KEY = 'trip_countdown_pending_sync_v2';

const LEGACY_SYNC_KEY_PATTERN = /_board_(?:live_state|pending_sync)_v\d+$/;

let activeSyncPromise = null;

function purgeLegacySyncKeys() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && LEGACY_SYNC_KEY_PATTERN.test(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

/**
 * Clears all cached live state and pending sync flags from localStorage (called on device lock).
 */
export function clearLocalLiveState() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  purgeLegacySyncKeys();
  try {
    window.localStorage.removeItem(LIVE_STATE_STORAGE_KEY);
    window.localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {}
}

/**
 * Infers { owner, repo, branch, path } automatically when hosted on *.github.io/<repo>/
 * @returns {{ owner: string, repo: string, branch: string, path: string } | null}
 */
export function detectGitHubPagesRepo() {
  if (typeof window === 'undefined' || !window.location) return null;
  const { hostname, pathname } = window.location;
  if (!hostname.endsWith('.github.io')) return null;

  const owner = hostname.replace(/\.github\.io$/, '');
  const segments = pathname.split('/').filter(Boolean);
  const repo = segments[0];
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    branch: 'main',
    path: 'live-state.json'
  };
}

/**
 * Checks whether a parsed JSON object is an AES-256-GCM encrypted state envelope.
 * @param {unknown} obj
 * @returns {obj is { schemaVersion?: number, version?: number, alg: 'AES-256-GCM', updatedAt?: string, iv: string, ciphertext: string }}
 */
function isEncryptedStateEnvelope(obj) {
  return Boolean(
    obj &&
      typeof obj === 'object' &&
      /** @type {any} */ (obj).alg === 'AES-256-GCM' &&
      typeof (/** @type {any} */ (obj).iv) === 'string' &&
      typeof (/** @type {any} */ (obj).ciphertext) === 'string'
  );
}

/**
 * Unwraps a raw state object (either an AES-GCM envelope or plaintext LiveStatePayload).
 * @param {unknown} rawObj
 * @param {CryptoKey | null} [cryptoKey]
 * @returns {Promise<import('./config.js').LiveStatePayload | null>}
 */
async function unwrapStateObject(rawObj, cryptoKey = null) {
  if (!rawObj || typeof rawObj !== 'object') return null;

  if (isEncryptedStateEnvelope(rawObj)) {
    if (!cryptoKey) return null;
    try {
      const decrypted = await decryptJsonWithKey(rawObj, cryptoKey);
      return decrypted && typeof decrypted === 'object' ? decrypted : null;
    } catch {
      return null;
    }
  }

  if (typeof (/** @type {any} */ (rawObj).statusOverrides) === 'object') {
    return /** @type {import('./config.js').LiveStatePayload} */ (rawObj);
  }

  return null;
}

/**
 * Serializes a LiveStatePayload into an AES-256-GCM envelope when `cryptoKey` is available,
 * or returns the raw object when running without a key in local tests.
 * @param {import('./config.js').LiveStatePayload} statePayload
 * @param {CryptoKey | null} [cryptoKey]
 * @returns {Promise<Record<string, unknown>>}
 */
async function wrapStateObject(statePayload, cryptoKey = null) {
  if (!cryptoKey) {
    return statePayload;
  }
  const encrypted = await encryptJsonWithKey(statePayload, cryptoKey);
  return {
    schemaVersion: 2,
    alg: 'AES-256-GCM',
    updatedAt: statePayload.updatedAt,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext
  };
}

/**
 * Reads cached LiveStatePayload from localStorage.
 * @param {CryptoKey | null} [cryptoKey]
 * @returns {Promise<import('./config.js').LiveStatePayload | null>}
 */
export async function readLocalLiveState(cryptoKey = null) {
  if (typeof localStorage === 'undefined') return null;
  purgeLegacySyncKeys();
  const raw = localStorage.getItem(LIVE_STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return await unwrapStateObject(parsed, cryptoKey);
  } catch {
    return null;
  }
}

/**
 * Writes LiveStatePayload (encrypted if cryptoKey is provided) to localStorage.
 * @param {import('./config.js').LiveStatePayload} state
 * @param {boolean} pendingRemoteSync
 * @param {CryptoKey | null} [cryptoKey]
 */
export async function writeLocalLiveState(state, pendingRemoteSync = false, cryptoKey = null) {
  if (typeof localStorage === 'undefined') return;
  purgeLegacySyncKeys();
  const wrapped = await wrapStateObject(state, cryptoKey);
  localStorage.setItem(LIVE_STATE_STORAGE_KEY, JSON.stringify(wrapped));
  if (pendingRemoteSync) {
    localStorage.setItem(PENDING_SYNC_KEY, '1');
  } else {
    localStorage.removeItem(PENDING_SYNC_KEY);
  }
}

/**
 * Checks whether there are unsynced local edits queued while offline.
 * @returns {boolean}
 */
export function hasPendingRemoteSync() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(PENDING_SYNC_KEY) === '1';
}

/**
 * Encodes a UTF-8 string (including Hebrew and emojis) into Base64 for GitHub Contents API.
 * @param {string} str
 * @returns {string}
 */
function encodeUtf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Decodes Base64 from GitHub Contents API into a UTF-8 string.
 * @param {string} b64
 * @returns {string}
 */
function decodeBase64ToUtf8(b64) {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Loads the freshest LiveStatePayload by comparing local cache with remote live-state.json.
 * @param {{ owner: string, repo: string, branch?: string, path?: string } | null} [repoConfig]
 * @param {string | null} [githubToken]
 * @param {CryptoKey | null} [cryptoKey]
 * @returns {Promise<import('./config.js').LiveStatePayload>}
 */
export async function loadLiveState(repoConfig = null, githubToken = null, cryptoKey = null) {
  const fallbackState = {
    schemaVersion: 1,
    updatedAt: '1970-01-01T00:00:00.000Z',
    statusOverrides: {},
    customMilestones: []
  };

  const localState = await readLocalLiveState(cryptoKey);
  let remoteState = null;

  const resolvedRepo = repoConfig || detectGitHubPagesRepo();

  try {
    if (resolvedRepo && githubToken) {
      const apiPath = resolvedRepo.path || 'live-state.json';
      const branch = resolvedRepo.branch || 'main';
      const apiUrl = `https://api.github.com/repos/${resolvedRepo.owner}/${resolvedRepo.repo}/contents/${apiPath}?ref=${encodeURIComponent(branch)}`;
      const res = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${githubToken}`
        },
        cache: 'no-store'
      });
      if (res.ok) {
        const meta = await res.json();
        if (meta && meta.content) {
          const parsedRemote = JSON.parse(decodeBase64ToUtf8(meta.content));
          remoteState = await unwrapStateObject(parsedRemote, cryptoKey);
        }
      }
    }

    if (!remoteState && typeof fetch !== 'undefined') {
      const staticRes = await fetch(`./live-state.json?t=${Date.now()}`, { cache: 'no-store' });
      if (staticRes.ok) {
        const parsedStatic = await staticRes.json();
        remoteState = await unwrapStateObject(parsedStatic, cryptoKey);
      }
    }
  } catch {
    // Offline or local environment without network; fall back cleanly to localState
  }

  if (localState && remoteState) {
    const localTime = Date.parse(localState.updatedAt || '') || 0;
    const remoteTime = Date.parse(remoteState.updatedAt || '') || 0;
    if (localTime >= remoteTime) {
      return localState;
    }
    await writeLocalLiveState(remoteState, false, cryptoKey);
    return remoteState;
  }

  const chosen = localState || remoteState || fallbackState;
  await writeLocalLiveState(chosen, hasPendingRemoteSync(), cryptoKey);
  return chosen;
}

/**
 * Commits LiveStatePayload to GitHub repository's live-state.json via REST API.
 * Encrypts the payload with AES-256-GCM when `cryptoKey` is provided.
 * @param {import('./config.js').LiveStatePayload} statePayload
 * @param {string | null} [githubToken]
 * @param {{ owner: string, repo: string, branch?: string, path?: string } | null} [repoConfig]
 * @param {CryptoKey | null} [cryptoKey]
 * @returns {Promise<{ syncedRemotely: boolean, mode: 'github-api'|'local-only'|'queued-offline', message: string }>}
 */
export async function saveLiveState(
  statePayload,
  githubToken = null,
  repoConfig = null,
  cryptoKey = null
) {
  if (activeSyncPromise) {
    try {
      await activeSyncPromise;
    } catch {}
  }

  const runSave = async () => {
    const stampedPayload = {
      ...statePayload,
      schemaVersion: 1,
      updatedAt: new Date().toISOString()
    };

    const resolvedRepo = repoConfig || detectGitHubPagesRepo();

    if (!githubToken || !resolvedRepo) {
      await writeLocalLiveState(stampedPayload, false, cryptoKey);
      return {
        syncedRemotely: false,
        mode: /** @type {const} */ ('local-only'),
        message: 'Successfully updated'
      };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await writeLocalLiveState(stampedPayload, true, cryptoKey);
      return {
        syncedRemotely: false,
        mode: /** @type {const} */ ('queued-offline'),
        message: 'Saved offline • Queued for sync'
      };
    }

    const apiPath = resolvedRepo.path || 'live-state.json';
    const branch = resolvedRepo.branch || 'main';
    const baseUrl = `https://api.github.com/repos/${resolvedRepo.owner}/${resolvedRepo.repo}/contents/${apiPath}`;
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json'
    };

    try {
      let existingSha = undefined;
      const getRes = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, {
        headers,
        cache: 'no-store'
      });
      if (getRes.ok) {
        const existingData = await getRes.json();
        existingSha = existingData.sha;
      }

      const wireObject = await wrapStateObject(stampedPayload, cryptoKey);
      const serialized = JSON.stringify(wireObject, null, 2) + '\n';
      const putBody = {
        message: `Sync encrypted board state (${stampedPayload.updatedAt.slice(0, 16)})`,
        content: encodeUtf8ToBase64(serialized),
        branch
      };
      if (existingSha) {
        putBody.sha = existingSha;
      }

      const putRes = await fetch(baseUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(putBody)
      });

      if (!putRes.ok) {
        await writeLocalLiveState(stampedPayload, true, cryptoKey);
        return {
          syncedRemotely: false,
          mode: /** @type {const} */ ('queued-offline'),
          message: 'Saved locally'
        };
      }

      await writeLocalLiveState(stampedPayload, false, cryptoKey);
      return {
        syncedRemotely: true,
        mode: /** @type {const} */ ('github-api'),
        message: 'Successfully updated'
      };
    } catch {
      await writeLocalLiveState(stampedPayload, true, cryptoKey);
      return {
        syncedRemotely: false,
        mode: /** @type {const} */ ('queued-offline'),
        message: 'Saved offline • Queued for sync'
      };
    }
  };

  activeSyncPromise = runSave();
  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

/**
 * Registers automatic background flush when device reconnects to the internet.
 * @param {() => { githubToken: string | null, repoConfig: { owner: string, repo: string, branch?: string, path?: string } | null, cryptoKey?: CryptoKey | null }} getCredentials
 * @param {(result: { syncedRemotely: boolean, message: string }) => void} [onSyncComplete]
 */
export function registerOfflineSyncListener(getCredentials, onSyncComplete) {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', async () => {
    if (!hasPendingRemoteSync()) return;
    const { githubToken, repoConfig, cryptoKey = null } = getCredentials();
    const localState = await readLocalLiveState(cryptoKey);
    if (!localState || !githubToken) return;
    const outcome = await saveLiveState(localState, githubToken, repoConfig, cryptoKey);
    if (onSyncComplete) onSyncComplete(outcome);
  });
}
