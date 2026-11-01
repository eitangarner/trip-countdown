/**
 * Browser & Node 20+ Web Crypto (`crypto.subtle`) vault decryption and device-remember cache.
 * Shares the canonical AES-256-GCM + PBKDF2-SHA256 wire contract with `scripts/encrypt-vault.mjs`.
 */

export const VAULT_CACHE_STORAGE_KEY = 'shoval_board_vault_cache_v3';

const EXPECTED_VERSION = 1;
const EXPECTED_KDF = 'PBKDF2-SHA256';
const DEFAULT_ITERATIONS = 150_000;
const AUTH_TAG_BIT_LENGTH = 128;

/**
 * Decodes a standard base64 string into a Uint8Array across browser and Node 20+ environments.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function decodeBase64ToBytes(base64String) {
  if (typeof base64String !== 'string' || base64String.length === 0) {
    throw new Error('Invalid base64 field in encrypted vault.');
  }
  const binaryString = globalThis.atob(base64String.trim());
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Normalizes an input envelope (parsed object or JSON string) and validates required wire fields.
 * @param {string | Record<string, unknown>} encryptedVaultJson
 * @returns {{
 *   version: number,
 *   kdf: string,
 *   iterations: number,
 *   saltBytes: Uint8Array,
 *   ivBytes: Uint8Array,
 *   ciphertextBytes: Uint8Array
 * }}
 */
function parseEncryptedVaultEnvelope(encryptedVaultJson) {
  const envelope =
    typeof encryptedVaultJson === 'string'
      ? JSON.parse(encryptedVaultJson)
      : encryptedVaultJson;

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Encrypted vault envelope is missing or malformed.');
  }

  if (envelope.version !== EXPECTED_VERSION || envelope.kdf !== EXPECTED_KDF) {
    throw new Error(
      `Unsupported vault format (version: ${String(envelope.version)}, kdf: ${String(envelope.kdf)}).`
    );
  }

  const iterations =
    typeof envelope.iterations === 'number' && envelope.iterations > 0
      ? envelope.iterations
      : DEFAULT_ITERATIONS;

  const saltBytes = decodeBase64ToBytes(/** @type {string} */ (envelope.salt));
  const ivBytes = decodeBase64ToBytes(/** @type {string} */ (envelope.iv));
  const ciphertextBytes = decodeBase64ToBytes(/** @type {string} */ (envelope.ciphertext));

  if (saltBytes.byteLength !== 16) {
    throw new Error('Invalid salt length in encrypted vault (expected 16 bytes).');
  }
  if (ivBytes.byteLength !== 12) {
    throw new Error('Invalid IV length in encrypted vault (expected 12 bytes).');
  }
  if (ciphertextBytes.byteLength <= 16) {
    throw new Error('Encrypted vault ciphertext is truncated or missing GCM authentication tag.');
  }

  return {
    version: envelope.version,
    kdf: envelope.kdf,
    iterations,
    saltBytes,
    ivBytes,
    ciphertextBytes
  };
}

/**
 * Validates that a parsed object conforms to the VaultPayload contract in `js/config.js`.
 * @param {unknown} candidate
 * @returns {import('./config.js').VaultPayload}
 */
function assertValidVaultPayload(candidate) {
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !Array.isArray(/** @type {import('./config.js').VaultPayload} */ (candidate).photos)
  ) {
    throw new Error('Decrypted vault payload is missing a valid photos array.');
  }
  return /** @type {import('./config.js').VaultPayload} */ (candidate);
}

/**
 * Derives the AES-256-GCM key via PBKDF2-SHA256 (`150000` iterations) and decrypts `vault.json`
 * into a `VaultPayload` object.
 *
 * @param {string | Record<string, unknown>} encryptedVaultJson
 * @param {string} password
 * @returns {Promise<import('./config.js').VaultPayload>}
 */
export async function decryptVault(encryptedVaultJson, password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password is required to unlock the vault.');
  }

  const { iterations, saltBytes, ivBytes, ciphertextBytes } =
    parseEncryptedVaultEnvelope(encryptedVaultJson);

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable in this environment.');
  }

  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['decrypt']
  );

  let plaintextBuffer;
  try {
    plaintextBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: AUTH_TAG_BIT_LENGTH
      },
      aesKey,
      ciphertextBytes
    );
  } catch {
    throw new Error('Incorrect password or corrupted vault data.');
  }

  const decoder = new TextDecoder();
  const decodedJson = decoder.decode(plaintextBuffer);
  return assertValidVaultPayload(JSON.parse(decodedJson));
}

/**
 * Decrypts the vault and, if `rememberDevice` is true, caches the decrypted `VaultPayload`
 * in `localStorage` under `shoval_board_vault_cache_v1`.
 *
 * @param {string | Record<string, unknown>} encryptedVaultJson
 * @param {string} password
 * @param {boolean} [rememberDevice=false]
 * @returns {Promise<import('./config.js').VaultPayload>}
 */
export async function unlockAndCacheVault(encryptedVaultJson, password, rememberDevice = false) {
  const payload = await decryptVault(encryptedVaultJson, password);

  if (rememberDevice && globalThis.localStorage) {
    try {
      globalThis.localStorage.setItem(VAULT_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors so unlock still succeeds in memory
    }
  }

  return payload;
}

/**
 * Loads the cached `VaultPayload` from `localStorage` if previously remembered on this device.
 *
 * @returns {import('./config.js').VaultPayload | null}
 */
export function loadCachedVault() {
  if (!globalThis.localStorage) {
    return null;
  }

  const serialized = globalThis.localStorage.getItem(VAULT_CACHE_STORAGE_KEY);
  if (!serialized) {
    return null;
  }

  try {
    return assertValidVaultPayload(JSON.parse(serialized));
  } catch {
    globalThis.localStorage.removeItem(VAULT_CACHE_STORAGE_KEY);
    return null;
  }
}

/**
 * Clears the cached `VaultPayload` from `localStorage` ("Lock / Forget Device").
 */
export function clearCachedVault() {
  if (!globalThis.localStorage) {
    return;
  }
  globalThis.localStorage.removeItem(VAULT_CACHE_STORAGE_KEY);
}
