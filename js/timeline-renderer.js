import { getCountryInfo } from './config.js';
import {
  formatDisplayDate,
  formatShortDisplayDate,
  getEndOfDayInTimeZoneMs,
  getReunionDurationDays,
  getStartOfDayInTimeZoneMs
} from './countdown-engine.js';

/**
 * Checks whether a timeline item is a ReunionChapter (has legs array) vs a MilestoneEvent.
 * @param {import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter} item
 * @returns {item is import('./config.js').ReunionChapter}
 */
export function isReunionChapter(item) {
  return Boolean(item && Array.isArray(/** @type {any} */ (item).legs));
}

/**
 * Creates an SVG cubic-bezier split or merge connector between the parallel rails (25% / 75%) and merged center (50%).
 * @param {'merge'|'split'} direction
 * @returns {SVGSVGElement}
 */
function createRailConnectorSvg(direction) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'timeline-svg-connector');
  svg.setAttribute('viewBox', '0 0 400 44');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const primaryPath = document.createElementNS(svgNs, 'path');
  primaryPath.setAttribute('class', 'connector-path-primary');

  const secondaryPath = document.createElementNS(svgNs, 'path');
  secondaryPath.setAttribute('class', 'connector-path-secondary');

  const centerDot = document.createElementNS(svgNs, 'circle');
  centerDot.setAttribute('class', 'connector-node-dot');
  centerDot.setAttribute('cx', '200');
  centerDot.setAttribute('r', '5');

  if (direction === 'merge') {
    primaryPath.setAttribute('d', 'M 100 0 C 100 24, 200 20, 200 40');
    secondaryPath.setAttribute('d', 'M 300 0 C 300 24, 200 20, 200 40');
    centerDot.setAttribute('cy', '39');
  } else {
    primaryPath.setAttribute('d', 'M 200 4 C 200 24, 100 20, 100 44');
    secondaryPath.setAttribute('d', 'M 200 4 C 200 24, 300 20, 300 44');
    centerDot.setAttribute('cy', '5');
  }

  svg.appendChild(primaryPath);
  svg.appendChild(secondaryPath);
  svg.appendChild(centerDot);
  return svg;
}

/**
 * Resolves the slot ('primary' | 'secondary' | 'both') and display label for a milestone's `person` field.
 * @param {string} personKey
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @returns {{ slot: 'primary'|'secondary'|'both', label: string }}
 */
function resolveMilestonePersonMeta(personKey, boardState) {
  const primary = boardState.dualStatus?.primary;
  const secondary = boardState.dualStatus?.secondary;

  if (primary && (personKey === primary.person || personKey === 'primary')) {
    return { slot: 'primary', label: primary.displayName };
  }
  if (secondary && (personKey === secondary.person || personKey === 'secondary')) {
    return { slot: 'secondary', label: secondary.displayName };
  }
  return { slot: 'both', label: 'Together' };
}

/**
 * Renders a single MilestoneEvent card anchored to Primary, Secondary, or Both.
 * @param {import('./config.js').MilestoneEvent} milestone
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @returns {HTMLElement}
 */
function createMilestoneRowElement(milestone, boardState) {
  const { slot, label } = resolveMilestonePersonMeta(milestone.person || 'both', boardState);
  const row = document.createElement('div');
  row.className = 'milestone-row';
  row.dataset.person = slot;

  const card = document.createElement('article');
  card.className = 'milestone-card';
  card.dataset.person = slot;
  card.dataset.category = milestone.category || 'custom';

  const emojiBadge = document.createElement('div');
  emojiBadge.className = 'milestone-emoji-badge';
  emojiBadge.textContent = milestone.emoji || '✨';

  const body = document.createElement('div');
  body.className = 'milestone-body';

  const metaRow = document.createElement('div');
  metaRow.className = 'milestone-meta-row';

  const dateSpan = document.createElement('span');
  dateSpan.className = 'milestone-date numeric-lock';
  dateSpan.setAttribute('dir', 'ltr');
  dateSpan.textContent = formatDisplayDate(milestone.date);

  const personTag = document.createElement('span');
  personTag.className = 'milestone-person-tag';
  const countryInfo = milestone.countryCode ? getCountryInfo(milestone.countryCode) : null;
  const flagSuffix = countryInfo ? ` ${countryInfo.flag}` : '';
  personTag.textContent = `${label}${flagSuffix}`;

  metaRow.appendChild(dateSpan);
  metaRow.appendChild(personTag);

  const titleEl = document.createElement('h4');
  titleEl.className = 'milestone-title';
  titleEl.setAttribute('dir', 'auto');
  titleEl.textContent = milestone.title;

  const detailsEl = document.createElement('p');
  detailsEl.className = 'milestone-details';
  detailsEl.setAttribute('dir', 'auto');
  detailsEl.textContent = milestone.details || '';

  body.appendChild(metaRow);
  body.appendChild(titleEl);
  if (milestone.details) {
    body.appendChild(detailsEl);
  }

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
 * @returns {HTMLElement}
 */
function createReunionCardElement(reunion, boardState) {
  const isActiveReunion = boardState.activeReunion?.reunion.id === reunion.id;
  const activeLegId = isActiveReunion ? boardState.activeReunion?.activeLeg.id ?? null : null;

  const card = document.createElement('article');
  card.className = `reunion-chapter-card${isActiveReunion ? ' is-active' : ''}`;
  card.dataset.reunionId = reunion.id;

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

  header.appendChild(titleGroup);
  header.appendChild(durationPill);
  card.appendChild(header);

  if (reunion.description) {
    const descEl = document.createElement('p');
    descEl.className = 'reunion-description';
    descEl.setAttribute('dir', 'auto');
    descEl.textContent = reunion.description;
    card.appendChild(descEl);
  }

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
 * Renders a list of chronological items into split parallel segments and merged reunion cards.
 * @param {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} items
 * @param {import('./config.js').EvaluatedBoardState} boardState
 * @param {HTMLElement} targetContainer
 * @param {{ includeSvgConnectors?: boolean }} [options]
 */
function renderChronologicalSequence(items, boardState, targetContainer, options = { includeSvgConnectors: true }) {
  targetContainer.innerHTML = '';
  const includeSvg = options.includeSvgConnectors ?? true;

  let currentSplitSegment = null;

  items.forEach((item, index) => {
    if (isReunionChapter(item)) {
      if (currentSplitSegment && includeSvg) {
        targetContainer.appendChild(createRailConnectorSvg('merge'));
      }
      currentSplitSegment = null;

      const reunionCard = createReunionCardElement(item, boardState);
      targetContainer.appendChild(reunionCard);

      const hasMoreItems = index < items.length - 1;
      if (hasMoreItems && includeSvg) {
        targetContainer.appendChild(createRailConnectorSvg('split'));
      }
    } else {
      if (!currentSplitSegment) {
        currentSplitSegment = document.createElement('div');
        currentSplitSegment.className = 'timeline-split-segment';
        targetContainer.appendChild(currentSplitSegment);
      }
      currentSplitSegment.appendChild(createMilestoneRowElement(item, boardState));
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
   *   upcomingTrackEl: HTMLElement | null
   * }} elements
   */
  constructor(elements) {
    this.statsPillEl = elements.statsPillEl;
    this.pastToggleBtn = elements.pastToggleBtn;
    this.pastDrawerEl = elements.pastDrawerEl;
    this.upcomingTrackEl = elements.upcomingTrackEl;
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
        renderChronologicalSequence(pastItems, boardState, this.pastDrawerEl, { includeSvgConnectors: false });
      }
    }

    if (this.upcomingTrackEl) {
      renderChronologicalSequence(upcomingItems, boardState, this.upcomingTrackEl, { includeSvgConnectors: true });
    }
  }
}
