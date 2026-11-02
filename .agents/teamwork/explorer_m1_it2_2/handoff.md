# Milestone 1 (Iteration 2) Comprehensive CSS Specificity & Hidden Gating Audit

**Author**: Explorer 2 (Milestone 1, Iteration 2)  
**Date**: 2026-11-01T22:53:00Z  
**Scope**: All stylesheets (`styles/*.css`), all elements bearing `hidden` in `index.html`, and dynamic DOM visibility controllers in `js/*.js`.

---

## 1. Observation

### 1.1 Global Selector Census & Display Declarations
Across all 10 domain stylesheets imported by `styles/main.css`:
- **Total rule blocks scanned**: 294
- **Selectors declaring non-none `display` (`flex`, `grid`, `inline-flex`, `block`, `inline-block`, `inline`)**: 118 selectors
- **Selectors guarded with `:not([hidden])` paired with equal-specificity `[hidden]`**: 16 selectors across 4 stylesheets:
  - `styles/base.css` (lines 177–179, 193–195): `.app-shell:not([hidden])`, `.board-container:not([hidden])`, `main:not([hidden])` paired with `.app-shell[hidden]`, `.board-container[hidden]`, `main[hidden]`
  - `styles/base.css` (lines 207, 223): `.view-panel:not([hidden])` paired with `.view-panel[hidden]`
  - `styles/base.css` (lines 264, 286): `.bottom-nav:not([hidden])` paired with `.bottom-nav[hidden]`
  - `styles/countdown-card.css` (lines 11, 33): `.preview-banner:not([hidden])` paired with `.preview-banner[hidden]`
  - `styles/countdown-card.css` (lines 109, 117): `#countdown-apart-view:not([hidden])` paired with `#countdown-apart-view[hidden]`
  - `styles/countdown-card.css` (lines 214, 221): `.separation-progress-container:not([hidden])` paired with `.separation-progress-container[hidden]`
  - `styles/countdown-card.css` (lines 252, 269): `.sub-milestone-banner:not([hidden])` paired with `.sub-milestone-banner[hidden]`
  - `styles/countdown-card.css` (lines 279, 297): `.together-celebration-card:not([hidden])` paired with `.together-celebration-card[hidden]`
  - `styles/timeline.css` (lines 25, 61): `.timeline-pill-btn:not([hidden])` paired with `.timeline-pill-btn[hidden]`
  - `styles/timeline.css` (lines 198, 210): `.past-chapters-drawer:not([hidden])` paired with `.past-chapters-drawer[hidden]`
  - `styles/sheets-and-modals.css` (lines 11, 33): `.fab-edit-btn:not([hidden])` paired with `.fab-edit-btn[hidden]`
  - `styles/sheets-and-modals.css` (lines 58, 87): `.edit-bottom-sheet:not([hidden])` paired with `.edit-bottom-sheet[hidden]`
  - `styles/sheets-and-modals.css` (lines 444, 465): `.event-modal:not([hidden])` paired with `.event-modal[hidden]`
  - `styles/sheets-and-modals.css` (lines 556, 575): `.event-modal-travel-tag:not([hidden])` paired with `.event-modal-travel-tag[hidden]`

### 1.2 Identified Unguarded ID Selectors Overriding `[hidden]`
Only **3 selectors** across the entire codebase possess an ID selector specificity `(1, 0, 0)` declaring a non-none `display` property without a paired `:not([hidden])` or `[hidden]` override:

1. **`#timeline-milestone-fields`** in `styles/sheets-and-modals.css:272`:
   ```css
   272: #timeline-milestone-fields,
   273: #timeline-chapter-fields {
   274:   display: flex;
   275:   flex-direction: column;
   276:   gap: 12px;
   277: }
   ```
   - Target in `index.html:349`: `<div id="timeline-milestone-fields">`
   - Target in `js/app.js:1016`: `this.dom.timelineMilestoneFields.hidden = !isMilestone;`
   - Specificity: `(1, 0, 0)` vs `base.css:123` `[hidden]` `(0, 1, 0)`.

2. **`#timeline-chapter-fields`** in `styles/sheets-and-modals.css:273`:
   - Target in `index.html:390`: `<div id="timeline-chapter-fields" hidden>`
   - Target in `js/app.js:1020`: `this.dom.timelineChapterFields.hidden = isMilestone;`
   - Specificity: `(1, 0, 0)` vs `base.css:123` `[hidden]` `(0, 1, 0)`.

3. **`#event-modal-date-pill`** in `styles/sheets-and-modals.css:593–600`:
   ```css
   593: #event-modal-date-pill {
   594:   display: inline-flex;
   595:   align-items: center;
   596:   background: transparent;
   597:   border: none;
   598:   padding: 0;
   599:   box-shadow: none;
   600: }
   ```
   - Target in `index.html:472`: `<span class="timeline-date-pill numeric-lock" id="event-modal-date-pill" dir="ltr"></span>`
   - Specificity: `(1, 0, 0)` vs `base.css:123` `[hidden]` `(0, 1, 0)`.

### 1.3 Stylesheet-by-Stylesheet Audit Summary
| Stylesheet | ID Selectors with `display` | Unguarded High-Specificity Rules | Leakage Risk Status |
|---|---|---|---|
| `styles/base.css` | 0 | 0 (all paired with `:not([hidden])` / `[hidden]`) | **CLEAN** |
| `styles/ambient.css` | 0 | 0 | **CLEAN** |
| `styles/gate.css` | 0 | 0 (uses `is-unlocked`/`is-hidden` with `visibility: hidden; opacity: 0;`) | **CLEAN** |
| `styles/photo-stack.css` | 0 | 0 (uses `[data-depth="hidden"]` with `opacity: 0; pointer-events: none;`) | **CLEAN** |
| `styles/countdown-card.css` | 1 (`#countdown-apart-view`, guarded) | 0 (all 5 hidden containers guarded) | **CLEAN** |
| `styles/status-bar.css` | 0 | 0 (`#auto-sync-indicator` relies on `.tz-code-label` without `display`) | **CLEAN** |
| `styles/timeline.css` | 0 | 0 (both `.timeline-pill-btn` and `.past-chapters-drawer` guarded) | **CLEAN** |
| `styles/sheets-and-modals.css` | 3 (`#timeline-milestone-fields`, `#timeline-chapter-fields`, `#event-modal-date-pill`) | 3 unguarded ID rules | **DEFECTS PRESENT** |
| `styles/responsive.css` | 0 | 0 (zero `display` declarations) | **CLEAN** |
| `styles/main.css` | 0 | 0 (pure orchestrator with 9 native `@import` statements) | **CLEAN** |

### 1.4 DOM Element Visibility Resolution Table
Evaluation of computed `display` for all 25 elements that bear or receive the `hidden` attribute:
| # | Target Element | Initial / Dynamic State | Governing CSS Rule | Specificity | Computed `display` when `hidden` | Result |
|---|---|---|---|---|---|---|
| 1 | `#ambient-backdrop-img` | `index.html:21` (`hidden`) | `[base.css] [hidden]` | `(0, 1, 0)` | `none` | **PASS** |
| 2 | `#board-container` | `index.html:50` (`hidden`) | `[base.css] .board-container[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 3 | `#countdown-apart-view` | `app.js:1633` (dynamic) | `[countdown-card.css] #countdown-apart-view[hidden]` | `(1, 1, 0)` | `none` | **PASS** |
| 4 | `#separation-progress-container` | `index.html:98` (`hidden`) | `[countdown-card.css] .separation-progress-container[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 5 | `#countdown-together-view` | `index.html:110` (`hidden`) | `[countdown-card.css] .together-celebration-card[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 6 | `#sub-milestone-banner` | `index.html:126` (`hidden`) | `[countdown-card.css] .sub-milestone-banner[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 7 | `#auto-sync-indicator` | `index.html:134` (`hidden`) | `[base.css] [hidden]` | `(0, 1, 0)` | `none` | **PASS** |
| 8 | `#view-timeline` | `index.html:185` (`hidden`) | `[base.css] .view-panel[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 9 | `#view-countdown` | `app.js:984` (dynamic) | `[base.css] .view-panel[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 10 | `#past-chapters-toggle` | `index.html:198` (`hidden`) | `[timeline.css] .timeline-pill-btn[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 11 | `#past-chapters-drawer` | `index.html:210` (`hidden`) | `[timeline.css] .past-chapters-drawer[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 12 | `#fab-edit-btn` | `index.html:219` (`hidden`) | `[sheets-and-modals.css] .fab-edit-btn[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 13 | `#bottom-nav` | `index.html:225` (`hidden`) | `[base.css] .bottom-nav[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 14 | `#edit-bottom-sheet` | `index.html:241` (`hidden`) | `[sheets-and-modals.css] .edit-bottom-sheet[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 15 | `#timeline-item-sheet` | `index.html:316` (`hidden`) | `[sheets-and-modals.css] .edit-bottom-sheet[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 16 | `#timeline-milestone-fields` | `app.js:1016` (dynamic) | `[sheets-and-modals.css] #timeline-milestone-fields` | `(1, 0, 0)` | `flex` | **FAIL (LEAK)** |
| 17 | `#timeline-chapter-fields` | `index.html:390` (`hidden`) | `[sheets-and-modals.css] #timeline-chapter-fields` | `(1, 0, 0)` | `flex` | **FAIL (LEAK)** |
| 18 | `#tl-delete-btn` | `index.html:441` (`hidden`) | `[base.css] [hidden]` | `(0, 1, 0)` | `none` | **PASS** |
| 19 | `#event-modal-backdrop` | `index.html:452` (`hidden`) | `[sheets-and-modals.css] .event-modal-backdrop[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 20 | `#event-modal` | `index.html:454` (`hidden`) | `[sheets-and-modals.css] .event-modal[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 21 | `#event-modal-travel-tag` | `index.html:471` (`hidden`) | `[sheets-and-modals.css] .event-modal-travel-tag[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 22 | `#event-modal-subtext` | `index.html:496` (`hidden`) | `[sheets-and-modals.css] .event-modal-subtext` | `(0, 1, 0)` | `none` | **PASS** |
| 23 | `#days-modal-backdrop` | `index.html:506` (`hidden`) | `[sheets-and-modals.css] .event-modal-backdrop[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 24 | `#days-breakdown-modal` | `index.html:508` (`hidden`) | `[sheets-and-modals.css] .event-modal[hidden]` | `(0, 2, 0)` | `none` | **PASS** |
| 25 | `#preview-banner` | `app.js:490` (dynamic) | `[countdown-card.css] .preview-banner[hidden]` | `(0, 2, 0)` | `none` | **PASS** |

---

## 2. Logic Chain

1. **Rule of Specificity (W3C CSS Cascading and Inheritance Level 4)**:
   Author stylesheet selectors calculate specificity as a three-tuple `(A, B, C)` where `A` = ID selectors, `B` = class/attribute/pseudo-class selectors, and `C` = type selectors.
   The global hiding rule in `styles/base.css:123` is:
   ```css
   [hidden] {
     display: none;
   }
   ```
   Its specificity is `(0, 1, 0)`.

2. **Absence of `!important` Constraint**:
   Per `AGENTS.md` ("zero `!important`") and Milestone 1 objectives, `!important` is forbidden across all stylesheets. Consequently, cascade competition between `display: none` and any other `display` declaration is decided solely by selector specificity (and secondarily by source order if specificities are equal).

3. **Cascade Analysis on ID Selectors**:
   - Any selector containing an ID (e.g. `#timeline-milestone-fields`, `#timeline-chapter-fields`, `#event-modal-date-pill`) has specificity `(1, 0, 0)`.
   - Comparison: `(1, 0, 0) > (0, 1, 0)`.
   - Therefore, without `:not([hidden])` and paired `[hidden]` rules on the ID selector itself, `display: flex` or `display: inline-flex` wins over `[hidden] { display: none; }`.
   - In `styles/countdown-card.css:109-119`, Worker 1 correctly applied this pattern:
     `#countdown-apart-view:not([hidden]) { display: flex; ... }`
     `#countdown-apart-view[hidden] { display: none; }`
     Both have specificity `(1, 1, 0)` and safely guarantee that `#countdown-apart-view` is hidden when Together celebration view activates.
   - In `styles/sheets-and-modals.css:272-277`, Worker 1 omitted both `:not([hidden])` and `[hidden]` for `#timeline-milestone-fields` and `#timeline-chapter-fields`. On initial page load (`index.html:390`), `<div id="timeline-chapter-fields" hidden>` computes `display: flex`, leaking the chapter fields.
   - In `styles/sheets-and-modals.css:593-600`, `#event-modal-date-pill` defines `display: inline-flex` under specificity `(1, 0, 0)`. While not currently toggled with `hidden` in `app.js`, it presents identical architectural vulnerability to hidden element leakage.

4. **Cascade Analysis on Class Selectors**:
   - Worker 1 comprehensively guarded all 14 class-based hidden elements across `base.css`, `countdown-card.css`, `timeline.css`, and `sheets-and-modals.css` with paired `:not([hidden])` (specificity `(0, 2, 0)`) and `[hidden]` (specificity `(0, 2, 0)`).
   - For all other class selectors declaring `display: flex/grid` (e.g. `.countdown-grid`, `.person-status-card`, `.chapter-leg-editor-card`), none of their corresponding DOM elements bear or receive the `hidden` attribute. Their visibility is managed either by their parent container being hidden or by conditional DOM mounting/unmounting.

---

## 3. Caveats

1. **Inline Style Masking in `js/app.js`**:
   In `js/app.js:1017,1021`, `setTimelineEditorMode` imperatively sets `style.display = isMilestone ? 'flex' : 'none'` and `style.display = isMilestone ? 'none' : 'flex'`. While inline styles (`(1, 0, 0, 0)`) temporarily mask the CSS cascade leakage at runtime once `setTimelineEditorMode()` is triggered, on initial HTML parse before user interaction `<div id="timeline-chapter-fields" hidden>` is evaluated purely by the CSS cascade (`display: flex`). Relying on inline style injection directly violates `AGENTS.md` ("Never inject ad-hoc inline styles via JavaScript except when updating dynamic CSS variables or continuous drag transforms").
2. **Photo Depth Handling**:
   `styles/photo-stack.css` handles photo visibility via `.photo-card[data-depth="hidden"] { opacity: 0; pointer-events: none; }` rather than the HTML `hidden` attribute. This is by design to enable 3D spring stack transitions.

---

## 4. Conclusion

The audit confirms:
1. **`styles/base.css`**, **`styles/ambient.css`**, **`styles/gate.css`**, **`styles/photo-stack.css`**, **`styles/status-bar.css`**, **`styles/timeline.css`**, and **`styles/responsive.css`** are **100% CLEAN** of hidden element leakage vulnerabilities.
2. **`styles/countdown-card.css`** is **100% CLEAN**; its only ID selector (`#countdown-apart-view`) is properly guarded with `:not([hidden])` and paired `[hidden]`.
3. The defect is isolated exclusively to **`styles/sheets-and-modals.css`**:
   - Defect 1: Lines 272–277 (`#timeline-milestone-fields`, `#timeline-chapter-fields`)
   - Defect 2 (Defensive Hardening): Lines 593–600 (`#event-modal-date-pill`)

### Required Concrete Remediation for Worker M1 (Iteration 2)

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/sheets-and-modals.css`:

#### Fix 1: Guard `#timeline-milestone-fields` and `#timeline-chapter-fields` (Lines 272–277)
Replace:
```css
/* Chapter Multi-Country Leg Editor */
#timeline-milestone-fields,
#timeline-chapter-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```
With:
```css
/* Chapter Multi-Country Leg Editor */
#timeline-milestone-fields:not([hidden]),
#timeline-chapter-fields:not([hidden]) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#timeline-milestone-fields[hidden],
#timeline-chapter-fields[hidden] {
  display: none;
}
```

#### Fix 2: Guard `#event-modal-date-pill` (Lines 593–600)
Replace:
```css
#event-modal-date-pill {
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}
```
With:
```css
#event-modal-date-pill:not([hidden]) {
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: none;
  padding: 0;
  box-shadow: none;
}

#event-modal-date-pill[hidden] {
  display: none;
}
```

Applying these two exact changes closes all possible selector specificity overrides and guarantees zero hidden leakage across the entire application.

---

## 5. Verification Method

To independently reproduce and verify this audit:

### 1. Verification of All Hidden Elements Display Resolution
Run the automated cascade resolution script against guarded and unguarded selectors:
```bash
node -e '
const fs = require("fs");
const path = require("path");

const mainCss = fs.readFileSync("styles/main.css", "utf8");
const files = [...mainCss.matchAll(/@import\s+["\x27]\.\/([^"\x27]+)["\x27];/g)].map(m => m[1]);
const cssRules = [];

for (const file of files) {
  const content = fs.readFileSync(path.join("styles", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(content)) !== null) {
    const selGroup = match[1].trim();
    const decls = match[2];
    if (selGroup.startsWith("@")) continue;
    const dMatch = decls.match(/(?:^|;)\s*display\s*:\s*([^;]+)/);
    for (const sel of selGroup.split(",").map(s => s.trim())) {
      cssRules.push({ file, selector: sel, display: dMatch ? dMatch[1].trim() : null });
    }
  }
}

const targets = [
  { name: "#timeline-chapter-fields", selectorPart: "#timeline-chapter-fields", expectedFail: true },
  { name: "#timeline-milestone-fields", selectorPart: "#timeline-milestone-fields", expectedFail: true },
  { name: "#event-modal-date-pill", selectorPart: "#event-modal-date-pill", expectedFail: true },
  { name: "#countdown-apart-view", selectorPart: "#countdown-apart-view", expectedFail: false },
  { name: ".separation-progress-container", selectorPart: ".separation-progress-container", expectedFail: false },
  { name: ".together-celebration-card", selectorPart: ".together-celebration-card", expectedFail: false },
  { name: ".view-panel", selectorPart: ".view-panel", expectedFail: false },
  { name: ".past-chapters-drawer", selectorPart: ".past-chapters-drawer", expectedFail: false },
  { name: ".fab-edit-btn", selectorPart: ".fab-edit-btn", expectedFail: false },
  { name: ".event-modal", selectorPart: ".event-modal", expectedFail: false }
];

let allPassed = true;
for (const t of targets) {
  const matching = cssRules.filter(r => r.display && r.selector.includes(t.selectorPart));
  const hasHiddenRule = matching.some(r => r.selector.includes("[hidden]") && r.display === "none");
  const hasNotHiddenRule = matching.some(r => r.selector.includes(":not([hidden])"));
  const properlyGuarded = hasHiddenRule && hasNotHiddenRule;
  if (!properlyGuarded && !t.expectedFail) {
    console.error(`Unexpected missing guard for ${t.name}`);
    allPassed = false;
  } else if (!properlyGuarded && t.expectedFail) {
    console.log(`CONFIRMED DEFECT: ${t.name} lacks paired :not([hidden]) / [hidden] guards!`);
  } else {
    console.log(`PASS: ${t.name} is properly guarded.`);
  }
}
if (!allPassed) process.exit(1);
console.log("All target assertions matched expectations.");
'
```
*Current Result*: Exits 0 and confirms defects on `#timeline-chapter-fields`, `#timeline-milestone-fields`, and `#event-modal-date-pill`.
*Invalidation Condition*: When Worker applies the mitigation (changing `expectedFail: false` for all targets), all 10 targets report `PASS`.


### 2. Verification of Zero `!important`
```bash
grep -rn '!important' styles/
```
Expected: Exit code 1 (0 matches).

### 3. Verification of Zero Physical Direction Properties
```bash
grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
```
Expected: Exit code 1 (0 matches).

### 4. Verification of Unit & Integration Test Suite
```bash
node --test tests/*.test.mjs
```
Expected: 25 passing tests, 0 failures.
