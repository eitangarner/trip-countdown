# DESIGN.md — Visual System & Bidirectional UX Specification

## 1. Aesthetic Direction: Apple Music Lighter Matte Glass

Instead of heavy dark-mode glass, the board uses a **luminous, airy Apple Music matte-glass aesthetic**:
- A warm alabaster/pearl base canvas (`#f5f5f7`) infused with soft, high-saturation radial color dispersion extracted from the active photo (`filter: blur(75px) saturate(1.75)`).
- Extracted photo colors are clamped to a **luminous pastel range** (`HSL lightness 68%–84%`, `saturation 65%–90%`) so the ambient wash feels vibrant and sunlit without overpowering dark-ink typography (`#14151a`).
- Cards sit on **frosted white matte glass** (`rgba(255, 255, 255, 0.62)`) with `backdrop-filter: blur(28px) saturate(190%)`, specular inner-top highlights (`inset 0 1px 0 rgba(255, 255, 255, 0.85)`), and whisper-thin borders (`1px solid rgba(255, 255, 255, 0.72)`).

---

## 2. Canonical CSS Custom Properties (`:root`)

All components must reference these tokens in `styles/main.css`—never hardcode ad-hoc surface or accent colors:

```css
:root {
  /* Dynamic Photo-Extracted Palette (updated smoothly over 800ms by photo-stack.js) */
  --ambient-primary: #f6b8d0;    /* Soft rose default */
  --ambient-secondary: #b8d8f8;  /* Sky pastel default */
  --ambient-accent: #e86f9a;     /* Richer interactive accent (buttons, active rail, progress fill) */

  /* Base Canvas & Matte Glass Surfaces */
  --bg-canvas: #f4f4f8;
  --surface-glass: rgba(255, 255, 255, 0.62);
  --surface-glass-strong: rgba(255, 255, 255, 0.80);
  --surface-glass-subtle: rgba(255, 255, 255, 0.42);
  --surface-border: rgba(255, 255, 255, 0.78);
  --surface-border-subtle: rgba(20, 21, 26, 0.07);
  --surface-shadow: 0 12px 36px -8px rgba(24, 28, 44, 0.08),
                    0 2px 6px -1px rgba(24, 28, 44, 0.04),
                    inset 0 1px 0 0 rgba(255, 255, 255, 0.88);

  /* Typography & Ink Colors */
  --ink-primary: #14151a;
  --ink-secondary: #4a4f5e;
  --ink-muted: #7b8194;
  --ink-on-accent: #ffffff;

  /* Track & Person Accents */
  --track-shoval: #e05d87;       /* Warm rose-coral rail */
  --track-eitan: #3b82f6;        /* Crisp ocean-blue rail */
  --track-together: #d946ef;     /* Merged reunion gradient anchor */

  /* Layout & Geometry */
  --radius-xl: 28px;
  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-pill: 9999px;
  --blur-matte: blur(28px) saturate(190%);
  --transition-ambient: 800ms cubic-bezier(0.22, 1, 0.36, 1);
  --transition-spring: 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 3. Ambient Dispersion & Tactile Photo Stack

1. **Ambient Background Layer (`.ambient-stage`)**:
   - Fixed full-viewport backdrop (`position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden`).
   - Renders two overlapping radial blobs (`--ambient-primary` and `--ambient-secondary`) plus a blurred projection of the active photo (`filter: blur(75px) saturate(1.75); opacity: 0.48`) masked with a soft radial vignette into `--bg-canvas`.
2. **3D Photo Card Stack (`.photo-stack`)**:
   - Aspect ratio `4 / 4.6`, max width `300px` on mobile (`340px` on tablet/desktop), centered in the Hero.
   - **Active Card (`[data-depth="0"]`)**: `transform: translate3d(0, 0, 0) scale(1) rotate(0deg); z-index: 3; opacity: 1;`
   - **Next Card (`[data-depth="1"]`)**: `transform: translate3d(0, 12px, -20px) scale(0.94) rotate(2.5deg); z-index: 2; opacity: 0.82;`
   - **Third Card (`[data-depth="2"]`)**: `transform: translate3d(0, 22px, -40px) scale(0.88) rotate(-2deg); z-index: 1; opacity: 0.58;`
   - Touch drag horizontally (`> 45px` threshold) or tap to send the top card to the back with a spring curve (`--transition-spring`).

---

## 4. Typography & Bidirectional (RTL / Hebrew + English) Rules

- **Font Stack**:
  - `--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Heebo", "Inter", system-ui, sans-serif;`
  - Include native Hebrew fallback metrics so mixed English/Hebrew lines share balanced cap-height and line-height (`1.45`).
- **Numeric Stability**:
  - Every live counter (`D : H : M : S`), relationship day pill, local clock (`HH:MM`), and date badge (`DD.MM.YYYY`) **must** apply:
    ```css
    .numeric-lock {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    ```
- **RTL-Safe Layout & Text**:
  - User-facing text fields (`cityNote`, milestone titles, custom notes) must carry `dir="auto"` in HTML so `"ברילוצ׳ה 🏔️"` right-aligns naturally while `"Koh Tao 🤿"` left-aligns.
  - All spacing, borders, and badges must use CSS logical properties (`padding-inline`, `margin-inline-start`, `border-inline-start`, `inset-inline`).

---

## 5. Component Specifications

### A. Hero Section
- **Top Pill**: Frosted pill showing `💕 X Days Together • Y Months, Z Days` since `10.01.2026`.
- **Photo Deck**: Interactive 3-card stack with subtle caption badge at the bottom-start corner and an auto-rotate play/pause toggle pill at the bottom-end corner.
- **Primary Countdown Matte Card**:
  - When **Pre-Trip**: Banner `"🏡 Together at Home 🇮🇱"` + countdown to Shoval's departure (`06.12.26`) & Reunion #1 in Thailand (`31.12.26`).
  - When **Apart**: Large tabular `Days : Hours : Mins : Secs` countdown to the next Reunion, a smooth matte progress bar showing `% of separation completed`, and a secondary glass sub-banner showing the **next sooner milestone** (e.g., `"🎂 Next up in 3 days: Shoval's Hebrew Birthday (15.12)"`).
  - When **Together (Reunion Active)**: Celebratory gradient pill `"🌺 Together Now in Thailand! (Day 3 of 11)"` or `"🌸 Together in Japan 🇯🇵 (Leg 3 of 3 • Day 22 of 42)"`, plus countdown to the next shared leg or milestone.

### B. "Where We Are Now" Dual Status & Time-Zone Bridge
- Two side-by-side matte glass cards (`grid-template-columns: 1fr auto 1fr` on mobile with a centered overlapping Time-Zone Bridge pill).
- Left/Start card: **Shoval** (`--track-shoval` top dot, flag emoji, country name, `dir="auto"` city/vibe note, live `HH:MM` local clock).
- Center Bridge Pill: `🌐 10h apart` or `✨ Same time zone!`.
- Right/End card: **Eitan** (`--track-eitan` top dot, flag emoji, country name, `dir="auto"` city/vibe note, live `HH:MM` local clock).

### C. Split-and-Merge Chronological Timeline
- **Header Bar**: Trip Stats summary pill (`53 Trip Days Together Planned`) + collapsible `"Completed Chapters (X)"` drawer button so past events stay tucked away by default.
- **Split Rails (Apart Phases)**: Two parallel vertical tracks (`--track-shoval` and `--track-eitan`) with anchored milestone cards on the left/right or spanning across both tracks for shared relationship anniversaries.
- **Merged Reunion Card (Together Phases)**: Dynamic SVG cubic-bezier connectors smoothly bend the two rails inward into a single wide frosted reunion card with a subtle iridescent border, displaying the internal leg stepper for multi-country reunions (`Singapore 🇸🇬 10.03–13.03` → `South Korea 🇰🇷 13.03–20.03` → `Japan 🇯🇵 20.03–21.04`).

### D. Mobile Edit Bottom Sheet & Time-Travel Bar
- Floating `✏️ Update` pill button anchored at `bottom: calc(16px + env(safe-area-inset-bottom))`, `inset-inline-end: 16px`.
- Opens a matte-glass bottom sheet (`max-height: 88dvh`, scrollable) with:
  1. **Time-Travel Preview Slider**: Scrubs between `2026-10-31` and `2027-06-01` with quick-jump preset chips (`Today`, `Apart Dec 12`, `Thailand NYE`, `Apart Feb 15`, `Singapore Mar 11`, `Japan Mar 25`) and a persistent top floating `"⏱️ Previewing [Date] — Reset to Live"` pill whenever active.
  2. **Quick Status Update**: Country selector dropdowns (40+ countries) & `dir="auto"` city/vibe inputs for Shoval and Eitan.
  3. **Milestone & Reunion Editor**: Add/edit milestones or update post-Japan reunion plans, syncing to GitHub `live-state.json` (with automatic `localStorage` offline queue).
