# Investigation & Design Report: Calendar Date Badge Extraction (`js/photo-badge.js`)

## 1. Observation

### Current Implementation in `js/photo-stack.js`
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
  - Renders 4 distinct branches:
    1. Standard date range (e.g. `"31-12-2026 – 10-01-2027"`): returns a `.photo-date-range-container` containing start `.photo-date-pages`, `.date-page-range-sep`, and end `.photo-date-pages`.
    2. Non-standard date range fallback (e.g. `"Chapter 01 – Chapter 02"`): returns a `.photo-date-range-container` containing start `.photo-date-pill` (or `.timeline-date-pill`), `.date-page-range-sep`, and end pill.
    3. Non-calendar single fallback label (e.g. `"Chapter 01"`): returns single `.photo-date-pill.numeric-lock` (or `.timeline-date-pill.numeric-lock`).
    4. Standard single date (e.g. `"05-10-2026"`): returns `.photo-date-pages.numeric-lock` containing 3 child `.date-page` elements (`.date-page-day`, `.date-page-month`, `.date-page-year`).
- **Line 831**: Used inside `PhotoStackController.prototype.mountPhotoCards`:
  `overlay.appendChild(createPhotoDateElement(photo.dateLabel));`

### Existing Tests in `tests/integration.test.mjs`
- **Line 10**: Imports `createPhotoDateElement` directly from `../js/photo-stack.js`.
- **Lines 276–333**: Test case `Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages`:
  - Directly tests `createPhotoDateElement('05-10-2026')` expecting:
    - `pagesEl.className === 'photo-date-pages numeric-lock'`
    - `pagesEl.children.length === 3`
    - `pagesEl.children[0].className === 'date-page date-page-day'`, text `'05'`
    - `pagesEl.children[1].className === 'date-page date-page-month'`, text `'10'`
    - `pagesEl.children[2].className === 'date-page date-page-year'`, text `'2026'`
  - Tests fallback `createPhotoDateElement('Chapter 01')` expecting:
    - `pillEl.className === 'photo-date-pill numeric-lock'`
    - `pillEl.textContent === 'Chapter 01'`
  - Tests compact mode `createPhotoDateElement('15-12-2026', { isCompact: true })` expecting:
    - `compactPages.className.includes('date-pages-compact')`
  - Tests range support `createPhotoDateElement('31-12-2026 – 10-01-2027', { isCompact: true })` expecting:
    - `rangePages.className.includes('photo-date-range-container')`
    - `rangePages.children.length === 3`
    - Start pill child has `.photo-date-pages.date-pages-compact`
    - Separator child has text `'–'`
    - End pill child has `.photo-date-pages.date-pages-compact`

### Other Usages in the Codebase
- `js/app.js` (lines 22, 1447, 1682): Used in `eventModalDatePill` and `countdownTargetDate`.
- `js/timeline-renderer.js` (lines 9, 85, 210, 300): Used in milestone cards, reunion chapter headers, and leg badges.

### Offline CLI Date Parsing
- `scripts/encrypt-vault.mjs` (lines 292–345): Exports `extractDateLabel(filename, filePath)` which runs during Node offline encryption to parse raw image filenames into `DD-MM-YYYY`. This is tested in `tests/crypto-vault.test.mjs` (lines 279–291). It is an offline Node script and not part of browser runtime modules.

### Discrepancy Analysis
- **Query in dispatch**: The dispatch prompt queried `.photo-card-date-badge`, `.photo-card-date-day`, `.photo-card-date-month`, `.photo-card-date-year`, calendar icons, and month names.
- **Fact**: `grep_search` confirmed zero instances of `photo-card-date` in the repository. The production CSS in `styles/photo-stack.css` (lines 169–277) and tests in `tests/integration.test.mjs` strictly use `.photo-date-pages`, `.date-page`, `.date-page-day`, `.date-page-month`, `.date-page-year`, `.date-page-value`, `.date-page-range-sep`, `.photo-date-range-container`, `.photo-date-pill`, and `.timeline-date-pill`. Slashes (`/`) are styled via CSS pseudo-element `.date-page:not(:last-child)::after`. No SVG calendar icon is used.

---

## 2. Logic Chain

1. **Self-Containment & Zero External Imports**: `parseDateParts` and `createPhotoDateElement` in `js/photo-stack.js` do not import or call any external modules. They rely solely on native JavaScript string parsing and native DOM creation (`document.createElement`, `setAttribute`, `appendChild`). They can be cleanly extracted into `js/photo-badge.js` without bringing in any dependencies.
2. **Preservation of DOM Hierarchy & Selectors**: Because `tests/integration.test.mjs` (lines 295–329) and `styles/photo-stack.css` (lines 169–311) assert and style the exact class names (`photo-date-pages`, `date-page`, etc.), modifying any class name would cause immediate test failures and visual regressions. The extracted `js/photo-badge.js` must produce the exact same DOM hierarchy.
3. **Enforcement of Invariants (Bidirectional Numeric Lock)**: AGENTS.md mandates:
   > "All elements displaying dates, countdown numerals, clocks, or timezone offsets must apply `dir=\"ltr\"`, `unicode-bidi: isolate`, and `font-variant-numeric: tabular-nums` (`.numeric-lock`) to prevent bidirectional inversion."
   Every root element returned by `createPhotoDateElement` sets `dir="ltr"` via `setAttribute('dir', 'ltr')` and includes `numeric-lock` in `className`. Child numbers in `.date-page-value` apply `font-variant-numeric: tabular-nums` via CSS. This invariant is 100% preserved.
4. **Backward Compatibility via Barrel Re-Exports**: In accordance with `PROJECT.md` line 125, `js/photo-stack.js` must re-export `parseDateParts` and `createPhotoDateElement` from `./photo-badge.js`. This guarantees that existing test imports (`import { createPhotoDateElement } from '../js/photo-stack.js'`) and existing consumers (`js/app.js`, `js/timeline-renderer.js`) remain 100% operational with zero breaking changes.
5. **Code Quality & DRY Improvement**: In the current implementation, constructing the 3 calendar page elements (`day`, `month`, `year`) is repeated identically for single dates and each side of a date range. Extracting an internal helper `buildPagesPill(parts, isCompact, isStandalone)` within `js/photo-badge.js` eliminates 30 lines of duplicate DOM assembly while maintaining byte-for-byte identical output.

---

## 3. Caveats

- **Mock DOM Environment**: In Node.js testing (`tests/integration.test.mjs`), `document` is a minimal mock supporting `createElement`, `className`, `textContent`, `children`, `setAttribute`, and `appendChild`. Do not use `classList.add()` or `replaceChildren()` inside `js/photo-badge.js` as those methods may not be present on mock elements in unit tests.
- **Node CLI Separation**: `extractDateLabel` in `scripts/encrypt-vault.mjs` uses `node:path` and `node:fs` for offline asset preparation. It must remain in `scripts/encrypt-vault.mjs` and must NOT be added to `js/photo-badge.js`.
- **Read-Only Scope**: This report is purely analytical and architectural design. No source code has been modified during this investigation.

---

## 4. Conclusion & Proposed Specification

### Proposed Module: `js/photo-badge.js`

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
 * Internal helper to construct a day/month/year calendar page pill.
 * @param {{ day: string, month: string, year: string }} parts
 * @param {boolean} isCompact
 * @param {boolean} isStandalone
 * @returns {HTMLElement}
 */
function buildPagesPill(parts, isCompact, isStandalone = false) {
  const container = document.createElement('div');
  container.className = `${isCompact ? 'photo-date-pages date-pages-compact' : 'photo-date-pages'}${isStandalone ? ' numeric-lock' : ''}`;
  if (isStandalone) {
    container.setAttribute('dir', 'ltr');
    container.setAttribute('aria-label', `Date: ${parts.day}-${parts.month}-${parts.year}`);
  }

  const units = [
    { val: parts.day, cls: 'date-page-day' },
    { val: parts.month, cls: 'date-page-month' },
    { val: parts.year, cls: 'date-page-year' }
  ];

  for (const unit of units) {
    const page = document.createElement('div');
    page.className = `date-page ${unit.cls}`;
    const value = document.createElement('span');
    value.className = 'date-page-value';
    value.textContent = unit.val;
    page.appendChild(value);
    container.appendChild(page);
  }

  return container;
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

      const startPill = buildPagesPill(startParts, isCompact, false);

      const sep = document.createElement('span');
      sep.className = 'date-page-range-sep';
      sep.textContent = '–';

      const endPill = buildPagesPill(endParts, isCompact, false);

      rangeContainer.appendChild(startPill);
      rangeContainer.appendChild(sep);
      rangeContainer.appendChild(endPill);

      return rangeContainer;
    }
  }

  const singleParts = parseDateParts(dateLabel);
  if (!singleParts) {
    if (rangeSplit && rangeSplit.length === 2) {
      const rangeContainer = document.createElement('div');
      rangeContainer.className = `photo-date-range-container${isCompact ? ' is-compact' : ''} numeric-lock`;
      rangeContainer.setAttribute('dir', 'ltr');

      const startPill = document.createElement('div');
      startPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      startPill.textContent = rangeSplit[0];

      const sep = document.createElement('span');
      sep.className = 'date-page-range-sep';
      sep.textContent = '–';

      const endPill = document.createElement('div');
      endPill.className = isCompact ? 'timeline-date-pill' : 'photo-date-pill';
      endPill.textContent = rangeSplit[1];

      rangeContainer.appendChild(startPill);
      rangeContainer.appendChild(sep);
      rangeContainer.appendChild(endPill);
      return rangeContainer;
    }

    const singlePill = document.createElement('div');
    singlePill.className = `${isCompact ? 'timeline-date-pill' : 'photo-date-pill'} numeric-lock`;
    singlePill.setAttribute('dir', 'ltr');
    singlePill.textContent = dateLabel;
    return singlePill;
  }

  return buildPagesPill(singleParts, isCompact, true);
}
```

### Proposed Changes to `js/photo-stack.js`
1. Add import:
   ```javascript
   import { parseDateParts, createPhotoDateElement } from './photo-badge.js';
   ```
2. Re-export at bottom or top of file:
   ```javascript
   export { parseDateParts, createPhotoDateElement } from './photo-badge.js';
   ```
3. Remove lines 492–642 (original implementations of `parseDateParts` and `createPhotoDateElement`).

---

## 5. Verification Method

1. **Automated Unit & Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   - Test 23 (`Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages`) exercises single date splitting, fallback pill generation, compact mode, and date range assembly.
   - Test 18 (`Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping`) exercises photo stack card mounting.
   - Test 19 (`Integration: Timeline items partition cleanly and identify ReunionChapters vs MilestoneEvents`) exercises timeline date element creation.
   - Test 20 (`Security Audit: Zero personal names, itinerary dates, or token.txt exist in public HTML/JS/CSS/Docs`) verifies no leaks.
2. **Interface Verification**:
   - Check that `js/photo-badge.js` has zero `import` statements.
   - Check that `js/photo-badge.js` exports exactly `parseDateParts` and `createPhotoDateElement`.
   - Check that `js/photo-stack.js` re-exports both functions.
3. **Invalidation Conditions**:
   - Any test failure in `node --test tests/*.test.mjs`.
   - Any change to CSS classes (`.photo-date-pages`, `.date-page`, etc.) that would break `styles/photo-stack.css` styling.
   - Missing `dir="ltr"` or `.numeric-lock` on any returned container element.
