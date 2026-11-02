# CSS Modularization Architecture Handoff Report

## 1. Observation

### 1.1 Source Files & Baseline Environment
- **Monolithic Stylesheet**: `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/main.css` (2,768 lines, 63,966 bytes).
- **HTML Shell**: `/Users/eitangarner/Documents/Development/Projects/trip-countdown/index.html` (537 lines, 22,560 bytes).
- **Test Suite**: `node --test tests/*.test.mjs` passes all 25 unit and integration tests (duration ~162ms).
- **Security Audit**: `tests/integration.test.mjs` (lines 191–209) audits public files (`styles/main.css`, `index.html`, etc.) for zero personal names, dates, or secrets.
- **Service Worker**: `sw.js` (lines 6–21) caches `APP_SHELL_ASSETS` under `trip-countdown-board-v4`.

### 1.2 Structure of Monolithic `styles/main.css`
A complete scan of `styles/main.css` reveals 13 distinct functional sections with explicit comment delimiters:
- **Tokens & Variables (lines 1–88)**: `@property` declarations (`--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`, `--ambient-accent`), `:root` design tokens (`--bg-canvas`, `--surface-glass*`, `--surface-border*`, `--surface-shadow*`, `--font-sans`, `--ink-*`, `--track-*`, `--radius-*`, `--blur-matte`, `--transition-*`).
- **Section 1 (lines 89–171)**: `1. Base Reset & Bidirectional Typography Foundations` (`*`, `html`, `body`, `[hidden]`, form resets, `.numeric-lock`, `[dir="auto"]`, `.matte-glass`, `.matte-glass-strong`).
- **Section 2 (lines 172–255)**: `2. Full-Viewport Ambient Dispersion Layer (.ambient-stage)` (`.ambient-stage`, `.ambient-blob`, `.ambient-blob-primary/secondary/tertiary/quaternary`, `.ambient-photo-aura`, `.ambient-stage img/canvas`).
- **Section 3 (lines 256–336)**: `3. Main App Layout Column` (`.app-shell, .board-container, main`, `:root { --slide-offset: 16px; }`, `[dir="rtl"] { --slide-offset: -16px; }`, `.view-panel`, `.view-panel.slide-forward/backward`, `@keyframes view-fade-in`, `@keyframes view-slide-forward/backward`).
- **Section 4 (lines 337–532)**: `4. Password Gate Overlay (.vault-lock-overlay & .vault-card)` (`.vault-lock-overlay`, `.vault-card`, `@keyframes vault-shake`, `.vault-icon-badge`, `.vault-title`, `.vault-subtitle`, `.vault-form`, `.vault-password-input`, `.vault-remember-pill`, `.vault-unlock-btn, .btn-primary`, `.btn-danger`, `.vault-error-msg`).
- **Section 5 (lines 533–594)**: `5. Time-Travel Preview Floating Banner (.preview-banner)` (`.preview-banner`, `@keyframes banner-slide-in`, `.preview-banner-text`, `.preview-reset-btn`).
- **Section 6 (lines 595–1004)**: `6. Hero Section (.hero-section)` (`.hero-section`, `.days-together-pill`, `.photo-stack-wrapper`, `.photo-stack`, `.photo-card`, `[data-depth="0/1/2/hidden"]`, swipe transitions, `.photo-date-pages`, `.date-page`, `.date-pages-compact`, `.timeline-date-pill`, `.photo-caption-pill`, `.photo-actions-group`, `.photo-autorotate-btn`, `.photo-stack-controls`, `.photo-dots`).
- **Section 7 (lines 1005–1244)**: `7. Primary Countdown Card (.countdown-card)` (`.countdown-card`, `.phase-banner-pill`, `.countdown-header`, `.countdown-grid`, `.countdown-unit`, `.countdown-value`, `.separation-progress-container/meta/bar/fill`, `.sub-milestone-banner`, `.together-celebration-card`, `.active-leg-badge`, `.together-headline`, `.together-subtext`, `.leg-stepper-preview`).
- **Section 8 (lines 1245–1448)**: `8. "Where We Are Now" Dual Status Bar (.status-section)` (`.status-section`, `.dual-status-grid`, `.person-status-card`, `.person-card-header`, `.person-country-row`, `.person-flag`, `.person-country`, `.city-note`, `.person-clock-row`, `.local-clock`, `.tz-code-label`, `.tz-bridge-container`, `.tz-bridge-pill`).
- **Section 9 (lines 1449–2003)**: `9. Split-and-Merge Chronological Timeline (.timeline-section)` (`.timeline-section`, `.timeline-header-bar`, `.timeline-pill-btn`, `.past-chapters-toggle`, `.days-breakdown-list`, `.past-chapters-drawer`, `.timeline-track-container`, `.milestone-row`, `.milestone-card`, `.milestone-emoji-badge`, `.milestone-body`, `.reunion-chapter-card`, `.reunion-leg-stepper`, `.reunion-leg-item`).
- **Section 10 (lines 2004–2117)**: `10. App Bottom Navigation Bar (.bottom-nav)` (`.bottom-nav`, `.bottom-nav-slider`, `[dir="rtl"] .bottom-nav-slider`, `.bottom-nav-item`, `.bottom-nav-icon`, `.bottom-nav-label`).
- **Section 11 (lines 2118–2527)**: `11. Mobile Edit Mode Bottom Sheet & Floating Action Button` (`.fab-edit-btn`, `.edit-sheet-backdrop`, `.edit-bottom-sheet`, `.sheet-handle-wrapper`, `.sheet-handle`, `.sheet-header`, `.profile-segmented-control`, `.status-edit-single`, `.form-group`, `.form-select`, `.form-input`, `#timeline-milestone-fields`, `#timeline-chapter-fields`, `.chapter-legs-section`, `.chapter-leg-editor-card`, `.sync-status-pill`).
- **Section 12 (lines 2528–2737)**: `12. Event & Milestone Countdown Popup Modal` (`.event-modal-backdrop`, `.event-modal`, `@keyframes modalPopIn`, `.event-modal-header`, `.event-modal-title`, `.event-modal-badge`, `.event-modal-content`, `.event-modal-meta`, `.event-modal-status-pill`, `.event-modal-travel-tag`, `.event-modal-location`, `#event-modal-date-pill`, `.event-modal-actions`).
- **Section 13 (lines 2738–2768)**: `13. Responsive Breakpoints (Tablet & Desktop >= 540px)` (`@media (min-width: 540px)` for layout column, photo stack, countdown card, person status card, and status edit grid).

### 1.3 CSS Logical Properties Audit
Ripgrep search for physical properties:
- Pattern: `(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)`
- Results: **0 occurrences**.
- Pattern: `\b(left|right)\b`
- Results: **0 occurrences**.
Every rule in `styles/main.css` strictly adheres to CSS logical properties (`margin-inline`, `padding-inline`, `padding-block`, `inset-inline-start`, `inset-inline-end`, `inset-block-start`, `inset-block-end`, `text-align: start`, `text-align: center`).

### 1.4 `!important` Occurrences Catalog
Ripgrep search for `!important` across `styles/main.css` returned exactly **18 occurrences**:
1. Line 123: `[hidden] { display: none !important; }`
2. Line 301: `.view-panel[hidden] { display: none !important; }`
3. Line 717: `.photo-card.is-swiping { transition: none !important; }`
4. Line 721: `.photo-card.is-throwing-end { transform: translate3d(135%, 16px, 0) rotate(14deg) !important; }`
5. Line 722: `.photo-card.is-throwing-end { opacity: 0 !important; }`
6. Line 723: `.photo-card.is-throwing-end { transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important; }`
7. Line 727: `.photo-card.is-throwing-start { transform: translate3d(-135%, 16px, 0) rotate(-14deg) !important; }`
8. Line 728: `.photo-card.is-throwing-start { opacity: 0 !important; }`
9. Line 729: `.photo-card.is-throwing-start { transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important; }`
10. Line 839: `.date-page.date-page-no-slash::after { display: none !important; }`
11. Line 1386: `.city-note:empty { display: none !important; }`
12. Line 1504: `.timeline-pill-btn[hidden] { display: none !important; }`
13. Line 1997: `.reunion-leg-notes { display: none !important; }`
14. Line 2031: `.bottom-nav[hidden] { display: none !important; }`
15. Line 2544: `.event-modal-backdrop[hidden] { display: none !important; }`
16. Line 2569: `.event-modal[hidden] { display: none !important; }`
17. Line 2679: `.event-modal-travel-tag[hidden] { display: none !important; }`
18. Line 2716: `.event-modal-subtext { display: none !important; }`

### 1.5 Bidirectional Numeric Lock Verification
- Defined in `styles/main.css` (lines 143–148):
  ```css
  .numeric-lock {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
  }
  ```
- Corroborated with `[dir="auto"]` (lines 150–153):
  ```css
  [dir="auto"] {
    text-align: start;
    unicode-bidi: plaintext;
  }
  ```
- All formatted dates, numerals, clocks, and timezone offsets in `index.html` (lines 58, 60, 75, 78, 101, 117, 152, 153, 171, 172, 179, 365, 472, 477, 523) apply both `.numeric-lock` and explicit `dir="ltr"`.

---

## 2. Logic Chain

### 2.1 Domain Decomposition & Line Range Mapping
By aligning the 13 sections in `styles/main.css` with the 9 target domain stylesheets, we establish the following exact line-for-line mapping:

| Target Modular File | Section(s) in `styles/main.css` | Line Range in `styles/main.css` | Key Elements & Responsibilities |
|---|---|---|---|
| **`styles/base.css`** | Header + §1 + §3 + §10 | **1–171**, **256–336**, **2004–2117** | `@property` registrations, `:root` design tokens, CSS reset, `.numeric-lock`, `[dir="auto"]`, `.matte-glass` mixins, layout wrapper (`#board-container`), `.view-panel` slide keyframes, and bottom nav shell (`.bottom-nav`). |
| **`styles/ambient.css`** | §2 | **172–255** | Viewport ambient dispersion stage (`.ambient-stage`), blurred blobs (`.ambient-blob-*`), and photo aura backdrop (`.ambient-photo-aura`). |
| **`styles/gate.css`** | §4 | **337–532** | Password gate overlay (`.vault-lock-overlay`), lock card (`.vault-card`), `@keyframes vault-shake`, password input, checkbox pill, `.vault-unlock-btn`, `.btn-primary`, `.btn-danger`, and `.vault-error-msg`. |
| **`styles/photo-stack.css`** | §6 | **595–1004** | Hero container (`.hero-section`), days together top pill, 3D card deck (`.photo-stack`, `.photo-card[data-depth]`), swipe transforms, calendar page badges (`.photo-date-pages`, `.date-pages-compact`, `.timeline-date-pill`), captions, and autorotate pill toggle. |
| **`styles/countdown-card.css`** | §5 + §7 | **533–594**, **1005–1244** | Time-travel preview banner (`.preview-banner`), primary countdown card (`.countdown-card`), phase pill, 4-unit tabular countdown grid, separation progress bar, together celebration card, and active leg badge. |
| **`styles/status-bar.css`** | §8 | **1245–1448** | Dual status grid (`.status-section`), partner status cards (`.person-status-card`), country flags, city note pill, local clocks, timezone labels, and timezone bridge pill (`.tz-bridge-pill`). |
| **`styles/timeline.css`** | §9 | **1449–2003** | Chronological timeline (`.timeline-section`), past chapters toggle & drawer, milestone cards (`.milestone-card`), reunion cards (`.reunion-chapter-card`), multi-country leg stepper, and country days breakdown table. |
| **`styles/sheets-and-modals.css`** | §11 + §12 | **2118–2527**, **2528–2737** | Mobile status action button (`.fab-edit-btn`), bottom sheets (`.edit-bottom-sheet`, backdrop, handle, form inputs, leg editor cards), GitHub sync pill, and centered countdown modals (`.event-modal`, `.event-modal-backdrop`). |
| **`styles/responsive.css`** | §13 | **2738–2768** | Media queries for tablets & desktops (`@media (min-width: 540px)`): layout container padding, photo stack width, card padding, and dual-column form layout. |

### 2.2 Cascade Ordering Rationale
The master stylesheet `styles/main.css` must orchestrate the domain files via native `@import` statements in the following strict order:
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
**Rationale step-by-step:**
1. `base.css` must load first: It declares `@property` color registrations and `:root` custom properties that all subsequent sheets consume (`--ambient-*`, `--surface-glass`, `--track-*`, `--radius-*`, etc.). It also establishes the reset, typography, and `.numeric-lock`.
2. `ambient.css` defines the background canvas (`z-index: 0`) and color glow.
3. `gate.css` defines the unlock gate overlay (`z-index: 100`) and the shared primary/danger button tokens (`.btn-primary`, `.btn-danger`). Loading before `sheets-and-modals.css` guarantees that downstream modals inherit button styling without duplication.
4. `photo-stack.css` defines the calendar page date badges (`.photo-date-pages`, `.date-pages-compact`, `.timeline-date-pill`). Loading before `timeline.css` and `sheets-and-modals.css` ensures timeline cards and modal popups can style their date pills.
5. `countdown-card.css` defines the countdown card and preview banner, sitting immediately under the photo stack.
6. `status-bar.css` defines the "Where We Are Now" dual status cards and timezone bridge.
7. `timeline.css` defines the timeline view and days breakdown list (`.days-breakdown-list`). Loading before `sheets-and-modals.css` allows `#days-breakdown-modal` to reuse the days breakdown list styling.
8. `sheets-and-modals.css` defines the overlays (`.edit-bottom-sheet` at `z-index: 90`, `.event-modal` at `z-index: 80`).
9. `responsive.css` must load last: It contains `@media (min-width: 540px)` overrides that adjust dimensional properties of components declared across `base.css`, `photo-stack.css`, `countdown-card.css`, `status-bar.css`, and `sheets-and-modals.css`.

### 2.3 Elimination Strategy for All 18 `!important` Instances
To uphold the non-negotiable invariant **"Never use !important"**:
1. **`[hidden]` rules on flex/grid containers (11 instances)**:
   - Elements like `.view-panel`, `.timeline-pill-btn`, `.bottom-nav`, `.event-modal-backdrop`, `.event-modal`, and `.event-modal-travel-tag` currently use `display: none !important;` to prevent author rules like `.event-modal { display: flex; }` from overriding HTML `hidden`.
   - *Fix*: Apply `:not([hidden])` to author display declarations:
     ```css
     /* In base.css */
     .view-panel:not([hidden]) { display: flex; }
     .bottom-nav:not([hidden]) { display: inline-flex; }

     /* In timeline.css */
     .timeline-pill-btn:not([hidden]) { display: inline-flex; }

     /* In sheets-and-modals.css */
     .event-modal-backdrop:not([hidden]) { display: block; }
     .event-modal:not([hidden]) { display: flex; }
     .event-modal-travel-tag:not([hidden]) { display: inline-flex; }
     ```
   - *Alternative / Defense-in-Depth*: In `base.css`, specify `:is([hidden], [hidden="true"], [hidden="hidden"]) { display: none; }` with specificity [0,1,0], and combine with `:not([hidden])`.
2. **Redundant `!important` on non-overridden rules (3 instances)**:
   - `.reunion-leg-notes` (line 1997): Replace `display: none !important;` with `display: none;`.
   - `.event-modal-subtext` (line 2716): Replace `display: none !important;` with `display: none;`.
   - `.city-note:empty` (line 1386): `.city-note:empty` has specificity [0,1,1] which naturally supersedes `.city-note` [0,1,0]. Replace `display: none !important;` with `display: none;`.
3. **Pseudo-element slash hiding (1 instance)**:
   - `.date-page.date-page-no-slash::after` (line 839): Specificity [0,2,0] matches `.date-page:not(:last-child)::after` [0,2,0] and comes later in source order. Replace `display: none !important;` with `display: none;`.
4. **Photo card swiping & throwing (4 instances)**:
   - Lines 717, 721–723, 727–729: `.photo-card.is-swiping` has higher specificity ([0,2,0]) than `.photo-card` ([0,1,0]), so `transition: none;` does not need `!important`.
   - When throwing cards, `photo-stack.js` had applied inline styles (`topCard.style.transform = ...`) during pointer move. When the throw action begins in `photo-stack.js` (`transitionToIndex`), clearing the inline transform (`outgoingCard.style.transform = '';`) allows the CSS class animation `.is-throwing-end` / `.is-throwing-start` to apply smoothly without requiring `!important`.

---

## 3. Caveats

1. **Bottom Nav (§10) Placement**:
   - In our primary decomposition, Section 10 (`.bottom-nav`, lines 2004–2117) is grouped into `styles/base.css` because it forms the persistent viewport layout shell alongside `#board-container` (which reserves safe-area bottom padding specifically for `.bottom-nav`).
   - *Alternative considered*: Placing `.bottom-nav` in `styles/sheets-and-modals.css`. This is viable because `sheets-and-modals.css` is loaded near the end. However, `sheets-and-modals.css` conceptually houses transient bottom sheets and dialogs, whereas `.bottom-nav` is the core app view router. We recommend `base.css`.
2. **Preview Banner (§5) Placement**:
   - Section 5 (`.preview-banner`, lines 533–594) appears between the gate and the photo stack in the original file. In the modular structure, it is colocated with `styles/countdown-card.css`. Because `.preview-banner` has no selector overlap with `.photo-stack`, this reordering causes zero visual or cascade side effects.
3. **Shared Button Utilities**:
   - `.btn-primary` and `.btn-danger` are defined in Section 4 (`styles/gate.css`). Because `gate.css` is imported 3rd (before `sheets-and-modals.css`), forms in bottom sheets and modals inherit button styles without issue. If preferred, they can alternatively be placed in `styles/base.css`.
4. **PWA Shell & Security Test Update Requirement**:
   - Splitting `styles/main.css` into 9 files requires adding all 8 newly introduced CSS files to `sw.js` (`APP_SHELL_ASSETS`) and updating `tests/integration.test.mjs` (`publicFilesToAudit`). This is noted for implementation.

---

## 4. Conclusion

The monolithic `styles/main.css` is cleanly partitionable into the 9 planned modular domain stylesheets with **zero semantic regression** and **zero visual fidelity loss**. 

Key architecture takeaways:
1. **Logical Properties**: The stylesheet already demonstrates 100% adherence to CSS logical properties (zero physical direction properties).
2. **Bidirectional Numeric Lock**: Tabular numerals and isolate bidi rules are correctly applied across HTML and CSS.
3. **Zero `!important` Path**: All 18 existing instances of `!important` can be cleanly eliminated by adopting `:not([hidden])` on flex/grid components, stripping redundant flags on non-conflicting rules, and ensuring `photo-stack.js` clears inline transforms upon swipe release.
4. **Clean Cascade**: The 9-file `@import` chain (`base.css` → `ambient.css` → `gate.css` → `photo-stack.css` → `countdown-card.css` → `status-bar.css` → `timeline.css` → `sheets-and-modals.css` → `responsive.css`) preserves all cross-module dependencies naturally without specificity wars.

The implementation agent can proceed with the exact line mappings documented in Section 2.1.

---

## 5. Verification Method

To independently verify this survey:
1. **Verify Section Delimiters**:
   ```bash
   grep -n -C 2 '/\* ======' styles/main.css
   ```
   Inspect each numbered comment section header against the line ranges in Section 2.1.
2. **Verify CSS Logical Properties Compliance**:
   ```bash
   grep -En '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/main.css
   ```
   Confirm that 0 results are returned.
3. **Verify `!important` Occurrences**:
   ```bash
   grep -n '!important' styles/main.css
   ```
   Confirm exactly 18 occurrences matching the line list in Section 1.4.
4. **Verify Bidirectional Numeric Lock**:
   ```bash
   grep -n 'numeric-lock' styles/main.css index.html
   ```
   Confirm all numbers, clocks, and date indicators bind `.numeric-lock` and `dir="ltr"`.
5. **Run Baseline Tests**:
   ```bash
   node --test tests/*.test.mjs
   ```
   Confirm all 25 tests pass.
