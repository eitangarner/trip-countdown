# Milestone 1 (Modular Stylesheets) Review & Adversarial Challenge Report

## Review Summary
**Verdict**: APPROVE

---

## 1. Observation

### 1.1 Scope & Codebase Artifacts Inspected
The review independently evaluated all artifacts produced in Milestone 1:
- `styles/main.css` (15 lines): Native orchestrator with 9 domain `@import` statements.
- `styles/base.css` (373 lines): `@property` registrations, `:root` design tokens, base reset, typography, `.numeric-lock`, `[dir="auto"]`, `.matte-glass`, layout shell (`.app-shell`, `.board-container`, `main`), `.view-panel` slide keyframes, and bottom nav (`.bottom-nav`).
- `styles/ambient.css` (90 lines): `.ambient-stage`, organic drift blobs (`.ambient-blob-*`), photo aura (`.ambient-photo-aura`).
- `styles/gate.css` (202 lines): `.vault-lock-overlay`, `.vault-card`, form controls, shared buttons (`.btn-primary`, `.btn-danger`), `.vault-error-msg`.
- `styles/photo-stack.css` (417 lines): `.hero-section`, `.days-together-pill`, 3D card stack (`.photo-stack`), date badges (`.photo-date-pages`, `.date-pages-compact`), autorotate and shuffle controls.
- `styles/countdown-card.css` (337 lines): `.preview-banner`, `.countdown-card`, `.phase-banner-pill`, `#countdown-apart-view`, 4-unit countdown grid (`.countdown-grid`), separation progress bar, sooner milestone banner, together celebration card.
- `styles/status-bar.css` (210 lines): `.status-section`, `.dual-status-grid`, `.person-status-card`, `.city-note`, clocks, `.tz-bridge-pill`.
- `styles/timeline.css` (565 lines): `.timeline-section`, `.timeline-pill-btn`, `.past-chapters-drawer`, `.days-breakdown-list`, `.milestone-card`, `.reunion-chapter-card`, `.reunion-leg-stepper`.
- `styles/sheets-and-modals.css` (634 lines): `.fab-edit-btn`, `.edit-sheet-backdrop`, `.edit-bottom-sheet`, leg editor cards, sync status pill, `.event-modal-backdrop`, `.event-modal`.
- `styles/responsive.css` (37 lines): Responsive breakpoints (`@media (min-width: 540px)`).
- `index.html`: Removal of inline style from `#countdown-apart-view` (line 71).
- `js/photo-stack.js`: Reset of `outgoingCard.style.transform = '';` during swipe throw transition (line 951).

### 1.2 Quantitative Audit & Command Verifications
1. **Zero `!important` Occurrences**:
   - Executed: `grep -rn '!important' styles/`
   - Result: 0 matches (exit code 1). Confirmed that all 18 occurrences from the monolithic `main.css` were completely eradicated.
2. **Zero Physical Direction Properties**:
   - Executed: `grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/`
   - Result: 0 matches (exit code 1).
   - Additional AST/regex scan checking `top`, `bottom`, `margin-top/bottom`, `padding-top/bottom`, and physical border-radii verified 0 occurrences; 100% adherence to CSS logical properties (`inset-inline-*`, `inset-block-*`, `margin-inline`, `margin-block-*`, `padding-inline`, `padding-block-*`, `border-block-*`, `border-start-start-radius`, `border-start-end-radius`).
3. **Automated Test Suite**:
   - Executed: `node --test tests/*.test.mjs`
   - Result: 25/25 tests passing (0 failures, 162.8ms).
4. **Integrity Check**:
   - Zero hardcoded test results, facade implementations, or bypass shortcuts detected. Source code changes directly and cleanly decompose the production stylesheet.

---

## 2. Logic Chain

### 2.1 Cascade Layering & Interface Conformance
The 9 `@import` statements in `styles/main.css` execute in topological dependency order:
```css
@import './base.css';
@import './ambient.css';
@import './gate.css';          /* exports .btn-primary, .btn-danger */
@import './photo-stack.css';
@import './countdown-card.css'; /* exports .countdown-grid */
@import './status-bar.css';
@import './timeline.css';       /* exports .days-breakdown-list */
@import './sheets-and-modals.css'; /* consumes .btn-primary, .countdown-grid, .days-breakdown-list */
@import './responsive.css';
```
- **Button Inheritance**: `.btn-primary` and `.btn-danger` defined in `gate.css` (lines 144–190) are imported before `sheets-and-modals.css`. In `index.html`, elements inside modal/sheet containers (`#event-modal-done-btn`, `#days-modal-done-btn`, `#tl-save-btn`, `#tl-delete-btn`) consume `.btn-primary` and `.btn-danger`. `sheets-and-modals.css` augments them (e.g. `#event-modal-done-btn { flex: 1; padding-inline: 16px; }`) without conflicting specificity or property redeclaration.
- **Grid Inheritance**: `.countdown-grid` defined in `countdown-card.css` (lines 150–211) is imported prior to `sheets-and-modals.css`. `#event-modal-countdown-grid` (line 477 of `index.html`) correctly inherits all grid column distributions, gaps, `.numeric-lock`, and `.countdown-unit` styling without duplicate declarations.
- **Days Breakdown List Inheritance**: `.days-breakdown-list` defined in `timeline.css` (lines 106–155) is imported prior to `sheets-and-modals.css`. `#days-modal-list` (line 526 of `index.html`) inherits complete breakdown list styling seamlessly.
- **Cross-File Selector Isolation**: Script audit confirmed that only responsive media query overrides in `responsive.css` touch selectors defined in earlier domain stylesheets (`.countdown-card`, `.person-status-card`, `.status-edit-grid`). Zero conflicting duplicate selectors exist across domain files.

### 2.2 Element Hiding & `:not([hidden])` Mechanics
- When `!important` was removed from author stylesheet rules, specificity between user-agent `[hidden] { display: none; }` and author `display: flex/grid` rules needed explicit handling.
- Worker M1 addressed this across all major interactive containers using paired `:not([hidden])` author rules and `[hidden] { display: none; }` overrides with equal specificity:
  - `.view-panel:not([hidden])` / `.view-panel[hidden]` (`base.css:207,223`)
  - `.bottom-nav:not([hidden])` / `.bottom-nav[hidden]` (`base.css:264,286`)
  - `.preview-banner:not([hidden])` / `.preview-banner[hidden]` (`countdown-card.css:11,33`)
  - `#countdown-apart-view:not([hidden])` / `#countdown-apart-view[hidden]` (`countdown-card.css:109,117`)
  - `.separation-progress-container:not([hidden])` / `.separation-progress-container[hidden]` (`countdown-card.css:214,221`)
  - `.sub-milestone-banner:not([hidden])` / `.sub-milestone-banner[hidden]` (`countdown-card.css:252,269`)
  - `.together-celebration-card:not([hidden])` / `.together-celebration-card[hidden]` (`countdown-card.css:279,297`)
  - `.timeline-pill-btn:not([hidden])` / `.timeline-pill-btn[hidden]` (`timeline.css:25,61`)
  - `.past-chapters-drawer:not([hidden])` / `.past-chapters-drawer[hidden]` (`timeline.css:198,210`)
  - `.fab-edit-btn:not([hidden])` / `.fab-edit-btn[hidden]` (`sheets-and-modals.css:11,33`)
  - `.edit-bottom-sheet:not([hidden])` / `.edit-bottom-sheet[hidden]` (`sheets-and-modals.css:58,87`)
  - `.event-modal:not([hidden])` / `.event-modal[hidden]` (`sheets-and-modals.css:444,465`)
  - `.event-modal-travel-tag:not([hidden])` / `.event-modal-travel-tag[hidden]` (`sheets-and-modals.css:556,575`)
- In `index.html:71`, the inline `style="display: flex; ..."` attribute on `#countdown-apart-view` was removed, allowing `#countdown-apart-view[hidden] { display: none; }` to successfully hide the apart view when Together celebration view activates.
- In `js/photo-stack.js:951`, setting `outgoingCard.style.transform = '';` before attaching `.is-throwing-*` ensures the inline drag transform applied during touch moves does not mask the CSS class throw transition, eliminating the previous requirement for `!important`.

---

## 3. Caveats & Adversarial Findings

### 3.1 Minor Finding: `#timeline-milestone-fields` & `#timeline-chapter-fields` ID Specificity vs `[hidden]`
- **Observation**:
  In `styles/sheets-and-modals.css:272–277`:
  ```css
  #timeline-milestone-fields,
  #timeline-chapter-fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  ```
  Neither selector includes `:not([hidden])` nor has a matching `[hidden]` rule in `sheets-and-modals.css`.
- **Adversarial Analysis**:
  The ID selector `#timeline-chapter-fields` has specificity `[1, 0, 0]`. The base stylesheet rule `[hidden]` has specificity `[0, 1, 0]`. Since `[1, 0, 0] > [0, 1, 0]`, CSS cascade rules mandate that `display: flex;` overrides `display: none;` whenever the element has the HTML `hidden` attribute.
- **Current Runtime Status**:
  In `js/app.js:1016–1022` (`setTimelineEditorMode`), JavaScript imperatively sets inline styles:
  `this.dom.timelineMilestoneFields.style.display = isMilestone ? 'flex' : 'none';`
  `this.dom.timelineChapterFields.style.display = isMilestone ? 'none' : 'flex';`
  Because inline styles have specificity `[1, 0, 0, 0]`, they override the ID selector at runtime once invoked.
- **Risk & Recommendation**:
  Relying on inline style overrides violates the architectural principle that visual state should be governed by CSS classes and HTML attributes without JS inline style injection. When Milestone 4 extracts `TimelineEditorSheet` into `js/ui-editor-sheet.js`, update `styles/sheets-and-modals.css` to:
  ```css
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
  This is a non-blocking Minor Finding for Milestone 1.

### 3.2 Service Worker Shell Assets & Integration Audit Deferral to Milestone 5
- `sw.js` and `tests/integration.test.mjs` currently list `styles/main.css`. In Milestone 5, they will be expanded to include all 9 domain `.css` files.
- The 9 files currently pass the zero-knowledge security audit in `tests/integration.test.mjs` with zero personal data leaks.

---

## 4. Conclusion

**Verdict**: **APPROVE**

Milestone 1 satisfies all requirements and invariants:
1. Decomposed monolithic stylesheet into 9 cohesive domain stylesheets orchestrated via native `@import` in `styles/main.css`.
2. Preserved cascade hierarchy and proper cross-file inheritance for `.btn-primary`, `.btn-danger`, `.countdown-grid`, and `.days-breakdown-list`.
3. 100% elimination of `!important` (verified 0 occurrences).
4. 100% adherence to CSS logical properties (verified 0 physical direction properties).
5. Preserved bidirectional numeric locking (`.numeric-lock`, `dir="ltr"`).
6. 100% passing unit and integration tests (25/25 tests passing).

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Verify 0 Occurrences of `!important`**:
   ```bash
   grep -rn '!important' styles/
   ```
   *Expected*: Exit code 1 (0 matches).

2. **Verify 0 Physical Direction Properties**:
   ```bash
   grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
   ```
   *Expected*: Exit code 1 (0 matches).

3. **Verify All 9 `@import` Declarations in Orchestrator**:
   ```bash
   grep '@import' styles/main.css
   ```
   *Expected*: Exactly 9 `@import` statements for base, ambient, gate, photo-stack, countdown-card, status-bar, timeline, sheets-and-modals, and responsive.

4. **Run Unit and Integration Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected*: 25 passed tests, 0 failed tests, duration < 250ms.
