# Project: trip-countdown Codebase Modularization

## Architecture
Zero-dependency static PWA (Vanilla HTML5, CSS3, ES2022 Native Modules) deployed to GitHub Pages with offline service worker caching and client-side zero-knowledge AES-256-GCM encryption.

```
trip-countdown/
├── styles/
│   ├── main.css                  [Orchestrator: 9 native @import declarations]
│   ├── base.css                  [Tokens, reset, typography, .numeric-lock, layout]
│   ├── ambient.css               [Ambient stage, photo aura, color glow]
│   ├── gate.css                  [Vault lock overlay, card, form, shared buttons]
│   ├── photo-stack.css           [Hero section, card deck, swipe, date badges, autorotate]
│   ├── countdown-card.css        [Countdown card, phase pill, numerals, preview banner]
│   ├── status-bar.css            [Dual partner cards, clocks, tz bridge]
│   ├── timeline.css              [Chronological timeline, cards, stepper, breakdown list]
│   ├── sheets-and-modals.css     [Bottom sheets, leg editor, modals, FAB]
│   └── responsive.css            [Breakpoints >=540px]
├── js/
│   ├── config.js                 [PRESERVED]
│   ├── date-utils.js             [Pure date math, timezone offsets, wall-clock conversion]
│   ├── anniversaries.js          [Relationship duration & monthly anniversaries]
│   ├── countdown-engine.js       [Pure board state engine + backward-compatible barrel re-exports]
│   ├── photo-palette.js          [HSL/RGB conversions, pastel clamping, luminous palette extraction]
│   ├── photo-badge.js            [Calendar page date badge DOM rendering]
│   ├── photo-stack.js            [PhotoStackController, fallback photos + backward-compatible barrel re-exports]
│   ├── ui-gestures.js            [Touch & pointer drag-to-dismiss sheet gestures]
│   ├── ui-modals.js              [DaysBreakdownModal & EventCountdownModal controllers]
│   ├── ui-status-sheet.js        [StatusEditSheet controller & populateCountrySelect helper]
│   ├── ui-editor-sheet.js        [TimelineEditorSheet controller with dynamic leg rows CRUD]
│   ├── ui-preview-banner.js      [PreviewBannerController (null-safe/headless)]
│   ├── app.js                    [Streamlined ~300-line lifecycle coordinator]
│   ├── timeline-renderer.js      [PRESERVED]
│   ├── storage-vault.js          [PRESERVED]
│   ├── crypto-vault.js           [PRESERVED]
│   └── github-sync.js            [PRESERVED]
├── sw.js                         [Incremented cache version & all app shell assets]
└── tests/
    ├── countdown-engine.test.mjs [PRESERVED: 100% passing]
    ├── integration.test.mjs      [Expanded publicFilesToAudit for zero-knowledge safety]
    └── storage-vault.test.mjs    [PRESERVED: 100% passing]
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Modular Stylesheets Decomposition | Split monolithic 2,768-line `main.css` into 9 domain stylesheets orchestrated via `@import` | M1 | Survey (R1) |
| 2 | CSS Logical Properties & Zero `!important` | Audit & enforce CSS logical properties and eliminate all 18 `!important` occurrences | M1 | Survey (R1) |
| 3 | Date & Timezone Primitives | Extract 10 pure date/tz math functions into `js/date-utils.js` | M2 | Survey (R2) |
| 4 | Relationship Anniversaries | Extract duration count-up and monthly milestone generation into `js/anniversaries.js` | M2 | Survey (R2) |
| 5 | Board State Evaluation & Facade | Retain board state machine in `js/countdown-engine.js` with 100% backward-compatible barrel re-exports | M2 | Survey (R2) |
| 6 | Color Conversion & Palette Extraction | Extract HSL/RGB math, pastel clamping, and luminous palette extraction into `js/photo-palette.js` | M3 | Survey (R3) |
| 7 | Calendar Date Badge Component | Extract date badge DOM rendering into `js/photo-badge.js` | M3 | Survey (R3) |
| 8 | Photo Stack Controller & Facade | Retain `PhotoStackController` and `FALLBACK_PHOTOS` in `js/photo-stack.js` with barrel re-exports | M3 | Survey (R3) |
| 9 | Drag-to-Dismiss Sheet Gestures | Extract touch/mouse downward drag gestures into `js/ui-gestures.js` | M4 | Survey (R4) |
| 10 | Countdown & Breakdown Modals | Extract `DaysBreakdownModal` and `EventCountdownModal` into `js/ui-modals.js` | M4 | Survey (R4) |
| 11 | Location & Status Edit Sheet | Extract `StatusEditSheet` and `populateCountrySelect` into `js/ui-status-sheet.js` | M4 | Survey (R4) |
| 12 | Timeline Item Editor Sheet | Extract `TimelineEditorSheet` with dynamic multi-leg CRUD into `js/ui-editor-sheet.js` | M4 | Survey (R4) |
| 13 | Time-Travel Preview Banner | Extract `PreviewBannerController` into `js/ui-preview-banner.js` (defensive against missing DOM elements) | M4 | Survey (R4) |
| 14 | Streamlined App Coordinator | Refactor `js/app.js` into ~300-line lifecycle coordinator wiring all sub-controllers | M4 | Survey (R4) |
| 15 | Service Worker Shell Assets | Increment cache version to `trip-countdown-board-v5` and include all 30 assets | M5 | Survey (R5) |
| 16 | Zero-Knowledge Security Audit | Expand `publicFilesToAudit` in `tests/integration.test.mjs` to audit all 35 public files | M5 | Survey (R5) |
| 17 | Full Test Suite Verification | Verify all 25 unit/integration tests pass with 0 regressions (`node --test tests/*.test.mjs`) | M5 | Survey (R5) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Modular Stylesheets (`styles/`) | Split `main.css` into 9 domain stylesheets + orchestrator, eliminate `!important`, enforce logical properties | None | DONE |
| M2 | Engine & Date Primitives Decoupling | Create `date-utils.js`, `anniversaries.js`, update `countdown-engine.js` with barrel re-exports | None | DONE |
| M3 | Photo Stack & Color Decoupling | Create `photo-palette.js`, `photo-badge.js`, update `photo-stack.js` with barrel re-exports | None | DONE |
| M4 | UI Sub-Controllers & App Coordinator | Create `ui-gestures.js`, `ui-modals.js`, `ui-status-sheet.js`, `ui-editor-sheet.js`, `ui-preview-banner.js`, streamline `app.js` | M1, M2, M3 | DONE |
| M5 | PWA Caching & Security Audit | Update `sw.js`, expand `tests/integration.test.mjs`, run full test suite and verify 100% pass | M1, M2, M3, M4 | DONE |

## Interface Contracts

### M1 Stylesheet Cascade Order (`styles/main.css`)
```css
@import './base.css';
@import './ambient.css';
@import './gate.css';
@import './photo-stack.css';
@import './countdown-card.css';
@import './status-bar.css';
@import './timeline.css';
@import './sheets-and-modals.css';
@import './responsive.css';
```

### M2 Engine Contracts
- `js/date-utils.js`:
  - `parseIsoDateParts(dateStr)`
  - `diffCalendarDays(startDateStr, endDateStr)`
  - `getDaysInMonth(year, month)`
  - `getZonedDateParts(epochMs, timeZone)`
  - `getUtcOffsetMinutes(epochMs, timeZone)`
  - `getZonedWallClockEpochMs(dateStr, timeZone, hour, minute, second, ms)`
  - `getStartOfDayInTimeZoneMs(dateStr, timeZone)`
  - `getEndOfDayInTimeZoneMs(dateStr, timeZone)`
  - `formatDisplayDate(dateStr, options)`
  - `formatShortDisplayDate(dateStr)`
- `js/anniversaries.js`:
  - `computeRelationshipDuration(originDateStr, currentDateStr)`
  - `generateMonthlyAnniversaries(originDateStr, startYearMonth, endYearMonth, existingMilestones, reunions, homeCountryCode)`
- `js/countdown-engine.js`:
  - `decomposeRemainingMs(remainingMs)`
  - `getLegDurationDays(leg, reunion)`
  - `getReunionDurationDays(reunion)`
  - `resolveReunionWindows(reunion)`
  - `resolvePartnerConfigMeta(config)`
  - `evaluateBoardState(config, liveState, nowMs)`
  - Re-exports all functions from `date-utils.js` and `anniversaries.js`

### M3 Photo Contracts
- `js/photo-palette.js`:
  - `rgbToHsl(r, g, b)`, `hslToHex(h, s, l)`, `parseHexColor(hex)`, `clamp(value, min, max)`
  - `clampHslForRole(hsl, role)`
  - `extractPaletteFromPixels(rgbaData)`
  - `extractLuminousPalette(imageSource)`
  - `DEFAULT_LUMINOUS_PALETTE`, `SAMPLE_CANVAS_SIZE`
- `js/photo-badge.js`:
  - `parseDateParts(str)`
  - `createPhotoDateElement(dateLabel, { isCompact })`
- `js/photo-stack.js`:
  - `PhotoStackController`
  - `FALLBACK_PHOTOS`
  - Re-exports all functions from `photo-palette.js` and `photo-badge.js`

### M4 UI Controllers & App Contracts
- `js/ui-gestures.js`:
  - `bindSheetDragGestures(sheetElement, dragTargetElement, onClose, options)` -> returns unbind cleanup `() => void`
- `js/ui-modals.js`:
  - `DaysBreakdownModal`: `open(boardState)`, `close()`, `isOpen()`, `destroy()`
  - `EventCountdownModal`: `open(item, boardState)`, `close()`, `updateCountdown(nowMs, boardState)`, `getActiveItem()`, `isOpen()`, `destroy()`
- `js/ui-status-sheet.js`:
  - `StatusEditSheet`: `mount(tripConfig, partnerNames)`, `open(boardState)`, `close()`, `syncForm(boardState)`, `setActiveProfile(profile, boardState)`, `updateSyncBadge(stateKey, text)`, `destroy()`
  - `populateCountrySelect(selectEl, selectedCode, pinnedCodes)`
- `js/ui-editor-sheet.js`:
  - `TimelineEditorSheet`: `mount(tripConfig)`, `open(item, focusLegIndex)`, `close()`, `isOpen()`, `setMode(mode)`, `renderChapterLegRows(legs, focusLegIndex)`, `appendChapterLegRow()`, `collectChapterLegsFromDom()`, `destroy()`
- `js/ui-preview-banner.js`:
  - `PreviewBannerController`: `setTripConfig(tripConfig)`, `setPreviewTimestamp(epochMs, presetId)`, `getPreviewTimestamp()`, `stepDays(days)`, `reset()`, `destroy()` (defensive against missing `#preview-banner` and `#time-travel-slider`)
- `js/app.js`:
  - Streamlined `CountdownBoardApp` coordinating bootstrap, vault gate, sub-controllers, 1Hz tick, and navigation.

### M5 PWA & Security Contracts
- `sw.js`:
  - `CACHE_NAME = 'trip-countdown-board-v5'`
  - `APP_SHELL_ASSETS` contains all 30 public files
- `tests/integration.test.mjs`:
  - `publicFilesToAudit` contains all 35 public files
  - Full test suite passes 100%: `node --test tests/*.test.mjs`

## Code Layout
- Exclusive ownership per milestone:
  - M1: `styles/*.css`
  - M2: `js/date-utils.js`, `js/anniversaries.js`, `js/countdown-engine.js`
  - M3: `js/photo-palette.js`, `js/photo-badge.js`, `js/photo-stack.js`
  - M4: `js/ui-gestures.js`, `js/ui-modals.js`, `js/ui-status-sheet.js`, `js/ui-editor-sheet.js`, `js/ui-preview-banner.js`, `js/app.js`
  - M5: `sw.js`, `tests/integration.test.mjs`
