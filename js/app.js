import {
  COUNTRY_CATALOG,
  PINNED_COUNTRY_CODES,
  TRIP_CONFIG,
  getCountryInfo
} from './config.js';
import {
  clearCachedVault,
  loadCachedVault,
  unlockAndCacheVault
} from './crypto-vault.js';
import {
  evaluateBoardState,
  formatDisplayDate,
  formatShortDisplayDate,
  getZonedDateParts
} from './countdown-engine.js';
import { PhotoStackController } from './photo-stack.js';
import { TimelineRenderer } from './timeline-renderer.js';
import {
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
 */
function populateCountrySelect(selectEl, selectedCode = 'IL') {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const pinnedGroup = document.createElement('optgroup');
  pinnedGroup.label = '⭐ Trip & Popular Destinations';
  for (const code of PINNED_COUNTRY_CODES) {
    const info = COUNTRY_CATALOG[code];
    if (!info) continue;
    const opt = document.createElement('option');
    opt.value = info.code;
    opt.textContent = `${info.flag} ${info.name}`;
    pinnedGroup.appendChild(opt);
  }

  const allGroup = document.createElement('optgroup');
  allGroup.label = '🌍 All 249 Countries (A–Z)';
  const sortedAll = Object.values(COUNTRY_CATALOG).sort((a, b) => a.name.localeCompare(b.name));
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

class CountdownBoardApp {
  constructor() {
    /** @type {import('./config.js').VaultPayload | null} */
    this.vaultPayload = null;
    /** @type {Object | null} */
    this.encryptedVaultJson = null;
    /** @type {import('./config.js').LiveStatePayload} */
    this.liveState = {
      schemaVersion: 1,
      updatedAt: '2026-10-31T00:00:00.000Z',
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

    this.cacheDomElements();
    this.photoStack = new PhotoStackController({
      container: this.dom.photoStackContainer,
      ambientContainer: this.dom.ambientStage
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
      vaultForm: document.getElementById('vault-unlock-form'),
      vaultPasswordInput: /** @type {HTMLInputElement | null} */ (document.getElementById('vault-password-input')),
      vaultRememberCheckbox: /** @type {HTMLInputElement | null} */ (document.getElementById('vault-remember-checkbox')),
      vaultErrorMsg: document.getElementById('vault-error-msg'),
      vaultUnlockBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('vault-unlock-btn')),

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
      shovalFlag: document.getElementById('shoval-flag'),
      shovalCountry: document.getElementById('shoval-country'),
      shovalCityNote: document.getElementById('shoval-city-note'),
      shovalClock: document.getElementById('shoval-clock'),
      shovalTzOffset: document.getElementById('shoval-tz-offset'),

      tzBridgePill: document.getElementById('tz-bridge-pill'),

      eitanFlag: document.getElementById('eitan-flag'),
      eitanCountry: document.getElementById('eitan-country'),
      eitanCityNote: document.getElementById('eitan-city-note'),
      eitanClock: document.getElementById('eitan-clock'),
      eitanTzOffset: document.getElementById('eitan-tz-offset'),

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
      editShovalCountry: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-shoval-country')),
      editShovalNote: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-shoval-note')),
      editEitanCountry: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-eitan-country')),
      editEitanNote: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-eitan-note')),
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
    populateCountrySelect(this.dom.editShovalCountry, 'IL');
    populateCountrySelect(this.dom.editEitanCountry, 'IL');
    populateCountrySelect(this.dom.msCountrySelect, 'TH');

    this.renderTimeTravelPresets();
    this.bindEventListeners();
    this.registerServiceWorker();

    // Render initial board state immediately so background & layout are live behind lock screen
    this.tick(true);
    setInterval(() => this.tick(false), 1000);

    // Check if device already has a remembered decrypted vault
    const cachedVault = loadCachedVault();
    if (cachedVault) {
      this.applyUnlockedVault(cachedVault);
    } else {
      await this.preloadEncryptedVaultJson();
    }

    // Load live-state.json overrides
    this.liveState = await loadLiveState(
      this.vaultPayload?.githubRepo ?? null,
      this.vaultPayload?.githubToken ?? null
    );
    this.syncEditFormWithState();
    this.tick(true);

    registerOfflineSyncListener(
      () => ({
        githubToken: this.vaultPayload?.githubToken ?? null,
        repoConfig: this.vaultPayload?.githubRepo ?? null
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

  applyUnlockedVault(payload) {
    this.vaultPayload = payload;
    if (this.dom.vaultOverlay) {
      this.dom.vaultOverlay.classList.add('is-unlocked');
    }
    if (Array.isArray(payload.photos) && payload.photos.length > 0) {
      this.photoStack.setPhotos(payload.photos);
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
        this.applyUnlockedVault(decrypted);

        if (this.dom.vaultPasswordInput) this.dom.vaultPasswordInput.value = '';
        this.liveState = await loadLiveState(
          decrypted.githubRepo ?? null,
          decrypted.githubToken ?? null
        );
        this.syncEditFormWithState();
        this.tick(true);
      } catch {
        if (this.dom.vaultErrorMsg) {
          this.dom.vaultErrorMsg.textContent = 'Incorrect password — please try again.';
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
      const nowIso = new Date(this.getEffectiveNowMs()).toISOString();
      const shovalCountry = this.dom.editShovalCountry?.value || 'IL';
      const shovalNote = (this.dom.editShovalNote?.value || '').trim();
      const eitanCountry = this.dom.editEitanCountry?.value || 'IL';
      const eitanNote = (this.dom.editEitanNote?.value || '').trim();

      this.liveState = {
        ...this.liveState,
        statusOverrides: {
          shoval: {
            countryCode: shovalCountry,
            cityNote: shovalNote,
            updatedAt: nowIso
          },
          eitan: {
            countryCode: eitanCountry,
            cityNote: eitanNote,
            updatedAt: nowIso
          }
        }
      };

      this.tick(true);
      this.updateSyncBadge('pending', 'Saving…');
      const result = await saveLiveState(
        this.liveState,
        this.vaultPayload?.githubToken ?? null,
        this.vaultPayload?.githubRepo ?? null
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', result.message);
    });

    // 5. Clear Manual Status Overrides (Reset to Auto Schedule)
    this.dom.clearStatusOverridesBtn?.addEventListener('click', async () => {
      this.liveState = {
        ...this.liveState,
        statusOverrides: {}
      };
      this.tick(true);
      this.syncEditFormWithState();
      const result = await saveLiveState(
        this.liveState,
        this.vaultPayload?.githubToken ?? null,
        this.vaultPayload?.githubRepo ?? null
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', 'Reset to automatic schedule');
    });

    // 6. Add Custom Milestone Form
    this.dom.addMilestoneForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = (this.dom.msTitleInput?.value || '').trim();
      const date = this.dom.msDateInput?.value || '';
      const person = /** @type {'both'|'shoval'|'eitan'} */ (this.dom.msPersonSelect?.value || 'both');
      const countryCode = this.dom.msCountrySelect?.value || 'TH';
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
        this.vaultPayload?.githubToken ?? null,
        this.vaultPayload?.githubRepo ?? null
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', result.message);
    });

    // 7. Lock Device Button
    this.dom.lockDeviceBtn?.addEventListener('click', () => {
      clearCachedVault();
      this.vaultPayload = null;
      this.closeEditSheet();
      this.dom.vaultOverlay?.classList.remove('is-unlocked');
    });
  }

  renderTimeTravelPresets() {
    if (!this.dom.presetChipsRow) return;
    this.dom.presetChipsRow.innerHTML = '';

    const liveChip = document.createElement('button');
    liveChip.type = 'button';
    liveChip.className = 'preset-chip is-active';
    liveChip.dataset.presetId = 'live';
    liveChip.textContent = '🟢 Live Now';
    liveChip.addEventListener('click', () => this.setPreviewTimestamp(null));
    this.dom.presetChipsRow.appendChild(liveChip);

    for (const preset of TRIP_CONFIG.timeTravelPresets) {
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
      const zoned = getZonedDateParts(epochMs, 'Asia/Jerusalem');
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
    this.syncEditFormWithState();
    this.dom.editSheetBackdrop?.classList.add('is-open');
    this.dom.editBottomSheet?.classList.add('is-open');
  }

  closeEditSheet() {
    this.dom.editSheetBackdrop?.classList.remove('is-open');
    this.dom.editBottomSheet?.classList.remove('is-open');
  }

  syncEditFormWithState() {
    const state = evaluateBoardState(TRIP_CONFIG, this.liveState, this.getEffectiveNowMs());
    if (this.dom.editShovalCountry) {
      this.dom.editShovalCountry.value = state.dualStatus.shoval.countryCode;
    }
    if (this.dom.editShovalNote) {
      this.dom.editShovalNote.value = state.dualStatus.shoval.cityNote || '';
    }
    if (this.dom.editEitanCountry) {
      this.dom.editEitanCountry.value = state.dualStatus.eitan.countryCode;
    }
    if (this.dom.editEitanNote) {
      this.dom.editEitanNote.value = state.dualStatus.eitan.cityNote || '';
    }
  }

  updateSyncBadge(stateKey, text) {
    if (!this.dom.syncStatusPill) return;
    this.dom.syncStatusPill.dataset.syncState = stateKey;
    this.dom.syncStatusPill.textContent = text;
  }

  /**
   * Evaluates board state at current/preview timestamp and updates DOM.
   * @param {boolean} forceTimelineRender
   */
  tick(forceTimelineRender = false) {
    const nowMs = this.getEffectiveNowMs();
    const state = evaluateBoardState(TRIP_CONFIG, this.liveState, nowMs);

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

    // 4. Secondary Sooner Milestone Sub-Banner
    if (this.dom.subMilestoneBanner) {
      if (state.soonerMilestone) {
        const ms = state.soonerMilestone;
        const daysLabel = state.soonerMilestoneDaysAway === 0
          ? 'Today!'
          : state.soonerMilestoneDaysAway === 1
            ? 'Tomorrow'
            : `In ${state.soonerMilestoneDaysAway} days`;
        this.dom.subMilestoneBanner.hidden = false;
        this.dom.subMilestoneBanner.innerHTML = `
          <span>${ms.emoji}</span>
          <span>
            <strong class="numeric-lock" dir="ltr">${daysLabel} (${formatShortDisplayDate(ms.date)})</strong>:
            <span dir="auto">${ms.title}</span>
          </span>
        `;
      } else {
        this.dom.subMilestoneBanner.hidden = true;
      }
    }

    // 5. Dual Status & Time-Zone Bridge
    const { shoval, eitan, isSameTimeZone, bridgeLabel } = state.dualStatus;
    if (this.dom.autoSyncIndicator) {
      this.dom.autoSyncIndicator.hidden = !(shoval.isAutoSyncedToReunion && eitan.isAutoSyncedToReunion);
    }

    if (this.dom.shovalFlag) this.dom.shovalFlag.textContent = shoval.flag;
    if (this.dom.shovalCountry) this.dom.shovalCountry.textContent = shoval.countryName;
    if (this.dom.shovalCityNote) this.dom.shovalCityNote.textContent = shoval.cityNote || '';
    if (this.dom.shovalClock) this.dom.shovalClock.textContent = shoval.localTimeFormatted;
    if (this.dom.shovalTzOffset) this.dom.shovalTzOffset.textContent = formatUtcOffsetLabel(shoval.utcOffsetMinutes);

    if (this.dom.eitanFlag) this.dom.eitanFlag.textContent = eitan.flag;
    if (this.dom.eitanCountry) this.dom.eitanCountry.textContent = eitan.countryName;
    if (this.dom.eitanCityNote) this.dom.eitanCityNote.textContent = eitan.cityNote || '';
    if (this.dom.eitanClock) this.dom.eitanClock.textContent = eitan.localTimeFormatted;
    if (this.dom.eitanTzOffset) this.dom.eitanTzOffset.textContent = formatUtcOffsetLabel(eitan.utcOffsetMinutes);

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
    app.init();
  });
}
