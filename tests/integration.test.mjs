import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRY_CATALOG, PINNED_COUNTRY_CODES, getCountryInfo } from '../js/config.js';
import { deriveVaultCryptoKey } from '../js/crypto-vault.js';
import { evaluateBoardState } from '../js/countdown-engine.js';
import { FALLBACK_PHOTOS, PhotoStackController, clampHslForRole, extractLuminousPalette, rgbToHsl } from '../js/photo-stack.js';
import { isReunionChapter } from '../js/timeline-renderer.js';
import { loadLiveState, saveLiveState } from '../js/github-sync.js';
import { buildDefaultTripConfig } from '../scripts/encrypt-vault.mjs';

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

test('Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping', () => {
  const darkHsl = rgbToHsl(20, 10, 40);
  const clampedPrimaryHex = clampHslForRole(darkHsl, 'primary');
  assert.match(clampedPrimaryHex, /^#[0-9a-f]{6}$/i);

  const parseHexToHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return rgbToHsl(r, g, b);
  };

  const clampedHsl = parseHexToHsl(clampedPrimaryHex);
  assert.ok(clampedHsl.l >= 68 && clampedHsl.l <= 84);
  assert.ok(clampedHsl.s >= 64 && clampedHsl.s <= 91);
  assert.equal(FALLBACK_PHOTOS.length, 4);

  // Build synthetic 4-region RGBA buffer: lake blue (40%), sunlit gold (30%), pine green (20%), jacket crimson (10%)
  const pixels = [];
  const pushPixels = (r, g, b, count) => {
    for (let i = 0; i < count; i += 1) {
      pixels.push(r, g, b, 255);
    }
  };
  pushPixels(35, 130, 215, 40); // Lake blue (~208 deg)
  pushPixels(230, 185, 45, 30); // Sunlit gold (~45 deg)
  pushPixels(45, 155, 85, 20);  // Pine green (~142 deg)
  pushPixels(215, 45, 95, 10);  // Jacket rose/crimson (~342 deg)

  const multiPalette = extractLuminousPalette({ data: new Uint8ClampedArray(pixels) });
  for (const role of ['primary', 'secondary', 'tertiary', 'quaternary']) {
    assert.match(multiPalette[role], /^#[0-9a-f]{6}$/i, `Missing or invalid hex for ${role}`);
    const roleHsl = parseHexToHsl(multiPalette[role]);
    assert.ok(roleHsl.l >= 68 && roleHsl.l <= 84, `${role} lightness ${roleHsl.l} out of pastel range`);
    assert.ok(roleHsl.s >= 64 && roleHsl.s <= 91, `${role} saturation ${roleHsl.s} out of range`);
  }

  // Verify the 4 extracted colors represent distinct hue regions rather than duplicates
  const extractedHues = ['primary', 'secondary', 'tertiary', 'quaternary'].map(
    (role) => parseHexToHsl(multiPalette[role]).h
  );
  const uniqueColors = new Set([
    multiPalette.primary,
    multiPalette.secondary,
    multiPalette.tertiary,
    multiPalette.quaternary
  ]);
  assert.equal(uniqueColors.size, 4);
  assert.ok( Math.abs(extractedHues[0] - extractedHues[1]) >= 30 );
  assert.ok( Math.abs(extractedHues[0] - extractedHues[2]) >= 30 );

  // Verify PhotoStackController binds all 5 CSS tokens + unhides .ambient-photo-aura, and strips on clear()
  const cssVars = new Map();
  const mockAuraImg = {
    hidden: true,
    src: '',
    getAttribute(attr) { return attr === 'src' ? this.src : null; },
    setAttribute(attr, val) { if (attr === 'src') this.src = val; },
    removeAttribute(attr) {
      if (attr === 'src') this.src = '';
      if (attr === 'hidden') this.hidden = false;
    }
  };
  const prevDocument = globalThis.document;
  globalThis.document = /** @type {any} */ ({
    documentElement: {
      style: {
        setProperty: (k, v) => cssVars.set(k, v)
      }
    }
  });

  try {
    const controller = new PhotoStackController({
      ambientContainer: /** @type {any} */ ({
        querySelector: (sel) => (sel === '.ambient-photo-aura' ? mockAuraImg : null)
      }),
      photos: [FALLBACK_PHOTOS[0]],
      autoRotate: false
    });

    assert.match(cssVars.get('--ambient-primary'), /^#[0-9a-f]{6}$/i);
    assert.match(cssVars.get('--ambient-secondary'), /^#[0-9a-f]{6}$/i);
    assert.match(cssVars.get('--ambient-tertiary'), /^#[0-9a-f]{6}$/i);
    assert.match(cssVars.get('--ambient-quaternary'), /^#[0-9a-f]{6}$/i);
    assert.match(cssVars.get('--ambient-accent'), /^#[0-9a-f]{6}$/i);
    assert.equal(mockAuraImg.hidden, false);
    assert.equal(mockAuraImg.src, FALLBACK_PHOTOS[0].dataUrl);

    controller.clear();
    assert.equal(mockAuraImg.hidden, true);
    assert.equal(mockAuraImg.src, '');
    assert.equal(cssVars.get('--ambient-tertiary'), '#fbd3a7');
    assert.equal(cssVars.get('--ambient-quaternary'), '#d5bdf8');
  } finally {
    globalThis.document = prevDocument;
  }
});

test('Integration: Timeline items partition cleanly and identify ReunionChapters vs MilestoneEvents', () => {
  const sampleConfig = buildDefaultTripConfig();
  const state = evaluateBoardState(sampleConfig, null, Date.parse('2025-08-01T12:00:00Z'));
  const hasPastSampleReunion = state.timeline.pastItems.some(
    (item) => isReunionChapter(item) && item.id === 'reunion-sample-1'
  );
  assert.equal(hasPastSampleReunion, true);
});

test('Integration: GitHub sync encrypts and decrypts LiveStatePayload with AES-256-GCM CryptoKey', async () => {
  const store = new Map();
  globalThis.localStorage = /** @type {any} */ ({
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  });

  const salt = new Uint8Array(16);
  const cryptoKey = await deriveVaultCryptoKey('sync-encryption-test-key', salt, 1000);

  const sampleState = {
    schemaVersion: 1,
    updatedAt: '2025-12-14T10:00:00.000Z',
    statusOverrides: {
      partnerA: { countryCode: 'AR', cityNote: 'ברילוצ׳ה 🏔️', updatedAt: '2025-12-14T10:00:00.000Z' }
    },
    customMilestones: []
  };

  const saveRes = await saveLiveState(sampleState, null, null, cryptoKey);
  assert.equal(saveRes.mode, 'local-only');

  // Verify raw localStorage entry is encrypted AES-256-GCM ciphertext and does not contain plaintext note
  const rawStored = store.get('trip_countdown_live_state_v2');
  assert.ok(rawStored);
  assert.equal(rawStored.includes('ברילוצ׳ה'), false, 'Encrypted live state must not leak plaintext cityNote');
  const parsedEnvelope = JSON.parse(rawStored);
  assert.equal(parsedEnvelope.alg, 'AES-256-GCM');

  const loaded = await loadLiveState(null, null, cryptoKey);
  assert.equal(loaded.statusOverrides.partnerA.cityNote, 'ברילוצ׳ה 🏔️');
});

test('Security Audit: Zero personal names, itinerary dates, or token.txt exist in public HTML/JS/CSS/Docs', () => {
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, 'token.txt')),
    false,
    'token.txt must be deleted from repository root'
  );

  const publicFilesToAudit = [
    'index.html',
    'manifest.json',
    'sw.js',
    'live-state.json',
    'styles/main.css',
    'PLAN.md',
    'README.md',
    'AGENTS.md',
    'DESIGN.md',
    'js/config.js',
    'js/storage-vault.js',
    'js/crypto-vault.js',
    'js/countdown-engine.js',
    'js/photo-stack.js',
    'js/timeline-renderer.js',
    'js/github-sync.js',
    'js/app.js'
  ];

  // Construct forbidden patterns dynamically so the test file itself remains free of cleartext names
  const forbiddenNameA = String.fromCharCode(115, 104, 111, 118, 97, 108);
  const forbiddenNameB = String.fromCharCode(101, 105, 116, 97, 110);
  const forbiddenPatterns = [
    new RegExp(forbiddenNameA, 'i'),
    new RegExp(forbiddenNameB, 'i'),
    /2026-01-10/,
    /2026-12-06/,
    /2026-12-31/,
    /2027-03-10/,
    /2027-04-21/,
    /1761868800000/,
    /1780272000000/,
    /github_pat_/
  ];

  for (const relPath of publicFilesToAudit) {
    const content = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(content),
        false,
        `Public file ${relPath} must not match sensitive pattern ${String(pattern)}`
      );
    }
  }
});
