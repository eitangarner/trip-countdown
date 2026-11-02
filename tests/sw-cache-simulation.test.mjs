import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DaysBreakdownModal, EventCountdownModal } from '../js/ui-modals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.json': 'application/json',
  '.css': 'text/css',
  '.js': 'text/javascript'
};

function readServiceWorkerConfig() {
  const swPath = path.join(ROOT_DIR, 'sw.js');
  const swContent = fs.readFileSync(swPath, 'utf8');

  const cacheNameMatch = swContent.match(/const CACHE_NAME = \x27([^\x27]+)\x27;/);
  assert.ok(cacheNameMatch, 'sw.js must declare const CACHE_NAME');
  const cacheName = cacheNameMatch[1];

  const assetsMatch = swContent.match(/const APP_SHELL_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(assetsMatch, 'sw.js must declare const APP_SHELL_ASSETS array');

  const assets = assetsMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith("'") || line.startsWith('"'))
    .map((line) => line.replace(/['",]/g, '').trim())
    .filter(Boolean);

  return { cacheName, assets, swContent };
}

test('SW Challenge: APP_SHELL_ASSETS exists on disk, valid size, valid mime, and scoped path resolution', () => {
  const { cacheName, assets } = readServiceWorkerConfig();

  assert.equal(cacheName, 'trip-countdown-board-v5', 'Service Worker cache version must be v5');
  assert.equal(assets.length, 30, 'APP_SHELL_ASSETS must contain exactly 30 assets');

  const baseUrls = [
    'https://example.com/sw.js',
    'https://eitangarner.github.io/trip-countdown/sw.js',
    'http://localhost:8080/sw.js'
  ];

  for (const assetPath of assets) {
    assert.ok(assetPath.startsWith('./'), `Asset path must use explicit relative prefix: ${assetPath}`);

    const absolutePath = path.resolve(ROOT_DIR, assetPath);
    assert.ok(fs.existsSync(absolutePath), `Asset file must exist on disk: ${assetPath} -> ${absolutePath}`);

    const fileStat = fs.statSync(absolutePath);
    if (assetPath === './') {
      assert.ok(fileStat.isDirectory(), './ must resolve to root directory');
      const indexFallback = path.join(absolutePath, 'index.html');
      assert.ok(fs.existsSync(indexFallback), 'Root directory must contain index.html for HTTP servers');
    } else {
      assert.ok(fileStat.isFile(), `${assetPath} must be a regular file`);
      assert.ok(fileStat.size > 0, `${assetPath} must have non-zero size (found ${fileStat.size} bytes)`);

      const fileExtension = path.extname(assetPath);
      assert.ok(
        fileExtension in MIME_TYPES,
        `Asset ${assetPath} must have recognized web mime type extension, found: ${fileExtension}`
      );
    }

    for (const baseUrl of baseUrls) {
      const scopeBase = new URL('./', baseUrl).href;
      const resolvedUrl = new URL(assetPath, baseUrl);
      assert.ok(
        resolvedUrl.href.startsWith(scopeBase),
        `Resolved asset URL ${resolvedUrl.href} must stay within SW scope ${scopeBase}`
      );
      assert.equal(
        resolvedUrl.pathname.includes('/../'),
        false,
        `Resolved asset URL ${resolvedUrl.pathname} must not contain traversal segments`
      );
    }
  }
});

test('SW Challenge: Atomic cache.addAll simulation guarantees 0 missing assets on install', async () => {
  const { assets } = readServiceWorkerConfig();

  class MockCache {
    constructor() {
      /** @type {Map<string, { status: number, body: Buffer, mime: string }>} */
      this.entries = new Map();
    }

    async addAll(requests) {
      /** @type {Array<{ url: string, status: number, body: Buffer, mime: string }>} */
      const fetchedResponses = [];

      for (const req of requests) {
        const filePath = path.resolve(ROOT_DIR, req);
        if (!fs.existsSync(filePath)) {
          throw new TypeError(`Failed to execute 'addAll' on 'Cache': Request failed for ${req} (ENOENT 404)`);
        }
        const stat = fs.statSync(filePath);
        if (req !== './' && !stat.isFile()) {
          throw new TypeError(`Failed to execute 'addAll' on 'Cache': ${req} is not a file`);
        }

        const actualPath = req === './' ? path.join(filePath, 'index.html') : filePath;
        const body = fs.readFileSync(actualPath);
        const ext = path.extname(actualPath);
        fetchedResponses.push({
          url: req,
          status: 200,
          body,
          mime: MIME_TYPES[ext] || 'application/octet-stream'
        });
      }

      for (const res of fetchedResponses) {
        this.entries.set(res.url, res);
      }
    }
  }

  const liveCache = new MockCache();
  await assert.doesNotReject(async () => {
    await liveCache.addAll(assets);
  }, 'All 30 APP_SHELL_ASSETS must load atomically without failure');

  assert.equal(liveCache.entries.size, 30, 'Cache must contain exactly 30 entries after install');

  // Negative test: verify that a single missing asset causes addAll to reject atomically
  const brokenCache = new MockCache();
  const corruptedAssetList = [...assets, './missing-icon.png'];
  await assert.rejects(
    async () => {
      await brokenCache.addAll(corruptedAssetList);
    },
    (err) => {
      assert.match(err.message, /ENOENT 404/);
      return true;
    },
    'cache.addAll must reject if any single asset is missing'
  );
  assert.equal(brokenCache.entries.size, 0, 'No entries should be committed if addAll rejects');
});

test('SW Challenge: Cache name transition & rotation during activate event purges stale caches', async () => {
  const { cacheName } = readServiceWorkerConfig();

  class MockCachesStorage {
    constructor() {
      /** @type {Map<string, Map<string, any>>} */
      this.stores = new Map();
    }

    async open(name) {
      if (!this.stores.has(name)) {
        this.stores.set(name, new Map());
      }
      return this.stores.get(name);
    }

    async keys() {
      return Array.from(this.stores.keys());
    }

    async delete(name) {
      return this.stores.delete(name);
    }
  }

  const caches = new MockCachesStorage();
  await caches.open('trip-countdown-board-v1');
  await caches.open('trip-countdown-board-v2');
  await caches.open('trip-countdown-board-v3');
  await caches.open('trip-countdown-board-v4');
  await caches.open(cacheName); // v5
  await caches.open('legacy-foreign-cache');

  assert.equal((await caches.keys()).length, 6);

  // Exact activate event handler logic from sw.js
  const activateKeys = await caches.keys();
  await Promise.all(
    activateKeys
      .filter((key) => key !== cacheName)
      .map((key) => caches.delete(key))
  );

  const survivingKeys = await caches.keys();
  assert.equal(survivingKeys.length, 1, 'Only the active cache version should remain after activate');
  assert.equal(survivingKeys[0], 'trip-countdown-board-v5', 'trip-countdown-board-v5 must survive');
  assert.equal(await caches.delete('trip-countdown-board-v4'), false, 'v4 must already be deleted');
});

test('Headless Stress Challenge: DaysBreakdownModal & EventCountdownModal in pure Node headless environment', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  try {
    delete globalThis.document;
    delete globalThis.window;

    assert.equal(typeof document, 'undefined');
    assert.equal(typeof window, 'undefined');

    // 1. DaysBreakdownModal pure headless lifecycle
    const daysModal = new DaysBreakdownModal();
    assert.equal(daysModal.isOpen(), false);

    assert.doesNotThrow(() => {
      daysModal.open({
        nowMs: Date.now(),
        timeline: {
          countryDaysBreakdown: [
            { flag: '🇹🇭', countryName: 'Thailand', days: 12 },
            { flag: '🇯🇵', countryName: 'Japan', days: 5 }
          ],
          plannedTripDaysTogether: 17
        }
      });
    }, 'DaysBreakdownModal.open must not throw in headless environment');

    assert.equal(daysModal.isOpen(), false, 'Modal should remain not open without DOM');
    assert.doesNotThrow(() => daysModal.close());
    assert.doesNotThrow(() => daysModal.destroy());
    assert.doesNotThrow(() => daysModal.destroy(), 'Repeated destroy must be idempotent');

    // 2. EventCountdownModal pure headless lifecycle
    const eventModal = new EventCountdownModal();
    assert.equal(eventModal.isOpen(), false);
    assert.equal(eventModal.getActiveItem(), null);

    const sampleMilestone = {
      id: 'ms-sample-1',
      date: '2026-11-10',
      category: 'anniversary',
      emoji: '🥂',
      title: 'Anniversary Milestone',
      countryCode: 'IL',
      person: 'both'
    };

    const sampleChapter = {
      id: 'ch-sample-1',
      title: 'Tokyo Chapter',
      emoji: '🗼',
      startDate: '2026-12-01',
      endDate: '2026-12-15',
      person: 'both',
      legs: [
        { id: 'leg-1', countryCode: 'JP', startDate: '2026-12-01', endDate: '2026-12-15', label: 'Tokyo' }
      ]
    };

    assert.doesNotThrow(() => {
      eventModal.open(sampleMilestone, null);
    }, 'EventCountdownModal.open milestone must not throw in headless environment');

    assert.doesNotThrow(() => {
      eventModal.open(sampleChapter, null);
    }, 'EventCountdownModal.open chapter must not throw in headless environment');

    const futureEpochMs = Date.parse('2026-10-01T00:00:00Z');
    const activeEpochMs = Date.parse('2026-12-05T00:00:00Z');
    const pastEpochMs = Date.parse('2027-01-01T00:00:00Z');

    assert.doesNotThrow(() => eventModal.updateCountdown(futureEpochMs, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(activeEpochMs, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(pastEpochMs, null));

    assert.doesNotThrow(() => eventModal.close());
    assert.doesNotThrow(() => eventModal.destroy());
    assert.doesNotThrow(() => eventModal.destroy(), 'Repeated destroy must be idempotent');
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('Headless Stress Challenge: UI modals handle edge-case null, undefined, and extreme numeric parameters gracefully', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  try {
    delete globalThis.document;
    delete globalThis.window;

    // Edge case constructor inputs
    assert.doesNotThrow(() => new DaysBreakdownModal());
    assert.doesNotThrow(() => new DaysBreakdownModal(undefined));
    assert.doesNotThrow(() => new DaysBreakdownModal({}));
    assert.doesNotThrow(() => new DaysBreakdownModal({ onClose: undefined }));
    assert.doesNotThrow(() => new EventCountdownModal());
    assert.doesNotThrow(() => new EventCountdownModal(undefined));
    assert.doesNotThrow(() => new EventCountdownModal({}));
    assert.doesNotThrow(() => new EventCountdownModal({ onEdit: undefined, onEditItem: undefined, onClose: undefined }));

    const daysModal = new DaysBreakdownModal();
    assert.doesNotThrow(() => daysModal.open(null));
    assert.doesNotThrow(() => daysModal.open(undefined));
    assert.doesNotThrow(() => daysModal.open({}));

    const eventModal = new EventCountdownModal();
    assert.doesNotThrow(() => eventModal.open(null, null));
    assert.doesNotThrow(() => eventModal.open(undefined, undefined));

    assert.doesNotThrow(() => eventModal.updateCountdown(NaN, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(-Infinity, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(Infinity, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(-1, null));
    assert.doesNotThrow(() => eventModal.updateCountdown(0, null));

    daysModal.destroy();
    eventModal.destroy();
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});
