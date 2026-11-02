# Handoff Report: Color Conversion & Luminous Palette Extraction Decoupling (Milestone 3)

## 1. Observation

### 1.1 Existing Color Math and Extraction in `js/photo-stack.js`
In `js/photo-stack.js` (lines 9, lines 151–490), the following constants, color conversions, and palette extraction routines are defined:
- **Line 9**: `const SAMPLE_CANVAS_SIZE = 32;`
- **Lines 158–192**:
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
- **Lines 201–230**: `export function hslToHex(h, s, l)` converts HSL to `#rrggbb`.
- **Lines 237–255**: `function parseHexColor(hex)` parses `#rgb` or `#rrggbb` into `{ r, g, b }`.
- **Lines 257–259**: `function clamp(value, min, max)` clamps numeric bounds.
- **Lines 261–267**:
  ```javascript
  const DEFAULT_LUMINOUS_PALETTE = {
    primary: '#f6b8d0',
    secondary: '#b8d8f8',
    tertiary: '#fbd3a7',
    quaternary: '#d5bdf8',
    accent: '#e86f9a'
  };
  ```
- **Lines 277–283**:
  ```javascript
  export function clampHslForRole(hsl, role = 'primary') {
    const s = clamp(hsl.s, 66, 89);
    const l = role === 'accent'
      ? clamp(hsl.l, 49, 57)
      : clamp(hsl.l, 69, 83);
    return hslToHex(hsl.h, s, l);
  }
  ```
- **Lines 285–331**: Helper functions `circularHueBucketDistance(bucketIdxA, bucketIdxB)`, `bucketToAverageHsl(bucket)`, `expandHslListToFourRoles(seedHsls)`, and `buildClampedPalette(seedHsls, accentHsl = null)`.
- **Lines 338–399**: `function extractPaletteFromPixels(rgbaData)` quantizes pixels into 12 hue buckets weighted by vibrancy `(s / 100) * (1 - Math.abs(l - 55) / 65) + 0.1`, selecting the top 4 distinct clusters (hue distance $\ge 2$ buckets, i.e. $\ge 60^\circ$).
- **Lines 410–490**: `export function extractLuminousPalette(imageSource)` extracts luminous palette from ImageData, `HTMLImageElement`, `HTMLCanvasElement`, `VaultPhoto`, or SVG/hex strings, falling back to `{ ...DEFAULT_LUMINOUS_PALETTE }` (or `null` if image decode is incomplete).

### 1.2 Usage in `PhotoStackController`
Inside `PhotoStackController` in `js/photo-stack.js`:
- **Line 743 (`clear()`)**: `this.applyAmbientPalette(DEFAULT_LUMINOUS_PALETTE, null);`
- **Lines 981–1037 (`syncActiveAmbient()`)**: Calls `extractLuminousPalette(img)` if DOM image element is present and complete; caches extracted palette into `activePhoto._extractedPalette`; falls back to `extractLuminousPalette(activePhoto)` for SVG illustrations or `extractLuminousPalette(null)` for defaults; invokes `this.applyAmbientPalette(...)`.
- **Lines 1045–1072 (`applyAmbientPalette(palette, photo)`)**: Applies `--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`, and `--ambient-accent` to `document.documentElement.style` and updates `.ambient-photo-aura` `src`.
- **Line 1156 (`handlePointerMove()`)**: Calls `clamp(dx * 0.06, -16, 16)`.

### 1.3 Test Suite Expectations in `tests/integration.test.mjs`
- **Line 10**:
  ```javascript
  import { FALLBACK_PHOTOS, PhotoStackController, clampHslForRole, createPhotoDateElement, extractLuminousPalette, rgbToHsl } from '../js/photo-stack.js';
  ```
- **Lines 42–92**: Test `'Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping'`:
  1. Calls `rgbToHsl(20, 10, 40)`.
  2. Calls `clampHslForRole(darkHsl, 'primary')`.
  3. Verifies `clampedHsl.l >= 68 && clampedHsl.l <= 84` and `clampedHsl.s >= 64 && clampedHsl.s <= 91`.
  4. Calls `extractLuminousPalette({ data: new Uint8ClampedArray(pixels) })` on a synthetic 4-region 100-pixel buffer (lake blue 40%, sunlit gold 30%, pine green 20%, jacket crimson 10%).
  5. Asserts for each role (`primary`, `secondary`, `tertiary`, `quaternary`) that `roleHsl.l >= 68 && roleHsl.l <= 84` and `roleHsl.s >= 64 && roleHsl.s <= 91`.
  6. Asserts 4 distinct unique hex colors with hue distance $\ge 30^\circ$.
- **Lines 93–138**: Verifies `PhotoStackController` binds all 5 CSS tokens to `document.documentElement.style` and resets to `DEFAULT_LUMINOUS_PALETTE` on `controller.clear()`.

---

## 2. Logic Chain

1. **Decoupling Separation of Concerns**:
   - `PhotoStackController` is a stateful UI controller managing DOM card nodes, pointer drag gestures, keyboard events, and CSS token application.
   - Color math (`rgbToHsl`, `hslToRgb`, `hslToHex`, `parseHexColor`, `clampToPastel`, `clampHslForRole`, `extractPaletteFromPixels`, `extractLuminousPalette`) is pure algorithmic transformation that operates on raw numbers, pixel arrays, and canvas buffers.
   - Moving this 340-line pure algorithmic block into `js/photo-palette.js` eliminates coupling between color science and DOM gesture orchestration.

2. **Invariants & Clamping Specifications**:
   - `DESIGN.md` Section 1 specifies: `Extracted photo colors are clamped to a luminous pastel range (HSL lightness 68%–84%, saturation 65%–90%) so the ambient wash feels vibrant and sunlit without overpowering dark-ink typography (#14151a).`
   - `AGENTS.md` Invariant 4 specifies: `clamped to luminous pastel/daylight lightness (L: 68%–85% in HSL) to preserve the lighter Apple Music matte-glass aesthetic in DESIGN.md.`
   - In `photo-palette.js`, `clampToPastel(h, s, l, minL = 69, maxL = 83, targetS = null)` provides the foundation for pastel clamping:
     - Ambient roles (`primary`, `secondary`, `tertiary`, `quaternary`): Lightness clamped to `[69, 83]` (safe inside `68%–84%`), saturation clamped to `[66, 89]` (safe inside `65%–90%`).
     - Interactive role (`accent`): Lightness clamped to `[49, 57]` (safe inside `48%–58%`), saturation clamped to `[66, 89]`.
   - `clampHslForRole(hsl, role = 'primary')` directly delegates to `clampToPastel` and converts the result to a 6-digit hex string via `hslToHex`.

3. **Color Conversion Duality**:
   - `rgbToHsl(r, g, b)` converts RGB $\to$ HSL.
   - `hslToRgb(h, s, l)` converts HSL $\to$ RGB (`{ r, g, b }` in $[0..255]$).
   - `hslToHex(h, s, l)` leverages `hslToRgb` and formats each channel as a 2-digit zero-padded hex string.
   - This completes the bidirectional color conversion contract while preventing code duplication.

4. **Zero-Dependency Native ES2022 Seam**:
   - `js/photo-palette.js` has **zero external imports** and **zero npm dependencies**.
   - Canvas/ImageData interaction is guarded via `typeof document !== 'undefined'`, ensuring 100% deterministic execution in Node test environments (`node --test`).
   - If `imageSource` is an incomplete `HTMLImageElement` (`!imageSource.complete || imageSource.naturalWidth === 0`), it returns `null` so callers can await image load or decode.

5. **100% Backward-Compatible Barrel Re-Exports**:
   - `js/photo-stack.js` will import what it needs from `./photo-palette.js` (`DEFAULT_LUMINOUS_PALETTE`, `extractLuminousPalette`, `clamp`) and re-export all palette and badge functions:
     ```javascript
     export {
       SAMPLE_CANVAS_SIZE,
       DEFAULT_LUMINOUS_PALETTE,
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
     ```
   - This guarantees that all imports in `tests/integration.test.mjs`, `js/app.js`, and `js/timeline-renderer.js` continue to function without any modifications.

---

## 3. Caveats

1. **Date Badge Coupling**:
   - `createPhotoDateElement` and `parseDateParts` currently reside in `js/photo-stack.js` (lines 492–642).
   - While this investigation focuses on `js/photo-palette.js`, Milestone 3 also decouples `js/photo-badge.js`. `js/photo-stack.js` will re-export `createPhotoDateElement` and `parseDateParts` from `./photo-badge.js`.
2. **`SAMPLE_CANVAS_SIZE` Constant**:
   - Fixed at 32x32 pixels (1,024 pixels total). This sample density provides optimal hue frequency resolution while remaining instantaneous on low-power mobile devices.
3. **Canvas Tainting (CORS)**:
   - When drawing images from external cross-origin sources without CORS headers, `ctx.getImageData` throws a `SecurityError`. The implementation wraps canvas sampling in `try / catch` and falls back gracefully to `fallbackPalette` or SVG stops.

---

## 4. Conclusion & Detailed Module Specification

### 4.1 Target File: `js/photo-palette.js` Specification

```javascript
/**
 * Pure Math Color Conversions, Luminous Pastel Clamping, and Offscreen Canvas Palette Extractor.
 * Implements the Apple Music lighter matte-glass ambient color dispersion specification in DESIGN.md.
 */

export const SAMPLE_CANVAS_SIZE = 32;

export const DEFAULT_LUMINOUS_PALETTE = {
  primary: '#f6b8d0',
  secondary: '#b8d8f8',
  tertiary: '#fbd3a7',
  quaternary: '#d5bdf8',
  accent: '#e86f9a'
};

export const PASTEL_BOUNDS = {
  ambientLightnessMin: 69,
  ambientLightnessMax: 83,
  ambientSaturationMin: 66,
  ambientSaturationMax: 89,
  accentLightnessMin: 49,
  accentLightnessMax: 57,
  accentSaturationMin: 66,
  accentSaturationMax: 89
};

/**
 * Clamps a numeric value between min and max bounds.
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
 * Converts HSL [h: 0..360, s: 0..100, l: 0..100] to RGB [0..255].
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb(h, s, l) {
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

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255)
  };
}

/**
 * Converts HSL [h: 0..360, s: 0..100, l: 0..100] to a 6-digit hex color string.
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {string}
 */
export function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  const toHex = (val) => val.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parses a hex string (#rgb or #rrggbb) into RGB [0..255].
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16)
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16)
    };
  }
  return null;
}

/**
 * Clamps HSL values to a specified pastel range.
 * @param {number} h Hue [0..360]
 * @param {number} s Saturation [0..100]
 * @param {number} l Lightness [0..100]
 * @param {number} [minL=69]
 * @param {number} [maxL=83]
 * @param {number|null} [targetS=null]
 * @returns {{ h: number, s: number, l: number }}
 */
export function clampToPastel(h, s, l, minL = PASTEL_BOUNDS.ambientLightnessMin, maxL = PASTEL_BOUNDS.ambientLightnessMax, targetS = null) {
  const clampedS = targetS !== null
    ? clamp(targetS, PASTEL_BOUNDS.ambientSaturationMin, PASTEL_BOUNDS.ambientSaturationMax)
    : clamp(s, PASTEL_BOUNDS.ambientSaturationMin, PASTEL_BOUNDS.ambientSaturationMax);
  const clampedL = clamp(l, minL, maxL);
  return {
    h: ((h % 360) + 360) % 360,
    s: clampedS,
    l: clampedL
  };
}

/**
 * Clamps an HSL color to the DESIGN.md luminous pastel range:
 * - ambient ('primary' | 'secondary' | 'tertiary' | 'quaternary'): Lightness 68%–84%, Saturation 65%–90%
 * - interactive ('accent'): Lightness 48%–58%, Saturation 65%–90%
 * @param {{ h: number, s: number, l: number }} hsl
 * @param {'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'accent'} role
 * @returns {string} Clamped hex color
 */
export function clampHslForRole(hsl, role = 'primary') {
  const isAccent = role === 'accent';
  const minL = isAccent ? PASTEL_BOUNDS.accentLightnessMin : PASTEL_BOUNDS.ambientLightnessMin;
  const maxL = isAccent ? PASTEL_BOUNDS.accentLightnessMax : PASTEL_BOUNDS.ambientLightnessMax;
  const clamped = clampToPastel(hsl.h, hsl.s, hsl.l, minL, maxL);
  return hslToHex(clamped.h, clamped.s, clamped.l);
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
      l: clamp(baseHsl.l + lightnessOffsets[stepIdx % lightnessOffsets.length], PASTEL_BOUNDS.ambientLightnessMin, PASTEL_BOUNDS.ambientLightnessMax)
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

  if (imageSource.data && (imageSource.data instanceof Uint8ClampedArray || Array.isArray(imageSource.data))) {
    return extractPaletteFromPixels(imageSource.data, fallbackPalette);
  }

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

### 4.2 Re-export Barrel Contract in `js/photo-stack.js`
At the top of `js/photo-stack.js`:
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

At the bottom of `js/photo-stack.js`:
```javascript
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

### 5.1 Automated Test Verification
Run the complete project test suite using the standard Node test runner:
```bash
node --test tests/*.test.mjs
```
The implementer must verify that:
1. `tests/integration.test.mjs` test `'Integration: PhotoStack extracts 4-color luminous pastel palette and enforces L: 68%–84% clamping'` passes without error.
2. `PhotoStackController` binds all 5 CSS custom properties (`--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`, `--ambient-accent`) and resets to `DEFAULT_LUMINOUS_PALETTE` on `clear()`.
3. All 25 existing unit tests pass without any failures.

### 5.2 Direct Import Verification
Once implemented, the following one-line assertion script must execute cleanly:
```bash
node -e "
import { rgbToHsl, hslToRgb, hslToHex, clampToPastel, clampHslForRole, extractLuminousPalette, DEFAULT_LUMINOUS_PALETTE } from './js/photo-palette.js';
import assert from 'node:assert/strict';

const hsl = rgbToHsl(20, 10, 40);
assert.equal(hsl.h, 260);
const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
assert.ok(Math.abs(rgb.r - 20) <= 2);
const clampedHex = clampHslForRole(hsl, 'primary');
assert.match(clampedHex, /^#[0-9a-f]{6}$/i);
const palette = extractLuminousPalette(null);
assert.deepEqual(palette, DEFAULT_LUMINOUS_PALETTE);
console.log('Direct photo-palette.js module verification passed!');
"
```

### 5.3 Invalidation Conditions
- Any changes to `clampHslForRole` output that shift lightness outside $68\% \le L \le 84\%$ or saturation outside $64\% \le S \le 91\%$.
- Any circular import introduced between `photo-stack.js`, `photo-palette.js`, and `photo-badge.js`.
- Any addition of external npm dependencies or Node-only built-in modules (`fs`, `path`, etc.) inside `js/photo-palette.js`.
