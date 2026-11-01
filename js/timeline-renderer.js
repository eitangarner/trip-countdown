import { getCountryInfo } from './config.js';
import {
  formatDisplayDate,
  formatShortDisplayDate,
  getEndOfDayInTimeZoneMs,
  getReunionDurationDays,
  getStartOfDayInTimeZoneMs
} from './countdown-engine.js';
import { createPhotoDateElement } from './photo-stack.js';

/**
 * Checks whether a timeline item is a ReunionChapter (has legs array) vs a MilestoneEvent.
 * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter} item
 * @returns {item is import('./config.js').ReunionChapter}
 */
export function isReunionChapter(item) {
  return Boolean(item && Array.isArray(/** @type {any} */ (item).legs));
}

/**
 * Resolves the slot ('primary' | 'secondary' | 'both'), display label, and avatar icon for a milestone's `person` field.
 * @param {string} personKey
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @returns {{ slot: 'primary'|'secondary'|'both', label: string, icon: string }}
 */
export function resolveMilestonePersonMeta(personKey, boardState) {
  const primary = boardState.dualStatus?.primary;
  const secondary = boardState.dualStatus?.secondary;

  if (primary && (personKey === primary.person || personKey === 'primary')) {
    return { slot: 'primary', label: primary.displayName, icon: '🌸' };
  }
  if (secondary && (personKey === secondary.person || personKey === 'secondary')) {
    return { slot: 'secondary', label: secondary.displayName, icon: '🌊' };
  }
  return { slot: 'both', label: 'Together', icon: '💕' };
}

/**
 * Renders a single MilestoneEvent card anchored to Primary, Secondary, or Both.
 * @param {import('./config.js').MilestoneEvent} milestone
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onEditItem]
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onDeleteItem]
 * @returns {HTMLElement}
 */
export function createMilestoneRowElement(milestone, boardState, onEditItem = null, onDeleteItem = null) {
  const { slot, label, icon } = resolveMilestonePersonMeta(milestone.person || 'both', boardState);
  const row = document.createElement('div');
  row.className = 'milestone-row';
  row.dataset.person = slot;

  const card = document.createElement('article');
  card.className = 'milestone-card is-interactive';
  card.dataset.person = slot;
  card.dataset.category = milestone.category || 'custom';
  card.dataset.itemId = milestone.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Edit milestone: ${milestone.title}`);

  if (onEditItem) {
    card.addEventListener('click', () => onEditItem(milestone));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEditItem(milestone);
      }
    });
  }

  const emojiBadge = document.createElement('div');
  emojiBadge.className = 'milestone-emoji-badge';
  emojiBadge.textContent = milestone.emoji || '✨';

  const body = document.createElement('div');
  body.className = 'milestone-body';

  const metaRow = document.createElement('div');
  metaRow.className = 'milestone-meta-row';

  const dateCol = document.createElement('div');
  dateCol.className = 'milestone-date-col';

  const datePages = createPhotoDateElement(milestone.date, { isCompact: true });
  dateCol.appendChild(datePages);

  const countryInfo = milestone.countryCode ? getCountryInfo(milestone.countryCode) : null;
  if (countryInfo) {
    const countryBadge = document.createElement('span');
    countryBadge.className = 'milestone-country-badge';
    countryBadge.textContent = `${countryInfo.flag} ${countryInfo.name}`;
    dateCol.appendChild(countryBadge);
  }

  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'milestone-actions-group';

  const personTag = document.createElement('span');
  personTag.className = 'milestone-person-tag';
  personTag.textContent = `${icon} ${label}`;
  actionsGroup.appendChild(personTag);

  const isCustomEvent = milestone.category === 'custom' || String(milestone.id).startsWith('custom-');
  if (onDeleteItem && isCustomEvent) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'milestone-card-delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${milestone.title}`);
    deleteBtn.title = 'Delete event';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDeleteItem(milestone);
    });
    actionsGroup.appendChild(deleteBtn);
  }

  metaRow.appendChild(dateCol);
  metaRow.appendChild(actionsGroup);

  const titleEl = document.createElement('h4');
  titleEl.className = 'milestone-title';
  titleEl.setAttribute('dir', 'auto');
  titleEl.textContent = milestone.title;

  body.appendChild(metaRow);
  body.appendChild(titleEl);

  card.appendChild(emojiBadge);
  card.appendChild(body);
  row.appendChild(card);

  return row;
}

/**
 * Evaluates whether a specific leg inside a ReunionChapter is past, active, or upcoming at nowMs.
 * @param {import('./config.js').ReunionLeg} leg
 * @param {number} index
 * @param {import('./config.js').ReunionLeg[]} allLegs
 * @param {number} nowMs
 * @param {string | null} activeLegId
 * @returns {'past'|'active'|'upcoming'}
 */
function resolveLegTimelineStatus(leg, index, allLegs, nowMs, activeLegId) {
  if (activeLegId && leg.id === activeLegId) {
    return 'active';
  }
  const legCountry = getCountryInfo(leg.countryCode);
  const startMs = getStartOfDayInTimeZoneMs(leg.startDate, legCountry.timeZone);
  const nextLeg = allLegs[index + 1] ?? null;
  const endMs = nextLeg
    ? getStartOfDayInTimeZoneMs(nextLeg.startDate, getCountryInfo(nextLeg.countryCode).timeZone) - 1
    : getEndOfDayInTimeZoneMs(leg.endDate, legCountry.timeZone);

  if (nowMs > endMs) return 'past';
  if (nowMs >= startMs && nowMs <= endMs) return 'active';
  return 'upcoming';
}

/**
 * Renders a converged wide ReunionChapter card with its internal multi-country leg stepper.
 * @param {import('./config.js').ReunionChapter} reunion
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onEditItem]
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onDeleteItem]
 * @returns {HTMLElement}
 */
function createReunionCardElement(reunion, boardState, onEditItem = null, onDeleteItem = null) {
  const isActiveReunion = boardState.activeReunion?.reunion.id === reunion.id;
  const activeLegId = isActiveReunion ? boardState.activeReunion?.activeLeg.id ?? null : null;

  const card = document.createElement('article');
  card.className = `reunion-chapter-card${isActiveReunion ? ' is-active' : ''} is-interactive`;
  card.dataset.reunionId = reunion.id;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Edit reunion chapter: ${reunion.title}`);

  if (onEditItem) {
    card.addEventListener('click', () => onEditItem(reunion));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEditItem(reunion);
      }
    });
  }

  const header = document.createElement('div');
  header.className = 'reunion-card-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'reunion-title-group';

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'reunion-emoji';
  emojiSpan.textContent = reunion.emoji || '🌺';

  const titleStack = document.createElement('div');
  const titleEl = document.createElement('h3');
  titleEl.className = 'reunion-title';
  titleEl.setAttribute('dir', 'auto');
  titleEl.textContent = reunion.title;

  const dateRangeEl = document.createElement('div');
  dateRangeEl.className = 'reunion-date-range numeric-lock';
  dateRangeEl.setAttribute('dir', 'ltr');
  dateRangeEl.textContent = `${formatDisplayDate(reunion.startDate)} – ${formatDisplayDate(reunion.endDate)}`;

  titleStack.appendChild(titleEl);
  titleStack.appendChild(dateRangeEl);
  titleGroup.appendChild(emojiSpan);
  titleGroup.appendChild(titleStack);

  const totalDays = getReunionDurationDays(reunion);
  const durationPill = document.createElement('span');
  durationPill.className = 'reunion-duration-pill numeric-lock';
  durationPill.setAttribute('dir', 'ltr');
  durationPill.textContent = isActiveReunion
    ? `Day ${boardState.activeReunion.dayOfReunion} of ${totalDays}`
    : `${totalDays} Days Together`;

  const headerActions = document.createElement('div');
  headerActions.className = 'milestone-actions-group';
  headerActions.appendChild(durationPill);

  const isCustomChapter = String(reunion.id).startsWith('custom-');
  if (onDeleteItem && isCustomChapter) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'reunion-card-delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete ${reunion.title}`);
    deleteBtn.title = 'Delete chapter';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDeleteItem(reunion);
    });
    headerActions.appendChild(deleteBtn);
  }

  header.appendChild(titleGroup);
  header.appendChild(headerActions);
  card.appendChild(header);

  if (Array.isArray(reunion.legs) && reunion.legs.length > 0) {
    const stepper = document.createElement('div');
    stepper.className = 'reunion-leg-stepper';

    reunion.legs.forEach((leg, idx) => {
      const country = getCountryInfo(leg.countryCode);
      const status = resolveLegTimelineStatus(leg, idx, reunion.legs, boardState.nowMs, activeLegId);

      const legItem = document.createElement('div');
      legItem.className = `reunion-leg-item${status === 'active' ? ' is-active' : ''}${status === 'past' ? ' is-past' : ''}`;
      legItem.dataset.status = status;

      const legMain = document.createElement('div');
      legMain.className = 'reunion-leg-main';

      const flagSpan = document.createElement('span');
      flagSpan.className = 'reunion-leg-flag';
      flagSpan.textContent = country.flag;

      const infoCol = document.createElement('div');
      infoCol.className = 'reunion-leg-info';

      const countryNameEl = document.createElement('div');
      countryNameEl.className = 'reunion-leg-country';
      countryNameEl.textContent = leg.label || country.name;

      infoCol.appendChild(countryNameEl);

      if (leg.notes) {
        const notesEl = document.createElement('div');
        notesEl.className = 'reunion-leg-notes';
        notesEl.setAttribute('dir', 'auto');
        notesEl.textContent = leg.notes;
        infoCol.appendChild(notesEl);
      }

      legMain.appendChild(flagSpan);
      legMain.appendChild(infoCol);

      const datesBadge = document.createElement('span');
      datesBadge.className = 'reunion-leg-dates numeric-lock';
      datesBadge.setAttribute('dir', 'ltr');
      datesBadge.textContent = `${formatShortDisplayDate(leg.startDate)} – ${formatShortDisplayDate(leg.endDate)}`;

      legItem.appendChild(legMain);
      legItem.appendChild(datesBadge);
      stepper.appendChild(legItem);
    });

    card.appendChild(stepper);
  }

  return card;
}

/**
 * Renders a list of chronological items along the sleek unified timeline track.
 * @param {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} items
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @param {HTMLElement} targetContainer
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onEditItem]
 * @param {((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null} [onDeleteItem]
 */
function renderChronologicalSequence(items, boardState, targetContainer, onEditItem = null, onDeleteItem = null) {
  targetContainer.innerHTML = '';

  items.forEach((item) => {
    if (isReunionChapter(item)) {
      targetContainer.appendChild(createReunionCardElement(item, boardState, onEditItem, onDeleteItem));
    } else {
      targetContainer.appendChild(createMilestoneRowElement(item, boardState, onEditItem, onDeleteItem));
    }
  });
}

/**
 * Controller that manages and renders the Split-and-Merge Timeline and Past Chapters Drawer.
 */
export class TimelineRenderer {
  /**
   * @param {{
   *   statsPillEl: HTMLElement | null,
   *   pastToggleBtn: HTMLButtonElement | null,
   *   pastDrawerEl: HTMLElement | null,
   *   upcomingTrackEl: HTMLElement | null,
   *   onEditItem?: ((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null,
   *   onDeleteItem?: ((item: import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter) => void) | null
   * }} elements
   */
  constructor(elements) {
    this.statsPillEl = elements.statsPillEl;
    this.pastToggleBtn = elements.pastToggleBtn;
    this.pastDrawerEl = elements.pastDrawerEl;
    this.upcomingTrackEl = elements.upcomingTrackEl;
    this.onEditItem = elements.onEditItem || null;
    this.onDeleteItem = elements.onDeleteItem || null;
    this.isPastDrawerOpen = false;

    if (this.pastToggleBtn && this.pastDrawerEl) {
      this.pastToggleBtn.addEventListener('click', () => {
        this.isPastDrawerOpen = !this.isPastDrawerOpen;
        this.syncPastDrawerVisibility();
      });
    }
  }

  syncPastDrawerVisibility() {
    if (!this.pastToggleBtn || !this.pastDrawerEl) return;
    this.pastToggleBtn.setAttribute('aria-expanded', String(this.isPastDrawerOpen));
    this.pastToggleBtn.classList.toggle('is-open', this.isPastDrawerOpen);
    this.pastDrawerEl.hidden = !this.isPastDrawerOpen;
  }

  /**
   * Empties all rendered timeline nodes and resets state on device lock.
   */
  clear() {
    this.isPastDrawerOpen = false;
    if (this.statsPillEl) this.statsPillEl.textContent = '';
    if (this.pastToggleBtn) {
      this.pastToggleBtn.hidden = true;
      this.pastToggleBtn.textContent = '';
    }
    if (this.pastDrawerEl) {
      this.pastDrawerEl.hidden = true;
      this.pastDrawerEl.innerHTML = '';
    }
    if (this.upcomingTrackEl) {
      this.upcomingTrackEl.innerHTML = '';
    }
  }

  /**
   * Renders the timeline section for the given EvaluatedBoardState.
   * @param {import('./config.js').EvaluatedBoardState} boardState
   */
  render(boardState) {
    const { plannedTripDaysTogether, completedTripDaysTogether, pastItems, upcomingItems } = boardState.timeline;

    if (this.statsPillEl) {
      const completedSuffix = completedTripDaysTogether > 0
        ? ` • ${completedTripDaysTogether} Completed`
        : '';
      this.statsPillEl.innerHTML = `🌏 <span class="numeric-lock" dir="ltr">${plannedTripDaysTogether} Trip Days Together Planned${completedSuffix}</span>`;
    }

    if (this.pastToggleBtn && this.pastDrawerEl) {
      if (pastItems.length === 0) {
        this.pastToggleBtn.hidden = true;
        this.pastDrawerEl.hidden = true;
      } else {
        this.pastToggleBtn.hidden = false;
        const arrow = this.isPastDrawerOpen ? '▴' : '▾';
        this.pastToggleBtn.innerHTML = `Completed Chapters (<span class="numeric-lock" dir="ltr">${pastItems.length}</span>) ${arrow}`;
        this.syncPastDrawerVisibility();
        renderChronologicalSequence(pastItems, boardState, this.pastDrawerEl, this.onEditItem, this.onDeleteItem);
      }
    }

    if (this.upcomingTrackEl) {
      renderChronologicalSequence(upcomingItems, boardState, this.upcomingTrackEl, this.onEditItem, this.onDeleteItem);
    }
  }
}
