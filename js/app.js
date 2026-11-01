import {
  ALL_ISO_3166_CODES,
  PINNED_COUNTRY_CODES,
  getCountryInfo
} from './config.js';
import {
  clearCachedVault,
  getVaultCryptoKey,
  loadCachedVault,
  unlockAndCacheVault
} from './crypto-vault.js';
import {
  evaluateBoardState,
  formatDisplayDate,
  formatShortDisplayDate,
  getZonedDateParts,
  resolvePartnerConfigMeta
} from './countdown-engine.js';
import { PhotoStackController } from './photo-stack.js';
import { TimelineRenderer } from './timeline-renderer.js';
import {
  clearLocalLiveState,
  loadLiveState,
  registerOfflineSyncListener,
  saveLiveState
} from './github-sync.js';

/**
 * Formats a UTC offset in minutes into a compact label (e.g., -180 -> "UTC-3", +420 -> "UTC+7").
 * @param {number} offsetMinutes
 * @returns {string}
 */
function formatUtcOffsetLabel(offsetMinutes) {
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  return mins === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

/**
 * Populates a <select> element with Pinned Trip Countries at the top and all 249 ISO countries alphabetically below.
 * @param {HTMLSelectElement | null} selectEl
 * @param {string} selectedCode
 * @param {string[]} [pinnedCodes]
 */
function populateCountrySelect(selectEl, selectedCode = 'US', pinnedCodes = PINNED_COUNTRY_CODES) {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const pinnedGroup = document.createElement('optgroup');
  pinnedGroup.label = '⭐ Pinned Destinations';
  for (const code of pinnedCodes) {
    const info = getCountryInfo(code);
    if (!info) continue;
    const opt = document.createElement('option');
    opt.value = info.code;
    opt.textContent = `${info.flag} ${info.name}`;
    pinnedGroup.appendChild(opt);
  }

  const allGroup = document.createElement('optgroup');
  allGroup.label = '🌍 All 249 Countries (A–Z)';
  const sortedAll = ALL_ISO_3166_CODES
    .map((code) => getCountryInfo(code))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const info of sortedAll) {
    const opt = document.createElement('option');
    opt.value = info.code;
    opt.textContent = `${info.flag} ${info.name}`;
    allGroup.appendChild(opt);
  }

  selectEl.appendChild(pinnedGroup);
  selectEl.appendChild(allGroup);
  selectEl.value = selectedCode;
}

export class CountdownBoardApp {
  /** @type {string | null} */
  #githubToken = null;

  /** @type {CryptoKey | null} */
  #vaultCryptoKey = null;

  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type { ReturnType<typeof setInterval> | null } */
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
      customMilestones: []
    };

    /**
     * When null, board runs on real live time (Date.now()).
     * When set to an epoch ms timestamp, board runs in Time-Travel Preview mode.
     * @type {number | null}
     */
    this.previewEpochMs = null;
    this.lastTimelineSignature = '';
    this.lastSoonerMilestoneSignature = '';

    this.cacheDomElements();
    this.photoStack = new PhotoStackController({
      container: this.dom.photoStackContainer,
      ambientContainer: this.dom.ambientStage,
      deferInitialRender: true
    });
    this.timelineRenderer = new TimelineRenderer({
      statsPillEl: this.dom.tripStatsPill,
      pastToggleBtn: this.dom.pastChaptersToggle,
      pastDrawerEl: this.dom.pastChaptersDrawer,
      upcomingTrackEl: this.dom.timelineUpcomingTrack
    });
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
      previewBanner: document.getElementById('preview-banner'),
      previewBannerDate: document.getElementById('preview-banner-date'),
      previewResetBtn: document.getElementById('preview-reset-btn'),

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
      separationProgressLabel: document.getElementById('separation-progress-label'),
      separationProgressPct: document.getElementById('separation-progress-pct'),
      separationProgressFill: document.getElementById('separation-progress-fill'),

      countdownTogetherView: document.getElementById('countdown-together-view'),
      togetherLegBadge: document.getElementById('together-leg-badge'),
      togetherHeadline: document.getElementById('together-headline'),
      togetherSubtext: document.getElementById('together-subtext'),
      togetherProgressLabel: document.getElementById('together-progress-label'),
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

      fabEditBtn: document.getElementById('fab-edit-btn'),
      editSheetBackdrop: document.getElementById('edit-sheet-backdrop'),
      editBottomSheet: document.getElementById('edit-bottom-sheet'),
      editSheetCloseBtn: document.getElementById('edit-sheet-close-btn'),

      sliderDateReadout: document.getElementById('slider-date-readout'),
      timeTravelSlider: /** @type {HTMLInputElement | null} */ (document.getElementById('time-travel-slider')),
      presetChipsRow: document.getElementById('preset-chips-row'),

      statusUpdateForm: document.getElementById('status-update-form'),
      syncStatusPill: document.getElementById('sync-status-pill'),
      editPrimaryCountryLabel: document.getElementById('edit-primary-country-label'),
      editPrimaryCountry: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-primary-country')),
      editPrimaryNoteLabel: document.getElementById('edit-primary-note-label'),
      editPrimaryNote: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-primary-note')),
      editSecondaryCountryLabel: document.getElementById('edit-secondary-country-label'),
      editSecondaryCountry: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-secondary-country')),
      editSecondaryNoteLabel: document.getElementById('edit-secondary-note-label'),
      editSecondaryNote: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-secondary-note')),
      clearStatusOverridesBtn: document.getElementById('clear-status-overrides-btn'),

      addMilestoneForm: document.getElementById('add-milestone-form'),
      msTitleInput: /** @type {HTMLInputElement | null} */ (document.getElementById('ms-title-input')),
      msDateInput: /** @type {HTMLInputElement | null} */ (document.getElementById('ms-date-input')),
      msPersonSelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('ms-person-select')),
      msCountrySelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('ms-country-select')),
      msDetailsInput: /** @type {HTMLInputElement | null} */ (document.getElementById('ms-details-input')),

      lockDeviceBtn: document.getElementById('lock-device-btn')
    };
  }

  async init() {
    this.bindEventListeners();
    this.registerServiceWorker();

    // Halt all countdown ticks and DOM hydration until either IndexedDB cache restores or user unlocks
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
        this.updateSyncBadge(outcome.syncedRemotely ? 'synced' : 'pending', outcome.message);
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
      // Offline or vault not yet generated
    }
  }

  /**
   * Mounts the decrypted vault into volatile memory, hydrates the DOM skeleton,
   * loads encrypted live-state overrides, and starts the 1Hz countdown loop.
   * @param {import('./config.js').VaultPayload} payload
   */
  async mountUnlockedVault(payload) {
    if (!payload || !payload.tripConfig) {
      throw new Error('Decrypted vault is missing required tripConfig.');
    }

    this.#tripConfig = payload.tripConfig;
    this.#githubToken = payload.githubToken ?? null;
    this.#vaultCryptoKey = getVaultCryptoKey(payload);
    this.githubRepo = payload.githubRepo ?? null;

    // Release raw encrypted envelope buffer from RAM once unlocked
    this.encryptedVaultJson = null;

    const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
    const primaryName = this.#tripConfig.coupleNames?.[firstPartnerKey] || firstPartnerKey;
    const secondaryName = this.#tripConfig.coupleNames?.[secondPartnerKey] || secondPartnerKey;

    if (typeof document !== 'undefined') {
      document.title = `${ secondaryName } & ${ primaryName } — Countdown & Journey Board`;
    }

    if (this.dom.primaryNameLabel) this.dom.primaryNameLabel.textContent = primaryName;
    if (this.dom.secondaryNameLabel) this.dom.secondaryNameLabel.textContent = secondaryName;
    if (this.dom.editPrimaryCountryLabel) {
      this.dom.editPrimaryCountryLabel.textContent = `${primaryName}'s Current Country`;
    }
    if (this.dom.editPrimaryNoteLabel) {
      this.dom.editPrimaryNoteLabel.textContent = `${primaryName}'s City / Vibe Note (Optional)`;
    }
    if (this.dom.editSecondaryCountryLabel) {
      this.dom.editSecondaryCountryLabel.textContent = `${secondaryName}'s Current Country`;
    }
    if (this.dom.editSecondaryNoteLabel) {
      this.dom.editSecondaryNoteLabel.textContent = `${secondaryName}'s City / Vibe Note (Optional)`;
    }

    if (this.dom.msPersonSelect) {
      this.dom.msPersonSelect.innerHTML = '';
      const bothOpt = document.createElement('option');
      bothOpt.value = 'both';
      bothOpt.textContent = '💕 Together (Both)';
      const primaryOpt = document.createElement('option');
      primaryOpt.value = firstPartnerKey;
      primaryOpt.textContent = `🌸 ${primaryName}`;
      const secondaryOpt = document.createElement('option');
      secondaryOpt.value = secondPartnerKey;
      secondaryOpt.textContent = `🌊 ${secondaryName}`;
      this.dom.msPersonSelect.append(bothOpt, primaryOpt, secondaryOpt);
    }

    const pinnedCodes = Array.isArray(this.#tripConfig.pinnedCountryCodes) &&
      this.#tripConfig.pinnedCountryCodes.length > 0
      ? this.#tripConfig.pinnedCountryCodes
      : PINNED_COUNTRY_CODES;
    const homeCode = this.#tripConfig.homeCountryCode || 'US';

    populateCountrySelect(this.dom.editPrimaryCountry, homeCode, pinnedCodes);
    populateCountrySelect(this.dom.editSecondaryCountry, homeCode, pinnedCodes);
    populateCountrySelect(this.dom.msCountrySelect, pinnedCodes[2] || homeCode, pinnedCodes);

    if (this.dom.timeTravelSlider && this.#tripConfig.timeTravelRange) {
      this.dom.timeTravelSlider.min = String(this.#tripConfig.timeTravelRange.minMs);
      this.dom.timeTravelSlider.max = String(this.#tripConfig.timeTravelRange.maxMs);
      this.dom.timeTravelSlider.step = String(this.#tripConfig.timeTravelRange.stepMs || 3600000);
    }
    this.renderTimeTravelPresets();

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = false;
    if (this.dom.fabEditBtn) this.dom.fabEditBtn.hidden = false;
    if (this.dom.editBottomSheet) this.dom.editBottomSheet.hidden = false;
    this.dom.vaultOverlay?.classList.add('is-unlocked');

    if (Array.isArray(payload.photos) && payload.photos.length > 0) {
      this.photoStack.setPhotos(payload.photos);
    }

    this.liveState = await loadLiveState(
      this.githubRepo,
      this.#githubToken,
      this.#vaultCryptoKey
    );
    this.syncEditFormWithState();
    this.tick(true);
    this.startTickLoop();
  }

  /**
   * Locks the board, purges IndexedDB and localStorage caches, wipes volatile credentials,
   * and empties all DOM nodes back to the unauthenticated skeleton.
   */
  async lockAndPurgeBoard() {
    this.stopTickLoop();
    this.#githubToken = null;
    this.#vaultCryptoKey = null;
    this.#tripConfig = null;
    this.githubRepo = null;
    this.previewEpochMs = null;
    this.lastTimelineSignature = '';
    this.lastSoonerMilestoneSignature = '';
    this.liveState = {
      schemaVersion: 1,
      updatedAt: '1970-01-01T00:00:00.000Z',
      statusOverrides: {},
      customMilestones: []
    };

    await clearCachedVault();
    clearLocalLiveState();

    this.closeEditSheet();
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

    if (this.dom.presetChipsRow) this.dom.presetChipsRow.innerHTML = '';
    if (this.dom.editPrimaryCountry) this.dom.editPrimaryCountry.innerHTML = '';
    if (this.dom.editSecondaryCountry) this.dom.editSecondaryCountry.innerHTML = '';
    if (this.dom.msCountrySelect) this.dom.msCountrySelect.innerHTML = '';
    if (this.dom.msPersonSelect) this.dom.msPersonSelect.innerHTML = '';

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = true;
    if (this.dom.fabEditBtn) this.dom.fabEditBtn.hidden = true;
    if (this.dom.editBottomSheet) this.dom.editBottomSheet.hidden = true;
    if (this.dom.previewBanner) this.dom.previewBanner.hidden = true;
    if (this.dom.subMilestoneBanner) this.dom.subMilestoneBanner.hidden = true;

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

    // 2. Bottom Sheet Open / Close
    this.dom.fabEditBtn?.addEventListener('click', () => this.openEditSheet());
    this.dom.editSheetCloseBtn?.addEventListener('click', () => this.closeEditSheet());
    this.dom.editSheetBackdrop?.addEventListener('click', () => this.closeEditSheet());

    // 3. Time-Travel Slider & Reset
    this.dom.timeTravelSlider?.addEventListener('input', () => {
      const val = Number(this.dom.timeTravelSlider.value);
      this.setPreviewTimestamp(val);
    });

    this.dom.previewResetBtn?.addEventListener('click', () => {
      this.setPreviewTimestamp(null);
    });

    // 4. Quick Status Update Form
    this.dom.statusUpdateForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#tripConfig) return;

      const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
      const homeCode = this.#tripConfig.homeCountryCode || 'US';
      const nowIso = new Date(this.getEffectiveNowMs()).toISOString();
      const primaryCountry = this.dom.editPrimaryCountry?.value || homeCode;
      const primaryNote = (this.dom.editPrimaryNote?.value || '').trim();
      const secondaryCountry = this.dom.editSecondaryCountry?.value || homeCode;
      const secondaryNote = (this.dom.editSecondaryNote?.value || '').trim();

      this.liveState = {
        ...this.liveState,
        statusOverrides: {
          [firstPartnerKey]: {
            countryCode: primaryCountry,
            cityNote: primaryNote,
            updatedAt: nowIso
          },
          [secondPartnerKey]: {
            countryCode: secondaryCountry,
            cityNote: secondaryNote,
            updatedAt: nowIso
          }
        }
      };

      this.tick(true);
      this.updateSyncBadge('pending', 'Saving…');
      const result = await saveLiveState(
        this.liveState,
        this.#githubToken,
        this.githubRepo,
        this.#vaultCryptoKey
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', result.message);
    });

    // 5. Clear Manual Status Overrides (Reset to Auto Schedule)
    this.dom.clearStatusOverridesBtn?.addEventListener('click', async () => {
      if (!this.#tripConfig) return;
      this.liveState = {
        ...this.liveState,
        statusOverrides: {}
      };
      this.tick(true);
      this.syncEditFormWithState();
      const result = await saveLiveState(
        this.liveState,
        this.#githubToken,
        this.githubRepo,
        this.#vaultCryptoKey
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', 'Reset to automatic schedule');
    });

    // 6. Add Custom Milestone Form
    this.dom.addMilestoneForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#tripConfig) return;

      const title = (this.dom.msTitleInput?.value || '').trim();
      const date = this.dom.msDateInput?.value || '';
      const person = this.dom.msPersonSelect?.value || 'both';
      const countryCode = this.dom.msCountrySelect?.value || this.#tripConfig.homeCountryCode || 'US';
      const details = (this.dom.msDetailsInput?.value || '').trim();

      if (!title || !date) return;

      const newMilestone = {
        id: `custom-${Date.now()}`,
        date,
        category: /** @type {const} */ ('custom'),
        emoji: person === 'both' ? '💖' : '📍',
        title,
        details,
        person,
        countryCode
      };

      const existingCustom = Array.isArray(this.liveState.customMilestones)
        ? this.liveState.customMilestones
        : [];

      this.liveState = {
        ...this.liveState,
        customMilestones: [...existingCustom, newMilestone]
      };

      if (this.dom.msTitleInput) this.dom.msTitleInput.value = '';
      if (this.dom.msDetailsInput) this.dom.msDetailsInput.value = '';

      this.tick(true);
      const result = await saveLiveState(
        this.liveState,
        this.#githubToken,
        this.githubRepo,
        this.#vaultCryptoKey
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', result.message);
    });

    // 7. Lock Device Button
    this.dom.lockDeviceBtn?.addEventListener('click', () => {
      void this.lockAndPurgeBoard();
    });

    // 8. Resume tick immediately when tab becomes visible
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.#tripConfig) {
          this.tick(false);
        }
      });
    }
  }

  renderTimeTravelPresets() {
    if (!this.dom.presetChipsRow || !this.#tripConfig) return;
    this.dom.presetChipsRow.innerHTML = '';

    const liveChip = document.createElement('button');
    liveChip.type = 'button';
    liveChip.className = 'preset-chip is-active';
    liveChip.dataset.presetId = 'live';
    liveChip.textContent = '🟢 Live Now';
    liveChip.addEventListener('click', () => this.setPreviewTimestamp(null));
    this.dom.presetChipsRow.appendChild(liveChip);

    const presets = Array.isArray(this.#tripConfig.timeTravelPresets)
      ? this.#tripConfig.timeTravelPresets
      : [];

    for (const preset of presets) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'preset-chip';
      chip.dataset.presetId = preset.id;
      chip.textContent = preset.label;
      chip.addEventListener('click', () => {
        const epochMs = Date.parse(preset.isoDate);
        if (!Number.isNaN(epochMs)) {
          this.setPreviewTimestamp(epochMs, preset.id);
        }
      });
      this.dom.presetChipsRow.appendChild(chip);
    }
  }

  /**
   * Sets or clears the Time-Travel Preview timestamp and immediately refreshes the board.
   * @param {number | null} epochMs
   * @param {string} [activePresetId]
   */
  setPreviewTimestamp(epochMs, activePresetId = '') {
    if (!this.#tripConfig) return;
    this.previewEpochMs = epochMs;

    if (this.dom.presetChipsRow) {
      const chips = this.dom.presetChipsRow.querySelectorAll('.preset-chip');
      chips.forEach((chip) => {
        const id = /** @type {HTMLElement} */ (chip).dataset.presetId;
        const isActive = epochMs === null ? id === 'live' : id === activePresetId;
        chip.classList.toggle('is-active', isActive);
      });
    }

    if (epochMs === null) {
      if (this.dom.previewBanner) this.dom.previewBanner.hidden = true;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = 'Live Now';
    } else {
      const homeTz = getCountryInfo(this.#tripConfig.homeCountryCode || 'UTC').timeZone;
      const zoned = getZonedDateParts(epochMs, homeTz);
      const formatted = formatDisplayDate(zoned.dateStr);
      if (this.dom.previewBanner) this.dom.previewBanner.hidden = false;
      if (this.dom.previewBannerDate) this.dom.previewBannerDate.textContent = formatted;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = formatted;
      if (this.dom.timeTravelSlider) this.dom.timeTravelSlider.value = String(epochMs);
    }

    this.tick(true);
    this.syncEditFormWithState();
  }

  getEffectiveNowMs() {
    return this.previewEpochMs !== null ? this.previewEpochMs : Date.now();
  }

  openEditSheet() {
    if (!this.#tripConfig) return;
    this.syncEditFormWithState();
    this.dom.editSheetBackdrop?.classList.add('is-open');
    this.dom.editBottomSheet?.classList.add('is-open');
  }

  closeEditSheet() {
    this.dom.editSheetBackdrop?.classList.remove('is-open');
    this.dom.editBottomSheet?.classList.remove('is-open');
  }

  syncEditFormWithState() {
    if (!this.#tripConfig) return;
    const state = evaluateBoardState(this.#tripConfig, this.liveState, this.getEffectiveNowMs());
    if (this.dom.editPrimaryCountry) {
      this.dom.editPrimaryCountry.value = state.dualStatus.primary.countryCode;
    }
    if (this.dom.editPrimaryNote) {
      this.dom.editPrimaryNote.value = state.dualStatus.primary.cityNote || '';
    }
    if (this.dom.editSecondaryCountry) {
      this.dom.editSecondaryCountry.value = state.dualStatus.secondary.countryCode;
    }
    if (this.dom.editSecondaryNote) {
      this.dom.editSecondaryNote.value = state.dualStatus.secondary.cityNote || '';
    }
  }

  updateSyncBadge(stateKey, text) {
    if (!this.dom.syncStatusPill) return;
    this.dom.syncStatusPill.dataset.syncState = stateKey;
    this.dom.syncStatusPill.textContent = text;
  }

  /**
   * Evaluates board state at current/preview timestamp and updates DOM.
   * No-ops strictly if the vault is locked (`this.#tripConfig === null`).
   * @param {boolean} forceTimelineRender
   */
  tick(forceTimelineRender = false) {
    if (!this.#tripConfig) return;

    const nowMs = this.getEffectiveNowMs();
    const state = evaluateBoardState(this.#tripConfig, this.liveState, nowMs);

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

      if (this.dom.togetherLegBadge) {
        const legTag = ar.totalLegs > 1
          ? `Leg ${ar.legIndex + 1} of ${ar.totalLegs} • ${legCountry.flag} ${legCountry.name}`
          : `${legCountry.flag} ${legCountry.name}`;
        this.dom.togetherLegBadge.textContent = `${legTag} • Day ${ar.dayOfReunion} of ${ar.totalReunionDays}`;
      }

      if (this.dom.togetherHeadline) {
        this.dom.togetherHeadline.textContent = `${ar.reunion.emoji} Together in ${legCountry.name}!`;
      }

      if (this.dom.togetherSubtext) {
        if (ar.nextLeg) {
          const nextCountry = getCountryInfo(ar.nextLeg.countryCode);
          this.dom.togetherSubtext.textContent = `Next leg: ${nextCountry.flag} ${nextCountry.name} in ${ar.daysUntilNextLeg} day${ar.daysUntilNextLeg === 1 ? '' : 's'} (${formatShortDisplayDate(ar.nextLeg.startDate)})`;
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
        this.dom.countdownTargetDate.textContent = formatDisplayDate(cd.targetDate);
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

    // 4. Secondary Sooner Milestone Sub-Banner (diffed and built with safe textContent)
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

    // 5. Dual Status & Time-Zone Bridge
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

    // 6. Timeline (re-render only when partition or active state changes, or when forced)
    const timelineSig = `${state.phase}:${state.activeReunion?.activeLeg.id ?? 'none'}:${state.timeline.pastItems.length}:${state.timeline.upcomingItems.length}:${state.timeline.completedTripDaysTogether}`;
    if (forceTimelineRender || timelineSig !== this.lastTimelineSignature) {
      this.lastTimelineSignature = timelineSig;
      this.timelineRenderer.render(state);
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
}

if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new CountdownBoardApp();
    void app.init();
  });
}
