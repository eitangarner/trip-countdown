/**
 * Trip Countdown & Timeline Board
 * TimelineEditorSheet: Milestone & Multi-Leg Reunion Chapter Editor Bottom Sheet Controller
 */

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
  const calendarDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const yearStr = String(calendarDate.getUTCFullYear()).padStart(4, '0');
  const monthStr = String(calendarDate.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(calendarDate.getUTCDate()).padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Immutably applies a milestone or chapter save to the LiveState payload.
 * @param {import('./config.js').LiveStatePayload} liveState
 * @param {{ mode: 'milestone' | 'chapter', id: string, data: any }} payload
 * @returns {import('./config.js').LiveStatePayload}
 */
export function applyTimelineSaveToLiveState(liveState, { mode, id, data }) {
  if (mode === 'chapter') {
    const { title, emoji, startDate, endDate, description, legs } = data;
    if (!id) {
      const newId = `custom-ch-${Date.now()}`;
      const newChapter = {
        id: newId,
        title,
        emoji,
        startDate,
        endDate,
        description,
        legs: legs.map((leg, legIndex) => ({
          ...leg,
          id: leg.id || `${newId}-leg-${legIndex + 1}`
        }))
      };
      return {
        ...liveState,
        customReunions: [...(liveState.customReunions || []), newChapter]
      };
    }
    const customIndex = (liveState.customReunions || []).findIndex((reunion) => reunion.id === id);
    if (customIndex >= 0) {
      const updatedReunions = [...liveState.customReunions];
      updatedReunions[customIndex] = {
        ...updatedReunions[customIndex],
        title,
        emoji,
        startDate,
        endDate,
        description,
        legs
      };
      return { ...liveState, customReunions: updatedReunions };
    }
    return {
      ...liveState,
      chapterOverrides: {
        ...(liveState.chapterOverrides || {}),
        [id]: {
          title,
          emoji,
          startDate,
          endDate,
          legs,
          description,
          hidden: false
        }
      }
    };
  }

  const { title, date, person, countryCode, details } = data;
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
    return {
      ...liveState,
      customMilestones: [...(liveState.customMilestones || []), newMilestone]
    };
  }
  const customIndex = (liveState.customMilestones || []).findIndex((milestone) => milestone.id === id);
  if (customIndex >= 0) {
    const updatedMilestones = [...liveState.customMilestones];
    updatedMilestones[customIndex] = {
      ...updatedMilestones[customIndex],
      title,
      date,
      person,
      countryCode,
      details
    };
    return { ...liveState, customMilestones: updatedMilestones };
  }
  return {
    ...liveState,
    milestoneOverrides: {
      ...(liveState.milestoneOverrides || {}),
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

/**
 * Immutably removes a milestone or chapter from LiveState (or marks it hidden).
 * @param {import('./config.js').LiveStatePayload} liveState
 * @param {{ id: string, isChapter: boolean }} payload
 * @returns {import('./config.js').LiveStatePayload}
 */
export function applyTimelineDeleteToLiveState(liveState, { id, isChapter }) {
  if (isChapter) {
    const customIndex = (liveState.customReunions || []).findIndex((reunion) => reunion.id === id);
    if (customIndex >= 0) {
      const updatedReunions = [...liveState.customReunions];
      updatedReunions.splice(customIndex, 1);
      return { ...liveState, customReunions: updatedReunions };
    }
    return {
      ...liveState,
      chapterOverrides: {
        ...(liveState.chapterOverrides || {}),
        [id]: {
          ...(liveState.chapterOverrides?.[id] || {}),
          hidden: true
        }
      }
    };
  }

  const customIndex = (liveState.customMilestones || []).findIndex((milestone) => milestone.id === id);
  if (customIndex >= 0) {
    const updatedMilestones = [...liveState.customMilestones];
    updatedMilestones.splice(customIndex, 1);
    return { ...liveState, customMilestones: updatedMilestones };
  }
  return {
    ...liveState,
    milestoneOverrides: {
      ...(liveState.milestoneOverrides || {}),
      [id]: {
        ...(liveState.milestoneOverrides?.[id] || {}),
        hidden: true
      }
    }
  };
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
   * @param {object} [options]
   * @param {(payload: { mode: 'milestone' | 'chapter', id: string, data: any }) => Promise<void> | void} [options.onSave]
   * @param {(payload: { id: string, isChapter: boolean }) => Promise<void> | void} [options.onDelete]
   */
  constructor(options = {}) {
    this.#onSave = options.onSave || null;
    this.#onDelete = options.onDelete || null;

    this.#cacheDomElements();
    this.#bindListeners();
  }

  #cacheDomElements() {
    if (typeof document === 'undefined') return;
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
      deleteBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('tl-delete-btn')),
      addTimelineItemBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('add-timeline-item-btn'))
    };
  }

  #bindListeners() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    this.#dom.addTimelineItemBtn?.addEventListener('click', () => {
      this.open(null);
    }, { signal });

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

    this.#dom.form?.addEventListener('submit', (submitEvent) => {
      void this.#handleFormSubmit(submitEvent);
    }, { signal });

    this.#dom.deleteBtn?.addEventListener('click', () => {
      void this.#handleDelete();
    }, { signal });
  }

  async #handleFormSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (!this.#tripConfig) return;

    const itemId = (this.#dom.itemIdInput?.value || '').trim();

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
          id: itemId,
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
          id: itemId,
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
    const itemId = (this.#dom.itemIdInput?.value || '').trim();
    if (!itemId || !this.#tripConfig) return;

    const isChapter = this.#editorMode === 'chapter';
    this.close();

    if (this.#onDelete) {
      await this.#onDelete({ id: itemId, isChapter });
    }
  }

  /**
   * Directly triggers deletion for a timeline entry from an external trigger.
   * @param {{ id: string, isChapter?: boolean } | any} timelineEntry
   */
  async deleteItem(timelineEntry) {
    if (!timelineEntry?.id) return;
    const itemId = timelineEntry.id;
    const isChapter = isReunionChapter(timelineEntry) || Boolean(timelineEntry.isChapter);
    this.close();

    if (this.#onDelete) {
      await this.#onDelete({ id: itemId, isChapter });
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
      const bothOption = document.createElement('option');
      bothOption.value = 'both';
      bothOption.textContent = '💕 Together';
      const primaryOption = document.createElement('option');
      primaryOption.value = firstPartnerKey;
      primaryOption.textContent = `🌸 ${primaryName}`;
      const secondaryOption = document.createElement('option');
      secondaryOption.value = secondPartnerKey;
      secondaryOption.textContent = `🌊 ${secondaryName}`;
      this.#dom.personSelect.append(bothOption, primaryOption, secondaryOption);
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
   * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null} [timelineEntry]
   * @param {number | null} [focusLegIndex]
   */
  open(timelineEntry = null, focusLegIndex = null) {
    if (!this.#tripConfig) return;
    if (this.#dom.sheet) this.#dom.sheet.hidden = false;

    const todayStr = new Date().toISOString().slice(0, 10);
    const pinnedCodes = this.#getPinnedCountryCodes();
    const homeCode = this.#tripConfig.homeCountryCode || 'US';

    if (timelineEntry === null) {
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
    } else if (isReunionChapter(timelineEntry)) {
      if (this.#dom.sheetTitle) this.#dom.sheetTitle.textContent = 'Edit Chapter & Countries';
      if (this.#dom.typeToggleGroup) this.#dom.typeToggleGroup.style.display = 'none';
      if (this.#dom.itemIdInput) this.#dom.itemIdInput.value = timelineEntry.id;

      if (this.#dom.chapterTitleInput) this.#dom.chapterTitleInput.value = timelineEntry.title || '';
      if (this.#dom.chapterEmojiInput) this.#dom.chapterEmojiInput.value = timelineEntry.emoji || '✈️';
      if (this.#dom.chapterDescInput) this.#dom.chapterDescInput.value = timelineEntry.description || '';

      if (this.#dom.deleteBtn) {
        this.#dom.deleteBtn.hidden = false;
        this.#dom.deleteBtn.style.display = 'block';
      }
      this.setMode('chapter');
      this.renderChapterLegRows(timelineEntry.legs || [], focusLegIndex);
    } else {
      if (this.#dom.sheetTitle) this.#dom.sheetTitle.textContent = 'Edit Milestone';
      if (this.#dom.typeToggleGroup) this.#dom.typeToggleGroup.style.display = 'none';
      if (this.#dom.itemIdInput) this.#dom.itemIdInput.value = timelineEntry.id;

      if (this.#dom.titleInput) this.#dom.titleInput.value = timelineEntry.title || '';
      if (this.#dom.dateInput) this.#dom.dateInput.value = timelineEntry.date || '';
      if (this.#dom.personSelect) this.#dom.personSelect.value = timelineEntry.person || 'both';
      if (this.#dom.countrySelect) this.#dom.countrySelect.value = timelineEntry.countryCode || homeCode;
      if (this.#dom.detailsInput) this.#dom.detailsInput.value = timelineEntry.details || '';

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
    const cardNodes = Array.from(this.#dom.chapterLegsList.querySelectorAll('.chapter-leg-editor-card'));
    return cardNodes.map((cardNode, legIdx) => {
      const cardEl = /** @type {HTMLElement} */ (cardNode);
      const legId = cardEl.dataset.legId || `leg-${Date.now()}-${legIdx + 1}`;
      const selectEl = /** @type {HTMLSelectElement | null} */ (cardEl.querySelector('.leg-country-select'));
      const labelInput = /** @type {HTMLInputElement | null} */ (cardEl.querySelector('.leg-label-input'));
      const startInput = /** @type {HTMLInputElement | null} */ (cardEl.querySelector('.leg-start-input'));
      const endInput = /** @type {HTMLInputElement | null} */ (cardEl.querySelector('.leg-end-input'));
      const notesInput = /** @type {HTMLInputElement | null} */ (cardEl.querySelector('.leg-notes-input'));

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
