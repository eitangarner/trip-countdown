# Milestone 1 Stylesheets Modularization: Explorer 2 Handoff Report

## 1. Observation

### 1.1 Source Code Inventory & Line Ranges in `styles/main.css`
A comprehensive line-by-line inspection of `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/main.css` (2,768 lines, 63,966 bytes) and `/Users/eitangarner/Documents/Development/Projects/trip-countdown/index.html` establishes the exact boundaries for the 5 target modules:

| Target File | Source Sections in `main.css` | Exact Line Range | Total Lines | Primary Responsibilities & Selectors |
|---|---|---|---|---|
| **`styles/photo-stack.css`** | Section 6 | **595–1004** | 410 | Hero section container (`.hero-section`), days together pill (`.days-together-pill`), 3D photo card stack (`.photo-stack-wrapper`, `.photo-stack`, `.photo-card[data-depth]`, swipe/throw classes), date badges (`.photo-date-pages`, `.date-pages-compact`, `.timeline-date-pill`), photo captions (`.photo-caption-pill`), actions (`.photo-autorotate-btn`, `.photo-shuffle-btn`), and indicator dots (`.photo-dots`, `.photo-dot`). |
| **`styles/countdown-card.css`** | Section 5 + Section 7 | **533–594**, **1005–1244** | 302 | Time-travel preview banner (`.preview-banner`, `@keyframes banner-slide-in`, `.preview-reset-btn`), primary countdown card (`.countdown-card`), phase pill (`.phase-banner-pill`), countdown header, 4-unit tabular countdown grid (`.countdown-grid`, `.countdown-unit`, `.countdown-value`), separation progress bar (`.separation-progress-*`), sub-milestone banner, and together celebration card (`.together-celebration-card`, `.active-leg-badge`). |
| **`styles/status-bar.css`** | Section 8 | **1245–1448** | 204 | Dual status section (`.status-section`), header row, 2-column grid (`.dual-status-grid`), partner cards (`.person-status-card`, `[data-person]`), name tags & status dots, country row & flags (`.person-flag`, `.person-country`), city/vibe note pill (`.city-note`), local wall-clock times (`.local-clock`, `.tz-code-label`), and dedicated timezone bridge pill (`.tz-bridge-container`, `.tz-bridge-pill`). |
| **`styles/timeline.css`** | Section 9 | **1449–2003** | 555 | Chronological journey timeline (`.timeline-section`), header pill buttons (`.timeline-pill-btn`), past chapters toggle & collapsible drawer (`.past-chapters-toggle`, `.past-chapters-drawer`), country days breakdown table (`.days-breakdown-list`), unified track (`.timeline-track-container`), milestone cards (`.milestone-card`, `.milestone-emoji-badge`), wide reunion chapter cards (`.reunion-chapter-card`), and multi-country leg stepper (`.reunion-leg-stepper`, `.reunion-leg-item`). |
| **`styles/sheets-and-modals.css`** | Section 11 + Section 12 | **2118–2527**, **2528–2737** | 620 | Floating mobile status button (`.fab-edit-btn`), draggable bottom sheets (`.edit-sheet-backdrop`, `.edit-bottom-sheet`, handle, header), profile segment buttons (`.profile-segmented-control`), status update inputs & presets (`.form-group`, `.form-select`, `.form-input`), chapter multi-leg dynamic editor cards (`.chapter-leg-editor-card`), sync status pill (`.sync-status-pill`), and centered countdown popups (`.event-modal-backdrop`, `.event-modal`, `@keyframes modalPopIn`, `.event-modal-travel-tag`, `.event-modal-actions`). |

### 1.2 `!important` Instances in Target Modules
Grep of `styles/main.css` identified 15 occurrences of `!important` across the 5 target module boundaries (out of 18 total across the entire file):

1. **`photo-stack.css` (8 instances)**:
   - Line 717: `.photo-card.is-swiping { transition: none !important; }`
   - Line 721: `.photo-card.is-throwing-end { transform: translate3d(135%, 16px, 0) rotate(14deg) !important; }`
   - Line 722: `.photo-card.is-throwing-end { opacity: 0 !important; }`
   - Line 723: `.photo-card.is-throwing-end { transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important; }`
   - Line 727: `.photo-card.is-throwing-start { transform: translate3d(-135%, 16px, 0) rotate(-14deg) !important; }`
   - Line 728: `.photo-card.is-throwing-start { opacity: 0 !important; }`
   - Line 729: `.photo-card.is-throwing-start { transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important; }`
   - Line 839: `.date-page.date-page-no-slash::after { display: none !important; }`
2. **`countdown-card.css` (0 instances)**:
   - Zero `!important` declarations present in lines 533–594 or lines 1005–1244.
3. **`status-bar.css` (1 instance)**:
   - Line 1386: `.city-note:empty { display: none !important; }`
4. **`timeline.css` (2 instances)**:
   - Line 1504: `.timeline-pill-btn[hidden] { display: none !important; }`
   - Line 1997: `.reunion-leg-notes { display: none !important; }`
5. **`sheets-and-modals.css` (4 instances)**:
   - Line 2544: `.event-modal-backdrop[hidden] { display: none !important; }`
   - Line 2569: `.event-modal[hidden] { display: none !important; }`
   - Line 2679: `.event-modal-travel-tag[hidden] { display: none !important; }`
   - Line 2716: `.event-modal-subtext { display: none !important; }`

### 1.3 CSS Logical Properties Verification
Ripgrep pattern matching for physical direction properties across lines 533–2737 returned 0 results:
- `margin-left`, `margin-right`: 0 occurrences
- `padding-left`, `padding-right`: 0 occurrences
- `border-left`, `border-right`: 0 occurrences
- `left:`, `right:`: 0 occurrences
- `text-align: left`, `text-align: right`: 0 occurrences
Every selector in these 5 modules strictly uses CSS logical properties (`margin-inline`, `padding-inline`, `padding-block`, `inset-inline-start`, `inset-inline-end`, `inset-block-start`, `inset-block-end`, `text-align: start`, `text-align: center`).

### 1.4 Downstream Cross-Module Consumption
1. **Date Badges (`photo-stack.css`)**:
   - `.photo-date-pages`, `.date-pages-compact`, and `.timeline-date-pill` (lines 757–883) are consumed in `timeline.css` (milestone and reunion cards) and `sheets-and-modals.css` (`#event-modal-date-pill`, `#days-modal-total-pill`).
2. **Countdown Grid (`countdown-card.css`)**:
   - `.countdown-grid`, `.countdown-unit`, `.countdown-value`, and `.countdown-label` (lines 1069–1130) are consumed in `sheets-and-modals.css` (`#event-modal-countdown-grid` in `index.html` line 477).
3. **Days Breakdown List (`timeline.css`)**:
   - `.days-breakdown-list`, `.days-breakdown-item`, `.days-breakdown-country`, `.days-breakdown-flag`, `.days-breakdown-name`, `.days-breakdown-count` (lines 1548–1597) are consumed in `sheets-and-modals.css` (`#days-modal-list` in `index.html` line 526).
4. **Shared Buttons (`gate.css`)**:
   - `.btn-primary` (lines 474–498 of `gate.css`) is consumed by submit buttons in `sheets-and-modals.css` (`#status-update-form`, `#timeline-item-form`, `#event-modal-done-btn`, `#days-modal-done-btn`).

---

## 2. Logic Chain

### 2.1 Cascade Order Proof
The orchestrator in `styles/main.css` imports modules in the following order:
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
1. Step 1: `photo-stack.css` is imported at position 4. It defines date badges (`.photo-date-pages`, `.date-pages-compact`, `.timeline-date-pill`). Because positions 7 (`timeline.css`) and 8 (`sheets-and-modals.css`) are loaded later, they inherit badge and pill styles cleanly without duplication or forward-declaration errors.
2. Step 2: `countdown-card.css` is imported at position 5. It defines `.countdown-grid` and 4-block unit layouts. Because position 8 (`sheets-and-modals.css`) loads after position 5, the event modal countdown popup (`#event-modal-countdown-grid`) renders with full fidelity without restating grid styles.
3. Step 3: `status-bar.css` is imported at position 6. It is self-contained with no outbound selector dependencies other than `:root` design tokens from `base.css`.
4. Step 4: `timeline.css` is imported at position 7. It defines `.days-breakdown-list`. Because position 8 (`sheets-and-modals.css`) loads after position 7, `#days-breakdown-modal` reuses the breakdown table styling seamlessly.
5. Step 5: `sheets-and-modals.css` is imported at position 8. It consumes `.btn-primary` from position 3 (`gate.css`), `.countdown-grid` from position 5 (`countdown-card.css`), `.timeline-date-pill` from position 4 (`photo-stack.css`), and `.days-breakdown-list` from position 7 (`timeline.css`).
6. Step 6: `responsive.css` is imported at position 9 (last). Its `@media (min-width: 540px)` rules override dimensions in `.photo-stack`, `.countdown-card`, `.person-status-card`, and `.status-edit-grid` without specificity escalation.

### 2.2 Exact `!important` Elimination Recipes for the Worker

#### In `styles/photo-stack.css`
1. **Line 717**: `.photo-card.is-swiping`
   ```css
   /* Before */
   .photo-card.is-swiping {
     transition: none !important;
   }
   /* After */
   .photo-card.is-swiping {
     transition: none;
   }
   ```
   *Rationale*: `.photo-card.is-swiping` has specificity [0,2,0] versus `.photo-card` [0,1,0]. It naturally supersedes base transitions.

2. **Lines 720–730**: `.photo-card.is-throwing-end` and `.photo-card.is-throwing-start`
   ```css
   /* Before */
   .photo-card.is-throwing-end {
     transform: translate3d(135%, 16px, 0) rotate(14deg) !important;
     opacity: 0 !important;
     transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important;
   }
   .photo-card.is-throwing-start {
     transform: translate3d(-135%, 16px, 0) rotate(-14deg) !important;
     opacity: 0 !important;
     transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important;
   }
   /* After */
   .photo-card.is-throwing-end {
     transform: translate3d(135%, 16px, 0) rotate(14deg);
     opacity: 0;
     transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease;
   }
   .photo-card.is-throwing-start {
     transform: translate3d(-135%, 16px, 0) rotate(-14deg);
     opacity: 0;
     transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease;
   }
   ```
   *Rationale*: Specificity [0,2,0] naturally overrides base `.photo-card` [0,1,0] for opacity and transition. For `transform`, during drag gestures `photo-stack.js` sets `topCard.style.transform`. In `photo-stack.js` (`transitionToIndex`, line 950), setting `outgoingCard.style.transform = '';` allows the CSS class transform to execute without needing `!important`.

3. **Line 839**: `.date-page.date-page-no-slash::after`
   ```css
   /* Before */
   .date-page.date-page-no-slash::after {
     display: none !important;
   }
   /* After */
   .date-page.date-page-no-slash::after {
     display: none;
   }
   ```
   *Rationale*: Specificity [0,2,0] matches `.date-page:not(:last-child)::after` [0,2,0] and comes later in source order, so `display: none;` wins naturally.

#### In `styles/status-bar.css`
4. **Line 1386**: `.city-note:empty`
   ```css
   /* Before */
   .city-note:empty {
     display: none !important;
   }
   /* After */
   .city-note:empty {
     display: none;
   }
   ```
   *Rationale*: `.city-note:empty` has specificity [0,1,1], which is higher than `.city-note` [0,1,0]. It wins without `!important`.

#### In `styles/timeline.css`
5. **Line 1504**: `.timeline-pill-btn[hidden]`
   ```css
   /* Before */
   .timeline-pill-btn {
     ...
     display: inline-flex;
     ...
   }
   .timeline-pill-btn[hidden] {
     display: none !important;
   }
   /* After */
   .timeline-pill-btn:not([hidden]) {
     display: inline-flex;
   }
   .timeline-pill-btn[hidden] {
     display: none;
   }
   ```
   *Rationale*: Author `display: inline-flex` on `.timeline-pill-btn` was overriding the HTML `[hidden]` attribute. Wrapping with `:not([hidden])` ensures that when `hidden` is present, `display: inline-flex` is inactive, allowing `display: none` to apply without `!important`.

6. **Line 1997**: `.reunion-leg-notes`
   ```css
   /* Before */
   .reunion-leg-notes {
     display: none !important;
   }
   /* After */
   .reunion-leg-notes {
     display: none;
   }
   ```
   *Rationale*: No other rule specifies `display` for `.reunion-leg-notes`. `!important` is entirely redundant.

#### In `styles/sheets-and-modals.css`
7. **Line 2544**: `.event-modal-backdrop[hidden]`
   ```css
   /* Before */
   .event-modal-backdrop[hidden] {
     display: none !important;
   }
   /* After */
   .event-modal-backdrop[hidden] {
     display: none;
   }
   ```
8. **Line 2569**: `.event-modal[hidden]`
   ```css
   /* Before */
   .event-modal {
     ...
     display: flex;
     ...
   }
   .event-modal[hidden] {
     display: none !important;
   }
   /* After */
   .event-modal:not([hidden]) {
     display: flex;
   }
   .event-modal[hidden] {
     display: none;
   }
   ```
   *Rationale*: Same `:not([hidden])` pattern ensures `display: flex` never collides with `hidden`.

9. **Line 2679**: `.event-modal-travel-tag[hidden]`
   ```css
   /* Before */
   .event-modal-travel-tag {
     ...
     display: inline-flex;
     ...
   }
   .event-modal-travel-tag[hidden] {
     display: none !important;
   }
   /* After */
   .event-modal-travel-tag:not([hidden]) {
     display: inline-flex;
   }
   .event-modal-travel-tag[hidden] {
     display: none;
   }
   ```

10. **Line 2716**: `.event-modal-subtext`
    ```css
    /* Before */
    .event-modal-subtext {
      display: none !important;
    }
    /* After */
    .event-modal-subtext {
      display: none;
    }
    ```
    *Rationale*: No conflicting display declaration exists for `.event-modal-subtext`.

---

## 3. Caveats

1. **Redundant Duplicate Selectors in `timeline.css` (lines 1512–1546 & 1598–1639)**:
   - In `styles/main.css`, `.past-chapters-badge`, `.past-chapters-arrow`, and `.past-chapters-toggle` are declared twice:
     - Block 1 (lines 1512–1546): badge `min-width: 18px`, `height: 18px`, `font-size: 0.70rem`.
     - Block 2 (lines 1598–1639): badge `min-width: 20px`, `height: 20px`, `font-size: 0.72rem`.
   - The second block wins in the cascade. The Worker may keep both blocks in exact order to preserve 100% byte-for-byte fidelity or clean up Block 1. Keeping lines 1598–1639 values ensures visual styling remains identical.
2. **Colocation of Section 5 (`.preview-banner`) into `countdown-card.css`**:
   - In `main.css`, Section 5 appeared before Section 6 (`.hero-section`). Grouping it into `countdown-card.css` moves its cascade position to after `photo-stack.css`.
   - Verification: `.preview-banner` has zero selector overlap with `.hero-section`, `.days-together-pill`, or `.photo-stack`. Moving it produces zero visual cascade side effects.
3. **PWA & Test Suite Pre-Conditions**:
   - All newly created stylesheets must contain zero forbidden tokens (personal names, dates, PAT tokens) to pass `tests/integration.test.mjs`.
   - Milestone 5 will update `sw.js` and `publicFilesToAudit` in `tests/integration.test.mjs`.

---

## 4. Conclusion

The 5 target modules can be cleanly extracted from `styles/main.css` into modular domain stylesheets with **zero visual regressions**, **100% adherence to CSS logical properties**, and **complete elimination of all 15 `!important` occurrences** within their scope:

1. `styles/photo-stack.css` (lines 595–1004) — cleanly eliminates 8 `!important` flags.
2. `styles/countdown-card.css` (lines 533–594 + 1005–1244) — clean extraction with 0 `!important`.
3. `styles/status-bar.css` (lines 1245–1448) — cleanly eliminates 1 `!important` flag on `.city-note:empty`.
4. `styles/timeline.css` (lines 1449–2003) — cleanly eliminates 2 `!important` flags via `:not([hidden])`.
5. `styles/sheets-and-modals.css` (lines 2118–2737) — cleanly eliminates 4 `!important` flags via `:not([hidden])`.

The cascade order specified in PROJECT.md (`base.css` → `ambient.css` → `gate.css` → `photo-stack.css` → `countdown-card.css` → `status-bar.css` → `timeline.css` → `sheets-and-modals.css` → `responsive.css`) satisfies all cross-module dependencies naturally.

---

## 5. Verification Method

To verify these boundaries and rules independently:
1. **Verify Line Extraction Boundaries**:
   ```bash
   sed -n '595,1004p' styles/main.css | head -n 5  # photo-stack.css start
   sed -n '533,594p' styles/main.css | head -n 5   # countdown-card.css preview banner
   sed -n '1005,1244p' styles/main.css | head -n 5 # countdown-card.css primary card
   sed -n '1245,1448p' styles/main.css | head -n 5 # status-bar.css
   sed -n '1449,2003p' styles/main.css | head -n 5 # timeline.css
   sed -n '2118,2737p' styles/main.css | head -n 5 # sheets-and-modals.css
   ```
2. **Verify Zero Physical Direction Properties**:
   ```bash
   grep -En '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/main.css
   # Expected result: 0 lines matched
   ```
3. **Verify `!important` Count in Target Ranges**:
   ```bash
   sed -n '533,2003p;2118,2737p' styles/main.css | grep -c '!important'
   # Expected result: 15
   ```
4. **Execute Full Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   # Expected result: all 25 tests pass (0 failures)
   ```
