import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRY_CATALOG, PINNED_COUNTRY_CODES, TRIP_CONFIG, getCountryInfo } from '../js/config.js';
import { decryptVault } from '../js/crypto-vault.js';
import { evaluateBoardState } from '../js/countdown-engine.js';
import { FALLBACK_PHOTOS, clampHslForRole, rgbToHsl, hslToHex } from '../js/photo-stack.js';
import { isReunionChapter } from '../js/timeline-renderer.js';
import { loadLiveState, saveLiveState } from '../js/github-sync.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

test('Integration: COUNTRY_CATALOG contains all 249 ISO 3166-1 countries with flags, names, and IANA timezones', () => {
  const codes = Object.keys(COUNTRY_CATALOG);
  assert.equal(codes.length, 249);

  for (const code of PINNED_COUNTRY_CODES) {
    const info = getCountryInfo(code);
    assert.ok(info.name.length > 0);
    assert.ok(info.flag.length >= 2);
    assert.ok(info.timeZone.includes('/') || info.timeZone === 'UTC');
  }
});

test('Integration: vault.json on disk has valid AES-256-GCM + PBKDF2-SHA256 wire envelope', () => {
  const vaultRaw = fs.readFileSync(path.join(ROOT_DIR, 'vault.json'), 'utf8');
  const vaultJson = JSON.parse(vaultRaw);

  assert.equal(vaultJson.version, 1);
  assert.equal(vaultJson.kdf, 'PBKDF2-SHA256');
  assert.equal(vaultJson.iterations, 150000);
  assert.ok(Buffer.from(vaultJson.salt, 'base64').length === 16);
  assert.ok(Buffer.from(vaultJson.iv, 'base64').length === 12);
  assert.ok(Buffer.from(vaultJson.ciphertext, 'base64').length > 32);
});

test('Integration: PhotoStack HSL clamping enforces lighter matte-glass pastel range (L: 68%–84%)', () => {
  const darkHsl = rgbToHsl(20, 10, 40);
  const clampedPrimaryHex = clampHslForRole(darkHsl, 'primary');
  assert.match(clampedPrimaryHex, /^#[0-9a-f]{6}$/i);

  const r = parseInt(clampedPrimaryHex.slice(1, 3), 16);
  const g = parseInt(clampedPrimaryHex.slice(3, 5), 16);
  const b = parseInt(clampedPrimaryHex.slice(5, 7), 16);
  const clampedHsl = rgbToHsl(r, g, b);
  assert.ok(clampedHsl.l >= 68 && clampedHsl.l <= 84);
  assert.ok(clampedHsl.s >= 64 && clampedHsl.s <= 91);
  assert.equal(FALLBACK_PHOTOS.length, 4);
});

test('Integration: Timeline items partition cleanly and identify ReunionChapters vs MilestoneEvents', () => {
  const febState = evaluateBoardState(TRIP_CONFIG, null, Date.parse('2027-02-15T15:00:00Z'));
  const hasPastThailandReunion = febState.timeline.pastItems.some(
    (item) => isReunionChapter(item) && item.id === 'reunion-1-thailand'
  );
  const hasUpcomingAsiaReunion = febState.timeline.upcomingItems.some(
    (item) => isReunionChapter(item) && item.id === 'reunion-2-asia-trio'
  );
  assert.equal(hasPastThailandReunion, true);
  assert.equal(hasUpcomingAsiaReunion, true);
});

test('Integration: GitHub sync local fallback persists Hebrew & emoji status notes cleanly', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };

  const sampleState = {
    schemaVersion: 1,
    updatedAt: '2026-12-14T10:00:00.000Z',
    statusOverrides: {
      shoval: { countryCode: 'AR', cityNote: 'ברילוצ׳ה 🏔️', updatedAt: '2026-12-14T10:00:00.000Z' }
    },
    customMilestones: []
  };

  const saveRes = await saveLiveState(sampleState, null, null);
  assert.equal(saveRes.mode, 'local-only');

  const loaded = await loadLiveState(null, null);
  assert.equal(loaded.statusOverrides.shoval.cityNote, 'ברילוצ׳ה 🏔️');
});
