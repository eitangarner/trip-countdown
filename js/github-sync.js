/**
 * GitHub-Native Live State Synchronization & Offline Queue.
 * Persists mobile Edit Mode updates to localStorage immediately and syncs to live-state.json via GitHub REST API.
 */

const LIVE_STATE_STORAGE_KEY = 'shoval_board_live_state_v1';
const PENDING_SYNC_KEY = 'shoval_board_pending_sync_v1';

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
 * Reads cached LiveStatePayload from localStorage.
 * @returns {import('./config.js').LiveStatePayload | null}
 */
export function readLocalLiveState() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LIVE_STATE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Writes LiveStatePayload to localStorage.
 * @param {import('./config.js').LiveStatePayload} state
 * @param {boolean} pendingRemoteSync
 */
export function writeLocalLiveState(state, pendingRemoteSync = false) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LIVE_STATE_STORAGE_KEY, JSON.stringify(state));
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
 * @returns {Promise<import('./config.js').LiveStatePayload>}
 */
export async function loadLiveState(repoConfig = null, githubToken = null) {
  const fallbackState = {
    schemaVersion: 1,
    updatedAt: '2026-10-31T00:00:00.000Z',
    statusOverrides: {},
    customMilestones: []
  };

  const localState = readLocalLiveState();
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
          remoteState = JSON.parse(decodeBase64ToUtf8(meta.content));
        }
      }
    }

    if (!remoteState && typeof fetch !== 'undefined') {
      const staticRes = await fetch(`./live-state.json?t=${Date.now()}`, { cache: 'no-store' });
      if (staticRes.ok) {
        remoteState = await staticRes.json();
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
    writeLocalLiveState(remoteState, false);
    return remoteState;
  }

  const chosen = localState || remoteState || fallbackState;
  writeLocalLiveState(chosen, hasPendingRemoteSync());
  return chosen;
}

/**
 * Commits LiveStatePayload to GitHub repository's live-state.json via REST API.
 * Queues in localStorage if offline or if no token is present.
 * @param {import('./config.js').LiveStatePayload} statePayload
 * @param {string | null} [githubToken]
 * @param {{ owner: string, repo: string, branch?: string, path?: string } | null} [repoConfig]
 * @returns {Promise<{ syncedRemotely: boolean, mode: 'github-api'|'local-only'|'queued-offline', message: string }>}
 */
export async function saveLiveState(statePayload, githubToken = null, repoConfig = null) {
  const stampedPayload = {
    ...statePayload,
    schemaVersion: 1,
    updatedAt: new Date().toISOString()
  };

  const resolvedRepo = repoConfig || detectGitHubPagesRepo();

  if (!githubToken || !resolvedRepo) {
    writeLocalLiveState(stampedPayload, false);
    return {
      syncedRemotely: false,
      mode: 'local-only',
      message: 'Saved on this device'
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    writeLocalLiveState(stampedPayload, true);
    return {
      syncedRemotely: false,
      mode: 'queued-offline',
      message: 'Saved offline • Will sync to GitHub when back online'
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

    const serialized = JSON.stringify(stampedPayload, null, 2) + '\n';
    const putBody = {
      message: `Update live board state (${stampedPayload.updatedAt.slice(0, 16)})`,
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
      writeLocalLiveState(stampedPayload, true);
      return {
        syncedRemotely: false,
        mode: 'queued-offline',
        message: `Saved locally (GitHub sync HTTP ${putRes.status})`
      };
    }

    writeLocalLiveState(stampedPayload, false);
    return {
      syncedRemotely: true,
      mode: 'github-api',
      message: 'Synced to both phones via GitHub ✨'
    };
  } catch {
    writeLocalLiveState(stampedPayload, true);
    return {
      syncedRemotely: false,
      mode: 'queued-offline',
      message: 'Saved offline • Queued for sync'
    };
  }
}

/**
 * Registers automatic background flush when device reconnects to the internet.
 * @param {() => { githubToken: string | null, repoConfig: { owner: string, repo: string, branch?: string, path?: string } | null }} getCredentials
 * @param {(result: { syncedRemotely: boolean, message: string }) => void} [onSyncComplete]
 */
export function registerOfflineSyncListener(getCredentials, onSyncComplete) {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', async () => {
    if (!hasPendingRemoteSync()) return;
    const localState = readLocalLiveState();
    const { githubToken, repoConfig } = getCredentials();
    if (!localState || !githubToken) return;
    const outcome = await saveLiveState(localState, githubToken, repoConfig);
    if (onSyncComplete) onSyncComplete(outcome);
  });
}
