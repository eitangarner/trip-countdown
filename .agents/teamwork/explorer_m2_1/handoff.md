# Handoff Report: Extraction of `js/date-utils.js` from `js/countdown-engine.js`

## 1. Observation

### 1.1 Source File Inspection: `js/countdown-engine.js` (Lines 1–207)
Direct line-by-line inspection of `/Users/eitangarner/Documents/Development/Projects/trip-countdown/js/countdown-engine.js` revealed the following exact primitives, constants, caches, and functions:

- **Line 1**: `import { COUNTRY_CATALOG, getCountryInfo } from './config.js';`
- **Lines 3–6**: Millisecond conversion constants:
  ```javascript
  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  ```
- **Lines 8–12**: Internal memoization caches:
  ```javascript
  /** @type {Map<string, Intl.DateTimeFormat>} */
  const FORMATTER_CACHE = new Map();

  /** @type {Map<string, number>} */
  const DAY_BOUNDARY_CACHE = new Map();
  ```
- **Lines 14–35**: Cached `Intl.DateTimeFormat` factory:
  ```javascript
  function getZonedFormatter(timeZone) {
    let formatter = FORMATTER_CACHE.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      });
      FORMATTER_CACHE.set(timeZone, formatter);
    }
    return formatter;
  }
  ```
- **Lines 37–45**: ISO Date string parser:
  ```javascript
  export function parseIsoDateParts(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  }
  ```
- **Lines 47–59**: Calendar day difference:
  ```javascript
  export function diffCalendarDays(startDateStr, endDateStr) {
    const start = parseIsoDateParts(startDateStr);
    const end = parseIsoDateParts(endDateStr);
    const startUtcMs = Date.UTC(start.year, start.month - 1, start.day);
    const endUtcMs = Date.UTC(end.year, end.month - 1, end.day);
    return Math.round((endUtcMs - startUtcMs) / MS_PER_DAY);
  }
  ```
- **Lines 61–69**: Days in month calculation (previously unexported):
  ```javascript
  function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  ```
- **Lines 71–118**: Timezone wall-clock extraction:
  ```javascript
  export function getZonedDateParts(epochMs, timeZone) {
    const parts = getZonedFormatter(timeZone).formatToParts(new Date(epochMs));
    const raw = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        raw[part.type] = part.value;
      }
    }

    const year = Number(raw.year);
    const month = Number(raw.month);
    const day = Number(raw.day);
    const hour = Number(raw.hour) % 24;
    const minute = Number(raw.minute);
    const second = Number(raw.second);

    const yearStr = String(year).padStart(4, '0');
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const minuteStr = String(minute).padStart(2, '0');

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dateStr: `${yearStr}-${monthStr}-${dayStr}`,
      timeStr: `${hourStr}:${minuteStr}`
    };
  }
  ```
- **Lines 120–131**: Signed UTC offset in minutes:
  ```javascript
  export function getUtcOffsetMinutes(epochMs, timeZone) {
    const { year, month, day, hour, minute, second } = getZonedDateParts(epochMs, timeZone);
    const zonedAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const truncatedEpochMs = Math.floor(epochMs / 1000) * 1000;
    return Math.round((zonedAsUtcMs - truncatedEpochMs) / MS_PER_MINUTE);
  }
  ```
- **Lines 133–151**: Two-pass DST-safe local wall-clock to epoch ms (previously unexported):
  ```javascript
  function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms) {
    const { year, month, day } = parseIsoDateParts(dateStr);
    const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const firstOffsetMin = getUtcOffsetMinutes(naiveUtcMs, timeZone);
    const firstGuessMs = naiveUtcMs - firstOffsetMin * MS_PER_MINUTE;
    const secondOffsetMin = getUtcOffsetMinutes(firstGuessMs, timeZone);
    return naiveUtcMs - secondOffsetMin * MS_PER_MINUTE;
  }
  ```
- **Lines 153–168**: Memoized start of day:
  ```javascript
  export function getStartOfDayInTimeZoneMs(dateStr, timeZone) {
    const cacheKey = `S|${dateStr}|${timeZone}`;
    const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const computed = getZonedWallClockEpochMs(dateStr, timeZone, 0, 0, 0, 0);
    DAY_BOUNDARY_CACHE.set(cacheKey, computed);
    return computed;
  }
  ```
- **Lines 170–185**: Memoized end of day:
  ```javascript
  export function getEndOfDayInTimeZoneMs(dateStr, timeZone) {
    const cacheKey = `E|${dateStr}|${timeZone}`;
    const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const computed = getZonedWallClockEpochMs(dateStr, timeZone, 23, 59, 59, 999);
    DAY_BOUNDARY_CACHE.set(cacheKey, computed);
    return computed;
  }
  ```
- **Lines 187–198**: Display date formatter:
  ```javascript
  export function formatDisplayDate(dateStr, options = false) {
    const shortYear = typeof options === 'boolean' ? options : Boolean(options?.shortYear);
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const formattedYear = shortYear ? yearStr.slice(-2) : yearStr;
    return `${dayStr}-${monthStr}-${formattedYear}`;
  }
  ```
- **Lines 200–207**: Short display date formatter:
  ```javascript
  export function formatShortDisplayDate(dateStr) {
    return formatDisplayDate(dateStr, true);
  }
  ```

### 1.2 Verification of Purity & Dependencies
- `grep_search` for `Date.now` in `js/countdown-engine.js`: Only 1 match on line 502 in JSDoc comment (`* Never invokes Date.now() internally.`). Exactly 0 runtime invocations of `Date.now()`.
- `grep_search` for `document`, `window`, `HTMLElement` in `js/countdown-engine.js`: 0 matches found.
- Lines 1–207 contain 0 imports from `./config.js`. `COUNTRY_CATALOG` and `getCountryInfo` are only used from line 209 onwards in `resolveCountry()`.
- `js/date-utils.js` has zero internal or external imports.

### 1.3 Test Suite Baseline
Execution of `node --test tests/*.test.mjs`:
```text
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 165.202542
```
All 25 tests pass.

### 1.4 Downstream Consumers of Date Primitives
- `tests/countdown-engine.test.mjs` (lines 4–13): Imports `getZonedDateParts`, `getStartOfDayInTimeZoneMs`, `getEndOfDayInTimeZoneMs`, `getUtcOffsetMinutes`, `formatDisplayDate`, `formatShortDisplayDate` from `../js/countdown-engine.js`.
- `js/app.js` (lines 13–21): Imports `formatDisplayDate`, `formatShortDisplayDate`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs`, `getZonedDateParts` from `./countdown-engine.js`.
- `js/timeline-renderer.js` (lines 2–8): Imports `formatDisplayDate`, `formatShortDisplayDate`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs` from `./countdown-engine.js`.
- `js/anniversaries.js` (to be extracted): Requires `diffCalendarDays`, `getDaysInMonth`, and `parseIsoDateParts`.
- `js/countdown-engine.js` (retained board engine): Requires `MS_PER_SECOND`, `diffCalendarDays`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs`, `getZonedDateParts`, `getUtcOffsetMinutes`.

---

## 2. Logic Chain

1. **Extraction Scope & Zero-Import Standalone Module**:
   - Observation 1.1 demonstrates that lines 3–207 of `countdown-engine.js` form a self-contained, cohesive mathematical package handling Gregorian calendar conversions, string formatting, and IANA timezone offsets.
   - Observation 1.2 proves that none of these functions depend on `COUNTRY_CATALOG`, `getCountryInfo`, DOM elements, or ambient browser APIs.
   - Therefore, extracting these items directly into `js/date-utils.js` creates a leaf module with zero imports (`import { ... }` count = 0), adhering strictly to ES2022 Native Modules.

2. **Function Export Decisions**:
   - In `countdown-engine.js`, `getDaysInMonth` (lines 67–69) and `getZonedWallClockEpochMs` (lines 144–151) were module-scoped functions without the `export` keyword.
   - Observation 1.4 shows `js/anniversaries.js` calls `getDaysInMonth` in two locations (`generateMonthlyAnniversaries` and `computeRelationshipDuration`).
   - `PROJECT.md` interface contracts explicitly require `getDaysInMonth` and `getZonedWallClockEpochMs` in `js/date-utils.js` exports.
   - Therefore, both functions must be exported (`export function getDaysInMonth...` and `export function getZonedWallClockEpochMs...`).

3. **Constant Export Decisions**:
   - Constants `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY` (lines 3–6) must be exported from `js/date-utils.js`.
   - `MS_PER_SECOND` is required by `countdown-engine.js`'s `decomposeRemainingMs` (line 390).
   - Exporting all 4 constants prevents repeating magic numbers (`1000`, `60000`, `3600000`, `86400000`) across other modules.

4. **Internal Cache Encapsulation**:
   - `FORMATTER_CACHE` and `DAY_BOUNDARY_CACHE` are module-level `Map` instances in `js/date-utils.js`.
   - `getZonedFormatter(timeZone)` is an internal helper for `getZonedDateParts`.
   - Because calendar days and IANA timezone rules are immutable for deterministic timestamps, keeping these caches encapsulated within `date-utils.js` prevents accidental external tampering while maximizing performance during 1Hz evaluation ticks.

5. **Purity & Time-Travel Determinism**:
   - Observation 1.2 confirms zero calls to `Date.now()`.
   - Functions converting time (`getZonedDateParts`, `getUtcOffsetMinutes`) accept explicit `epochMs`. Functions establishing day boundaries (`getStartOfDayInTimeZoneMs`, `getEndOfDayInTimeZoneMs`) accept explicit `dateStr` and `timeZone`.
   - This ensures 100% deterministic execution required for the Time-Travel Preview Slider and the `node --test` suite.

6. **Backward Compatibility via Barrel Re-Exports**:
   - Observation 1.4 confirms existing test suites and UI modules import date helpers directly from `countdown-engine.js`.
   - Adding barrel re-exports (`export { ... } from './date-utils.js'`) in `countdown-engine.js` allows every existing test and module to function without modifying existing import paths.

---

## 3. Caveats

1. **`addCalendarDays` in `js/app.js`**:
   - Lines 55–62 of `js/app.js` contain an internal utility `addCalendarDays(dateStr, daysToAdd)`. It is not part of `countdown-engine.js`.
   - Worker M2 should focus strictly on decoupling `countdown-engine.js`. However, `addCalendarDays` is a pure date helper that could optionally be added to `date-utils.js` or handled during Milestone 4 (App coordinator streamlining). To avoid scope creep in M2, Worker M2 should stick strictly to the 10 primitives and 4 constants specified in `PROJECT.md`.
2. **Day Boundary Cache Key Invariants**:
   - The cache key format `S|${dateStr}|${timeZone}` and `E|${dateStr}|${timeZone}` relies on valid `YYYY-MM-DD` strings. Upstream validation in `vault.json` and timeline input ensures this format.
3. **PWA Service Worker & Security Audit Scope**:
   - Adding `js/date-utils.js` to `sw.js` and `tests/integration.test.mjs` is formally assigned to Milestone 5. However, `js/date-utils.js` must be authored cleanly without personal names, dates, or secrets so any security audit run at any milestone passes cleanly.

---

## 4. Conclusion & Concrete Implementation Blueprint for Worker M2

### 4.1 Specification for `js/date-utils.js`
Worker M2 must create `/Users/eitangarner/Documents/Development/Projects/trip-countdown/js/date-utils.js` with the exact content structure below:

```javascript
/**
 * Millisecond unit constants for calendar and duration arithmetic.
 */
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** @type {Map<string, Intl.DateTimeFormat>} */
const FORMATTER_CACHE = new Map();

/** @type {Map<string, number>} */
const DAY_BOUNDARY_CACHE = new Map();

/**
 * Returns a cached Intl.DateTimeFormat instance for the given IANA timezone.
 * @param {string} timeZone
 * @returns {Intl.DateTimeFormat}
 */
function getZonedFormatter(timeZone) {
  let formatter = FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });
    FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Parses a "YYYY-MM-DD" string into numeric year, month (1-12), and day (1-31).
 * @param {string} dateStr
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseIsoDateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

/**
 * Computes whole calendar days between two "YYYY-MM-DD" strings (endDateStr - startDateStr).
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {number}
 */
export function diffCalendarDays(startDateStr, endDateStr) {
  const start = parseIsoDateParts(startDateStr);
  const end = parseIsoDateParts(endDateStr);
  const startUtcMs = Date.UTC(start.year, start.month - 1, start.day);
  const endUtcMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.round((endUtcMs - startUtcMs) / MS_PER_DAY);
}

/**
 * Returns the number of days in a specific year and 1-indexed month.
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Extracts timezone-accurate wall-clock components at epochMs in timeZone.
 * @param {number} epochMs
 * @param {string} timeZone
 * @returns {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   hour: number,
 *   minute: number,
 *   second: number,
 *   dateStr: string,
 *   timeStr: string
 * }}
 */
export function getZonedDateParts(epochMs, timeZone) {
  const parts = getZonedFormatter(timeZone).formatToParts(new Date(epochMs));
  const raw = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      raw[part.type] = part.value;
    }
  }

  const year = Number(raw.year);
  const month = Number(raw.month);
  const day = Number(raw.day);
  const hour = Number(raw.hour) % 24;
  const minute = Number(raw.minute);
  const second = Number(raw.second);

  const yearStr = String(year).padStart(4, '0');
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr: `${yearStr}-${monthStr}-${dayStr}`,
    timeStr: `${hourStr}:${minuteStr}`
  };
}

/**
 * Computes the exact UTC offset in minutes at epochMs for the given IANA timeZone.
 * @param {number} epochMs
 * @param {string} timeZone
 * @returns {number}
 */
export function getUtcOffsetMinutes(epochMs, timeZone) {
  const { year, month, day, hour, minute, second } = getZonedDateParts(epochMs, timeZone);
  const zonedAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const truncatedEpochMs = Math.floor(epochMs / 1000) * 1000;
  return Math.round((zonedAsUtcMs - truncatedEpochMs) / MS_PER_MINUTE);
}

/**
 * Converts a local wall-clock time on dateStr ("YYYY-MM-DD") in timeZone to exact epoch milliseconds.
 * Uses a two-pass offset calculation to handle DST transitions cleanly.
 * @param {string} dateStr
 * @param {string} timeZone
 * @param {number} hour
 * @param {number} minute
 * @param {number} second
 * @param {number} ms
 * @returns {number}
 */
export function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms) {
  const { year, month, day } = parseIsoDateParts(dateStr);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstOffsetMin = getUtcOffsetMinutes(naiveUtcMs, timeZone);
  const firstGuessMs = naiveUtcMs - firstOffsetMin * MS_PER_MINUTE;
  const secondOffsetMin = getUtcOffsetMinutes(firstGuessMs, timeZone);
  return naiveUtcMs - secondOffsetMin * MS_PER_MINUTE;
}

/**
 * Converts "YYYY-MM-DD" to the exact epoch milliseconds of 00:00:00.000 in timeZone (memoized).
 * @param {string} dateStr
 * @param {string} timeZone
 * @returns {number}
 */
export function getStartOfDayInTimeZoneMs(dateStr, timeZone) {
  const cacheKey = `S|${dateStr}|${timeZone}`;
  const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const computed = getZonedWallClockEpochMs(dateStr, timeZone, 0, 0, 0, 0);
  DAY_BOUNDARY_CACHE.set(cacheKey, computed);
  return computed;
}

/**
 * Converts "YYYY-MM-DD" to the exact epoch milliseconds of 23:59:59.999 in timeZone (memoized).
 * @param {string} dateStr
 * @param {string} timeZone
 * @returns {number}
 */
export function getEndOfDayInTimeZoneMs(dateStr, timeZone) {
  const cacheKey = `E|${dateStr}|${timeZone}`;
  const cached = DAY_BOUNDARY_CACHE.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const computed = getZonedWallClockEpochMs(dateStr, timeZone, 23, 59, 59, 999);
  DAY_BOUNDARY_CACHE.set(cacheKey, computed);
  return computed;
}

/**
 * Formats "YYYY-MM-DD" as "DD-MM-YYYY" (or "DD-MM-YY" when shortYear is true).
 * @param {string} dateStr
 * @param {boolean|{ shortYear?: boolean }} [options=false]
 * @returns {string}
 */
export function formatDisplayDate(dateStr, options = false) {
  const shortYear = typeof options === 'boolean' ? options : Boolean(options?.shortYear);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const formattedYear = shortYear ? yearStr.slice(-2) : yearStr;
  return `${dayStr}-${monthStr}-${formattedYear}`;
}

/**
 * Formats "YYYY-MM-DD" as "DD-MM-YY".
 * @param {string} dateStr
 * @returns {string}
 */
export function formatShortDisplayDate(dateStr) {
  return formatDisplayDate(dateStr, true);
}
```

### 4.2 Required Imports in Other M2 Modules
- In `js/anniversaries.js`:
  ```javascript
  import {
    diffCalendarDays,
    getDaysInMonth,
    parseIsoDateParts
  } from './date-utils.js';
  ```
- In `js/countdown-engine.js`:
  ```javascript
  import {
    MS_PER_SECOND,
    diffCalendarDays,
    getEndOfDayInTimeZoneMs,
    getStartOfDayInTimeZoneMs,
    getZonedDateParts,
    getUtcOffsetMinutes
  } from './date-utils.js';
  ```
- In `js/countdown-engine.js` barrel re-exports:
  ```javascript
  export {
    MS_PER_SECOND,
    MS_PER_MINUTE,
    MS_PER_HOUR,
    MS_PER_DAY,
    parseIsoDateParts,
    diffCalendarDays,
    getDaysInMonth,
    getZonedDateParts,
    getUtcOffsetMinutes,
    getZonedWallClockEpochMs,
    getStartOfDayInTimeZoneMs,
    getEndOfDayInTimeZoneMs,
    formatDisplayDate,
    formatShortDisplayDate
  } from './date-utils.js';
  ```

---

## 5. Verification Method

To verify the extraction independently:

1. **Run Full Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected Result*: All 25 tests pass identically with zero regressions.

2. **Verify Module Import Independence**:
   ```bash
   node -e "import('./js/date-utils.js').then(m => console.log(Object.keys(m).sort()))"
   ```
   *Expected Output*:
   ```json
   [
     'MS_PER_DAY',
     'MS_PER_HOUR',
     'MS_PER_MINUTE',
     'MS_PER_SECOND',
     'diffCalendarDays',
     'formatDisplayDate',
     'formatShortDisplayDate',
     'getDaysInMonth',
     'getEndOfDayInTimeZoneMs',
     'getStartOfDayInTimeZoneMs',
     'getUtcOffsetMinutes',
     'getZonedDateParts',
     'getZonedWallClockEpochMs',
     'parseIsoDateParts'
   ]
   ```

3. **Verify Zero-Knowledge Security Compliance**:
   ```bash
   node --test tests/integration.test.mjs
   ```
   *Expected Result*: All integration tests pass, including Security Audit.

4. **Invalidation Conditions**:
   - Any test failure in `node --test tests/*.test.mjs`.
   - Any reference to `Date.now()` or global `document`/`window` in `js/date-utils.js`.
   - Any missing named export when importing from `js/date-utils.js` or `js/countdown-engine.js`.
