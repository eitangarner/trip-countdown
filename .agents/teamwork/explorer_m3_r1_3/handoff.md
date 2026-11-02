# Handoff Report: PhotoStack Controller & Backward-Compatible Barrel Re-Exports (Milestone 3)

## 1. Observation

### 1.1 Existing Structure in `js/photo-stack.js`
`js/photo-stack.js` currently comprises 1,215 lines containing three distinct functional domains:
1. **Photo Stack Fallback Data & Local Constants** (Lines 6–149):
   - Line 6: `const SWIPE_THRESHOLD_PX = 45;`
   - Line 7: `const TAP_SLOP_PX = 8;`
   - Line 8: `const DEFAULT_AUTOROTATE_MS = 4500;`
   - Line 9: `const SAMPLE_CANVAS_SIZE = 32;`
   - Lines 15–149: `export const FALLBACK_PHOTOS = [...]` — an array of 4 built-in `VaultPhoto` cards with inline SVG illustrations (`sky1`, `sea1`, `peakA`, etc.) and pre-extracted HSL luminous pastel palettes.
2. **Color Conversion & Palette Extraction** (Lines 151–490):
   - Lines 158–192: `export function rgbToHsl(r, g, b)`
   - Lines 201–230: `export function hslToHex(h, s, l)`
   - Lines 237–255: `function parseHexColor(hex)`
   - Lines 257–259: `function clamp(value, min, max)`
   - Lines 261–267: `const DEFAULT_LUMINOUS_PALETTE = { primary: '#f6b8d0', secondary: '#b8d8f8', tertiary: '#fbd3a7', quaternary: '#d5bdf8', accent: '#e86f9a' };`
   - Lines 277–283: `export function clampHslForRole(hsl, role = 'primary')`
   - Lines 285–331: Cluster distance & palette expansion helpers (`circularHueBucketDistance`, `bucketToAverageHsl`, `expandHslListToFourRoles`, `buildClampedPalette`).
   - Lines 338–399: `function extractPaletteFromPixels(rgbaData)`
   - Lines 410–490: `export function extractLuminousPalette(imageSource)`
3. **Calendar Date Badge Component** (Lines 492–642):
   - Lines 492–514: `function parseDateParts(str)`
   - Lines 524–642: `export function createPhotoDateElement(dateLabel, { isCompact = false } = {})`
4. **PhotoStackController** (Lines 645–1214):
   - Lines 649–1214: `export class PhotoStackController`

### 1.2 `PhotoStackController` Lifecycle & Methods
- **Instantiation (`constructor`)** (Lines 662–722):
  - Accepts flexible `containerOrConfig`: HTMLElement, selector string (`#photo-stack-container`), or config object `{ container, ambientContainer, photos, deferInitialRender, autoRotate, autoRotateIntervalMs, onPhotoChange }`.
  - Resolves `this.container` and `this.ambientContainer` (defaults to `.ambient-stage`).
  - Initializes `this.photos`: copies passed photos, falls back to `[]` if `deferInitialRender` is true, or defaults to `[...FALLBACK_PHOTOS]`.
  - Sets `this.activeIndex = 0`, `this.autoRotateTimerId = null`, and `this.dragState = { isDragging: false, pointerId: null, startX: 0, startY: 0, deltaX: 0, wasAutoRotating: false }`.
  - Pre-binds event handlers: `boundPointerDown`, `boundPointerMove`, `boundPointerUp`, `boundKeyDown`.
  - Mounting branch:
    - If `this.container`: calls `render()` if photos exist, then calls `bindEvents()`.
    - Else if `this.photos.length > 0`: calls `syncActiveAmbient()` (critical for headless/test environments).
    - If `this.isAutoRotating && this.photos.length > 0`: calls `startAutoRotate()`.
- **Card Lifecycle & Sifting**:
  - `render()` (Lines 791–879): Creates `.photo-stack[role="region"]`, maps photos into `article.photo-card[data-depth]` with child `img.photo-card-img` and `div.photo-card-overlay`. Calls `createPhotoDateElement(photo.dateLabel)` if present. Appends shuffle button (`.photo-shuffle-btn`) and pagination dots (`.photo-dots`). Calls `syncActiveAmbient()`.
  - `computeDepthAttr(cardIndex)` (Lines 886–894): Computes circular offset `(cardIndex - this.activeIndex + total) % total` and maps to `'0'`, `'1'`, `'2'`, or `'hidden'`.
  - `updateStackDepths()` (Lines 899–912): Updates `dataset.depth`, clears `.is-swiping`, `.is-throwing-*`, and clears inline `style.transform = ''` so CSS transitions take effect. Toggles `.is-active` on dots.
  - `next(throwDirection)` (Lines 918–921) / `prev()` (Lines 926–929) / `goTo(index)` (Lines 935–938): Card transition entry points with circular modulo arithmetic.
  - `transitionToIndex(nextIndex, throwDirection)` (Lines 945–974): Marks outgoing card with `is-throwing-start` or `is-throwing-end`, sets a 220ms timer for `updateStackDepths()`, immediately promotes depth of upcoming cards, updates dots, and calls `syncActiveAmbient(activeImg)`.
  - `shuffle()` (Lines 765–779): Fisher-Yates shuffle in place on `this.photos`, resets `activeIndex = 0`, and re-renders or syncs ambient.
  - `setPhotos(photos)` (Lines 750–760): Replaces deck, resets `activeIndex = 0`, re-renders or syncs ambient.
  - `getActivePhoto()` (Lines 784–786): Returns active photo or `FALLBACK_PHOTOS[0]`.
- **Ambient Color & Stage Aura**:
  - `syncActiveAmbient(imgElement)` (Lines 981–1037): Checks cached `activePhoto._extractedPalette`. If not cached, executes `extractLuminousPalette(img)` via offscreen canvas or image decode. If SVG/fallback, extracts palette stops or calls `extractLuminousPalette(null)`. Calls `this.applyAmbientPalette(palette, activePhoto)` and notifies `this.onPhotoChange`.
  - `applyAmbientPalette(palette, photo)` (Lines 1045–1072): Writes `--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`, and `--ambient-accent` directly to `document.documentElement.style`. Finds or creates `.ambient-photo-aura` inside `this.ambientContainer`, sets `src`, and ensures `hidden = false`.
- **Auto-Rotation & Timers**:
  - `startAutoRotate()` (Lines 1089–1098): Clears existing timer, sets `this.isAutoRotating = true`, updates button state, starts `setInterval` running `this.next('start')` every `autoRotateIntervalMs` (guarded against active dragging).
  - `stopAutoRotate()` (Lines 1100–1107): Clears `autoRotateTimerId`, sets `this.isAutoRotating = false`, updates button state.
  - `toggleAutoRotate(forceState)` (Lines 1079–1087): Toggles between play and pause.
  - `updateAutoRotateButton()` (Lines 1110–1114): Syncs class `.is-active`, `aria-pressed`, and text icon (`⏸` vs `↻`) on `this.autoRotateBtn`.
- **Pointer Gestures & Keyboard**:
  - `bindEvents()` (Lines 1116–1123): Attaches `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `keydown` to `this.container`.
  - `handlePointerDown(event)` (Lines 1125–1146): Filters out button clicks and non-primary mouse buttons. Sets `isDragging = true`, records start coordinates, attaches `setPointerCapture`, adds `.is-swiping` to top card.
  - `handlePointerMove(event)` (Lines 1148–1159): Calculates `dx`, clamps rotation angle via `clamp(dx * 0.06, -16, 16)`, and applies continuous transform `translate3d(${dx}px, ${Math.abs(dx) * 0.08}px, 0) rotate(${rotateDeg}deg)`.
  - `handlePointerUp(event)` (Lines 1161–1189): Releases pointer capture, removes `.is-swiping`. If `Math.abs(dx) > SWIPE_THRESHOLD_PX (45px)`, triggers `next('end')` or `next('start')`. If `Math.abs(dx) < TAP_SLOP_PX (8px)`, resets transform and triggers tap-to-sift `next('start')`. Otherwise, resets transform back to 0.
  - `handleKeyDown(event)` (Lines 1191–1202): Listens for `ArrowRight` (next), `ArrowLeft` (prev), and `Space` (toggle auto-rotate).
- **Cleanup & Destruction**:
  - `clear()` (Lines 727–744): Stops auto-rotate, clears `photos`, `cardElements`, `dotElements`, sets `container.innerHTML = ''`, hides `.ambient-photo-aura` and removes its `src`, and applies `DEFAULT_LUMINOUS_PALETTE` to reset root CSS variables.
  - `destroy()` (Lines 1204–1213): Calls `this.stopAutoRotate()`, removes all 5 attached event listeners from `this.container`.

### 1.3 Consumer Import/Export Graph Across the Codebase
A comprehensive scan using `grep_search` across the repository identified all consumers importing from `js/photo-stack.js`:

| Consumer File | Imported Identifiers | Usage in Consumer |
|---|---|---|
| `tests/integration.test.mjs:10` | `FALLBACK_PHOTOS`, `PhotoStackController`, `clampHslForRole`, `createPhotoDateElement`, `extractLuminousPalette`, `rgbToHsl` | Integration tests verifying palette extraction, pastel bounds, photo stack DOM rendering, CSS token binding, and date page badges. |
| `js/app.js:22` | `PhotoStackController`, `createPhotoDateElement` | Instantiates `this.photoStack = new PhotoStackController({ container, ambientContainer, deferInitialRender: true })`. Calls `this.photoStack.setPhotos(payload.photos)` on unlock and `this.photoStack.clear()` on lock. Uses `createPhotoDateElement` in event modal and countdown target date badge. |
| `js/timeline-renderer.js:9` | `createPhotoDateElement` | Renders date pills/badges for milestone cards (`milestone.date`), reunion chapters (`reunion.startDate – reunion.endDate`), and leg badges. |
| `tests/integration.test.mjs:205` | Listed in `publicFilesToAudit` | Security audit ensures zero personal names, itinerary dates, or tokens exist in `js/photo-stack.js`. |

---

## 2. Logic Chain

1. **Separation of Architectural Responsibilities**:
   - `js/photo-palette.js` encapsulates color conversions, pastel clamping math, offscreen canvas pixel quantization, and luminous palette extraction (zero DOM card dependencies).
   - `js/photo-badge.js` encapsulates calendar date parsing and frosted date-page badge DOM node generation (zero card stack or color dependencies).
   - `js/photo-stack.js` should serve strictly as the 3D card deck gesture and autorotation controller, delegating color extraction to `photo-palette.js` and badge generation to `photo-badge.js`.
2. **Preserving 100% Backward Compatibility via Barrel Re-Exports**:
   - `tests/integration.test.mjs` directly imports `rgbToHsl`, `clampHslForRole`, `extractLuminousPalette`, and `createPhotoDateElement` from `../js/photo-stack.js`.
   - `js/timeline-renderer.js` directly imports `createPhotoDateElement` from `./photo-stack.js`.
   - `js/app.js` directly imports `PhotoStackController` and `createPhotoDateElement` from `./photo-stack.js`.
   - By exporting all extracted symbols directly from `js/photo-stack.js` via native ES2022 `export { ... } from './photo-palette.js'` and `export { ... } from './photo-badge.js'`, every consumer and test continues functioning without modification.
3. **Internal Dependencies in `PhotoStackController`**:
   - Inside `PhotoStackController`:
     - Line 743 & 1049: `DEFAULT_LUMINOUS_PALETTE` is needed by `clear()` and `applyAmbientPalette()`.
     - Line 831: `createPhotoDateElement` is needed by `render()`.
     - Lines 997, 1029, 1030: `extractLuminousPalette` is needed by `syncActiveAmbient()`.
     - Line 1156: `clamp` is needed by `handlePointerMove()`.
   - Therefore, `js/photo-stack.js` must import these 4 symbols directly from `./photo-palette.js` and `./photo-badge.js`.
4. **Adherence to the 5 AI Engineering Principles**:
   - *Contextual Discovery*: Reuses existing DOM IDs (`#photo-stack-container`), CSS classes (`.photo-stack`, `.photo-card`, `.ambient-photo-aura`), and CSS variables (`--ambient-*`).
   - *Minimalist Implementation*: Retains existing gesture thresholds (`SWIPE_THRESHOLD_PX = 45`, `TAP_SLOP_PX = 8`, `DEFAULT_AUTOROTATE_MS = 4500`). Zero unnecessary wrappers.
   - *Boundary-Only Defensiveness*: Checks `typeof document !== 'undefined'` for Node test compatibility; fails fast on internal invariants.
   - *Self-Documenting Code*: Eliminates verbose docstrings on simple internal helpers; comments document non-obvious *why* (e.g., immediate upcoming card depth promotion for spring transition).
   - *Domain-Specific Precision*: Banish generic names (`data`, `temp`, `item`, `obj`); use domain identifiers (`photoCard`, `dragState`, `luminousPalette`, `cardDepthAttr`).

---

## 3. Caveats

1. **Extraction Order Dependency**:
   - `js/photo-palette.js` and `js/photo-badge.js` must be created or exist before `js/photo-stack.js` can import from them. If `js/photo-stack.js` is edited before those modules are written, Node ESM imports will fail with `ERR_MODULE_NOT_FOUND`.
2. **Mock Document Limitations in Test Runner**:
   - `tests/integration.test.mjs` runs under Node.js (`node:test`) and provides a minimal mock `document` for `PhotoStackController` and `createPhotoDateElement`.
   - `PhotoStackController` must not rely on browser-only APIs like `document.body` or `window` in its constructor, and must guard `typeof document !== 'undefined'` when touching DOM elements.
3. **PWA Service Worker & Security Audit**:
   - While Milestone 5 handles the final audit list expansion in `tests/integration.test.mjs` and `sw.js` cache bumping, `js/photo-stack.js` is already audited by `tests/integration.test.mjs` and must remain 100% free of sensitive dates or names.

---

## 4. Conclusion & Detailed Design Specification

### 4.1 Target Import/Export Graph

```
                  ┌──────────────────────┐
                  │ js/photo-palette.js  │
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            │ imports:                        │
            │ clamp,                          │
            │ DEFAULT_LUMINOUS_PALETTE,       │
            │ extractLuminousPalette          │
            ▼                                 ▼
┌────────────────────────┐         ┌──────────────────────┐
│   js/photo-badge.js    │         │  js/photo-stack.js   │
└───────────┬────────────┘         │  (Controller Deck)   │
            │                      └──────────┬───────────┘
            │ imports:                        │
            │ createPhotoDateElement          │
            └─────────────────────────────────┤
                                              ▼
                                   Barrel Re-exports:
                                   • FALLBACK_PHOTOS
                                   • PhotoStackController
                                   • SAMPLE_CANVAS_SIZE
                                   • DEFAULT_LUMINOUS_PALETTE
                                   • PASTEL_BOUNDS
                                   • clamp
                                   • rgbToHsl
                                   • hslToRgb
                                   • hslToHex
                                   • parseHexColor
                                   • clampToPastel
                                   • clampHslForRole
                                   • extractPaletteFromPixels
                                   • extractLuminousPalette
                                   • parseDateParts
                                   • createPhotoDateElement
                                              │
                      ┌───────────────────────┼───────────────────────┐
                      ▼                       ▼                       ▼
            ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
            │ tests/           │    │    js/app.js     │    │ js/timeline-     │
            │ integration.     │    │                  │    │ renderer.js      │
            │ test.mjs         │    │                  │    │                  │
            └──────────────────┘    └──────────────────┘    └──────────────────┘
```

### 4.2 Proposed Code Specification for `js/photo-stack.js`

```javascript
/**
 * Swipeable 3D Photo Card Stack Controller.
 * Manages card gestures, tap-to-sift, keyboard navigation, autorotation,
 * and delegates luminous palette extraction and calendar badge rendering.
 * Provides 100% backward-compatible barrel re-exports from photo-palette.js and photo-badge.js.
 */

import {
  clamp,
  DEFAULT_LUMINOUS_PALETTE,
  extractLuminousPalette
} from './photo-palette.js';

import {
  createPhotoDateElement
} from './photo-badge.js';

const SWIPE_THRESHOLD_PX = 45;
const TAP_SLOP_PX = 8;
const DEFAULT_AUTOROTATE_MS = 4500;

/**
 * Built-in fallback set of 4 rich SVG illustration cards when no user photos are loaded.
 * @type {import('./config.js').VaultPhoto[]}
 */
export const FALLBACK_PHOTOS = [
  {
    id: 'fallback-card-1',
    caption: '',
    dateLabel: 'Chapter 01',
    palette: {
      primary: '#f6b8d0',
      secondary: '#fbd3a7',
      tertiary: '#a8d8f8',
      quaternary: '#ffe4b5',
      accent: '#e35d8a'
    },
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460">
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f7b2cc"/>
            <stop offset="52%" stop-color="#fbd2a8"/>
            <stop offset="100%" stop-color="#a8d8f8"/>
          </linearGradient>
          <linearGradient id="sea1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#68a8e8"/>
            <stop offset="100%" stop-color="#3b78c2"/>
          </linearGradient>
        </defs>
        <rect width="400" height="460" fill="url(#sky1)"/>
        <circle cx="200" cy="195" r="68" fill="#fff4d6" opacity="0.88"/>
        <circle cx="200" cy="195" r="92" fill="#ffe4b5" opacity="0.38"/>
        <path d="M0 285 Q100 268 200 285 T400 280 L400 460 L0 460 Z" fill="url(#sea1)" opacity="0.85"/>
        <path d="M0 325 Q120 308 240 325 T400 320 L400 460 L0 460 Z" fill="#2c5fa3" opacity="0.65"/>
        <ellipse cx="200" cy="312" rx="58" ry="6" fill="#ffe6b8" opacity="0.75"/>
        <ellipse cx="200" cy="336" rx="42" ry="4.5" fill="#ffe6b8" opacity="0.55"/>
        <ellipse cx="200" cy="356" rx="26" ry="3.5" fill="#ffe6b8" opacity="0.4"/>
      </svg>
    `)}`
  },
  {
    id: 'fallback-card-2',
    caption: '',
    dateLabel: 'Chapter 02',
    palette: {
      primary: '#b3dcf7',
      secondary: '#c8c4f7',
      tertiary: '#f9d4e4',
      quaternary: '#9cc8eb',
      accent: '#4686db'
    },
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460">
        <defs>
          <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#a8d8f8"/>
            <stop offset="60%" stop-color="#d4d2f9"/>
            <stop offset="100%" stop-color="#f9d4e4"/>
          </linearGradient>
          <linearGradient id="peakA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#5c78a8"/>
            <stop offset="100%" stop-color="#354b75"/>
          </linearGradient>
        </defs>
        <rect width="400" height="460" fill="url(#sky2)"/>
        <circle cx="305" cy="105" r="38" fill="#ffffff" opacity="0.78"/>
        <polygon points="-20,360 115,155 250,360" fill="url(#peakA)"/>
        <polygon points="115,155 82,205 112,195 135,212 152,188" fill="#f8fafc" opacity="0.92"/>
        <polygon points="135,360 265,130 420,360" fill="#466294"/>
        <polygon points="265,130 228,195 258,182 282,205 304,178" fill="#ffffff" opacity="0.94"/>
        <rect y="345" width="400" height="115" fill="#5da9d6" opacity="0.88"/>
        <path d="M0 365 Q200 350 400 368 L400 460 L0 460 Z" fill="#3c82b5" opacity="0.72"/>
      </svg>
    `)}`
  },
  {
    id: 'fallback-card-3',
    caption: '',
    dateLabel: 'Chapter 03',
    palette: {
      primary: '#f8c5a8',
      secondary: '#a8ebd8',
      tertiary: '#f7d794',
      quaternary: '#8de0c8',
      accent: '#de6b48'
    },
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460">
        <defs>
          <linearGradient id="sky3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f9ba96"/>
            <stop offset="50%" stop-color="#f7d794"/>
            <stop offset="100%" stop-color="#8de0c8"/>
          </linearGradient>
        </defs>
        <rect width="400" height="460" fill="url(#sky3)"/>
        <circle cx="115" cy="120" r="14" fill="#fff3c4" opacity="0.9"/>
        <circle cx="285" cy="95" r="11" fill="#fff3c4" opacity="0.85"/>
        <circle cx="220" cy="145" r="16" fill="#fff7d6" opacity="0.92"/>
        <path d="M45 320 C65 225, 130 225, 145 320 Z" fill="#2f6e62"/>
        <path d="M250 320 C275 195, 345 195, 370 320 Z" fill="#255c52"/>
        <rect y="315" width="400" height="145" fill="#2bb3a0" opacity="0.86"/>
        <path d="M95 340 Q200 368 305 338 L285 358 Q200 380 115 358 Z" fill="#6e473b"/>
      </svg>
    `)}`
  },
  {
    id: 'fallback-card-4',
    caption: '',
    dateLabel: 'Chapter 04',
    palette: {
      primary: '#f7bdd8',
      secondary: '#d5bdf8',
      tertiary: '#bde0fe',
      quaternary: '#f8a5c2',
      accent: '#d95294'
    },
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460">
        <defs>
          <linearGradient id="sky4" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fad0e4"/>
            <stop offset="55%" stop-color="#e3cdfa"/>
            <stop offset="100%" stop-color="#bde0fe"/>
          </linearGradient>
        </defs>
        <rect width="400" height="460" fill="url(#sky4)"/>
        <circle cx="200" cy="215" r="82" fill="#ffffff" opacity="0.72"/>
        <path d="M40 355 L165 205 L235 205 L360 355 Z" fill="#6d78a6" opacity="0.82"/>
        <path d="M138 238 L165 205 L235 205 L262 238 Q200 250 138 238 Z" fill="#ffffff" opacity="0.95"/>
        <circle cx="92" cy="112" r="18" fill="#f78fb3" opacity="0.75"/>
        <circle cx="312" cy="138" r="14" fill="#f78fb3" opacity="0.7"/>
        <circle cx="152" cy="86" r="10" fill="#f8a5c2" opacity="0.8"/>
        <circle cx="268" cy="92" r="12" fill="#f8a5c2" opacity="0.75"/>
        <rect y="355" width="400" height="105" fill="#e899be" opacity="0.45"/>
      </svg>
    `)}`
  }
];

export class PhotoStackController {
  constructor(containerOrConfig, options = {}) {
    let config = options;
    if (
      containerOrConfig &&
      typeof containerOrConfig === 'object' &&
      !(typeof HTMLElement !== 'undefined' && containerOrConfig instanceof HTMLElement) &&
      !('nodeType' in containerOrConfig)
    ) {
      config = containerOrConfig;
    } else {
      config = { ...options, container: containerOrConfig };
    }

    this.container = typeof config.container === 'string' && typeof document !== 'undefined'
      ? document.querySelector(config.container)
      : config.container || null;

    this.ambientContainer = typeof config.ambientContainer === 'string' && typeof document !== 'undefined'
      ? document.querySelector(config.ambientContainer)
      : config.ambientContainer || (typeof document !== 'undefined' ? document.querySelector('.ambient-stage') : null);

    this.autoRotateIntervalMs = config.autoRotateIntervalMs ?? DEFAULT_AUTOROTATE_MS;
    this.isAutoRotating = Boolean(config.autoRotate ?? false);
    this.onPhotoChange = typeof config.onPhotoChange === 'function' ? config.onPhotoChange : null;

    /** @type {import('./config.js').VaultPhoto[]} */
    this.photos = Array.isArray(config.photos) && config.photos.length > 0
      ? [...config.photos]
      : config.deferInitialRender
        ? []
        : [...FALLBACK_PHOTOS];

    this.activeIndex = 0;
    this.autoRotateTimerId = null;
    this.dragState = {
      isDragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      deltaX: 0,
      wasAutoRotating: false
    };

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    if (this.container) {
      if (this.photos.length > 0) {
        this.render();
      }
      this.bindEvents();
    } else if (this.photos.length > 0) {
      this.syncActiveAmbient();
    }

    if (this.isAutoRotating && this.photos.length > 0) {
      this.startAutoRotate();
    }
  }

  clear() {
    this.stopAutoRotate();
    this.photos = [];
    this.activeIndex = 0;
    this.cardElements = [];
    this.dotElements = [];
    if (this.container) {
      this.container.innerHTML = '';
    }
    if (this.ambientContainer) {
      const auraImg = this.ambientContainer.querySelector?.('.ambient-photo-aura');
      if (auraImg) {
        auraImg.hidden = true;
        auraImg.removeAttribute?.('src');
      }
    }
    this.applyAmbientPalette(DEFAULT_LUMINOUS_PALETTE, null);
  }

  setPhotos(photos) {
    this.photos = Array.isArray(photos) && photos.length > 0
      ? [...photos]
      : [...FALLBACK_PHOTOS];
    this.activeIndex = 0;
    if (this.container) {
      this.render();
    } else {
      this.syncActiveAmbient();
    }
  }

  shuffle() {
    if (this.photos.length <= 1) return;
    const shuffled = [...this.photos];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.photos = shuffled;
    this.activeIndex = 0;
    if (this.container) {
      this.render();
    } else {
      this.syncActiveAmbient();
    }
  }

  getActivePhoto() {
    return this.photos[this.activeIndex] || FALLBACK_PHOTOS[0];
  }

  render() {
    if (!this.container || typeof document === 'undefined') return;

    this.container.innerHTML = '';

    const stackEl = document.createElement('div');
    stackEl.className = 'photo-stack';
    stackEl.setAttribute('role', 'region');
    stackEl.setAttribute('aria-label', 'Couple photo deck');
    stackEl.tabIndex = 0;

    this.cardElements = this.photos.map((photo, index) => {
      const card = document.createElement('article');
      card.className = 'photo-card';
      card.dataset.index = String(index);
      card.dataset.depth = this.computeDepthAttr(index);

      const img = document.createElement('img');
      img.className = 'photo-card-img';
      img.src = photo.dataUrl;
      img.alt = photo.caption || `Photo ${index + 1}`;
      img.decoding = 'async';
      img.draggable = false;

      const onImageReady = () => {
        if (index === this.activeIndex) {
          this.syncActiveAmbient(img);
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        onImageReady();
      } else {
        img.addEventListener('load', onImageReady);
      }

      const overlay = document.createElement('div');
      overlay.className = 'photo-card-overlay';

      if (photo.dateLabel) {
        overlay.appendChild(createPhotoDateElement(photo.dateLabel));
      }

      card.appendChild(img);
      card.appendChild(overlay);
      stackEl.appendChild(card);
      return card;
    });

    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'photo-actions-group';

    const shuffleBtn = document.createElement('button');
    shuffleBtn.type = 'button';
    shuffleBtn.className = 'photo-shuffle-btn';
    shuffleBtn.setAttribute('aria-label', 'Shuffle photo order');
    shuffleBtn.title = 'Shuffle photo order';
    shuffleBtn.textContent = '🔀';
    shuffleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      this.shuffle();
    });

    actionsGroup.appendChild(shuffleBtn);
    stackEl.appendChild(actionsGroup);
    this.shuffleBtn = shuffleBtn;

    this.stackElement = stackEl;
    this.container.appendChild(stackEl);

    if (this.photos.length > 1) {
      const controlsRow = document.createElement('div');
      controlsRow.className = 'photo-stack-controls';
      const dotsContainer = document.createElement('div');
      dotsContainer.className = 'photo-dots';
      this.dotElements = this.photos.map((_, idx) => {
        const dot = document.createElement('span');
        dot.className = `photo-dot${idx === this.activeIndex ? ' is-active' : ''}`;
        dotsContainer.appendChild(dot);
        return dot;
      });
      controlsRow.appendChild(dotsContainer);
      this.container.appendChild(controlsRow);
    } else {
      this.dotElements = [];
    }

    this.syncActiveAmbient();
  }

  computeDepthAttr(cardIndex) {
    const total = this.photos.length;
    if (total === 0) return 'hidden';
    const offset = (cardIndex - this.activeIndex + total) % total;
    if (offset === 0) return '0';
    if (offset === 1) return '1';
    if (offset === 2) return '2';
    return 'hidden';
  }

  updateStackDepths() {
    if (this.cardElements) {
      this.cardElements.forEach((card, idx) => {
        card.classList.remove('is-swiping', 'is-throwing-start', 'is-throwing-end');
        card.style.transform = '';
        card.dataset.depth = this.computeDepthAttr(idx);
      });
    }
    if (this.dotElements) {
      this.dotElements.forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === this.activeIndex);
      });
    }
  }

  next(throwDirection = 'start') {
    if (this.photos.length <= 1) return;
    this.transitionToIndex((this.activeIndex + 1) % this.photos.length, throwDirection);
  }

  prev() {
    if (this.photos.length <= 1) return;
    this.transitionToIndex((this.activeIndex - 1 + this.photos.length) % this.photos.length, 'end');
  }

  goTo(index) {
    if (index < 0 || index >= this.photos.length || index === this.activeIndex) return;
    this.transitionToIndex(index, 'start');
  }

  transitionToIndex(nextIndex, throwDirection = 'start') {
    const outgoingCard = this.cardElements?.[this.activeIndex];
    this.activeIndex = nextIndex;

    if (outgoingCard) {
      outgoingCard.classList.remove('is-swiping');
      outgoingCard.style.transform = '';
      outgoingCard.classList.add(throwDirection === 'end' ? 'is-throwing-end' : 'is-throwing-start');
      setTimeout(() => {
        this.updateStackDepths();
      }, 220);

      // Promote upcoming cards immediately so the spring transition feels instantaneous
      this.cardElements.forEach((card, idx) => {
        if (card !== outgoingCard) {
          card.dataset.depth = this.computeDepthAttr(idx);
        }
      });
      if (this.dotElements) {
        this.dotElements.forEach((dot, idx) => {
          dot.classList.toggle('is-active', idx === this.activeIndex);
        });
      }
    } else {
      this.updateStackDepths();
    }

    const activeImg = this.cardElements?.[this.activeIndex]?.querySelector('img') || null;
    this.syncActiveAmbient(activeImg);
  }

  syncActiveAmbient(imgElement = null) {
    const activePhoto = this.getActivePhoto();
    if (!activePhoto) return;

    if (activePhoto._extractedPalette) {
      this.applyAmbientPalette(activePhoto._extractedPalette, activePhoto);
      if (this.onPhotoChange) {
        this.onPhotoChange(activePhoto, this.activeIndex, activePhoto._extractedPalette);
      }
      return;
    }

    const img = imgElement || this.cardElements?.[this.activeIndex]?.querySelector('img') || null;

    if (img && typeof document !== 'undefined') {
      const tryExtract = () => {
        const sampled = extractLuminousPalette(img);
        if (sampled) {
          activePhoto._extractedPalette = sampled;
          if (this.photos[this.activeIndex] === activePhoto) {
            this.applyAmbientPalette(sampled, activePhoto);
            if (this.onPhotoChange) {
              this.onPhotoChange(activePhoto, this.activeIndex, sampled);
            }
          }
          return true;
        }
        return false;
      };

      if (img.complete && img.naturalWidth > 0) {
        if (tryExtract()) return;
      } else {
        const onLoaded = () => {
          tryExtract();
        };
        if (typeof img.decode === 'function') {
          img.decode().then(onLoaded).catch(() => {
            img.addEventListener('load', onLoaded, { once: true });
          });
        } else {
          img.addEventListener('load', onLoaded, { once: true });
        }
      }
    }

    const isSvg = !activePhoto.dataUrl || activePhoto.dataUrl.includes('data:image/svg+xml');
    const fallbackPalette = isSvg && activePhoto.palette
      ? extractLuminousPalette(activePhoto)
      : extractLuminousPalette(null);

    this.applyAmbientPalette(fallbackPalette, activePhoto);

    if (this.onPhotoChange) {
      this.onPhotoChange(activePhoto, this.activeIndex, fallbackPalette);
    }
  }

  applyAmbientPalette(palette, photo = this.getActivePhoto()) {
    if (typeof document === 'undefined') return;

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--ambient-primary', palette.primary || DEFAULT_LUMINOUS_PALETTE.primary);
    rootStyle.setProperty('--ambient-secondary', palette.secondary || DEFAULT_LUMINOUS_PALETTE.secondary);
    rootStyle.setProperty('--ambient-tertiary', palette.tertiary || palette.primary || DEFAULT_LUMINOUS_PALETTE.tertiary);
    rootStyle.setProperty('--ambient-quaternary', palette.quaternary || palette.secondary || DEFAULT_LUMINOUS_PALETTE.quaternary);
    rootStyle.setProperty('--ambient-accent', palette.accent || DEFAULT_LUMINOUS_PALETTE.accent);

    if (this.ambientContainer && photo?.dataUrl) {
      let auraImg = this.ambientContainer.querySelector?.('.ambient-photo-aura') || null;
      if (!auraImg && typeof document.createElement === 'function' && typeof this.ambientContainer.appendChild === 'function') {
        auraImg = document.createElement('img');
        auraImg.className = 'ambient-photo-aura';
        auraImg.alt = '';
        auraImg.setAttribute('aria-hidden', 'true');
        this.ambientContainer.appendChild(auraImg);
      }
      if (auraImg) {
        if (auraImg.getAttribute?.('src') !== photo.dataUrl) {
          auraImg.setAttribute?.('src', photo.dataUrl);
        }
        auraImg.hidden = false;
        auraImg.removeAttribute?.('hidden');
      }
    }
  }

  toggleAutoRotate(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isAutoRotating;
    if (nextState) {
      this.startAutoRotate();
    } else {
      this.stopAutoRotate();
    }
    return this.isAutoRotating;
  }

  startAutoRotate() {
    this.stopAutoRotate();
    this.isAutoRotating = true;
    this.updateAutoRotateButton();
    this.autoRotateTimerId = setInterval(() => {
      if (!this.dragState.isDragging) {
        this.next('start');
      }
    }, this.autoRotateIntervalMs);
  }

  stopAutoRotate() {
    if (this.autoRotateTimerId !== null) {
      clearInterval(this.autoRotateTimerId);
      this.autoRotateTimerId = null;
    }
    this.isAutoRotating = false;
    this.updateAutoRotateButton();
  }

  updateAutoRotateButton() {
    if (!this.autoRotateBtn) return;
    this.autoRotateBtn.classList.toggle('is-active', this.isAutoRotating);
    this.autoRotateBtn.setAttribute('aria-pressed', String(this.isAutoRotating));
    this.autoRotateBtn.textContent = this.isAutoRotating ? '⏸' : '↻';
  }

  bindEvents() {
    if (!this.container) return;
    this.container.addEventListener('pointerdown', this.boundPointerDown);
    this.container.addEventListener('pointermove', this.boundPointerMove);
    this.container.addEventListener('pointerup', this.boundPointerUp);
    this.container.addEventListener('pointercancel', this.boundPointerUp);
    this.container.addEventListener('keydown', this.boundKeyDown);
  }

  handlePointerDown(event) {
    if (
      event.target?.closest('.photo-shuffle-btn') ||
      event.target?.closest('.photo-actions-group') ||
      event.target?.closest('.photo-autorotate-btn')
    ) {
      return;
    }
    if (event.button !== undefined && event.button !== 0) return;

    this.dragState.isDragging = true;
    this.dragState.pointerId = event.pointerId;
    this.dragState.startX = event.clientX;
    this.dragState.startY = event.clientY;
    this.dragState.deltaX = 0;

    const topCard = this.cardElements?.[this.activeIndex];
    if (topCard) {
      topCard.classList.add('is-swiping');
      topCard.setPointerCapture?.(event.pointerId);
    }
  }

  handlePointerMove(event) {
    if (!this.dragState.isDragging || event.pointerId !== this.dragState.pointerId) return;

    const dx = event.clientX - this.dragState.startX;
    this.dragState.deltaX = dx;

    const topCard = this.cardElements?.[this.activeIndex];
    if (topCard) {
      const rotateDeg = clamp(dx * 0.06, -16, 16);
      topCard.style.transform = `translate3d(${dx}px, ${Math.abs(dx) * 0.08}px, 0) rotate(${rotateDeg}deg)`;
    }
  }

  handlePointerUp(event) {
    if (!this.dragState.isDragging || event.pointerId !== this.dragState.pointerId) return;

    const dx = this.dragState.deltaX;
    this.dragState.isDragging = false;
    this.dragState.pointerId = null;
    this.dragState.deltaX = 0;

    const topCard = this.cardElements?.[this.activeIndex];
    if (topCard) {
      topCard.classList.remove('is-swiping');
      topCard.releasePointerCapture?.(event.pointerId);
    }

    if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      if (dx > 0) {
        this.next('end');
      } else {
        this.next('start');
      }
    } else if (Math.abs(dx) < TAP_SLOP_PX) {
      if (topCard) {
        topCard.style.transform = '';
      }
      this.next('start');
    } else if (topCard) {
      topCard.style.transform = '';
    }
  }

  handleKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next('end');
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === ' ') {
      event.preventDefault();
      this.toggleAutoRotate();
    }
  }

  destroy() {
    this.stopAutoRotate();
    if (this.container) {
      this.container.removeEventListener('pointerdown', this.boundPointerDown);
      this.container.removeEventListener('pointermove', this.boundPointerMove);
      this.container.removeEventListener('pointerup', this.boundPointerUp);
      this.container.removeEventListener('pointercancel', this.boundPointerUp);
      this.container.removeEventListener('keydown', this.boundKeyDown);
    }
  }
}

export {
  SAMPLE_CANVAS_SIZE,
  DEFAULT_LUMINOUS_PALETTE,
  PASTEL_BOUNDS,
  clamp,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  parseHexColor,
  clampToPastel,
  clampHslForRole,
  extractPaletteFromPixels,
  extractLuminousPalette
} from './photo-palette.js';

export {
  parseDateParts,
  createPhotoDateElement
} from './photo-badge.js';
```

---

## 5. Verification Method

### 5.1 Verification Strategy Across Agent Roles

1. **Worker (`worker_m3`)**:
   - Write `js/photo-palette.js` and `js/photo-badge.js` first.
   - Refactor `js/photo-stack.js` to match Section 4.2.
   - Run test suite: `node --test tests/*.test.mjs`.
   - Run isolated node test script verifying direct exports and barrel re-exports:
     ```bash
     node -e "
     import * as ps from './js/photo-stack.js';
     import assert from 'node:assert/strict';

     assert.ok(typeof ps.PhotoStackController === 'function');
     assert.equal(ps.FALLBACK_PHOTOS.length, 4);
     assert.ok(typeof ps.rgbToHsl === 'function');
     assert.ok(typeof ps.hslToHex === 'function');
     assert.ok(typeof ps.parseHexColor === 'function');
     assert.ok(typeof ps.clamp === 'function');
     assert.ok(typeof ps.clampHslForRole === 'function');
     assert.ok(typeof ps.extractPaletteFromPixels === 'function');
     assert.ok(typeof ps.extractLuminousPalette === 'function');
     assert.ok(typeof ps.DEFAULT_LUMINOUS_PALETTE === 'object');
     assert.equal(ps.SAMPLE_CANVAS_SIZE, 32);
     assert.ok(typeof ps.parseDateParts === 'function');
     assert.ok(typeof ps.createPhotoDateElement === 'function');
     console.log('PhotoStack barrel re-exports verified 100%!');
     "
     ```
2. **Reviewers (`reviewer_m3_1`, `reviewer_m3_2`)**:
   - `reviewer_m3_1` (Standards): Verify zero npm dependencies, `.js` extension on all relative imports, zero tutorial docstrings, zero generic variable names, and no code placed in `.agents/teamwork/`.
   - `reviewer_m3_2` (Spec): Verify that all 11 required barrel re-exports are present in `js/photo-stack.js`, no existing consumer in `js/app.js` or `js/timeline-renderer.js` is broken, and test 18 (`tests/integration.test.mjs:42`) passes.
3. **Challengers (`challenger_m3_1`, `challenger_m3_2`)**:
   - `challenger_m3_1`: Stress test edge cases: single photo deck (verifies dots are hidden and next/prev early return), empty photo array with `deferInitialRender: true`, `controller.clear()` resetting ambient CSS custom properties to `#f6b8d0` and clearing aura image.
   - `challenger_m3_2`: Verify lifecycle edge cases: `destroy()` removing all 5 event listeners and clearing auto-rotate interval, pointer drag cancellation via `pointercancel`, rapid drag and release gestures.
4. **Auditor (`auditor_m3_1`)**:
   - Execute full test suite: `node --test tests/*.test.mjs`.
   - Run git diff audit against `git status` and verify zero sensitive names/dates were introduced in `js/photo-stack.js`.
   - Verify layout compliance.

### 5.2 Independent Verification Commands
```bash
# 1. Run all 25 unit and integration tests
node --test tests/*.test.mjs

# 2. Verify all barrel re-exports from js/photo-stack.js
node -e "
import {
  FALLBACK_PHOTOS,
  PhotoStackController,
  clampHslForRole,
  createPhotoDateElement,
  extractLuminousPalette,
  rgbToHsl,
  hslToHex,
  parseHexColor,
  clamp,
  extractPaletteFromPixels,
  DEFAULT_LUMINOUS_PALETTE,
  SAMPLE_CANVAS_SIZE,
  parseDateParts
} from './js/photo-stack.js';
import assert from 'node:assert/strict';

assert.equal(FALLBACK_PHOTOS.length, 4);
assert.equal(typeof PhotoStackController, 'function');
assert.equal(typeof clampHslForRole, 'function');
assert.equal(typeof createPhotoDateElement, 'function');
assert.equal(typeof extractLuminousPalette, 'function');
assert.equal(typeof rgbToHsl, 'function');
assert.equal(typeof hslToHex, 'function');
assert.equal(typeof parseHexColor, 'function');
assert.equal(typeof clamp, 'function');
assert.equal(typeof extractPaletteFromPixels, 'function');
assert.equal(typeof DEFAULT_LUMINOUS_PALETTE, 'object');
assert.equal(SAMPLE_CANVAS_SIZE, 32);
assert.equal(typeof parseDateParts, 'function');
console.log('All barrel re-exports verified successfully!');
"
```

### 5.3 Invalidation Conditions
- Any missing named export in `js/photo-stack.js` causing `tests/integration.test.mjs`, `js/app.js`, or `js/timeline-renderer.js` to fail on import.
- Failure of any of the 25 existing tests in `node --test tests/*.test.mjs`.
- Any leak of personal names or dates in `js/photo-stack.js` violating the zero-knowledge security audit.
- Any circular import dependency between `photo-stack.js`, `photo-palette.js`, and `photo-badge.js`.
