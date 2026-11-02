# Milestone 1 (Iteration 2) Investigation Report: CSS [hidden] Leakage Defect & Cross-Codebase Specificity Audit

**Author**: Explorer 1  
**Target Milestone**: Milestone 1 (Iteration 2)  
**Target File**: `styles/sheets-and-modals.css`  
**Reference Handoff**: `.agents/teamwork/challenger_m1_1/handoff.md`

---

## 1. Observation

### 1.1 Challenger 1 Defect Reproduction
Executing Challenger 1's empirical verification script directly:
```bash
$ node -e '
const fs = require("fs");
const css = fs.readFileSync("styles/sheets-and-modals.css", "utf8");
const chapterNotHidden = css.includes("#timeline-chapter-fields:not([hidden])");
const milestoneNotHidden = css.includes("#timeline-milestone-fields:not([hidden])");
const chapterHidden = css.includes("#timeline-chapter-fields[hidden]");
const milestoneHidden = css.includes("#timeline-milestone-fields[hidden]");
if (!chapterNotHidden || !milestoneNotHidden || !chapterHidden || !milestoneHidden) {
  console.error("FAIL: #timeline-milestone-fields and #timeline-chapter-fields lack :not([hidden]) / [hidden] rules, leaking display: flex!");
  process.exit(1);
}
console.log("PASS: Both fields properly guarded against hidden leakage.");
'
```
**Exit Code**: `1`  
**Output**: `FAIL: #timeline-milestone-fields and #timeline-chapter-fields lack :not([hidden]) / [hidden] rules, leaking display: flex!`

### 1.2 Verbatim Code Locations
1. **Target CSS Declarations** (`styles/sheets-and-modals.css` lines 271–277):
```css
/* Chapter Multi-Country Leg Editor */
#timeline-milestone-fields,
#timeline-chapter-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

2. **Base Hidden Rule** (`styles/base.css` lines 122–124):
```css
[hidden] {
  display: none;
}
```

3. **HTML Initial State** (`index.html` lines 349 & 390):
```html
349:      <div id="timeline-milestone-fields">
...
390:      <div id="timeline-chapter-fields" hidden>
```

4. **DOM Toggling Logic** (`js/app.js` lines 1016–1021):
```javascript
1016:    if (this.dom.timelineMilestoneFields) {
1017:      this.dom.timelineMilestoneFields.hidden = !isMilestone;
1018:    }
1019:    if (this.dom.timelineChapterFields) {
1020:      this.dom.timelineChapterFields.hidden = isMilestone;
1021:    }
```

### 1.3 Historical Root Cause in Monolithic `styles/main.css`
In the original pre-modularization repository (`git show origin/main:styles/main.css` lines 122–124):
```css
[hidden] {
  display: none !important;
}
```
In original `main.css`, `!important` masked all author `display` declarations. When Milestone 1 eliminated all `!important` occurrences pursuant to `AGENTS.md` and `ORIGINAL_REQUEST.md:R1`, `[hidden]` became an un-augmented attribute selector with specificity `(0, 1, 0)`.

### 1.4 Comprehensive Audit of All Selectors Across `styles/*.css` Setting `display`
An automated AST scan of all 10 modular stylesheets (`styles/*.css`) extracted all selectors setting `display: <value>` where `<value> !== 'none'`. Cross-referencing against all elements that carry `hidden` in `index.html` or toggle `.hidden` in `js/`:

| Element | Tag & ID / Class | Stylesheet Location | Guarded? | Status |
|---|---|---|---|---|
| Main Board Container | `<main id="board-container" class="board-container">` | `styles/base.css:178, 194` | `.board-container:not([hidden])` / `.board-container[hidden]` | **GUARDED** |
| View Panels | `<div id="view-timeline" class="view-panel">` | `styles/base.css:207, 223` | `.view-panel:not([hidden])` / `.view-panel[hidden]` | **GUARDED** |
| App Bottom Nav | `<nav id="bottom-nav" class="bottom-nav">` | `styles/base.css:264, 286` | `.bottom-nav:not([hidden])` / `.bottom-nav[hidden]` | **GUARDED** |
| Preview Banner | `<div id="preview-banner" class="preview-banner">` | `styles/countdown-card.css:11, 33` | `.preview-banner:not([hidden])` / `.preview-banner[hidden]` | **GUARDED** |
| Apart View | `<div id="countdown-apart-view">` | `styles/countdown-card.css:109, 117` | `#countdown-apart-view:not([hidden])` / `#countdown-apart-view[hidden]` | **GUARDED** |
| Separation Progress | `<div id="separation-progress-container" class="...">` | `styles/countdown-card.css:214, 221` | `.separation-progress-container:not([hidden])` / `[hidden]` | **GUARDED** |
| Sub-Milestone Banner | `<div id="sub-milestone-banner" class="...">` | `styles/countdown-card.css:252, 269` | `.sub-milestone-banner:not([hidden])` / `[hidden]` | **GUARDED** |
| Together Card | `<div id="countdown-together-view" class="...">` | `styles/countdown-card.css:279, 297` | `.together-celebration-card:not([hidden])` / `[hidden]` | **GUARDED** |
| Past Chapters Drawer | `<div id="past-chapters-drawer" class="...">` | `styles/timeline.css:198, 210` | `.past-chapters-drawer:not([hidden])` / `[hidden]` | **GUARDED** |
| Past Chapters Button | `<button id="past-chapters-toggle-btn" class="timeline-pill-btn">` | `styles/timeline.css:25, 61` | `.timeline-pill-btn:not([hidden])` / `[hidden]` | **GUARDED** |
| FAB Edit Button | `<button id="fab-edit-btn" class="fab-edit-btn">` | `styles/sheets-and-modals.css:11, 33` | `.fab-edit-btn:not([hidden])` / `[hidden]` | **GUARDED** |
| Edit Bottom Sheets | `<aside id="edit-bottom-sheet" class="edit-bottom-sheet">`, `<aside id="timeline-item-sheet" class="edit-bottom-sheet">` | `styles/sheets-and-modals.css:58, 87` | `.edit-bottom-sheet:not([hidden])` / `[hidden]` | **GUARDED** |
| Modal Backdrops | `<div id="event-modal-backdrop" class="event-modal-backdrop">` | `styles/sheets-and-modals.css:440` | `.event-modal-backdrop[hidden]` (no author `display` declared) | **GUARDED** |
| Centered Modals | `<aside id="event-modal" class="event-modal">`, `<aside id="days-breakdown-modal" class="event-modal">` | `styles/sheets-and-modals.css:444, 465` | `.event-modal:not([hidden])` / `[hidden]` | **GUARDED** |
| Modal Travel Tag | `<span id="event-modal-travel-tag" class="...">` | `styles/sheets-and-modals.css:556, 575` | `.event-modal-travel-tag:not([hidden])` / `[hidden]` | **GUARDED** |
| Modal Subtext | `<div id="event-modal-subtext" class="...">` | `styles/sheets-and-modals.css:612` | `.event-modal-subtext { display: none; }` (always none) | **GUARDED** |
| Ambient Backdrop Aura | `<img id="ambient-backdrop-img" class="ambient-photo-aura">` | `styles/ambient.css:71` | No `display` declared (inherits `inline`; `[hidden]` wins) | **GUARDED** |
| Auto-Sync Indicator | `<span id="auto-sync-indicator" class="tz-code-label">` | `styles/status-bar.css:167` | No `display` declared (inherits `inline`; `[hidden]` wins) | **GUARDED** |
| Timeline Milestone Fields | `<div id="timeline-milestone-fields">` | `styles/sheets-and-modals.css:272` | `#timeline-milestone-fields` (ID `(1, 0, 0)` sets `display: flex`) | **UNGUARDED (DEFECT)** |
| Timeline Chapter Fields | `<div id="timeline-chapter-fields" hidden>` | `styles/sheets-and-modals.css:273` | `#timeline-chapter-fields` (ID `(1, 0, 0)` sets `display: flex`) | **UNGUARDED (DEFECT)** |
| Event Modal Date Pill | `<span id="event-modal-date-pill" class="timeline-date-pill">` | `styles/sheets-and-modals.css:593` | `#event-modal-date-pill` (ID `(1, 0, 0)` sets `display: inline-flex`) | **LATENT (Never hidden in JS, but lacks guard)** |

Across all other CSS files (`styles/gate.css`, `styles/photo-stack.css`, `styles/responsive.css`), zero other rules suffer from hidden leakage.

---

## 2. Logic Chain

1. **W3C CSS Specificity Cascade (Cascading and Inheritance Level 4)**:
   - Specificity of `[hidden] { display: none; }` in `styles/base.css:123` is `(0, 1, 0)`.
   - Specificity of `#timeline-milestone-fields` is `(1, 0, 0)`.
   - Specificity of `#timeline-chapter-fields` is `(1, 0, 0)`.
   - Specificity comparison: `(1, 0, 0) > (0, 1, 0)`.

2. **Cascade Evaluation**:
   - Because `!important` was removed from `[hidden]` to conform with the Zero `!important` invariant, the cascade resolves solely by specificity.
   - When an element bears both `id="timeline-chapter-fields"` and `hidden`, the author declaration `display: flex;` overrides `display: none`.
   - Initial DOM state (`index.html:390`): `<div id="timeline-chapter-fields" hidden>` carries `hidden`, but browser computes `display: flex`.
   - When editing a milestone (`isMilestone === true` in `app.js:1020`), `timelineChapterFields.hidden = true` is set, but the chapter fields remain visible.
   - When editing a chapter (`isMilestone === false` in `app.js:1017`), `timelineMilestoneFields.hidden = true` is set, but the milestone fields remain visible. Both fieldsets collide in the editor sheet.

3. **Comparison with Established Codebase Patterns**:
   - In `styles/countdown-card.css:109–119`, Worker 1 properly addressed ID specificity for `#countdown-apart-view` by creating:
     ```css
     #countdown-apart-view:not([hidden]) { ... display: flex; ... }
     #countdown-apart-view[hidden] { display: none; }
     ```
   - In `styles/sheets-and-modals.css:272–277`, Worker 1 omitted both `:not([hidden])` and `[hidden]` pairwise rules.

4. **Resolution Mechanics of the Proposed Fix**:
   - By updating selector to `#timeline-milestone-fields:not([hidden]), #timeline-chapter-fields:not([hidden])`:
     - When `hidden` is present on the element, `:not([hidden])` evaluates to `false`. The `display: flex` rule does NOT match.
   - By pairing with `#timeline-milestone-fields[hidden], #timeline-chapter-fields[hidden] { display: none; }`:
     - Specificity is `(1, 1, 0)`, which definitively ensures `display: none` wins over any competing rules.

5. **Latent Hardening Assessment**:
   - `#event-modal-date-pill` in `styles/sheets-and-modals.css:593` defines `display: inline-flex` with specificity `(1, 0, 0)` without `:not([hidden])`. While `js/app.js` currently does not toggle `.hidden` on this element, applying the same pairwise `:not([hidden])` / `[hidden]` pattern guarantees immunity from any future leakage.

---

## 3. Caveats

1. **Test Suite Blind Spot**:
   - `node --test tests/*.test.mjs` passes 25/25 tests because existing tests assert DOM string presence (e.g. `assert.ok(html.includes('id="timeline-chapter-fields"'))` at `tests/integration.test.mjs:549`) without computing CSS layout in a browser runtime.
2. **Scope Boundaries**:
   - Worker 2 must restrict modifications strictly to `styles/sheets-and-modals.css` lines 272–277 (and optionally lines 593–600). No JavaScript or HTML files should be touched in Milestone 1 Iteration 2.

---

## 4. Conclusion

The defect reported by Challenger 1 is **verified and 100% valid**. It is an active functional regression in the Timeline Item Editor Sheet resulting from specificity `(1, 0, 0)` overriding `(0, 1, 0)` after the removal of `!important`.

### Recommended Patch for Worker

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/sheets-and-modals.css`:

#### Primary Fix (Mandatory — Resolves Challenger 1 Rejection)
Replace lines 271–277:
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

#### Secondary Hardening (Recommended — Latent Guard)
In lines 593–601:
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

---

## 5. Verification Method

To independently verify the resolution of this defect:

1. **Challenger 1 Leakage Reproduction Assertion**:
   ```bash
   node -e '
   const fs = require("fs");
   const css = fs.readFileSync("styles/sheets-and-modals.css", "utf8");
   const chapterNotHidden = css.includes("#timeline-chapter-fields:not([hidden])");
   const milestoneNotHidden = css.includes("#timeline-milestone-fields:not([hidden])");
   const chapterHidden = css.includes("#timeline-chapter-fields[hidden]");
   const milestoneHidden = css.includes("#timeline-milestone-fields[hidden]");
   if (!chapterNotHidden || !milestoneNotHidden || !chapterHidden || !milestoneHidden) {
     console.error("FAIL: #timeline-milestone-fields and #timeline-chapter-fields lack :not([hidden]) / [hidden] rules, leaking display: flex!");
     process.exit(1);
   }
   console.log("PASS: Both fields properly guarded against hidden leakage.");
   '
   ```
   - **Current State**: Exits with code 1.
   - **Expected Post-Fix State**: Exits with code 0 and outputs `PASS: Both fields properly guarded against hidden leakage.`.

2. **Automated Unit & Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   - **Expected State**: All 25 tests pass (0 failures).

3. **Zero `!important` Compliance Check**:
   ```bash
   grep -rn '!important' styles/
   ```
   - **Expected State**: Exit code 1 (0 matches).

4. **Zero Physical Direction Properties Check**:
   ```bash
   grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
   ```
   - **Expected State**: Exit code 1 (0 matches).
