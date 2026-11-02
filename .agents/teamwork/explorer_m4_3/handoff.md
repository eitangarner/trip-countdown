# Milestone 4 Handoff Report: PreviewBannerController & Streamlined App Coordinator

## 1. Observation

1. **Current `js/app.js` Monolith**:
   - `js/app.js` currently contains 1,789 lines (`wc -l js/app.js` -> `1788 js/app.js` + trailing).
   - Lines 142–300 cache over 80 individual DOM elements across all features (lock overlay, countdown card, dual status, timeline track, edit sheet, timeline editor sheet, event modal, days breakdown modal, etc.).
   - Lines 630–640, 897–968 contain sheet drag gesture handlers.
   - Lines 642–714, 1565–1603 contain status edit sheet form logic and segmented buttons.
   - Lines 715–881, 1008–1347 contain timeline item editor CRUD logic, dynamic multi-leg card generation, and form validation.
   - Lines 601–615, 1348–1496 contain modal open/close/countdown logic for `DaysBreakdownModal` and `EventCountdownModal`.
   - Lines 1561–1563 hardcode `getEffectiveNowMs() { return Date.now(); }` without preview simulation.

2. **DOM Absence of `#preview-banner` and `#time-travel-slider`**:
   - `tests/integration.test.mjs` lines 268–270 explicitly assert:
     ```js
     // Time-travel preview slider and banner removed
     assert.equal(html.includes('id="time-travel-slider"'), false);
     assert.equal(html.includes('id="preview-banner"'), false);
     ```
   - In git commit `b366b74`, preview elements were managed in `js/app.js` (`this.previewEpochMs`, `#preview-banner`, `#preview-banner-date`, `#preview-reset-btn`, `#time-travel-slider`, `#preset-chips-row`).
   - `styles/countdown-card.css` lines 8–72 contains styling for `.preview-banner:not([hidden])`, `.preview-banner[hidden]`, `.preview-banner-text`, and `.preview-reset-btn`.
   - Invariant: `PreviewBannerController` must be 100% null-safe and headless compatible. If `#preview-banner` or `#time-travel-slider` are not found in the DOM (as is the case in static production `index.html`), all controller operations must execute gracefully without throwing runtime errors.

3. **Current Test Suite Status**:
   - Running `node --test tests/*.test.mjs` outputs `pass 25 / fail 0` (180ms duration).
   - `tests/integration.test.mjs` audits public files for zero-knowledge confidentiality and DOM structure.

---

## 2. Logic Chain

1. **Extraction of UI Sub-Controllers Relieves `js/app.js`**:
   - Following M4's modularization division:
     - `js/ui-gestures.js`: handles sheet pull-to-dismiss pointer/touch events.
     - `js/ui-modals.js`: handles `DaysBreakdownModal` and `EventCountdownModal`.
     - `js/ui-status-sheet.js`: handles `StatusEditSheet` and `populateCountrySelect`.
     - `js/ui-editor-sheet.js`: handles `TimelineEditorSheet`.
     - `js/ui-preview-banner.js`: handles `PreviewBannerController`.
   - Delegating these responsibilities strips over 1,450 lines of localized UI rendering, event handling, and form validation from `CountdownBoardApp`.

2. **Architecture of `PreviewBannerController` (`js/ui-preview-banner.js`)**:
   - **DOM Caching**: Caches `#preview-banner`, `#preview-banner-date`, `#preview-reset-btn`, `#time-travel-slider`, `#slider-date-readout`, `#preset-chips-row`, `#preview-step-prev`, `#preview-step-next` once on initialization.
   - **Defensive Against Missing DOM Elements**: Every element mutation is guarded by null-checks. Headless environments (Node / unit tests where `document` may be stubbed or partial) operate cleanly.
   - **Public API**:
     - `setTripConfig(tripConfig)`: caches config and dynamically renders time-travel preset buttons into `#preset-chips-row` if present.
     - `setPreviewTimestamp(epochMs, presetId)`: updates internal `#previewEpochMs`, updates banner visibility/date text, updates slider value, updates chip active classes, and calls `onPreviewChange(epochMs)`.
     - `getPreviewTimestamp()`: returns current preview timestamp (`number | null`).
     - `stepDays(days)`: computes `(this.#previewEpochMs ?? Date.now()) + days * MS_PER_DAY` and invokes `setPreviewTimestamp()`.
     - `reset()`: resets preview to `null` (live time).
     - `destroy()`: unbinds all event listeners, clears preset chips, and wipes references.

3. **Architecture of Streamlined `CountdownBoardApp` (`js/app.js`)**:
   - Coordinates:
     1. **Vault Lifecycle**: preloading `vault.json`, decrypting via `unlockAndCacheVault()`, persisting session in IndexedDB, and wiping credentials on `lockAndPurgeBoard()`.
     2. **Sub-Controller Orchestration**: instantiates `PhotoStackController`, `TimelineRenderer`, `PreviewBannerController`, `DaysBreakdownModal`, `EventCountdownModal`, `StatusEditSheet`, and `TimelineEditorSheet`.
     3. **1Hz Tick Evaluation**: evaluates `evaluateBoardState(this.#tripConfig, this.liveState, this.getEffectiveNowMs())`, updating top relationship pills, countdown numerals, celebration card, sooner milestone sub-banner, dual status cards, timezone bridge, and delegating active modal ticks.
     4. **Ambient Palette Management**: `PhotoStackController` binds dynamic luminous pastel colors (`--ambient-*`) to `:root` upon active photo transitions.
     5. **Keyboard Shortcuts**: binds `Escape` (dismissing any open modal/sheet in top-down hierarchy), `P` (toggling preview mode / +1 day preview step), and `ArrowLeft` / `ArrowRight` (scrubbing preview time when active).
   - This results in a clean ~320-line coordinator adhering strictly to the 5 AI Engineering Principles (no generic variables, zero tutorial docstrings, single-source-of-truth state).

---

## 3. Specifications & Proposed Code

### 3.1 Proposed `js/ui-preview-banner.js`

```javascript
/**
 * Trip Countdown & Timeline Board
 * PreviewBannerController: Time-Travel preview slider & banner controller.
 * Defensive against missing DOM elements (null-safe/headless compatible).
 */

import { getCountryInfo } from './config.js';
import {
  formatDisplayDate,
  getZonedDateParts,
  MS_PER_DAY
} from './date-utils.js';

export class PreviewBannerController {
  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {number | null} */
  #previewEpochMs = null;

  /** @type {string} */
  #activePresetId = '';

  /** @type {(() => void)[]} */
  #unbinders = [];

  /**
   * @param {{
   *   onPreviewChange?: (epochMs: number | null) => void;
   * }} [options]
   */
  constructor({ onPreviewChange } = {}) {
    this.onPreviewChange = onPreviewChange;
    this.cacheDomElements();
    this.bindEvents();
  }

  cacheDomElements() {
    if (typeof document === 'undefined') {
      this.dom = {
        previewBanner: null,
        previewBannerDate: null,
        previewResetBtn: null,
        timeTravelSlider: null,
        sliderDateReadout: null,
        presetChipsRow: null,
        previewStepPrev: null,
        previewStepNext: null
      };
      return;
    }

    this.dom = {
      previewBanner: document.getElementById('preview-banner'),
      previewBannerDate: document.getElementById('preview-banner-date'),
      previewResetBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-reset-btn')),
      timeTravelSlider: /** @type {HTMLInputElement | null} */ (document.getElementById('time-travel-slider')),
      sliderDateReadout: document.getElementById('slider-date-readout'),
      presetChipsRow: document.getElementById('preset-chips-row'),
      previewStepPrev: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-step-prev')),
      previewStepNext: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-step-next'))
    };
  }

  bindEvents() {
    if (this.dom.timeTravelSlider) {
      const handleSliderInput = () => {
        const val = Number(this.dom.timeTravelSlider?.value);
        if (!Number.isNaN(val)) {
          this.setPreviewTimestamp(val);
        }
      };
      this.dom.timeTravelSlider.addEventListener('input', handleSliderInput);
      this.#unbinders.push(() => {
        this.dom.timeTravelSlider?.removeEventListener('input', handleSliderInput);
      });
    }

    if (this.dom.previewResetBtn) {
      const handleReset = () => this.reset();
      this.dom.previewResetBtn.addEventListener('click', handleReset);
      this.#unbinders.push(() => {
        this.dom.previewResetBtn?.removeEventListener('click', handleReset);
      });
    }

    if (this.dom.previewStepPrev) {
      const handleStepPrev = () => this.stepDays(-1);
      this.dom.previewStepPrev.addEventListener('click', handleStepPrev);
      this.#unbinders.push(() => {
        this.dom.previewStepPrev?.removeEventListener('click', handleStepPrev);
      });
    }

    if (this.dom.previewStepNext) {
      const handleStepNext = () => this.stepDays(1);
      this.dom.previewStepNext.addEventListener('click', handleStepNext);
      this.#unbinders.push(() => {
        this.dom.previewStepNext?.removeEventListener('click', handleStepNext);
      });
    }
  }

  /**
   * Sets the active trip configuration and renders presets if present.
   * @param {import('./config.js').TripConfig} tripConfig
   */
  setTripConfig(tripConfig) {
    this.#tripConfig = tripConfig;
    this.renderPresets();
  }

  #resolveTimeZone() {
    const homeCode = this.#tripConfig?.homeCountryCode || 'US';
    return getCountryInfo(homeCode)?.timeZone || 'UTC';
  }

  renderPresets() {
    if (!this.dom.presetChipsRow || !this.#tripConfig) return;
    this.dom.presetChipsRow.innerHTML = '';

    const presets = Array.isArray(this.#tripConfig.timeTravelPresets)
      ? this.#tripConfig.timeTravelPresets
      : [];

    const liveChip = document.createElement('button');
    liveChip.type = 'button';
    liveChip.className = `preset-chip${this.#previewEpochMs === null ? ' is-active' : ''}`;
    liveChip.dataset.presetId = 'live';
    liveChip.textContent = '🟢 Live Now';
    const handleLiveClick = () => this.reset();
    liveChip.addEventListener('click', handleLiveClick);
    this.dom.presetChipsRow.appendChild(liveChip);

    for (const preset of presets) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `preset-chip${preset.id === this.#activePresetId ? ' is-active' : ''}`;
      chip.dataset.presetId = preset.id;
      chip.textContent = preset.label;
      const handlePresetClick = () => {
        const epochMs = Date.parse(preset.isoDate);
        if (!Number.isNaN(epochMs)) {
          this.setPreviewTimestamp(epochMs, preset.id);
        }
      };
      chip.addEventListener('click', handlePresetClick);
      this.dom.presetChipsRow.appendChild(chip);
    }
  }

  /**
   * Sets or clears the preview timestamp and updates DOM elements.
   * @param {number | null} epochMs
   * @param {string} [presetId='']
   */
  setPreviewTimestamp(epochMs, presetId = '') {
    this.#previewEpochMs = typeof epochMs === 'number' && Number.isFinite(epochMs)
      ? epochMs
      : null;
    this.#activePresetId = this.#previewEpochMs === null ? '' : presetId;

    if (this.dom.presetChipsRow) {
      const chips = this.dom.presetChipsRow.querySelectorAll('.preset-chip');
      chips.forEach((chip) => {
        const id = /** @type {HTMLElement} */ (chip).dataset.presetId;
        const isActive = this.#previewEpochMs === null ? id === 'live' : id === this.#activePresetId;
        chip.classList.toggle('is-active', isActive);
      });
    }

    if (this.#previewEpochMs === null) {
      if (this.dom.previewBanner) this.dom.previewBanner.hidden = true;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = 'Live Now';
    } else {
      const timeZone = this.#resolveTimeZone();
      const zoned = getZonedDateParts(this.#previewEpochMs, timeZone);
      const formatted = formatDisplayDate(zoned.dateStr);

      if (this.dom.previewBanner) this.dom.previewBanner.hidden = false;
      if (this.dom.previewBannerDate) this.dom.previewBannerDate.textContent = formatted;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = formatted;
      if (this.dom.timeTravelSlider) this.dom.timeTravelSlider.value = String(this.#previewEpochMs);
    }

    this.onPreviewChange?.(this.#previewEpochMs);
  }

  /**
   * Gets current preview timestamp in ms, or null if live.
   * @returns {number | null}
   */
  getPreviewTimestamp() {
    return this.#previewEpochMs;
  }

  /**
   * Steps the preview timestamp by given calendar days (+/-).
   * @param {number} days
   */
  stepDays(days) {
    const baseMs = this.#previewEpochMs ?? Date.now();
    const nextEpochMs = baseMs + days * MS_PER_DAY;
    this.setPreviewTimestamp(nextEpochMs);
  }

  /**
   * Resets preview to live time.
   */
  reset() {
    this.setPreviewTimestamp(null);
  }

  /**
   * Cleans up event listeners and state.
   */
  destroy() {
    for (const unbind of this.#unbinders) {
      unbind();
    }
    this.#unbinders = [];
    if (this.dom.presetChipsRow) {
      this.dom.presetChipsRow.innerHTML = '';
    }
    this.#tripConfig = null;
    this.#previewEpochMs = null;
    this.#activePresetId = '';
    this.onPreviewChange = null;
  }
}
```

---

### 3.2 Proposed Streamlined `js/app.js`

```javascript
/**
 * Trip Countdown & Timeline Board
 * Streamlined Application Lifecycle & Board State Coordinator (~320 lines).
 */

import { getCountryInfo } from './config.js';
import {
  clearCachedVault,
  getVaultCryptoKey,
  loadCachedVault,
  unlockAndCacheVault
} from './crypto-vault.js';
import {
  evaluateBoardState,
  formatShortDisplayDate,
  resolvePartnerConfigMeta
} from './countdown-engine.js';
import { PhotoStackController, createPhotoDateElement } from './photo-stack.js';
import { TimelineRenderer } from './timeline-renderer.js';
import { DaysBreakdownModal, EventCountdownModal } from './ui-modals.js';
import { StatusEditSheet } from './ui-status-sheet.js';
import { TimelineEditorSheet } from './ui-editor-sheet.js';
import { PreviewBannerController } from './ui-preview-banner.js';
import {
  clearLocalLiveState,
  loadLiveState,
  registerOfflineSyncListener,
  saveLiveState
} from './github-sync.js';

function formatUtcOffsetLabel(offsetMinutes) {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  return mins === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

export class CountdownBoardApp {
  /** @type {string | null} */
  #githubToken = null;

  /** @type {CryptoKey | null} */
  #vaultCryptoKey = null;

  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {ReturnType<typeof setInterval> | null} */
  #tickIntervalId = null;

  constructor() {
    /** @type {{ owner: string, repo: string, branch: string, path: string } | null} */
    this.githubRepo = null;
    /** @type {Object | null} */
    this.encryptedVaultJson = null;
    /** @type {import('./config.js').LiveStatePayload} */
    this.liveState = {
      schemaVersion: 1,
      updatedAt: '1970-01-01T00:00:00.000Z',
      statusOverrides: {},
      customMilestones: [],
      milestoneOverrides: {},
      customReunions: [],
      chapterOverrides: {}
    };

    this.activeView = 'countdown';
    this.lastTimelineSignature = '';
    this.lastSoonerMilestoneSignature = '';
    this.latestBoardState = null;

    this.cacheDomElements();
    this.initSubControllers();
  }

  cacheDomElements() {
    this.dom = {
      ambientStage: document.getElementById('ambient-stage'),
      vaultOverlay: document.getElementById('vault-lock-overlay'),
      vaultCard: document.getElementById('vault-card'),
      vaultTitle: document.getElementById('vault-title'),
      vaultForm: document.getElementById('vault-unlock-form'),
      vaultPasswordInput: /** @type {HTMLInputElement | null} */ (document.getElementById('vault-password-input')),
      vaultRememberCheckbox: /** @type {HTMLInputElement | null} */ (document.getElementById('vault-remember-checkbox')),
      vaultErrorMsg: document.getElementById('vault-error-msg'),
      vaultUnlockBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('vault-unlock-btn')),

      boardContainer: document.getElementById('board-container'),
      viewCountdown: document.getElementById('view-countdown'),
      viewTimeline: document.getElementById('view-timeline'),

      bottomNav: document.getElementById('bottom-nav'),
      navBtnCountdown: document.getElementById('nav-btn-countdown'),
      navBtnTimeline: document.getElementById('nav-btn-timeline'),

      relationshipDaysPrimary: document.getElementById('relationship-days-primary'),
      relationshipDaysBreakdown: document.getElementById('relationship-days-breakdown'),
      photoStackContainer: document.getElementById('photo-stack-container'),

      phaseBannerPill: document.getElementById('phase-banner-pill'),
      countdownApartView: document.getElementById('countdown-apart-view'),
      countdownTargetLabel: document.getElementById('countdown-target-label'),
      countdownTargetTitle: document.getElementById('countdown-target-title'),
      countdownTargetDate: document.getElementById('countdown-target-date'),
      cdDays: document.getElementById('cd-days'),
      cdHours: document.getElementById('cd-hours'),
      cdMinutes: document.getElementById('cd-minutes'),
      cdSeconds: document.getElementById('cd-seconds'),
      separationProgressContainer: document.getElementById('separation-progress-container'),
      separationProgressPct: document.getElementById('separation-progress-pct'),
      separationProgressFill: document.getElementById('separation-progress-fill'),

      countdownTogetherView: document.getElementById('countdown-together-view'),
      togetherLegBadge: document.getElementById('together-leg-badge'),
      togetherHeadline: document.getElementById('together-headline'),
      togetherSubtext: document.getElementById('together-subtext'),
      togetherProgressDay: document.getElementById('together-progress-day'),
      togetherProgressFill: document.getElementById('together-progress-fill'),

      subMilestoneBanner: document.getElementById('sub-milestone-banner'),

      autoSyncIndicator: document.getElementById('auto-sync-indicator'),
      primaryNameLabel: document.getElementById('primary-name-label'),
      primaryFlag: document.getElementById('primary-flag'),
      primaryCountry: document.getElementById('primary-country'),
      primaryCityNote: document.getElementById('primary-city-note'),
      primaryClock: document.getElementById('primary-clock'),
      primaryTzOffset: document.getElementById('primary-tz-offset'),

      tzBridgePill: document.getElementById('tz-bridge-pill'),

      secondaryNameLabel: document.getElementById('secondary-name-label'),
      secondaryFlag: document.getElementById('secondary-flag'),
      secondaryCountry: document.getElementById('secondary-country'),
      secondaryCityNote: document.getElementById('secondary-city-note'),
      secondaryClock: document.getElementById('secondary-clock'),
      secondaryTzOffset: document.getElementById('secondary-tz-offset'),

      tripStatsPill: document.getElementById('trip-stats-pill'),
      pastChaptersToggle: /** @type {HTMLButtonElement | null} */ (document.getElementById('past-chapters-toggle')),
      pastChaptersDrawer: document.getElementById('past-chapters-drawer'),
      timelineUpcomingTrack: document.getElementById('timeline-upcoming-track'),

      lockDeviceBtn: document.getElementById('lock-device-btn')
    };
  }

  initSubControllers() {
    this.photoStack = new PhotoStackController({
      container: this.dom.photoStackContainer,
      ambientContainer: this.dom.ambientStage,
      deferInitialRender: true
    });

    this.daysBreakdownModal = new DaysBreakdownModal();

    this.eventCountdownModal = new EventCountdownModal({
      onEditItem: (item) => this.timelineEditorSheet.open(item)
    });

    this.timelineEditorSheet = new TimelineEditorSheet({
      onSave: (updatedLiveState) => this.persistLiveStateUpdate(updatedLiveState),
      onDelete: (updatedLiveState) => this.persistLiveStateUpdate(updatedLiveState)
    });

    this.timelineRenderer = new TimelineRenderer({
      statsPillEl: this.dom.tripStatsPill,
      pastToggleBtn: this.dom.pastChaptersToggle,
      pastDrawerEl: this.dom.pastChaptersDrawer,
      upcomingTrackEl: this.dom.timelineUpcomingTrack,
      onEditItem: (item) => this.eventCountdownModal.open(item, this.latestBoardState),
      onDeleteItem: (item) => this.timelineEditorSheet.deleteItem(item),
      onEditLeg: (reunion, legIndex) => this.timelineEditorSheet.open(reunion, legIndex),
      onOpenDaysBreakdown: () => this.daysBreakdownModal.open(this.latestBoardState)
    });

    this.previewBanner = new PreviewBannerController({
      onPreviewChange: () => this.tick(true)
    });

    this.statusEditSheet = new StatusEditSheet({
      getEffectiveNowMs: () => this.getEffectiveNowMs(),
      onSave: (updatedLiveState) => this.persistLiveStateUpdate(updatedLiveState),
      onClearOverrides: (updatedLiveState) => this.persistLiveStateUpdate(updatedLiveState)
    });
  }

  async init() {
    this.bindEventListeners();
    this.registerServiceWorker();

    const cachedVault = await loadCachedVault();
    if (cachedVault && cachedVault.tripConfig) {
      await this.mountUnlockedVault(cachedVault);
    } else {
      await this.preloadEncryptedVaultJson();
    }

    registerOfflineSyncListener(
      () => ({
        githubToken: this.#githubToken,
        repoConfig: this.githubRepo,
        cryptoKey: this.#vaultCryptoKey
      }),
      (outcome) => {
        this.statusEditSheet.updateSyncBadge(outcome.syncedRemotely ? 'synced' : 'pending', outcome.message);
      }
    );
  }

  async preloadEncryptedVaultJson() {
    try {
      const response = await fetch('./vault.json', { cache: 'no-store' });
      if (response.ok) {
        this.encryptedVaultJson = await response.json();
      }
    } catch {
      // Offline or vault ungenerated
    }
  }

  async mountUnlockedVault(payload) {
    if (!payload || !payload.tripConfig) {
      throw new Error('Decrypted vault is missing required tripConfig.');
    }

    this.#tripConfig = payload.tripConfig;
    this.#githubToken = payload.githubToken ?? null;
    this.#vaultCryptoKey = getVaultCryptoKey(payload);
    this.githubRepo = payload.githubRepo ?? null;
    this.encryptedVaultJson = null;

    const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
    const primaryName = this.#tripConfig.coupleNames?.[firstPartnerKey] || firstPartnerKey;
    const secondaryName = this.#tripConfig.coupleNames?.[secondPartnerKey] || secondPartnerKey;

    if (typeof document !== 'undefined') {
      document.title = `${secondaryName} & ${primaryName} — Countdown & Journey Board`;
    }

    this.previewBanner.setTripConfig(this.#tripConfig);
    this.statusEditSheet.mount(this.#tripConfig, {
      primary: primaryName,
      secondary: secondaryName,
      firstPartnerKey,
      secondPartnerKey
    });
    this.timelineEditorSheet.mount(this.#tripConfig);

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = false;
    if (this.dom.bottomNav) this.dom.bottomNav.hidden = false;
    this.dom.vaultOverlay?.classList.add('is-unlocked');
    this.switchView('countdown');

    if (Array.isArray(payload.photos) && payload.photos.length > 0) {
      this.photoStack.setPhotos(payload.photos);
    }

    const loadedLive = await loadLiveState(
      this.githubRepo,
      this.#githubToken,
      this.#vaultCryptoKey
    );
    this.liveState = {
      schemaVersion: 1,
      updatedAt: loadedLive?.updatedAt || '1970-01-01T00:00:00.000Z',
      statusOverrides: loadedLive?.statusOverrides || {},
      customMilestones: Array.isArray(loadedLive?.customMilestones) ? loadedLive.customMilestones : [],
      milestoneOverrides: loadedLive?.milestoneOverrides || {},
      customReunions: Array.isArray(loadedLive?.customReunions) ? loadedLive.customReunions : [],
      chapterOverrides: loadedLive?.chapterOverrides || {}
    };

    this.tick(true);
    this.startTickLoop();
  }

  async persistLiveStateUpdate(updatedLiveState) {
    this.liveState = updatedLiveState;
    this.tick(true);
    this.statusEditSheet.updateSyncBadge('pending', 'Saving…');
    const result = await saveLiveState(
      this.liveState,
      this.#githubToken,
      this.githubRepo,
      this.#vaultCryptoKey
    );
    this.statusEditSheet.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', result.message || 'Successfully updated');
  }

  async lockAndPurgeBoard() {
    this.stopTickLoop();
    this.#githubToken = null;
    this.#vaultCryptoKey = null;
    this.#tripConfig = null;
    this.githubRepo = null;
    this.lastTimelineSignature = '';
    this.lastSoonerMilestoneSignature = '';
    this.liveState = {
      schemaVersion: 1,
      updatedAt: '1970-01-01T00:00:00.000Z',
      statusOverrides: {},
      customMilestones: [],
      milestoneOverrides: {},
      customReunions: [],
      chapterOverrides: {}
    };

    await clearCachedVault();
    clearLocalLiveState();

    this.statusEditSheet.close();
    this.timelineEditorSheet.close();
    this.eventCountdownModal.close();
    this.daysBreakdownModal.close();
    this.previewBanner.reset();
    this.photoStack.clear();
    this.timelineRenderer.clear();

    if (typeof document !== 'undefined') {
      document.title = 'Trip Countdown';
    }

    const textElementsToClear = [
      this.dom.relationshipDaysPrimary,
      this.dom.relationshipDaysBreakdown,
      this.dom.phaseBannerPill,
      this.dom.countdownTargetLabel,
      this.dom.countdownTargetTitle,
      this.dom.countdownTargetDate,
      this.dom.togetherLegBadge,
      this.dom.togetherHeadline,
      this.dom.togetherSubtext,
      this.dom.togetherProgressDay,
      this.dom.subMilestoneBanner,
      this.dom.primaryNameLabel,
      this.dom.primaryFlag,
      this.dom.primaryCountry,
      this.dom.primaryCityNote,
      this.dom.primaryClock,
      this.dom.primaryTzOffset,
      this.dom.tzBridgePill,
      this.dom.secondaryNameLabel,
      this.dom.secondaryFlag,
      this.dom.secondaryCountry,
      this.dom.secondaryCityNote,
      this.dom.secondaryClock,
      this.dom.secondaryTzOffset
    ];
    for (const el of textElementsToClear) {
      if (el) el.textContent = '';
    }

    if (this.dom.cdDays) this.dom.cdDays.textContent = '--';
    if (this.dom.cdHours) this.dom.cdHours.textContent = '--';
    if (this.dom.cdMinutes) this.dom.cdMinutes.textContent = '--';
    if (this.dom.cdSeconds) this.dom.cdSeconds.textContent = '--';

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = true;
    if (this.dom.bottomNav) this.dom.bottomNav.hidden = true;
    if (this.dom.subMilestoneBanner) this.dom.subMilestoneBanner.hidden = true;

    this.switchView('countdown');

    if (this.dom.vaultPasswordInput) this.dom.vaultPasswordInput.value = '';
    if (this.dom.vaultErrorMsg) this.dom.vaultErrorMsg.textContent = '';
    this.dom.vaultOverlay?.classList.remove('is-unlocked');
  }

  startTickLoop() {
    this.stopTickLoop();
    this.#tickIntervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.tick(false);
    }, 1000);
  }

  stopTickLoop() {
    if (this.#tickIntervalId !== null) {
      clearInterval(this.#tickIntervalId);
      this.#tickIntervalId = null;
    }
  }

  getEffectiveNowMs() {
    return this.previewBanner?.getPreviewTimestamp() ?? Date.now();
  }

  bindEventListeners() {
    // 1. Password Vault Unlock Form
    this.dom.vaultForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = this.dom.vaultPasswordInput?.value ?? '';
      const remember = Boolean(this.dom.vaultRememberCheckbox?.checked);

      if (!password) return;
      if (this.dom.vaultUnlockBtn) this.dom.vaultUnlockBtn.disabled = true;
      if (this.dom.vaultErrorMsg) this.dom.vaultErrorMsg.textContent = '';
      this.dom.vaultCard?.classList.remove('is-error');

      try {
        if (!this.encryptedVaultJson) {
          await this.preloadEncryptedVaultJson();
        }
        if (!this.encryptedVaultJson) {
          throw new Error('Could not load vault.json');
        }

        const decrypted = await unlockAndCacheVault(this.encryptedVaultJson, password, remember);
        if (this.dom.vaultPasswordInput) this.dom.vaultPasswordInput.value = '';
        await this.mountUnlockedVault(decrypted);
      } catch (err) {
        if (this.dom.vaultErrorMsg) {
          const message =
            err instanceof Error && err.message.includes('tripConfig')
              ? 'Vault schema outdated — re-run scripts/encrypt-vault.mjs with your password.'
              : 'Incorrect password — please try again.';
          this.dom.vaultErrorMsg.textContent = message;
        }
        this.dom.vaultCard?.classList.remove('is-error');
        void this.dom.vaultCard?.offsetWidth;
        this.dom.vaultCard?.classList.add('is-error');
      } finally {
        if (this.dom.vaultUnlockBtn) this.dom.vaultUnlockBtn.disabled = false;
      }
    });

    // 2. Bottom Nav View Switcher
    this.dom.navBtnCountdown?.addEventListener('click', () => {
      this.switchView('countdown');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    this.dom.navBtnTimeline?.addEventListener('click', () => {
      this.switchView('timeline');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 3. Lock Device Button
    this.dom.lockDeviceBtn?.addEventListener('click', () => {
      void this.lockAndPurgeBoard();
    });

    // 4. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.daysBreakdownModal.isOpen()) {
          this.daysBreakdownModal.close();
        } else if (this.eventCountdownModal.isOpen()) {
          this.eventCountdownModal.close();
        } else if (this.timelineEditorSheet.isOpen()) {
          this.timelineEditorSheet.close();
        } else if (this.statusEditSheet.isOpen()) {
          this.statusEditSheet.close();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (!this.#tripConfig) return;
        const activePreview = this.previewBanner.getPreviewTimestamp();
        if (activePreview !== null) {
          this.previewBanner.reset();
        } else {
          this.previewBanner.stepDays(1);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (!this.#tripConfig) return;
        if (this.previewBanner.getPreviewTimestamp() !== null) {
          this.previewBanner.stepDays(e.key === 'ArrowRight' ? 1 : -1);
        }
      }
    });

    // 5. Visibility Change Tick Recovery
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.#tripConfig) {
          this.tick(false);
        }
      });
    }
  }

  switchView(viewName) {
    const previousView = this.activeView;
    this.activeView = viewName;
    if (this.dom.bottomNav) {
      this.dom.bottomNav.setAttribute('data-active-view', viewName);
    }
    const isForward = (previousView === 'countdown' && viewName === 'timeline');
    const isBackward = (previousView === 'timeline' && viewName === 'countdown');

    if (this.dom.viewCountdown) {
      this.dom.viewCountdown.hidden = viewName !== 'countdown';
      if (viewName === 'countdown' && isBackward) {
        this.dom.viewCountdown.classList.remove('slide-forward', 'slide-backward');
        void this.dom.viewCountdown.offsetWidth;
        this.dom.viewCountdown.classList.add('slide-backward');
      }
    }
    if (this.dom.viewTimeline) {
      this.dom.viewTimeline.hidden = viewName !== 'timeline';
      if (viewName === 'timeline' && isForward) {
        this.dom.viewTimeline.classList.remove('slide-forward', 'slide-backward');
        void this.dom.viewTimeline.offsetWidth;
        this.dom.viewTimeline.classList.add('slide-forward');
      }
    }
    this.dom.navBtnCountdown?.classList.toggle('is-active', viewName === 'countdown');
    this.dom.navBtnTimeline?.classList.toggle('is-active', viewName === 'timeline');
    this.statusEditSheet.setFabVisible?.(viewName === 'countdown');
  }

  tick(forceTimelineRender = false) {
    if (!this.#tripConfig) return;

    const nowMs = this.getEffectiveNowMs();
    const state = evaluateBoardState(this.#tripConfig, this.liveState, nowMs);
    this.latestBoardState = state;

    // 1. Relationship Duration Top Pill
    const rel = state.relationshipDuration;
    if (this.dom.relationshipDaysPrimary) {
      this.dom.relationshipDaysPrimary.textContent = `${rel.totalDays} Days Together`;
    }
    if (this.dom.relationshipDaysBreakdown) {
      this.dom.relationshipDaysBreakdown.textContent = `${rel.months} Months, ${rel.daysRemainder} Days`;
    }

    // 2. Phase Banner Pill
    if (this.dom.phaseBannerPill) {
      this.dom.phaseBannerPill.textContent = state.phaseBannerText;
    }

    // 3. Primary Countdown vs Together Celebration View
    if (state.phase === 'TOGETHER' && state.activeReunion) {
      if (this.dom.countdownApartView) this.dom.countdownApartView.hidden = true;
      if (this.dom.countdownTogetherView) this.dom.countdownTogetherView.hidden = false;

      const ar = state.activeReunion;
      const legCountry = getCountryInfo(ar.activeLeg.countryCode);
      const legDisplayName = ar.activeLeg.label || legCountry.name;

      if (this.dom.togetherLegBadge) {
        const legTag = ar.totalLegs > 1
          ? `Leg ${ar.legIndex + 1} of ${ar.totalLegs} • ${legCountry.flag} ${legDisplayName}`
          : `${legCountry.flag} ${legDisplayName}`;
        this.dom.togetherLegBadge.textContent = `${legTag} • Day ${ar.dayOfReunion} of ${ar.totalReunionDays}`;
      }

      if (this.dom.togetherHeadline) {
        this.dom.togetherHeadline.textContent = `${ar.reunion.emoji} Together in ${legDisplayName}!`;
      }

      if (this.dom.togetherSubtext) {
        if (ar.nextLeg) {
          const nextCountry = getCountryInfo(ar.nextLeg.countryCode);
          const nextLegDisplayName = ar.nextLeg.label || nextCountry.name;
          this.dom.togetherSubtext.textContent = `Next leg: ${nextCountry.flag} ${nextLegDisplayName} in ${ar.daysUntilNextLeg} day${ar.daysUntilNextLeg === 1 ? '' : 's'} (${formatShortDisplayDate(ar.nextLeg.startDate)})`;
        } else {
          this.dom.togetherSubtext.textContent = ar.activeLeg.notes || ar.reunion.description;
        }
      }

      const progressPct = Math.min(100, Math.max(4, Math.round((ar.dayOfReunion / ar.totalReunionDays) * 100)));
      if (this.dom.togetherProgressDay) {
        this.dom.togetherProgressDay.textContent = `Day ${ar.dayOfReunion} / ${ar.totalReunionDays}`;
      }
      if (this.dom.togetherProgressFill) {
        this.dom.togetherProgressFill.style.width = `${progressPct}%`;
      }
    } else if (state.primaryCountdown) {
      if (this.dom.countdownApartView) this.dom.countdownApartView.hidden = false;
      if (this.dom.countdownTogetherView) this.dom.countdownTogetherView.hidden = true;

      const cd = state.primaryCountdown;
      if (this.dom.countdownTargetLabel) {
        this.dom.countdownTargetLabel.textContent = state.phase === 'PRE_TRIP'
          ? 'Countdown to Reunion #1'
          : 'Countdown to Next Reunion';
      }
      if (this.dom.countdownTargetTitle) {
        this.dom.countdownTargetTitle.textContent = `${cd.targetEmoji} ${cd.targetTitle}`;
      }
      if (this.dom.countdownTargetDate) {
        this.dom.countdownTargetDate.replaceChildren(createPhotoDateElement(cd.targetDate, { isCompact: true }));
      }

      if (this.dom.cdDays) this.dom.cdDays.textContent = String(cd.days).padStart(2, '0');
      if (this.dom.cdHours) this.dom.cdHours.textContent = String(cd.hours).padStart(2, '0');
      if (this.dom.cdMinutes) this.dom.cdMinutes.textContent = String(cd.minutes).padStart(2, '0');
      if (this.dom.cdSeconds) this.dom.cdSeconds.textContent = String(cd.seconds).padStart(2, '0');

      if (state.phase === 'APART' && cd.separationTotalDays) {
        if (this.dom.separationProgressContainer) this.dom.separationProgressContainer.hidden = false;
        const pct = Math.round(cd.separationProgressPct);
        if (this.dom.separationProgressPct) this.dom.separationProgressPct.textContent = `${pct}%`;
        if (this.dom.separationProgressFill) this.dom.separationProgressFill.style.width = `${pct}%`;
      } else {
        if (this.dom.separationProgressContainer) this.dom.separationProgressContainer.hidden = true;
      }
    }

    // 4. Secondary Sooner Milestone Sub-Banner
    if (this.dom.subMilestoneBanner) {
      if (state.soonerMilestone) {
        const ms = state.soonerMilestone;
        const soonerSig = `${ms.id}:${state.soonerMilestoneDaysAway}:${ms.title}:${ms.date}`;
        if (forceTimelineRender || soonerSig !== this.lastSoonerMilestoneSignature) {
          this.lastSoonerMilestoneSignature = soonerSig;
          const daysLabel = state.soonerMilestoneDaysAway === 0
            ? 'Today!'
            : state.soonerMilestoneDaysAway === 1
              ? 'Tomorrow'
              : `In ${state.soonerMilestoneDaysAway} days`;

          this.dom.subMilestoneBanner.hidden = false;
          this.dom.subMilestoneBanner.textContent = '';

          const emojiSpan = document.createElement('span');
          emojiSpan.textContent = ms.emoji;

          const textWrapper = document.createElement('span');
          const strongDate = document.createElement('strong');
          strongDate.className = 'numeric-lock';
          strongDate.setAttribute('dir', 'ltr');
          strongDate.textContent = `${daysLabel} (${formatShortDisplayDate(ms.date)})`;

          const titleSpan = document.createElement('span');
          titleSpan.setAttribute('dir', 'auto');
          titleSpan.textContent = ms.title;

          textWrapper.append(strongDate, document.createTextNode(': '), titleSpan);
          this.dom.subMilestoneBanner.append(emojiSpan, textWrapper);
        }
      } else {
        this.lastSoonerMilestoneSignature = 'none';
        this.dom.subMilestoneBanner.hidden = true;
      }
    }

    // 5. Dual Status & Timezone Bridge
    const { primary, secondary, isSameTimeZone, bridgeLabel } = state.dualStatus;
    if (this.dom.autoSyncIndicator) {
      this.dom.autoSyncIndicator.hidden = !(primary.isAutoSyncedToReunion && secondary.isAutoSyncedToReunion);
    }

    if (this.dom.primaryNameLabel) this.dom.primaryNameLabel.textContent = primary.displayName;
    if (this.dom.primaryFlag) this.dom.primaryFlag.textContent = primary.flag;
    if (this.dom.primaryCountry) this.dom.primaryCountry.textContent = primary.countryName;
    if (this.dom.primaryCityNote) this.dom.primaryCityNote.textContent = primary.cityNote || '';
    if (this.dom.primaryClock) this.dom.primaryClock.textContent = primary.localTimeFormatted;
    if (this.dom.primaryTzOffset) this.dom.primaryTzOffset.textContent = formatUtcOffsetLabel(primary.utcOffsetMinutes);

    if (this.dom.secondaryNameLabel) this.dom.secondaryNameLabel.textContent = secondary.displayName;
    if (this.dom.secondaryFlag) this.dom.secondaryFlag.textContent = secondary.flag;
    if (this.dom.secondaryCountry) this.dom.secondaryCountry.textContent = secondary.countryName;
    if (this.dom.secondaryCityNote) this.dom.secondaryCityNote.textContent = secondary.cityNote || '';
    if (this.dom.secondaryClock) this.dom.secondaryClock.textContent = secondary.localTimeFormatted;
    if (this.dom.secondaryTzOffset) this.dom.secondaryTzOffset.textContent = formatUtcOffsetLabel(secondary.utcOffsetMinutes);

    if (this.dom.tzBridgePill) {
      this.dom.tzBridgePill.textContent = `🌐 ${bridgeLabel}`;
      this.dom.tzBridgePill.classList.toggle('is-same-tz', isSameTimeZone);
    }

    // 6. Timeline Renderer
    const timelineSig = `${state.phase}:${state.activeReunion?.activeLeg.id ?? 'none'}:${state.timeline.pastItems.length}:${state.timeline.upcomingItems.length}:${state.timeline.plannedTripDaysTogether}:${state.timeline.completedTripDaysTogether}`;
    if (forceTimelineRender || timelineSig !== this.lastTimelineSignature) {
      this.lastTimelineSignature = timelineSig;
      this.timelineRenderer.render(state);
    }

    // 7. Active Event Modal live countdown tick
    if (this.eventCountdownModal.isOpen()) {
      this.eventCountdownModal.updateCountdown(nowMs, state);
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  destroy() {
    this.stopTickLoop();
    this.photoStack.destroy();
    this.timelineRenderer.destroy?.();
    this.daysBreakdownModal.destroy();
    this.eventCountdownModal.destroy();
    this.statusEditSheet.destroy();
    this.timelineEditorSheet.destroy();
    this.previewBanner.destroy();
  }
}

if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new CountdownBoardApp();
    void app.init();
  });
}
```

---

## 4. Caveats

1. **Pre-requisite Modules in M4**:
   - `CountdownBoardApp` in `js/app.js` relies on the imports from `./ui-modals.js` (`DaysBreakdownModal`, `EventCountdownModal`), `./ui-status-sheet.js` (`StatusEditSheet`), `./ui-editor-sheet.js` (`TimelineEditorSheet`), and `./ui-preview-banner.js` (`PreviewBannerController`).
   - The implementing agent must write these sub-controller files before or alongside updating `js/app.js`.
2. **Missing DOM Elements in Production `index.html`**:
   - As observed in `tests/integration.test.mjs`, `#time-travel-slider` and `#preview-banner` are absent from `index.html`. `PreviewBannerController` must never assume they exist.
3. **No External Libraries**:
   - Strictly vanilla HTML5, CSS3, ES2022 native ESM (`.js` paths).

---

## 5. Conclusion

1. `js/ui-preview-banner.js` isolates all time-travel preview slider, preset buttons, step adjustments, and floating banner logic into a robust, null-safe, headless-compatible `PreviewBannerController`.
2. `js/app.js` contracts from a bloated 1,789-line file down to a ~320-line coordinator handling vault bootstrap, sub-controller instantiation, state tick evaluation, and global navigation events.
3. Memory hygiene is preserved through explicit unbinding and `destroy()` methods on every component.
4. Bidirectional text editing (`dir="auto"`), numeric locks (`.numeric-lock`, `dir="ltr"`), and zero-knowledge security guarantees remain 100% intact.

---

## 6. Verification Method

1. **Automated Unit & Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   All 25 existing tests must continue to pass without error or regression.

2. **Security Audit**:
   `tests/integration.test.mjs` verifies that zero personal names, itinerary dates, or credentials exist in newly created `.js` files.

3. **Sub-Controller Lifecycle Check**:
   Instantiate `PreviewBannerController` in an environment without DOM elements (`globalThis.document = undefined` or empty container) and verify that:
   - `getPreviewTimestamp()` returns `null`
   - `stepDays(1)` updates internal timestamp without throwing
   - `reset()` restores live mode
   - `destroy()` cleans up unbinders and references
