# Encrypted Trip Countdown & Timeline Board

A zero-dependency, zero-knowledge Progressive Web App (PWA) built for GitHub Pages that tracks two partners' travel chapters, timezone bridge, and split-and-merge reunion timeline. All personal itinerary data, photos, and sync credentials remain encrypted with **AES-256-GCM** (`PBKDF2-SHA256`, 150,000 iterations) until unlocked in the browser.

## Features

- **Zero-Knowledge Client-Side Architecture**:
  - `index.html` and `js/*.js` ship zero hardcoded personal names, dates, or destination schedules.
  - All schedules (`tripConfig`), downscaled Retina photos (`photos`), and optional GitHub sync credentials (`githubToken`) live inside `vault.json` encrypted via `scripts/encrypt-vault.mjs`.
  - Decrypted payloads are cached in IndexedDB (`TripCountdownSecureStorage`) with `githubToken` stripped at rest and unwrapped in volatile RAM via a non-extractable Web Crypto `CryptoKey`.
- **Apple Music Lighter Matte-Glass Hero**:
  - Live **"Days Together"** counter and tactile 3D swipeable photo card deck with luminous pastel color dispersion (`--ambient-primary`, `--ambient-secondary`, `--ambient-accent`).
  - Live `Days : Hours : Minutes : Seconds` countdown to the next reunion, separation progress bar, and automatic sub-banner for sooner milestones.
- **"Where We Are Now" Dual Status & Time-Zone Bridge**:
  - Live local clocks and automatic hour-difference calculation across all **249 ISO countries** (`Intl.DisplayNames` + `Intl.Locale` IANA timezones).
  - Automatic sync to the shared country and timezone whenever a Reunion leg is active.
  - Native bidirectional (`dir="auto"`) support for English and Hebrew (`עברית`) status notes.
- **Split-and-Merge Chronological Timeline**:
  - Collapsible **"Completed Chapters"** drawer that tucks past events out of the way.
  - Parallel solo rails during Apart phases that curve and merge into unified Reunion cards (including multi-country leg steppers).

---

## Quick Start (Local Development & Packaging)

1. **Configure Private Schedule & Photos**:
   - Place your canonical schedule JSON at `private/trip-config.json` (gitignored).
   - Place your optional fine-grained GitHub PAT at `private/github-token.txt` (gitignored).
   - Place your photos into `images/` or `raw-photos/` (gitignored).
2. **Generate Encrypted `vault.json`**:
   ```bash
   node scripts/encrypt-vault.mjs "<your-shared-password>"
   ```
3. **Run the Automated Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
4. **Start a Local Static Server**:
   ```bash
   python3 -m http.server 8080
   ```

---

## Setting Up Mobile Sync (GitHub Pages)

1. Generate a fine-grained GitHub Personal Access Token scoped **only** to this repository with **Contents: Read and write** permission, and save it to `private/github-token.txt` (or pass it as the second CLI argument).
2. Run:
   ```bash
   node scripts/encrypt-vault.mjs "<your-shared-password>"
   ```
3. Commit and push `vault.json` to GitHub. Live status updates and custom milestones saved from mobile are encrypted with AES-256-GCM before being committed to `live-state.json`.
