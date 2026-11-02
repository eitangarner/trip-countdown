/**
 * Trip Countdown & Timeline Board
 * StatusEditSheet: User presence, location and partner status bottom sheet controller
 */

import {
  ALL_ISO_3166_CODES,
  PINNED_COUNTRY_CODES,
  getCountryInfo
} from './config.js';
import { bindSheetDragGestures } from './ui-gestures.js';

/**
 * Populates a select element with Pinned Destinations at the top
 * and all 249 ISO countries alphabetically below.
 * @param {HTMLSelectElement | null} selectElement
 * @param {string} [selectedCode]
 * @param {string[]} [pinnedCodes]
 */
export function populateCountrySelect(selectElement, selectedCode = 'US', pinnedCodes = PINNED_COUNTRY_CODES) {
  if (!selectElement) return;
  selectElement.innerHTML = '';

  const pinnedGroup = document.createElement('optgroup');
  pinnedGroup.label = '⭐ Pinned Destinations';
  for (const countryCode of pinnedCodes) {
    const countryInfo = getCountryInfo(countryCode);
    if (!countryInfo) continue;
    const optionElement = document.createElement('option');
    optionElement.value = countryInfo.code;
    optionElement.textContent = `${countryInfo.flag} ${countryInfo.name}`;
    pinnedGroup.appendChild(optionElement);
  }

  const allCountriesGroup = document.createElement('optgroup');
  allCountriesGroup.label = '🌍 All 249 Countries (A–Z)';
  const sortedAllCountries = ALL_ISO_3166_CODES
    .map((code) => getCountryInfo(code))
    .sort((countryA, countryB) => countryA.name.localeCompare(countryB.name));
  for (const countryInfo of sortedAllCountries) {
    const optionElement = document.createElement('option');
    optionElement.value = countryInfo.code;
    optionElement.textContent = `${countryInfo.flag} ${countryInfo.name}`;
    allCountriesGroup.appendChild(optionElement);
  }

  selectElement.appendChild(pinnedGroup);
  selectElement.appendChild(allCountriesGroup);
  selectElement.value = selectedCode;
}

/**
 * Immutably applies a manual partner status override to the LiveState payload.
 * @param {import('./config.js').LiveStatePayload} liveState
 * @param {{ partnerKey: string, countryCode: string, cityNote: string, updatedAt: string }} payload
 * @returns {import('./config.js').LiveStatePayload}
 */
export function applyStatusOverrideToLiveState(liveState, { partnerKey, countryCode, cityNote, updatedAt }) {
  return {
    ...liveState,
    statusOverrides: {
      ...(liveState.statusOverrides || {}),
      [partnerKey]: {
        countryCode,
        cityNote,
        updatedAt
      }
    }
  };
}

/**
 * Immutably clears manual partner status overrides, resetting to auto schedule.
 * @param {import('./config.js').LiveStatePayload} liveState
 * @param {{ partnerKey: string }} payload
 * @returns {import('./config.js').LiveStatePayload}
 */
export function clearStatusOverrideInLiveState(liveState, { partnerKey }) {
  const updatedOverrides = { ...(liveState.statusOverrides || {}) };
  delete updatedOverrides[partnerKey];
  return {
    ...liveState,
    statusOverrides: updatedOverrides
  };
}

export class StatusEditSheet {
  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {{ primaryName: string, secondaryName: string, firstPartnerKey: string, secondPartnerKey: string } | null} */
  #partnerNames = null;

  /** @type {'primary' | 'secondary'} */
  #activeProfile = 'primary';

  /** @type {import('./config.js').EvaluatedBoardState | null} */
  #latestBoardState = null;

  /** @type {(() => void) | null} */
  #unbindGestures = null;

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {((overridePayload: { partnerKey: string, countryCode: string, cityNote: string, profile: 'primary' | 'secondary' }) => Promise<void> | void) | null} */
  #onSaveStatus = null;

  /** @type {((data: { partnerKey: string, profile: 'primary' | 'secondary' }) => Promise<void> | void) | null} */
  #onClearStatus = null;

  /** @type {(() => void) | null} */
  #onLockDevice = null;

  /** @type {Record<string, HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLFormElement | null>} */
  #dom = {};

  /**
   * @param {object} [options]
   * @param {(overridePayload: { partnerKey: string, countryCode: string, cityNote: string, profile: 'primary' | 'secondary' }) => Promise<void> | void} [options.onSaveStatus]
   * @param {(overridePayload: any) => Promise<void> | void} [options.onSave]
   * @param {(data: { partnerKey: string, profile: 'primary' | 'secondary' }) => Promise<void> | void} [options.onClearStatus]
   * @param {(data: any) => Promise<void> | void} [options.onClearOverrides]
   * @param {() => void} [options.onLockDevice]
   */
  constructor(options = {}) {
    this.#onSaveStatus = options.onSaveStatus || options.onSave || null;
    this.#onClearStatus = options.onClearStatus || options.onClearOverrides || null;
    this.#onLockDevice = options.onLockDevice || null;

    this.#cacheDomElements();
    this.#bindListeners();
  }

  #cacheDomElements() {
    if (typeof document === 'undefined') return;
    this.#dom = {
      sheetBackdrop: document.getElementById('edit-sheet-backdrop'),
      bottomSheet: document.getElementById('edit-bottom-sheet'),
      sheetHandleWrapper: document.getElementById('sheet-handle-wrapper'),
      sheetHeader: document.getElementById('sheet-header'),
      closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('edit-sheet-close-btn')),
      form: /** @type {HTMLFormElement | null} */ (document.getElementById('status-update-form')),
      syncStatusPill: document.getElementById('sync-status-pill'),
      segBtnPrimary: /** @type {HTMLButtonElement | null} */ (document.getElementById('seg-btn-primary')),
      segBtnSecondary: /** @type {HTMLButtonElement | null} */ (document.getElementById('seg-btn-secondary')),
      countryLabel: document.getElementById('edit-current-country-label'),
      countrySelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('edit-current-country')),
      noteLabel: document.getElementById('edit-current-note-label'),
      noteInput: /** @type {HTMLInputElement | null} */ (document.getElementById('edit-current-note')),
      clearStatusOverridesBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('clear-status-overrides-btn')),
      lockDeviceBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('lock-device-btn')),
      fabEditBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('fab-edit-btn'))
    };
  }

  #bindListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#dom.fabEditBtn?.addEventListener('click', () => {
      this.open(this.#latestBoardState);
    }, { signal });

    this.#dom.closeBtn?.addEventListener('click', () => this.close(), { signal });
    this.#dom.sheetBackdrop?.addEventListener('click', () => this.close(), { signal });

    this.#dom.segBtnPrimary?.addEventListener('click', () => {
      this.setActiveProfile('primary');
    }, { signal });

    this.#dom.segBtnSecondary?.addEventListener('click', () => {
      this.setActiveProfile('secondary');
    }, { signal });

    this.#dom.form?.addEventListener('submit', (submitEvent) => {
      void this.#handleFormSubmit(submitEvent);
    }, { signal });

    this.#dom.clearStatusOverridesBtn?.addEventListener('click', () => {
      void this.#handleClearStatus();
    }, { signal });

    this.#dom.lockDeviceBtn?.addEventListener('click', () => {
      this.#handleLockDevice();
    }, { signal });
  }

  async #handleFormSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (!this.#tripConfig || !this.#partnerNames) return;

    const targetPartnerKey = this.#activeProfile === 'secondary'
      ? this.#partnerNames.secondPartnerKey
      : this.#partnerNames.firstPartnerKey;
    const homeCode = this.#tripConfig.homeCountryCode || 'US';
    const countryCode = this.#dom.countrySelect?.value || homeCode;
    const cityNote = (this.#dom.noteInput?.value || '').trim();

    if (this.#onSaveStatus) {
      await this.#onSaveStatus({
        partnerKey: targetPartnerKey,
        countryCode,
        cityNote,
        profile: this.#activeProfile
      });
    }
  }

  async #handleClearStatus() {
    if (!this.#tripConfig || !this.#partnerNames) return;

    const targetPartnerKey = this.#activeProfile === 'secondary'
      ? this.#partnerNames.secondPartnerKey
      : this.#partnerNames.firstPartnerKey;

    if (this.#onClearStatus) {
      await this.#onClearStatus({
        partnerKey: targetPartnerKey,
        profile: this.#activeProfile
      });
    }
  }

  #handleLockDevice() {
    this.#onLockDevice?.();
  }

  /**
   * @param {import('./config.js').TripConfig} tripConfig
   * @param {{ primaryName?: string, primary?: string, secondaryName?: string, secondary?: string, firstPartnerKey: string, secondPartnerKey: string }} partnerMetadata
   */
  mount(tripConfig, partnerMetadata) {
    this.#tripConfig = tripConfig;
    const primaryName = partnerMetadata.primaryName || partnerMetadata.primary || partnerMetadata.firstPartnerKey;
    const secondaryName = partnerMetadata.secondaryName || partnerMetadata.secondary || partnerMetadata.secondPartnerKey;

    this.#partnerNames = {
      primaryName,
      secondaryName,
      firstPartnerKey: partnerMetadata.firstPartnerKey,
      secondPartnerKey: partnerMetadata.secondPartnerKey
    };

    if (this.#dom.bottomSheet) this.#dom.bottomSheet.hidden = false;
    if (this.#dom.segBtnPrimary) this.#dom.segBtnPrimary.textContent = primaryName;
    if (this.#dom.segBtnSecondary) this.#dom.segBtnSecondary.textContent = secondaryName;

    try {
      const savedProfile = localStorage?.getItem('trip_preferred_profile');
      if (savedProfile === 'secondary' || savedProfile === 'primary') {
        this.#activeProfile = savedProfile;
      }
    } catch {
      // Storage access restricted
    }

    this.#updateProfileSelectorUI();

    const pinnedCodes = Array.isArray(tripConfig.pinnedCountryCodes) && tripConfig.pinnedCountryCodes.length > 0
      ? tripConfig.pinnedCountryCodes
      : PINNED_COUNTRY_CODES;
    const homeCode = tripConfig.homeCountryCode || 'US';
    populateCountrySelect(this.#dom.countrySelect, homeCode, pinnedCodes);

    this.#unbindGestures?.();
    this.#unbindGestures = bindSheetDragGestures(
      this.#dom.bottomSheet,
      this.#dom.sheetHandleWrapper || this.#dom.sheetHeader,
      () => this.close()
    );
  }

  /**
   * @param {import('./config.js').EvaluatedBoardState | null} [boardState]
   */
  open(boardState = null) {
    if (!this.#tripConfig) return;
    if (boardState) {
      this.syncForm(boardState);
    }
    this.#dom.sheetBackdrop?.classList.add('is-open');
    this.#dom.bottomSheet?.classList.add('is-open');
  }

  close() {
    this.#dom.sheetBackdrop?.classList.remove('is-open');
    this.#dom.bottomSheet?.classList.remove('is-open');
    if (this.#dom.bottomSheet) {
      this.#dom.bottomSheet.style.transform = '';
      this.#dom.bottomSheet.style.transition = '';
    }
  }

  isOpen() {
    return Boolean(this.#dom.bottomSheet?.classList.contains('is-open'));
  }

  /**
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  syncForm(boardState) {
    if (!this.#tripConfig || !boardState?.dualStatus) return;
    this.#latestBoardState = boardState;

    const partnerStatus = this.#activeProfile === 'secondary'
      ? boardState.dualStatus.secondary
      : boardState.dualStatus.primary;

    if (this.#dom.countryLabel) {
      this.#dom.countryLabel.textContent = `${partnerStatus.displayName}'s Current Country`;
    }
    if (this.#dom.countrySelect) {
      this.#dom.countrySelect.value = partnerStatus.countryCode;
    }
    if (this.#dom.noteInput) {
      this.#dom.noteInput.value = partnerStatus.cityNote || '';
    }
  }

  /**
   * @param {'primary' | 'secondary'} targetProfile
   * @param {import('./config.js').EvaluatedBoardState | null} [boardState]
   */
  setActiveProfile(targetProfile, boardState = this.#latestBoardState) {
    if (targetProfile !== 'primary' && targetProfile !== 'secondary') return;
    this.#activeProfile = targetProfile;
    try {
      localStorage?.setItem('trip_preferred_profile', targetProfile);
    } catch {
      // Storage access restricted
    }
    this.#updateProfileSelectorUI();
    if (boardState) {
      this.syncForm(boardState);
    }
  }

  getActiveProfile() {
    return this.#activeProfile;
  }

  #updateProfileSelectorUI() {
    this.#dom.segBtnPrimary?.classList.toggle('is-active', this.#activeProfile === 'primary');
    this.#dom.segBtnSecondary?.classList.toggle('is-active', this.#activeProfile === 'secondary');
  }

  /**
   * @param {string} syncStateKey
   * @param {string} statusText
   */
  updateSyncBadge(syncStateKey, statusText) {
    if (!this.#dom.syncStatusPill) return;
    this.#dom.syncStatusPill.dataset.syncState = syncStateKey;
    this.#dom.syncStatusPill.textContent = statusText;
  }

  /**
   * @param {boolean} isVisible
   */
  setFabVisible(isVisible) {
    if (this.#dom.fabEditBtn) {
      this.#dom.fabEditBtn.hidden = !isVisible;
    }
  }

  destroy() {
    this.close();
    this.#unbindGestures?.();
    this.#unbindGestures = null;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#tripConfig = null;
    this.#partnerNames = null;
    this.#latestBoardState = null;
  }
}
