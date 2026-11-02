# Handoff Report: Board State Evaluation & Public Export Contracts Analysis (`js/countdown-engine.js`)

## 1. Observation

### 1.1 Source File Inventory: `js/countdown-engine.js` (963 Lines Total)
Direct line-by-line inspection of `/Users/eitangarner/Documents/Development/Projects/trip-countdown/js/countdown-engine.js` reveals the exact current file composition:

- **Line 1**: Config import:
  ```javascript
  import { COUNTRY_CATALOG, getCountryInfo } from './config.js';
  ```
- **Lines 3–207**: Date/time primitives, constants, and caches (delegated to `js/date-utils.js` per Explorer 1):
  - Constants: `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY` (lines 3–6)
  - Caches: `FORMATTER_CACHE`, `DAY_BOUNDARY_CACHE`, `getZonedFormatter` (lines 8–35)
  - Functions: `parseIsoDateParts` (lines 37–45), `diffCalendarDays` (lines 47–59), `getDaysInMonth` (lines 61–69), `getZonedDateParts` (lines 71–118), `getUtcOffsetMinutes` (lines 120–131), `getZonedWallClockEpochMs` (lines 133–151), `getStartOfDayInTimeZoneMs` (lines 153–168), `getEndOfDayInTimeZoneMs` (lines 170–185), `formatDisplayDate` (lines 187–198), `formatShortDisplayDate` (lines 200–207).
- **Lines 209–217**: Country resolution helper:
  ```javascript
  /**
   * Resolves CountryInfo from COUNTRY_CATALOG or dynamic fallback.
   * @param {string} countryCode
   * @returns {import('./config.js').CountryInfo}
   */
  function resolveCountry(countryCode) {
    const code = (countryCode || 'UTC').toUpperCase();
    return COUNTRY_CATALOG[code] ?? getCountryInfo(code);
  }
  ```
- **Lines 219–375**: Anniversary calculation functions and internal helpers (delegated to `js/anniversaries.js` per Explorer 2):
  - `resolveMonthOffset` (lines 227–239)
  - `resolveAnniversaryCountryCode` (lines 248–262)
  - `generateMonthlyAnniversaries` (lines 276–331)
  - `computeRelationshipDuration` (lines 344–375)
- **Lines 377–403**: Millisecond duration decomposition:
  ```javascript
  /**
   * Decomposes a millisecond duration into days, hours, minutes, seconds, and totalRemainingMs.
   * @param {number} remainingMs
   * @returns {{
   *   days: number,
   *   hours: number,
   *   minutes: number,
   *   seconds: number,
   *   totalRemainingMs: number
   * }}
   */
  export function decomposeRemainingMs(remainingMs) {
    const clampedMs = Math.max(0, remainingMs);
    const totalSeconds = Math.floor(clampedMs / MS_PER_SECOND);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days,
      hours,
      minutes,
      seconds,
      totalRemainingMs: clampedMs
    };
  }
  ```
- **Lines 405–417**: Single leg duration calculation:
  ```javascript
  /**
   * Computes the planned duration in days for a reunion leg.
   * @param {import('./config.js').ReunionLeg} leg
   * @param {import('./config.js').ReunionChapter} reunion
   * @returns {number}
   */
  export function getLegDurationDays(leg, reunion) {
    const rawDiff = diffCalendarDays(leg.startDate, leg.endDate);
    if (reunion.legs.length === 1) {
      return Math.max(1, rawDiff + 1);
    }
    return Math.max(1, rawDiff);
  }
  ```
- **Lines 419–426**: Full reunion duration calculation:
  ```javascript
  /**
   * Computes total planned days for a ReunionChapter.
   * @param {import('./config.js').ReunionChapter} reunion
   * @returns {number}
   */
  export function getReunionDurationDays(reunion) {
    return reunion.legs.reduce((sum, leg) => sum + getLegDurationDays(leg, reunion), 0);
  }
  ```
- **Lines 428–465**: Reunion chapter window and leg epoch ms boundary resolution (currently unexported):
  ```javascript
  /**
   * Computes the exact epoch millisecond start and end boundaries for a ReunionChapter and each of its legs.
   * @param {import('./config.js').ReunionChapter} reunion
   */
  function resolveReunionWindows(reunion) {
    const legWindows = reunion.legs.map((leg, index) => {
      const legCountry = resolveCountry(leg.countryCode);
      const startMs = getStartOfDayInTimeZoneMs(leg.startDate, legCountry.timeZone);
      let endMs;
      if (index < reunion.legs.length - 1) {
        const nextLeg = reunion.legs[index + 1];
        const nextCountry = resolveCountry(nextLeg.countryCode);
        endMs = getStartOfDayInTimeZoneMs(nextLeg.startDate, nextCountry.timeZone) - 1;
      } else {
        endMs = getEndOfDayInTimeZoneMs(leg.endDate, legCountry.timeZone);
      }
      return {
        leg,
        index,
        country: legCountry,
        startMs,
        endMs,
        totalLegDays: getLegDurationDays(leg, reunion)
      };
    });

    const startMs = legWindows[0].startMs;
    const endMs = legWindows[legWindows.length - 1].endMs;
    const totalReunionDays = getReunionDurationDays(reunion);

    return {
      reunion,
      startMs,
      endMs,
      totalReunionDays,
      legWindows
    };
  }
  ```
- **Lines 467–498**: Partner metadata and departure dates resolution:
  ```javascript
  /**
   * Resolves the two partner keys and departure dates dynamically from `config`.
   * @param {import('./config.js').TripConfig} config
   * @returns {{
   *   firstPartnerKey: string,
   *   secondPartnerKey: string,
   *   primaryDepartureDate: string,
   *   secondaryDepartureDate: string
   * }}
   */
  export function resolvePartnerConfigMeta(config) {
    const keys = Object.keys(config.coupleNames || {});
    const firstPartnerKey = keys[0] || 'partnerA';
    const secondPartnerKey = keys[1] || 'partnerB';

    const primaryDepartureDate =
      /** @type {any} */ (config)[`${firstPartnerKey}DepartureDate`] ||
      config.primaryDepartureDate ||
      config.relationshipOriginDate;

    const secondaryDepartureDate =
      /** @type {any} */ (config)[`${secondPartnerKey}DepartureDate`] ||
      config.secondaryDepartureDate ||
      primaryDepartureDate;

    return {
      firstPartnerKey,
      secondPartnerKey,
      primaryDepartureDate,
      secondaryDepartureDate
    };
  }
  ```
- **Lines 500–962**: Pure board state evaluation state machine:
  `export function evaluateBoardState(config, liveState = null, nowMs)`:
  - Validates `config` and `nowMs` parameters (lines 510–515).
  - Evaluates phase (`PRE_TRIP`, `APART`, `TOGETHER`) and active reunion/leg windows (lines 554–606).
  - Evaluates relationship duration in home timezone (lines 608–613).
  - Merges base milestones, monthly anniversaries, and custom overrides (lines 615–630).
  - Computes primary countdown, departure countdown, and phase banner text (lines 631–740).
  - Resolves sooner milestone (lines 742–769).
  - Resolves dual partner status and timezone bridge (lines 771–859).
  - Computes trip days completed/planned and partitions timeline items into past/upcoming (lines 860–933).
  - Returns `EvaluatedBoardState` (lines 935–961).

---

### 1.2 Export Inventory: Current vs. Target

Currently, `js/countdown-engine.js` exports 15 symbols:
1. `parseIsoDateParts` (line 42)
2. `diffCalendarDays` (line 53)
3. `getZonedDateParts` (line 86)
4. `getUtcOffsetMinutes` (line 126)
5. `getStartOfDayInTimeZoneMs` (line 159)
6. `getEndOfDayInTimeZoneMs` (line 176)
7. `formatDisplayDate` (line 193)
8. `formatShortDisplayDate` (line 205)
9. `generateMonthlyAnniversaries` (line 276)
10. `computeRelationshipDuration` (line 344)
11. `decomposeRemainingMs` (line 388)
12. `getLegDurationDays` (line 411)
13. `getReunionDurationDays` (line 424)
14. `resolvePartnerConfigMeta` (line 477)
15. `evaluateBoardState` (line 509)

In Milestone 2, the public surface of `js/countdown-engine.js` expands to 18 functions + 4 constants:
- **6 Core Functions** (defined directly in `js/countdown-engine.js`):
  1. `decomposeRemainingMs`
  2. `getLegDurationDays`
  3. `getReunionDurationDays`
  4. `resolveReunionWindows` (promoted to `export`)
  5. `resolvePartnerConfigMeta`
  6. `evaluateBoardState`
- **10 Date Primitives** (re-exported from `./date-utils.js`):
  1. `parseIsoDateParts`
  2. `diffCalendarDays`
  3. `getDaysInMonth` (newly exported primitive)
  4. `getZonedDateParts`
  5. `getUtcOffsetMinutes`
  6. `getZonedWallClockEpochMs` (newly exported primitive)
  7. `getStartOfDayInTimeZoneMs`
  8. `getEndOfDayInTimeZoneMs`
  9. `formatDisplayDate`
  10. `formatShortDisplayDate`
- **4 Time Constants** (re-exported from `./date-utils.js`):
  `MS_PER_SECOND`, `MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY`
- **2 Relationship Anniversary Functions** (re-exported from `./anniversaries.js`):
  1. `computeRelationshipDuration`
  2. `generateMonthlyAnniversaries`

---

### 1.3 Consumer Files & Verbatim Import Statements

Every consumer file importing from `countdown-engine.js` was inspected:

#### 1. `tests/countdown-engine.test.mjs` (Lines 4–13)
```javascript
import {
  getZonedDateParts,
  getStartOfDayInTimeZoneMs,
  getEndOfDayInTimeZoneMs,
  getUtcOffsetMinutes,
  formatDisplayDate,
  formatShortDisplayDate,
  generateMonthlyAnniversaries,
  evaluateBoardState
} from '../js/countdown-engine.js';
```

#### 2. `tests/integration.test.mjs` (Line 9)
```javascript
import { evaluateBoardState } from '../js/countdown-engine.js';
```

#### 3. `js/app.js` (Lines 12–21)
```javascript
import {
  decomposeRemainingMs,
  evaluateBoardState,
  formatDisplayDate,
  formatShortDisplayDate,
  getEndOfDayInTimeZoneMs,
  getStartOfDayInTimeZoneMs,
  getZonedDateParts,
  resolvePartnerConfigMeta
} from './countdown-engine.js';
```

#### 4. `js/timeline-renderer.js` (Lines 2–8)
```javascript
import {
  formatDisplayDate,
  formatShortDisplayDate,
  getEndOfDayInTimeZoneMs,
  getReunionDurationDays,
  getStartOfDayInTimeZoneMs
} from './countdown-engine.js';
```

#### 5. `sw.js` (Line 16)
```javascript
  './js/countdown-engine.js',
```

---

### 1.4 Test Baseline Execution
Execution of `node --test tests/*.test.mjs` synchronously confirmed:
```
✔ Timezone & Date Helpers: getZonedDateParts, getUtcOffsetMinutes, and start/end of day boundaries (3.287333ms)
✔ Automatic Monthly Anniversary Generator produces milestones on the 10th and skips existing 1-Year duplicate (0.214167ms)
✔ Phase 1: Pre-Trip at Home (2025-10-31T12:00:00+02:00) (4.002083ms)
✔ Phase 2: Apart Phase #1 (2025-12-12T15:00:00Z) (0.204375ms)
✔ Phase 3: Active Reunion #1 (2026-01-02T12:00:00+07:00) (0.180916ms)
✔ Phase 4: Apart Phase #2 (2026-02-15T15:00:00Z) (0.380125ms)
✔ Phase 5: Multi-Leg Reunion (SG -> KR -> JP) with seamless leg transitions (0.393375ms)
✔ LiveState statusOverrides: ignored during reunion if older than leg start, honored if newer (0.201291ms)
✔ LiveState chapterOverrides: supports editing country leg names/dates, adding countries, and removing countries (0.519792ms)
...
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 169.118042
```
All 25 tests pass in the baseline state.

---

## 2. Logic Chain

### Step 1: Retention of Core Board State Evaluation Functions
- **Observation 1.1** shows lines 377–962 of `countdown-engine.js` contain board state evaluation, phase transitions, countdown progress math, partner dual status with timezone bridge calculations, and timeline partitioning.
- These calculations constitute the core domain model of the application. They require:
  - Time conversions (`MS_PER_SECOND`) from `js/date-utils.js`
  - Calendar math (`diffCalendarDays`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs`, `getUtcOffsetMinutes`, `getZonedDateParts`) from `js/date-utils.js`
  - Anniversary generation (`computeRelationshipDuration`, `generateMonthlyAnniversaries`) from `js/anniversaries.js`
  - Country timezone catalog (`COUNTRY_CATALOG`, `getCountryInfo`) from `js/config.js`
- Moving these calculation functions into submodules is unnecessary and would violate single-responsibility principles. Retaining them in `js/countdown-engine.js` preserves the pure state engine boundary specified in `PLAN.md` and `PROJECT.md`.

### Step 2: Promoting `resolveReunionWindows` to Public Export
- In current `countdown-engine.js` (line 432), `function resolveReunionWindows(reunion)` is unexported.
- `PROJECT.md` line 108 and survey handoff section 4.2 specifically designate `resolveReunionWindows(reunion)` as an exported engine contract.
- Promoting it to `export function resolveReunionWindows(reunion)` enables external timeline editors, modal controllers (Milestone 4), and diagnostic tests to calculate exact epoch boundary timestamps for multi-leg chapters without duplicating leg iteration logic.

### Step 3: Architecture of Barrel Re-Export Facades
- **Observation 1.3** demonstrates that 4 critical project files (`tests/countdown-engine.test.mjs`, `tests/integration.test.mjs`, `js/app.js`, and `js/timeline-renderer.js`) import date formatters, boundary solvers, and anniversary generators directly from `../js/countdown-engine.js` or `./countdown-engine.js`.
- By using explicit named barrel re-exports:
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

  export {
    computeRelationshipDuration,
    generateMonthlyAnniversaries
  } from './anniversaries.js';
  ```
  `js/countdown-engine.js` exposes every single symbol that existing consumers expect, providing 100% backward compatibility with zero consumer edits required.
- Explicit named exports are chosen over `export *` because they:
  1. Prevent accidental leakage of unexported module-internal helpers (e.g., `resolveMonthOffset`, `FORMATTER_CACHE`).
  2. Make the exported API surface immediately readable and statically analyzable.
  3. Ensure deterministic bundler-free ES2022 module resolution.

### Step 4: Consumer Compatibility Verification Matrix
Mapping every imported identifier in the codebase against the refactored engine:

| Consumer File | Imported Identifier | Origin Module | Provider in M2 | Status |
|---|---|---|---|---|
| `tests/countdown-engine.test.mjs` | `getZonedDateParts` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `getStartOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `getEndOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `getUtcOffsetMinutes` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `formatDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `formatShortDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `generateMonthlyAnniversaries` | `js/anniversaries.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `tests/countdown-engine.test.mjs` | `evaluateBoardState` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `tests/integration.test.mjs` | `evaluateBoardState` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `decomposeRemainingMs` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `evaluateBoardState` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `formatDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `formatShortDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `getEndOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `getStartOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `getZonedDateParts` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/app.js` | `resolvePartnerConfigMeta` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `js/timeline-renderer.js` | `formatDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/timeline-renderer.js` | `formatShortDisplayDate` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/timeline-renderer.js` | `getEndOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |
| `js/timeline-renderer.js` | `getReunionDurationDays` | `js/countdown-engine.js` | Direct export in `countdown-engine.js` | Verified ✅ |
| `js/timeline-renderer.js` | `getStartOfDayInTimeZoneMs` | `js/date-utils.js` | Barrel re-export in `countdown-engine.js` | Verified ✅ |

All 22 consumer imports across all 4 files are 100% satisfied.

### Step 5: Acyclic Dependency Graph
The resulting dependency graph is strictly unidirectional:
```
config.js (zero internal imports)
date-utils.js (zero internal imports)
     ▲                    ▲
     │                    │
anniversaries.js          │
     ▲                    │
     │                    │
countdown-engine.js ──────┘
```
- `js/date-utils.js`: imports 0 internal files.
- `js/anniversaries.js`: imports 3 primitives from `./date-utils.js`.
- `js/countdown-engine.js`: imports from `./config.js`, `./date-utils.js`, and `./anniversaries.js`.
- There are ZERO circular dependencies, eliminating module instantiation race conditions.

### Step 6: Purity, Determinism & Zero-Knowledge Security Invariants
- `js/countdown-engine.js` maintains strict calculation engine purity:
  - Zero calls to `Date.now()` (timestamps are passed via explicit `nowMs`).
  - Zero references to `window`, `document`, or DOM elements.
  - Zero hardcoded personal names, dates, or secrets.
- Full compatibility with the Time-Travel Preview Slider and `node --test` deterministic execution is preserved.

---

## 3. Caveats

1. **Read-Only Explorer Scope**: This investigation is strictly read-only. Worker M2 will execute the physical file creation and modification.
2. **Worker M2 File Creation Order**: To prevent unresolved module import errors during node execution, Worker M2 must create files in topological order:
   1. `js/date-utils.js` (no internal dependencies)
   2. `js/anniversaries.js` (depends on `date-utils.js`)
   3. `js/countdown-engine.js` (refactored to import from and re-export `date-utils.js` and `anniversaries.js`)
3. **PWA Shell Caching & Security Scan Expansion**: In Milestone 5, `js/date-utils.js` and `js/anniversaries.js` will be registered in `sw.js` (`APP_SHELL_ASSETS`) and `tests/integration.test.mjs` (`publicFilesToAudit`). Ensuring that neither file contains personal names, dates, or secrets during Milestone 2 prevents regressions during Milestone 5 audit expansion.

---

## 4. Conclusion & Actionable Implementation Strategy

### 4.1 Summary of Changes for `js/countdown-engine.js`
- File line count reduces from **963 lines** to **~630 lines**.
- Lines 3–207 (date math, formatting, caches) are removed and re-exported from `./date-utils.js`.
- Lines 219–375 (`resolveMonthOffset`, `resolveAnniversaryCountryCode`, `generateMonthlyAnniversaries`, `computeRelationshipDuration`) are removed and re-exported from `./anniversaries.js`.
- Helper `resolveCountry(countryCode)` (lines 209–217) is retained as a module-internal helper.
- Core functions `decomposeRemainingMs`, `getLegDurationDays`, `getReunionDurationDays`, `resolvePartnerConfigMeta`, and `evaluateBoardState` are retained.
- Function `resolveReunionWindows` is promoted to `export function resolveReunionWindows`.

### 4.2 Complete Proposed Content for `js/countdown-engine.js`

```javascript
import { COUNTRY_CATALOG, getCountryInfo } from './config.js';
import {
  MS_PER_SECOND,
  diffCalendarDays,
  getEndOfDayInTimeZoneMs,
  getStartOfDayInTimeZoneMs,
  getUtcOffsetMinutes,
  getZonedDateParts
} from './date-utils.js';
import {
  computeRelationshipDuration,
  generateMonthlyAnniversaries
} from './anniversaries.js';

/**
 * Resolves CountryInfo from COUNTRY_CATALOG or dynamic fallback.
 * @param {string} countryCode
 * @returns {import('./config.js').CountryInfo}
 */
function resolveCountry(countryCode) {
  const code = (countryCode || 'UTC').toUpperCase();
  return COUNTRY_CATALOG[code] ?? getCountryInfo(code);
}

/**
 * Decomposes a millisecond duration into days, hours, minutes, seconds, and totalRemainingMs.
 * @param {number} remainingMs
 * @returns {{
 *   days: number,
 *   hours: number,
 *   minutes: number,
 *   seconds: number,
 *   totalRemainingMs: number
 * }}
 */
export function decomposeRemainingMs(remainingMs) {
  const clampedMs = Math.max(0, remainingMs);
  const totalSeconds = Math.floor(clampedMs / MS_PER_SECOND);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalRemainingMs: clampedMs
  };
}

/**
 * Computes the planned duration in days for a reunion leg.
 * @param {import('./config.js').ReunionLeg} leg
 * @param {import('./config.js').ReunionChapter} reunion
 * @returns {number}
 */
export function getLegDurationDays(leg, reunion) {
  const rawDiff = diffCalendarDays(leg.startDate, leg.endDate);
  if (reunion.legs.length === 1) {
    return Math.max(1, rawDiff + 1);
  }
  return Math.max(1, rawDiff);
}

/**
 * Computes total planned days for a ReunionChapter.
 * @param {import('./config.js').ReunionChapter} reunion
 * @returns {number}
 */
export function getReunionDurationDays(reunion) {
  return reunion.legs.reduce((sum, leg) => sum + getLegDurationDays(leg, reunion), 0);
}

/**
 * Computes the exact epoch millisecond start and end boundaries for a ReunionChapter and each of its legs.
 * @param {import('./config.js').ReunionChapter} reunion
 */
export function resolveReunionWindows(reunion) {
  const legWindows = reunion.legs.map((leg, index) => {
    const legCountry = resolveCountry(leg.countryCode);
    const startMs = getStartOfDayInTimeZoneMs(leg.startDate, legCountry.timeZone);
    let endMs;
    if (index < reunion.legs.length - 1) {
      const nextLeg = reunion.legs[index + 1];
      const nextCountry = resolveCountry(nextLeg.countryCode);
      endMs = getStartOfDayInTimeZoneMs(nextLeg.startDate, nextCountry.timeZone) - 1;
    } else {
      endMs = getEndOfDayInTimeZoneMs(leg.endDate, legCountry.timeZone);
    }
    return {
      leg,
      index,
      country: legCountry,
      startMs,
      endMs,
      totalLegDays: getLegDurationDays(leg, reunion)
    };
  });

  const startMs = legWindows[0].startMs;
  const endMs = legWindows[legWindows.length - 1].endMs;
  const totalReunionDays = getReunionDurationDays(reunion);

  return {
    reunion,
    startMs,
    endMs,
    totalReunionDays,
    legWindows
  };
}

/**
 * Resolves the two partner keys and departure dates dynamically from `config`.
 * @param {import('./config.js').TripConfig} config
 * @returns {{
 *   firstPartnerKey: string,
 *   secondPartnerKey: string,
 *   primaryDepartureDate: string,
 *   secondaryDepartureDate: string
 * }}
 */
export function resolvePartnerConfigMeta(config) {
  const keys = Object.keys(config.coupleNames || {});
  const firstPartnerKey = keys[0] || 'partnerA';
  const secondPartnerKey = keys[1] || 'partnerB';

  const primaryDepartureDate =
    /** @type {any} */ (config)[`${firstPartnerKey}DepartureDate`] ||
    config.primaryDepartureDate ||
    config.relationshipOriginDate;

  const secondaryDepartureDate =
    /** @type {any} */ (config)[`${secondPartnerKey}DepartureDate`] ||
    config.secondaryDepartureDate ||
    primaryDepartureDate;

  return {
    firstPartnerKey,
    secondPartnerKey,
    primaryDepartureDate,
    secondaryDepartureDate
  };
}

/**
 * Evaluates the complete board state deterministically at `nowMs`.
 * Never invokes Date.now() internally.
 *
 * @param {import('./config.js').TripConfig} config
 * @param {import('./config.js').LiveStatePayload | null} [liveState=null]
 * @param {number} nowMs
 * @returns {import('./config.js').EvaluatedBoardState}
 */
export function evaluateBoardState(config, liveState = null, nowMs) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('evaluateBoardState requires a valid decrypted TripConfig object');
  }
  if (typeof nowMs !== 'number' || Number.isNaN(nowMs)) {
    throw new TypeError('evaluateBoardState requires an explicit numeric nowMs timestamp');
  }

  const {
    firstPartnerKey,
    secondPartnerKey,
    primaryDepartureDate,
    secondaryDepartureDate
  } = resolvePartnerConfigMeta(config);

  const homeCountry = resolveCountry(config.homeCountryCode);
  const homeTz = homeCountry.timeZone;

  const baseReunions = config.reunions || [];
  const customReunions = liveState?.customReunions || [];
  const chapterOverrides = liveState?.chapterOverrides || {};
  const reunions = [...baseReunions, ...customReunions]
    .filter((rc) => !chapterOverrides[rc.id]?.hidden)
    .map((rc) => {
      const override = chapterOverrides[rc.id];
      if (!override) return rc;
      const updated = { ...rc, ...override };
      if (Array.isArray(override.legs) && override.legs.length > 0) {
        updated.legs = override.legs.map((leg) => ({ ...leg }));
        updated.startDate = updated.legs[0].startDate;
        updated.endDate = updated.legs[updated.legs.length - 1].endDate;
      } else if (override.countryCode && Array.isArray(updated.legs) && updated.legs.length > 0) {
        updated.legs = updated.legs.map((leg, index) =>
          index === 0 ? { ...leg, countryCode: override.countryCode } : leg
        );
      }
      return updated;
    })
    .filter((rc) => Array.isArray(rc.legs) && rc.legs.length > 0)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const reunionWindows = reunions.map(resolveReunionWindows);

  const primaryDepartureStartMs = getStartOfDayInTimeZoneMs(primaryDepartureDate, homeTz);
  const secondaryDepartureStartMs = getStartOfDayInTimeZoneMs(secondaryDepartureDate, homeTz);

  // 1. Determine Phase & Active Reunion
  /** @type {'PRE_TRIP'|'APART'|'TOGETHER'} */
  let phase = 'APART';
  /** @type {import('./config.js').EvaluatedBoardState['activeReunion']} */
  let activeReunion = null;
  let activeReunionWindow = null;
  let activeLegWindow = null;

  for (const rw of reunionWindows) {
    if (nowMs >= rw.startMs && nowMs <= rw.endMs) {
      phase = 'TOGETHER';
      activeReunionWindow = rw;
      activeLegWindow =
        rw.legWindows.find((lw) => nowMs >= lw.startMs && nowMs <= lw.endMs) ??
        rw.legWindows[rw.legWindows.length - 1];

      const localDateInLeg = getZonedDateParts(nowMs, activeLegWindow.country.timeZone).dateStr;
      const priorLegsDays = rw.legWindows
        .slice(0, activeLegWindow.index)
        .reduce((acc, lw) => acc + lw.totalLegDays, 0);
      const dayOfLeg = Math.min(
        activeLegWindow.totalLegDays,
        Math.max(1, diffCalendarDays(activeLegWindow.leg.startDate, localDateInLeg) + 1)
      );
      const dayOfReunion = Math.min(
        rw.totalReunionDays,
        Math.max(1, priorLegsDays + dayOfLeg)
      );

      const nextLegWindow = rw.legWindows[activeLegWindow.index + 1] ?? null;
      const daysUntilNextLeg = nextLegWindow
        ? Math.max(0, diffCalendarDays(localDateInLeg, nextLegWindow.leg.startDate))
        : null;

      activeReunion = {
        reunion: rw.reunion,
        activeLeg: activeLegWindow.leg,
        legIndex: activeLegWindow.index,
        totalLegs: rw.legWindows.length,
        dayOfReunion,
        totalReunionDays: rw.totalReunionDays,
        dayOfLeg,
        totalLegDays: activeLegWindow.totalLegDays,
        nextLeg: nextLegWindow ? nextLegWindow.leg : null,
        daysUntilNextLeg
      };
      break;
    }
  }

  if (phase !== 'TOGETHER' && nowMs < primaryDepartureStartMs) {
    phase = 'PRE_TRIP';
  }

  // 2. Relationship Duration (in origin timezone)
  const currentOriginDateStr = getZonedDateParts(nowMs, homeTz).dateStr;
  const relationshipDuration = computeRelationshipDuration(
    config.relationshipOriginDate,
    currentOriginDateStr
  );

  // 3. Merge Milestones (baseline + auto-generated monthly anniversaries + customMilestones)
  const baseMilestones = [...(config.milestones || []), ...(liveState?.customMilestones || [])];
  const monthlyAnniversaries = generateMonthlyAnniversaries(
    config.relationshipOriginDate,
    10,
    24,
    baseMilestones,
    reunions,
    config.homeCountryCode
  );
  const milestoneOverrides = liveState?.milestoneOverrides || {};
  const allMilestones = [...baseMilestones, ...monthlyAnniversaries]
    .filter((ms) => !milestoneOverrides[ms.id]?.hidden)
    .map((ms) => (milestoneOverrides[ms.id] ? { ...ms, ...milestoneOverrides[ms.id] } : ms))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 4. Primary Countdown & Phase Banner Text
  const nextReunionWindow = reunionWindows.find((rw) => rw.startMs > nowMs) ?? null;
  let phaseBannerText = '';
  /** @type {import('./config.js').EvaluatedBoardState['primaryCountdown']} */
  let primaryCountdown = null;

  const departureMilestone =
    baseMilestones.find((ms) => ms.category === 'departure' && ms.date === primaryDepartureDate) ||
    baseMilestones.find((ms) => ms.category === 'departure') ||
    null;

  const departureParts = decomposeRemainingMs(primaryDepartureStartMs - nowMs);
  const departureCountdown = {
    targetId: departureMilestone?.id || 'ms-primary-depart',
    targetTitle: departureMilestone?.title || 'Trip Departure',
    targetEmoji: departureMilestone?.emoji || '✈️',
    targetDate: primaryDepartureDate,
    targetEpochMs: primaryDepartureStartMs,
    ...departureParts
  };

  if (phase === 'PRE_TRIP') {
    phaseBannerText = `Pre-Trip • Together at Home ${homeCountry.flag}`;
    if (nextReunionWindow) {
      const originStartMs = getStartOfDayInTimeZoneMs(config.relationshipOriginDate, homeTz);
      const remaining = decomposeRemainingMs(nextReunionWindow.startMs - nowMs);
      const totalSpanMs = Math.max(1, nextReunionWindow.startMs - originStartMs);
      const separationProgressPct = Math.min(
        100,
        Math.max(0, Number((((nowMs - originStartMs) / totalSpanMs) * 100).toFixed(2)))
      );
      primaryCountdown = {
        targetId: nextReunionWindow.reunion.id,
        targetTitle: nextReunionWindow.reunion.title,
        targetEmoji: nextReunionWindow.reunion.emoji,
        targetDate: nextReunionWindow.reunion.startDate,
        targetEpochMs: nextReunionWindow.startMs,
        ...remaining,
        separationProgressPct,
        separationStartDate: primaryDepartureDate,
        separationTotalDays: diffCalendarDays(
          primaryDepartureDate,
          nextReunionWindow.reunion.startDate
        ),
        departureCountdown
      };
    }
  } else if (phase === 'TOGETHER' && activeReunionWindow && activeLegWindow && activeReunion) {
    phaseBannerText = `Together Now in ${activeLegWindow.country.name} ${activeLegWindow.country.flag}`;
    const remaining = decomposeRemainingMs(activeReunionWindow.endMs - nowMs);
    const totalSpanMs = Math.max(1, activeReunionWindow.endMs - activeReunionWindow.startMs);
    const chapterProgressPct = Math.min(
      100,
      Math.max(0, Number((((nowMs - activeReunionWindow.startMs) / totalSpanMs) * 100).toFixed(2)))
    );
    primaryCountdown = {
      targetId: activeReunionWindow.reunion.id,
      targetTitle: activeReunionWindow.reunion.title,
      targetEmoji: activeReunionWindow.reunion.emoji,
      targetDate: activeReunionWindow.reunion.endDate,
      targetEpochMs: activeReunionWindow.endMs,
      ...remaining,
      separationProgressPct: chapterProgressPct,
      separationStartDate: activeReunionWindow.reunion.startDate,
      separationTotalDays: activeReunionWindow.totalReunionDays
    };
  } else {
    // phase === 'APART'
    if (nextReunionWindow) {
      phaseBannerText = `Apart • Counting Down to ${nextReunionWindow.reunion.title} ${nextReunionWindow.reunion.emoji}`;
      const previousReunionWindows = reunionWindows.filter((rw) => rw.endMs < nowMs);
      const lastCompletedReunion =
        previousReunionWindows.length > 0
          ? previousReunionWindows[previousReunionWindows.length - 1]
          : null;

      const separationStartMs = lastCompletedReunion
        ? lastCompletedReunion.endMs + 1
        : primaryDepartureStartMs;
      const separationStartDate = lastCompletedReunion
        ? lastCompletedReunion.reunion.endDate
        : primaryDepartureDate;
      const separationTotalDays = diffCalendarDays(
        separationStartDate,
        nextReunionWindow.reunion.startDate
      );

      const totalSeparationMs = Math.max(1, nextReunionWindow.startMs - separationStartMs);
      const separationProgressPct = Math.min(
        100,
        Math.max(0, Number((((nowMs - separationStartMs) / totalSeparationMs) * 100).toFixed(2)))
      );
      const remaining = decomposeRemainingMs(nextReunionWindow.startMs - nowMs);

      primaryCountdown = {
        targetId: nextReunionWindow.reunion.id,
        targetTitle: nextReunionWindow.reunion.title,
        targetEmoji: nextReunionWindow.reunion.emoji,
        targetDate: nextReunionWindow.reunion.startDate,
        targetEpochMs: nextReunionWindow.startMs,
        ...remaining,
        separationProgressPct,
        separationStartDate,
        separationTotalDays
      };
    } else {
      phaseBannerText = 'Apart • Next Reunion TBD 🌏';
      primaryCountdown = null;
    }
  }

  // 5. Sooner Milestone Resolution
  /** @type {import('./config.js').MilestoneEvent | null} */
  let soonerMilestone = null;
  /** @type {number | null} */
  let soonerMilestoneDaysAway = null;

  for (const ms of allMilestones) {
    const msCountry = resolveCountry(ms.countryCode || config.homeCountryCode);
    const msEndMs = getEndOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
    if (msEndMs < nowMs) {
      continue;
    }

    if (phase === 'APART' && primaryCountdown && ms.date >= primaryCountdown.targetDate) {
      continue;
    }
    if (phase === 'PRE_TRIP' && primaryCountdown && ms.date >= primaryCountdown.targetDate) {
      continue;
    }
    if (phase === 'TOGETHER' && activeReunionWindow && ms.date > activeReunionWindow.reunion.endDate) {
      continue;
    }

    soonerMilestone = ms;
    const currentLocalDateInMsTz = getZonedDateParts(nowMs, msCountry.timeZone).dateStr;
    soonerMilestoneDaysAway = Math.max(0, diffCalendarDays(currentLocalDateInMsTz, ms.date));
    break;
  }

  // 6. Dual Status & Timezone Bridge
  const resolvePersonStatus = (
    /** @type {string} */ personKey,
    /** @type {'primary'|'secondary'} */ slot
  ) => {
    const override =
      liveState?.statusOverrides?.[personKey] ??
      liveState?.statusOverrides?.[slot] ??
      null;
    let countryCode = config.homeCountryCode;
    let cityNote = '';
    let isAutoSyncedToReunion = false;

    const soloLocs = config.defaultSoloLocations || {};
    const getPhaseDefault = (phaseKey) => {
      const phaseObj = soloLocs[phaseKey] || {};
      return phaseObj[personKey] || phaseObj[slot] || { countryCode: config.homeCountryCode, cityNote: '' };
    };

    if (phase === 'TOGETHER' && activeLegWindow) {
      const overrideMs = override?.updatedAt ? Date.parse(override.updatedAt) : NaN;
      if (override?.countryCode && Number.isFinite(overrideMs) && overrideMs > activeLegWindow.startMs) {
        countryCode = override.countryCode;
        cityNote = override.cityNote ?? '';
        isAutoSyncedToReunion = false;
      } else {
        countryCode = activeLegWindow.leg.countryCode;
        cityNote = '';
        isAutoSyncedToReunion = true;
      }
    } else if (override?.countryCode) {
      countryCode = override.countryCode;
      cityNote = override.cityNote ?? '';
      isAutoSyncedToReunion = false;
    } else if (phase === 'PRE_TRIP') {
      const def = getPhaseDefault('preTrip');
      countryCode = def.countryCode;
      cityNote = def.cityNote ?? '';
    } else {
      // APART default solo locations based on which separation phase we are in
      const firstReunion = reunionWindows[0] ?? null;
      const secondReunion = reunionWindows[1] ?? null;
      if (firstReunion && nowMs < firstReunion.startMs) {
        if (slot === 'secondary' && nowMs < secondaryDepartureStartMs) {
          const def = getPhaseDefault('preTrip');
          countryCode = def.countryCode;
          cityNote = def.cityNote ?? '';
        } else {
          const def = getPhaseDefault('apartPhase1');
          countryCode = def.countryCode;
          cityNote = def.cityNote ?? '';
        }
      } else if (secondReunion && nowMs < secondReunion.startMs) {
        const def = getPhaseDefault('apartPhase2');
        countryCode = def.countryCode;
        cityNote = def.cityNote ?? '';
      } else {
        const def = getPhaseDefault('apartPhase3');
        countryCode = def.countryCode;
        cityNote = def.cityNote ?? '';
      }
    }

    const countryInfo = resolveCountry(countryCode);
    const zonedParts = getZonedDateParts(nowMs, countryInfo.timeZone);
    const utcOffsetMinutes = getUtcOffsetMinutes(nowMs, countryInfo.timeZone);

    return {
      person: personKey,
      slot,
      displayName: config.coupleNames?.[personKey] || personKey,
      countryCode: countryInfo.code,
      countryName: countryInfo.name,
      flag: countryInfo.flag,
      timeZone: countryInfo.timeZone,
      cityNote,
      localTimeFormatted: zonedParts.timeStr,
      utcOffsetMinutes,
      isAutoSyncedToReunion
    };
  };

  const primaryStatus = resolvePersonStatus(firstPartnerKey, 'primary');
  const secondaryStatus = resolvePersonStatus(secondPartnerKey, 'secondary');
  const rawHourDiff = Math.abs(primaryStatus.utcOffsetMinutes - secondaryStatus.utcOffsetMinutes) / 60;
  const hourDifference = Number.isInteger(rawHourDiff) ? rawHourDiff : Number(rawHourDiff.toFixed(1));
  const isSameTimeZone = hourDifference === 0;
  const bridgeLabel = isSameTimeZone ? 'Same time zone! 🎉' : `${hourDifference}h apart`;

  // 7. Timeline Partitioning & Trip Together Stats
  const plannedTripDaysTogether = reunionWindows.reduce((sum, rw) => sum + rw.totalReunionDays, 0);
  const completedTripDaysTogether = reunionWindows.reduce((sum, rw) => {
    if (nowMs > rw.endMs) {
      return sum + rw.totalReunionDays;
    }
    if (nowMs >= rw.startMs && nowMs <= rw.endMs && activeReunion?.reunion.id === rw.reunion.id) {
      return sum + activeReunion.dayOfReunion;
    }
    return sum;
  }, 0);

  /** @type {Map<string, { countryCode: string, countryName: string, flag: string, days: number }>} */
  const countryDaysMap = new Map();
  for (const rw of reunionWindows) {
    for (const lw of rw.legWindows) {
      const code = lw.country.code;
      const customLabel = lw.leg.label?.trim();
      const mapKey = customLabel ? `${code}:${customLabel}` : code;
      const existing = countryDaysMap.get(mapKey) || {
        countryCode: code,
        countryName: customLabel || lw.country.name,
        flag: lw.country.flag,
        days: 0
      };
      existing.days += lw.totalLegDays;
      countryDaysMap.set(mapKey, existing);
    }
  }
  const countryDaysBreakdown = Array.from(countryDaysMap.values());

  const timelineDescriptors = [
    ...allMilestones.map((ms) => {
      const msCountry = resolveCountry(ms.countryCode || config.homeCountryCode);
      const startMs = getStartOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
      const endMs = getEndOfDayInTimeZoneMs(ms.date, msCountry.timeZone);
      return {
        item: ms,
        sortDate: ms.date,
        startMs,
        endMs,
        typeOrder: 0
      };
    }),
    ...reunionWindows.map((rw) => ({
      item: rw.reunion,
      sortDate: rw.reunion.startDate,
      startMs: rw.startMs,
      endMs: rw.endMs,
      typeOrder: 1
    }))
  ].sort((a, b) => {
    const dateCmp = a.sortDate.localeCompare(b.sortDate);
    if (dateCmp !== 0) {
      return dateCmp;
    }
    if (a.typeOrder !== b.typeOrder) {
      return a.typeOrder - b.typeOrder;
    }
    return a.startMs - b.startMs;
  });

  /** @type {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} */
  const pastItems = [];
  /** @type {Array<import('./config.js').MilestoneEvent | import('./config.js').ReunionChapter>} */
  const upcomingItems = [];

  for (const desc of timelineDescriptors) {
    if (nowMs > desc.endMs) {
      pastItems.push(desc.item);
    } else {
      upcomingItems.push(desc.item);
    }
  }

  return {
    nowMs,
    phase,
    phaseBannerText,
    relationshipDuration,
    primaryCountdown,
    departureCountdown: phase === 'PRE_TRIP' ? departureCountdown : null,
    activeReunion,
    soonerMilestone,
    soonerMilestoneDaysAway,
    dualStatus: {
      [firstPartnerKey]: primaryStatus,
      [secondPartnerKey]: secondaryStatus,
      primary: primaryStatus,
      secondary: secondaryStatus,
      hourDifference,
      isSameTimeZone,
      bridgeLabel
    },
    timeline: {
      plannedTripDaysTogether,
      completedTripDaysTogether,
      countryDaysBreakdown,
      pastItems,
      upcomingItems
    }
  };
}

// Backward-Compatibility Barrel Re-exports
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

export {
  computeRelationshipDuration,
  generateMonthlyAnniversaries
} from './anniversaries.js';
```

---

## 5. Verification Method

### 5.1 Verification Commands
To independently verify the implementation after Worker M2 creates the modules:

1. **Run Full Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected Result*: All 25 tests pass identically with 0 failures (`duration_ms < 250ms`).

2. **Verify Module Export Surfaces via Node REPL**:
   ```bash
   node --input-type=module -e "
     import * as engine from './js/countdown-engine.js';
     const expectedExports = [
       'MS_PER_SECOND', 'MS_PER_MINUTE', 'MS_PER_HOUR', 'MS_PER_DAY',
       'parseIsoDateParts', 'diffCalendarDays', 'getDaysInMonth',
       'getZonedDateParts', 'getUtcOffsetMinutes', 'getZonedWallClockEpochMs',
       'getStartOfDayInTimeZoneMs', 'getEndOfDayInTimeZoneMs',
       'formatDisplayDate', 'formatShortDisplayDate',
       'computeRelationshipDuration', 'generateMonthlyAnniversaries',
       'decomposeRemainingMs', 'getLegDurationDays', 'getReunionDurationDays',
       'resolveReunionWindows', 'resolvePartnerConfigMeta', 'evaluateBoardState'
     ];
     for (const exp of expectedExports) {
       if (!(exp in engine)) throw new Error('Missing expected export: ' + exp);
     }
     console.log('All 22 exports verified on js/countdown-engine.js');
   "
   ```

3. **Verify Pure Independence of Submodules**:
   ```bash
   node --input-type=module -e "
     import './js/date-utils.js';
     import './js/anniversaries.js';
     import './js/countdown-engine.js';
     console.log('Modules load cleanly with zero ambient DOM or Date.now() side effects');
   "
   ```

4. **Verify Zero-Knowledge Security Invariants**:
   ```bash
   node --test tests/integration.test.mjs
   ```

### 5.2 Invalidation Conditions
The refactoring is invalidated if any of the following occur:
- Any test in `tests/countdown-engine.test.mjs` or `tests/integration.test.mjs` fails.
- Any named export previously available in `countdown-engine.js` is missing or undefined.
- Any reference to ambient `window` or `document` exists in `countdown-engine.js`, `date-utils.js`, or `anniversaries.js`.
- Any call to `Date.now()` is introduced inside calculation engines.
- `publicFilesToAudit` in `tests/integration.test.mjs` triggers a security failure.
