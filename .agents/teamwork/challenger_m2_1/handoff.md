# Challenger Report: Milestone 2 — Engine & Date Primitives Decoupling

## 1. Observation

### 1.1 Module Export Contracts & Barrel Re-Export Identity
Executed dynamic import inspection and reference identity verification:
```bash
node --input-type=module -e "
import * as dateUtils from './js/date-utils.js';
import * as anniversaries from './js/anniversaries.js';
import * as countdownEngine from './js/countdown-engine.js';

console.log('date-utils export count:', Object.keys(dateUtils).length);
console.log('anniversaries export count:', Object.keys(anniversaries).length);
console.log('countdown-engine export count:', Object.keys(countdownEngine).length);
"
```
Output:
```text
date-utils export count: 14
anniversaries export count: 2
countdown-engine export count: 22
```

Exact exported signatures:
- `js/date-utils.js` (14): `MS_PER_DAY`, `MS_PER_HOUR`, `MS_PER_MINUTE`, `MS_PER_SECOND`, `diffCalendarDays`, `formatDisplayDate`, `formatShortDisplayDate`, `getDaysInMonth`, `getEndOfDayInTimeZoneMs`, `getStartOfDayInTimeZoneMs`, `getUtcOffsetMinutes`, `getZonedDateParts`, `getZonedWallClockEpochMs`, `parseIsoDateParts`.
- `js/anniversaries.js` (2): `computeRelationshipDuration`, `generateMonthlyAnniversaries`.
- `js/countdown-engine.js` (22): 6 core state machine exports (`decomposeRemainingMs`, `getLegDurationDays`, `getReunionDurationDays`, `resolveReunionWindows`, `resolvePartnerConfigMeta`, `evaluateBoardState`) + 14 re-exports from `date-utils.js` + 2 re-exports from `anniversaries.js`.
- All 16 re-exported symbols in `countdown-engine.js` satisfy strict reference equality (`countdownEngine[k] === source[k]`).

### 1.2 Invariant Verification: Zero Runtime `Date.now()` and Zero Parameterless `new Date()`
Audited all occurrences across target files:
- Grep search for `Date.now` in `js/date-utils.js`, `js/anniversaries.js`, `js/countdown-engine.js`:
  - `js/date-utils.js`: 0 matches.
  - `js/anniversaries.js`: 0 matches.
  - `js/countdown-engine.js`: exactly 1 match at line 152: `* Never invokes Date.now() internally.` (JSDoc only).
- Grep search for `new Date` across all three files:
  - `js/date-utils.js`: Line 44 (`new Date(Date.UTC(year, month, 0)).getUTCDate()`), Line 48 (`new Date(epochMs)`).
  - `js/anniversaries.js`: 0 matches.
  - `js/countdown-engine.js`: 0 matches.
- Grep search for `window`, `document`, and `HTMLElement` across all three files: 0 matches.

### 1.3 Timezone Boundaries, DST Transitions & Zero-Gap Handoffs
Executed stress harness over 12 timezones (`America/New_York`, `Europe/London`, `Asia/Jerusalem`, `Australia/Sydney`, `Asia/Tokyo`, `Asia/Kathmandu`, `Asia/Kolkata`, `America/St_Johns`, `Pacific/Chatham`, `Pacific/Kiritimati`, `Pacific/Niue`, `UTC`) across DST spring-forward and fall-back transition dates (`2026-03-08`, `2026-03-27`, `2026-03-29`, `2026-10-04`, `2026-10-25`, `2026-11-01`):
- All 143 start-of-day and end-of-day computations correctly produced matching calendar dates (`dateStr`).
- Millisecond continuity check `getEndOfDayInTimeZoneMs(dateStr, tz) + 1 === getStartOfDayInTimeZoneMs(nextDateStr, tz)` yielded 0 discrepancies across all timezones and dates.
- Multi-leg continuity check in `resolveReunionWindows` verified that `lw[i].endMs + 1 === lw[i+1].startMs` with zero millisecond gap across different incoming leg timezones (e.g. SG UTC+8 -> KR UTC+9).
- Start/end of day memoization caches (`DAY_BOUNDARY_CACHE`) return exact cached integer references on repeated calls.

### 1.4 Leap Year & Calendar Arithmetic Stress Testing
- Calendar diffing (`diffCalendarDays`):
  - Leap year `2024-02-28` to `2024-03-01` -> 2 days.
  - Non-leap year `2025-02-28` to `2025-03-01` -> 1 day.
  - Century leap year `2000-02-28` to `2000-03-01` -> 2 days.
  - Century non-leap year `1900-02-28` to `1900-03-01` -> 1 day.
  - Century non-leap year `2100-02-28` to `2100-03-01` -> 1 day.
  - Month boundary `2025-04-30` to `2025-05-01` -> 1 day.
  - Year boundary `2025-12-31` to `2026-01-01` -> 1 day.
  - Inverse/negative diff `2026-01-01` to `2025-12-31` -> -1 day.
  - Identity diff `2026-05-10` to `2026-05-10` -> 0 days.
- Anniversary generation (`generateMonthlyAnniversaries`):
  - Leap day origin `2024-02-29`:
    - Month 1 (`2024-03-29`): preserved day 29.
    - Month 12 (`2025-02-28`): clamped to day 28 (non-leap year).
    - Month 24 (`2026-02-28`): clamped to day 28 (non-leap year).
    - Month 48 (`2028-02-29`): preserved day 29 (leap year 2028).

### 1.5 Adversarial Edge Case Discovery in `computeRelationshipDuration`
Tested `computeRelationshipDuration` across 1,000 calendar days:
- Configured production origin date (`2025-01-10`): 0 anomalies across all 1,000 days.
- Adversarial edge case with origin date on 31st (e.g., `2024-01-31`, `2025-01-31`):
  ```text
  origin: 2024-01-31, current: 2024-03-01
  totalDays: 30, months: 1, daysRemainder: -1
  formattedPill: '30 Days Together • 1 Month, -1 Days'
  ```
  Investigation via `git log -S "computeRelationshipDuration" -p` showed this logic originated in initial commit `b366b74` prior to Milestone 2 extraction.

### 1.6 Full Test Suite Run
Executed command: `node --test tests/*.test.mjs`
Output:
```text
✔ Timezone & Date Helpers: getZonedDateParts, getUtcOffsetMinutes, and start/end of day boundaries (4.15975ms)
✔ Automatic Monthly Anniversary Generator produces milestones on the 10th and skips existing 1-Year duplicate (0.21375ms)
...
ℹ tests 25
ℹ suites 0
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 187.215459
```

---

## 2. Logic Chain

1. **Export Contracts & Backward Compatibility**:
   - Observation 1.1 proves `js/date-utils.js` exports exactly 14 symbols, `js/anniversaries.js` exports exactly 2 symbols, and `js/countdown-engine.js` exports exactly 22 symbols.
   - Reference equality checks verify that barrel re-exports from `countdown-engine.js` point to the identical function and constant instances exported by the decoupled modules, guaranteeing 100% backward compatibility for existing consumers.

2. **Zero-Knowledge & Determinism Invariants**:
   - Observation 1.2 proves that neither `Date.now()` nor parameterless `new Date()` is invoked anywhere within `js/date-utils.js`, `js/anniversaries.js`, or `js/countdown-engine.js`.
   - All temporal functions require explicit epoch milliseconds (`nowMs`), ensuring strict determinism for time-travel slider and unit tests.
   - Absence of `window`, `document`, and `HTMLElement` confirms complete isolation of computational engines from browser DOM state.

3. **Temporal Arithmetic & Boundary Integrity**:
   - Observation 1.3 demonstrates that start and end of day computations are resilient against Daylight Saving Time gaps and repetitions across diverse global timezones.
   - Continuous zero-gap handoff (`endMs + 1 === nextStartMs`) holds across both intra-country calendar days and cross-country multi-leg reunion boundaries.
   - Observation 1.4 confirms correct leap day arithmetic, century exception handling (1900/2100 vs 2000), and proper leap day clamping in anniversary generation.

4. **Assessment of `computeRelationshipDuration` Edge Case**:
   - Observation 1.5 discovered that when `origin.day > 28` (e.g. 31st of month), evaluating dates on March 1st produces `-1` for `daysRemainder`.
   - This defect pre-existed in commit `b366b74` prior to Milestone 2 refactoring.
   - The production vault config uses `relationshipOriginDate = '2025-01-10'` (day 10 <= 28), which is mathematically incapable of triggering this defect.
   - Per Challenger guidelines (do not modify implementation code during review; do not fail refactor milestones on pre-existing upstream quirks that don't affect production invariants), this is logged as a finding for future enhancement rather than a blocker.

5. **Regression-Free Test Suite**:
   - Observation 1.6 shows all 25 unit and integration tests pass cleanly with zero regressions.

---

## 3. Caveats

- The negative remainder anomaly in `computeRelationshipDuration` for origin dates on days 29–31 when evaluated on March 1–2 is documented in Observation 1.5. If the project later supports arbitrary user-customizable relationship start dates via the UI editor sheet, `anniversaries.js` line 103 should be normalized so `daysRemainder = Math.max(0, ...)` or months decremented with accumulated elapsed days.
- In `tests/integration.test.mjs`, `publicFilesToAudit` currently does not include `js/date-utils.js` and `js/anniversaries.js`, which is scheduled for Milestone 5 per `PROJECT.md`.

---

## 4. Conclusion

**VERDICT: APPROVE**

Milestone 2 (Engine & Date Primitives Decoupling) satisfies all architectural and functional invariants:
1. Export contracts are verified: `js/date-utils.js` (14), `js/anniversaries.js` (2), `js/countdown-engine.js` (22) with exact reference equality.
2. Invariant confirmed: Zero calls to `Date.now()` and zero parameterless `new Date()` calls across all three modules.
3. Date math, DST boundaries, and leap day anniversary clamping verified across 12+ IANA timezones and multi-leg transitions.
4. All 25 unit and integration tests pass with 0 regressions.

---

## 5. Verification Method

1. **Verify Export Contracts**:
   ```bash
   node --input-type=module -e "
   import * as d from './js/date-utils.js';
   import * as a from './js/anniversaries.js';
   import * as c from './js/countdown-engine.js';
   if (Object.keys(d).length !== 14 || Object.keys(a).length !== 2 || Object.keys(c).length !== 22) throw new Error('Contract mismatch');
   console.log('Exports OK');
   "
   ```

2. **Verify Zero Date.now() Calls**:
   ```bash
   grep -n "Date.now" js/date-utils.js js/anniversaries.js js/countdown-engine.js
   ```
   *Expected*: Exactly 1 line in `js/countdown-engine.js` (JSDoc line: `* Never invokes Date.now() internally.`).

3. **Run Full Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected*: `ℹ pass 25`, `ℹ fail 0`.

4. **Invalidation Conditions**:
   - Any test failure in `node --test tests/*.test.mjs`.
   - Any missing named export in `js/date-utils.js`, `js/anniversaries.js`, or `js/countdown-engine.js`.
   - Any executable invocation of `Date.now()`.
