# Handoff Report: Color Conversion & Luminous Palette Extraction Decoupling

## 1. Observation

### 1.1 Existing Palette & Color Math in `js/photo-stack.js`
In `js/photo-stack.js` (total 1,215 lines), color conversion, clamping, and palette extraction routines occupy lines 9 and lines 151–490 (~340 lines).

- **Line 9**:
  ```javascript
  const SAMPLE_CANVAS_SIZE = 32;
  ```
- **Lines 158–192 (`rgbToHsl`)**:
  ```javascript
  export function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case rn:
          h = ((gn - bn) / delta) % 6;
          break;
        case gn:
          h = (bn - rn) / delta + 2;
          break;
        default:
          h = (rn - gn) / delta + 4;
          break;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return {
      h,
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }
  ```
- **Lines 201–230 (`hslToHex`)**:
  ```javascript
  export function hslToHex(h, s, l) {
    const hn = ((h % 360) + 360) % 360;
    const sn = Math.max(0, Math.min(100, s)) / 100;
    const ln = Math.max(0, Math.min(100, l)) / 100;

    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
    const m = ln - c / 2;

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;

    if (hn < 60) {
      rPrime = c; gPrime = x; bPrime = 0;
    } else if (hn < 120) {
      rPrime = x; gPrime = c; bPrime = 0;
    } else if (hn < 180) {
      rPrime = 0; gPrime = c; bPrime = x;
    } else if (hn < 240) {
      rPrime = 0; gPrime = x; bPrime = c;
    } else if (hn < 300) {
      rPrime = x; gPrime = 0; bPrime = c;
    } else {
      rPrime = c; gPrime = 0; bPrime = x;
    }

    const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
  }
  ```
- **Lines 237–255 (`parseHexColor`)**: Parses `#rgb` or `#rrggbb` into `{ r, g, b }` or `null`.
- **Lines 257–259 (`clamp`)**: `function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }`.
- **Lines 261–267 (`DEFAULT_LUMINOUS_PALETTE`)**:
  ```javascript
  const DEFAULT_LUMINOUS_PALETTE = {
    primary: '#f6b8d0',
    secondary: '#b8d8f8',
    tertiary: '#fbd3a7',
    quaternary: '#d5bdf8',
    accent: '#e86f9a'
  };
  ```
- **Lines 277–283 (`clampHslForRole`)**:
  ```javascript
  export function clampHslForRole(hsl, role = 'primary') {
    const s = clamp(hsl.s, 66, 89);
    const l = role === 'accent'
      ? clamp(hsl.l, 49, 57)
      : clamp(hsl.l, 69, 83);
    return hslToHex(hsl.h, s, l);
  }
  ```
- **Lines 285–331**: Private helpers:
  - `circularHueBucketDistance(bucketIdxA, bucketIdxB)`
  - `bucketToAverageHsl(bucket)`
  - `expandHslListToFourRoles(seedHsls)`
  - `buildClampedPalette(seedHsls, accentHsl = null)`
- **Lines 338–399 (`extractPaletteFromPixels`)**:
  Quantizes RGBA pixels into 12 hue buckets weighted by mid-tone vibrancy `(s / 100) * (1 - Math.abs(l - 55) / 65) + 0.1`, selecting the top 4 distinct clusters (hue distance $\ge 2$ buckets / $60^\circ$).
- **Lines 410–490 (`extractLuminousPalette`)**:
  Extracts 5-color palette (`primary`, `secondary`, `tertiary`, `quaternary`, `accent`) from:
  1. ImageData / `{ data: Uint8ClampedArray }`
  2. `HTMLImageElement` / `HTMLCanvasElement` via offscreen canvas
  3. `VaultPhoto` object with cached `_extractedPalette`, SVG stops, or pre-extracted `palette`
  4. String (data URL with hex stops, or hex color list)
  5. Fallback `{ ...DEFAULT_LUMINOUS_PALETTE }` (or `null` if image decode is incomplete).

### 1.2 References within `js/photo-stack.js`
Inside `PhotoStackController`:
- **Line 743 (`clear()`)**: `this.applyAmbientPalette(DEFAULT_LUMINOUS_PALETTE, null);`
- **Lines 997, 1029, 1030 (`syncActiveAmbient()`)**:
  - `const sampled = extractLuminousPalette(img);`
  - `? extractLuminousPalette(activePhoto)`
  - `: extractLuminousPalette(null);`
- **Lines 1049–1053 (`applyAmbientPalette(palette, photo)`)**:
  - `rootStyle.setProperty('--ambient-primary', palette.primary || DEFAULT_LUMINOUS_PALETTE.primary);`
  - `rootStyle.setProperty('--ambient-secondary', palette.secondary || DEFAULT_LUMINOUS_PALETTE.secondary);`
  - `rootStyle.setProperty('--ambient-tertiary', palette.tertiary || palette.primary || DEFAULT_LUMINOUS_PALETTE.tertiary);`
  - `rootStyle.setProperty('--ambient-quaternary', palette.quaternary || palette.secondary || DEFAULT_LUMINOUS_PALETTE.quaternary);`
  - `rootStyle.setProperty('--ambient-accent', palette.accent || DEFAULT_LUMINOUS_PALETTE.accent);`
- **Line 1156 (`handlePointerMove()`)**: `const rotateDeg = clamp(dx * 0.06, -16, 16);`

### 1.3 Consumers & Test Invariants
- `tests/integration.test.mjs`:
  - **Line 10**:
    ```javascript
    import { FALLBACK_PHOTOS, PhotoStackController, clampHslForRole, createPhotoDateElement, extractLuminousPalette, rgbToHsl } from '../js/photo-stack.js';
    ```
  - **Lines 42–92**: Test `'Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping'`:
    - Calls `rgbToHsl(20, 10, 40)`.
    - Calls `clampHslForRole(darkHsl, 'primary')`.
    - Asserts `clampedHsl.l >= 68 && clampedHsl.l <= 84` and `clampedHsl.s >= 64 && clampedHsl.s <= 91`.
    - Calls `extractLuminousPalette({ data: new Uint8ClampedArray(pixels) })` with a synthetic 4-color buffer.
    - Asserts all 4 role colors have `l >= 68 && l <= 84`, `s >= 64 && s <= 91`, and $\Delta \text{hue} \ge 30^\circ$.
  - **Lines 93–138**: Asserts `PhotoStackController` applies tokens and resets to `DEFAULT_LUMINOUS_PALETTE` on `controller.clear()`.
- `js/app.js` and `js/timeline-renderer.js`:
  - Import `createPhotoDateElement` and `PhotoStackController` from `./photo-stack.js`.

---

## 2. Logic Chain

1. **Separation of Architectural Responsibilities**:
   - `PhotoStackController` is a stateful UI controller managing DOM card nodes, pointer drag gestures, keyboard events, and CSS token application.
   - Color math (`rgbToHsl`, `hslToHex`, `parseHexColor`, `clamp`, `clampHslForRole`, `extractPaletteFromPixels`, `extractLuminousPalette`) is pure algorithmic calculation operating on raw channel values, pixel arrays, and canvas buffers.
   - Extracting these 340 lines into `js/photo-palette.js` eliminates coupling between color science and DOM gesture orchestration.

2. **Luminous Pastel Clamping Specification (`DESIGN.md` & `AGENTS.md`)**:
   - `DESIGN.md` Section 1 specifies: `Extracted photo colors are clamped to a luminous pastel range (HSL lightness 68%–84%, saturation 65%–90%) so the ambient wash feels vibrant and sunlit without overpowering dark-ink typography (#14151a).`
   - `AGENTS.md` Invariant 4 specifies: `clamped to luminous pastel/daylight lightness (L: 68%–85% in HSL) to preserve the lighter Apple Music matte-glass aesthetic in DESIGN.md.`
   - In `photo-palette.js`, explicit `PASTEL_BOUNDS` are introduced:
     - Ambient roles (`primary`, `secondary`, `tertiary`, `quaternary`): Lightness `[69, 83]` (safe inside `68%–84%`), Saturation `[66, 89]` (safe inside `65%–90%`).
     - Interactive role (`accent`): Lightness `[49, 57]` (safe inside `48%–58%`), Saturation `[66, 89]`.
   - `clampHslForRole(hsl, role)` enforces these bounds and formats the result as a 6-digit hex string via `hslToHex`.

3. **Node.js Environment Determinism (`node --test`)**:
   - In Node test environments, `document`, `HTMLImageElement`, and `HTMLCanvasElement` do not exist.
   - `extractLuminousPalette` guards canvas/DOM access via `typeof document !== 'undefined'` and `typeof HTMLImageElement !== 'undefined'`.
   - For pixel buffers (`{ data: Uint8ClampedArray }`), SVG strings, or `VaultPhoto` objects, `extractLuminousPalette` executes purely in JavaScript with zero DOM dependencies.

4. **Zero-Bundler Native ESM & Zero NPM**:
   - `js/photo-palette.js` has zero external imports and zero npm packages.
   - It is a pure ES2022 module.

5. **100% Backward Compatibility via Barrel Re-Exports**:
   - `js/photo-stack.js` imports `{ clamp, DEFAULT_LUMINOUS_PALETTE, extractLuminousPalette }` from `./photo-palette.js` for internal use.
   - `js/photo-stack.js` re-exports all extracted functions and constants:
     ```javascript
     export {
       SAMPLE_CANVAS_SIZE,
       DEFAULT_LUMINOUS_PALETTE,
       PASTEL_BOUNDS,
       clamp,
       rgbToHsl,
       hslToHex,
       parseHexColor,
       clampHslForRole,
       extractPaletteFromPixels,
       extractLuminousPalette
     } from './photo-palette.js';
     ```
   - This ensures `tests/integration.test.mjs` and all existing code continue to pass with zero changes.

---

## 3. Caveats

1. **Date Badge Separation**:
   - `createPhotoDateElement` and `parseDateParts` in `js/photo-stack.js` (lines 492–642) are DOM badge components and belong in `js/photo-badge.js`, not `js/photo-palette.js`.
   - `js/photo-stack.js` will re-export both `js/photo-palette.js` and `js/photo-badge.js`.
2. **Offscreen Canvas CORS Handling**:
   - When sampling external cross-origin images without CORS headers, `ctx.getImageData` throws a `SecurityError`. The implementation catches this error and gracefully falls back to SVG stops or `DEFAULT_LUMINOUS_PALETTE`.
3. **Incomplete Image Decode**:
   - If an `HTMLImageElement` is provided but `!image.complete || image.naturalWidth === 0`, `extractLuminousPalette` returns `null` so callers can wait for the `load` event before caching the palette.

---

## 4. Conclusion

### 4.1 Specification for New Module: `js/photo-palette.js`

```javascript
/**
 * Color Conversions, Luminous Pastel Clamping, and Canvas Palette Extractor.
 * Implements the Apple Music lighter matte-glass ambient color dispersion specification in DESIGN.md.
 */

export const SAMPLE_CANVAS_SIZE = 32;

/**
 * Default daylight luminous pastel palette applied before photos are loaded or on reset.
 */
export const DEFAULT_LUMINOUS_PALETTE = Object.freeze({
  primary: '#f6b8d0',
  secondary: '#b8d8f8',
  tertiary: '#fbd3a7',
  quaternary: '#d5bdf8',
  accent: '#e86f9a'
});

/**
 * Luminous pastel clamping bounds enforcing DESIGN.md and AGENTS.md rules.
 * Ambient roles: L: 68%–84% (set to 69–83), S: 65%–90% (set to 66–89).
 * Accent role: L: 48%–58% (set to 49–57), S: 65%–90% (set to 66–89).
 */
export const PASTEL_BOUNDS = Object.freeze({
  ambientLightnessMin: 69,
  ambientLightnessMax: 83,
  ambientSaturationMin: 66,
  ambientSaturationMax: 89,
  accentLightnessMin: 49,
  accentLightnessMax: 57,
  accentSaturationMin: 66,
  accentSaturationMax: 89
});

/**
 * Clamps a numeric value between minimum and maximum bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts RGB [0..255] to HSL [h: 0..360, s: 0..100, l: 0..100].
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {{ h: number, s: number, l: number }}
 */
export function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / delta) % 6;
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Converts HSL [h: 0..360, s: 0..100, l: 0..100] to a 6-digit hex color string (#rrggbb).
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
export function hslToHex(h, s, l) {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hn < 60) {
    rPrime = c; gPrime = x; bPrime = 0;
  } else if (hn < 120) {
    rPrime = x; gPrime = c; bPrime = 0;
  } else if (hn < 180) {
    rPrime = 0; gPrime = c; bPrime = x;
  } else if (hn < 240) {
    rPrime = 0; gPrime = x; bPrime = c;
  } else if (hn < 300) {
    rPrime = x; gPrime = 0; bPrime = c;
  } else {
    rPrime = c; gPrime = 0; bPrime = x;
  }

  const toHex = (val) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

/**
 * Parses a hex string (#rgb or #rrggbb) into RGB [0..255].
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const hexDigits = hex.trim().replace(/^#/, '');
  if (hexDigits.length === 3) {
    return {
      r: parseInt(hexDigits[0] + hexDigits[0], 16),
      g: parseInt(hexDigits[1] + hexDigits[1], 16),
      b: parseInt(hexDigits[2] + hexDigits[2], 16)
    };
  }
  if (hexDigits.length === 6) {
    return {
      r: parseInt(hexDigits.slice(0, 2), 16),
      g: parseInt(hexDigits.slice(2, 4), 16),
      b: parseInt(hexDigits.slice(4, 6), 16)
    };
  }
  return null;
}

/**
 * Clamps an HSL color to the DESIGN.md luminous pastel range:
 * - ambient ('primary' | 'secondary' | 'tertiary' | 'quaternary'): Lightness 68%–84%, Saturation 65%–90%
 * - interactive ('accent'): Lightness 48%–58%, Saturation 65%–90%
 * @param {{ h: number, s: number, l: number }} hsl
 * @param {'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'accent'} [role='primary']
 * @returns {string} Clamped 6-digit hex color
 */
export function clampHslForRole(hsl, role = 'primary') {
  const isAccent = role === 'accent';
  const saturation = clamp(hsl.s, PASTEL_BOUNDS.ambientSaturationMin, PASTEL_BOUNDS.ambientSaturationMax);
  const lightness = isAccent
    ? clamp(hsl.l, PASTEL_BOUNDS.accentLightnessMin, PASTEL_BOUNDS.accentLightnessMax)
    : clamp(hsl.l, PASTEL_BOUNDS.ambientLightnessMin, PASTEL_BOUNDS.ambientLightnessMax);
  return hslToHex(hsl.h, saturation, lightness);
}

function circularHueBucketDistance(bucketIdxA, bucketIdxB) {
  const diff = Math.abs(bucketIdxA - bucketIdxB);
  return Math.min(diff, 12 - diff);
}

function bucketToAverageHsl(bucket) {
  return rgbToHsl(
    bucket.rSum / bucket.weightSum,
    bucket.gSum / bucket.weightSum,
    bucket.bSum / bucket.weightSum
  );
}

function expandHslListToFourRoles(seedHsls) {
  const expanded = [...seedHsls];
  const harmonicHueOffsets = [28, -28, 52];
  const lightnessOffsets = [5, -5, 8];

  while (expanded.length < 4) {
    const stepIdx = expanded.length - 1;
    const baseHsl = seedHsls[expanded.length % seedHsls.length];
    expanded.push({
      h: ((baseHsl.h + harmonicHueOffsets[stepIdx % harmonicHueOffsets.length]) % 360 + 360) % 360,
      s: baseHsl.s,
      l: clamp(
        baseHsl.l + lightnessOffsets[stepIdx % lightnessOffsets.length],
        PASTEL_BOUNDS.ambientLightnessMin,
        PASTEL_BOUNDS.ambientLightnessMax
      )
    });
  }

  return expanded;
}

function buildClampedPalette(seedHsls, accentHsl = null) {
  const [primaryHsl, secondaryHsl, tertiaryHsl, quaternaryHsl] = expandHslListToFourRoles(seedHsls);
  const resolvedAccentHsl = accentHsl || {
    h: primaryHsl.h,
    s: Math.max(primaryHsl.s, 75),
    l: 53
  };

  return {
    primary: clampHslForRole(primaryHsl, 'primary'),
    secondary: clampHslForRole(secondaryHsl, 'secondary'),
    tertiary: clampHslForRole(tertiaryHsl, 'tertiary'),
    quaternary: clampHslForRole(quaternaryHsl, 'quaternary'),
    accent: clampHslForRole(resolvedAccentHsl, 'accent')
  };
}

/**
 * Samples RGBA pixel buffer and extracts a 4-color luminous pastel palette plus interactive accent.
 * @param {Uint8ClampedArray | number[]} rgbaData
 * @param {typeof DEFAULT_LUMINOUS_PALETTE} [fallbackPalette=DEFAULT_LUMINOUS_PALETTE]
 * @returns {{ primary: string, secondary: string, tertiary: string, quaternary: string, accent: string }}
 */
export function extractPaletteFromPixels(rgbaData, fallbackPalette = DEFAULT_LUMINOUS_PALETTE) {
  const buckets = Array.from({ length: 12 }, () => ({
    count: 0,
    rSum: 0,
    gSum: 0,
    bSum: 0,
    weightSum: 0
  }));

  for (let i = 0; i <= rgbaData.length - 4; i += 4) {
    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];
    const a = rgbaData[i + 3];
    if (a < 128) continue;

    const { h, s, l } = rgbToHsl(r, g, b);
    const vibrancyWeight = (s / 100) * (1 - Math.abs(l - 55) / 65) + 0.1;
    const bucketIdx = Math.floor(h / 30) % 12;
    const bucket = buckets[bucketIdx];
    bucket.count += 1;
    bucket.rSum += r * vibrancyWeight;
    bucket.gSum += g * vibrancyWeight;
    bucket.bSum += b * vibrancyWeight;
    bucket.weightSum += vibrancyWeight;
  }

  const rankedBuckets = buckets
    .map((bucket, idx) => ({ ...bucket, idx }))
    .filter((bucket) => bucket.weightSum > 0)
    .sort((a, b) => b.weightSum - a.weightSum);

  if (rankedBuckets.length === 0) {
    return { ...fallbackPalette };
  }

  const dominant = rankedBuckets[0];
  const viableBuckets = rankedBuckets.filter((bucket) => bucket.weightSum >= dominant.weightSum * 0.03);
  const selectedBuckets = [dominant];

  for (const candidate of viableBuckets) {
    if (selectedBuckets.length >= 4) break;
    const isDistinctFromSelected = selectedBuckets.every(
      (chosen) => circularHueBucketDistance(candidate.idx, chosen.idx) >= 2
    );
    if (isDistinctFromSelected) {
      selectedBuckets.push(candidate);
    }
  }

  for (const candidate of viableBuckets) {
    if (selectedBuckets.length >= 4) break;
    if (!selectedBuckets.includes(candidate)) {
      selectedBuckets.push(candidate);
    }
  }

  return buildClampedPalette(selectedBuckets.map(bucketToAverageHsl));
}

/**
 * Extracts a luminous Apple Music matte-glass palette from an image element, canvas,
 * ImageData buffer, VaultPhoto object, or SVG/hex string.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | ImageData | { data: Uint8ClampedArray | number[] } | import('./config.js').VaultPhoto | string | null} imageSource
 * @param {typeof DEFAULT_LUMINOUS_PALETTE} [fallbackPalette=DEFAULT_LUMINOUS_PALETTE]
 * @returns {{ primary: string, secondary: string, tertiary: string, quaternary: string, accent: string } | null}
 */
export function extractLuminousPalette(imageSource, fallbackPalette = DEFAULT_LUMINOUS_PALETTE) {
  if (!imageSource) {
    return { ...fallbackPalette };
  }

  // 1. Direct ImageData or pixel buffer object
  if (imageSource.data && (imageSource.data instanceof Uint8ClampedArray || Array.isArray(imageSource.data))) {
    return extractPaletteFromPixels(imageSource.data, fallbackPalette);
  }

  // 2. HTMLImageElement or HTMLCanvasElement in browser DOM
  if (typeof document !== 'undefined' && (
    (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement)
  )) {
    try {
      if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
        if (!imageSource.complete || imageSource.naturalWidth === 0) {
          return null;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = SAMPLE_CANVAS_SIZE;
      canvas.height = SAMPLE_CANVAS_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(imageSource, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);
        const imageData = ctx.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);
        return extractPaletteFromPixels(imageData.data, fallbackPalette);
      }
    } catch {
      // Fallback if cross-origin or canvas extraction fails
    }
  }

  // 3. VaultPhoto object with pre-extracted palette or dataUrl
  if (typeof imageSource === 'object' && imageSource !== null) {
    if (imageSource._extractedPalette) {
      return imageSource._extractedPalette;
    }
    const isSvg = !imageSource.dataUrl || imageSource.dataUrl.includes('data:image/svg+xml');
    if (isSvg && imageSource.palette && imageSource.palette.primary) {
      const roleHexes = [
        imageSource.palette.primary,
        imageSource.palette.secondary,
        imageSource.palette.tertiary,
        imageSource.palette.quaternary
      ].filter(Boolean);
      const parsedHsls = roleHexes
        .map(parseHexColor)
        .filter(Boolean)
        .map((rgb) => rgbToHsl(rgb.r, rgb.g, rgb.b));
      const aRgb = parseHexColor(imageSource.palette.accent || imageSource.palette.primary);

      if (parsedHsls.length > 0 && aRgb) {
        return buildClampedPalette(parsedHsls, rgbToHsl(aRgb.r, aRgb.g, aRgb.b));
      }
    }
    if (typeof imageSource.dataUrl === 'string' && isSvg) {
      return extractLuminousPalette(imageSource.dataUrl, fallbackPalette);
    }
  }

  // 4. String source (hex color or SVG data URL containing hex stops)
  if (typeof imageSource === 'string') {
    const decoded = imageSource.includes('%23') ? decodeURIComponent(imageSource) : imageSource;
    const hexMatches = decoded.match(/#[0-9a-fA-F]{6}\b/g);
    if (hexMatches && hexMatches.length > 0) {
      const uniqueHexes = [...new Set(hexMatches.map((h) => h.toLowerCase()))].slice(0, 4);
      const parsedHsls = uniqueHexes
        .map(parseHexColor)
        .filter(Boolean)
        .map((rgb) => rgbToHsl(rgb.r, rgb.g, rgb.b));
      if (parsedHsls.length > 0) {
        return buildClampedPalette(parsedHsls);
      }
    }
  }

  return { ...fallbackPalette };
}
```

### 4.2 Modifications Required for `js/photo-stack.js`

1. **Imports at the top of `js/photo-stack.js`**:
   ```javascript
   import {
     clamp,
     DEFAULT_LUMINOUS_PALETTE,
     extractLuminousPalette
   } from './photo-palette.js';
   import {
     createPhotoDateElement
   } from './photo-badge.js';
   ```

2. **Removal of redundant declarations in `js/photo-stack.js`**:
   - Remove `const SAMPLE_CANVAS_SIZE = 32;` (line 9).
   - Remove lines 151–490 (all color conversion, clamping, and palette extraction routines).
   - Remove lines 492–642 (moved to `js/photo-badge.js`).

3. **Re-export barrel block at the bottom of `js/photo-stack.js`**:
   ```javascript
   export {
     SAMPLE_CANVAS_SIZE,
     DEFAULT_LUMINOUS_PALETTE,
     PASTEL_BOUNDS,
     clamp,
     rgbToHsl,
     hslToHex,
     parseHexColor,
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

### 5.1 Automated Test Execution
Run the complete project test suite using Node.js:
```bash
node --test tests/*.test.mjs
```
The implementer must verify:
- Test `'Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping'` passes.
- Test `'Integration: createPhotoDateElement splits DD-MM-YYYY into day, month, and year calendar pages'` passes.
- All 25 existing unit tests pass with zero regressions.

### 5.2 Direct Import Verification
Once implemented, execute the following command to test direct imports from `js/photo-palette.js`:
```bash
node -e "
import { rgbToHsl, hslToHex, parseHexColor, clamp, clampHslForRole, extractPaletteFromPixels, extractLuminousPalette, DEFAULT_LUMINOUS_PALETTE, SAMPLE_CANVAS_SIZE, PASTEL_BOUNDS } from './js/photo-palette.js';
import assert from 'node:assert/strict';

assert.equal(SAMPLE_CANVAS_SIZE, 32);
assert.equal(clamp(150, 0, 100), 100);
assert.equal(clamp(-10, 0, 100), 0);

const hsl = rgbToHsl(20, 10, 40);
assert.equal(hsl.h, 260);

const hex = hslToHex(hsl.h, hsl.s, hsl.l);
assert.match(hex, /^#[0-9a-f]{6}$/i);

const parsed = parseHexColor('#201040');
assert.deepEqual(parsed, { r: 32, g: 16, b: 64 });

const clampedHex = clampHslForRole(hsl, 'primary');
assert.match(clampedHex, /^#[0-9a-f]{6}$/i);

const defaultPal = extractLuminousPalette(null);
assert.deepEqual(defaultPal, DEFAULT_LUMINOUS_PALETTE);
console.log('Direct photo-palette.js verification passed!');
"
```

### 5.3 Invalidation Conditions
- Any changes to `clampHslForRole` or `extractLuminousPalette` output that produce lightness values outside $68\% \le L \le 84\%$ or saturation values outside $64\% \le S \le 91\%$.
- Any addition of npm dependencies, bundler configurations, or Node-only built-in modules (`fs`, `path`) to `js/photo-palette.js`.
- Failure to re-export `rgbToHsl`, `clampHslForRole`, `extractLuminousPalette`, or `DEFAULT_LUMINOUS_PALETTE` from `js/photo-stack.js`.
