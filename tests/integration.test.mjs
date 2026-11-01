import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COUNTRY_CATALOG, PINNED_COUNTRY_CODES, getCountryInfo } from '../js/config.js';
import { deriveVaultCryptoKey } from '../js/crypto-vault.js';
import { evaluateBoardState } from '../js/countdown-engine.js';
import { FALLBACK_PHOTOS, PhotoStackController, clampHslForRole, createPhotoDateElement, extractLuminousPalette, rgbToHsl } from '../js/photo-stack.js';
import { createMilestoneRowElement, isReunionChapter, resolveMilestonePersonMeta } from '../js/timeline-renderer.js';
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

test('Integration: index.html contains split two-view panels, bottom nav, dedicated tz bridge, and neutral gate copy', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

  // Neutral gate overlay branding (no "encrypted vault" technical jargon)
  assert.ok(html.includes('<h1 class="vault-title" id="vault-title">Trip Countdown</h1>'));
  assert.ok(html.includes('<p class="vault-subtitle" id="vault-subtitle">Enter password to continue</p>'));
  assert.ok(html.includes('<button type="submit" class="vault-unlock-btn" id="vault-unlock-btn">Open ✨</button>'));
  assert.ok(html.includes('<button type="button" class="preset-chip" id="lock-device-btn">🔒 Lock App</button>'));
  assert.equal(html.includes('Encrypted Trip Board'), false);
  assert.equal(html.includes('decrypt photos &amp; live itinerary'), false);

  // Two-view panels and bottom navigation
  assert.ok(html.includes('id="view-countdown"'));
  assert.ok(html.includes('id="view-timeline"'));
  assert.ok(html.includes('id="bottom-nav"'));
  assert.ok(html.includes('id="nav-btn-countdown"'));
  assert.ok(html.includes('id="nav-btn-timeline"'));

  // Dedicated non-overlapping tz-bridge container
  assert.ok(html.includes('<div class="tz-bridge-container">'));
  assert.ok(html.includes('<div class="tz-bridge-pill numeric-lock" id="tz-bridge-pill" dir="ltr"></div>'));

  // Profile-aware status update controls
  assert.ok(html.includes('id="profile-segmented-control"'));
  assert.ok(html.includes('id="seg-btn-primary"'));
  assert.ok(html.includes('id="seg-btn-secondary"'));
  assert.ok(html.includes('id="edit-current-country"'));
  assert.ok(html.includes('id="edit-current-note"'));

  // Time-travel preview slider and banner removed
  assert.equal(html.includes('id="time-travel-slider"'), false);
  assert.equal(html.includes('id="preview-banner"'), false);

  // Bottom sheet drag handle wrapper
  assert.ok(html.includes('id="sheet-handle-wrapper"'));
});

test('Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages', () => {
  const prevDoc = globalThis.document;
  globalThis.document = /** @type {any} */ ({
    createElement: (tag) => {
      const el = {
        tag,
        className: '',
        textContent: '',
        children: [],
        attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        appendChild(child) { this.children.push(child); }
      };
      return el;
    }
  });

  try {
    const pagesEl = /** @type {any} */ (createPhotoDateElement('05-10-2026'));
    assert.equal(pagesEl.className, 'photo-date-pages numeric-lock');
    assert.equal(pagesEl.children.length, 3);
    assert.equal(pagesEl.children[0].className, 'date-page date-page-day');
    assert.equal(pagesEl.children[0].children[0].textContent, '05');

    assert.equal(pagesEl.children[1].className, 'date-page date-page-month');
    assert.equal(pagesEl.children[1].children[0].textContent, '10');

    assert.equal(pagesEl.children[2].className, 'date-page date-page-year');
    assert.equal(pagesEl.children[2].children[0].textContent, '2026');

    // Fallback for non-calendar labels like Chapter 01
    const pillEl = /** @type {any} */ (createPhotoDateElement('Chapter 01'));
    assert.equal(pillEl.className, 'photo-date-pill numeric-lock');
    assert.equal(pillEl.textContent, 'Chapter 01');

    // Compact mode for timeline cards
    const compactPages = /** @type {any} */ (createPhotoDateElement('15-12-2026', { isCompact: true }));
    assert.ok(compactPages.className.includes('date-pages-compact'));

    // Range support produces two separate pill elements with a separator
    const rangePages = /** @type {any} */ (createPhotoDateElement('31-12-2026 – 10-01-2027', { isCompact: true }));
    assert.ok(rangePages.className.includes('photo-date-range-container'));
    assert.equal(rangePages.children.length, 3); // start pill + separator + end pill
    assert.ok(rangePages.children[0].className.includes('photo-date-pages'));
    assert.ok(rangePages.children[0].className.includes('date-pages-compact'));
    assert.equal(rangePages.children[0].children[0].children[0].textContent, '31');
    assert.equal(rangePages.children[0].children[1].children[0].textContent, '12');
    assert.equal(rangePages.children[0].children[2].children[0].textContent, '2026');
    assert.equal(rangePages.children[1].textContent, '–');
    assert.ok(rangePages.children[2].className.includes('photo-date-pages'));
    assert.ok(rangePages.children[2].className.includes('date-pages-compact'));
    assert.equal(rangePages.children[2].children[0].children[0].textContent, '10');
    assert.equal(rangePages.children[2].children[1].children[0].textContent, '01');
    assert.equal(rangePages.children[2].children[2].children[0].textContent, '2027');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('Integration: resolveMilestonePersonMeta assigns person icons (🌸, 🌊, 💕) and createMilestoneRowElement suppresses boilerplate subtitles', () => {
  const fakeBoardState = /** @type {any} */ ({
    dualStatus: {
      primary: { person: 'partnerA', displayName: 'Partner A' },
      secondary: { person: 'partnerB', displayName: 'Partner B' }
    }
  });

  const metaA = resolveMilestonePersonMeta('partnerA', fakeBoardState);
  assert.equal(metaA.icon, '🌸');
  assert.equal(metaA.label, 'Partner A');

  const metaB = resolveMilestonePersonMeta('partnerB', fakeBoardState);
  assert.equal(metaB.icon, '🌊');
  assert.equal(metaB.label, 'Partner B');

  const metaTogether = resolveMilestonePersonMeta('both', fakeBoardState);
  assert.equal(metaTogether.icon, '💕');
  assert.equal(metaTogether.label, 'Together');

  // DOM Mock for createMilestoneRowElement
  const prevDoc = globalThis.document;
  function makeMockElement(tag) {
    return {
      tag,
      className: '',
      textContent: '',
      innerHTML: '',
      children: [],
      attrs: {},
      dataset: {},
      listeners: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return this.attrs[k]; },
      appendChild(child) { this.children.push(child); },
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };
  }
  globalThis.document = /** @type {any} */ ({ createElement: makeMockElement });

  try {
    let clickedItem = null;
    const milestoneWithRedundantText = {
      id: 'ms-test-1',
      date: '2026-11-10',
      category: 'anniversary',
      emoji: '🥂',
      title: '10 Months Together',
      details: 'Monthly milestone (10 months since 10-01-2026)',
      person: 'both',
      countryCode: 'IL'
    };

    let deletedItem = null;
    const row = /** @type {any} */ (
      createMilestoneRowElement(
        milestoneWithRedundantText,
        fakeBoardState,
        (item) => { clickedItem = item; },
        (item) => { deletedItem = item; }
      )
    );

    assert.equal(row.className, 'milestone-row');
    const card = row.children[0];
    assert.ok(card.className.includes('is-interactive'));

    // Check click listener triggers onEditItem
    card.listeners['click']();
    assert.equal(clickedItem?.id, 'ms-test-1');

    // Person tag should show 💕 Together without country flag
    const body = card.children[1];
    const metaRow = body.children[0];
    const countryCol = metaRow.children[0];
    const actionsGroup = metaRow.children[1];
    const personTag = actionsGroup.children[0];

    assert.equal(personTag.textContent, '💕 Together');
    assert.equal(countryCol.children[1].textContent, '🇮🇱 Israel');

    // All details/subtitle text must be completely omitted from body (only metaRow and titleEl)
    assert.equal(body.children.length, 2);

    // Test custom added event renders delete trash button
    const customEvent = {
      id: 'custom-event-123',
      date: '2026-05-01',
      category: 'custom',
      emoji: '🎒',
      title: 'Backpack Buy',
      person: 'partnerA',
      countryCode: 'IL'
    };

    let customDeleted = null;
    const customRow = /** @type {any} */ (
      createMilestoneRowElement(
        customEvent,
        fakeBoardState,
        null,
        (item) => { customDeleted = item; }
      )
    );
    const customCard = customRow.children[0];
    const customActionsGroup = customCard.children[1].children[0].children[1];
    const deleteBtn = customActionsGroup.children[1];
    assert.ok(deleteBtn);
    assert.equal(deleteBtn.className, 'milestone-card-delete-btn');
    assert.equal(deleteBtn.textContent, '🗑️');

    // Clicking delete button calls onDeleteItem
    deleteBtn.listeners['click']({ stopPropagation() {} });
    assert.equal(customDeleted?.id, 'custom-event-123');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('Integration: Engine dynamically applies milestoneOverrides, chapterOverrides, and customReunions', () => {
  const config = buildDefaultTripConfig();
  const baseDateMs = 1761912000000; // Pre-trip epoch

  const customChapter = {
    id: 'ch-extra',
    title: 'Weekend Escape',
    emoji: '🏝️',
    startDate: '2026-03-01',
    endDate: '2026-03-05',
    description: 'Island getaway',
    legs: [
      {
        id: 'ch-extra-leg-1',
        name: 'Weekend Escape',
        countryCode: 'PH',
        startDate: '2026-03-01',
        endDate: '2026-03-05'
      }
    ]
  };

  const liveState = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    statusOverrides: {},
    customMilestones: [
      {
        id: 'ms-custom-scuba',
        title: 'Scuba Diving Day',
        date: '2026-02-20',
        category: 'custom',
        emoji: '🤿',
        person: 'both',
        countryCode: 'TH',
        details: 'Koh Tao coral reef dive'
      }
    ],
    milestoneOverrides: {
      'ms-custom-scuba': {
        countryCode: 'ID', // Override country to Indonesia
        details: 'Gili islands dive'
      }
    },
    customReunions: [customChapter],
    chapterOverrides: {
      [config.reunions[0].id]: {
        title: 'Southeast Asia Odyssey',
        emoji: '🌏'
      }
    }
  };

  const evaluated = evaluateBoardState(config, liveState, baseDateMs);

  // Check overridden milestone country and details
  const scubaMs = evaluated.timeline.upcomingItems.find((item) => item.id === 'ms-custom-scuba');
  assert.ok(scubaMs);
  assert.equal(scubaMs.countryCode, 'ID');
  assert.equal(scubaMs.details, 'Gili islands dive');

  // Check overridden reunion title and emoji
  const seaChapter = [...evaluated.timeline.upcomingItems, ...evaluated.timeline.pastItems].find(
    (item) => item.id === config.reunions[0].id
  );
  assert.ok(seaChapter);
  assert.equal(seaChapter.title, 'Southeast Asia Odyssey');
  assert.equal(seaChapter.emoji, '🌏');

  // Check custom reunion chapter was integrated
  const extraChapter = evaluated.timeline.upcomingItems.find((item) => item.id === 'ch-extra');
  assert.ok(extraChapter);
  assert.equal(extraChapter.title, 'Weekend Escape');
});

test('Integration: index.html contains Timeline Header Add Button, Update Status FAB, and Timeline Item Editor Sheet', () => {
  const html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

  // Timeline header Add Event button & Days Breakdown Modal
  assert.ok(html.includes('id="add-timeline-item-btn"'));
  assert.ok(html.includes('+ Add Event'));
  assert.ok(html.includes('id="days-breakdown-modal"'));

  // Scoped Update Status FAB
  assert.ok(html.includes('id="fab-edit-btn"'));
  assert.ok(html.includes('Update Status'));

  // Dedicated Timeline Item Bottom Sheet & controls
  assert.ok(html.includes('id="timeline-item-sheet"'));
  assert.ok(html.includes('id="timeline-sheet-backdrop"'));
  assert.ok(html.includes('id="timeline-type-toggle-group"'));
  assert.ok(html.includes('id="timeline-type-milestone-btn"'));
  assert.ok(html.includes('id="timeline-type-chapter-btn"'));
  assert.ok(html.includes('id="tl-item-id-input"'));
  assert.ok(html.includes('id="timeline-milestone-fields"'));
  assert.ok(html.includes('id="timeline-chapter-fields"'));
  assert.ok(html.includes('id="tl-save-btn"'));
  assert.ok(html.includes('id="tl-delete-btn"'));

  // Dedicated Event / Milestone Countdown Popup Modal
  assert.ok(html.includes('id="event-modal"'));
  assert.ok(html.includes('id="event-modal-backdrop"'));
  assert.ok(html.includes('id="event-modal-countdown-grid"'));
  assert.ok(html.includes('id="event-cd-days"'));
  assert.ok(html.includes('id="event-cd-hours"'));
  assert.ok(html.includes('id="event-cd-minutes"'));
  assert.ok(html.includes('id="event-cd-seconds"'));
  assert.ok(html.includes('id="event-modal-edit-btn"'));
  assert.ok(html.includes('id="event-modal-date-pill"'));
});
