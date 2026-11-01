# AGENTS.md

## Context Pointers
- Architecture & zero-knowledge security specification: [`PLAN.md`](PLAN.md)
- Visual tokens, lighter matte-glass aesthetic, and RTL/LTR layout rules: [`DESIGN.md`](DESIGN.md)
- ISO-3166 country/timezone catalog & JSDoc `@typedef` contracts: [`js/config.js`](js/config.js)

## Architecture & Module Seams
Zero-dependency static PWA (Vanilla HTML5, CSS3, ES2022 Modules) deployed directly to GitHub Pages. Node (`>=20`) is used strictly for offline CLI encryption (`scripts/encrypt-vault.mjs`) and running unit tests (`node --test`).

- `js/config.js` provides memoized ISO-3166 country/timezone resolution and JSDoc `@typedef` contracts. It must never contain personal names, dates, or itinerary schedules.
- `js/countdown-engine.js` is a pure state machine. Every exported function accepts an explicit decrypted `TripConfig` and `nowMs` epoch timestamp (never calling `Date.now()` internally) so the Time-Travel Preview Slider and `node --test` suite are 100% deterministic.
- `js/crypto-vault.js` (browser `crypto.subtle`), `js/storage-vault.js` (IndexedDB `TripCountdownSecureStorage`), and `scripts/encrypt-vault.mjs` (`node:crypto`) share an exact wire contract in `vault.json`.

## Non-Negotiable Invariants

### 1. Zero-Knowledge Client-Side Security
- `index.html`, `manifest.json`, `styles/main.css`, and `js/*.js` must contain zero hardcoded personal names, dates, or trip destinations. `<main id="board-container">` remains `hidden` and unpopulated until `vault.json` is decrypted.
- `githubToken` exists only inside encrypted `vault.json` and in a private volatile instance field (`#githubToken`) after unlock. When persisting to IndexedDB (`TripCountdownSecureStorage` / `vault_cache`), `record.payload.githubToken` must be stripped (`null`), using a non-extractable `CryptoKey` (`extractable: false`) to unwrap secrets in memory on reload.

### 2. Date & Timezone Semantics (JavaScript)
- Schedule date strings (`YYYY-MM-DD`) denote full calendar days (`00:00:00.000` through `23:59:59.999`) in the **event's IANA timezone** (`homeCountryCode` for Pre-Trip/origin, or the active country leg's timezone). Never parse `YYYY-MM-DD` with bare `new Date(str)`.
- Compute local wall-clock time (`HH:MM`) and UTC offset differences using `Intl.DateTimeFormat('en-US', { timeZone, hour12: false, ... })` so DST transitions are handled natively.
- Multi-leg reunions are evaluated as a single continuous **Together chapter** with zero-gap handoffs at `00:00:00.000` in each incoming leg's local timezone.
- During any active reunion leg, both status cards automatically resolve to that leg's shared country and timezone unless explicitly overridden in `live-state.json` after the leg started.

### 3. Encryption Wire Contract (`vault.json`)
- Algorithm: `AES-256-GCM` with a 12-byte random `iv` and 128-bit authentication tag.
- Key derivation: `PBKDF2` (`SHA-256`, `150000` iterations, 16-byte random `salt`).
- JSON structure: `{ version: 1, kdf: "PBKDF2-SHA256", iterations: 150000, salt: "<base64>", iv: "<base64>", ciphertext: "<base64>" }`.
- Plaintext decrypted payload matches `VaultPayload` in `js/config.js` (`{ tripConfig, photos, githubToken, githubRepo, generatedAt }`).
- Raw files in `raw-photos/`, `images/`, and `private/` must never be committed or referenced directly by browser code.

### 4. Bidirectional (Hebrew / English) & Matte-Glass UI Rules (HTML/CSS)
- All user-editable text containers (city/vibe notes, milestone titles, sub-banners) must set `dir="auto"` so Hebrew (`עברית`) and English render with native alignment and punctuation ordering.
- Wrap all formatted dates (`DD-MM-YYYY`), countdown numerals (`D:H:M:S`), clocks (`HH:MM`), and timezone offsets (`UTC+X`) in elements with `dir="ltr"` and `unicode-bidi: isolate` (`font-variant-numeric: tabular-nums`) so numbers never invert inside RTL Hebrew sentences.
- Use CSS logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`) instead of physical `left`/`right` properties.
- Bind dynamic photo-extracted palette colors exclusively via `:root` custom properties (`--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`, `--ambient-accent`) clamped to luminous pastel/daylight lightness (`L: 68%–85%` in HSL) to preserve the lighter Apple Music matte-glass aesthetic in [`DESIGN.md`](DESIGN.md).

## Verification Commands
- Run all unit tests: `node --test tests/*.test.mjs`
- Generate encrypted vault: `node scripts/encrypt-vault.mjs <password> [github-token] [github-repo-slug]`
