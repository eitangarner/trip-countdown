# Milestone 5 Investigation & Design: Zero-Knowledge Security Audit Expansion & UI Modals Resilience

## 1. Observation

### A. Location & Scope of `publicFilesToAudit` in `tests/integration.test.mjs`
- File: `/Users/eitangarner/Documents/Development/Projects/trip-countdown/tests/integration.test.mjs`
- Lines: 184–237 (`Security Audit` test block)
- Lines 191–209 currently declare:
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
- Lines 212–225 construct the 10 forbidden patterns:
  - Dynamic name A regex (Shoval)
  - Dynamic name B regex (Eitan)
  - 5 ISO date patterns (`/2026-01-10/`, `/2026-12-06/`, `/2026-12-31/`, `/2027-03-10/`, `/2027-04-21/`)
  - 2 timestamp epoch patterns (`/1761868800000/`, `/1780272000000/`)
  - GitHub PAT pattern (`/github_pat_/`)

### B. Audit Scan of Public Repository Files
- We executed an automated scan of all public project files against the 10 forbidden patterns.
- **Key Observation on `favicon.svg`**:
  `favicon.svg` **does not exist on disk** and has never existed in git history (`git log --all --full-history -- "**/favicon*"` returned 0 commits). `manifest.json` embeds icons as inline SVG data URIs (`data:image/svg+xml,...`).
  If `'favicon.svg'` is passed to `publicFilesToAudit`, `fs.readFileSync(path.join(ROOT_DIR, 'favicon.svg'), 'utf8')` throws:
  ```
  Error: ENOENT: no such file or directory, open '.../favicon.svg'
  ```
- **The True 35 Public Files**:
  The project contains exactly 35 public web assets (8 Root/Docs/State + 10 Modular CSS + 17 Native ES Modules):
  1. Root & Docs (8): `'index.html'`, `'manifest.json'`, `'sw.js'`, `'live-state.json'`, `'README.md'`, `'PLAN.md'`, `'DESIGN.md'`, `'AGENTS.md'`
  2. Stylesheets (10): `'styles/main.css'`, `'styles/base.css'`, `'styles/ambient.css'`, `'styles/gate.css'`, `'styles/photo-stack.css'`, `'styles/countdown-card.css'`, `'styles/status-bar.css'`, `'styles/timeline.css'`, `'styles/sheets-and-modals.css'`, `'styles/responsive.css'`
  3. JavaScript Modules (17): `'js/config.js'`, `'js/date-utils.js'`, `'js/anniversaries.js'`, `'js/countdown-engine.js'`, `'js/photo-palette.js'`, `'js/photo-badge.js'`, `'js/photo-stack.js'`, `'js/ui-gestures.js'`, `'js/ui-modals.js'`, `'js/ui-status-sheet.js'`, `'js/ui-editor-sheet.js'`, `'js/ui-preview-banner.js'`, `'js/app.js'`, `'js/timeline-renderer.js'`, `'js/storage-vault.js'`, `'js/crypto-vault.js'`, `'js/github-sync.js'`
  - *(Optional 36th File)*: `'scripts/encrypt-vault.mjs'` (offline Node encryption CLI).
- **Audit Execution Result**:
  Across all 35 public files (+ `scripts/encrypt-vault.mjs`), scanning all 10 forbidden patterns produced **0 matches and 0 failures**.

### C. Inspection of `js/ui-modals.js` (Challenger m4 Non-Blocking Finding)
1. **Private Field Initialization Bug**:
   - Location: `js/ui-modals.js:197-199`
   - Code:
     ```javascript
     closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
     doneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),
     editBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn'))
     ```
   - Whereas `DaysBreakdownModal` (`js/ui-modals.js:47-48`) and other `#dom` fields are initialized to `null`.
   - Because these are initialized at class evaluation time, invoking `new EventCountdownModal()` in a headless Node environment without `globalThis.document` immediately throws `ReferenceError: document is not defined`.
   - Inside the constructor, `#cacheDomElements()` (line 220) already contains `if (typeof document === 'undefined') return;` and assigns these exact elements if `document` is present.
2. **Unguarded `window.removeEventListener` in `destroy()`**:
   - Locations: `js/ui-modals.js:167` (`DaysBreakdownModal.destroy()`) and `js/ui-modals.js:452` (`EventCountdownModal.destroy()`)
   - Code:
     ```javascript
     window.removeEventListener('keydown', this.#handleKeydown);
     ```
   - Calling `destroy()` in a headless Node environment without `globalThis.window` throws `ReferenceError: window is not defined`.
3. **Co-located Vulnerability Tests in `tests/ui-controllers-verification.test.mjs`**:
   - Lines 466–504 contains two tests written by `challenger_m4_1`:
     - `test('Vulnerability Confirmation: EventCountdownModal throws ReferenceError on instantiation if document is undefined')`
     - `test('Vulnerability Confirmation: DaysBreakdownModal and EventCountdownModal destroy() throw ReferenceError if window is undefined')`
   - These tests explicitly assert `assert.throws(..., { name: 'ReferenceError' })`. When `js/ui-modals.js` is patched to be safe, these tests will fail unless updated to assert non-throwing behavior.

---

## 2. Logic Chain

1. **Origin of the 35 Files Count**:
   - Monolithic starting state: 17 files in `publicFilesToAudit`.
   - Milestone 1 extracted 9 new stylesheets: `17 + 9 = 26`.
   - Milestone 2, 3, 4 extracted 9 new JavaScript modules: `26 + 9 = 35`.
   - Therefore, the 35 public files comprise the 17 original public files + 9 new modular stylesheets + 9 new modular JS files.
   - The dispatch prompt listing omitted `live-state.json` and `AGENTS.md` (which were already in `publicFilesToAudit`) and substituted `scripts/encrypt-vault.mjs` and `favicon.svg`.
   - Because `favicon.svg` is non-existent, retaining `live-state.json` and `AGENTS.md` exactly preserves the 35 public web files. Additionally, including `scripts/encrypt-vault.mjs` (making 36 files) provides full coverage of the repository's public code.
2. **Deterministic Security Verification**:
   - The security scan iterates each file through all 10 regexes.
   - Every one of the 35 public files (+ CLI) contains zero personal names, zero sensitive ISO date strings, zero target epoch timestamps, and zero GitHub PAT tokens.
3. **Headless Safety for `js/ui-modals.js`**:
   - Initializing `closeBtn: null`, `doneBtn: null`, `editBtn: null` in `EventCountdownModal` aligns it with `DaysBreakdownModal`.
   - Wrapping `window.removeEventListener` in `if (typeof window !== 'undefined')` prevents `ReferenceError` during headless test teardown.
   - Updating `tests/ui-controllers-verification.test.mjs` to verify safe instantiation and destruction completes the verification loop without breaking the test suite.

---

## 3. Caveats

1. **`favicon.svg` Absence**:
   - Do NOT add `'favicon.svg'` to `publicFilesToAudit` without creating the file on disk. Doing so will cause `fs.readFileSync` to throw `ENOENT` and fail CI.
   - If an SVG favicon is ever desired in the future, it should be created from the `manifest.json` SVG markup and added to both `index.html` (`<link rel="icon">`) and `publicFilesToAudit`. At present, the PWA relies on inline data URIs in `manifest.json`.
2. **Test Inversion in `tests/ui-controllers-verification.test.mjs`**:
   - Milestone 4 challenger introduced two tests asserting that `ui-modals.js` throws `ReferenceError`.
   - The implementer of Milestone 5 must update those two tests simultaneously with the fix in `js/ui-modals.js`.

---

## 4. Conclusion & Implementation Blueprint

### Recommendation 1: Expand `publicFilesToAudit` in `tests/integration.test.mjs`
Replace lines 191–209 with the complete 35/36 public files array:
```javascript
  const publicFilesToAudit = [
    // Root & documentation (8 files)
    'index.html',
    'manifest.json',
    'sw.js',
    'live-state.json',
    'README.md',
    'PLAN.md',
    'DESIGN.md',
    'AGENTS.md',

    // Stylesheets (all 10 modular stylesheets)
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

    // JavaScript modules (all 17 ES modules)
    'js/config.js',
    'js/date-utils.js',
    'js/anniversaries.js',
    'js/countdown-engine.js',
    'js/photo-palette.js',
    'js/photo-badge.js',
    'js/photo-stack.js',
    'js/ui-gestures.js',
    'js/ui-modals.js',
    'js/ui-status-sheet.js',
    'js/ui-editor-sheet.js',
    'js/ui-preview-banner.js',
    'js/app.js',
    'js/timeline-renderer.js',
    'js/storage-vault.js',
    'js/crypto-vault.js',
    'js/github-sync.js',

    // Offline encryption CLI (1 file)
    'scripts/encrypt-vault.mjs'
  ];
```

### Recommendation 2: Headless Node DOM & Window Guards in `js/ui-modals.js`
1. **Lines 197–199**:
   ```javascript
   // BEFORE:
   closeBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-close-btn')),
   doneBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-done-btn')),
   editBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('event-modal-edit-btn'))

   // AFTER:
   closeBtn: /** @type {HTMLButtonElement | null} */ (null),
   doneBtn: /** @type {HTMLButtonElement | null} */ (null),
   editBtn: /** @type {HTMLButtonElement | null} */ (null)
   ```
2. **Lines 167 & 452 (`destroy()` methods)**:
   ```javascript
   // BEFORE:
   window.removeEventListener('keydown', this.#handleKeydown);

   // AFTER:
   if (typeof window !== 'undefined') {
     window.removeEventListener('keydown', this.#handleKeydown);
   }
   ```
3. **Lines 142 & 418 (`close()` methods)**:
   ```javascript
   if (typeof window !== 'undefined') {
     window.removeEventListener('keydown', this.#handleKeydown);
   }
   ```
4. **Lines 125, 129, 332, 336 (`open()` methods)**:
   ```javascript
   this.#previousFocusedElement = typeof document !== 'undefined' ? /** @type {HTMLElement} */ (document.activeElement) : null;
   if (typeof window !== 'undefined') {
     window.addEventListener('keydown', this.#handleKeydown);
   }
   ```

### Recommendation 3: Invert Vulnerability Tests in `tests/ui-controllers-verification.test.mjs`
Update lines 466–504 to verify non-throwing headless behavior:
```javascript
test('UI Sub-Controllers: EventCountdownModal instantiation succeeds safely if document is undefined', () => {
  const prevDoc = globalThis.document;
  try {
    delete globalThis.document;
    assert.doesNotThrow(() => {
      const modal = new EventCountdownModal();
      assert.equal(modal.isOpen(), false);
    });
  } finally {
    globalThis.document = prevDoc;
  }
});

test('UI Sub-Controllers: DaysBreakdownModal and EventCountdownModal destroy() succeed safely if window is undefined', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  try {
    globalThis.document = {
      getElementById: () => null,
      querySelector: () => null
    };
    delete globalThis.window;

    const daysModal = new DaysBreakdownModal();
    assert.doesNotThrow(() => daysModal.destroy());

    const eventModal = new EventCountdownModal();
    assert.doesNotThrow(() => eventModal.destroy());
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});
```

---

## 5. Verification Method

1. **Verify Security Scan Across All Public Files**:
   Execute:
   ```bash
   node --test tests/integration.test.mjs
   ```
   Confirm that the `Security Audit: Zero personal names, itinerary dates, or token.txt exist in public HTML/JS/CSS/Docs` test passes without error.
2. **Verify Full Unit & Integration Test Suite**:
   Execute:
   ```bash
   node --test tests/*.test.mjs
   ```
   Confirm that all 33 tests execute and pass with 0 failures.
3. **Verify Headless SSR / Node Resilience**:
   Execute:
   ```bash
   node --input-type=module -e '
   import { DaysBreakdownModal, EventCountdownModal } from "./js/ui-modals.js";
   const e = new EventCountdownModal();
   const d = new DaysBreakdownModal();
   e.destroy();
   d.destroy();
   console.log("Headless instantiation & destroy succeeded without DOM polyfills");
   '
   ```
   Confirm exit code 0 and successful console output.
