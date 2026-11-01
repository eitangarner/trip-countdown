# Eitan & Shoval — Backpacking Countdown & Timeline Board 💕

A mobile-first, offline-capable Progressive Web App (PWA) built for GitHub Pages that tracks Eitan and Shoval's backpacking journeys across South America and Asia—counting down to each reunion and milestone along the way.

## Features

- **Apple Music Lighter Matte-Glass Hero**:
  - Live **"Days Together"** relationship counter since `10-01-2026`.
  - Tactile 3D swipeable photo card deck with real-time `<canvas>` color extraction that morphs the page's ambient pastel backdrop (`--ambient-primary`, `--ambient-secondary`, `--ambient-accent`).
  - Live `Days : Hours : Minutes : Seconds` countdown to the next reunion, separation progress bar, and automatic sub-banner for sooner milestones (birthdays, monthly anniversaries).
- **"Where We Are Now" Dual Status & Time-Zone Bridge**:
  - Live local clocks and automatic hour-difference calculation across all **249 ISO countries** (`Intl.DisplayNames` + `Intl.Locale` IANA timezones).
  - Automatic sync to the shared country and timezone whenever a Reunion leg is active (`Thailand 🇹🇭`, `Singapore 🇸🇬`, `South Korea 🇰🇷`, `Japan 🇯🇵`).
  - Native bidirectional (`dir="auto"`) support for English and Hebrew (`עברית`) status notes.
- **Split-and-Merge Chronological Timeline**:
  - Collapsible **"Completed Chapters"** drawer that tucks past events out of the way.
  - Parallel solo rails during Apart phases that physically curve and merge into unified Reunion cards (including the 3-leg `Singapore → South Korea → Japan` stepper).
- **Encrypted Photo & Token Vault (`AES-256-GCM`)**:
  - Keeps personal photos (`raw-photos/`) and your optional GitHub sync token encrypted inside `vault.json` so your public GitHub Pages repository never exposes raw photos or secrets.

---

## Quick Start (Local Preview)

1. **Generate `vault.json` (with your shared password)**:
   ```bash
   # Place any .jpg / .png / .webp photos into images/ (e.g. 15-08-2026.jpg) or raw-photos/
   node scripts/encrypt-vault.mjs shoval
   ```
2. **Run the automated test suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
3. **Start a local static server**:
   ```bash
   python3 -m http.server 8080
   ```
   Open `http://localhost:8080` and unlock with password `shoval`.

---

## Setting Up Mobile Sync for Both Phones (GitHub Pages)

To allow both you and Shoval to update your current country, city/vibe note, or milestones directly from your phones and have the changes appear on **both** phones:

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Set **Repository access** to **Only select repositories** → pick this repository.
3. Under **Repository permissions**, set **Contents** to **Read and write**.
4. Place your favorite couple photos into the local `images/` folder (named `DD-MM-YYYY.jpg`, e.g. `15-08-2026.jpg`; this folder is `.gitignore`d so raw photos are never uploaded).
5. Run the encryption script with your chosen password and token:
   ```bash
   node scripts/encrypt-vault.mjs "<your-shared-password>" "<github_pat_...>" "<your-github-username>/<your-repo-name>"
   ```
6. Commit and push `vault.json` to GitHub, enable **GitHub Pages** (`Settings → Pages → Deploy from branch: main`), and send Shoval the link!
