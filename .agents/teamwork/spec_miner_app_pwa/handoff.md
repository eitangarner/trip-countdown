# Specification Mining Report: App Coordinator, UI Sub-Controllers, PWA Caching & Security Audits

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Gestures | `bindSheetDragGestures` | Binds touch and pointer downward drag gestures on bottom sheets (`#edit-bottom-sheet`, `#timeline-item-sheet`) and handles | `sheetElement: HTMLElement \| null`, `dragTargetElement: HTMLElement \| null`, `onClose: () => void`, `options?: { threshold?: number }` | `() => void` (cleanup / unbind function) | Safe no-op if elements are `null`; ignores gestures if sheet lacks `.is-open`; ignores upward drag; prevents scrolling during active downward drag | `js/app.js:897-968`, `index.html:240,317` |
| 2 | Modals | `DaysBreakdownModal` | Manages the "Days Together by Country" popup dialog (`#days-breakdown-modal`), displaying total days and per-country day counts | Options: `{ modalEl, backdropEl, totalPillEl, listEl, closeBtn, doneBtn, onClose }` | Controller instance with `open(boardState)`, `close()`, `isOpen()`, `destroy()` | Gracefully handles empty or missing country list; sanitizes inputs; locks numerals (`.numeric-lock`, `dir="ltr"`) | `js/app.js:1348-1376`, `index.html:506-532` |
| 3 | Modals | `EventCountdownModal` | Manages event / milestone popup (`#event-modal`), real-time countdown grid (`#event-cd-*`), badge emoji, date pill, and delegating to editor | Options: `{ modalEl, backdropEl, titleEl, badgeEl, datePillEl, travelTagEl, locationEl, statusPillEl, cdDaysEl, cdHoursEl, cdMinutesEl, cdSecondsEl, closeBtn, doneBtn, editBtn, onEdit, onClose }` | Controller instance with `open(item, boardState)`, `close()`, `updateCountdown(nowMs, boardState)`, `getActiveItem()`, `isOpen()`, `destroy()` | Evaluates zoned start/end of day boundaries; classifies into upcoming, active, or completed; sets `00` for completed | `js/app.js:1378-1496`, `index.html:452-504` |
| 4 | Sheets | `StatusEditSheet` | Manages quick location and vibe update bottom sheet (`#edit-bottom-sheet`), profile selector, country dropdown, city note input, sync pill, and app lock | Options: `{ sheetEl, backdropEl, handleWrapperEl, headerEl, closeBtn, formEl, syncStatusPill, segBtnPrimary, segBtnSecondary, countryLabel, countrySelect, noteLabel, noteInput, clearBtn, lockBtn, onSaveStatus, onClearStatus, onLockApp, onClose }` | Controller instance with `mount(tripConfig, partnerNames)`, `open(boardState)`, `close()`, `syncForm(boardState)`, `setActiveProfile(profile, boardState)`, `updateSyncBadge(stateKey, text)`, `destroy()` | Restricts city notes to 60 chars; safely handles missing or null DOM controls; persists preferred profile to `localStorage` | `js/app.js:642-713, 1565-1598`, `index.html:238-311` |
| 5 | Shared UI | `populateCountrySelect` | Populates `<select>` elements with Pinned Destinations optgroup followed by all 249 ISO countries (A–Z) with flags | `selectEl: HTMLSelectElement \| null`, `selectedCode?: string`, `pinnedCodes?: string[]` | `void` (mutates select DOM) | Safe no-op if `selectEl` is `null`; skips unknown ISO codes | `js/app.js:64-100` |
| 6 | Sheets | `TimelineEditorSheet` | Manages dynamic milestone and chapter CRUD bottom sheet (`#timeline-item-sheet`), switching between milestone and chapter modes, form validation, and save | Options: `{ sheetEl, backdropEl, handleWrapperEl, headerEl, titleEl, closeBtn, formEl, typeToggleGroup, typeMilestoneBtn, typeChapterBtn, itemIdInput, milestoneFields, titleInput, dateInput, personSelect, countrySelect, detailsInput, chapterFields, chapterTitleInput, chapterEmojiInput, chapterLegsList, addLegBtn, chapterDescInput, saveBtn, deleteBtn, onSaveMilestone, onSaveChapter, onDeleteItem, onClose }` | Controller instance with `mount(tripConfig)`, `open(item, focusLegIndex)`, `close()`, `setMode(mode)`, `renderChapterLegRows(legs, focusLegIndex)`, `appendChapterLegRow()`, `collectChapterLegsFromDom()`, `syncAutoChapterTitleWithLegCount(legCount)`, `destroy()` | Disables leg deletion when only 1 leg remains; auto-corrects `endDate < startDate`; enforces required fields per mode | `js/app.js:716-881, 1004-1346`, `index.html:314-449` |
| 7 | Sheets | Dynamic Leg Rows CRUD | Dynamically appends, removes, and populates country leg cards in the chapter editor, maintaining dates and auto-suggesting unused countries | `legs: ReunionLeg[]`, `focusLegIndex?: number \| null` | Mutates `#tl-chapter-legs-list` DOM | Auto-scrolls and focuses newly added leg; defaults start date to previous leg's end date; maintains 1-leg minimum | `js/app.js:1051-1259` |
| 8 | Preview | `PreviewBannerController` | Controls Time-Travel Preview state, step navigation, reset button, and syncing simulated timestamp to board coordinator | Options: `{ bannerEl?, dateEl?, resetBtn?, sliderEl?, sliderDateReadout?, presetChipsContainer?, tripConfig?, onPreviewChange }` | Controller instance with `setTripConfig(tripConfig)`, `setPreviewTimestamp(epochMs, presetId)`, `getPreviewTimestamp()`, `stepDays(days)`, `reset()`, `renderPresets(presets)`, `destroy()` | Fully null-safe against missing DOM elements (since `#preview-banner` was removed from `index.html`); operates headlessly if elements are absent | `js/app.js:1561-1563, 1606-1614`, git commit `d5731353` |
| 9 | Coordinator | `CountdownBoardApp` (Streamlined) | High-level orchestrator coordinating authentication gate, lifecycle, 1Hz tick evaluation, sub-controller dispatch, view switching, and offline sync | Minimal DOM cache `{ ambientStage, vaultOverlay, vaultForm, vaultPasswordInput, vaultRememberCheckbox, vaultErrorMsg, vaultUnlockBtn, boardContainer, viewCountdown, viewTimeline, bottomNav, navBtnCountdown, navBtnTimeline, fabEditBtn, lockDeviceBtn, ...countdownCards, ...statusCards }` | Application singleton instance with `init()`, `mountUnlockedVault()`, `lockAndPurgeBoard()`, `startTickLoop()`, `stopTickLoop()`, `tick()`, `switchView()` | Traps unlock errors with card shake animation; scrubs RAM upon lock; skips ticks when `document.hidden`; syncs signature diffs | `js/app.js:102-600, 1605-1789` |
| 10 | PWA Cache | Service Worker Cache Contract | Increments cache name to `trip-countdown-board-v5` and includes all 30 app shell assets (including all newly modularized `.css` and `.js` files) | Cache name string, asset array | Static cache pre-caching during install, stale-while-revalidate for assets, network-first for live-state/vault | Cache deletion of old versions during activate; network fallback | `sw.js:1-41` |
| 11 | Security | Integration Security Audit | Audits all 35 public files against `forbiddenPatterns` to verify zero cleartext personal names, itinerary dates, epoch timestamps, or tokens | File list array `publicFilesToAudit` | `node --test tests/integration.test.mjs` pass | Throws assertion failure identifying exact offending file and regex pattern | `tests/integration.test.mjs:184-237` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `bindSheetDragGestures` | Drag delta < threshold (e.g. 40px < 80px) | Sheet resets to `translateY(0)` without firing `onClose()`. Inline styles cleared. |
| 2 | `bindSheetDragGestures` | User drags upward (`deltaY < 0`) | Drag is ignored (`deltaY > 0` guard); default scrolling/rubber-banding behavior preserved. |
| 3 | `bindSheetDragGestures` | Sheet scrolled down (`sheetElement.scrollTop > 0`) | Drag gesture does not activate, allowing natural upward/downward internal scrolling. |
| 4 | `EventCountdownModal` | Active event date is in the past (`nowMs > targetEndMs`) | Status pill displays "Completed Event", countdown numerals freeze at `00:00:00:00`. |
| 5 | `EventCountdownModal` | Event is today (`targetStartMs <= nowMs <= targetEndMs`) | Status pill gets `.is-active` and text "Happening Today 🎉" or "Active Chapter 💕". |
| 6 | `StatusEditSheet` | Partner switch while sheet open | Resets country `<select>` and city note `<input>` to target partner's evaluated state; updates profile segmented buttons. |
| 7 | `StatusEditSheet` | Reset to Auto Schedule clicked | Removes target partner's entry from `liveState.statusOverrides`, evaluates auto schedule, saves to GitHub/localStorage. |
| 8 | `TimelineEditorSheet` | Chapter leg with `endDate < startDate` | Automatically clamped to `endDate = startDate` on submit so duration is never negative. |
| 9 | `TimelineEditorSheet` | Chapter leg remove button clicked when only 1 leg exists | Button is disabled (`disabled = true`, title explains chapter requires at least one country); removal is blocked. |
| 10 | `TimelineEditorSheet` | Base timeline item deleted (not custom) | Base item cannot be physically erased from immutable vault; instead marked `hidden: true` in `milestoneOverrides` or `chapterOverrides`. |
| 11 | `PreviewBannerController` | `#preview-banner` and `#time-travel-slider` missing in DOM | Methods execute without throwing errors; `getPreviewTimestamp()` returns `null`; board evaluates live timestamp. |
| 12 | `CountdownBoardApp` | User enters incorrect password | Vault card shakes with `.is-error` animation, inline message shows "Incorrect password — please try again.", vault remains locked. |
| 13 | `CountdownBoardApp` | Browser tab switched to background (`document.hidden === true`) | 1Hz `setInterval` skips DOM evaluations to prevent background CPU waste; `visibilitychange` listener immediately triggers `tick()` upon refocus. |
| 14 | `CountdownBoardApp` | Lock App button pressed | `stopTickLoop()` cancels timer; `#githubToken`, `#vaultCryptoKey`, and `#tripConfig` wiped from RAM; IndexedDB and localStorage caches deleted; all DOM text wiped. |
| 15 | Hebrew Text Rendering | City notes or milestone titles containing Hebrew | Elements specify `dir="auto"` ensuring RTL alignment; date, numeral, and offset containers apply `.numeric-lock` (`dir="ltr"`, `unicode-bidi: isolate`) to prevent inverted numbers. |

---

## 1. Observation

1. **Monolithic `js/app.js` (1,788 lines)**:
   - `js/app.js` handles all UI responsibilities in a single class `CountdownBoardApp`.
   - Lines 897–968 define `bindSheetDragGestures(sheet, dragTarget, onClose)`.
   - Lines 1348–1376 define `openDaysBreakdownModal()` and `closeDaysBreakdownModal()`.
   - Lines 1378–1496 define `openEventModal(item)`, `closeEventModal()`, and `updateEventModalCountdown()`.
   - Lines 642–713 and 1565–1598 define status edit sheet handlers and profile selector logic.
   - Lines 716–881 and 1004–1346 define timeline item editor mode toggling, dynamic leg card rendering (`renderChapterLegRows`), leg appending (`appendChapterLegRow`), leg harvesting (`collectChapterLegsFromDom`), and CRUD saving.
   - Lines 1561–1563 define `getEffectiveNowMs() { return Date.now(); }`.

2. **Removal of Preview Banner Elements from `index.html`**:
   - In commit `d5731353543eed065b63445a5fd80ae01fb1c9c7` ("fixed ui issues"), `#preview-banner` and `#time-travel-slider` were removed from `index.html`.
   - `tests/integration.test.mjs` lines 268–270 explicitly assert:
     ```javascript
     // Time-travel preview slider and banner removed
     assert.equal(html.includes('id="time-travel-slider"'), false);
     assert.equal(html.includes('id="preview-banner"'), false);
     ```
   - In `codebase_refactoring_and_modularization_plan.md` (lines 45, 178–180), `js/ui-preview-banner.js` is specified as a dedicated controller (`PreviewBannerController`).

3. **`sw.js` Cache Version & Assets**:
   - `sw.js` lines 6–21 currently declare:
     ```javascript
     const CACHE_NAME = 'trip-countdown-board-v4';
     const APP_SHELL_ASSETS = [
       './',
       './index.html',
       './manifest.json',
       './styles/main.css',
       './js/config.js',
       './js/storage-vault.js',
       './js/crypto-vault.js',
       './js/countdown-engine.js',
       './js/photo-stack.js',
       './js/timeline-renderer.js',
       './js/github-sync.js',
       './js/app.js'
     ];
     ```

4. **Security Audit File List in `tests/integration.test.mjs`**:
   - `tests/integration.test.mjs` lines 191–209 define `publicFilesToAudit`:
     ```javascript
     const publicFilesToAudit = [
       'index.html',
       'manifest.json',
       'sw.js',
       'live-state.json',
       'styles/main.css',
       'PLAN.md',
       'README.md',
       'AGENTS.md',
       'DESIGN.md',
       'js/config.js',
       'js/storage-vault.js',
       'js/crypto-vault.js',
       'js/countdown-engine.js',
       'js/photo-stack.js',
       'js/timeline-renderer.js',
       'js/github-sync.js',
       'js/app.js'
     ];
     ```
   - The test iterates through this array and tests every file against `forbiddenPatterns` (forbidden couple names, trip departure dates, epoch timestamps, GitHub PAT tokens).

5. **Test Suite Baseline**:
   - Running `node --test tests/*.test.mjs` yields 25 passing tests with 0 failures in ~176ms.

---

## 2. Logic Chain

1. **Extraction of UI Gestures (`js/ui-gestures.js`)**:
   - **Reasoning**: Both `#edit-bottom-sheet` and `#timeline-item-sheet` utilize identical drag-to-dismiss touch logic. Moving this logic into a pure, standalone module `js/ui-gestures.js` eliminates code duplication.
   - **Interface**:
     ```javascript
     export function bindSheetDragGestures(sheetElement, dragTargetElement, onClose, options = {})
     ```
   - **Lifecycle**: Must return an unbind function `() => void` so that any caller or controller cleanup can remove event listeners and prevent memory leaks.

2. **Extraction of Modals (`js/ui-modals.js`)**:
   - **Reasoning**: `DaysBreakdownModal` and `EventCountdownModal` are self-contained dialog surfaces with their own backdrops, close buttons, done buttons, and countdown ticking logic.
   - **Interface**:
     - `DaysBreakdownModal`: `open(boardState)`, `close()`, `isOpen()`, `destroy()`.
     - `EventCountdownModal`: `open(item, boardState)`, `close()`, `updateCountdown(nowMs, boardState)`, `getActiveItem()`, `isOpen()`, `destroy()`.
   - **Decoupling**: `EventCountdownModal` takes an `onEdit(item)` callback. When the user taps `#event-modal-edit-btn`, `EventCountdownModal` closes itself and triggers `onEdit(item)`, which the coordinator routes to `TimelineEditorSheet.open(item)`.

3. **Extraction of Status Bottom Sheet (`js/ui-status-sheet.js`)**:
   - **Reasoning**: The location/vibe sheet manages profile switching (`activeProfile`: primary vs secondary), country select population, city note input, manual override clearance, and app locking.
   - **Interface**:
     - Class `StatusEditSheet`.
     - Options-based constructor caching its internal DOM controls.
     - Callbacks: `onSaveStatus({ targetPartnerKey, countryCode, cityNote })`, `onClearStatus(targetPartnerKey)`, `onLockApp()`, `onClose()`.
     - Export helper `populateCountrySelect(selectEl, selectedCode, pinnedCodes)` for reuse.

4. **Extraction of Timeline Item Editor (`js/ui-editor-sheet.js`)**:
   - **Reasoning**: The timeline item editor contains significant complexity: segmented type toggle (milestone vs chapter), dynamic multi-leg card generation, auto-incrementing chapter title ("Together Across N Countries"), leg removal constraints, and CRUD validation.
   - **Interface**:
     - Class `TimelineEditorSheet`.
     - Methods: `mount(tripConfig)`, `open(item, focusLegIndex)`, `close()`, `isOpen()`, `setMode(mode)`, `renderChapterLegRows(legs, focusLegIndex)`, `appendChapterLegRow()`, `collectChapterLegsFromDom()`, `destroy()`.
     - Callbacks: `onSaveMilestone(data)`, `onSaveChapter(data)`, `onDeleteItem({ id, isChapter })`.

5. **`PreviewBannerController` (`js/ui-preview-banner.js`)**:
   - **Reasoning**: While the banner and slider elements were removed from `index.html` in commit `d5731353` (as confirmed by `tests/integration.test.mjs`), the architecture specification requires modularizing preview banner capabilities.
   - **Design Solution**: `PreviewBannerController` must be implemented defensively:
     - All DOM queries and property assignments check for element existence (`if (this.dom.bannerEl) ...`).
     - Exposes `getPreviewTimestamp()`, `setPreviewTimestamp()`, `stepDays()`, `reset()`.
     - If DOM elements are absent (as in production `index.html`), it safely returns `null` for preview timestamp, meaning the board runs in normal live time without crashing.

6. **Streamlining `CountdownBoardApp` in `js/app.js`**:
   - **Reasoning**: After extracting gestures, modals, and sheets, `js/app.js` is reduced from 1,788 lines to ~300-350 lines.
   - **Core Role**: Coordinator only.
     - Bootstrap (`init`, `loadCachedVault`, `preloadEncryptedVaultJson`, `mountUnlockedVault`).
     - Sub-controller instantiation and callback wiring.
     - 1Hz tick loop calling pure `evaluateBoardState()`.
     - Updating top countdown card, status cards, and timezone bridge.
     - Global navigation (`switchView`) and device locking (`lockAndPurgeBoard`).

7. **Service Worker (`sw.js`) Integrity**:
   - **Reasoning**: Offline PWA functionality requires that all assets needed by the app shell are cached upon installation. When the codebase is split into 9 CSS files and 17 JS files, all new files must be added to `APP_SHELL_ASSETS`, and `CACHE_NAME` must increment to `'trip-countdown-board-v5'` so existing service workers invalidate obsolete caches.

8. **Security Audit in `tests/integration.test.mjs`**:
   - **Reasoning**: The project's zero-knowledge security standard forbids committing any personal names, dates, or secrets in cleartext in any public files. Adding new `.css` and `.js` files requires updating `publicFilesToAudit` so every newly created file is automatically audited by `node --test tests/*.test.mjs`.

---

## 3. Caveats

1. **`index.html` Test Assertion for Slider Removal**:
   - `tests/integration.test.mjs` explicitly checks `assert.equal(html.includes('id="time-travel-slider"'), false)`.
   - Therefore, developers must NOT re-add `#time-travel-slider` or `#preview-banner` into `index.html` unless the test is intentionally modified by user instruction.
   - `PreviewBannerController` in `js/ui-preview-banner.js` must operate safely with `null` DOM elements.

2. **Strict ESM Import Syntax**:
   - All browser modules must use native relative paths ending with `.js` (e.g. `import { bindSheetDragGestures } from './ui-gestures.js'`).
   - No node packages, bundlers, or bare specifiers.

3. **Volatile Key Protection**:
   - `#githubToken` and `#vaultCryptoKey` must remain private instance fields on `CountdownBoardApp`.
   - Sub-controllers must never receive `#githubToken` directly; instead, actions requiring sync must invoke callbacks on the coordinator, which delegates to `github-sync.js`.

4. **DOM Caching & Destruction Lifecycle**:
   - All controllers must cache their DOM elements once during instantiation or `mount()`.
   - Never call `document.getElementById` or `document.querySelector` inside animation frames, tick loops, or drag events.
   - All controllers must provide a `destroy()` method to clean up listeners when the board is purged/locked.

---

## 4. Conclusion

The decomposition of `js/app.js` is clean, modular, and directly maps to 5 newly created UI modules:
1. `js/ui-gestures.js`: Exports `bindSheetDragGestures`.
2. `js/ui-modals.js`: Exports `EventCountdownModal` and `DaysBreakdownModal`.
3. `js/ui-status-sheet.js`: Exports `StatusEditSheet` and `populateCountrySelect`.
4. `js/ui-editor-sheet.js`: Exports `TimelineEditorSheet`.
5. `js/ui-preview-banner.js`: Exports `PreviewBannerController`.
6. Streamlined `js/app.js`: Coordinates the sub-controllers and tick loop in ~300-350 lines.
7. `sw.js`: Updates `CACHE_NAME` to `'trip-countdown-board-v5'` and enumerates all 30 app shell assets.
8. `tests/integration.test.mjs`: Updates `publicFilesToAudit` to include all 18 newly introduced files (9 CSS, 9 JS).

---

## 5. Verification Method

1. **Test Suite Verification**:
   Execute the full test suite to confirm backward compatibility and zero regressions:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected outcome*: All 25 tests pass.

2. **Security Audit Verification**:
   Inspect `tests/integration.test.mjs` to confirm `publicFilesToAudit` contains:
   ```javascript
   const publicFilesToAudit = [
     'index.html',
     'manifest.json',
     'sw.js',
     'live-state.json',
     'styles/main.css',
     'styles/base.css',
     'styles/ambient.css',
     'styles/gate.css',
     'styles/photo-stack.css',
     'styles/countdown-card.css',
     'styles/status-bar.css',
     'styles/timeline.css',
     'styles/sheets-and-modals.css',
     'styles/responsive.css',
     'PLAN.md',
     'README.md',
     'AGENTS.md',
     'DESIGN.md',
     'js/config.js',
     'js/storage-vault.js',
     'js/crypto-vault.js',
     'js/countdown-engine.js',
     'js/date-utils.js',
     'js/anniversaries.js',
     'js/photo-stack.js',
     'js/photo-palette.js',
     'js/photo-badge.js',
     'js/timeline-renderer.js',
     'js/github-sync.js',
     'js/ui-gestures.js',
     'js/ui-modals.js',
     'js/ui-status-sheet.js',
     'js/ui-editor-sheet.js',
     'js/ui-preview-banner.js',
     'js/app.js'
   ];
   ```

3. **Service Worker Asset Verification**:
   Inspect `sw.js` to confirm `CACHE_NAME === 'trip-countdown-board-v5'` and `APP_SHELL_ASSETS` contains all 30 assets.
