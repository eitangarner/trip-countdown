# Handoff Report: UI Bottom Sheets Modularization (`ui-status-sheet.js` & `ui-editor-sheet.js`)

## 1. Observation

Direct code and DOM inspection revealed the following facts across `js/app.js`, `index.html`, and `js/config.js`:

### 1.1 Status Edit Sheet (`#edit-bottom-sheet`)
- **HTML Footprint (`index.html:238–311`)**:
  - Backdrop: `<div class="edit-sheet-backdrop" id="edit-sheet-backdrop"></div>`
  - Sheet container: `<aside class="edit-bottom-sheet" id="edit-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-sheet-title" hidden>`
  - Handle & Header: `#sheet-handle-wrapper`, `#sheet-header`, `#edit-sheet-title`, `#edit-sheet-close-btn`
  - Quick Status Form: `<form class="edit-section" id="status-update-form">`
  - Sync Badge: `<span class="sync-status-pill" id="sync-status-pill" data-sync-state="synced">Ready</span>`
  - Device Profile Selector: `#profile-segmented-control`, `#seg-btn-primary`, `#seg-btn-secondary`
  - Country & Note Inputs: `#edit-current-country-label`, `<select class="form-select" id="edit-current-country">`, `#edit-current-note-label`, `<input type="text" class="form-input" id="edit-current-note" dir="auto" placeholder="Current city or note…" maxlength="60" />`
  - Reset & Lock: `<button type="button" id="clear-status-overrides-btn">Reset to Auto</button>`, `<button type="button" id="lock-device-btn">🔒 Lock App</button>`
  - FAB Trigger: `<button class="update-status-fab" id="fab-edit-btn" aria-label="Update location or status">` (`index.html:231`)
- **Current Logic in `js/app.js`**:
  - `populateCountrySelect(selectEl, selectedCode = 'US', pinnedCodes = PINNED_COUNTRY_CODES)` (`js/app.js:70–100`): Populates `<select>` with `'⭐ Pinned Destinations'` and `'🌍 All 249 Countries (A–Z)'` from `js/config.js`.
  - DOM caching (`js/app.js:238–254`): Caches 13 separate DOM element references.
  - Initial setup (`js/app.js:365–376, 398`): Labels buttons with partner names from `resolvePartnerConfigMeta`, restores `trip_preferred_profile` from `localStorage`, calls `populateCountrySelect(this.dom.editCurrentCountry, homeCode, pinnedCodes)`.
  - Event listeners (`js/app.js:592–594, 643–713, 883–885`): Listens for FAB click, close button, backdrop click, segmented profile clicks, form submit, reset button click, lock button click.
  - Sheet open/close (`js/app.js:1565–1579`): Adds/removes `.is-open` class on backdrop and sheet, clears inline transforms.
  - Form state sync (`js/app.js:1581–1597`): Queries `evaluateBoardState()`, extracts `state.dualStatus[activeProfile]`, updates label text, select value, and city note input.
  - Badge update (`js/app.js:1599–1603`): Updates `syncStatusPill.dataset.syncState` and text.

### 1.2 Timeline Editor Sheet (`#timeline-item-sheet`)
- **HTML Footprint (`index.html:314–449`)**:
  - Backdrop: `<div class="edit-sheet-backdrop" id="timeline-sheet-backdrop"></div>`
  - Sheet container: `<aside class="edit-bottom-sheet" id="timeline-item-sheet" role="dialog" aria-modal="true" aria-labelledby="timeline-sheet-title" hidden>`
  - Handle & Header: `#timeline-sheet-handle-wrapper`, `#timeline-sheet-header`, `#timeline-sheet-title`, `#timeline-sheet-close-btn`
  - Form: `<form class="edit-section" id="timeline-item-form">`
  - Toggle Group: `#timeline-type-toggle-group`, `#timeline-type-milestone-btn`, `#timeline-type-chapter-btn`
  - Hidden ID: `<input type="hidden" id="tl-item-id-input" value="" />`
  - Milestone Fields: `#timeline-milestone-fields`, `#tl-title-input` (`dir="auto"`), `#tl-date-input` (`class="numeric-lock" dir="ltr"`), `#tl-person-select`, `#tl-country-select`, `#tl-details-input` (`dir="auto"`)
  - Chapter Fields: `#timeline-chapter-fields` (`hidden`), `#tl-chapter-title-input` (`dir="auto"`), `#tl-chapter-emoji-input`, `#tl-add-leg-btn`, `#tl-chapter-legs-list`, `#tl-chapter-desc-input` (`dir="auto"`)
  - Form Actions: `#tl-save-btn`, `#tl-delete-btn` (`hidden`)
- **Current Logic in `js/app.js`**:
  - DOM caching (`js/app.js:255–280`): Caches 26 separate DOM element references.
  - Person select setup (`js/app.js:378–390`): Populates `'both'` (💕 Together), `firstPartnerKey` (🌸 Primary), `secondPartnerKey` (🌊 Secondary).
  - Mode toggle (`js/app.js:1008–1023`): `setTimelineEditorMode(mode)` switches between `'milestone'` and `'chapter'`, updates required attributes on inputs, toggles visibility.
  - Dynamic leg rows (`js/app.js:1086–1229`): `renderChapterLegRows(legs, focusLegIndex)` builds editable cards containing country select, display name (`dir="auto"`), start/end dates (`.numeric-lock dir="ltr"`), and remove button. If `focusLegIndex` provided, smoothly scrolls to card and focuses label input.
  - Leg appending (`js/app.js:1234–1259`): `appendChapterLegRow()` collects current legs, defaults start date to previous leg's end date, adds 7 days for end date, selects unused pinned country, and auto-syncs chapter title.
  - Leg collection (`js/app.js:1054–1084`): `collectChapterLegsFromDom()` reads leg cards from DOM and returns `ReunionLeg[]`.
  - Auto title sync (`js/app.js:1040–1048`): `syncAutoChapterTitleWithLegCount(legCount)` dynamically updates title if matching `/^Together Across \d+ Countr(?:y|ies)$/i`.
  - Sheet open/close (`js/app.js:1266–1346`): Differentiates `item === null` (new entry), `isReunionChapter(item)` (chapter edit), and milestone edit.
  - Form submission (`js/app.js:727–872`): Validates legs/dates, creates or updates `customReunions` / `chapterOverrides` or `customMilestones` / `milestoneOverrides`.
  - Item deletion (`js/app.js:875–880, 1502–1554`): Marks override as `hidden: true` or splices from custom arrays.

### 1.3 Shared Touch Drag Gestures
- `bindSheetDragGestures` (`js/app.js:903–975`): Binds touch gestures on handle/header and top scroll threshold, translating sheet with `translateY(${deltaY}px)` and dismissing when `deltaY > 80`. Returns no cleanup in current monolithic code.
- Being extracted into `js/ui-gestures.js` by `explorer_m4_1` returning an explicit unbind cleanup function `() => void`.

---

## 2. Logic Chain

1. **SRP and Domain Boundaries**:
   - `StatusEditSheet` manages user presence: country selection, city/vibe note, partner profile switching, and live status override persistence.
   - `TimelineEditorSheet` manages trip schedule events: milestone CRUD, multi-leg chapter CRUD, dynamic leg rows, date validation, and leg deletion.
   - Separating them into `js/ui-status-sheet.js` and `js/ui-editor-sheet.js` isolates distinct UI lifecycles and reduces `js/app.js` by over 750 lines.

2. **Decoupling State Mutation from Persistence**:
   - Neither bottom sheet controller should directly own GitHub sync (`saveLiveState`), volatile crypto keys (`#vaultCryptoKey`), or GitHub access tokens (`#githubToken`).
   - Instead, both controllers accept domain-specific callback hooks:
     - `StatusEditSheet`: `onSaveStatus(override)`, `onClearStatus(data)`, `onLockDevice()`
     - `TimelineEditorSheet`: `onSave({ mode, id, data })`, `onDelete({ id, isChapter })`
   - The coordinator (`app.js`) handles state mutation in `liveState`, triggers `tick(true)`, delegates remote syncing, and calls `updateSyncBadge(...)`.

3. **Helper Placement (`populateCountrySelect`)**:
   - `populateCountrySelect` is utilized by `StatusEditSheet` (`#edit-current-country`) and `TimelineEditorSheet` (`#tl-country-select` and dynamic `.leg-country-select`).
   - Exporting `populateCountrySelect` from `js/ui-status-sheet.js` satisfies the prompt specification and allows `TimelineEditorSheet` to cleanly import it without circular dependencies.

4. **DOM Caching and Batching Invariant**:
   - Querying DOM elements repeatedly inside handlers or render loops degrades responsiveness on mobile devices.
   - Static DOM elements are queried exactly once inside class constructors. Dynamic elements (such as `.chapter-leg-editor-card`) are created via `document.createElement`, wired with localized event listeners, and appended in batch.

5. **Bidirectional Editing & Numeric Lock Compliance**:
   - User-editable text fields (`edit-current-note`, `tl-title-input`, `tl-details-input`, `tl-chapter-title-input`, `tl-chapter-desc-input`, `.leg-label-input`) set `dir="auto"` so Hebrew and English render with natural alignment.
   - Date inputs (`tl-date-input`, `.leg-start-input`, `.leg-end-input`) apply `.numeric-lock` and `dir="ltr"` with `unicode-bidi: isolate` to avoid RTL numeral inversion.

6. **Memory & Lifecycle Hygiene**:
   - Modern browser ES2022 provides `AbortController` with `signal` option for `addEventListener`.
   - Both classes instantiate an internal `AbortController` (`#abortController`) passed to all element listeners. Calling `destroy()` triggers `abort()`, unbinds sheet drag gestures via `this.#unbindGestures?.()`, resets transforms, and nullifies references.

---

## 3. Caveats

1. **`js/ui-gestures.js` Dependency**:
   - Both sheets depend on `import { bindSheetDragGestures } from './ui-gestures.js'`.
   - `explorer_m4_1` is currently defining `js/ui-gestures.js`. The sheet controllers expect `bindSheetDragGestures(sheetEl, dragTargetEl, onClose)` returning an unbind function `() => void`.

2. **Coordination with `TimelineRenderer`**:
   - Leg card editing in `timeline-renderer.js` passes `(reunion, legIndex)` to `onEditLeg`. `TimelineEditorSheet.open(item, focusLegIndex)` must remain backwards-compatible with this signature.

3. **Read-Only Scope**:
   - No source files have been modified during this exploration. The full implementations are detailed below for subsequent implementation.

---

## 4. Conclusion & Proposed Specification

### 4.1 Specification: `js/ui-status-sheet.js`

```javascript
import {
  ALL_ISO_3166_CODES,
  PINNED_COUNTRY_CODES,
  getCountryInfo
} from './config.js';
import { bindSheetDragGestures } from './ui-gestures.js';

/**
 * Populates a <select> element with Pinned Destinations at the top
 * and all 249 ISO countries alphabetically below.
 * @param {HTMLSelectElement | null} selectEl
 * @param {string} [selectedCode]
 * @param {string[]} [pinnedCodes]
 */
export function populateCountrySelect(selectEl, selectedCode = 'US', pinnedCodes = PINNED_COUNTRY_CODES) {
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

export class StatusEditSheet {
  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {{ primaryName: string, secondaryName: string, firstPartnerKey: string, secondPartnerKey: string } | null} */
  #partnerNames = null;

  /** @type {'primary' | 'secondary'} */
  #activeProfile = 'primary';

  /** @type {import('./config.js').BoardState | null} */
  #latestBoardState = null;

  /** @type {(() => void) | null} */
  #unbindGestures = null;

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {((override: { partnerKey: string, countryCode: string, cityNote: string, profile: 'primary' | 'secondary' }) => Promise<void> | void) | null} */
  #onSaveStatus = null;

  /** @type {((data: { partnerKey: string, profile: 'primary' | 'secondary' }) => Promise<void> | void) | null} */
  #onClearStatus = null;

  /** @type {(() => void) | null} */
  #onLockDevice = null;

  /** @type {Record<string, HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLFormElement | null>} */
  #dom = {};

  /**
   * @param {Object} [options]
   * @param {(override: { partnerKey: string, countryCode: string, cityNote: string, profile: 'primary' | 'secondary' }) => Promise<void> | void} [options.onSaveStatus]
   * @param {(data: { partnerKey: string, profile: 'primary' | 'secondary' }) => Promise<void> | void} [options.onClearStatus]
   * @param {() => void} [options.onLockDevice]
   */
  constructor({ onSaveStatus, onClearStatus, onLockDevice } = {}) {
    this.#onSaveStatus = onSaveStatus ?? null;
    this.#onClearStatus = onClearStatus ?? null;
    this.#onLockDevice = onLockDevice ?? null;

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
      lockDeviceBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('lock-device-btn'))
    };

    this.#bindListeners();
  }

  #bindListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#dom.closeBtn?.addEventListener('click', () => this.close(), { signal });
    this.#dom.sheetBackdrop?.addEventListener('click', () => this.close(), { signal });

    this.#dom.segBtnPrimary?.addEventListener('click', () => {
      this.setActiveProfile('primary');
    }, { signal });

    this.#dom.segBtnSecondary?.addEventListener('click', () => {
      this.setActiveProfile('secondary');
    }, { signal });

    this.#dom.form?.addEventListener('submit', (e) => this.#handleFormSubmit(e), { signal });
    this.#dom.clearStatusOverridesBtn?.addEventListener('click', () => this.#handleClearStatus(), { signal });
    this.#dom.lockDeviceBtn?.addEventListener('click', () => this.#handleLockDevice(), { signal });
  }

  async #handleFormSubmit(event) {
    event.preventDefault();
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
    if (this.#onLockDevice) {
      this.#onLockDevice();
    }
  }

  /**
   * @param {import('./config.js').TripConfig} tripConfig
   * @param {{ primaryName: string, secondaryName: string, firstPartnerKey: string, secondPartnerKey: string }} partnerNames
   */
  mount(tripConfig, partnerNames) {
    this.#tripConfig = tripConfig;
    this.#partnerNames = partnerNames;

    if (this.#dom.bottomSheet) this.#dom.bottomSheet.hidden = false;
    if (this.#dom.segBtnPrimary) this.#dom.segBtnPrimary.textContent = partnerNames.primaryName;
    if (this.#dom.segBtnSecondary) this.#dom.segBtnSecondary.textContent = partnerNames.secondaryName;

    try {
      const savedProfile = localStorage?.getItem('trip_preferred_profile');
      if (savedProfile === 'secondary' || savedProfile === 'primary') {
        this.#activeProfile = savedProfile;
      }
    } catch {
      // Storage access may be restricted
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
   * @param {import('./config.js').BoardState | null} [boardState]
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
   * @param {import('./config.js').BoardState} boardState
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
   * @param {'primary' | 'secondary'} profile
   * @param {import('./config.js').BoardState | null} [boardState]
   */
  setActiveProfile(profile, boardState = this.#latestBoardState) {
    if (profile !== 'primary' && profile !== 'secondary') return;
    this.#activeProfile = profile;
    try {
      localStorage?.setItem('trip_preferred_profile', profile);
    } catch {
      // Storage access may be restricted
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
   * @param {string} stateKey
   * @param {string} text
   */
  updateSyncBadge(stateKey, text) {
    if (!this.#dom.syncStatusPill) return;
    this.#dom.syncStatusPill.dataset.syncState = stateKey;
    this.#dom.syncStatusPill.textContent = text;
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
```

---

### 4.2 Specification: `js/ui-editor-sheet.js`

```javascript
import { PINNED_COUNTRY_CODES, getCountryInfo } from './config.js';
import { resolvePartnerConfigMeta } from './countdown-engine.js';
import { isReunionChapter } from './timeline-renderer.js';
import { bindSheetDragGestures } from './ui-gestures.js';
import { populateCountrySelect } from './ui-status-sheet.js';

/**
 * Adds whole calendar days to a "YYYY-MM-DD" date string using UTC arithmetic.
 * @param {string} dateStr
 * @param {number} daysToAdd
 * @returns {string}
 */
function addCalendarDays(dateStr, daysToAdd) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export class TimelineEditorSheet {
  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {'milestone' | 'chapter'} */
  #editorMode = 'milestone';

  /** @type {(() => void) | null} */
  #unbindGestures = null;

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {((payload: { mode: 'milestone' | 'chapter', id: string, data: any }) => Promise<void> | void) | null} */
  #onSave = null;

  /** @type {((payload: { id: string, isChapter: boolean }) => Promise<void> | void) | null} */
  #onDelete = null;

  /** @type {Record<string, HTMLElement | HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLFormElement | null>} */
  #dom = {};

  /**
   * @param {Object} [options]
   * @param {(payload: { mode: 'milestone' | 'chapter', id: string, data: any }) => Promise<void> | void} [options.onSave]
   * @param {(payload: { id: string, isChapter: boolean }) => Promise<void> | void} [options.onDelete]
   */
  constructor({ onSave, onDelete } = {}) {
    this.#onSave = onSave ?? null;
    this.#onDelete = onDelete ?? null;

    this.#dom = {
      backdrop: document.getElementById('timeline-sheet-backdrop'),
      sheet: document.getElementById('timeline-item-sheet'),
      handleWrapper: document.getElementById('timeline-sheet-handle-wrapper'),
      header: document.getElementById('timeline-sheet-header'),
      sheetTitle: document.getElementById('timeline-sheet-title'),
      closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-sheet-close-btn')),
      form: /** @type {HTMLFormElement | null} */ (document.getElementById('timeline-item-form')),
      typeToggleGroup: document.getElementById('timeline-type-toggle-group'),
      typeMilestoneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-type-milestone-btn')),
      typeChapterBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('timeline-type-chapter-btn')),
      itemIdInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-item-id-input')),
      milestoneFields: document.getElementById('timeline-milestone-fields'),
      titleInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-title-input')),
      dateInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-date-input')),
      personSelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('tl-person-select')),
      countrySelect: /** @type {HTMLSelectElement | null} */ (document.getElementById('tl-country-select')),
      detailsInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-details-input')),
      chapterFields: document.getElementById('timeline-chapter-fields'),
      chapterTitleInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-title-input')),
      chapterEmojiInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-emoji-input')),
      chapterLegsList: document.getElementById('tl-chapter-legs-list'),
      addLegBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-add-leg-btn')),
      chapterDescInput: /** @type {HTMLInputElement | null} */ (document.getElementById('tl-chapter-desc-input')),
      saveBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-save-btn')),
      deleteBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-delete-btn'))
    };

    this.#bindListeners();
  }

  #bindListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#dom.closeBtn?.addEventListener('click', () => this.close(), { signal });
    this.#dom.backdrop?.addEventListener('click', () => this.close(), { signal });

    this.#dom.typeMilestoneBtn?.addEventListener('click', () => {
      this.setMode('milestone');
    }, { signal });

    this.#dom.typeChapterBtn?.addEventListener('click', () => {
      this.setMode('chapter');
    }, { signal });

    this.#dom.addLegBtn?.addEventListener('click', () => {
      this.appendChapterLegRow();
    }, { signal });

    this.#dom.form?.addEventListener('submit', (e) => this.#handleFormSubmit(e), { signal });
    this.#dom.deleteBtn?.addEventListener('click', () => this.#handleDelete(), { signal });
  }

  async #handleFormSubmit(event) {
    event.preventDefault();
    if (!this.#tripConfig) return;

    const id = (this.#dom.itemIdInput?.value || '').trim();

    if (this.#editorMode === 'chapter') {
      const rawTitle = (this.#dom.chapterTitleInput?.value || '').trim();
      const emoji = (this.#dom.chapterEmojiInput?.value || '').trim() || '✈️';
      const description = (this.#dom.chapterDescInput?.value || '').trim();
      const collectedLegs = this.collectChapterLegsFromDom()
        .filter((leg) => leg.startDate && leg.endDate)
        .map((leg) => ({
          ...leg,
          endDate: leg.endDate < leg.startDate ? leg.startDate : leg.endDate
        }));

      if (collectedLegs.length === 0) return;

      const startDate = collectedLegs[0].startDate;
      const endDate = collectedLegs[collectedLegs.length - 1].endDate;
      const firstCountry = getCountryInfo(collectedLegs[0].countryCode);
      const defaultTitle = collectedLegs.length > 1
        ? `Together Across ${collectedLegs.length} Countries`
        : `${collectedLegs[0].label || firstCountry.name} Reunion`;
      const title = rawTitle || defaultTitle;

      this.close();

      if (this.#onSave) {
        await this.#onSave({
          mode: 'chapter',
          id,
          data: {
            title,
            emoji,
            startDate,
            endDate,
            description,
            legs: collectedLegs
          }
        });
      }
    } else {
      const title = (this.#dom.titleInput?.value || '').trim();
      const date = this.#dom.dateInput?.value || '';
      const person = this.#dom.personSelect?.value || 'both';
      const countryCode = this.#dom.countrySelect?.value || this.#tripConfig.homeCountryCode || 'US';
      const details = (this.#dom.detailsInput?.value || '').trim();

      if (!title || !date) return;

      this.close();

      if (this.#onSave) {
        await this.#onSave({
          mode: 'milestone',
          id,
          data: {
            title,
            date,
            person,
            countryCode,
            details
          }
        });
      }
    }
  }

  async #handleDelete() {
    const id = (this.#dom.itemIdInput?.value || '').trim();
    if (!id || !this.#tripConfig) return;

    const isChapter = this.#editorMode === 'chapter';
    this.close();

    if (this.#onDelete) {
      await this.#onDelete({ id, isChapter });
    }
  }

  /**
   * @param {import('./config.js').TripConfig} tripConfig
   */
  mount(tripConfig) {
    this.#tripConfig = tripConfig;

    if (this.#dom.sheet) this.#dom.sheet.hidden = false;

    const { firstPartnerKey, secondPartnerKey } = resolvePartnerConfigMeta(tripConfig);
    const primaryName = tripConfig.coupleNames?.[firstPartnerKey] || firstPartnerKey;
    const secondaryName = tripConfig.coupleNames?.[secondPartnerKey] || secondPartnerKey;

    if (this.#dom.personSelect) {
      this.#dom.personSelect.innerHTML = '';
      const bothOpt = document.createElement('option');
      bothOpt.value = 'both';
      bothOpt.textContent = '💕 Together';
      const primaryOpt = document.createElement('option');
      primaryOpt.value = firstPartnerKey;
      primaryOpt.textContent = `🌸 ${primaryName}`;
      const secondaryOpt = document.createElement('option');
      secondaryOpt.value = secondPartnerKey;
      secondaryOpt.textContent = `🌊 ${secondaryName}`;
      this.#dom.personSelect.append(bothOpt, primaryOpt, secondaryOpt);
    }

    const pinnedCodes = this.#getPinnedCountryCodes();
    const homeCode = tripConfig.homeCountryCode || 'US';
    populateCountrySelect(this.#dom.countrySelect, pinnedCodes[2] || homeCode, pinnedCodes);

    this.#unbindGestures?.();
    this.#unbindGestures = bindSheetDragGestures(
      this.#dom.sheet,
      this.#dom.handleWrapper || this.#dom.header,
      () => this.close()
    );
  }

  /**
   * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null} [item]
   * @param {number | null} [focusLegIndex]
   */
  open(item = null, focusLegIndex = null) {
    if (!this.#tripConfig) return;
    if (this.#dom.sheet) this.#dom.sheet.hidden = false;

    const todayStr = new Date().toISOString().slice(0, 10);
    const pinnedCodes = this.#getPinnedCountryCodes();
    const homeCode = this.#tripConfig.homeCountryCode || 'US';

    if (item === null) {
      if (this.#dom.sheetTitle) this.#dom.sheetTitle.textContent = 'Add Timeline Entry';
      if (this.#dom.typeToggleGroup) this.#dom.typeToggleGroup.style.display = 'flex';
      if (this.#dom.itemIdInput) this.#dom.itemIdInput.value = '';

      if (this.#dom.titleInput) this.#dom.titleInput.value = '';
      if (this.#dom.dateInput) this.#dom.dateInput.value = todayStr;
      if (this.#dom.personSelect) this.#dom.personSelect.value = 'both';
      if (this.#dom.countrySelect) this.#dom.countrySelect.value = homeCode;
      if (this.#dom.detailsInput) this.#dom.detailsInput.value = '';

      if (this.#dom.chapterTitleInput) this.#dom.chapterTitleInput.value = '';
      if (this.#dom.chapterEmojiInput) this.#dom.chapterEmojiInput.value = '✈️';
      if (this.#dom.chapterDescInput) this.#dom.chapterDescInput.value = '';

      this.renderChapterLegRows([
        {
          id: `leg-${Date.now()}-1`,
          countryCode: pinnedCodes[0] || homeCode,
          startDate: todayStr,
          endDate: addCalendarDays(todayStr, 7)
        }
      ]);

      if (this.#dom.deleteBtn) {
        this.#dom.deleteBtn.hidden = true;
        this.#dom.deleteBtn.style.display = 'none';
      }
      this.setMode('milestone');
    } else if (isReunionChapter(item)) {
      if (this.#dom.sheetTitle) this.#dom.sheetTitle.textContent = 'Edit Chapter & Countries';
      if (this.#dom.typeToggleGroup) this.#dom.typeToggleGroup.style.display = 'none';
      if (this.#dom.itemIdInput) this.#dom.itemIdInput.value = item.id;

      if (this.#dom.chapterTitleInput) this.#dom.chapterTitleInput.value = item.title || '';
      if (this.#dom.chapterEmojiInput) this.#dom.chapterEmojiInput.value = item.emoji || '✈️';
      if (this.#dom.chapterDescInput) this.#dom.chapterDescInput.value = item.description || '';

      if (this.#dom.deleteBtn) {
        this.#dom.deleteBtn.hidden = false;
        this.#dom.deleteBtn.style.display = 'block';
      }
      this.setMode('chapter');
      this.renderChapterLegRows(item.legs || [], focusLegIndex);
    } else {
      if (this.#dom.sheetTitle) this.#dom.sheetTitle.textContent = 'Edit Milestone';
      if (this.#dom.typeToggleGroup) this.#dom.typeToggleGroup.style.display = 'none';
      if (this.#dom.itemIdInput) this.#dom.itemIdInput.value = item.id;

      if (this.#dom.titleInput) this.#dom.titleInput.value = item.title || '';
      if (this.#dom.dateInput) this.#dom.dateInput.value = item.date || '';
      if (this.#dom.personSelect) this.#dom.personSelect.value = item.person || 'both';
      if (this.#dom.countrySelect) this.#dom.countrySelect.value = item.countryCode || homeCode;
      if (this.#dom.detailsInput) this.#dom.detailsInput.value = item.details || '';

      if (this.#dom.deleteBtn) {
        this.#dom.deleteBtn.hidden = false;
        this.#dom.deleteBtn.style.display = 'block';
      }
      this.setMode('milestone');
    }

    this.#dom.backdrop?.classList.add('is-open');
    this.#dom.sheet?.classList.add('is-open');
  }

  close() {
    this.#dom.backdrop?.classList.remove('is-open');
    this.#dom.sheet?.classList.remove('is-open');
    if (this.#dom.sheet) {
      this.#dom.sheet.style.transform = '';
      this.#dom.sheet.style.transition = '';
    }
  }

  isOpen() {
    return Boolean(this.#dom.sheet?.classList.contains('is-open'));
  }

  /**
   * @param {'milestone' | 'chapter'} mode
   */
  setMode(mode) {
    this.#editorMode = mode;
    const isMilestone = mode === 'milestone';
    this.#dom.typeMilestoneBtn?.classList.toggle('is-active', isMilestone);
    this.#dom.typeChapterBtn?.classList.toggle('is-active', !isMilestone);
    if (this.#dom.titleInput) this.#dom.titleInput.required = isMilestone;
    if (this.#dom.dateInput) this.#dom.dateInput.required = isMilestone;
    if (this.#dom.milestoneFields) {
      this.#dom.milestoneFields.hidden = !isMilestone;
      this.#dom.milestoneFields.style.display = isMilestone ? 'flex' : 'none';
    }
    if (this.#dom.chapterFields) {
      this.#dom.chapterFields.hidden = isMilestone;
      this.#dom.chapterFields.style.display = isMilestone ? 'none' : 'flex';
    }
  }

  #getPinnedCountryCodes() {
    return Array.isArray(this.#tripConfig?.pinnedCountryCodes) &&
      this.#tripConfig.pinnedCountryCodes.length > 0
      ? this.#tripConfig.pinnedCountryCodes
      : PINNED_COUNTRY_CODES;
  }

  #syncAutoChapterTitleWithLegCount(legCount) {
    if (!this.#dom.chapterTitleInput) return;
    const currentTitle = this.#dom.chapterTitleInput.value.trim();
    if (/^Together Across \d+ Countr(?:y|ies)$/i.test(currentTitle)) {
      this.#dom.chapterTitleInput.value = legCount === 1
        ? 'Together Across 1 Country'
        : `Together Across ${legCount} Countries`;
    }
  }

  /**
   * @returns {import('./config.js').ReunionLeg[]}
   */
  collectChapterLegsFromDom() {
    if (!this.#dom.chapterLegsList) return [];
    const homeCode = this.#tripConfig?.homeCountryCode || 'US';
    const cards = Array.from(this.#dom.chapterLegsList.querySelectorAll('.chapter-leg-editor-card'));
    return cards.map((card, index) => {
      const el = /** @type {HTMLElement} */ (card);
      const legId = el.dataset.legId || `leg-${Date.now()}-${index + 1}`;
      const selectEl = /** @type {HTMLSelectElement | null} */ (el.querySelector('.leg-country-select'));
      const labelInput = /** @type {HTMLInputElement | null} */ (el.querySelector('.leg-label-input'));
      const startInput = /** @type {HTMLInputElement | null} */ (el.querySelector('.leg-start-input'));
      const endInput = /** @type {HTMLInputElement | null} */ (el.querySelector('.leg-end-input'));
      const notesInput = /** @type {HTMLInputElement | null} */ (el.querySelector('.leg-notes-input'));

      const countryCode = selectEl?.value || homeCode;
      const label = (labelInput?.value || '').trim();
      const startDate = startInput?.value || '';
      const endDate = endInput?.value || startDate;
      const notes = (notesInput?.value || '').trim();

      /** @type {import('./config.js').ReunionLeg} */
      const leg = {
        id: legId,
        countryCode,
        startDate,
        endDate
      };
      if (label) leg.label = label;
      if (notes) leg.notes = notes;
      return leg;
    });
  }

  /**
   * @param {import('./config.js').ReunionLeg[]} legs
   * @param {number | null} [focusLegIndex]
   */
  renderChapterLegRows(legs, focusLegIndex = null) {
    if (!this.#dom.chapterLegsList || !this.#tripConfig) return;
    this.#dom.chapterLegsList.innerHTML = '';

    const pinnedCodes = this.#getPinnedCountryCodes();
    const homeCode = this.#tripConfig.homeCountryCode || 'US';
    const safeLegs = Array.isArray(legs) && legs.length > 0
      ? legs
      : [
          {
            id: `leg-${Date.now()}-1`,
            countryCode: pinnedCodes[0] || homeCode,
            startDate: new Date().toISOString().slice(0, 10),
            endDate: addCalendarDays(new Date().toISOString().slice(0, 10), 7)
          }
        ];

    safeLegs.forEach((leg, idx) => {
      const card = document.createElement('div');
      card.className = `chapter-leg-editor-card${focusLegIndex === idx ? ' is-focused' : ''}`;
      card.dataset.legId = leg.id || `leg-${Date.now()}-${idx + 1}`;
      card.dataset.legIndex = String(idx);

      const header = document.createElement('div');
      header.className = 'chapter-leg-editor-header';

      const badge = document.createElement('span');
      badge.className = 'chapter-leg-number-badge';
      badge.textContent = `Country #${idx + 1}`;
      header.appendChild(badge);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chapter-leg-remove-btn';
      removeBtn.textContent = 'Remove ✕';
      removeBtn.disabled = safeLegs.length <= 1;
      removeBtn.title = safeLegs.length <= 1
        ? 'A chapter requires at least one country'
        : `Remove Country #${idx + 1}`;
      removeBtn.setAttribute('aria-label', `Remove Country #${idx + 1}`);
      removeBtn.addEventListener('click', () => {
        const currentLegs = this.collectChapterLegsFromDom();
        if (currentLegs.length <= 1) return;
        currentLegs.splice(idx, 1);
        this.#syncAutoChapterTitleWithLegCount(currentLegs.length);
        this.renderChapterLegRows(currentLegs);
      });
      header.appendChild(removeBtn);
      card.appendChild(header);

      const topGrid = document.createElement('div');
      topGrid.className = 'status-edit-grid';

      const countryGroup = document.createElement('div');
      countryGroup.className = 'form-group';
      const countryLabel = document.createElement('label');
      countryLabel.className = 'form-label';
      countryLabel.textContent = 'Country (Flag & Timezone)';
      const countrySelect = document.createElement('select');
      countrySelect.className = 'form-select leg-country-select';
      const selectedCode = leg.countryCode || pinnedCodes[0] || homeCode;
      populateCountrySelect(countrySelect, selectedCode, pinnedCodes);
      countryGroup.append(countryLabel, countrySelect);

      const nameGroup = document.createElement('div');
      nameGroup.className = 'form-group';
      const nameLabel = document.createElement('label');
      nameLabel.className = 'form-label';
      nameLabel.textContent = 'Display Name (Optional)';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'form-input leg-label-input';
      nameInput.setAttribute('dir', 'auto');
      nameInput.maxLength = 60;
      nameInput.placeholder = getCountryInfo(selectedCode).name;
      nameInput.value = leg.label || '';

      countrySelect.addEventListener('change', () => {
        nameInput.placeholder = getCountryInfo(countrySelect.value).name;
      });

      nameGroup.append(nameLabel, nameInput);
      topGrid.append(countryGroup, nameGroup);
      card.appendChild(topGrid);

      const datesGrid = document.createElement('div');
      datesGrid.className = 'status-edit-grid';

      const startGroup = document.createElement('div');
      startGroup.className = 'form-group';
      const startLabel = document.createElement('label');
      startLabel.className = 'form-label';
      startLabel.textContent = 'Start Date';
      const startInput = document.createElement('input');
      startInput.type = 'date';
      startInput.className = 'form-input numeric-lock leg-start-input';
      startInput.setAttribute('dir', 'ltr');
      startInput.value = leg.startDate || '';
      startGroup.append(startLabel, startInput);

      const endGroup = document.createElement('div');
      endGroup.className = 'form-group';
      const endLabel = document.createElement('label');
      endLabel.className = 'form-label';
      endLabel.textContent = 'End Date';
      const endInput = document.createElement('input');
      endInput.type = 'date';
      endInput.className = 'form-input numeric-lock leg-end-input';
      endInput.setAttribute('dir', 'ltr');
      endInput.value = leg.endDate || '';
      endGroup.append(endLabel, endInput);

      datesGrid.append(startGroup, endGroup);
      card.appendChild(datesGrid);

      const notesInput = document.createElement('input');
      notesInput.type = 'hidden';
      notesInput.className = 'leg-notes-input';
      notesInput.value = leg.notes || '';
      card.appendChild(notesInput);

      this.#dom.chapterLegsList?.appendChild(card);
    });

    if (focusLegIndex !== null && focusLegIndex >= 0) {
      const targetCard = this.#dom.chapterLegsList.querySelector(
        `.chapter-leg-editor-card[data-leg-index="${focusLegIndex}"]`
      );
      if (targetCard instanceof HTMLElement) {
        requestAnimationFrame(() => {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const labelInput = targetCard.querySelector('.leg-label-input');
          if (labelInput instanceof HTMLInputElement) {
            labelInput.focus({ preventScroll: true });
          }
        });
      }
    }
  }

  appendChapterLegRow() {
    if (!this.#tripConfig) return;
    const currentLegs = this.collectChapterLegsFromDom();
    const pinnedCodes = this.#getPinnedCountryCodes();
    const homeCode = this.#tripConfig.homeCountryCode || 'US';

    const lastLeg = currentLegs[currentLegs.length - 1] ?? null;
    const nextStartDate = lastLeg?.endDate || new Date().toISOString().slice(0, 10);
    const nextEndDate = addCalendarDays(nextStartDate, 7);

    const usedCodes = new Set(currentLegs.map((l) => l.countryCode));
    const suggestedCode =
      pinnedCodes.find((c) => !usedCodes.has(c) && c !== homeCode) ||
      pinnedCodes[0] ||
      homeCode;

    currentLegs.push({
      id: `leg-${Date.now()}-${currentLegs.length + 1}`,
      countryCode: suggestedCode,
      startDate: nextStartDate,
      endDate: nextEndDate
    });

    this.#syncAutoChapterTitleWithLegCount(currentLegs.length);
    this.renderChapterLegRows(currentLegs, currentLegs.length - 1);
  }

  destroy() {
    this.close();
    this.#unbindGestures?.();
    this.#unbindGestures = null;
    this.#abortController?.abort();
    this.#abortController = null;
    this.#tripConfig = null;
  }
}
```

---

## 5. Verification Method

1. **Unit & Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   Ensures all 25 tests pass with zero regressions.

2. **Integration Verification of HTML Bindings**:
   - Verify all DOM IDs checked in `tests/integration.test.mjs` lines 529–563 remain intact:
     - `#fab-edit-btn`, `#edit-bottom-sheet`, `#edit-sheet-backdrop`
     - `#timeline-item-sheet`, `#timeline-sheet-backdrop`, `#timeline-type-toggle-group`
     - `#timeline-type-milestone-btn`, `#timeline-type-chapter-btn`, `#tl-item-id-input`
     - `#timeline-milestone-fields`, `#timeline-chapter-fields`, `#tl-save-btn`, `#tl-delete-btn`

3. **Zero-Knowledge Security Invariant**:
   - `tests/integration.test.mjs` security scan verifies zero personal names, dates, or secrets are hardcoded in `js/ui-status-sheet.js` or `js/ui-editor-sheet.js`.

4. **Interactive Browser Verification**:
   ```bash
   npx serve -l 8080 .
   ```
   - Tap FAB edit button: status sheet opens, reflects active profile and current country/city note.
   - Switch profile: UI updates active indicator, form values immediately update to partner's status.
   - Change city note and tap Save: sync badge updates to "Saving…", then "synced".
   - Open Timeline Item Editor via "+ Add Event": modal opens with empty title, today's date, milestone mode active.
   - Switch to "Trip Leg / Chapter": milestone inputs hide, chapter inputs appear with 1 default leg.
   - Tap "+ Add Country": new leg row is appended, end date defaults to +7 days, title syncs to "Together Across 2 Countries".
   - Swipe down on sheet handle: sheet smoothly translates downwards and snaps closed when dragged > 80px.
