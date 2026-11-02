# Investigation & Design Report: Calendar Date Badge Extraction (`js/photo-badge.js`)

## 1. Observation

### Existing Implementation in `js/photo-stack.js`
- **Lines 492–514**: `parseDateParts(str)`:
  ```javascript
  function parseDateParts(str) {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
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
  ```
- **Lines 524–642**: `createPhotoDateElement(dateLabel, { isCompact = false } = {})`:
  - Implements 4 distinct rendering branches:
    1. **Standard Date Range** (e.g. `'31-12-2026 – 10-01-2027'`): Returns a `.photo-date-range-container` element containing a start `.photo-date-pages` pill, a `.date-page-range-sep` separator (`'–'`), and an end `.photo-date-pages` pill.
    2. **Non-Standard Date Range Fallback** (e.g. `'Chapter 01 – Chapter 02'`): Returns a `.photo-date-range-container` containing start `.photo-date-pill` (or `.timeline-date-pill` if `isCompact`), a `.date-page-range-sep` (`'–'`), and end pill.
    3. **Non-Calendar Single Fallback Label** (e.g. `'Chapter 01'`): Returns a single `.photo-date-pill.numeric-lock` (or `.timeline-date-pill.numeric-lock` if `isCompact`).
    4. **Standard Single Date** (e.g. `'05-10-2026'`): Returns `.photo-date-pages.numeric-lock` (with `.date-pages-compact` if `isCompact`) containing 3 child `.date-page` elements (`.date-page-day`, `.date-page-month`, `.date-page-year`), each containing a `.date-page-value` span.
- **Line 831**: Invoked inside `PhotoStackController.prototype.mountPhotoCards`:
  ```javascript
  if (photo.dateLabel) {
    overlay.appendChild(createPhotoDateElement(photo.dateLabel));
  }
  ```

### Existing Tests in `tests/integration.test.mjs`
- **Line 10**: Directly imports `createPhotoDateElement` from `../js/photo-stack.js`.
- **Lines 276–333**: Test case `'Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages'`:
  - Uses a mock DOM environment (`createElement`, `setAttribute`, `appendChild`).
  - Asserts that `createPhotoDateElement('05-10-2026')`:
    - `pagesEl.className === 'photo-date-pages numeric-lock'`
    - `pagesEl.children.length === 3`
    - `pagesEl.children[0].className === 'date-page date-page-day'`, value text `'05'`
    - `pagesEl.children[1].className === 'date-page date-page-month'`, value text `'10'`
    - `pagesEl.children[2].className === 'date-page date-page-year'`, value text `'2026'`
  - Asserts fallback `createPhotoDateElement('Chapter 01')`:
    - `pillEl.className === 'photo-date-pill numeric-lock'`
    - `pillEl.textContent === 'Chapter 01'`
  - Asserts compact mode `createPhotoDateElement('15-12-2026', { isCompact: true })`:
    - `compactPages.className.includes('date-pages-compact')`
  - Asserts range support `createPhotoDateElement('31-12-2026 – 10-01-2027', { isCompact: true })`:
    - `rangePages.className.includes('photo-date-range-container')`
    - `rangePages.children.length === 3`
    - `rangePages.children[0]` has classes `.photo-date-pages.date-pages-compact`
    - `rangePages.children[1].textContent === '–'`
    - `rangePages.children[2]` has classes `.photo-date-pages.date-pages-compact`

### Other Usages in the Codebase
- `js/app.js`:
  - Line 22: `import { PhotoStackController, createPhotoDateElement } from './photo-stack.js';`
  - Line 1447: `this.dom.eventModalDatePill.replaceChildren(createPhotoDateElement(datePillText, { isCompact: true }));`
  - Line 1682: `this.dom.countdownTargetDate.replaceChildren(createPhotoDateElement(cd.targetDate, { isCompact: true }));`
- `js/timeline-renderer.js`:
  - Line 9: `import { createPhotoDateElement } from './photo-stack.js';`
  - Line 85: `const datePages = createPhotoDateElement(milestone.date, { isCompact: true });`
  - Line 210: `const dateRangeEl = createPhotoDateElement(`${formatDisplayDate(reunion.startDate)} – ${formatDisplayDate(reunion.endDate)}`, { isCompact: true });`
  - Line 300: `const datesBadge = createPhotoDateElement(`${formatDisplayDate(leg.startDate)} – ${formatDisplayDate(leg.endDate)}`, { isCompact: true });`

### CSS Class Inventory & Stylesheet Matching
- `styles/base.css` (lines 144–149):
  - `.numeric-lock { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; display: inline-block; }`
- `styles/photo-stack.css` (lines 169–311):
  - `.photo-date-pages`: Frosted glass container (`padding-block: 4px`, `padding-inline: 11px`, `border-radius: var(--radius-pill)`, `backdrop-filter: blur(20px)`).
  - `.date-pages-compact`: Smaller padding and lighter background for timeline/modal cards.
  - `.date-page`: Inline-flex container for day, month, year.
  - `.date-page:not(:last-child)::after`: Generates `"/"` separator in CSS without requiring extra DOM elements.
  - `.date-page-value`: Styled with `font-variant-numeric: tabular-nums`, `font-size: 0.78rem`, `font-weight: 650`.
  - `.date-page-range-sep`: Separator `'–'` between range pills (`font-size: 0.70rem`, `font-weight: 600`).
  - `.photo-date-range-container`: Inline-flex container (`gap: 5px`, `vertical-align: middle`).
  - `.photo-date-range-container.is-compact`: Sets separator `font-size: 0.66rem`.
  - `.photo-date-pill`: Fallback non-date badge (`font-size: 0.78rem`, `font-weight: 650`).
  - `.timeline-date-pill`: Compact fallback non-date badge (`font-size: 0.70rem`, `font-weight: 600`).

---

## 2. Logic Chain

1. **Direct Decoupling via Zero Dependencies** (Observation 1 & 4):
   - Neither `parseDateParts` nor `createPhotoDateElement` depends on any external module or state machine.
   - They strictly perform string parsing and DOM construction using `document.createElement`, `setAttribute`, and `appendChild`.
   - Therefore, they can be extracted cleanly into `js/photo-badge.js` with zero imports.

2. **Preservation of Bidirectional Numeric Lock Invariants** (Observation 1, 2, & CSS Inventory):
   - `AGENTS.md` mandates that all formatted dates must enforce `dir="ltr"`, `unicode-bidi: isolate`, and `font-variant-numeric: tabular-nums` via `.numeric-lock`.
   - `createPhotoDateElement` applies `dir="ltr"` via `setAttribute('dir', 'ltr')` and appends `numeric-lock` to all root elements (`photo-date-pages`, `photo-date-range-container`, `photo-date-pill`, `timeline-date-pill`).
   - The CSS class `.numeric-lock` in `styles/base.css` and `.date-page-value` in `styles/photo-stack.css` enforce `direction: ltr`, `unicode-bidi: isolate`, and `font-variant-numeric: tabular-nums`.
   - This invariant is fully maintained.

3. **DOM Selector & Hierarchy Fidelity** (Observation 2 & CSS Inventory):
   - `tests/integration.test.mjs` directly checks exact classes: `.photo-date-pages`, `.date-pages-compact`, `.numeric-lock`, `.date-page`, `.date-page-day`, `.date-page-month`, `.date-page-year`, `.date-page-value`, `.date-page-range-sep`, `.photo-date-range-container`, `.photo-date-pill`.
   - `styles/photo-stack.css` styles each of these classes specifically, including pseudo-element slash separators (`.date-page:not(:last-child)::after`).
   - Modifying any tag, attribute, or class name would break either existing tests or CSS layout. The extracted component preserves the exact DOM hierarchy.

4. **100% Backward Compatibility via Barrel Re-Exports** (Observation 2, 3, & PROJECT.md):
   - Multiple consumers (`tests/integration.test.mjs`, `js/app.js`, `js/timeline-renderer.js`, `PhotoStackController`) import `createPhotoDateElement` from `./photo-stack.js`.
   - By adding `export { parseDateParts, createPhotoDateElement } from './photo-badge.js';` in `js/photo-stack.js`, all existing consumers continue to function without any changes.

5. **DRY Optimization with Anti-Boilerplate Compliance** (Observation 1):
   - In `js/photo-stack.js`, assembling the 3-unit calendar page elements (`day`, `month`, `year`) is repeated 3 separate times (for start pill in range, end pill in range, and single date).
   - Consolidating this into a domain-specific internal helper `buildCalendarPagePill(dateParts, isCompact, isStandalone)` eliminates 30 lines of boilerplate while maintaining 100% selector fidelity and adherence to Rule 5 of `AGENTS.md` (no generic names like `item`, `data`, `obj`, `temp`).

---

## 3. Caveats

1. **Mock DOM Compatibility in Unit Tests**:
   - `tests/integration.test.mjs` mocks `document.createElement` with an object containing only `{ tag, className, textContent, children, attrs, setAttribute, appendChild }`.
   - It does NOT mock `classList` or `replaceChildren`.
   - In `js/photo-badge.js`, all class manipulations must assign directly to `el.className` (e.g. `el.className = '...'`), not `el.classList.add(...)`, to prevent `TypeError: el.classList is undefined` in test runs.
2. **Offline CLI Date Parsing Separation**:
   - `scripts/encrypt-vault.mjs` contains `extractDateLabel(filename, filePath)` which runs offline in Node.js to format photo filenames into `DD-MM-YYYY`.
   - This function belongs to the Node offline CLI tooling and must NOT be imported into or mixed with `js/photo-badge.js`.
3. **PWA Shell Assets Synchronization (Milestone 5)**:
   - When `js/photo-badge.js` is created, it will need to be registered in `sw.js` under `APP_SHELL_ASSETS` and audited in `tests/integration.test.mjs` under `publicFilesToAudit` during Milestone 5.
4. **Read-Only Scope**:
   - As an explorer subagent, no files have been modified. This report delivers the exact production-ready specification for the implementer agent.

---

## 4. Conclusion & Concrete Specification

### 4.1 New Module: `js/photo-badge.js`
Exact file content to be created:

```javascript
/**
 * Calendar Page Date Badge & Range DOM Component.
 * Generates frosted matte-glass calendar sheet pills for photo deck overlays,
 * timeline milestone cards, and countdown modal displays.
 * Strictly enforces bidirectional numeric lock invariants (dir="ltr", .numeric-lock).
 */

/**
 * Parses a date string formatted as DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YY, or YYYY-MM-DD.
 * @param {string} str
 * @returns {{ day: string, month: string, year: string } | null}
 */
export function parseDateParts(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
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

/**
 * Builds a 3-page (day/month/year) calendar pill DOM element.
 * @param {{ day: string, month: string, year: string }} dateParts
 * @param {boolean} isCompact
 * @param {boolean} isStandalone
 * @returns {HTMLElement}
 */
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

/**
 * Creates an elegant calendar-sheet date badge with separate "pages" for day, month, and year.
 * Also supports date ranges (e.g. "31-12-2026 – 10-01-2027").
 * If dateLabel does not match a standard calendar date, returns a fallback single pill.
 * @param {string} dateLabel
 * @param {{ isCompact?: boolean }} [options]
 * @returns {HTMLElement}
 */
export function createPhotoDateElement(dateLabel, { isCompact = false } = {}) {
  const rangeSplit = typeof dateLabel === 'string' ? dateLabel.split(/\s+[–—]\s+/) : null;
  if (rangeSplit && rangeSplit.length === 2) {
    const startParts = parseDateParts(rangeSplit[0]);
    const endParts = parseDateParts(rangeSplit[1]);
    if (startParts && endParts) {
      const rangeContainer = document.createElement('div');
      rangeContainer.className = `photo-date-range-container${isCompact ? ' is-compact' : ''} numeric-lock`;
      rangeContainer.setAttribute('dir', 'ltr');
      rangeContainer.setAttribute('aria-label', `Date: ${startParts.day}-${startParts.month}-${startParts.year} – ${endParts.day}-${endParts.month}-${endParts.year}`);

      const startPill = buildCalendarPagePill(startParts, isCompact, false);

      const sep = document.createElement('span');
      sep.className = 'date-page-range-sep';
      sep.textContent = '–';

      const endPill = buildCalendarPagePill(endParts, isCompact, false);

      rangeContainer.appendChild(startPill);
      rangeContainer.appendChild(sep);
      rangeContainer.appendChild(endPill);

      return rangeContainer;
    }
  }

  const singleParts = parseDateParts(dateLabel);
  if (!singleParts) {
    if (rangeSplit && rangeSplit.length === 2) {
      const fallbackRangeContainer = document.createElement('div');
      fallbackRangeContainer.className = `photo-date-range-container${isCompact ? ' is-compact' : ''} numeric-lock`;
      fallbackRangeContainer.setAttribute('dir', 'ltr');

      const startFallbackPill = document.createElement('div');
      startFallbackPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      startFallbackPill.textContent = rangeSplit[0];

      const sep = document.createElement('span');
      sep.className = 'date-page-range-sep';
      sep.textContent = '–';

      const endFallbackPill = document.createElement('div');
      endFallbackPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      endFallbackPill.textContent = rangeSplit[1];

      fallbackRangeContainer.appendChild(startFallbackPill);
      fallbackRangeContainer.appendChild(sep);
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
```

### 4.2 Modifications to `js/photo-stack.js`
1. **Import and re-export in `js/photo-stack.js`**:
   ```javascript
   import { parseDateParts, createPhotoDateElement } from './photo-badge.js';
   export { parseDateParts, createPhotoDateElement } from './photo-badge.js';
   ```
2. **Remove extracted functions**:
   - Remove lines 492–642 (`parseDateParts` and `createPhotoDateElement`).
3. **Internal consumption**:
   - Line 831 (`overlay.appendChild(createPhotoDateElement(photo.dateLabel));`) uses the imported `createPhotoDateElement`.

---

## 5. Verification Method

### Automated Test Suite Execution
Execute the full test suite using Node's native test runner:
```bash
node --test tests/*.test.mjs
```

### Critical Test Verifications
1. **`Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages`** (`tests/integration.test.mjs` lines 276–333):
   - Verifies single calendar date page splitting (`'05-10-2026'`).
   - Verifies fallback non-date badge (`'Chapter 01'`).
   - Verifies compact mode (`isCompact: true`).
   - Verifies date range container with separator (`'31-12-2026 – 10-01-2027'`).
2. **`Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping`** (`tests/integration.test.mjs` lines 145–196):
   - Verifies `PhotoStackController` initialization and card overlay date badge mounting.
3. **`Integration: Timeline items partition cleanly and identify ReunionChapters vs MilestoneEvents`** (`tests/integration.test.mjs` lines 198–244):
   - Verifies timeline rendering with date badges.
4. **`Security Audit: Zero personal names, itinerary dates, or token.txt exist in public HTML/JS/CSS/Docs`** (`tests/integration.test.mjs` lines 246–274):
   - Verifies that `js/photo-badge.js` contains zero sensitive names, itinerary dates, or secrets.

### Invalidation Conditions
- Any test failure in `node --test tests/*.test.mjs`.
- Any missing attribute `dir="ltr"` or missing class `.numeric-lock` on date badge root containers.
- Any attempt to use `el.classList.add()` instead of `el.className` which breaks mock DOM in unit tests.
- Any change to CSS classes (`photo-date-pages`, `date-page`, etc.) that diverges from `styles/photo-stack.css`.
