import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  clearCachedVault,
  decryptVault,
  getVaultCryptoKey,
  loadCachedVault,
  unlockAndCacheVault
} from '../js/crypto-vault.js';
import {
  ACTIVE_VAULT_KEY,
  VAULT_DB_NAME,
  VAULT_STORE_NAME,
  loadDecryptedVault,
  loadVaultCacheRecord,
  purgeDecryptedVault
} from '../js/storage-vault.js';
import {
  buildCuratedChapterPhotos,
  buildDefaultTripConfig,
  encryptVaultPayload,
  extractDateLabel,
  runCli
} from '../scripts/encrypt-vault.mjs';

/**
 * Minimal spec-compliant IndexedDB mock for verifying `TripCountdownSecureStorage`
 * and `vault_cache` object store semantics in Node unit tests.
 */
function createMockIndexedDB() {
  const databases = new Map();

  return {
    databases,
    open(dbName, version) {
      const request = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      };

      queueMicrotask(() => {
        let dbEntry = databases.get(dbName);
        const isUpgrade = !dbEntry || dbEntry.version < version;
        if (!dbEntry) {
          dbEntry = {
            name: dbName,
            version,
            stores: new Map()
          };
          databases.set(dbName, dbEntry);
        }

        const dbHandle = {
          objectStoreNames: {
            contains(storeName) {
              return dbEntry.stores.has(storeName);
            }
          },
          createObjectStore(storeName) {
            if (!dbEntry.stores.has(storeName)) {
              dbEntry.stores.set(storeName, new Map());
            }
            return {};
          },
          transaction(storeName) {
            const storeMap = dbEntry.stores.get(storeName) || new Map();
            const tx = {
              oncomplete: null,
              onerror: null,
              objectStore() {
                return {
                  put(record) {
                    storeMap.set(record.key, record);
                  },
                  get(key) {
                    const getReq = { result: undefined, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      getReq.result = storeMap.get(key);
                      if (getReq.onsuccess) getReq.onsuccess();
                    });
                    return getReq;
                  },
                  delete(key) {
                    storeMap.delete(key);
                  }
                };
              }
            };
            queueMicrotask(() => {
              if (tx.oncomplete) tx.oncomplete();
            });
            return tx;
          },
          close() {}
        };

        request.result = dbHandle;
        if (isUpgrade && typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded();
        }
        if (typeof request.onsuccess === 'function') {
          request.onsuccess();
        }
      });

      return request;
    }
  };
}

test('encryptVaultPayload and decryptVault complete a lossless round-trip with tripConfig', async () => {
  const samplePayload = {
    tripConfig: buildDefaultTripConfig(),
    photos: buildCuratedChapterPhotos(),
    githubToken: 'github_pat_sample_token_123',
    githubRepo: {
      owner: 'sample-owner',
      repo: 'trip-countdown',
      branch: 'main',
      path: 'live-state.json'
    },
    generatedAt: '2025-05-01T10:00:00.000Z'
  };

  const envelope = encryptVaultPayload(samplePayload, 'vault-test-passphrase');

  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf, 'PBKDF2-SHA256');
  assert.equal(envelope.iterations, 150000);
  assert.equal(Buffer.from(envelope.salt, 'base64').byteLength, 16);
  assert.equal(Buffer.from(envelope.iv, 'base64').byteLength, 12);
  assert.ok(Buffer.from(envelope.ciphertext, 'base64').byteLength > 16);

  const decryptedFromObject = await decryptVault(envelope, 'vault-test-passphrase');
  assert.deepEqual(decryptedFromObject, samplePayload);

  const cryptoKey = getVaultCryptoKey(decryptedFromObject);
  assert.ok(cryptoKey, 'Decrypted payload should carry non-enumerable CryptoKey in memory');
  assert.equal(cryptoKey.extractable, false, 'Derived CryptoKey must be non-extractable');

  const decryptedFromJsonString = await decryptVault(JSON.stringify(envelope), 'vault-test-passphrase');
  assert.deepEqual(decryptedFromJsonString, samplePayload);
});

test('decryptVault rejects wrong password and tampered ciphertext without leaking partial data', async () => {
  const samplePayload = {
    tripConfig: buildDefaultTripConfig(),
    photos: buildCuratedChapterPhotos(),
    githubToken: null,
    githubRepo: null,
    generatedAt: '2025-05-01T10:00:00.000Z'
  };

  const envelope = encryptVaultPayload(samplePayload, 'correct-horse-battery-staple');

  await assert.rejects(
    () => decryptVault(envelope, 'wrong-password'),
    /Incorrect password or corrupted vault data/
  );

  const cipherBytes = Buffer.from(envelope.ciphertext, 'base64');
  cipherBytes[cipherBytes.length - 1] ^= 0xff;
  const tamperedEnvelope = {
    ...envelope,
    ciphertext: cipherBytes.toString('base64')
  };

  await assert.rejects(
    () => decryptVault(tamperedEnvelope, 'correct-horse-battery-staple'),
    /Incorrect password or corrupted vault data/
  );
});

test('IndexedDB Storage Lifecycle: strips githubToken from stored payload while unwrapping in memory via non-extractable CryptoKey', async () => {
  const previousIndexedDB = globalThis.indexedDB;
  const mockIdb = createMockIndexedDB();
  globalThis.indexedDB = /** @type {any} */ (mockIdb);

  try {
    await purgeDecryptedVault();

    const samplePayload = {
      tripConfig: buildDefaultTripConfig(),
      photos: buildCuratedChapterPhotos().slice(0, 2),
      githubToken: 'github_pat_secret_in_memory_only_999',
      githubRepo: {
        owner: 'sample-owner',
        repo: 'trip-countdown',
        branch: 'main',
        path: 'live-state.json'
      },
      generatedAt: '2025-05-01T10:00:00.000Z'
    };
    const envelope = encryptVaultPayload(samplePayload, 'test-passphrase-idb');

    assert.equal(await loadCachedVault(), null);

    // 1. Unlock with rememberDevice = false -> IndexedDB remains empty
    const unlockedTransient = await unlockAndCacheVault(envelope, 'test-passphrase-idb', false);
    assert.deepEqual(unlockedTransient, samplePayload);
    assert.equal(await loadVaultCacheRecord(), null);
    assert.equal(await loadCachedVault(), null);

    // 2. Unlock with rememberDevice = true -> writes to TripCountdownSecureStorage / vault_cache
    const unlockedRemembered = await unlockAndCacheVault(envelope, 'test-passphrase-idb', true);
    assert.deepEqual(unlockedRemembered, samplePayload);

    // Inspect raw IndexedDB store directly to audit at-rest security
    const rawStore = mockIdb.databases.get(VAULT_DB_NAME)?.stores.get(VAULT_STORE_NAME);
    assert.ok(rawStore, 'IndexedDB database TripCountdownSecureStorage and vault_cache store must exist');
    const rawRecord = rawStore.get(ACTIVE_VAULT_KEY);
    assert.ok(rawRecord, 'active_vault record must exist in vault_cache');
    assert.equal(rawRecord.payload.githubToken, null, 'githubToken MUST be null at rest inside IndexedDB payload');
    assert.ok(rawRecord.payload.tripConfig, 'tripConfig must be persisted in IndexedDB payload');
    assert.equal(rawRecord.payload.photos.length, 2, 'photos must be persisted in IndexedDB payload');
    assert.equal(rawRecord.cryptoKey.extractable, false, 'Stored CryptoKey must be non-extractable');

    // loadDecryptedVault() returns the raw sanitized payload (githubToken === null)
    const sanitizedLoaded = await loadDecryptedVault();
    assert.equal(sanitizedLoaded?.githubToken, null);

    // loadCachedVault() unwraps the encrypted token into volatile RAM using the non-extractable CryptoKey
    const hydratedInRam = await loadCachedVault();
    assert.deepEqual(hydratedInRam, samplePayload);
    assert.equal(hydratedInRam?.githubToken, 'github_pat_secret_in_memory_only_999');

    // 3. Lock / Purge clears IndexedDB completely
    await clearCachedVault();
    assert.equal(await loadCachedVault(), null);
    assert.equal(await loadDecryptedVault(), null);
  } finally {
    globalThis.indexedDB = previousIndexedDB;
  }
});

test('CLI generates vault.json in an isolated temp directory without touching production vault.json', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-cli-test-'));
  const outputVaultPath = path.join(tmpDir, 'vault.json');
  const emptyPhotosDir = path.join(tmpDir, 'empty-photos');

  try {
    runCli(['test-passphrase-123', 'ghp_test_token_abc', 'owner/repo'], {
      repoRootDir: tmpDir,
      photosDir: emptyPhotosDir,
      outputVaultPath,
      optimizeImages: false
    });

    assert.ok(fs.existsSync(outputVaultPath), 'vault.json should be created in temp directory');
    const rawVaultJson = fs.readFileSync(outputVaultPath, 'utf8');
    const parsedEnvelope = JSON.parse(rawVaultJson);

    assert.equal(parsedEnvelope.version, 1);
    assert.equal(parsedEnvelope.kdf, 'PBKDF2-SHA256');
    assert.equal(parsedEnvelope.iterations, 150000);

    const unlockedVault = await decryptVault(rawVaultJson, 'test-passphrase-123');
    assert.ok(unlockedVault.tripConfig, 'Decrypted vault must include tripConfig');
    assert.equal(unlockedVault.githubToken, 'ghp_test_token_abc');
    assert.deepEqual(unlockedVault.githubRepo, {
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: 'live-state.json'
    });
    assert.ok(unlockedVault.photos.length >= 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('extractDateLabel extracts and formats filenames strictly as DD-MM-YYYY', () => {
  assert.equal(extractDateLabel('15-08-2026.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('15.08.2026.png'), '15-08-2026');
  assert.equal(extractDateLabel('15_08_2026.jpeg'), '15-08-2026');
  assert.equal(extractDateLabel('2026-08-15.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('2026.08.15.webp'), '15-08-2026');
  assert.equal(extractDateLabel('15-08-26.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('15.08.26.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('20260815.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('IMG_20260815_123456.jpg'), '15-08-2026');
  assert.equal(extractDateLabel('15082026.jpg'), '15-08-2026');
});
