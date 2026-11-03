/**
 * Trip Countdown & Timeline Board
 * Streamlined Application Lifecycle & Board State Coordinator
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
import { bindTabSwipeGestures } from './ui-gestures.js';
import {
  StatusEditSheet,
  applyStatusOverrideToLiveState,
  clearStatusOverrideInLiveState
} from './ui-status-sheet.js';
import {
  TimelineEditorSheet,
  applyTimelineDeleteToLiveState,
  applyTimelineSaveToLiveState
} from './ui-editor-sheet.js';
import { PreviewBannerController } from './ui-preview-banner.js';
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
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutesRemainder = absoluteMinutes % 60;
  return minutesRemainder === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutesRemainder).padStart(2, '0')}`;
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
    /** @type {import('./config.js').EvaluatedBoardState | null} */
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

      statusCardPrimary: document.getElementById('status-card-primary'),
      statusCardSecondary: document.getElementById('status-card-secondary'),

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
      onEdit: (timelineEntry) => this.timelineEditorSheet.open(timelineEntry)
    });

    this.timelineEditorSheet = new TimelineEditorSheet({
      onSave: (savePayload) => this.persistLiveState(applyTimelineSaveToLiveState(this.liveState, savePayload)),
      onDelete: (deletePayload) => this.persistLiveState(applyTimelineDeleteToLiveState(this.liveState, deletePayload))
    });

    this.timelineRenderer = new TimelineRenderer({
      statsPillEl: this.dom.tripStatsPill,
      pastToggleBtn: this.dom.pastChaptersToggle,
      pastDrawerEl: this.dom.pastChaptersDrawer,
      upcomingTrackEl: this.dom.timelineUpcomingTrack,
      onEditItem: (timelineEntry) => this.eventCountdownModal.open(timelineEntry, this.latestBoardState),
      onDeleteItem: (timelineEntry) => this.timelineEditorSheet.deleteItem(timelineEntry),
      onEditLeg: (reunion, legIndex) => this.timelineEditorSheet.open(reunion, legIndex),
      onOpenDaysBreakdown: () => this.daysBreakdownModal.open(this.latestBoardState)
    });

    this.previewBanner = new PreviewBannerController({
      onPreviewChange: () => this.tick(true)
    });

    this.statusEditSheet = new StatusEditSheet({
      onSaveStatus: (overridePayload) => {
        const updatedAt = new Date(this.getEffectiveNowMs()).toISOString();
        return this.persistLiveState(applyStatusOverrideToLiveState(this.liveState, { ...overridePayload, updatedAt }));
      },
      onClearStatus: async (clearPayload) => {
        await this.persistLiveState(clearStatusOverrideInLiveState(this.liveState, clearPayload));
        if (this.latestBoardState) {
          this.statusEditSheet.syncForm(this.latestBoardState);
        }
      },
      onLockDevice: () => {
        void this.lockAndPurgeBoard();
      }
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
      (syncOutcome) => {
        this.statusEditSheet.updateSyncBadge(
          syncOutcome.syncedRemotely ? 'synced' : 'pending',
          syncOutcome.message
        );
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

  async mountUnlockedVault(decryptedVaultPayload) {
    if (!decryptedVaultPayload || !decryptedVaultPayload.tripConfig) {
      throw new Error('Decrypted vault is missing required tripConfig.');
    }

    this.#tripConfig = decryptedVaultPayload.tripConfig;
    this.#githubToken = decryptedVaultPayload.githubToken ?? null;
    this.#vaultCryptoKey = getVaultCryptoKey(decryptedVaultPayload);
    this.githubRepo = decryptedVaultPayload.githubRepo ?? null;
    this.encryptedVaultJson = null;

    const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(this.#tripConfig);
    const primaryName = this.#tripConfig.coupleNames?.[firstPartnerKey] || firstPartnerKey;
    const secondaryName = this.#tripConfig.coupleNames?.[secondPartnerKey] || secondPartnerKey;

    if (typeof document !== 'undefined') {
      document.title = `${secondaryName} & ${primaryName} — Countdown & Journey Board`;
    }

    this.previewBanner.setTripConfig(this.#tripConfig);
    this.statusEditSheet.mount(this.#tripConfig, {
      primaryName,
      secondaryName,
      firstPartnerKey,
      secondPartnerKey
    });
    this.timelineEditorSheet.mount(this.#tripConfig);

    if (this.dom.boardContainer) this.dom.boardContainer.hidden = false;
    if (this.dom.bottomNav) this.dom.bottomNav.hidden = false;
    this.dom.vaultOverlay?.classList.add('is-unlocked');
    this.switchView('countdown');

    if (Array.isArray(decryptedVaultPayload.photos) && decryptedVaultPayload.photos.length > 0) {
      this.photoStack.setPhotos(decryptedVaultPayload.photos);
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

  async persistLiveState(nextLiveState) {
    this.liveState = nextLiveState;
    this.tick(true);
    this.statusEditSheet.updateSyncBadge('pending', 'Saving…');
    const syncOutcome = await saveLiveState(
      this.liveState,
      this.#githubToken,
      this.githubRepo,
      this.#vaultCryptoKey
    );
    this.statusEditSheet.updateSyncBadge(
      syncOutcome.syncedRemotely ? 'synced' : 'pending',
      syncOutcome.message || 'Successfully updated'
    );
  }

  async lockAndPurgeBoard() {
    this.stopTickLoop();
    this.#githubToken = null;
    this.#vaultCryptoKey = null;
    this.#tripConfig = null;
    this.githubRepo = null;
    this.lastTimelineSignature = '';
    this.lastSoonerMilestoneSignature = '';
    this.latestBoardState = null;
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
    for (const textElement of textElementsToClear) {
      if (textElement) textElement.textContent = '';
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
    this.dom.vaultForm?.addEventListener('submit', async (submitEvent) => {
      submitEvent.preventDefault();
      const enteredPassword = this.dom.vaultPasswordInput?.value ?? '';
      const rememberKey = Boolean(this.dom.vaultRememberCheckbox?.checked);

      if (!enteredPassword) return;
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

        const decryptedPayload = await unlockAndCacheVault(this.encryptedVaultJson, enteredPassword, rememberKey);
        if (this.dom.vaultPasswordInput) this.dom.vaultPasswordInput.value = '';
        await this.mountUnlockedVault(decryptedPayload);
      } catch (unlockError) {
        if (this.dom.vaultErrorMsg) {
          const errorMessage =
            unlockError instanceof Error && unlockError.message.includes('tripConfig')
              ? 'Vault schema outdated — re-run scripts/encrypt-vault.mjs with your password.'
              : 'Incorrect password — please try again.';
          this.dom.vaultErrorMsg.textContent = errorMessage;
        }
        this.dom.vaultCard?.classList.remove('is-error');
        void this.dom.vaultCard?.offsetWidth;
        this.dom.vaultCard?.classList.add('is-error');
      } finally {
        if (this.dom.vaultUnlockBtn) this.dom.vaultUnlockBtn.disabled = false;
      }
    });

    this.dom.navBtnCountdown?.addEventListener('click', () => {
      window.scrollTo(0, 0);
      this.switchView('countdown');
    });
    this.dom.navBtnTimeline?.addEventListener('click', () => {
      window.scrollTo(0, 0);
      this.switchView('timeline');
    });

    this.dom.addTimelineItemBtn?.addEventListener('click', () => {
      this.timelineEditorSheet.open(null);
    });

    const handlePrimaryCardClick = () => {
      this.statusEditSheet.open(this.latestBoardState, 'primary');
    };
    this.dom.statusCardPrimary?.addEventListener('click', handlePrimaryCardClick);
    this.dom.statusCardPrimary?.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        handlePrimaryCardClick();
      }
    });

    const handleSecondaryCardClick = () => {
      this.statusEditSheet.open(this.latestBoardState, 'secondary');
    };
    this.dom.statusCardSecondary?.addEventListener('click', handleSecondaryCardClick);
    this.dom.statusCardSecondary?.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        handleSecondaryCardClick();
      }
    });

    this.unbindTabSwipe = bindTabSwipeGestures({
      containerElement: this.dom.boardContainer,
      onSwipeLeft: () => {
        if (this.activeView === 'countdown') {
          window.scrollTo(0, 0);
          this.switchView('timeline');
        }
      },
      onSwipeRight: () => {
        if (this.activeView === 'timeline') {
          window.scrollTo(0, 0);
          this.switchView('countdown');
        }
      },
      isSwipeEnabled: () => {
        return (
          !this.statusEditSheet.isOpen() &&
          !this.timelineEditorSheet.isOpen() &&
          !this.eventCountdownModal.isOpen() &&
          !this.daysBreakdownModal.isOpen()
        );
      }
    });

    this.dom.lockDeviceBtn?.addEventListener('click', () => {
      void this.lockAndPurgeBoard();
    });

    window.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') {
        if (this.daysBreakdownModal.isOpen()) {
          this.daysBreakdownModal.close();
        } else if (this.eventCountdownModal.isOpen()) {
          this.eventCountdownModal.close();
        } else if (this.timelineEditorSheet.isOpen()) {
          this.timelineEditorSheet.close();
        } else if (this.statusEditSheet.isOpen()) {
          this.statusEditSheet.close();
        }
      } else if (keyboardEvent.key === 'p' || keyboardEvent.key === 'P') {
        if (!this.#tripConfig) return;
        const activePreviewTimestamp = this.previewBanner.getPreviewTimestamp();
        if (activePreviewTimestamp !== null) {
          this.previewBanner.reset();
        } else {
          this.previewBanner.stepDays(1);
        }
      } else if (keyboardEvent.key === 'ArrowRight' || keyboardEvent.key === 'ArrowLeft') {
        if (!this.#tripConfig) return;
        if (this.previewBanner.getPreviewTimestamp() !== null) {
          this.previewBanner.stepDays(keyboardEvent.key === 'ArrowRight' ? 1 : -1);
        }
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.#tripConfig) {
          this.tick(false);
        }
      });
    }
  }

  switchView(viewName) {
    if (viewName === this.activeView) return;
    const previousView = this.activeView;
    this.activeView = viewName;
    if (this.dom.bottomNav) {
      this.dom.bottomNav.setAttribute('data-active-view', viewName);
    }
    const isTransitionForward = (previousView === 'countdown' && viewName === 'timeline');
    const isTransitionBackward = (previousView === 'timeline' && viewName === 'countdown');

    if (this.dom.viewCountdown) {
      this.dom.viewCountdown.hidden = viewName !== 'countdown';
      if (viewName === 'countdown' && isTransitionBackward) {
        this.dom.viewCountdown.classList.remove('slide-forward', 'slide-backward');
        void this.dom.viewCountdown.offsetWidth;
        this.dom.viewCountdown.classList.add('slide-backward');
      }
    }
    if (this.dom.viewTimeline) {
      this.dom.viewTimeline.hidden = viewName !== 'timeline';
      if (viewName === 'timeline' && isTransitionForward) {
        this.dom.viewTimeline.classList.remove('slide-forward', 'slide-backward');
        void this.dom.viewTimeline.offsetWidth;
        this.dom.viewTimeline.classList.add('slide-forward');
      }
    }
    this.dom.navBtnCountdown?.classList.toggle('is-active', viewName === 'countdown');
    this.dom.navBtnTimeline?.classList.toggle('is-active', viewName === 'timeline');
    this.statusEditSheet.setFabVisible(viewName === 'countdown');
  }

  tick(forceTimelineRender = false) {
    if (!this.#tripConfig) return;

    const currentEpochMs = this.getEffectiveNowMs();
    const evaluatedBoardState = evaluateBoardState(this.#tripConfig, this.liveState, currentEpochMs);
    this.latestBoardState = evaluatedBoardState;

    // 1. Relationship Duration Top Pill
    const relationshipMeta = evaluatedBoardState.relationshipDuration;
    if (this.dom.relationshipDaysPrimary) {
      this.dom.relationshipDaysPrimary.textContent = `${relationshipMeta.totalDays} Days Together`;
    }
    if (this.dom.relationshipDaysBreakdown) {
      this.dom.relationshipDaysBreakdown.textContent = `${relationshipMeta.months} Months, ${relationshipMeta.daysRemainder} Days`;
    }

    // 2. Phase Banner Pill
    if (this.dom.phaseBannerPill) {
      this.dom.phaseBannerPill.textContent = evaluatedBoardState.phaseBannerText;
    }

    // 3. Primary Countdown vs Together Celebration View
    if (evaluatedBoardState.phase === 'TOGETHER' && evaluatedBoardState.activeReunion) {
      if (this.dom.countdownApartView) this.dom.countdownApartView.hidden = true;
      if (this.dom.countdownTogetherView) this.dom.countdownTogetherView.hidden = false;

      const activeReunionMeta = evaluatedBoardState.activeReunion;
      const legCountry = getCountryInfo(activeReunionMeta.activeLeg.countryCode);
      const legDisplayName = activeReunionMeta.activeLeg.label || legCountry.name;

      if (this.dom.togetherLegBadge) {
        const legTag = activeReunionMeta.totalLegs > 1
          ? `Leg ${activeReunionMeta.legIndex + 1} of ${activeReunionMeta.totalLegs} • ${legCountry.flag} ${legDisplayName}`
          : `${legCountry.flag} ${legDisplayName}`;
        this.dom.togetherLegBadge.textContent = `${legTag} • Day ${activeReunionMeta.dayOfReunion} of ${activeReunionMeta.totalReunionDays}`;
      }

      if (this.dom.togetherHeadline) {
        this.dom.togetherHeadline.textContent = `${activeReunionMeta.reunion.emoji} Together in ${legDisplayName}!`;
      }

      if (this.dom.togetherSubtext) {
        if (activeReunionMeta.nextLeg) {
          const nextCountry = getCountryInfo(activeReunionMeta.nextLeg.countryCode);
          const nextLegDisplayName = activeReunionMeta.nextLeg.label || nextCountry.name;
          this.dom.togetherSubtext.textContent = `Next leg: ${nextCountry.flag} ${nextLegDisplayName} in ${activeReunionMeta.daysUntilNextLeg} day${activeReunionMeta.daysUntilNextLeg === 1 ? '' : 's'} (${formatShortDisplayDate(activeReunionMeta.nextLeg.startDate)})`;
        } else {
          this.dom.togetherSubtext.textContent = activeReunionMeta.activeLeg.notes || activeReunionMeta.reunion.description;
        }
      }

      const celebrationProgressPct = Math.min(100, Math.max(4, Math.round((activeReunionMeta.dayOfReunion / activeReunionMeta.totalReunionDays) * 100)));
      if (this.dom.togetherProgressDay) {
        this.dom.togetherProgressDay.textContent = `Day ${activeReunionMeta.dayOfReunion} / ${activeReunionMeta.totalReunionDays}`;
      }
      if (this.dom.togetherProgressFill) {
        this.dom.togetherProgressFill.style.width = `${celebrationProgressPct}%`;
      }
    } else if (evaluatedBoardState.primaryCountdown) {
      if (this.dom.countdownApartView) this.dom.countdownApartView.hidden = false;
      if (this.dom.countdownTogetherView) this.dom.countdownTogetherView.hidden = true;

      const countdownMeta = evaluatedBoardState.primaryCountdown;
      if (this.dom.countdownTargetLabel) {
        this.dom.countdownTargetLabel.textContent = evaluatedBoardState.phase === 'PRE_TRIP'
          ? 'Countdown to Reunion #1'
          : 'Countdown to Next Reunion';
      }
      if (this.dom.countdownTargetTitle) {
        this.dom.countdownTargetTitle.textContent = `${countdownMeta.targetEmoji} ${countdownMeta.targetTitle}`;
      }
      if (this.dom.countdownTargetDate) {
        this.dom.countdownTargetDate.replaceChildren(createPhotoDateElement(countdownMeta.targetDate, { isCompact: true }));
      }

      if (this.dom.cdDays) this.dom.cdDays.textContent = String(countdownMeta.days).padStart(2, '0');
      if (this.dom.cdHours) this.dom.cdHours.textContent = String(countdownMeta.hours).padStart(2, '0');
      if (this.dom.cdMinutes) this.dom.cdMinutes.textContent = String(countdownMeta.minutes).padStart(2, '0');
      if (this.dom.cdSeconds) this.dom.cdSeconds.textContent = String(countdownMeta.seconds).padStart(2, '0');

      if (this.dom.separationProgressContainer) {
        this.dom.separationProgressContainer.hidden = true;
      }
    }

    // 4. Secondary Sooner Milestone Sub-Banner
    if (this.dom.subMilestoneBanner) {
      if (evaluatedBoardState.soonerMilestone) {
        const soonerEntry = evaluatedBoardState.soonerMilestone;
        const soonerSignature = `${soonerEntry.id}:${soonerEntry.title}:${soonerEntry.date}`;
        if (forceTimelineRender || soonerSignature !== this.lastSoonerMilestoneSignature) {
          this.lastSoonerMilestoneSignature = soonerSignature;
          const daysAwayLabel = evaluatedBoardState.soonerMilestoneDaysAway === 0
            ? 'Today!'
            : evaluatedBoardState.soonerMilestoneDaysAway === 1
              ? 'Tomorrow'
              : '';

          this.dom.subMilestoneBanner.hidden = false;
          this.dom.subMilestoneBanner.textContent = '';

          const emojiBadge = document.createElement('span');
          emojiBadge.textContent = soonerEntry.emoji;

          const labelWrapper = document.createElement('span');
          const dateElement = document.createElement('strong');
          dateElement.className = 'numeric-lock';
          dateElement.setAttribute('dir', 'ltr');
          dateElement.textContent = daysAwayLabel
            ? `${daysAwayLabel} (${formatShortDisplayDate(soonerEntry.date)})`
            : formatShortDisplayDate(soonerEntry.date);

          const titleElement = document.createElement('span');
          titleElement.setAttribute('dir', 'auto');
          titleElement.textContent = soonerEntry.title;

          labelWrapper.append(dateElement, document.createTextNode(': '), titleElement);
          this.dom.subMilestoneBanner.append(emojiBadge, labelWrapper);
        }
      } else {
        this.lastSoonerMilestoneSignature = 'none';
        this.dom.subMilestoneBanner.hidden = true;
      }
    }

    // 5. Dual Status & Timezone Bridge
    const { primary, secondary, isSameTimeZone, bridgeLabel } = evaluatedBoardState.dualStatus;
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
    const timelineSignature = `${evaluatedBoardState.phase}:${evaluatedBoardState.activeReunion?.activeLeg.id ?? 'none'}:${evaluatedBoardState.timeline.pastItems.length}:${evaluatedBoardState.timeline.upcomingItems.length}:${evaluatedBoardState.timeline.plannedTripDaysTogether}:${evaluatedBoardState.timeline.completedTripDaysTogether}`;
    if (forceTimelineRender || timelineSignature !== this.lastTimelineSignature) {
      this.lastTimelineSignature = timelineSignature;
      this.timelineRenderer.render(evaluatedBoardState);
    }

    // 7. Active Event Modal live countdown tick
    if (this.eventCountdownModal.isOpen()) {
      this.eventCountdownModal.updateCountdown(currentEpochMs, evaluatedBoardState);
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
    const countdownBoardApp = new CountdownBoardApp();
    void countdownBoardApp.init();
  });
}
