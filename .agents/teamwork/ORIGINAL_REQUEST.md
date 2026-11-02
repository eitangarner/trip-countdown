# Original User Request

## Initial Request — 2026-11-01T22:09:03Z

Refactor and modularize the trip-countdown codebase according to the approved implementation plan artifact and AGENTS.md rules for production. Decompose monolithic files (`styles/main.css`, `js/countdown-engine.js`, `js/photo-stack.js`, and `js/app.js`) into cohesive domain modules while preserving zero-dependency ES2022 compatibility, offline PWA capabilities, and passing all tests.

Integrity mode: demo
The team must NOT: Use pre-built libraries or frameworks for core functionality

Reference material:
- Implementation plan: `/Users/eitangarner/.gemini/antigravity/brain/b8d1fbb5-c33d-47e0-9b5c-c0766b336806/codebase_refactoring_and_modularization_plan.md`
- Architecture and engineering rules: `AGENTS.md`

## Requirements

### R1. Modular Stylesheets (`styles/`)
Split the monolithic stylesheet into cohesive domain stylesheets (`base.css`, `ambient.css`, `gate.css`, `photo-stack.css`, `countdown-card.css`, `status-bar.css`, `timeline.css`, `sheets-and-modals.css`, `responsive.css`) orchestrated by `styles/main.css` via native `@import` statements. Maintain existing cascade ordering, CSS custom property definitions, and styling fidelity.

### R2. Engine & Date Primitives Decoupling
Extract date/timezone primitives into `js/date-utils.js` and relationship duration/anniversary calculations into `js/anniversaries.js`. Maintain board state evaluation in `js/countdown-engine.js` with full backward compatibility via barrel re-exports of all extracted functions so existing consumers and tests experience zero breakage.

### R3. Photo Stack & Color Extraction Decoupling
Extract color conversions and luminous palette extraction into `js/photo-palette.js` and calendar page badge DOM rendering into `js/photo-badge.js`. Retain stack gestures, fallback photos, and backward-compatible re-exports of extracted functions in `js/photo-stack.js`.

### R4. UI Sub-Controllers & Streamlined App Coordinator
Extract touch/drag sheet gestures into `js/ui-gestures.js`, event countdown and days breakdown modals into `js/ui-modals.js`, status bottom sheet into `js/ui-status-sheet.js`, timeline editor sheet into `js/ui-editor-sheet.js`, and time-travel preview banner into `js/ui-preview-banner.js`. Streamline `js/app.js` to coordinate application bootstrap, sub-controller instantiation, board state tick evaluation, and global navigation events.

### R5. PWA Caching & Zero-Knowledge Security Audit
Increment `sw.js` cache version and include all newly created `.css` and `.js` files in `APP_SHELL_ASSETS`. Update `tests/integration.test.mjs` to include all newly created files in the zero-knowledge security audit scan.

## Verification Resources
- Test suite: `node --test tests/*.test.mjs`
- Security scan: `tests/integration.test.mjs`
- Manual verification steps in `/Users/eitangarner/.gemini/antigravity/brain/b8d1fbb5-c33d-47e0-9b5c-c0766b336806/codebase_refactoring_and_modularization_plan.md` (via `npx serve -l 8080 .`)

## Acceptance Criteria

### Automated Tests & Backward Compatibility
- [ ] All 25 existing tests in `node --test tests/*.test.mjs` pass without errors or regressions.
- [ ] `js/countdown-engine.js` maintains 100% backward-compatible public exports by re-exporting all functions moved to `js/date-utils.js` and `js/anniversaries.js`.
- [ ] `js/photo-stack.js` maintains 100% backward-compatible public exports by re-exporting all functions moved to `js/photo-palette.js` and `js/photo-badge.js`.
- [ ] `tests/integration.test.mjs` audits all newly created `.js` and `.css` files for zero-knowledge safety and passes without detecting any personal names, dates, or secrets.
- [ ] `sw.js` cache name is incremented and `APP_SHELL_ASSETS` contains all newly introduced module files.

### Architectural & Code Quality Standards
- [ ] All JavaScript uses native ES2022 modules with explicit `.js` import paths, zero bundlers, and zero external npm dependencies.
- [ ] All CSS rules use CSS logical properties exclusively (`margin-inline`, `padding-inline`, `inset-inline-start`, `text-align: start`, etc.) with zero physical direction properties and zero `!important`.
- [ ] All formatted dates, numerals, clocks, and timezone offsets apply bidirectional numeric locks (`dir="ltr"`, `unicode-bidi: isolate`, `font-variant-numeric: tabular-nums`).
- [ ] All code strictly adheres to the 5 AI Engineering Principles in `AGENTS.md` (no generic identifiers, no tutorial docstrings/comments, no vacuum coding, no paranoid boilerplate).
