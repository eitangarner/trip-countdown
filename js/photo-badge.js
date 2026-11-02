export function parseDateParts(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const trimmedString = dateString.trim();
  const dmyMatch = trimmedString.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  const ymdMatch = trimmedString.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (dmyMatch) {
    const rawYear = dmyMatch[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return {
      day: dmyMatch[1].padStart(2, '0'),
      month: dmyMatch[2].padStart(2, '0'),
      year
    };
  }
  if (ymdMatch) {
    return {
      day: ymdMatch[3].padStart(2, '0'),
      month: ymdMatch[2].padStart(2, '0'),
      year: ymdMatch[1]
    };
  }
  return null;
}

function buildCalendarPagePill(dateParts, isCompact, isStandalone = false) {
  const calendarPageContainer = document.createElement('div');
  calendarPageContainer.className = `${isCompact ? 'photo-date-pages date-pages-compact' : 'photo-date-pages'}${isStandalone ? ' numeric-lock' : ''}`;
  if (isStandalone) {
    calendarPageContainer.setAttribute('dir', 'ltr');
    calendarPageContainer.setAttribute('aria-label', `Date: ${dateParts.day}-${dateParts.month}-${dateParts.year}`);
  }

  const calendarUnits = [
    { calendarValue: dateParts.day, calendarUnitClass: 'date-page-day' },
    { calendarValue: dateParts.month, calendarUnitClass: 'date-page-month' },
    { calendarValue: dateParts.year, calendarUnitClass: 'date-page-year' }
  ];

  for (const { calendarValue, calendarUnitClass } of calendarUnits) {
    const calendarPageEl = document.createElement('div');
    calendarPageEl.className = `date-page ${calendarUnitClass}`;
    const pageValueSpan = document.createElement('span');
    pageValueSpan.className = 'date-page-value';
    pageValueSpan.textContent = calendarValue;
    calendarPageEl.appendChild(pageValueSpan);
    calendarPageContainer.appendChild(calendarPageEl);
  }

  return calendarPageContainer;
}

export function createPhotoDateElement(dateLabel, { isCompact = false } = {}) {
  if (typeof document === 'undefined') return null;

  const rangeSegments = typeof dateLabel === 'string' ? dateLabel.split(/\s+[–—]\s+/) : null;
  if (rangeSegments && rangeSegments.length === 2) {
    const startParts = parseDateParts(rangeSegments[0]);
    const endParts = parseDateParts(rangeSegments[1]);
    if (startParts && endParts) {
      const rangeContainer = document.createElement('div');
      rangeContainer.className = `photo-date-range-container${isCompact ? ' is-compact' : ''} numeric-lock`;
      rangeContainer.setAttribute('dir', 'ltr');
      rangeContainer.setAttribute('aria-label', `Date: ${startParts.day}-${startParts.month}-${startParts.year} – ${endParts.day}-${endParts.month}-${endParts.year}`);

      const startPill = buildCalendarPagePill(startParts, isCompact, false);

      const rangeSeparator = document.createElement('span');
      rangeSeparator.className = 'date-page-range-sep';
      rangeSeparator.textContent = '–';

      const endPill = buildCalendarPagePill(endParts, isCompact, false);

      rangeContainer.appendChild(startPill);
      rangeContainer.appendChild(rangeSeparator);
      rangeContainer.appendChild(endPill);

      return rangeContainer;
    }
  }

  const singleParts = parseDateParts(dateLabel);
  if (!singleParts) {
    if (rangeSegments && rangeSegments.length === 2) {
      const fallbackRangeContainer = document.createElement('div');
      fallbackRangeContainer.className = `photo-date-range-container${isCompact ? ' is-compact' : ''} numeric-lock`;
      fallbackRangeContainer.setAttribute('dir', 'ltr');

      const startFallbackPill = document.createElement('div');
      startFallbackPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      startFallbackPill.textContent = rangeSegments[0];

      const rangeSeparator = document.createElement('span');
      rangeSeparator.className = 'date-page-range-sep';
      rangeSeparator.textContent = '–';

      const endFallbackPill = document.createElement('div');
      endFallbackPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      endFallbackPill.textContent = rangeSegments[1];

      fallbackRangeContainer.appendChild(startFallbackPill);
      fallbackRangeContainer.appendChild(rangeSeparator);
      fallbackRangeContainer.appendChild(endFallbackPill);
      return fallbackRangeContainer;
    }

    const singleFallbackPill = document.createElement('div');
    singleFallbackPill.className = `${isCompact ? 'timeline-date-pill' : 'photo-date-pill'} numeric-lock`;
    singleFallbackPill.setAttribute('dir', 'ltr');
    singleFallbackPill.textContent = dateLabel;
    return singleFallbackPill;
  }

  return buildCalendarPagePill(singleParts, isCompact, true);
}
