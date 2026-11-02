# Milestone 1 (Iteration 2) Explorer Investigation & Design Report

## 1. Observation

### 1.1 Direct Defect Observation in Target File
In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/sheets-and-modals.css` lines 271–277:
```css
/* Chapter Multi-Country Leg Editor */
#timeline-milestone-fields,
#timeline-chapter-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/styles/base.css` lines 122–124:
```css
[hidden] {
  display: none;
}
```

In `/Users/eitangarner/Documents/Development/Projects/trip-countdown/index.html` lines 349 & 390:
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

### 1.2 Established Pairwise Pattern Across Other Modules
Across the other modular stylesheets, whenever an element sets a non-none `display` property and may be conditionally hidden, Worker 1 applied a pairwise `:not([hidden])` and `[hidden]` pattern:

- `styles/countdown-card.css` lines 109–119:
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
- `styles/countdown-card.css` lines 214–223:
  ```css
  .separation-progress-container:not([hidden]) { ... }
  .separation-progress-container[hidden] { display: none; }
  ```
- `styles/sheets-and-modals.css` lines 11–35:
  ```css
  .fab-edit-btn:not([hidden]) { ... }
  .fab-edit-btn[hidden] { display: none; }
  ```
- `styles/sheets-and-modals.css` lines 58–89:
  ```css
  .edit-bottom-sheet:not([hidden]) { ... }
  .edit-bottom-sheet[hidden] { display: none; }
  ```
- `styles/sheets-and-modals.css` lines 444–467:
  ```css
  .event-modal:not([hidden]) { ... }
  .event-modal[hidden] { display: none; }
  ```

In `styles/sheets-and-modals.css:272-277`, however, `#timeline-milestone-fields` and `#timeline-chapter-fields` were left unguarded.

### 1.3 Baseline Automated Test Suite & Invariants
- `node --test tests/*.test.mjs` runs 25 tests, all 25 currently pass.
- `grep -rn '!important' styles/` exits with code 1 (0 occurrences).
- `grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/` exits with code 1 (0 occurrences).

---

## 2. Logic Chain

1. **Root Cause of the Regression**:
   - In the monolithic `styles/main.css` prior to Milestone 1, line 123 specified `[hidden] { display: none !important; }`. This forced hidden elements to hide regardless of selector specificity.
   - Under Milestone 1 requirements, all 18 occurrences of `!important` were eliminated. Thus `styles/base.css:123` became `[hidden] { display: none; }`.
2. **W3C CSS Specificity Resolution**:
   - The specificity of `[hidden] { display: none; }` is `(0, 1, 0)` (0 IDs, 1 attribute, 0 element types).
   - The specificity of `#timeline-chapter-fields` and `#timeline-milestone-fields` is `(1, 0, 0)` (1 ID, 0 attributes, 0 element types).
   - Under standard CSS cascade rules (W3C CSS Cascading and Inheritance Level 4), `(1, 0, 0) > (0, 1, 0)`.
   - Consequently, when an element has `id="timeline-chapter-fields"` and `hidden`, the author declaration `display: flex;` overrides `display: none;`.
3. **Runtime Defect Behavior**:
   - On initial page load, `index.html:390` defines `<div id="timeline-chapter-fields" hidden>`. The browser computes `display: flex;`.
   - In Milestone editing mode (`isMilestone === true`), `js/app.js:1020` sets `this.dom.timelineChapterFields.hidden = true`. Because `display: flex` wins specificity, chapter fields remain visible and leak into the milestone editor.
   - In Chapter editing mode (`isMilestone === false`), `js/app.js:1017` sets `this.dom.timelineMilestoneFields.hidden = true`. Because `display: flex` wins specificity, milestone fields remain visible and leak into the chapter editor.
4. **Resolution via Pairwise Selector Guards**:
   - Applying `:not([hidden])` to the flex declaration ensures `#timeline-milestone-fields:not([hidden])` and `#timeline-chapter-fields:not([hidden])` only match when `hidden` is NOT present.
   - Adding explicit `#timeline-milestone-fields[hidden]` and `#timeline-chapter-fields[hidden]` with `display: none;` provides a specificity of `(1, 1, 0)`, guaranteeing immediate cascade override even if another ID rule were introduced.
   - This conforms precisely to the existing design pattern used in `countdown-card.css`, `base.css`, and `sheets-and-modals.css`.

---

## 3. Caveats

- **No Caveats in Styles**: No other elements in `styles/sheets-and-modals.css` or any other modular stylesheet suffer from this defect. Every other conditionally toggled component already uses either direction-neutral buttons without explicit `display` or pairwise `:not([hidden])` and `[hidden]` rules.
- **Out-of-Scope Files**: As noted in Challenger 1's report, Worker 1 also modified `js/photo-stack.js:951` and `index.html:71`. Milestone 1's designated scope per `PROJECT.md:154` is strictly `styles/*.css`. Worker 2 should focus exclusively on `styles/sheets-and-modals.css`.

---

## 4. Conclusion

The defect reported by Challenger 1 is fully reproduced, verified, and isolated to `styles/sheets-and-modals.css` lines 272–277.

### 4.1 Exact Fix Patch
A machine-applicable patch has been written and dry-run validated at:
`/Users/eitangarner/Documents/Development/Projects/trip-countdown/.agents/teamwork/explorer_m1_it2_3/fix-hidden-leakage.patch`

Unified diff patch content:
```diff
--- a/styles/sheets-and-modals.css
+++ b/styles/sheets-and-modals.css
@@ -269,13 +269,18 @@
 }
 
 /* Chapter Multi-Country Leg Editor */
-#timeline-milestone-fields,
-#timeline-chapter-fields {
+#timeline-milestone-fields:not([hidden]),
+#timeline-chapter-fields:not([hidden]) {
   display: flex;
   flex-direction: column;
   gap: 12px;
 }
 
+#timeline-milestone-fields[hidden],
+#timeline-chapter-fields[hidden] {
+  display: none;
+}
+
 .chapter-header-fields-grid {
   display: grid;
   grid-template-columns: minmax(0, 1fr) 88px;
```

---

## 5. Verification Method

The Worker, Reviewers, and Challengers must execute the following 4 verification steps.

### Step 1: Verify Elimination of Hidden Element Leakage
Run the automated cascade and guard verification assertion in Node.js:

```bash
node -e '
const fs = require("fs");
const css = fs.readFileSync("styles/sheets-and-modals.css", "utf8");

const errors = [];

// 1. Guard against unhidden state
if (!css.includes("#timeline-milestone-fields:not([hidden])")) {
  errors.push("Missing #timeline-milestone-fields:not([hidden])");
}
if (!css.includes("#timeline-chapter-fields:not([hidden])")) {
  errors.push("Missing #timeline-chapter-fields:not([hidden])");
}

// 2. Explicit pairwise [hidden] declarations
if (!css.includes("#timeline-milestone-fields[hidden]")) {
  errors.push("Missing #timeline-milestone-fields[hidden]");
}
if (!css.includes("#timeline-chapter-fields[hidden]")) {
  errors.push("Missing #timeline-chapter-fields[hidden]");
}

// 3. No unguarded raw ID selectors setting display
const rawMilestone = /#timeline-milestone-fields(?!\s*:\s*not\(\[hidden\]\)|\s*\[hidden\])/.test(css);
const rawChapter = /#timeline-chapter-fields(?!\s*:\s*not\(\[hidden\]\)|\s*\[hidden\])/.test(css);
if (rawMilestone) errors.push("Unguarded #timeline-milestone-fields selector found");
if (rawChapter) errors.push("Unguarded #timeline-chapter-fields selector found");

if (errors.length > 0) {
  console.error("FAIL: Hidden leakage guards missing:\n - " + errors.join("\n - "));
  process.exit(1);
}
console.log("PASS: Both fields properly guarded against hidden leakage.");
'
```

Additionally, run the CSS Specificity Cascade Resolution Simulator:
```bash
node -e '
const fs = require("fs");
const baseCss = fs.readFileSync("styles/base.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const sheetsCss = fs.readFileSync("styles/sheets-and-modals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function computeDisplay(elementId, hasHidden) {
  let display = "inline";
  let spec = [-1, -1, -1];
  if (hasHidden && baseCss.includes("[hidden]")) {
    display = "none";
    spec = [0, 1, 0];
  }
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  while ((match = ruleRegex.exec(sheetsCss)) !== null) {
    const selGroup = match[1].split(",");
    const body = match[2];
    const dMatch = body.match(/\bdisplay\s*:\s*([^;]+);/);
    if (!dMatch) continue;
    const val = dMatch[1].trim();
    for (const rawSel of selGroup) {
      const s = rawSel.trim();
      let m = false;
      let sp = [0, 0, 0];
      if (s === `#${elementId}`) { m = true; sp = [1, 0, 0]; }
      else if (s === `#${elementId}:not([hidden])`) { m = !hasHidden; sp = [1, 1, 0]; }
      else if (s === `#${elementId}[hidden]`) { m = hasHidden; sp = [1, 1, 0]; }
      if (m && (sp[0] > spec[0] || (sp[0] === spec[0] && sp[1] > spec[1]) || (sp[0] === spec[0] && sp[1] === spec[1] && sp[2] >= spec[2]))) {
        display = val;
        spec = sp;
      }
    }
  }
  return display;
}

const cHidden = computeDisplay("timeline-chapter-fields", true);
const mHidden = computeDisplay("timeline-milestone-fields", true);
const cActive = computeDisplay("timeline-chapter-fields", false);
const mActive = computeDisplay("timeline-milestone-fields", false);

if (cHidden !== "none" || mHidden !== "none" || cActive !== "flex" || mActive !== "flex") {
  console.error("FAIL: Cascade simulation failed:", { cHidden, mHidden, cActive, mActive });
  process.exit(1);
}
console.log("PASS: Cascade simulation verified display: none when hidden, display: flex when unhidden.");
'
```
*Expected Result*: Exits with code 0 and logs `PASS: Cascade simulation verified display: none when hidden, display: flex when unhidden.`

### Step 2: Verify Zero `!important` Occurrences
```bash
grep -rn '!important' styles/
```
*Expected Result*: Exit code 1 (zero matches across all 10 stylesheet files).

### Step 3: Verify 100% CSS Logical Properties
```bash
grep -Enr '(margin-(left|right)|padding-(left|right)|border-(left|right)|text-align:\s*(left|right)|\b(left|right)\s*:)' styles/
```
*Expected Result*: Exit code 1 (zero matches across all 10 stylesheet files).

### Step 4: Verify Full Test Suite Passes
```bash
node --test tests/*.test.mjs
```
*Expected Result*: 25 passing tests, 0 failures, 0 skipped.
