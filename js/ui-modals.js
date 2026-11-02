/**
 * Trip Countdown & Timeline Board
 * UI Modals: DaysBreakdownModal & EventCountdownModal Controllers
 */

import { getCountryInfo } from './config.js';
import {
  decomposeRemainingMs,
  formatDisplayDate,
  getEndOfDayInTimeZoneMs,
  getStartOfDayInTimeZoneMs
} from './countdown-engine.js';
import { createPhotoDateElement } from './photo-badge.js';
import { isReunionChapter, resolveMilestonePersonMeta } from './timeline-renderer.js';

/**
 * Traps keyboard focus within an active dialog element.
 * @param {KeyboardEvent} keyboardEvent
 * @param {HTMLElement} dialogContainer
 */
function trapFocus(keyboardEvent, dialogContainer) {
  if (typeof document === 'undefined' || keyboardEvent.key !== 'Tab') return;
  const focusableElements = dialogContainer.querySelectorAll(
    'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusableElements || focusableElements.length === 0) return;

  const firstFocusable = /** @type {HTMLElement} */ (focusableElements[0]);
  const lastFocusable = /** @type {HTMLElement} */ (focusableElements[focusableElements.length - 1]);

  if (keyboardEvent.shiftKey && document.activeElement === firstFocusable) {
    keyboardEvent.preventDefault();
    lastFocusable.focus();
  } else if (!keyboardEvent.shiftKey && document.activeElement === lastFocusable) {
    keyboardEvent.preventDefault();
    firstFocusable.focus();
  }
}

/**
 * Controller for the Country Days Breakdown popup modal dialog.
 */
export class DaysBreakdownModal {
  #dom = {
    modal: /** @type {HTMLElement | null} */ (null),
    backdrop: /** @type {HTMLElement | null} */ (null),
    closeBtn: /** @type {HTMLButtonElement | null} */ (null),
    doneBtn: /** @type {HTMLButtonElement | null} */ (null),
    totalPill: /** @type {HTMLElement | null} */ (null),
    list: /** @type {HTMLElement | null} */ (null)
  };

  #previousFocusedElement = /** @type {HTMLElement | null} */ (null);
  #onCloseCallback = /** @type {(() => void) | null} */ (null);

  /**
   * @param {object} [options]
   * @param {() => void} [options.onClose]
   */
  constructor(options = {}) {
    this.#onCloseCallback = options.onClose || null;
    this.#cacheDomElements();
    this.#bindEvents();
  }

  #cacheDomElements() {
    if (typeof document === 'undefined') return;
    this.#dom = {
      modal: document.getElementById('days-breakdown-modal'),
      backdrop: document.getElementById('days-modal-backdrop'),
      closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('days-modal-close-btn')),
      doneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('days-modal-done-btn')),
      totalPill: document.getElementById('days-modal-total-pill'),
      list: document.getElementById('days-modal-list')
    };
  }

  #bindEvents() {
    this.#dom.closeBtn?.addEventListener('click', this.#handleCloseClick);
    this.#dom.doneBtn?.addEventListener('click', this.#handleCloseClick);
    this.#dom.backdrop?.addEventListener('click', this.#handleCloseClick);
  }

  #handleCloseClick = () => {
    this.close();
  };

  #handleKeydown = (/** @type {KeyboardEvent} */ keyboardEvent) => {
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      this.close();
      return;
    }
    if (this.#dom.modal) {
      trapFocus(keyboardEvent, this.#dom.modal);
    }
  };

  /**
   * Opens the days breakdown modal and populates country statistics.
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  open(boardState) {
    if (!this.#dom.modal || !boardState) return;

    const countryBreakdown = boardState.timeline?.countryDaysBreakdown || [];
    const plannedDays = boardState.timeline?.plannedTripDaysTogether ?? 0;

    if (this.#dom.totalPill) {
      this.#dom.totalPill.textContent = `${plannedDays} Days Total`;
    }

    if (this.#dom.list) {
      this.#dom.list.innerHTML = countryBreakdown.map((breakdownEntry) => `
        <div class="days-breakdown-item">
          <div class="days-breakdown-country">
            <span class="days-breakdown-flag">${breakdownEntry.flag}</span>
            <span class="days-breakdown-name">${breakdownEntry.countryName}</span>
          </div>
          <span class="days-breakdown-count numeric-lock" dir="ltr">${breakdownEntry.days} ${breakdownEntry.days === 1 ? 'Day' : 'Days'}</span>
        </div>
      `).join('');
    }

    this.#previousFocusedElement = typeof document !== 'undefined' ? /** @type {HTMLElement} */ (document.activeElement) : null;
    if (this.#dom.backdrop) this.#dom.backdrop.hidden = false;
    this.#dom.modal.hidden = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.#handleKeydown);
    }
    (this.#dom.doneBtn || this.#dom.closeBtn)?.focus();
  }

  /**
   * Closes the days breakdown modal.
   */
  close() {
    if (!this.isOpen()) return;

    if (this.#dom.backdrop) this.#dom.backdrop.hidden = true;
    if (this.#dom.modal) this.#dom.modal.hidden = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.#handleKeydown);
    }
    if (this.#previousFocusedElement?.focus) {
      this.#previousFocusedElement.focus();
      this.#previousFocusedElement = null;
    }

    this.#onCloseCallback?.();
  }

  /**
   * Checks whether the modal is currently visible.
   * @returns {boolean}
   */
  isOpen() {
    return Boolean(this.#dom.modal && !this.#dom.modal.hidden);
  }

  /**
   * Cleans up all event listeners and DOM bindings.
   */
  destroy() {
    this.close();
    this.#dom.closeBtn?.removeEventListener('click', this.#handleCloseClick);
    this.#dom.doneBtn?.removeEventListener('click', this.#handleCloseClick);
    this.#dom.backdrop?.removeEventListener('click', this.#handleCloseClick);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.#handleKeydown);
    }
    this.#dom = {
      modal: null,
      backdrop: null,
      closeBtn: null,
      doneBtn: null,
      totalPill: null,
      list: null
    };
  }
}

/**
 * Controller for the Milestone & Chapter Live Countdown popup modal dialog.
 */
export class EventCountdownModal {
  #dom = {
    modal: /** @type {HTMLElement | null} */ (null),
    backdrop: /** @type {HTMLElement | null} */ (null),
    badge: /** @type {HTMLElement | null} */ (null),
    title: /** @type {HTMLElement | null} */ (null),
    travelTag: /** @type {HTMLElement | null} */ (null),
    datePill: /** @type {HTMLElement | null} */ (null),
    location: /** @type {HTMLElement | null} */ (null),
    subtext: /** @type {HTMLElement | null} */ (null),
    statusPill: /** @type {HTMLElement | null} */ (null),
    cdDays: /** @type {HTMLElement | null} */ (null),
    cdHours: /** @type {HTMLElement | null} */ (null),
    cdMinutes: /** @type {HTMLElement | null} */ (null),
    cdSeconds: /** @type {HTMLElement | null} */ (null),
    closeBtn: /** @type {HTMLButtonElement | null} */ (null),
    doneBtn: /** @type {HTMLButtonElement | null} */ (null),
    editBtn: /** @type {HTMLButtonElement | null} */ (null)
  };

  #activeItem = /** @type {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null} */ (null);
  #previousFocusedElement = /** @type {HTMLElement | null} */ (null);
  #onEditCallback = /** @type {((timelineEntry: any) => void) | null} */ (null);
  #onCloseCallback = /** @type {(() => void) | null} */ (null);

  /**
   * @param {object} [options]
   * @param {(timelineEntry: any) => void} [options.onEdit] - Invoked when Edit button is clicked.
   * @param {(timelineEntry: any) => void} [options.onEditItem] - Alternate callback signature.
   * @param {() => void} [options.onClose] - Invoked when modal closes.
   */
  constructor(options = {}) {
    this.#onEditCallback = options.onEdit || options.onEditItem || null;
    this.#onCloseCallback = options.onClose || null;
    this.#cacheDomElements();
    this.#bindEvents();
  }

  #cacheDomElements() {
    if (typeof document === 'undefined') return;
    this.#dom = {
      modal: document.getElementById('event-modal'),
      backdrop: document.getElementById('event-modal-backdrop'),
      badge: document.getElementById('event-modal-badge'),
      title: document.getElementById('event-modal-title'),
      travelTag: document.getElementById('event-modal-travel-tag'),
      datePill: document.getElementById('event-modal-date-pill'),
      location: document.getElementById('event-modal-location'),
      subtext: document.getElementById('event-modal-subtext'),
      statusPill: document.getElementById('event-modal-status-pill') || document.querySelector('.event-modal-status-pill'),
      cdDays: document.getElementById('event-cd-days'),
      cdHours: document.getElementById('event-cd-hours'),
      cdMinutes: document.getElementById('event-cd-minutes'),
      cdSeconds: document.getElementById('event-cd-seconds'),
      closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
      doneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),
      editBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn'))
    };
  }

  #bindEvents() {
    this.#dom.closeBtn?.addEventListener('click', this.#handleCloseClick);
    this.#dom.doneBtn?.addEventListener('click', this.#handleCloseClick);
    this.#dom.backdrop?.addEventListener('click', this.#handleCloseClick);
    this.#dom.editBtn?.addEventListener('click', this.#handleEditClick);
  }

  #handleCloseClick = () => {
    this.close();
  };

  #handleEditClick = () => {
    const timelineEntry = this.#activeItem;
    this.close();
    if (timelineEntry) {
      this.#onEditCallback?.(timelineEntry);
    }
  };

  #handleKeydown = (/** @type {KeyboardEvent} */ keyboardEvent) => {
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      this.close();
      return;
    }
    if (this.#dom.modal) {
      trapFocus(keyboardEvent, this.#dom.modal);
    }
  };

  /**
   * Opens the event countdown modal and binds countdown ticking.
   * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter} timelineEntry
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  open(timelineEntry, boardState) {
    if (!timelineEntry || !this.#dom.modal) return;
    this.#activeItem = timelineEntry;

    const isChapter = isReunionChapter(timelineEntry);
    const personMeta = boardState
      ? resolveMilestonePersonMeta(timelineEntry.person || 'both', boardState)
      : { icon: '💕', label: 'Together' };

    let emoji = '';
    let title = '';
    let datePillText = '';
    let locationText = '';

    const fallbackCountryCode = boardState?.dualStatus?.primary?.countryCode || 'US';

    if (isChapter) {
      emoji = timelineEntry.emoji || '🌺';
      title = timelineEntry.title;
      datePillText = `${formatDisplayDate(timelineEntry.startDate)} – ${formatDisplayDate(timelineEntry.endDate)}`;

      const firstLeg = timelineEntry.legs?.[0];
      const startCountry = firstLeg ? getCountryInfo(firstLeg.countryCode) : getCountryInfo(fallbackCountryCode);
      const countryNames = timelineEntry.legs?.map((leg) => {
        const country = getCountryInfo(leg.countryCode);
        return `${country.flag} ${leg.label || country.name}`;
      }).join(' • ') || `${startCountry.flag} ${startCountry.name}`;

      locationText = countryNames;
    } else {
      emoji = timelineEntry.emoji || '✨';
      title = timelineEntry.title;
      datePillText = formatDisplayDate(timelineEntry.date);

      const country = timelineEntry.countryCode ? getCountryInfo(timelineEntry.countryCode) : getCountryInfo(fallbackCountryCode);
      locationText = `${country.flag} ${country.name}`;
    }

    if (this.#dom.badge) this.#dom.badge.textContent = emoji;
    if (this.#dom.title) this.#dom.title.textContent = title;
    if (this.#dom.datePill) {
      this.#dom.datePill.replaceChildren(createPhotoDateElement(datePillText, { isCompact: true }));
    }
    if (this.#dom.travelTag) {
      this.#dom.travelTag.textContent = `${personMeta.icon} ${personMeta.label}`;
      this.#dom.travelTag.hidden = false;
    }
    if (this.#dom.location) this.#dom.location.textContent = locationText;
    if (this.#dom.subtext) {
      this.#dom.subtext.textContent = '';
      this.#dom.subtext.hidden = true;
    }

    this.updateCountdown(boardState?.nowMs ?? Date.now(), boardState);

    this.#previousFocusedElement = typeof document !== 'undefined' ? /** @type {HTMLElement} */ (document.activeElement) : null;
    if (this.#dom.backdrop) this.#dom.backdrop.hidden = false;
    this.#dom.modal.hidden = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.#handleKeydown);
    }
    (this.#dom.doneBtn || this.#dom.closeBtn)?.focus();
  }

  /**
   * Updates the live countdown numbers and status pill.
   * @param {number} nowMs
   * @param {import('./config.js').EvaluatedBoardState} [boardState]
   */
  updateCountdown(nowMs, boardState) {
    if (!this.#activeItem) return;

    const timelineEntry = this.#activeItem;
    const isChapter = isReunionChapter(timelineEntry);
    const fallbackCountryCode = boardState?.dualStatus?.primary?.countryCode || 'US';

    let targetStartMs = 0;
    let targetEndMs = 0;

    if (isChapter) {
      const firstLeg = timelineEntry.legs?.[0];
      const startCountry = firstLeg ? getCountryInfo(firstLeg.countryCode) : getCountryInfo(fallbackCountryCode);
      const lastLeg = timelineEntry.legs?.[timelineEntry.legs.length - 1];
      const endCountry = lastLeg ? getCountryInfo(lastLeg.countryCode) : startCountry;

      targetStartMs = getStartOfDayInTimeZoneMs(timelineEntry.startDate, startCountry.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(timelineEntry.endDate, endCountry.timeZone);
    } else {
      const country = timelineEntry.countryCode ? getCountryInfo(timelineEntry.countryCode) : getCountryInfo(fallbackCountryCode);
      targetStartMs = getStartOfDayInTimeZoneMs(timelineEntry.date, country.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(timelineEntry.date, country.timeZone);
    }

    if (nowMs < targetStartMs) {
      const remaining = decomposeRemainingMs(targetStartMs - nowMs);
      if (this.#dom.cdDays) this.#dom.cdDays.textContent = String(remaining.days).padStart(2, '0');
      if (this.#dom.cdHours) this.#dom.cdHours.textContent = String(remaining.hours).padStart(2, '0');
      if (this.#dom.cdMinutes) this.#dom.cdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
      if (this.#dom.cdSeconds) this.#dom.cdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

      if (this.#dom.statusPill) {
        this.#dom.statusPill.className = 'event-modal-status-pill';
        this.#dom.statusPill.textContent = remaining.days === 0
          ? 'Starts Today'
          : remaining.days === 1
            ? 'Starts Tomorrow'
            : `${remaining.days} Days Away`;
      }
    } else if (nowMs <= targetEndMs) {
      const remaining = decomposeRemainingMs(targetEndMs - nowMs);
      if (this.#dom.cdDays) this.#dom.cdDays.textContent = String(remaining.days).padStart(2, '0');
      if (this.#dom.cdHours) this.#dom.cdHours.textContent = String(remaining.hours).padStart(2, '0');
      if (this.#dom.cdMinutes) this.#dom.cdMinutes.textContent = String(remaining.minutes).padStart(2, '0');
      if (this.#dom.cdSeconds) this.#dom.cdSeconds.textContent = String(remaining.seconds).padStart(2, '0');

      if (this.#dom.statusPill) {
        this.#dom.statusPill.className = 'event-modal-status-pill is-active';
        this.#dom.statusPill.textContent = isChapter ? 'Active Chapter 💕' : 'Happening Today 🎉';
      }
    } else {
      if (this.#dom.cdDays) this.#dom.cdDays.textContent = '00';
      if (this.#dom.cdHours) this.#dom.cdHours.textContent = '00';
      if (this.#dom.cdMinutes) this.#dom.cdMinutes.textContent = '00';
      if (this.#dom.cdSeconds) this.#dom.cdSeconds.textContent = '00';

      if (this.#dom.statusPill) {
        this.#dom.statusPill.className = 'event-modal-status-pill';
        this.#dom.statusPill.textContent = 'Completed Event';
      }
    }
  }

  /**
   * Closes the event countdown modal.
   */
  close() {
    if (!this.isOpen()) return;

    this.#activeItem = null;
    if (this.#dom.backdrop) this.#dom.backdrop.hidden = true;
    if (this.#dom.modal) this.#dom.modal.hidden = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.#handleKeydown);
    }
    if (this.#previousFocusedElement?.focus) {
      this.#previousFocusedElement.focus();
      this.#previousFocusedElement = null;
    }

    this.#onCloseCallback?.();
  }

  /**
   * Returns the item currently displayed in the modal.
   * @returns {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter | null}
   */
  getActiveItem() {
    return this.#activeItem;
  }

  /**
   * Checks whether the modal is currently open.
   * @returns {boolean}
   */
  isOpen() {
    return Boolean(this.#activeItem && this.#dom.modal && !this.#dom.modal.hidden);
  }

  /**
   * Cleans up all event listeners and DOM bindings.
   */
  destroy() {
    this.close();
    this.#dom.closeBtn?.removeEventListener('click', this.#handleCloseClick);
    this.#dom.doneBtn?.removeEventListener('click', this.#handleCloseClick);
    this.#dom.backdrop?.removeEventListener('click', this.#handleCloseClick);
    this.#dom.editBtn?.removeEventListener('click', this.#handleEditClick);
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.#handleKeydown);
    }
    this.#dom = {
      modal: null,
      backdrop: null,
      badge: null,
      title: null,
      travelTag: null,
      datePill: null,
      location: null,
      subtext: null,
      statusPill: null,
      cdDays: null,
      cdHours: null,
      cdMinutes: null,
      cdSeconds: null,
      closeBtn: null,
      doneBtn: null,
      editBtn: null
    };
  }
}
