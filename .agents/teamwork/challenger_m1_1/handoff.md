# Milestone 1 (Modular Stylesheets) Empirical Challenge Report

**Verdict**: **REJECT**

---

## 1. Observation

### 1.1 Test Suite & Baseline CSS Invariants
1. **Automated Unit & Integration Test Suite**:
   ```bash
   $ node --test tests/*.test.mjs
   ```
   Result: 25 passing, 0 failures, duration 185ms.
2. **Zero `!important` Occurrences**:
   ```bash
   $ grep -rn '!important' styles/
   ```
   Exit code: 1 (0 matches found across all 10 CSS files).
3. **Zero Physical Direction Properties**:
   ```bash
   $ grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
   ```
   Exit code: 1 (0 matches found). Comprehensive AST audit of 10 files for physical properties (`margin-left/right`, `padding-left/right`, `border-left/right`, `border-*-left/right-radius`, `left/right:`, `text-align: left/right`, `float: left/right`, `clear: left/right`, `scroll-margin/padding`) found 0 violations.
4. **All 9 Modular Stylesheets Present and Imported**:
   `styles/main.css` imports 9 files in exact cascade order matching `PROJECT.md:78-86`:
   `./base.css` (9,285 bytes), `./ambient.css` (2,857 bytes), `./gate.css` (4,975 bytes), `./photo-stack.css` (9,487 bytes), `./countdown-card.css` (7,877 bytes), `./status-bar.css` (4,483 bytes), `./timeline.css` (12,603 bytes), `./sheets-and-modals.css` (14,136 bytes), `./responsive.css` (829 bytes). All files exist on disk.
5. **CSS Syntax & Bracket Balance**:
   AST tokenizer verified all 10 stylesheets have balanced brackets, closed comments, valid declaration formatting, and 0 syntax corruptions.
6. **Keyframes & Token Preservation**:
   All 6 keyframes (`view-fade-in`, `view-slide-forward`, `view-slide-backward`, `vault-shake`, `banner-slide-in`, `modalPopIn`) and all 5 `@property` tokens are intact.
7. **Zero-Knowledge Security Audit**:
   Zero personal names, dates, or secret tokens detected in `styles/*.css`.

---

### 1.2 Defect Observation: Hidden Element Leakage on Timeline Form Fields
In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/sheets-and-modals.css` lines 272–277:
```css
/* Chapter Multi-Country Leg Editor */
#timeline-milestone-fields,
#timeline-chapter-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/base.css` line 123:
```css
[hidden] {
  display: none;
}
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/index.html` line 349 & line 390:
```html
349:      <div id="timeline-milestone-fields">
...
390:      <div id="timeline-chapter-fields" hidden>
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/js/app.js` lines 1016–1020:
```javascript
1016:    if (this.dom.timelineMilestoneFields) {
1017:      this.dom.timelineMilestoneFields.hidden = !isMilestone;
1018:    }
1019:    if (this.dom.timelineChapterFields) {
1020:      this.dom.timelineChapterFields.hidden = isMilestone;
1021:    }
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/countdown-card.css` lines 109–119, Worker 1 correctly implemented `:not([hidden])` and `[hidden]` pairwise rules for ID `#countdown-apart-view`:
```css
#countdown-apart-view:not([hidden]) {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

#countdown-apart-view[hidden] {
  display: none;
}
```
However, for `#timeline-milestone-fields` and `#timeline-chapter-fields`, Worker 1 omitted both `:not([hidden])` and pairwise `[hidden]` rules.

---

### 1.3 Scope Boundary Observation
Worker 1 modified files outside Milestone 1's designated scope (`styles/*.css` per `PROJECT.md:154`):
- `js/photo-stack.js:951` modified: `outgoingCard.style.transform = '';` (Milestone 3 ownership per `PROJECT.md:156`).
- `index.html:71` modified: inline style removed from `<div id="countdown-apart-view">`.

---

## 2. Logic Chain

1. **CSS Specificity Calculation (W3C CSS Cascading and Inheritance Level 4)**:
   - `[hidden] { display: none; }` has specificity `(0, 1, 0)` (0 IDs, 1 attribute selector, 0 types).
   - `#timeline-chapter-fields { display: flex; }` has specificity `(1, 0, 0)` (1 ID, 0 classes/attributes, 0 types).
   - `#timeline-milestone-fields { display: flex; }` has specificity `(1, 0, 0)` (1 ID, 0 classes/attributes, 0 types).
2. **Cascade Resolution under Competing Rules**:
   - Because neither rule possesses `!important`, declarations are ordered solely by selector specificity.
   - Specificity comparison: `(1, 0, 0) > (0, 1, 0)`.
   - Therefore, on any element bearing both `id="timeline-chapter-fields"` and `hidden`, the author declaration `display: flex;` overrides `[hidden] { display: none; }`.
3. **Empirical Failure State**:
   - Initial DOM state (`index.html:390`): `<div id="timeline-chapter-fields" hidden>` carries the `hidden` attribute. The browser computes `display: flex;`.
   - Milestone edit mode (`isMilestone === true`): `this.dom.timelineChapterFields.hidden = true`. Because `display: flex` wins, the chapter editor fields leak and are rendered simultaneously with the milestone fields.
   - Chapter edit mode (`isMilestone === false`): `this.dom.timelineMilestoneFields.hidden = true`. Because `display: flex` wins, the milestone fields leak and are rendered simultaneously with the chapter editor fields.
4. **Contrast with Correct Worker Pattern**:
   - In `styles/countdown-card.css:109-119`, Worker 1 recognized that an ID selector with `display` will override `[hidden]`, and resolved it with `#countdown-apart-view:not([hidden])` paired with `#countdown-apart-view[hidden] { display: none; }`.
   - In `styles/sheets-and-modals.css:272-277`, Worker 1 omitted this pattern, causing a functional regression that violates Objective 1.5 ("Verify that `:not([hidden])` rules properly prevent hidden element leakage").

---

## 3. Caveats

1. The automated test suite (`node --test tests/*.test.mjs`) passes 25/25 tests because existing tests only assert DOM string existence (`assert.ok(html.includes('id="timeline-chapter-fields"'))`) in `tests/integration.test.mjs:549`, without simulating computed CSS layout styles in a browser engine.
2. The scope boundary modification in `js/photo-stack.js:951` (`outgoingCard.style.transform = '';`) was logically necessary to prevent an inline transform collision when removing `!important` from throw transitions, but it belongs to Milestone 3's code ownership.

---

## 4. Conclusion

**Verdict**: **REJECT**.

Milestone 1 satisfies the requirements for zero `!important`, 100% CSS logical properties, syntax validity, and `@import` orchestration. However, it fails the mandatory empirical challenge on hidden element leakage:
- `#timeline-milestone-fields` and `#timeline-chapter-fields` in `styles/sheets-and-modals.css:272–277` define `display: flex` with specificity `(1, 0, 0)` without `:not([hidden])` or `[hidden]` pairwise rules, overriding `[hidden] { display: none; }` `(0, 1, 0)` and leaking hidden fields in the Timeline Item Editor Sheet.

### Required Mitigation for Worker:
In `styles/sheets-and-modals.css`, update lines 272–277 to apply `:not([hidden])` and pairwise `[hidden]` rules:
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

---

## 5. Verification Method

To independently reproduce and verify this defect:

1. **Run the Empirical Hidden Leakage Reproduction Assertion**:
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
   *Current Result*: Exits with code 1 and logs `FAIL: #timeline-milestone-fields and #timeline-chapter-fields lack :not([hidden]) / [hidden] rules, leaking display: flex!`.
   *Invalidation Condition*: When Worker adds `:not([hidden])` and `[hidden]` declarations, the command exits with code 0.

2. **Verify Full Test Suite Passes**:
   ```bash
   node --test tests/*.test.mjs
   ```
   *Expected Result*: 25 passing tests, 0 failures.

3. **Verify Zero `!important`**:
   ```bash
   grep -rn '!important' styles/
   ```
   *Expected Result*: Exit code 1 (0 matches).

4. **Verify Zero Physical Direction Properties**:
   ```bash
   grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
   ```
   *Expected Result*: Exit code 1 (0 matches).
