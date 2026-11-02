# Handoff Report: UI Gestures and Modals Extraction (Milestone 4)

## 1. Observation

### Existing Code Locations in `js/app.js`
1. **Sheet Drag Gestures**:
   - `bindSheetDragGestures` is defined at `js/app.js:903-968`:
     ```javascript
     bindSheetDragGestures(sheet, dragTarget, onClose) {
       if (!sheet) return;
       let touchStartY = 0;
       let currentDeltaY = 0;
       let isTrackingTouch = false;
       ...
       dragTarget?.addEventListener('touchstart', onTouchStart, { passive: true });
       dragTarget?.addEventListener('touchmove', onTouchMove, { passive: false });
       dragTarget?.addEventListener('touchend', onTouchEnd, { passive: true });
       dragTarget?.addEventListener('touchcancel', onTouchEnd, { passive: true });
       ...
       // Also support drag-down directly inside sheet when scrolled to top
       sheet.addEventListener('touchstart', (e) => { ... }, { passive: true });
       sheet.addEventListener('touchmove', (e) => { ... }, { passive: false });
       sheet.addEventListener('touchend', onTouchEnd, { passive: true });
     }
     ```
   - Invocation in `js/app.js:631-640`:
     ```javascript
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
     ```
   - Current limitations observed:
     - No pointer / mouse event support (`PointerEvent` with pointer capture is missing, preventing desktop mouse dragging on handle).
     - Hardcoded dismissal threshold: `if (currentDeltaY > 80)` with no velocity calculation.
     - No unbind / cleanup function returned, violating memory lifecycle hygiene when sheets are mounted/unmounted.

2. **Days Breakdown Modal**:
   - DOM caching at `js/app.js:231-236`:
     ```javascript
     daysModalBackdrop: document.getElementById('days-modal-backdrop'),
     daysBreakdownModal: document.getElementById('days-breakdown-modal'),
     daysModalCloseBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('days-modal-close-btn')),
     daysModalDoneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('days-modal-done-btn')),
     daysModalTotalPill: document.getElementById('days-modal-total-pill'),
     daysModalList: document.getElementById('days-modal-list'),
     ```
   - Methods at `js/app.js:1348-1376`:
     - `openDaysBreakdownModal()`: extracts `state.timeline.countryDaysBreakdown` and `state.timeline.plannedTripDaysTogether`, populates `#days-modal-total-pill` and `#days-modal-list` with `.days-breakdown-count.numeric-lock[dir="ltr"]`.
     - `closeDaysBreakdownModal()`: hides modal and backdrop.
   - Listeners at `js/app.js:612-614`: click listeners on `daysModalCloseBtn`, `daysModalDoneBtn`, `daysModalBackdrop`.
   - Keyboard listener at `js/app.js:617-619`: Escape key closes dialog.

3. **Event Countdown Modal**:
   - DOM caching at `js/app.js:281-296`:
     ```javascript
     eventModalBackdrop: document.getElementById('event-modal-backdrop'),
     eventModal: document.getElementById('event-modal'),
     eventModalBadge: document.getElementById('event-modal-badge'),
     eventModalCloseBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
     eventModalStatusPill: document.getElementById('event-modal-status-pill'),
     eventModalDatePill: document.getElementById('event-modal-date-pill'),
     eventModalTitle: document.getElementById('event-modal-title'),
     eventModalTravelTag: document.getElementById('event-modal-travel-tag'),
     eventModalLocation: document.getElementById('event-modal-location'),
     eventCdDays: document.getElementById('event-cd-days'),
     eventCdHours: document.getElementById('event-cd-hours'),
     eventCdMinutes: document.getElementById('event-cd-minutes'),
     eventCdSeconds: document.getElementById('event-cd-seconds'),
     eventModalSubtext: document.getElementById('event-modal-subtext'),
     eventModalEditBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn')),
     eventModalDoneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),
     ```
   - Active state field at `js/app.js:116`: `#activeEventModalItem = null;`
   - Methods at `js/app.js:1378-1496`:
     - `openEventModal(item)`: sets `#activeEventModalItem`, shows modal/backdrop, calls `updateEventModalCountdown()`.
     - `closeEventModal()`: clears `#activeEventModalItem`, hides modal/backdrop.
     - `updateEventModalCountdown()`: computes `targetStartMs` and `targetEndMs` based on timezone of first/last leg (for chapter) or milestone country; formats date pill using `createPhotoDateElement`; sets person travel tag using `resolveMilestonePersonMeta`; updates 4 countdown units (`days`, `hours`, `minutes`, `seconds`); sets status pill (`Starts Today`, `Starts Tomorrow`, `X Days Away`, `Active Chapter 💕`, `Happening Today 🎉`, `Completed Event`).
   - Listeners at `js/app.js:602-608`:
     - click on close button, done button, backdrop closes modal.
     - click on edit button closes modal and calls `this.openTimelineItemEditor(item)`.
   - Tick loop integration at `js/app.js:1771-1773`:
     ```javascript
     if (this.#activeEventModalItem) {
       this.updateEventModalCountdown();
     }
     ```
   - HTML markup check (`index.html:451-532`):
     - Both modals have `role="dialog"`, `aria-modal="true"`.
     - `#days-breakdown-modal` has `aria-labelledby="days-modal-title"`.
     - `#event-modal` has `aria-labelledby="event-modal-title"`.
     - Note on `#event-modal-status-pill`: In `index.html:470-474`, there is `.event-modal-travel-tag` and `.timeline-date-pill`, but no element with `id="event-modal-status-pill"`. `app.js` safely guards `if (this.dom.eventModalStatusPill)` so it does not throw when null.

---

## 2. Logic Chain

1. **Extraction Seam 1: `js/ui-gestures.js`**:
   - `bindSheetDragGestures` currently operates directly on DOM elements without any dependency on `app.js` internal state.
   - By adding PointerEvent handling (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) on `dragTargetElement` with `setPointerCapture`, desktop mouse drags and stylus interactions are supported with zero external libraries.
   - For scrollable sheets (`sheetElement`), pull-down when `scrollTop <= 0` is retained via `touch` listeners, preventing conflict between inner scroll and dismissal.
   - Dynamic thresholding with velocity (`velocity = deltaY / elapsedTimeMs`) improves responsiveness: quick flings (>0.5 px/ms) dismiss even if deltaY is only 30px, while slow drags require >=100px.
   - Smooth spring snap-back is achieved by applying `transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)'` and clearing `transform`.
   - Returning an unbind cleanup function `() => void` satisfies the memory hygiene invariant in `AGENTS.md`.

2. **Extraction Seam 2: `js/ui-modals.js` (`DaysBreakdownModal`)**:
   - `DaysBreakdownModal` receives `boardState` as input to `open(boardState)`.
   - It needs zero access to `tripConfig` or `Date.now()` because `boardState.timeline.countryDaysBreakdown` and `plannedTripDaysTogether` are already computed deterministically by `countdown-engine.js`.
   - Bidirectional numeric lock (`.numeric-lock` and `dir="ltr"`) on day numbers guarantees numbers do not reverse when rendered in Hebrew/RTL context.
   - Focus trapping (`Tab` / `Shift+Tab`) and keyboard Escape dismissal make the modal fully accessible.
   - Providing `isOpen()`, `close()`, and `destroy()` ensures strict memory lifecycle cleanup.

3. **Extraction Seam 3: `js/ui-modals.js` (`EventCountdownModal`)**:
   - `EventCountdownModal` handles display and live per-second ticking for any focused milestone or reunion chapter.
   - In `open(item, boardState)`, it renders static labels (badge, title, date pill via `createPhotoDateElement`, travel tag via `resolveMilestonePersonMeta`, location, subtext) and starts countdown updates.
   - In `updateCountdown(nowMs, boardState)`, it accepts explicit `nowMs` and `boardState`, ensuring Time-Travel Preview Slider works deterministically without querying `Date.now()`.
   - Edit button triggers an `onEdit(item)` callback passed into constructor options.
   - `getActiveItem()` and `isOpen()` allow `app.js` tick loop to query state cleanly:
     `if (this.eventModal.isOpen()) this.eventModal.updateCountdown(effectiveNowMs, boardState);`
   - `destroy()` unbinds click listeners and keyboard listeners.

4. **Integration into `js/app.js`**:
   - Reduces `js/app.js` by over 220 lines.
   - Replaces custom modal and drag logic in `app.js` with declarative instantiation of sub-controllers.

---

## 3. Caveats

1. **DOM ID `#event-modal-status-pill`**:
   - In `index.html`, `#event-modal-status-pill` does not exist as an ID. In `styles/sheets-and-modals.css`, `.event-modal-status-pill` is styled, and in `index.html:522` it appears inside `days-breakdown-modal`.
   - `EventCountdownModal` must query `statusPillElement` defensively (`document.getElementById('event-modal-status-pill') || this.dom.modalElement?.querySelector('.event-modal-status-pill')`) and guard with optional chaining.
2. **Backdrop Sharing vs Distinct Backdrops**:
   - `index.html` has two separate backdrop elements: `#days-modal-backdrop` and `#event-modal-backdrop`. Each modal controller owns its dedicated backdrop element.
3. **Scope Constraints**:
   - Per dispatch instructions, this investigation is strictly read-only. No files were modified during this investigation. Implementation will be executed in the corresponding implementation task.

---

## 4. Conclusion & Proposed Implementation Specs

### 4.1 Specification for `js/ui-gestures.js`

```javascript
/**
 * Trip Countdown & Timeline Board
 * Sheet Gestures: Touch & Pointer Drag-to-Dismiss Handler
 */

/**
 * Binds downward drag gestures to a sheet element using pointer and touch events.
 *
 * @param {HTMLElement | null} sheetElement - The sheet container element being translated.
 * @param {HTMLElement | null} dragTargetElement - The handle or header element initiating the drag.
 * @param {() => void} onClose - Callback invoked when the sheet is dragged beyond dismissal threshold.
 * @param {object} [options]
 * @param {number} [options.dismissThreshold=100] - Downward pixel distance triggering dismissal.
 * @param {number} [options.velocityThreshold=0.5] - Downward velocity (px/ms) triggering dismissal.
 * @param {string} [options.openClass='is-open'] - CSS class indicating the sheet is open.
 * @returns {() => void} Unbind cleanup function removing all attached event listeners.
 */
export function bindSheetDragGestures(sheetElement, dragTargetElement, onClose, options = {}) {
  if (!sheetElement || typeof window === 'undefined') {
    return () => {};
  }

  const {
    dismissThreshold = 100,
    velocityThreshold = 0.5,
    openClass = 'is-open'
  } = options;

  let startY = 0;
  let startTimeMs = 0;
  let currentDeltaY = 0;
  let isTracking = false;

  const resetStyles = () => {
    sheetElement.style.transform = '';
    sheetElement.style.transition = '';
  };

  const onPointerDown = (/** @type {PointerEvent} */ e) => {
    if (!sheetElement.classList.contains(openClass)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    startY = e.clientY;
    startTimeMs = Date.now();
    currentDeltaY = 0;
    isTracking = true;
    sheetElement.style.transition = 'none';

    if (dragTargetElement?.setPointerCapture) {
      try {
        dragTargetElement.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const onPointerMove = (/** @type {PointerEvent} */ e) => {
    if (!isTracking) return;
    const deltaY = e.clientY - startY;
    if (deltaY > 0) {
      currentDeltaY = deltaY;
      sheetElement.style.transform = `translateY(${deltaY}px)`;
      if (e.cancelable) e.preventDefault();
    }
  };

  const onPointerUp = (/** @type {PointerEvent} */ e) => {
    if (!isTracking) return;
    isTracking = false;

    if (dragTargetElement?.releasePointerCapture) {
      try {
        dragTargetElement.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const elapsedMs = Math.max(1, Date.now() - startTimeMs);
    const velocity = currentDeltaY / elapsedMs;

    if (currentDeltaY >= dismissThreshold || (currentDeltaY > 30 && velocity >= velocityThreshold)) {
      resetStyles();
      onClose();
    } else {
      sheetElement.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
      sheetElement.style.transform = '';
      const onTransitionEnd = () => {
        sheetElement.removeEventListener('transitionend', onTransitionEnd);
        sheetElement.style.transition = '';
      };
      sheetElement.addEventListener('transitionend', onTransitionEnd);
    }
    currentDeltaY = 0;
  };

  // Touch fallback for scrollable sheet body pull-down at scrollTop <= 0
  const onSheetTouchStart = (/** @type {TouchEvent} */ e) => {
    if (!sheetElement.classList.contains(openClass)) return;
    if (sheetElement.scrollTop <= 0 && e.touches.length > 0) {
      startY = e.touches[0].clientY;
      startTimeMs = Date.now();
      currentDeltaY = 0;
    }
  };

  const onSheetTouchMove = (/** @type {TouchEvent} */ e) => {
    if (sheetElement.scrollTop <= 0 && e.touches.length > 0) {
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 0 && !isTracking) {
        isTracking = true;
        sheetElement.style.transition = 'none';
      }
      if (isTracking) {
        currentDeltaY = deltaY;
        sheetElement.style.transform = `translateY(${deltaY}px)`;
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const onSheetTouchEnd = () => {
    if (!isTracking) return;
    onPointerUp(/** @type {any} */ ({ pointerId: 0 }));
  };

  // Bind drag target
  if (dragTargetElement) {
    dragTargetElement.addEventListener('pointerdown', onPointerDown);
    dragTargetElement.addEventListener('pointermove', onPointerMove);
    dragTargetElement.addEventListener('pointerup', onPointerUp);
    dragTargetElement.addEventListener('pointercancel', onPointerUp);
  }

  // Bind sheet body top pull-down
  sheetElement.addEventListener('touchstart', onSheetTouchStart, { passive: true });
  sheetElement.addEventListener('touchmove', onSheetTouchMove, { passive: false });
  sheetElement.addEventListener('touchend', onSheetTouchEnd, { passive: true });
  sheetElement.addEventListener('touchcancel', onSheetTouchEnd, { passive: true });

  return () => {
    if (dragTargetElement) {
      dragTargetElement.removeEventListener('pointerdown', onPointerDown);
      dragTargetElement.removeEventListener('pointermove', onPointerMove);
      dragTargetElement.removeEventListener('pointerup', onPointerUp);
      dragTargetElement.removeEventListener('pointercancel', onPointerUp);
    }
    sheetElement.removeEventListener('touchstart', onSheetTouchStart);
    sheetElement.removeEventListener('touchmove', onSheetTouchMove);
    sheetElement.removeEventListener('touchend', onSheetTouchEnd);
    sheetElement.removeEventListener('touchcancel', onSheetTouchEnd);
    resetStyles();
  };
}
```

---

### 4.2 Specification for `js/ui-modals.js`

```javascript
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
 * @param {KeyboardEvent} event
 * @param {HTMLElement} containerElement
 */
function trapFocus(event, containerElement) {
  if (event.key !== 'Tab') return;
  const focusable = containerElement.querySelectorAll(
    'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable || focusable.length === 0) return;

  const first = /** @type {HTMLElement} */ (focusable[0]);
  const last = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
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

  #handleKeydown = (/** @type {KeyboardEvent} */ event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.#dom.modal) {
      trapFocus(event, this.#dom.modal);
    }
  };

  /**
   * Opens the days breakdown modal and populates country statistics.
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  open(boardState) {
    if (!this.#dom.modal || !boardState) return;

    const breakdown = boardState.timeline?.countryDaysBreakdown || [];
    const plannedDays = boardState.timeline?.plannedTripDaysTogether ?? 0;

    if (this.#dom.totalPill) {
      this.#dom.totalPill.textContent = `${plannedDays} Days Total`;
    }

    if (this.#dom.list) {
      this.#dom.list.innerHTML = breakdown.map((item) => `
        <div class="days-breakdown-item">
          <div class="days-breakdown-country">
            <span class="days-breakdown-flag">${item.flag}</span>
            <span class="days-breakdown-name">${item.countryName}</span>
          </div>
          <span class="days-breakdown-count numeric-lock" dir="ltr">${item.days} ${item.days === 1 ? 'Day' : 'Days'}</span>
        </div>
      `).join('');
    }

    this.#previousFocusedElement = /** @type {HTMLElement} */ (document.activeElement);
    if (this.#dom.backdrop) this.#dom.backdrop.hidden = false;
    this.#dom.modal.hidden = false;

    window.addEventListener('keydown', this.#handleKeydown);
    (this.#dom.doneBtn || this.#dom.closeBtn)?.focus();
  }

  /**
   * Closes the days breakdown modal.
   */
  close() {
    if (!this.isOpen()) return;

    if (this.#dom.backdrop) this.#dom.backdrop.hidden = true;
    if (this.#dom.modal) this.#dom.modal.hidden = true;

    window.removeEventListener('keydown', this.#handleKeydown);
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
    window.removeEventListener('keydown', this.#handleKeydown);
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
  #onEditCallback = /** @type {((item: any) => void) | null} */ (null);
  #onCloseCallback = /** @type {(() => void) | null} */ (null);

  /**
   * @param {object} [options]
   * @param {(item: any) => void} [options.onEdit] - Invoked when "Edit Entry" button is pressed.
   * @param {() => void} [options.onClose] - Invoked when modal closes.
   */
  constructor(options = {}) {
    this.#onEditCallback = options.onEdit || null;
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
    const item = this.#activeItem;
    this.close();
    if (item) {
      this.#onEditCallback?.(item);
    }
  };

  #handleKeydown = (/** @type {KeyboardEvent} */ event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.#dom.modal) {
      trapFocus(event, this.#dom.modal);
    }
  };

  /**
   * Opens the event countdown modal and binds countdown ticking.
   * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter} item
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  open(item, boardState) {
    if (!item || !this.#dom.modal) return;
    this.#activeItem = item;

    const isChapter = isReunionChapter(item);
    const personMeta = boardState
      ? resolveMilestonePersonMeta(item.person || 'both', boardState)
      : { icon: '💕', label: 'Together' };

    let emoji = '';
    let title = '';
    let datePillText = '';
    let locationText = '';

    const fallbackCountryCode = boardState?.dualStatus?.primary?.countryCode || 'US';

    if (isChapter) {
      emoji = item.emoji || '🌺';
      title = item.title;
      datePillText = `${formatDisplayDate(item.startDate)} – ${formatDisplayDate(item.endDate)}`;

      const firstLeg = item.legs?.[0];
      const startCountry = firstLeg ? getCountryInfo(firstLeg.countryCode) : getCountryInfo(fallbackCountryCode);
      const countryNames = item.legs?.map((leg) => {
        const country = getCountryInfo(leg.countryCode);
        return `${country.flag} ${leg.label || country.name}`;
      }).join(' • ') || `${startCountry.flag} ${startCountry.name}`;

      locationText = countryNames;
    } else {
      emoji = item.emoji || '✨';
      title = item.title;
      datePillText = formatDisplayDate(item.date);

      const country = item.countryCode ? getCountryInfo(item.countryCode) : getCountryInfo(fallbackCountryCode);
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

    this.#previousFocusedElement = /** @type {HTMLElement} */ (document.activeElement);
    if (this.#dom.backdrop) this.#dom.backdrop.hidden = false;
    this.#dom.modal.hidden = false;

    window.addEventListener('keydown', this.#handleKeydown);
    (this.#dom.doneBtn || this.#dom.closeBtn)?.focus();
  }

  /**
   * Updates the live countdown numbers and status pill.
   * @param {number} nowMs
   * @param {import('./config.js').EvaluatedBoardState} [boardState]
   */
  updateCountdown(nowMs, boardState) {
    if (!this.#activeItem) return;

    const item = this.#activeItem;
    const isChapter = isReunionChapter(item);
    const fallbackCountryCode = boardState?.dualStatus?.primary?.countryCode || 'US';

    let targetStartMs = 0;
    let targetEndMs = 0;

    if (isChapter) {
      const firstLeg = item.legs?.[0];
      const startCountry = firstLeg ? getCountryInfo(firstLeg.countryCode) : getCountryInfo(fallbackCountryCode);
      const lastLeg = item.legs?.[item.legs.length - 1];
      const endCountry = lastLeg ? getCountryInfo(lastLeg.countryCode) : startCountry;

      targetStartMs = getStartOfDayInTimeZoneMs(item.startDate, startCountry.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(item.endDate, endCountry.timeZone);
    } else {
      const country = item.countryCode ? getCountryInfo(item.countryCode) : getCountryInfo(fallbackCountryCode);
      targetStartMs = getStartOfDayInTimeZoneMs(item.date, country.timeZone);
      targetEndMs = getEndOfDayInTimeZoneMs(item.date, country.timeZone);
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

    window.removeEventListener('keydown', this.#handleKeydown);
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
    window.removeEventListener('keydown', this.#handleKeydown);
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
```

---

### 4.3 Integration in `js/app.js`

1. **Imports**:
   ```javascript
   import { bindSheetDragGestures } from './ui-gestures.js';
   import { DaysBreakdownModal, EventCountdownModal } from './ui-modals.js';
   ```

2. **Instantiation**:
   ```javascript
   this.daysBreakdownModal = new DaysBreakdownModal();
   this.eventCountdownModal = new EventCountdownModal({
     onEdit: (item) => this.openTimelineItemEditor(item)
   });
   ```

3. **Sheet Drag Bindings**:
   ```javascript
   this.#unbindEditSheetDrag = bindSheetDragGestures(
     this.dom.editBottomSheet,
     this.dom.sheetHandleWrapper || this.dom.sheetHeader,
     () => this.closeEditSheet()
   );
   this.#unbindTimelineSheetDrag = bindSheetDragGestures(
     this.dom.timelineItemSheet,
     this.dom.timelineSheetHandleWrapper || this.dom.timelineSheetHeader,
     () => this.closeTimelineItemEditor()
   );
   ```

4. **TimelineRenderer Callbacks**:
   ```javascript
   onEditItem: (item) => this.eventCountdownModal.open(item, this.latestBoardState),
   onOpenDaysBreakdown: () => this.daysBreakdownModal.open(this.latestBoardState),
   ```

5. **Tick Loop**:
   ```javascript
   if (this.eventCountdownModal.isOpen()) {
     this.eventCountdownModal.updateCountdown(effectiveNowMs, state);
   }
   ```

6. **Lock Board / Reset**:
   ```javascript
   this.daysBreakdownModal.close();
   this.eventCountdownModal.close();
   ```

7. **Destruction / Unload**:
   ```javascript
   this.#unbindEditSheetDrag?.();
   this.#unbindTimelineSheetDrag?.();
   this.daysBreakdownModal?.destroy();
   this.eventCountdownModal?.destroy();
   ```

---

## 5. Verification Method

1. **Unit and Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   All 25 tests must pass with 0 regressions.

2. **Security Audit File Verification**:
   Verify that neither `js/ui-gestures.js` nor `js/ui-modals.js` contains any personal names, itinerary dates, or token references.
   Ensure they adhere to the zero-knowledge pattern scan in `tests/integration.test.mjs`.

3. **Interactive Validation Checklist**:
   - Touch and mouse dragging on `.sheet-handle-wrapper`: sheet follows pointer smoothly down and springs back smoothly when released under 100px.
   - Quick downward fling dismisses sheet.
   - Days breakdown modal opens from timeline summary pill, displays tabular day counts with `.numeric-lock`, and closes via Done button, backdrop click, or Escape key.
   - Event countdown modal opens from any milestone card, displays active ticking countdown to second precision, and updates dynamically.
   - Focus trapping ensures `Tab` stays within open modal dialog.
   - Pressing "Edit Entry" closes modal and opens timeline item editor sheet.
