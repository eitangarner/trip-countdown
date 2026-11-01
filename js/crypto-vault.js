/**
 * Browser & Node 20+ Web Crypto (`crypto.subtle`) Vault Decryption & Key Management.
 * Shares the canonical AES-256-GCM + PBKDF2-SHA256 wire contract with `scripts/encrypt-vault.mjs`.
 */

import {
  loadVaultCacheRecord,
  purgeDecryptedVault,
  saveDecryptedVault
} from './storage-vault.js';

const EXPECTED_VERSION = 1;
const EXPECTED_KDF = 'PBKDF2-SHA256';
const DEFAULT_ITERATIONS = 150_000;
const AUTH_TAG_BIT_LENGTH = 128;
const IV_BYTE_LENGTH = 12;

const VAULT_CRYPTO_KEY_SYMBOL = Symbol.for('tripCountdown.vaultCryptoKey');

/**
 * Attaches a non-enumerable CryptoKey reference to a decrypted object so `assert.deepEqual`
 * and JSON serialization ignore it while runtime modules can retrieve the key in memory.
 * @param {object} target
 * @param {CryptoKey | null} cryptoKey
 */
export function attachVaultCryptoKey(target, cryptoKey) {
  if (!target || typeof target !== 'object' || !cryptoKey) return;
  Object.defineProperty(target, VAULT_CRYPTO_KEY_SYMBOL, {
    value: cryptoKey,
    enumerable: false,
    writable: true,
    configurable: true
  });
}

/**
 * Retrieves the in-memory non-extractable CryptoKey associated with an unlocked VaultPayload.
 * @param {unknown} target
 * @returns {CryptoKey | null}
 */
export function getVaultCryptoKey(target) {
  if (!target || typeof target !== 'object') return null;
  return /** @type {any} */ (target)[VAULT_CRYPTO_KEY_SYMBOL] ?? null;
}

/**
 * Encodes a Uint8Array into a standard Base64 string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function encodeBytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return globalThis.btoa(binary);
}

/**
 * Decodes a standard Base64 string into a Uint8Array across browser and Node 20+ environments.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function decodeBase64ToBytes(base64String) {
  if (typeof base64String !== 'string' || base64String.length === 0) {
    throw new Error('Invalid base64 field in encrypted vault.');
  }
  const trimmed = base64String.trim();
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(trimmed, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(trimmed);
  }
  const binaryString = globalThis.atob(trimmed);
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
 * Derives a non-extractable AES-256-GCM CryptoKey using PBKDF2-SHA256.
 * @param {string} password
 * @param {Uint8Array} saltBytes
 * @param {number} [iterations=150000]
 * @returns {Promise<CryptoKey>}
 */
export async function deriveVaultCryptoKey(password, saltBytes, iterations = DEFAULT_ITERATIONS) {
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

  return subtle.deriveKey(
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
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary JSON-serializable object with a non-extractable AES-256-GCM CryptoKey.
 * @param {unknown} dataObj
 * @param {CryptoKey} aesKey
 * @returns {Promise<{ version: 1, alg: 'AES-256-GCM', iv: string, ciphertext: string }>}
 */
export async function encryptJsonWithKey(dataObj, aesKey) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || !aesKey) {
    throw new Error('Valid CryptoKey is required for AES-GCM encryption.');
  }
  const ivBytes = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
  const plaintextBytes = new TextEncoder().encode(JSON.stringify(dataObj));
  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      tagLength: AUTH_TAG_BIT_LENGTH
    },
    aesKey,
    plaintextBytes
  );

  return {
    version: 1,
    alg: 'AES-256-GCM',
    iv: encodeBytesToBase64(ivBytes),
    ciphertext: encodeBytesToBase64(new Uint8Array(encryptedBuffer))
  };
}

/**
 * Decrypts an AES-256-GCM encrypted JSON envelope using an in-memory CryptoKey.
 * @param {{ iv: string, ciphertext: string }} envelope
 * @param {CryptoKey} aesKey
 * @returns {Promise<any>}
 */
export async function decryptJsonWithKey(envelope, aesKey) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || !aesKey) {
    throw new Error('Valid CryptoKey is required for AES-GCM decryption.');
  }
  const ivBytes = decodeBase64ToBytes(envelope.iv);
  const ciphertextBytes = decodeBase64ToBytes(envelope.ciphertext);
  const plaintextBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      tagLength: AUTH_TAG_BIT_LENGTH
    },
    aesKey,
    ciphertextBytes
  );
  return JSON.parse(new TextDecoder().decode(plaintextBuffer));
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

  const aesKey = await deriveVaultCryptoKey(password, saltBytes, iterations);

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
  const payload = assertValidVaultPayload(JSON.parse(decodedJson));
  attachVaultCryptoKey(payload, aesKey);
  return payload;
}

/**
 * Decrypts the vault and, if `rememberDevice` is true, persists the sanitized payload
 * (with `githubToken` stripped) to IndexedDB (`TripCountdownSecureStorage`) alongside
 * the non-extractable `CryptoKey` and AES-GCM wrapped secret envelope.
 *
 * @param {string | Record<string, unknown>} encryptedVaultJson
 * @param {string} password
 * @param {boolean} [rememberDevice=false]
 * @returns {Promise<import('./config.js').VaultPayload>}
 */
export async function unlockAndCacheVault(encryptedVaultJson, password, rememberDevice = false) {
  const payload = await decryptVault(encryptedVaultJson, password);

  if (rememberDevice) {
    try {
      const aesKey = getVaultCryptoKey(payload);
      let wrappedSecrets = null;
      if (aesKey && payload.githubToken) {
        wrappedSecrets = await encryptJsonWithKey({ githubToken: payload.githubToken }, aesKey);
      }
      await saveDecryptedVault(payload, {
        cryptoKey: aesKey,
        encryptedEnvelope: wrappedSecrets
      });
    } catch {
      // Allow in-memory unlock even if IndexedDB is blocked in private browsing
    }
  }

  return payload;
}

/**
 * Loads the cached `VaultPayload` from IndexedDB (`TripCountdownSecureStorage`) if remembered.
 * Unwraps `githubToken` in volatile memory using the non-extractable `CryptoKey` while keeping
 * `githubToken: null` at rest inside `record.payload`.
 *
 * @returns {Promise<import('./config.js').VaultPayload | null>}
 */
export async function loadCachedVault() {
  const record = await loadVaultCacheRecord();
  if (!record || !record.payload) {
    return null;
  }

  try {
    const payload = assertValidVaultPayload(record.payload);
    let restoredToken = null;

    if (record.cryptoKey && record.encryptedEnvelope) {
      try {
        const unwrapped = await decryptJsonWithKey(
          /** @type {{ iv: string, ciphertext: string }} */ (record.encryptedEnvelope),
          record.cryptoKey
        );
        if (unwrapped && typeof unwrapped.githubToken === 'string') {
          restoredToken = unwrapped.githubToken;
        }
      } catch {
        restoredToken = null;
      }
    }

    const hydratedPayload = {
      ...payload,
      githubToken: restoredToken
    };
    attachVaultCryptoKey(hydratedPayload, record.cryptoKey ?? null);
    return hydratedPayload;
  } catch {
    await purgeDecryptedVault();
    return null;
  }
}

/**
 * Clears the cached vault from IndexedDB and purges any legacy localStorage entries.
 * @returns {Promise<void>}
 */
export async function clearCachedVault() {
  await purgeDecryptedVault();
}
