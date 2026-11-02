# Milestone 1 CSS Invariant & Architectural Analysis Handoff Report

**Explorer**: Explorer 3 (Milestone 1 — Modular Stylesheets & Invariant Compliance)  
**Target Milestone**: Milestone 1 (M1)  
**Date**: 2026-11-01  
**Working Directory**: `/Users/eitangarner/Documents/Development/Projects/trip-countdown/.agents/teamwork/explorer_m1_3`  
**Status**: Complete  

---

## 1. Observation

### 1.1 Complete Census of all 18 `!important` Occurrences in `styles/main.css`
A ripgrep search (`grep -n '!important' styles/main.css`) isolated all 18 occurrences:

```
styles/main.css:123:  display: none !important;
styles/main.css:301:  display: none !important;
styles/main.css:717:  transition: none !important;
styles/main.css:721:  transform: translate3d(135%, 16px, 0) rotate(14deg) !important;
styles/main.css:722:  opacity: 0 !important;
styles/main.css:723:  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important;
styles/main.css:727:  transform: translate3d(-135%, 16px, 0) rotate(-14deg) !important;
styles/main.css:728:  opacity: 0 !important;
styles/main.css:729:  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease !important;
styles/main.css:839:  display: none !important;
styles/main.css:1386:  display: none !important;
styles/main.css:1504:  display: none !important;
styles/main.css:1997:  display: none !important;
styles/main.css:2031:  display: none !important;
styles/main.css:2544:  display: none !important;
styles/main.css:2569:  display: none !important;
styles/main.css:2679:  display: none !important;
styles/main.css:2716:  display: none !important;
```

Direct inspection reveals 4 functional categories:
1. **HTML5 `[hidden]` Enforcement on Non-Block Elements (7 instances)**:
   - Line 123: `[hidden] { display: none !important; }`
   - Line 301: `.view-panel[hidden] { display: none !important; }`
   - Line 1504: `.timeline-pill-btn[hidden] { display: none !important; }`
   - Line 2031: `.bottom-nav[hidden] { display: none !important; }`
   - Line 2544: `.event-modal-backdrop[hidden] { display: none !important; }`
   - Line 2569: `.event-modal[hidden] { display: none !important; }`
   - Line 2679: `.event-modal-travel-tag[hidden] { display: none !important; }`
2. **Photo Card Swiping & Throwing Transitions (7 instances)**:
   - Line 717: `.photo-card.is-swiping { transition: none !important; }`
   - Lines 721–723: `.photo-card.is-throwing-end { transform: ... !important; opacity: 0 !important; transition: ... !important; }`
   - Lines 727–729: `.photo-card.is-throwing-start { transform: ... !important; opacity: 0 !important; transition: ... !important; }`
3. **Pseudo-Element Slash Suppression (1 instance)**:
   - Line 839: `.date-page.date-page-no-slash::after { display: none !important; }`
4. **Redundant Element Visibility Suppression (3 instances)**:
   - Line 1386: `.city-note:empty { display: none !important; }`
   - Line 1997: `.reunion-leg-notes { display: none !important; }`
   - Line 2716: `.event-modal-subtext { display: none !important; }`

### 1.2 Inspection of Dynamic Inline Styles in JavaScript
1. **`js/photo-stack.js` Lines 1154–1157**:
   ```javascript
   const topCard = this.cardElements?.[this.activeIndex];
   if (topCard) {
     const rotateDeg = clamp(dx * 0.06, -16, 16);
     topCard.style.transform = `translate3d(${dx}px, ${Math.abs(dx) * 0.08}px, 0) rotate(${rotateDeg}deg)`;
   }
   ```
2. **`js/photo-stack.js` Lines 945–955 (`transitionToIndex`)**:
   ```javascript
   transitionToIndex(nextIndex, throwDirection = 'start') {
     const outgoingCard = this.cardElements?.[this.activeIndex];
     this.activeIndex = nextIndex;

     if (outgoingCard) {
       outgoingCard.classList.remove('is-swiping');
       outgoingCard.classList.add(throwDirection === 'end' ? 'is-throwing-end' : 'is-throwing-start');
       setTimeout(() => {
         this.updateStackDepths();
       }, 220);
   ```
   *Observation*: When `transitionToIndex` is invoked from `handlePointerUp` (line 1176), `outgoingCard.style.transform` retains the active drag inline transform. In standard CSS specificity, inline styles have specificity [1,0,0,0], which supersedes stylesheet rules unless `!important` is present or the inline style is cleared (`outgoingCard.style.transform = ''`).

3. **`index.html` Line 71**:
   ```html
   <div id="countdown-apart-view" style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px;">
   ```
   *Observation*: `js/app.js` sets `this.dom.countdownApartView.hidden = true` when Together celebration mode activates (line 1633). Without `!important` on `[hidden]`, the inline style `style="display: flex; ..."` will override external `[hidden] { display: none; }`.

### 1.3 CSS Logical Properties Verification
Executed regex query:
`grep -rEn '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:|\b(top|bottom)\s*:|(margin|padding|border)-(top|bottom)\b)' styles/`
- Result: **0 matches** (exit code 1).
- Executed physical directional keyword check: `grep -rEn '\b(float|clear)\s*:\s*(left|right)\b' styles/` -> **0 matches**.
- Result: The stylesheet uses CSS logical properties exclusively:
  - `margin-inline`, `margin-block`, `margin-block-start`
  - `padding-inline`, `padding-block`, `padding-block-start`, `padding-block-end`
  - `inset-inline-start`, `inset-inline-end`, `inset-block-start`, `inset-block-end`, `inset-block`
  - `border-start-start-radius`, `border-start-end-radius` (lines 2177–2178)
  - `text-align: start`, `text-align: center`

### 1.4 Bidirectional Numeric Locking & RTL Verification
1. **CSS Definitions** (`styles/main.css` lines 143–153):
   ```css
   .numeric-lock {
     font-variant-numeric: tabular-nums;
     direction: ltr;
     unicode-bidi: isolate;
     display: inline-block;
   }

   [dir="auto"] {
     text-align: start;
     unicode-bidi: plaintext;
   }
   ```
2. **HTML Binding** (`index.html`):
   - All 15 numeral/clock/date elements in `index.html` (lines 58, 60, 75, 78, 101, 117, 152, 153, 171, 172, 179, 365, 472, 477, 523) apply `class="... numeric-lock"` and `dir="ltr"`.
   - All 13 user-facing dynamic text containers in `index.html` (lines 68, 74, 112, 113, 126, 150, 169, 287, 356, 382, 398, 429, 463, 496) specify `dir="auto"`.
3. **Dynamic JS Creation**:
   - `timeline-renderer.js` and `photo-stack.js` apply `.numeric-lock` and `setAttribute('dir', 'ltr')` to dates, durations, and counts, while applying `setAttribute('dir', 'auto')` to titles and country notes.

---

## 2. Logic Chain

### 2.1 Complete Replacement Strategy for All 18 `!important` Instances

#### Group 1: HTML5 `[hidden]` Rules (7 instances)
- **Problem**: When an author rule declares `display: flex`, `display: grid`, or `display: inline-flex` on an element with specificity [0,1,0], a base `[hidden] { display: none; }` with specificity [0,1,0] defined earlier in the cascade will lose to the later author rule.
- **Solution**:
  1. In `styles/base.css`, declare the universal reset:
     ```css
     [hidden] {
       display: none;
     }
     ```
  2. For author classes on elements that can toggle `hidden`, use the `:not([hidden])` pseudo-class (specificity [0,2,0]):
     ```css
     .view-panel:not([hidden]) { display: flex; }
     .bottom-nav:not([hidden]) { display: inline-flex; }
     .timeline-pill-btn:not([hidden]) { display: inline-flex; }
     .event-modal:not([hidden]) { display: flex; }
     .event-modal-travel-tag:not([hidden]) { display: inline-flex; }
     ```
  3. Keep the component-level `[hidden]` selector (specificity [0,2,0]) without `!important` as explicit defense-in-depth:
     ```css
     .view-panel[hidden] { display: none; }
     .bottom-nav[hidden] { display: none; }
     .timeline-pill-btn[hidden] { display: none; }
     .event-modal-backdrop[hidden] { display: none; }
     .event-modal[hidden] { display: none; }
     .event-modal-travel-tag[hidden] { display: none; }
     ```

#### Group 2: Photo Card Swiping & Throwing Transitions (7 instances)
- **Problem**:
  - Line 717: `.photo-card.is-swiping { transition: none !important; }`. `.photo-card.is-swiping` has specificity [0,2,0], which naturally supersedes `.photo-card` [0,1,0]. `!important` was purely defensive.
  - Lines 721–723, 727–729: `.is-throwing-end` / `.is-throwing-start` set `transform`, `opacity`, and `transition`. `opacity` and `transition` are never set inline, so [0,2,0] specificity naturally overrides `.photo-card[data-depth="0"]`. However, `transform` was set as an inline style on `topCard` during drag.
- **Solution**:
  1. In `js/photo-stack.js`, clear the inline transform when a throw is initiated in `transitionToIndex`:
     ```javascript
     if (outgoingCard) {
       outgoingCard.classList.remove('is-swiping');
       outgoingCard.style.transform = ''; // Clear pointer inline transform so CSS class takes over
       outgoingCard.classList.add(throwDirection === 'end' ? 'is-throwing-end' : 'is-throwing-start');
     ```
     And in `handlePointerUp` line 1175:
     ```javascript
     if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
       topCard.style.transform = '';
     ```
  2. In `styles/photo-stack.css`, remove all `!important` declarations:
     ```css
     .photo-card.is-swiping {
       transition: none;
     }

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

#### Group 3: Pseudo-Element Slash Suppression (1 instance)
- **Problem**: Line 839: `.date-page.date-page-no-slash::after { display: none !important; }`. The base rule is `.date-page:not(:last-child)::after` (specificity [0,2,1]). `.date-page.date-page-no-slash::after` also has specificity [0,2,1] and appears later in source order.
- **Solution**:
  In `styles/photo-stack.css`:
  ```css
  .date-page.date-page-no-slash::after {
    content: none;
    display: none;
  }
  ```
  Setting `content: none;` per CSS Generated Content specification inhibits box generation directly. Pairing with `display: none;` provides complete suppression with zero `!important`.

#### Group 4: Redundant Element Visibility Suppression (3 instances)
- **Problem**:
  - Line 1386: `.city-note:empty { display: none !important; }`. Specificity [0,2,0] naturally overrides `.city-note` [0,1,0]. No conflicting display rule exists.
  - Line 1997: `.reunion-leg-notes { display: none !important; }`. No other rule exists for this selector anywhere in the project.
  - Line 2716: `.event-modal-subtext { display: none !important; }`. No other rule exists for this selector anywhere in the project.
- **Solution**:
  Remove `!important` directly:
  ```css
  /* styles/status-bar.css */
  .city-note:empty {
    display: none;
  }

  /* styles/timeline.css */
  .reunion-leg-notes {
    display: none;
  }

  /* styles/sheets-and-modals.css */
  .event-modal-subtext {
    display: none;
  }
  ```

---

### 2.2 Hidden-Display Conflict Sites & Inline Style Fixes (Visual Regression Prevention)
During audit of all 24 elements using `hidden`, 7 additional author selectors were identified where `display: flex` or `display: inline-flex` would override `[hidden] { display: none; }` once `!important` is removed from line 123. These MUST be converted to `:not([hidden])`:

| Element / Selector | File | Original Rule | Required Replacement |
|---|---|---|---|
| `#board-container`, `main` | `styles/base.css` (line 260) | `.app-shell, .board-container, main { display: flex; ... }` | `.app-shell:not([hidden]), .board-container:not([hidden]), main:not([hidden]) { display: flex; ... }`<br>`main[hidden], .board-container[hidden] { display: none; }` |
| `#fab-edit-btn` | `styles/sheets-and-modals.css` (line 2122) | `.fab-edit-btn { display: inline-flex; ... }` | `.fab-edit-btn:not([hidden]) { display: inline-flex; ... }`<br>`.fab-edit-btn[hidden] { display: none; }` |
| `.edit-bottom-sheet` | `styles/sheets-and-modals.css` (line 2165) | `.edit-bottom-sheet { display: flex; ... }` | `.edit-bottom-sheet:not([hidden]) { display: flex; ... }`<br>`.edit-bottom-sheet[hidden] { display: none; }` |
| `.past-chapters-drawer` | `styles/timeline.css` (line 1640) | `.past-chapters-drawer { display: flex; ... }` | `.past-chapters-drawer:not([hidden]) { display: flex; ... }`<br>`.past-chapters-drawer[hidden] { display: none; }` |
| `.separation-progress-container` | `styles/countdown-card.css` (line 1133) | `.separation-progress-container { display: flex; ... }` | `.separation-progress-container:not([hidden]) { display: flex; ... }`<br>`.separation-progress-container[hidden] { display: none; }` |
| `.together-celebration-card` | `styles/countdown-card.css` (line 1190) | `.together-celebration-card { display: flex; ... }` | `.together-celebration-card:not([hidden]) { display: flex; ... }`<br>`.together-celebration-card[hidden] { display: none; }` |
| `.sub-milestone-banner` | `styles/countdown-card.css` (line 1169) | `.sub-milestone-banner { display: flex; ... }` | `.sub-milestone-banner:not([hidden]) { display: flex; ... }`<br>`.sub-milestone-banner[hidden] { display: none; }` |
| `#countdown-apart-view` | `index.html` (line 71) & `styles/countdown-card.css` | `style="width: 100%; display: flex; ..."` | Remove inline `style` attribute from `index.html:71`. Add to `countdown-card.css`:<br>`#countdown-apart-view:not([hidden]) { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; }`<br>`#countdown-apart-view[hidden] { display: none; }` |

---

### 2.3 Concrete Implementation File Mapping for Worker

```
styles/
├── main.css                  [9 native @import declarations in exact cascade order]
├── base.css                  [Tokens, reset, typography, .numeric-lock, layout, bottom-nav]
├── ambient.css               [Ambient stage, photo aura, color glow]
├── gate.css                  [Vault lock overlay, card, form, shared buttons .btn-primary/.btn-danger]
├── photo-stack.css           [Hero, photo card deck, swipe, date badges, autorotate]
├── countdown-card.css        [Countdown card, preview banner, phase pill, numerals, together card]
├── status-bar.css            [Dual partner cards, clocks, tz bridge]
├── timeline.css              [Chronological timeline, cards, stepper, breakdown list]
├── sheets-and-modals.css     [Bottom sheets, leg editor, modals, FAB]
└── responsive.css            [Breakpoints >=540px]
```

**Master Orchestrator (`styles/main.css`)**:
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

---

## 3. Caveats

1. **Inline Style on `#countdown-apart-view` (`index.html:71`)**:
   Removing `!important` on `[hidden]` without stripping `style="display: flex; ..."` from `index.html` will cause `#countdown-apart-view` to remain visible when Together mode activates. The Worker must remove this inline style from `index.html` and relocate it to `styles/countdown-card.css`.
2. **Inline Transform Clearing in `js/photo-stack.js`**:
   The Worker must include the 1-line clearing `outgoingCard.style.transform = '';` in `transitionToIndex` (and `handlePointerUp`) so the CSS class throw animation takes effect smoothly without `!important`.
3. **Public Files Audit in Integration Tests**:
   Splitting `styles/main.css` into 9 domain stylesheets will eventually require updating `sw.js` and `tests/integration.test.mjs` (`publicFilesToAudit`) in M5. However, keeping `styles/main.css` as the master `@import` entry point preserves current test passes in M1.

---

## 4. Conclusion

1. **Complete `!important` Elimination**: All 18 `!important` occurrences can be 100% eliminated using natural specificity cascade ([0,2,0] vs [0,1,0]), pseudo-element suppression (`content: none`), `:not([hidden])` author guards, and clearing inline transforms in `photo-stack.js`.
2. **Logical Properties**: The codebase is already 100% compliant with CSS logical properties (zero physical direction properties).
3. **Bidirectional Numeric Lock**: Numeric locking (`.numeric-lock`, `dir="ltr"`, `unicode-bidi: isolate`) and `dir="auto"` are systematically applied across HTML, CSS, and JS.
4. **Execution Safety**: Adopting the `:not([hidden])` pattern across all 7 identified conflict sites guarantees zero visual regressions upon unlocking, modal popping, or view switching.

---

## 5. Verification Method

The Worker and Reviewer can independently verify these standards using the following automated commands:

1. **Verify 0 `!important` Occurrences in CSS**:
   ```bash
   grep -rn '!important' styles/
   ```
   *Expected result*: 0 matches (exit code 1).

2. **Verify 100% Adherence to CSS Logical Properties (0 Physical Properties)**:
   ```bash
   grep -rEn '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:|\b(top|bottom)\s*:|(margin|padding|border)-(top|bottom)\b)' styles/
   ```
   *Expected result*: 0 matches (exit code 1).

3. **Verify 9 Modular Stylesheet Files and Main Orchestrator Imports**:
   ```bash
   ls -1 styles/
   grep -c '@import' styles/main.css
   ```
   *Expected result*: 10 files listed (`main.css` + 9 domain files); exactly 9 `@import` statements in `styles/main.css`.

4. **Verify Bidirectional Numeric Lock and dir="auto"**:
   ```bash
   grep -n 'numeric-lock' styles/base.css styles/countdown-card.css index.html
   grep -n 'dir="auto"' index.html
   ```
   *Expected result*: All numbers, clocks, and date badges bind `.numeric-lock` and `dir="ltr"`.

5. **Run Full Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected result*: All 25 tests pass (0 failures, 0 regressions).
