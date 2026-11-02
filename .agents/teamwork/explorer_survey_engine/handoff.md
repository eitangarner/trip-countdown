# Handoff Report: Engine & Primitives Modularization Plan

## 1. Observation

### 1.1 Source Code Survey
Direct line-by-line inspection of source files revealed the following structure and boundaries:

#### `js/countdown-engine.js` (Total 963 lines)
- **Lines 1**: `import { COUNTRY_CATALOG, getCountryInfo } from './config.js';`
- **Lines 3-6**: Time constants:
  ```javascript
  const MS_PER_SECOND = 1000;
  const MS_PER_MINUTE = 60 * MS_PER_SECOND;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;
  const MS_PER_DAY = 24 * MS_PER_HOUR;
  ```
- **Lines 8-12**: Memoization caches:
  ```javascript
  const FORMATTER_CACHE = new Map();
  const DAY_BOUNDARY_CACHE = new Map();
  ```
- **Lines 19-35**: `function getZonedFormatter(timeZone)` — cached `Intl.DateTimeFormat` instance factory.
- **Lines 42-45**: `export function parseIsoDateParts(dateStr)` — parses "YYYY-MM-DD" to `{ year, month, day }`.
- **Lines 53-59**: `export function diffCalendarDays(startDateStr, endDateStr)` — calendar day delta using `Date.UTC`.
- **Lines 67-69**: `function getDaysInMonth(year, month)` — days in 1-indexed month.
- **Lines 86-118**: `export function getZonedDateParts(epochMs, timeZone)` — timezone wall-clock parts and formatted date/time strings.
- **Lines 126-131**: `export function getUtcOffsetMinutes(epochMs, timeZone)` — signed UTC offset in minutes.
- **Lines 144-151**: `function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms)` — two-pass DST-safe local wall-clock conversion.
- **Lines 159-168**: `export function getStartOfDayInTimeZoneMs(dateStr, timeZone)` — memoized start of day (00:00:00.000).
- **Lines 176-185**: `export function getEndOfDayInTimeZoneMs(dateStr, timeZone)` — memoized end of day (23:59:59.999).
- **Lines 193-198**: `export function formatDisplayDate(dateStr, options = false)` — formats "DD-MM-YYYY" or "DD-MM-YY".
- **Lines 205-207**: `export function formatShortDisplayDate(dateStr)` — formats "DD-MM-YY".
- **Lines 214-217**: `function resolveCountry(countryCode)` — resolves CountryInfo with fallback.
- **Lines 227-239**: `function resolveMonthOffset(bound, originYear, originMonth, defaultOffset)` — computes month delta from bound.
- **Lines 248-262**: `function resolveAnniversaryCountryCode(dateStr, reunions, homeCountryCode)` — identifies country code on dateStr from reunion legs.
- **Lines 276-331**: `export function generateMonthlyAnniversaries(originDateStr, startYearMonth = 10, endYearMonth = 24, existingMilestones = [], reunions = [], homeCountryCode = 'UTC')` — synthesizes monthly anniversary MilestoneEvents.
- **Lines 344-375**: `export function computeRelationshipDuration(originDateStr, currentDateStr)` — calculates count-up duration with month-borrowing.
- **Lines 388-403**: `export function decomposeRemainingMs(remainingMs)` — decomposes ms into `{ days, hours, minutes, seconds, totalRemainingMs }`.
- **Lines 411-417**: `export function getLegDurationDays(leg, reunion)` — duration in days for a single leg.
- **Lines 424-426**: `export function getReunionDurationDays(reunion)` — total days across all legs in a reunion chapter.
- **Lines 432-465**: `function resolveReunionWindows(reunion)` — computes exact epoch ms boundaries (`startMs`, `endMs`) for reunion and each leg.
- **Lines 477-498**: `export function resolvePartnerConfigMeta(config)` — resolves partner keys and departure dates.
- **Lines 509-962**: `export function evaluateBoardState(config, liveState = null, nowMs)` — pure state machine evaluating phases (`PRE_TRIP`, `APART`, `TOGETHER`), countdowns, sooner milestones, dual status, and timeline partition.

#### `js/photo-stack.js` (Total 1,214 lines)
- **Lines 6-9**: Geometry & timing constants:
  ```javascript
  const SWIPE_THRESHOLD_PX = 45;
  const TAP_SLOP_PX = 8;
  const DEFAULT_AUTOROTATE_MS = 4500;
  const SAMPLE_CANVAS_SIZE = 32;
  ```
- **Lines 15-149**: `export const FALLBACK_PHOTOS = [...]` — 4 rich SVG illustration cards with pre-computed palettes.
- **Lines 158-192**: `export function rgbToHsl(r, g, b)` — RGB to HSL conversion.
- **Lines 201-230**: `export function hslToHex(h, s, l)` — HSL to 6-digit hex conversion.
- **Lines 237-255**: `function parseHexColor(hex)` — parses `#rgb` or `#rrggbb` to `{ r, g, b }`.
- **Lines 257-259**: `function clamp(value, min, max)` — numeric range clamping.
- **Lines 261-267**: `const DEFAULT_LUMINOUS_PALETTE = { primary: '#f6b8d0', secondary: '#b8d8f8', tertiary: '#fbd3a7', quaternary: '#d5bdf8', accent: '#e86f9a' };`
- **Lines 277-283**: `export function clampHslForRole(hsl, role = 'primary')` — clamps HSL to pastel lightness (68%–84%) or accent (49%–57%).
- **Lines 285-288**: `function circularHueBucketDistance(bucketIdxA, bucketIdxB)` — cyclic 12-hue bucket distance.
- **Lines 290-296**: `function bucketToAverageHsl(bucket)` — weighted RGB average to HSL.
- **Lines 298-314**: `function expandHslListToFourRoles(seedHsls)` — harmonic expansion when fewer than 4 distinct hues exist.
- **Lines 316-331**: `function buildClampedPalette(seedHsls, accentHsl = null)` — builds 5-role clamped palette object.
- **Lines 338-399**: `function extractPaletteFromPixels(rgbaData)` — samples RGBA pixel buffer into 12 hue buckets.
- **Lines 410-490**: `export function extractLuminousPalette(imageSource)` — polymorphic palette extractor supporting Image, Canvas, ImageData, VaultPhoto, or SVG/hex strings.
- **Lines 492-514**: `function parseDateParts(str)` — parses DD-MM-YYYY or YYYY-MM-DD into `{ day, month, year }`.
- **Lines 524-642**: `export function createPhotoDateElement(dateLabel, { isCompact = false } = {})` — creates calendar-page date badge DOM nodes with `.numeric-lock` and `dir="ltr"`.
- **Lines 649-1213**: `export class PhotoStackController` — DOM & gesture controller managing 3D card deck, drag/swipe, tap, shuffle, auto-rotate, and `:root` ambient CSS variables.

### 1.2 Test Suite Dependencies
Inspection of tests via `node --test tests/*.test.mjs` confirmed:
- Currently **25 tests pass** with 0 failures (`duration_ms ~188ms`).
- `tests/countdown-engine.test.mjs` imports from `../js/countdown-engine.js`:
  `getZonedDateParts`, `getStartOfDayInTimeZoneMs`, `getEndOfDayInTimeZoneMs`, `getUtcOffsetMinutes`, `formatDisplayDate`, `formatShortDisplayDate`, `generateMonthlyAnniversaries`, `evaluateBoardState`.
- `tests/integration.test.mjs` imports:
  - From `../js/countdown-engine.js`: `evaluateBoardState`.
  - From `../js/photo-stack.js`: `FALLBACK_PHOTOS`, `PhotoStackController`, `clampHslForRole`, `createPhotoDateElement`, `extractLuminousPalette`, `rgbToHsl`.
- `tests/integration.test.mjs` line 190–210 (`Security Audit` test):
  Scans `publicFilesToAudit` array against forbidden cleartext PII patterns.

### 1.3 Consumer Dependencies Across App
- `js/app.js` imports:
  - From `./countdown-engine.js`: `decomposeRemainingMs`, `evaluateBoardState`, `formatDisplayDate`, `formatShortDisplayDate`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs`, `getZonedDateParts`, `resolvePartnerConfigMeta`.
  - From `./photo-stack.js`: `PhotoStackController`, `createPhotoDateElement`.
- `js/timeline-renderer.js` imports:
  - From `./countdown-engine.js`: `formatDisplayDate`, `formatShortDisplayDate`, `getEndOfDayInTimeZoneMs`, `getReunionDurationDays`, `getStartOfDayInTimeZoneMs`.
  - From `./photo-stack.js`: `createPhotoDateElement`.
- `sw.js` (lines 8–21):
  Caches `APP_SHELL_ASSETS` under `CACHE_NAME = 'trip-countdown-board-v4'`.

---

## 2. Logic Chain

1. **Decoupling Date/Time Primitives (`js/date-utils.js`)**:
   - Observations 1.1 show lines 3–207 of `countdown-engine.js` contain pure calendar arithmetic and timezone formatting. None of these functions depend on trip configuration, reunion legs, or DOM state.
   - Extracting `parseIsoDateParts`, `diffCalendarDays`, `getDaysInMonth`, `getZonedDateParts`, `getUtcOffsetMinutes`, `getZonedWallClockEpochMs`, `getStartOfDayInTimeZoneMs`, `getEndOfDayInTimeZoneMs`, `formatDisplayDate`, and `formatShortDisplayDate` into `js/date-utils.js` creates a standalone, zero-dependency module.
   - `getDaysInMonth` and `getZonedWallClockEpochMs`, previously unexported internal functions, must be exported from `date-utils.js` because `anniversaries.js` requires `getDaysInMonth` and `countdown-engine.js` re-exports the primitives.
   - Constants `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`, and `MS_PER_DAY` must be exported from `date-utils.js` for reuse in `countdown-engine.js`.

2. **Decoupling Relationship Anniversaries (`js/anniversaries.js`)**:
   - Observations 1.1 show `generateMonthlyAnniversaries` and `computeRelationshipDuration` (lines 227–375) only depend on date primitives (`parseIsoDateParts`, `diffCalendarDays`, `getDaysInMonth`) and internal helpers `resolveMonthOffset` and `resolveAnniversaryCountryCode`.
   - Neither function requires `COUNTRY_CATALOG` or `getCountryInfo` because `resolveAnniversaryCountryCode` operates strictly on leg dates and string `countryCode`.
   - Moving these to `js/anniversaries.js` isolates milestone generation while importing `diffCalendarDays`, `getDaysInMonth`, and `parseIsoDateParts` from `./date-utils.js`.

3. **Streamlining Board State Engine & Barrel Re-exports (`js/countdown-engine.js`)**:
   - Observations 1.2 and 1.3 show consumers (`tests/countdown-engine.test.mjs`, `js/app.js`, `js/timeline-renderer.js`) rely heavily on importing date formatters and anniversary functions directly from `countdown-engine.js`.
   - By retaining `decomposeRemainingMs`, `getLegDurationDays`, `getReunionDurationDays`, `resolveReunionWindows`, `resolvePartnerConfigMeta`, and `evaluateBoardState` in `countdown-engine.js` and adding explicit barrel `export { ... } from './date-utils.js'` and `export { ... } from './anniversaries.js'`, 100% backward compatibility is guaranteed with zero test alterations needed.
   - `resolveReunionWindows` should be exported to complete the planned public engine interface.

4. **Decoupling Color Science & Palette Extraction (`js/photo-palette.js`)**:
   - Observations 1.1 show lines 158–490 of `photo-stack.js` represent mathematical color transformations (`rgbToHsl`, `hslToHex`, `clampHslForRole`), pixel histogram sampling (`extractPaletteFromPixels`), and multi-role palette generation (`extractLuminousPalette`).
   - Extracting these to `js/photo-palette.js` provides a completely isolated color-extraction pipeline usable in both browser and headless Node contexts (as evidenced by tests in `integration.test.mjs`).
   - Exporting `DEFAULT_LUMINOUS_PALETTE`, `SAMPLE_CANVAS_SIZE`, `parseHexColor`, `clamp`, and `extractPaletteFromPixels` alongside `rgbToHsl`, `hslToHex`, `clampHslForRole`, and `extractLuminousPalette` ensures complete testability.

5. **Decoupling Calendar Page Date Badge (`js/photo-badge.js`)**:
   - Observations 1.1 and 1.3 show `createPhotoDateElement` and its helper `parseDateParts` (lines 492–642) are standalone DOM factory functions used in `PhotoStackController`, `js/app.js`, and `js/timeline-renderer.js`.
   - Isolating these in `js/photo-badge.js` enforces the bidirectional numeric lock (`dir="ltr"`, `.numeric-lock`) in one dedicated component.

6. **Preserving Photo Stack Controller & Barrel Re-exports (`js/photo-stack.js`)**:
   - Observations 1.2 and 1.3 show `tests/integration.test.mjs` imports `FALLBACK_PHOTOS`, `PhotoStackController`, `clampHslForRole`, `createPhotoDateElement`, `extractLuminousPalette`, and `rgbToHsl` from `photo-stack.js`.
   - By maintaining `FALLBACK_PHOTOS` and `PhotoStackController` in `photo-stack.js` and re-exporting all functions from `./photo-palette.js` and `./photo-badge.js`, all existing test assertions remain intact without modification.

7. **Service Worker and Security Audit Alignment**:
   - Observations 1.2 and 1.3 show `sw.js` and `tests/integration.test.mjs` maintain lists of public assets.
   - When the 4 new modules (`js/date-utils.js`, `js/anniversaries.js`, `js/photo-palette.js`, `js/photo-badge.js`) are created, they must be added to `APP_SHELL_ASSETS` with an incremented cache name (`trip-countdown-board-v5`) in `sw.js`, and added to `publicFilesToAudit` in `tests/integration.test.mjs`.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: As an explorer survey agent, this report specifies the design and decomposition contracts without writing code to source files. The actual implementation will be executed by downstream specialized agents.
2. **PWA Cache Invalidation**: The service worker cache bump (`v4` -> `v5`) must occur simultaneously with the introduction of new assets to prevent stale service workers from failing offline loads.
3. **Purity Invariant**: `js/date-utils.js` and `js/anniversaries.js` must NEVER invoke `Date.now()`, relying strictly on explicit `nowMs` epoch timestamps passed from callers.

---

## 4. Conclusion & Actionable Decomposition Plan

### 4.1 Target Architecture & File Inventory

```
js/
├── config.js                 [PRESERVED]
├── date-utils.js             [NEW ~180 lines] Pure date/timezone math, DST boundary calculations, formatting
├── anniversaries.js          [NEW ~140 lines] Pure duration count-up and monthly anniversary generation
├── countdown-engine.js       [MODIFIED ~560 lines] Pure board state evaluation + barrel re-exports
├── photo-palette.js          [NEW ~340 lines] HSL/RGB math, pastel lightness clamping, luminous palette extraction
├── photo-badge.js            [NEW ~150 lines] Calendar page date badge DOM rendering with numeric-lock
├── photo-stack.js            [MODIFIED ~700 lines] FALLBACK_PHOTOS, PhotoStackController + barrel re-exports
├── timeline-renderer.js      [PRESERVED]
├── storage-vault.js          [PRESERVED]
├── crypto-vault.js           [PRESERVED]
└── github-sync.js            [PRESERVED]
```

### 4.2 Exact Module Contracts & Export Signatures

#### Module 1: `js/date-utils.js`
```javascript
// Constants
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// Caches & Helpers
const FORMATTER_CACHE = new Map();
const DAY_BOUNDARY_CACHE = new Map();
function getZonedFormatter(timeZone) { ... }

// Public Functions
export function parseIsoDateParts(dateStr) { ... }
export function diffCalendarDays(startDateStr, endDateStr) { ... }
export function getDaysInMonth(year, month) { ... }
export function getZonedDateParts(epochMs, timeZone) { ... }
export function getUtcOffsetMinutes(epochMs, timeZone) { ... }
export function getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms) { ... }
export function getStartOfDayInTimeZoneMs(dateStr, timeZone) { ... }
export function getEndOfDayInTimeZoneMs(dateStr, timeZone) { ... }
export function formatDisplayDate(dateStr, options = false) { ... }
export function formatShortDisplayDate(dateStr) { ... }
```

#### Module 2: `js/anniversaries.js`
```javascript
import { diffCalendarDays, getDaysInMonth, parseIsoDateParts } from './date-utils.js';

// Internal Helpers
function resolveMonthOffset(bound, originYear, originMonth, defaultOffset) { ... }
function resolveAnniversaryCountryCode(dateStr, reunions, homeCountryCode) { ... }

// Public Functions
export function computeRelationshipDuration(originDateStr, currentDateStr) { ... }
export function generateMonthlyAnniversaries(
  originDateStr,
  startYearMonth = 10,
  endYearMonth = 24,
  existingMilestones = [],
  reunions = [],
  homeCountryCode = 'UTC'
) { ... }
```

#### Module 3: `js/countdown-engine.js`
```javascript
import { COUNTRY_CATALOG, getCountryInfo } from './config.js';
import {
  MS_PER_SECOND,
  diffCalendarDays,
  getEndOfDayInTimeZoneMs,
  getStartOfDayInTimeZoneMs,
  getZonedDateParts,
  getUtcOffsetMinutes
} from './date-utils.js';
import {
  computeRelationshipDuration,
  generateMonthlyAnniversaries
} from './anniversaries.js';

// Internal Helper
function resolveCountry(countryCode) { ... }

// Core Board State Functions
export function decomposeRemainingMs(remainingMs) { ... }
export function getLegDurationDays(leg, reunion) { ... }
export function getReunionDurationDays(reunion) { ... }
export function resolveReunionWindows(reunion) { ... }
export function resolvePartnerConfigMeta(config) { ... }
export function evaluateBoardState(config, liveState = null, nowMs) { ... }

// Backward-Compatibility Barrel Re-exports
export {
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

export {
  computeRelationshipDuration,
  generateMonthlyAnniversaries
} from './anniversaries.js';
```

#### Module 4: `js/photo-palette.js`
```javascript
// Constants
export const SAMPLE_CANVAS_SIZE = 32;
export const DEFAULT_LUMINOUS_PALETTE = {
  primary: '#f6b8d0',
  secondary: '#b8d8f8',
  tertiary: '#fbd3a7',
  quaternary: '#d5bdf8',
  accent: '#e86f9a'
};

// Conversions & Math
export function rgbToHsl(r, g, b) { ... }
export function hslToHex(h, s, l) { ... }
export function parseHexColor(hex) { ... }
export function clamp(value, min, max) { ... }
export function clampHslForRole(hsl, role = 'primary') { ... }

// Internal Cluster Helpers
function circularHueBucketDistance(bucketIdxA, bucketIdxB) { ... }
function bucketToAverageHsl(bucket) { ... }
function expandHslListToFourRoles(seedHsls) { ... }
function buildClampedPalette(seedHsls, accentHsl = null) { ... }

// Public Extraction API
export function extractPaletteFromPixels(rgbaData) { ... }
export function extractLuminousPalette(imageSource) { ... }
```

#### Module 5: `js/photo-badge.js`
```javascript
export function parseDateParts(str) { ... }
export function createPhotoDateElement(dateLabel, { isCompact = false } = {}) { ... }
```

#### Module 6: `js/photo-stack.js`
```javascript
import { DEFAULT_LUMINOUS_PALETTE, extractLuminousPalette } from './photo-palette.js';
import { createPhotoDateElement } from './photo-badge.js';

const SWIPE_THRESHOLD_PX = 45;
const TAP_SLOP_PX = 8;
const DEFAULT_AUTOROTATE_MS = 4500;

export const FALLBACK_PHOTOS = [ ... ];
export class PhotoStackController { ... }

// Backward-Compatibility Barrel Re-exports
export {
  DEFAULT_LUMINOUS_PALETTE,
  SAMPLE_CANVAS_SIZE,
  rgbToHsl,
  hslToHex,
  parseHexColor,
  clamp,
  clampHslForRole,
  extractPaletteFromPixels,
  extractLuminousPalette
} from './photo-palette.js';

export {
  parseDateParts,
  createPhotoDateElement
} from './photo-badge.js';
```

---

## 5. Verification Method

To independently verify the planned modularization upon implementation:

1. **Execute Complete Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected Result*: All 25 tests pass identically with 0 failures.

2. **Verify Module Import Independence**:
   Run node REPL check to verify `js/date-utils.js` imports with zero side effects or ambient dependencies:
   ```bash
   node -e "import('./js/date-utils.js').then(m => console.log(Object.keys(m)))"
   node -e "import('./js/anniversaries.js').then(m => console.log(Object.keys(m)))"
   node -e "import('./js/photo-palette.js').then(m => console.log(Object.keys(m)))"
   node -e "import('./js/countdown-engine.js').then(m => console.log(Object.keys(m)))"
   node -e "import('./js/photo-stack.js').then(m => console.log(Object.keys(m)))"
   ```

3. **Verify Zero-Knowledge Security Audit**:
   Ensure `tests/integration.test.mjs` passes the security scan including all new files:
   ```bash
   node --test tests/integration.test.mjs
   ```

4. **Invalidation Conditions**:
   - Any test failing in `tests/countdown-engine.test.mjs` or `tests/integration.test.mjs`.
   - Missing export error when importing from `js/countdown-engine.js` or `js/photo-stack.js`.
   - Reference to ambient `document` or `window` in `date-utils.js` or `anniversaries.js`.
   - Use of `Date.now()` inside state engine functions.
