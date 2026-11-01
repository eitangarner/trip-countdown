# AGENTS.md

## Context Pointers
- Product & schedule specification: [`PLAN.md`](PLAN.md)
- Visual tokens, lighter matte-glass aesthetic, and RTL/LTR layout rules: [`DESIGN.md`](DESIGN.md)
- Canonical data contracts & baseline trip schedule: [`js/config.js`](js/config.js)

## Architecture & Module Seams
Zero-dependency static PWA (Vanilla HTML5, CSS3, ES2022 Modules) deployed directly to GitHub Pages. Node (`>=20`) is used strictly for offline CLI encryption (`scripts/encrypt-vault.mjs`) and running unit tests (`node --test`).

- `js/config.js` is the single source of truth for schedule constants, country/timezone catalog, and JSDoc `@typedef` contracts.
- `js/countdown-engine.js` is a pure state machine. Every exported function accepts an explicit `nowMs` epoch timestamp (never calling `Date.now()` internally) so the Time-Travel Preview Slider and `node --test` suite are 100% deterministic.
- `js/crypto-vault.js` (browser `crypto.subtle`) and `scripts/encrypt-vault.mjs` (`node:crypto`) share an exact wire contract in `vault.json`.

## Non-Negotiable Invariants

### 1. Date & Timezone Semantics (JavaScript)
- Schedule date strings (`YYYY-MM-DD`) denote full calendar days (`00:00:00.000` through `23:59:59.999`) in the **event's IANA timezone** (`Asia/Jerusalem` for Pre-Trip/origin, or the active country leg's timezone). Never parse `YYYY-MM-DD` with bare `new Date(str)` (which defaults to UTC midnight and shifts dates backward in South America).
- Compute local wall-clock time (`HH:MM`) and UTC offset differences using `Intl.DateTimeFormat('en-US', { timeZone, hour12: false, ... })` so DST transitions in South America, Israel, and Asia are handled natively.
- Reunion #2 (`2027-03-10` to `2027-04-21`) is a single uninterrupted **42-day Together chapter** containing 3 sequential country legs (`SG` -> `KR` -> `JP`). The primary Hero countdown treats the entire 42-day window as one reunion while reporting the active leg and the next internal flight transition.
- During any active reunion leg, both Eitan's and Shoval's status cards automatically resolve to that leg's shared country and timezone unless explicitly overridden in `live-state.json` after the leg started.

### 2. Encryption Wire Contract (`vault.json`)
- Algorithm: `AES-256-GCM` with a 12-byte random `iv` and 128-bit authentication tag.
- Key derivation: `PBKDF2` (`SHA-256`, `150000` iterations, 16-byte random `salt`).
- JSON structure: `{ version: 1, kdf: "PBKDF2-SHA256", iterations: 150000, salt: "<base64>", iv: "<base64>", ciphertext: "<base64>" }`.
- Plaintext decrypted payload matches `VaultPayload` in `js/config.js` (`{ photos: [...], githubToken: string | null, generatedAt: string }`).
- Raw files in `raw-photos/` must never be committed or referenced directly by browser code.

### 3. Bidirectional (Hebrew / English) & Matte-Glass UI Rules (HTML/CSS)
- All user-editable text containers (city/vibe notes, milestone titles, sub-banners) must set `dir="auto"` so Hebrew (`עברית`) and English render with native alignment and punctuation ordering.
- Wrap all formatted dates (`DD.MM.YYYY`), countdown numerals (`D:H:M:S`), clocks (`HH:MM`), and timezone offsets (`+10h`) in elements with `dir="ltr"` and `unicode-bidi: isolate` (`font-variant-numeric: tabular-nums`) so numbers never invert inside RTL Hebrew sentences.
- Use CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`) instead of physical `left`/`right` properties.
- Bind dynamic photo-extracted palette colors exclusively via `:root` custom properties (`--ambient-primary`, `--ambient-secondary`, `--ambient-accent`) clamped to luminous pastel/daylight lightness (`L: 68%–85%` in HSL) to preserve the lighter Apple Music matte-glass aesthetic in [`DESIGN.md`](DESIGN.md).

## Verification Commands
- Run all unit tests: `node --test tests/*.test.mjs`
- Generate encrypted vault: `node scripts/encrypt-vault.mjs <password> [github-token]`
