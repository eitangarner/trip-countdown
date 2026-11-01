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
  decomposeRemainingMs,
  evaluateBoardState,
  formatDisplayDate,
  formatShortDisplayDate,
  getEndOfDayInTimeZoneMs,
  getStartOfDayInTimeZoneMs,
  getZonedDateParts,
  resolvePartnerConfigMeta
} from './countdown-engine.js';
import { PhotoStackController, createPhotoDateElement } from './photo-stack.js';
import {
  isReunionChapter,
  resolveMilestonePersonMeta,
  TimelineRenderer
} from './timeline-renderer.js';
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

  /** @type {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null} */
  #activeEventModalItem = null;

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
    /** @type {'primary' | 'secondary'} */
    this.activeProfile = 'primary';
    /** @type {'milestone' | 'chapter'} */
    this.timelineEditorMode = 'milestone';
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
      upcomingTrackEl: this.dom.timelineUpcomingTrack,
      onEditItem: (item) => this.openEventModal(item),
      onDeleteItem: (item) => this.deleteTimelineItem(item)
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
      addTimelineItemBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('add-timeline-item-btn')),

      fabEditBtn: document.getElementById('fab-edit-btn'),
      editSheetBackdrop: document.getElementById('edit-sheet-backdrop'),
      editBottomSheet: document.getElementById('edit-bottom-sheet'),
      sheetHandleWrapper: document.getElementById('sheet-handle-wrapper'),
      sheetHeader: document.getElementById('sheet-header'),
      editSheetCloseBtn: document.getElementById('edit-sheet-close-btn'),

      statusUpdateForm: document.getElementById('status-update-form'),
      syncStatusPill: document.getElementById('sync-status-pill'),
      segBtnPrimary: /** @type {HTMLButtonElement | null} */ (document.getElementById('seg-btn-primary')),
      segBtnSecondary: /** @type {HTMLButtonElement | null} */ (document.getElementById('seg-btn-secondary')),
      editCurrentCountryLabel: document.getElementById('edit-current-country-label'),
      editCurrentCountry: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-current-country')),
      editCurrentNoteLabel: document.getElementById('edit-current-note-label'),
      editCurrentNote: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-current-note')),
      clearStatusOverridesBtn: document.getElementById('clear-status-overrides-btn'),

      timelineSheetBackdrop: document.getElementById('timeline-sheet-backdrop'),
      timelineItemSheet: document.getElementById('timeline-item-sheet'),
      timelineSheetHandleWrapper: document.getElementById('timeline-sheet-handle-wrapper'),
      timelineSheetHeader: document.getElementById('timeline-sheet-header'),
      timelineSheetTitle: document.getElementById('timeline-sheet-title'),
      timelineSheetCloseBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-sheet-close-btn')),
      timelineItemForm: /** @type {HTMLFormElement | null} */ (document.getElementById('timeline-item-form')),
      timelineTypeToggleGroup: document.getElementById('timeline-type-toggle-group'),
      timelineTypeMilestoneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-type-milestone-btn')),
      timelineTypeChapterBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-type-chapter-btn')),
      tlItemIdInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-item-id-input')),
      timelineMilestoneFields: document.getElementById('timeline-milestone-fields'),
      tlTitleInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-title-input')),
      tlDateInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-date-input')),
      tlPersonSelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('tl-person-select')),
      tlCountrySelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('tl-country-select')),
      tlDetailsInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-details-input')),
      timelineChapterFields: document.getElementById('timeline-chapter-fields'),
      tlChapterTitleInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-title-input')),
      tlChapterEmojiInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-emoji-input')),
      tlChapterCountrySelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('tl-chapter-country-select')),
      tlStartDateInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-start-date-input')),
      tlEndDateInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-end-date-input')),
      tlChapterDescInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-desc-input')),
      tlSaveBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-save-btn')),
      tlDeleteBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-delete-btn')),

      eventModalBackdrop: document.getElementById('event-modal-backdrop'),
      eventModal: document.getElementById('event-modal'),
      eventModalBadge: document.getElementById('event-modal-badge'),
      eventModalCloseBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
      eventModalStatusPill: document.getElementById('event-modal-status-pill'),
      eventModalDatePill: document.getElementById('event-modal-date-pill'),
      eventModalTitle: document.getElementById('event-modal-title'),
      eventModalLocation: document.getElementById('event-modal-location'),
      eventCdDays: document.getElementById('event-cd-days'),
      eventCdHours: document.getElementById('event-cd-hours'),
      eventCdMinutes: document.getElementById('event-cd-minutes'),
      eventCdSeconds: document.getElementById('event-cd-seconds'),
      eventModalSubtext: document.getElementById('event-modal-subtext'),
      eventModalEditBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn')),
      eventModalDoneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),

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
    if (this.dom.segBtnPrimary) this.dom.segBtnPrimary.textContent = primaryName;
    if (this.dom.segBtnSecondary) this.dom.segBtnSecondary.textContent = secondaryName;

    try {
      const savedProfile = localStorage?.getItem('trip_preferred_profile');
      if (savedProfile === 'secondary' || savedProfile === 'primary') {
        this.activeProfile = savedProfile;
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
    this.updateProfileSelectorUI();

    if (this.dom.tlPersonSelect) {
      this.dom.tlPersonSelect.innerHTML = '';
      const bothOpt = document.createElement('option');
      bothOpt.value = 'both';
      bothOpt.textContent = '💕 Together';
      const primaryOpt = document.createElement('option');
      primaryOpt.value = firstPartnerKey;
      primaryOpt.textContent = `🌸 ${primaryName}`;
      const secondaryOpt = document.createElement('option');
      secondaryOpt.value = secondPartnerKey;
      secondaryOpt.textContent = `🌊 ${secondaryName}`;
      this.dom.tlPersonSelect.append(bothOpt, primaryOpt, secondaryOpt);
    }

    const pinnedCodes = Array.isArray(this.#tripConfig.pinnedCountryCodes) &&
      this.#tripConfig.pinnedCountryCodes.length > 0
      ? this.#tripConfig.pinnedCountryCodes
      : PINNED_COUNTRY_CODES;
    const homeCode = this.#tripConfig.homeCountryCode || 'US';

    populateCountrySelect(this.dom.editCurrentCountry, homeCode, pinnedCodes);
    populateCountrySelect(this.dom.tlCountrySelect, pinnedCodes[2] || homeCode, pinnedCodes);
    populateCountrySelect(this.dom.tlChapterCountrySelect, pinnedCodes[0] || homeCode, pinnedCodes);

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = false;
    if (this.dom.bottomNav) this.dom.bottomNav.hidden = false;
    if (this.dom.fabEditBtn) this.dom.fabEditBtn.hidden = false;
    if (this.dom.editBottomSheet) this.dom.editBottomSheet.hidden = false;
    if (this.dom.timelineItemSheet) this.dom.timelineItemSheet.hidden = false;
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

    this.closeEditSheet();
    this.closeTimelineItemEditor();
    this.closeEventModal();
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
      this.dom.secondaryTzOffset,
      this.dom.eventModalTitle,
      this.dom.eventModalLocation,
      this.dom.eventModalSubtext,
      this.dom.eventModalDatePill
    ];
    for (const el of textElementsToClear) {
      if (el) el.textContent = '';
    }

    if (this.dom.cdDays) this.dom.cdDays.textContent = '--';
    if (this.dom.cdHours) this.dom.cdHours.textContent = '--';
    if (this.dom.cdMinutes) this.dom.cdMinutes.textContent = '--';
    if (this.dom.cdSeconds) this.dom.cdSeconds.textContent = '--';

    if (this.dom.editCurrentCountry) this.dom.editCurrentCountry.innerHTML = '';
    if (this.dom.tlCountrySelect) this.dom.tlCountrySelect.innerHTML = '';
    if (this.dom.tlChapterCountrySelect) this.dom.tlChapterCountrySelect.innerHTML = '';
    if (this.dom.tlPersonSelect) this.dom.tlPersonSelect.innerHTML = '';

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = true;
    if (this.dom.bottomNav) this.dom.bottomNav.hidden = true;
    if (this.dom.fabEditBtn) this.dom.fabEditBtn.hidden = true;
    if (this.dom.editBottomSheet) this.dom.editBottomSheet.hidden = true;
    if (this.dom.timelineItemSheet) this.dom.timelineItemSheet.hidden = true;
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

    // 3. Bottom Sheet Open / Close
    this.dom.fabEditBtn?.addEventListener('click', () => this.openEditSheet());
    this.dom.editSheetCloseBtn?.addEventListener('click', () => this.closeEditSheet());
    this.dom.editSheetBackdrop?.addEventListener('click', () => this.closeEditSheet());

    // 4. Timeline Item Editor Open / Close
    this.dom.addTimelineItemBtn?.addEventListener('click', () => this.openTimelineItemEditor(null));
    this.dom.timelineSheetCloseBtn?.addEventListener('click', () => this.closeTimelineItemEditor());
    this.dom.timelineSheetBackdrop?.addEventListener('click', () => this.closeTimelineItemEditor());

    // 5. Event Countdown Popup Modal Open / Close
    this.dom.eventModalCloseBtn?.addEventListener('click', () => this.closeEventModal());
    this.dom.eventModalDoneBtn?.addEventListener('click', () => this.closeEventModal());
    this.dom.eventModalBackdrop?.addEventListener('click', () => this.closeEventModal());
    this.dom.eventModalEditBtn?.addEventListener('click', () => {
      const item = this.#activeEventModalItem;
      this.closeEventModal();
      if (item) this.openTimelineItemEditor(item);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.#activeEventModalItem) {
          this.closeEventModal();
        } else if (this.dom.timelineItemSheet && !this.dom.timelineItemSheet.hidden) {
          this.closeTimelineItemEditor();
        } else if (this.dom.editBottomSheet && !this.dom.editBottomSheet.hidden) {
          this.closeEditSheet();
        }
      }
    });

    // Touch drag-down gestures for both sheets
    this.bindSheetDragGestures(
      this.dom.editBottomSheet,
      this.dom.sheetHandleWrapper || this.dom.sheetHeader,
      () => this.closeEditSheet()
    );
    this.bindSheetDragGestures(
      this.dom.timelineItemSheet,
      this.dom.timelineSheetHandleWrapper || this.dom.timelineSheetHeader,
      () => this.closeTimelineItemEditor()
    );

    // 4. Profile Selector Buttons in Quick Status Update
    this.dom.segBtnPrimary?.addEventListener('click', () => {
      this.activeProfile = 'primary';
      try { localStorage?.setItem('trip_preferred_profile', 'primary'); } catch {}
      this.updateProfileSelectorUI();
      this.syncEditFormWithState();
    });
    this.dom.segBtnSecondary?.addEventListener('click', () => {
      this.activeProfile = 'secondary';
      try { localStorage?.setItem('trip_preferred_profile', 'secondary'); } catch {}
      this.updateProfileSelectorUI();
      this.syncEditFormWithState();
    });

    // 5. Quick Status Update Form (focused on activeProfile)
    this.dom.statusUpdateForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#tripConfig) return;

      const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
      const targetPartnerKey = this.activeProfile === 'secondary' ? secondPartnerKey : firstPartnerKey;
      const homeCode = this.#tripConfig.homeCountryCode || 'US';
      const nowIso = new Date(this.getEffectiveNowMs()).toISOString();
      const countryCode = this.dom.editCurrentCountry?.value || homeCode;
      const cityNote = (this.dom.editCurrentNote?.value || '').trim();

      const existingOverrides = this.liveState.statusOverrides || {};
      this.liveState = {
        ...this.liveState,
        statusOverrides: {
          ...existingOverrides,
          [targetPartnerKey]: {
            countryCode,
            cityNote,
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

    // 6. Clear Manual Status Overrides (Reset to Auto Schedule for active profile)
    this.dom.clearStatusOverridesBtn?.addEventListener('click', async () => {
      if (!this.#tripConfig) return;
      const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
      const targetPartnerKey = this.activeProfile === 'secondary' ? secondPartnerKey : firstPartnerKey;
      const updatedOverrides = { ...(this.liveState.statusOverrides || {}) };
      delete updatedOverrides[targetPartnerKey];

      this.liveState = {
        ...this.liveState,
        statusOverrides: updatedOverrides
      };
      this.tick(true);
      this.syncEditFormWithState();
      const result = await saveLiveState(
        this.liveState,
        this.#githubToken,
        this.githubRepo,
        this.#vaultCryptoKey
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', 'Successfully updated');
    });

    // 8. Segmented Toggle in Timeline Item Editor
    this.dom.timelineTypeMilestoneBtn?.addEventListener('click', () => {
      this.setTimelineEditorMode('milestone');
    });
    this.dom.timelineTypeChapterBtn?.addEventListener('click', () => {
      this.setTimelineEditorMode('chapter');
    });

    // 9. Timeline Item Form Submit (Milestone or Chapter)
    this.dom.timelineItemForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!this.#tripConfig) return;

      const id = (this.dom.tlItemIdInput?.value || '').trim();

      if (this.timelineEditorMode === 'chapter') {
        const title = (this.dom.tlChapterTitleInput?.value || '').trim();
        const emoji = (this.dom.tlChapterEmojiInput?.value || '').trim() || '✈️';
        const countryCode = this.dom.tlChapterCountrySelect?.value || this.#tripConfig.homeCountryCode || 'US';
        const startDate = this.dom.tlStartDateInput?.value || '';
        const endDate = this.dom.tlEndDateInput?.value || '';
        const description = (this.dom.tlChapterDescInput?.value || '').trim();

        if (!title || !startDate || !endDate) return;

        if (!id) {
          const newId = `custom-ch-${Date.now()}`;
          const newChapter = {
            id: newId,
            title,
            emoji,
            startDate,
            endDate,
            description,
            legs: [
              {
                id: `${newId}-leg-1`,
                name: title,
                countryCode,
                startDate,
                endDate
              }
            ]
          };
          this.liveState = {
            ...this.liveState,
            customReunions: [...(this.liveState.customReunions || []), newChapter]
          };
        } else {
          const customIdx = (this.liveState.customReunions || []).findIndex((r) => r.id === id);
          if (customIdx >= 0) {
            const existing = this.liveState.customReunions[customIdx];
            const updated = [...this.liveState.customReunions];
            updated[customIdx] = {
              ...existing,
              title,
              emoji,
              startDate,
              endDate,
              description,
              legs: [
                {
                  id: existing.legs?.[0]?.id || `${id}-leg-1`,
                  name: title,
                  countryCode,
                  startDate,
                  endDate
                }
              ]
            };
            this.liveState = { ...this.liveState, customReunions: updated };
          } else {
            this.liveState = {
              ...this.liveState,
              chapterOverrides: {
                ...(this.liveState.chapterOverrides || {}),
                [id]: {
                  title,
                  emoji,
                  startDate,
                  endDate,
                  countryCode,
                  description,
                  hidden: false
                }
              }
            };
          }
        }
      } else {
        const title = (this.dom.tlTitleInput?.value || '').trim();
        const date = this.dom.tlDateInput?.value || '';
        const person = this.dom.tlPersonSelect?.value || 'both';
        const countryCode = this.dom.tlCountrySelect?.value || this.#tripConfig.homeCountryCode || 'US';
        const details = (this.dom.tlDetailsInput?.value || '').trim();

        if (!title || !date) return;

        if (!id) {
          const newId = `custom-ms-${Date.now()}`;
          const newMilestone = {
            id: newId,
            date,
            category: /** @type {const} */ ('custom'),
            emoji: person === 'both' ? '💖' : '📍',
            title,
            details,
            person,
            countryCode
          };
          this.liveState = {
            ...this.liveState,
            customMilestones: [...(this.liveState.customMilestones || []), newMilestone]
          };
        } else {
          const customIdx = (this.liveState.customMilestones || []).findIndex((m) => m.id === id);
          if (customIdx >= 0) {
            const updated = [...this.liveState.customMilestones];
            updated[customIdx] = {
              ...updated[customIdx],
              title,
              date,
              person,
              countryCode,
              details
            };
            this.liveState = { ...this.liveState, customMilestones: updated };
          } else {
            this.liveState = {
              ...this.liveState,
              milestoneOverrides: {
                ...(this.liveState.milestoneOverrides || {}),
                [id]: {
                  title,
                  date,
                  person,
                  countryCode,
                  details,
                  hidden: false
                }
              }
            };
          }
        }
      }

      this.closeTimelineItemEditor();
      this.tick(true);
      this.updateSyncBadge('pending', 'Saving…');
      const result = await saveLiveState(
        this.liveState,
        this.#githubToken,
        this.githubRepo,
        this.#vaultCryptoKey
      );
      this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', 'Successfully updated');
    });

    // 10. Delete Timeline Item from Editor Sheet
    this.dom.tlDeleteBtn?.addEventListener('click', async () => {
      const id = (this.dom.tlItemIdInput?.value || '').trim();
      if (!id || !this.#tripConfig) return;
      this.closeTimelineItemEditor();
      await this.deleteTimelineItem({ id, isChapter: this.timelineEditorMode === 'chapter' });
    });

    // 8. Lock Device Button
    this.dom.lockDeviceBtn?.addEventListener('click', () => {
      void this.lockAndPurgeBoard();
    });

    // 9. Resume tick immediately when tab becomes visible
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.#tripConfig) {
          this.tick(false);
        }
      });
    }
  }

  /**
   * Binds touch drag-down gesture on a sheet handle, header, and top of the scrollable sheet.
   * @param {HTMLElement | null} sheet
   * @param {HTMLElement | null} dragTarget
   * @param {() => void} onClose
   */
  bindSheetDragGestures(sheet, dragTarget, onClose) {
    if (!sheet) return;

    let touchStartY = 0;
    let currentDeltaY = 0;
    let isTrackingTouch = false;

    const onTouchStart = (/** @type {TouchEvent} */ e) => {
      if (!sheet.classList.contains('is-open')) return;
      touchStartY = e.touches[0].clientY;
      currentDeltaY = 0;
      isTrackingTouch = true;
      sheet.style.transition = 'none';
    };

    const onTouchMove = (/** @type {TouchEvent} */ e) => {
      if (!isTrackingTouch) return;
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > 0) {
        currentDeltaY = deltaY;
        sheet.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!isTrackingTouch) return;
      isTrackingTouch = false;
      sheet.style.transition = '';
      if (currentDeltaY > 80) {
        onClose();
      } else {
        sheet.style.transform = '';
      }
      currentDeltaY = 0;
    };

    dragTarget?.addEventListener('touchstart', onTouchStart, { passive: true });
    dragTarget?.addEventListener('touchmove', onTouchMove, { passive: false });
    dragTarget?.addEventListener('touchend', onTouchEnd, { passive: true });
    dragTarget?.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // Also support drag-down directly inside sheet when scrolled to top
    sheet.addEventListener('touchstart', (e) => {
      if (sheet.scrollTop <= 0) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
      if (sheet.scrollTop <= 0) {
        const delta = e.touches[0].clientY - touchStartY;
        if (delta > 0 && !isTrackingTouch) {
          isTrackingTouch = true;
          sheet.style.transition = 'none';
        }
        if (isTrackingTouch) {
          currentDeltaY = delta;
          sheet.style.transform = `translateY(${delta}px)`;
          if (e.cancelable) e.preventDefault();
        }
      }
    }, { passive: false });

    sheet.addEventListener('touchend', onTouchEnd, { passive: true });
  }

  /**
   * Switches the active top-level view tab between 'countdown' and 'timeline'.
   * @param {'countdown' | 'timeline'} viewName
   */
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
    if (this.dom.fabEditBtn) this.dom.fabEditBtn.hidden = viewName !== 'countdown';
  }

  /**
   * Toggles the timeline entry form between milestone and chapter inputs.
   * @param {'milestone' | 'chapter'} mode
   */
  setTimelineEditorMode(mode) {
    this.timelineEditorMode = mode;
    const isMilestone = mode === 'milestone';
    this.dom.timelineTypeMilestoneBtn?.classList.toggle('is-active', isMilestone);
    this.dom.timelineTypeChapterBtn?.classList.toggle('is-active', !isMilestone);
    if (this.dom.timelineMilestoneFields) {
      this.dom.timelineMilestoneFields.style.display = isMilestone ? 'block' : 'none';
    }
    if (this.dom.timelineChapterFields) {
      this.dom.timelineChapterFields.style.display = isMilestone ? 'none' : 'block';
    }
  }

  /**
   * Opens the timeline editor bottom sheet, populating existing data if provided.
   * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null} [item]
   */
  openTimelineItemEditor(item = null) {
    if (!this.#tripConfig) return;
    if (this.dom.timelineItemSheet) this.dom.timelineItemSheet.hidden = false;

    if (item === null) {
      if (this.dom.timelineSheetTitle) this.dom.timelineSheetTitle.textContent = 'Add Timeline Entry';
      if (this.dom.timelineTypeToggleGroup) this.dom.timelineTypeToggleGroup.style.display = 'flex';
      if (this.dom.tlItemIdInput) this.dom.tlItemIdInput.value = '';

      if (this.dom.tlTitleInput) this.dom.tlTitleInput.value = '';
      if (this.dom.tlDateInput) this.dom.tlDateInput.value = new Date().toISOString().slice(0, 10);
      if (this.dom.tlPersonSelect) this.dom.tlPersonSelect.value = 'both';
      if (this.dom.tlCountrySelect) this.dom.tlCountrySelect.value = this.#tripConfig.homeCountryCode || 'US';
      if (this.dom.tlDetailsInput) this.dom.tlDetailsInput.value = '';

      if (this.dom.tlChapterTitleInput) this.dom.tlChapterTitleInput.value = '';
      if (this.dom.tlChapterEmojiInput) this.dom.tlChapterEmojiInput.value = '✈️';
      if (this.dom.tlChapterCountrySelect) this.dom.tlChapterCountrySelect.value = this.#tripConfig.homeCountryCode || 'US';
      if (this.dom.tlStartDateInput) this.dom.tlStartDateInput.value = new Date().toISOString().slice(0, 10);
      if (this.dom.tlEndDateInput) this.dom.tlEndDateInput.value = new Date().toISOString().slice(0, 10);
      if (this.dom.tlChapterDescInput) this.dom.tlChapterDescInput.value = '';

      if (this.dom.tlDeleteBtn) this.dom.tlDeleteBtn.style.display = 'none';
      this.setTimelineEditorMode('milestone');
    } else if (isReunionChapter(item)) {
      if (this.dom.timelineSheetTitle) this.dom.timelineSheetTitle.textContent = 'Edit Chapter';
      if (this.dom.timelineTypeToggleGroup) this.dom.timelineTypeToggleGroup.style.display = 'none';
      if (this.dom.tlItemIdInput) this.dom.tlItemIdInput.value = item.id;

      if (this.dom.tlChapterTitleInput) this.dom.tlChapterTitleInput.value = item.title || '';
      if (this.dom.tlChapterEmojiInput) this.dom.tlChapterEmojiInput.value = item.emoji || '✈️';
      const legCountry = item.legs?.[0]?.countryCode || this.#tripConfig.homeCountryCode || 'US';
      if (this.dom.tlChapterCountrySelect) this.dom.tlChapterCountrySelect.value = legCountry;
      if (this.dom.tlStartDateInput) this.dom.tlStartDateInput.value = item.startDate || '';
      if (this.dom.tlEndDateInput) this.dom.tlEndDateInput.value = item.endDate || '';
      if (this.dom.tlChapterDescInput) this.dom.tlChapterDescInput.value = item.description || '';

      if (this.dom.tlDeleteBtn) this.dom.tlDeleteBtn.style.display = 'block';
      this.setTimelineEditorMode('chapter');
    } else {
      if (this.dom.timelineSheetTitle) this.dom.timelineSheetTitle.textContent = 'Edit Milestone';
      if (this.dom.timelineTypeToggleGroup) this.dom.timelineTypeToggleGroup.style.display = 'none';
      if (this.dom.tlItemIdInput) this.dom.tlItemIdInput.value = item.id;

      if (this.dom.tlTitleInput) this.dom.tlTitleInput.value = item.title || '';
      if (this.dom.tlDateInput) this.dom.tlDateInput.value = item.date || '';
      if (this.dom.tlPersonSelect) this.dom.tlPersonSelect.value = item.person || 'both';
      if (this.dom.tlCountrySelect) this.dom.tlCountrySelect.value = item.countryCode || this.#tripConfig.homeCountryCode || 'US';
      if (this.dom.tlDetailsInput) this.dom.tlDetailsInput.value = item.details || '';

      if (this.dom.tlDeleteBtn) this.dom.tlDeleteBtn.style.display = 'block';
      this.setTimelineEditorMode('milestone');
    }

    this.dom.timelineSheetBackdrop?.classList.add('is-open');
    this.dom.timelineItemSheet?.classList.add('is-open');
  }

  closeTimelineItemEditor() {
    this.dom.timelineSheetBackdrop?.classList.remove('is-open');
    this.dom.timelineItemSheet?.classList.remove('is-open');
    if (this.dom.timelineItemSheet) {
      this.dom.timelineItemSheet.style.transform = '';
      this.dom.timelineItemSheet.style.transition = '';
    }
  }

  openEventModal(item) {
    if (!item || !this.#tripConfig) return;
    this.#activeEventModalItem = item;
    if (this.dom.eventModalBackdrop) this.dom.eventModalBackdrop.hidden = false;
    if (this.dom.eventModal) this.dom.eventModal.hidden = false;
    this.updateEventModalCountdown();
  }

  closeEventModal() {
    this.#activeEventModalItem = null;
    if (this.dom.eventModalBackdrop) this.dom.eventModalBackdrop.hidden = true;
    if (this.dom.eventModal) this.dom.eventModal.hidden = true;
  }

  updateEventModalCountdown() {
    if (!this.#activeEventModalItem || !this.#tripConfig) return;

    const item = this.#activeEventModalItem;
    const nowMs = this.latestBoardState?.nowMs ?? Date.now();
    const isChapter = isReunionChapter(item);

    let emoji = '';
    let title = '';
    let datePillText = '';
    let locationText = '';
    let targetStartMs = 0;
    let targetEndMs = 0;
    let subtext = '';

    if (isChapter) {
      emoji = item.emoji || '🌺';
      title = item.title;
      datePillText = `${formatDisplayDate(item.startDate)} – ${formatDisplayDate(item.endDate)}`;

      const firstLeg = item.legs?.[0];
      const startCountry = firstLeg ? getCountryInfo(firstLeg.countryCode) : getCountryInfo(this.#tripConfig.homeCountryCode || 'US');
      const lastLeg = item.legs?.[item.legs.length - 1];
      const endCountry = lastLeg ? getCountryInfo(lastLeg.countryCode) : startCountry;

      targetStartMs = getStartOfDayInTimeZoneMs(item.startDate, startCountry.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(item.endDate, endCountry.timeZone);

      const countryNames = item.legs?.map((l) => {
        const c = getCountryInfo(l.countryCode);
        return `${c.flag} ${l.label || c.name}`;
      }).join(' • ') || `${startCountry.flag} ${startCountry.name}`;

      locationText = `Reunion Chapter • ${countryNames}`;
      subtext = item.description || '';
    } else {
      emoji = item.emoji || '✨';
      title = item.title;
      datePillText = formatDisplayDate(item.date);

      const countryInfo = item.countryCode ? getCountryInfo(item.countryCode) : getCountryInfo(this.#tripConfig.homeCountryCode || 'US');
      targetStartMs = getStartOfDayInTimeZoneMs(item.date, countryInfo.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(item.date, countryInfo.timeZone);

      const meta = this.latestBoardState
        ? resolveMilestonePersonMeta(item.person || 'both', this.latestBoardState)
        : { icon: '💕', label: 'Together' };

      locationText = `${countryInfo.flag} ${countryInfo.name} • ${meta.icon} ${meta.label}`;
      subtext = item.details || '';
    }

    if (this.dom.eventModalBadge) this.dom.eventModalBadge.textContent = emoji;
    if (this.dom.eventModalTitle) this.dom.eventModalTitle.textContent = title;
    if (this.dom.eventModalDatePill) {
      this.dom.eventModalDatePill.replaceChildren(createPhotoDateElement(datePillText, { isCompact: true }));
    }
    if (this.dom.eventModalLocation) this.dom.eventModalLocation.textContent = locationText;
    if (this.dom.eventModalSubtext) {
      this.dom.eventModalSubtext.textContent = '';
      this.dom.eventModalSubtext.hidden = true;
    }

    if (nowMs < targetStartMs) {
      const remaining = decomposeRemainingMs(targetStartMs - nowMs);
      if (this.dom.eventCdDays) this.dom.eventCdDays.textContent = String(remaining.days).padStart(2, '0');
      if (this.dom.eventCdHours) this.dom.eventCdHours.textContent = String(remaining.hours).padStart(2, '0');
      if (this.dom.eventCdMinutes) this.dom.eventCdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
      if (this.dom.eventCdSeconds) this.dom.eventCdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

      if (this.dom.eventModalStatusPill) {
        this.dom.eventModalStatusPill.className = 'event-modal-status-pill';
        this.dom.eventModalStatusPill.textContent = remaining.days === 0
          ? 'Starts Today'
          : remaining.days === 1
            ? 'Starts Tomorrow'
            : `${remaining.days} Days Away`;
      }
    } else if (nowMs <= targetEndMs) {
      const remaining = decomposeRemainingMs(targetEndMs - nowMs);
      if (this.dom.eventCdDays) this.dom.eventCdDays.textContent = String(remaining.days).padStart(2, '0');
      if (this.dom.eventCdHours) this.dom.eventCdHours.textContent = String(remaining.hours).padStart(2, '0');
      if (this.dom.eventCdMinutes) this.dom.eventCdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
      if (this.dom.eventCdSeconds) this.dom.eventCdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

      if (this.dom.eventModalStatusPill) {
        this.dom.eventModalStatusPill.className = 'event-modal-status-pill is-active';
        this.dom.eventModalStatusPill.textContent = isChapter ? 'Active Chapter 💕' : 'Happening Today 🎉';
      }
    } else {
      if (this.dom.eventCdDays) this.dom.eventCdDays.textContent = '00';
      if (this.dom.eventCdHours) this.dom.eventCdHours.textContent = '00';
      if (this.dom.eventCdMinutes) this.dom.eventCdMinutes.textContent = '00';
      if (this.dom.eventCdSeconds) this.dom.eventCdSeconds.textContent = '00';

      if (this.dom.eventModalStatusPill) {
        this.dom.eventModalStatusPill.className = 'event-modal-status-pill';
        this.dom.eventModalStatusPill.textContent = 'Completed Event';
      }
    }
  }

  /**
   * Deletes or hides a timeline milestone or reunion chapter and syncs live state.
   * @param {any} item
   */
  async deleteTimelineItem(item) {
    if (!item?.id || !this.#tripConfig) return;
    const id = item.id;
    const isChapter = isReunionChapter(item) || item.isChapter;

    if (isChapter) {
      const customIdx = (this.liveState.customReunions || []).findIndex((r) => r.id === id);
      if (customIdx >= 0) {
        const updated = [...this.liveState.customReunions];
        updated.splice(customIdx, 1);
        this.liveState = { ...this.liveState, customReunions: updated };
      } else {
        this.liveState = {
          ...this.liveState,
          chapterOverrides: {
            ...(this.liveState.chapterOverrides || {}),
            [id]: {
              ...(this.liveState.chapterOverrides?.[id] || {}),
              hidden: true
            }
          }
        };
      }
    } else {
      const customIdx = (this.liveState.customMilestones || []).findIndex((m) => m.id === id);
      if (customIdx >= 0) {
        const updated = [...this.liveState.customMilestones];
        updated.splice(customIdx, 1);
        this.liveState = { ...this.liveState, customMilestones: updated };
      } else {
        this.liveState = {
          ...this.liveState,
          milestoneOverrides: {
            ...(this.liveState.milestoneOverrides || {}),
            [id]: {
              ...(this.liveState.milestoneOverrides?.[id] || {}),
              hidden: true
            }
          }
        };
      }
    }

    this.tick(true);
    this.updateSyncBadge('pending', 'Saving…');
    const result = await saveLiveState(
      this.liveState,
      this.#githubToken,
      this.githubRepo,
      this.#vaultCryptoKey
    );
    this.updateSyncBadge(result.syncedRemotely ? 'synced' : 'pending', 'Successfully updated');
  }

  updateProfileSelectorUI() {
    this.dom.segBtnPrimary?.classList.toggle('is-active', this.activeProfile === 'primary');
    this.dom.segBtnSecondary?.classList.toggle('is-active', this.activeProfile === 'secondary');
  }

  getEffectiveNowMs() {
    return Date.now();
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
    if (this.dom.editBottomSheet) {
      this.dom.editBottomSheet.style.transform = '';
      this.dom.editBottomSheet.style.transition = '';
    }
  }

  syncEditFormWithState() {
    if (!this.#tripConfig) return;
    const state = evaluateBoardState(this.#tripConfig, this.liveState, this.getEffectiveNowMs());
    const partnerStatus = this.activeProfile === 'secondary'
      ? state.dualStatus.secondary
      : state.dualStatus.primary;

    if (this.dom.editCurrentCountryLabel) {
      this.dom.editCurrentCountryLabel.textContent = `${partnerStatus.displayName}'s Current Country`;
    }
    if (this.dom.editCurrentCountry) {
      this.dom.editCurrentCountry.value = partnerStatus.countryCode;
    }
    if (this.dom.editCurrentNote) {
      this.dom.editCurrentNote.value = partnerStatus.cityNote || '';
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

    // 7. Event Modal live countdown (ticks in real time when open)
    if (this.#activeEventModalItem) {
      this.updateEventModalCountdown();
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
