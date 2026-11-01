import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VAULT_CACHE_STORAGE_KEY,
  clearCachedVault,
  decryptVault,
  loadCachedVault,
  unlockAndCacheVault
} from '../js/crypto-vault.js';
import {
  buildCuratedChapterPhotos,
  encryptVaultPayload,
  extractDateLabel,
  runCli
} from '../scripts/encrypt-vault.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const VAULT_JSON_PATH = path.join(REPO_ROOT, 'vault.json');

/**
 * Minimal in-memory Storage mock for Node test runner.
 */
function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

test('encryptVaultPayload and decryptVault complete a lossless round-trip', async () => {
  const samplePayload = {
    photos: buildCuratedChapterPhotos(),
    githubToken: 'github_pat_sample_token_123',
    githubRepo: {
      owner: 'eitangarner',
      repo: 'shoval-countdown-board',
      branch: 'main',
      path: 'live-state.json'
    },
    generatedAt: '2026-10-31T10:00:00.000Z'
  };

  const envelope = encryptVaultPayload(samplePayload, 'shoval');

  assert.equal(envelope.version, 1);
  assert.equal(envelope.kdf, 'PBKDF2-SHA256');
  assert.equal(envelope.iterations, 150000);
  assert.equal(Buffer.from(envelope.salt, 'base64').byteLength, 16);
  assert.equal(Buffer.from(envelope.iv, 'base64').byteLength, 12);
  assert.ok(Buffer.from(envelope.ciphertext, 'base64').byteLength > 16);

  const decryptedFromObject = await decryptVault(envelope, 'shoval');
  assert.deepEqual(decryptedFromObject, samplePayload);

  const decryptedFromJsonString = await decryptVault(JSON.stringify(envelope), 'shoval');
  assert.deepEqual(decryptedFromJsonString, samplePayload);
});

test('decryptVault rejects wrong password and tampered ciphertext', async () => {
  const samplePayload = {
    photos: buildCuratedChapterPhotos(),
    githubToken: null,
    githubRepo: null,
    generatedAt: '2026-10-31T10:00:00.000Z'
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

test('unlockAndCacheVault, loadCachedVault, and clearCachedVault manage localStorage state', async () => {
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createMockLocalStorage();

  try {
    const samplePayload = {
      photos: buildCuratedChapterPhotos().slice(0, 2),
      githubToken: null,
      githubRepo: null,
      generatedAt: '2026-10-31T10:00:00.000Z'
    };
    const envelope = encryptVaultPayload(samplePayload, 'shoval');

    assert.equal(loadCachedVault(), null);

    // Unlock without rememberDevice -> should not persist to localStorage
    const unlockedTransient = await unlockAndCacheVault(envelope, 'shoval', false);
    assert.deepEqual(unlockedTransient, samplePayload);
    assert.equal(globalThis.localStorage.getItem(VAULT_CACHE_STORAGE_KEY), null);
    assert.equal(loadCachedVault(), null);

    // Unlock with rememberDevice = true -> persists and reloads from localStorage
    const unlockedRemembered = await unlockAndCacheVault(envelope, 'shoval', true);
    assert.deepEqual(unlockedRemembered, samplePayload);
    assert.ok(globalThis.localStorage.getItem(VAULT_CACHE_STORAGE_KEY));
    assert.deepEqual(loadCachedVault(), samplePayload);

    // Forget device clears cache
    clearCachedVault();
    assert.equal(loadCachedVault(), null);
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
});

test('CLI generates vault.json with password and curated chapter illustrations', async () => {
  const existingBackup = fs.existsSync(VAULT_JSON_PATH)
    ? fs.readFileSync(VAULT_JSON_PATH, 'utf8')
    : null;

  try {
    runCli(['test-passphrase-123']);

    assert.ok(fs.existsSync(VAULT_JSON_PATH), 'vault.json should exist in repository root');
    const rawVaultJson = fs.readFileSync(VAULT_JSON_PATH, 'utf8');
    const parsedEnvelope = JSON.parse(rawVaultJson);

    assert.equal(parsedEnvelope.version, 1);
    assert.equal(parsedEnvelope.kdf, 'PBKDF2-SHA256');
    assert.equal(parsedEnvelope.iterations, 150000);

    const unlockedVault = await decryptVault(rawVaultJson, 'test-passphrase-123');
    assert.ok(unlockedVault.photos.length >= 1);

    for (const photo of unlockedVault.photos) {
      assert.ok(photo.id.length > 0);
      assert.ok(photo.dataUrl.startsWith('data:image/'));
      assert.ok(photo.dateLabel.length > 0);
      assert.ok(typeof photo.caption === 'string');
      if (photo.palette) {
        assert.ok(photo.palette.primary);
        assert.ok(photo.palette.secondary);
        assert.ok(photo.palette.accent);
      }
    }
  } finally {
    if (existingBackup !== null) {
      fs.writeFileSync(VAULT_JSON_PATH, existingBackup, 'utf8');
    }
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
