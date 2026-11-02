# Challenger Evaluation Report — Milestone 4: UI Sub-Controllers & Lifecycle Hygiene

**Verdict**: **APPROVE**

---

## 1. Observation

1. **Test Suite Execution**:
   - Executed: `node --test tests/*.test.mjs`
   - Result: 33 tests executed (25 existing tests + 8 new verification tests in `tests/ui-controllers-verification.test.mjs`), 0 failures, exit code 0.
   ```
   ✔ Timezone & Date Helpers: getZonedDateParts, getUtcOffsetMinutes, and start/end of day boundaries (3.191667ms)
   ✔ Automatic Monthly Anniversary Generator produces milestones on the 10th and skips existing 1-Year duplicate (0.214792ms)
   ✔ Phase 1: Pre-Trip at Home (2025-10-31T12:00:00+02:00) (3.818875ms)
   ✔ Phase 2: Apart Phase #1 (2025-12-12T15:00:00Z) (0.211209ms)
   ✔ Phase 3: Active Reunion #1 (2026-01-02T12:00:00+07:00) (0.181666ms)
   ✔ Phase 4: Apart Phase #2 (2026-02-15T15:00:00Z) (0.394584ms)
   ✔ Phase 5: Multi-Leg Reunion (SG -> KR -> JP) with seamless leg transitions (0.424875ms)
   ✔ LiveState statusOverrides: ignored during reunion if older than leg start, honored if newer (0.216042ms)
   ✔ LiveState chapterOverrides: supports editing country leg names/dates, adding countries, and removing countries (0.520167ms)
   ✔ encryptVaultPayload and decryptVault complete a lossless round-trip with tripConfig (38.977125ms)
   ✔ decryptVault rejects wrong password and tampered ciphertext without leaking partial data (35.558833ms)
   ✔ IndexedDB Storage Lifecycle: strips githubToken from stored payload while unwrapping in memory via non-extractable CryptoKey (34.260833ms)
   ✔ CLI generates vault.json in an isolated temp directory without touching production vault.json (23.617459ms)
   ✔ extractDateLabel extracts and formats filenames strictly as DD-MM-YYYY (0.839166ms)
   ✔ Integration: COUNTRY_CATALOG contains all 249 ISO 3166-1 countries with flags, names, and IANA timezones (34.275708ms)
   ✔ Integration: vault.json on disk has valid AES-256-GCM + PBKDF2-SHA256 wire envelope (6.14225ms)
   ✔ Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping (1.014875ms)
   ✔ Integration: Timeline items partition cleanly and identify ReunionChapters vs MilestoneEvents (4.3615ms)
   ✔ Integration: GitHub sync encrypts and decrypts LiveStatePayload with AES-256-GCM CryptoKey (9.419458ms)
   ✔ Security Audit: Zero personal names, itinerary dates, or token.txt exist in public HTML/JS/CSS/Docs (1.061917ms)
   ✔ Integration: index.html contains split two-view panels, bottom nav, dedicated tz bridge, and neutral gate copy (0.143084ms)
   ✔ Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages (0.345917ms)
   ✔ Integration: resolveMilestonePersonMeta assigns person icons (🌸, 🌊, 💕) and createMilestoneRowElement suppresses boilerplate subtitles (0.259875ms)
   ✔ Integration: Engine dynamically applies milestoneOverrides, chapterOverrides, and customReunions (0.487708ms)
   ✔ Integration: index.html contains Timeline Header Add Button, Update Status FAB, and Timeline Item Editor Sheet (0.17225ms)
   ✔ UI Sub-Controllers: PreviewBannerController null-safety in raw headless environment (3.75725ms)
   ✔ UI Sub-Controllers: PreviewBannerController null-safety when #preview-banner and #time-travel-slider are absent from DOM (0.320792ms)
   ✔ UI Sub-Controllers: populateCountrySelect catalog integrity and ordering (34.327959ms)
   ✔ UI Sub-Controllers: bindSheetDragGestures lifecycle and unbinding (0.2685ms)
   ✔ UI Sub-Controllers: StatusEditSheet & TimelineEditorSheet listener cleanup on destroy (2.080667ms)
   ✔ UI Sub-Controllers: DaysBreakdownModal & EventCountdownModal in DOM environment and cleanup on destroy (0.823209ms)
   ✔ Vulnerability Confirmation: EventCountdownModal throws ReferenceError on instantiation if document is undefined (0.194291ms)
   ✔ Vulnerability Confirmation: DaysBreakdownModal and EventCountdownModal destroy() throw ReferenceError if window is undefined (0.10875ms)
   ℹ tests 33
   ℹ suites 0
   ℹ pass 33
   ℹ fail 0
   ℹ duration_ms 169.353958
   ```

2. **Null-Safety & Headless Resilience of `PreviewBannerController`**:
   - `PreviewBannerController` was evaluated in an environment where `globalThis.document` was `undefined`:
     - Invoked: `new PreviewBannerController()`, `setTripConfig(...)`, `setPreviewTimestamp(...)`, `getPreviewTimestamp()`, `stepDays(3)`, `stepDays(-1)`, `reset()`, `destroy()`.
     - Output: Zero exceptions thrown. State correctly maintained (`getPreviewTimestamp()` returns updated timestamps).
   - `PreviewBannerController` was evaluated in a mock DOM environment matching production `index.html` where `#preview-banner` and `#time-travel-slider` are absent (`null`):
     - Output: Zero DOM errors. Dynamic presets rendered into `#preset-chips-row`, click events update timestamp without exceptions, and `destroy()` cleanly clears child buttons.

3. **`populateCountrySelect` Catalog & Ordering Integrity**:
   - Verified with mock `<select>` element:
     - Null safety: `populateCountrySelect(null)` safely returns without throwing.
     - Creates exactly two `<optgroup>` elements: `pinnedGroup` labeled `'⭐ Pinned Destinations'` and `allCountriesGroup` labeled `'🌍 All 249 Countries (A–Z)'`.
     - Pinned options are placed at the top in the exact order requested (`['TH', 'VN', 'JP', 'KR']`), with no duplicates.
     - All 249 official ISO 3166-1 alpha-2 countries from `ALL_ISO_3166_CODES` are appended in `allCountriesGroup` with no duplicates (set size = 249).
     - Options in `allCountriesGroup` are strictly sorted alphabetically by localized country name (`countryA.name.localeCompare(countryB.name)`).
     - Selection is preserved: `selectElement.value` resolves to the requested `selectedCode`.

4. **Lifecycle Hygiene & Event Unbinding**:
   - `bindSheetDragGestures`:
     - Returns unbind cleanup function `() => void`.
     - Attaches 4 pointer listeners (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) to drag handle.
     - Attaches 4 touch listeners (`touchstart`, `touchmove`, `touchend`, `touchcancel`) to sheet container.
     - Downward drag past `dismissThreshold` (100px) invokes `onClose`.
     - Calling `unbind()` removes all 8 listeners (listener count drops to 0) and resets `sheetElement.style.transform` and `sheetElement.style.transition`. Idempotent on repeated calls.
   - `destroy()` methods:
     - `StatusEditSheet`: `destroy()` invokes gesture unbinder and aborts internal `AbortController`, reducing active listener count across all 16 form controls and sheet buttons to 0.
     - `TimelineEditorSheet`: `destroy()` invokes gesture unbinder and aborts internal `AbortController`, reducing active listener count across all 16 inputs, buttons, and leg rows to 0.
     - `PreviewBannerController`: `destroy()` runs all 4 slider/reset unbinders and empties preset chips row.
     - `DaysBreakdownModal`: `destroy()` removes click listeners from `closeBtn`, `doneBtn`, and `backdrop`, removes `keydown` listener from `window`, and nullifies all DOM references.
     - `EventCountdownModal`: `destroy()` removes click listeners from `closeBtn`, `doneBtn`, `backdrop`, and `editBtn`, removes `keydown` listener from `window`, and nullifies all DOM references.

5. **Empirically Confirmed Edge-Case Vulnerabilities**:
   - **Vulnerability A** (`js/ui-modals.js:197-199`):
     ```javascript
     closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
     doneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),
     editBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn'))
     ```
     `document.getElementById` is evaluated in the private field declaration of `EventCountdownModal` rather than initialized to `null` (as done in `DaysBreakdownModal`). If instantiated in a raw Node.js environment without global `document`, `new EventCountdownModal()` throws `ReferenceError: document is not defined`.
   - **Vulnerability B** (`js/ui-modals.js:167,452`):
     ```javascript
     window.removeEventListener('keydown', this.#handleKeydown);
     ```
     Called in `destroy()` without `typeof window !== 'undefined'` guard, throwing `ReferenceError: window is not defined` if `destroy()` is called in an environment without `window`.
   - **Assessment**: These two vulnerabilities only affect headless Node test environments without window/document polyfills. In the browser (`index.html`), `document` and `window` are always present, and `CountdownBoardApp` in `js/app.js` guards instantiation with `if (typeof document !== 'undefined')`. Thus, production is unaffected.

---

## 2. Logic Chain

1. Worker delivered all Milestone 4 required modules:
   - `js/ui-gestures.js`
   - `js/ui-modals.js`
   - `js/ui-status-sheet.js`
   - `js/ui-editor-sheet.js`
   - `js/ui-preview-banner.js`
   - `js/app.js`
2. Adversarial tests confirm that `PreviewBannerController` is defensively coded against missing `#preview-banner` and `#time-travel-slider`, functioning with zero DOM errors in headless and partial-DOM environments.
3. Country selection logic (`populateCountrySelect`) satisfies all ISO-3166 requirements: pinned countries at the top, complete 249-country catalog below, alphabetical sorting, and accurate selection assignment.
4. Gesture and modal controllers cleanly unbind their listeners on `destroy()`, leaving no leaked references or hanging event listeners in the DOM.
5. While `js/ui-modals.js` has minor field-initialization issues under headless Node without document shims, it functions without error in standard browser and test DOM environments.
6. The full project test suite passes (33/33 tests passing with 0 errors).

---

## 3. Caveats

- **Headless Node Import Caveat**: If `js/ui-modals.js` is imported and instantiated directly in raw Node.js without `document` and `window` on `globalThis`, `EventCountdownModal` will throw `ReferenceError: document is not defined`.
  - **Recommended Non-Blocking Fix**: In `js/ui-modals.js`, change lines 197-199 to `null`, and wrap lines 167 & 452 in `if (typeof window !== 'undefined')`. This can be applied in Milestone 5.
- Milestone 5 will register the 5 new `.js` modules in `sw.js` `APP_SHELL_ASSETS` and add them to `publicFilesToAudit` in `tests/integration.test.mjs`.

---

## 4. Conclusion

**Verdict**: **APPROVE**

Milestone 4 implementation successfully decouples the UI sub-controllers and app coordinator. All dispatch acceptance criteria are empirically satisfied:
- Null-safety & headless resilience on `PreviewBannerController` is verified.
- `populateCountrySelect` catalog and pinned ordering are verified.
- Lifecycle hygiene and listener cleanup on all sub-controllers are verified.
- Full test suite passes 100% (33 passing tests, 0 regressions).

---

## 5. Verification Method

To independently verify these results:

1. Run the test suite:
   ```bash
   node --test tests/*.test.mjs
   ```
   Confirm all 33 tests pass with 0 errors.

2. Run syntax check across all Milestone 4 modules and verification test:
   ```bash
   node --check js/ui-gestures.js js/ui-modals.js js/ui-status-sheet.js js/ui-editor-sheet.js js/ui-preview-banner.js js/app.js tests/ui-controllers-verification.test.mjs
   ```
   Confirm exit code 0.

3. Verify zero personal names exist in code:
   ```bash
   grep -rnEI "shoval|eitan" js/ tests/
   ```
   Confirm 0 results found (exit code 1).
