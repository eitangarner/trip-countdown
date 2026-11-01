/**
 * Swipeable 3D Photo Card Stack Controller & Offscreen Canvas Luminous Palette Extractor.
 * Drives the Apple Music lighter matte-glass ambient background dispersion.
 */

const SWIPE_THRESHOLD_PX = 45;
const TAP_SLOP_PX = 8;
const DEFAULT_AUTOROTATE_MS = 4500;
const SAMPLE_CANVAS_SIZE = 32;

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
 * Converts HSL [h: 0..360, s: 0..100, l: 0..100] to a 6-digit hex color string.
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
function parseHexColor(hex) {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const DEFAULT_LUMINOUS_PALETTE = {
  primary: '#f6b8d0',
  secondary: '#b8d8f8',
  tertiary: '#fbd3a7',
  quaternary: '#d5bdf8',
  accent: '#e86f9a'
};

/**
 * Clamps an HSL color to the DESIGN.md luminous pastel range:
 * - ambient ('primary' | 'secondary' | 'tertiary' | 'quaternary'): Lightness 68%–84%, Saturation 65%–90%
 * - interactive ('accent'): Lightness 48%–58%, Saturation 65%–90%
 * @param {{ h: number, s: number, l: number }} hsl
 * @param {'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'accent'} role
 * @returns {string} Clamped hex color
 */
export function clampHslForRole(hsl, role = 'primary') {
  const s = clamp(hsl.s, 66, 89);
  const l = role === 'accent'
    ? clamp(hsl.l, 49, 57)
    : clamp(hsl.l, 69, 83);
  return hslToHex(hsl.h, s, l);
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
      l: clamp(baseHsl.l + lightnessOffsets[stepIdx % lightnessOffsets.length], 69, 83)
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
 * @returns {{ primary: string, secondary: string, tertiary: string, quaternary: string, accent: string }}
 */
function extractPaletteFromPixels(rgbaData) {
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
    // Favor vibrant mid-tone pixels over near-black or near-white pixels
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
    return { ...DEFAULT_LUMINOUS_PALETTE };
  }

  const dominant = rankedBuckets[0];
  const viableBuckets = rankedBuckets.filter((bucket) => bucket.weightSum >= dominant.weightSum * 0.03);
  const selectedBuckets = [dominant];

  // First pass: prefer buckets with distinct hues (>= 60 deg apart on the 12-hue wheel)
  for (const candidate of viableBuckets) {
    if (selectedBuckets.length >= 4) break;
    const isDistinctFromSelected = selectedBuckets.every(
      (chosen) => circularHueBucketDistance(candidate.idx, chosen.idx) >= 2
    );
    if (isDistinctFromSelected) {
      selectedBuckets.push(candidate);
    }
  }

  // Second pass: include remaining viable buckets if fewer than 4 distinct clusters exist
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
 * Clamps lightness to 68%–84% and saturation to 65%–90% for primary/secondary/tertiary/quaternary,
 * and lightness 48%–58% for accent.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | ImageData | import('./config.js').VaultPhoto | string | null} imageSource
 * @returns {{ primary: string, secondary: string, tertiary: string, quaternary: string, accent: string } | null}
 */
export function extractLuminousPalette(imageSource) {
  if (!imageSource) {
    return { ...DEFAULT_LUMINOUS_PALETTE };
  }

  // 1. Direct ImageData or pixel buffer object ({ data: Uint8ClampedArray })
  if (imageSource.data && (imageSource.data instanceof Uint8ClampedArray || Array.isArray(imageSource.data))) {
    return extractPaletteFromPixels(imageSource.data);
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
        return extractPaletteFromPixels(imageData.data);
      }
    } catch {
      // Fallback if cross-origin or incomplete image decode
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
      return extractLuminousPalette(imageSource.dataUrl);
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

  return { ...DEFAULT_LUMINOUS_PALETTE };
}

function parseDateParts(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (dmyMatch) {
    const rawYear = dmyMatch[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return {
      day: dmyMatch[1].padStart(2, '0'),
      month: dmyMatch[2].padStart(2, '0'),
      year
    };
  }
  if (ymdMatch) {
    return {
      day: ymdMatch[3].padStart(2, '0'),
      month: ymdMatch[2].padStart(2, '0'),
      year: ymdMatch[1]
    };
  }
  return null;
}

/**
 * Creates an elegant calendar-sheet date badge with separate "pages" for day, month, and year.
 * Also supports date ranges (e.g. "31-12-2026 – 10-01-2027").
 * If dateLabel does not match a standard calendar date, returns a fallback single pill.
 * @param {string} dateLabel
 * @param {{ isCompact?: boolean }} [options]
 * @returns {HTMLElement}
 */
export function createPhotoDateElement(dateLabel, { isCompact = false } = {}) {
  const rangeSplit = typeof dateLabel === 'string' ? dateLabel.split(/\s+[–—]\s+/) : null;
  if (rangeSplit && rangeSplit.length === 2) {
    const startParts = parseDateParts(rangeSplit[0]);
    const endParts = parseDateParts(rangeSplit[1]);
    if (startParts && endParts) {
      const pagesContainer = document.createElement('div');
      pagesContainer.className = `${isCompact ? 'photo-date-pages date-pages-compact' : 'photo-date-pages'} numeric-lock`;
      pagesContainer.setAttribute('dir', 'ltr');
      pagesContainer.setAttribute('aria-label', `Date: ${startParts.day}-${startParts.month}-${startParts.year} – ${endParts.day}-${endParts.month}-${endParts.year}`);

      const startUnits = [
        { val: startParts.day, cls: 'date-page-day' },
        { val: startParts.month, cls: 'date-page-month' },
        { val: startParts.year, cls: 'date-page-year date-page-no-slash' }
      ];

      for (const unit of startUnits) {
        const page = document.createElement('div');
        page.className = `date-page ${unit.cls}`;
        const value = document.createElement('span');
        value.className = 'date-page-value';
        value.textContent = unit.val;
        page.appendChild(value);
        pagesContainer.appendChild(page);
      }

      const sep = document.createElement('span');
      sep.className = 'date-page-range-sep';
      sep.textContent = '–';
      pagesContainer.appendChild(sep);

      const endUnits = [
        { val: endParts.day, cls: 'date-page-day' },
        { val: endParts.month, cls: 'date-page-month' },
        { val: endParts.year, cls: 'date-page-year' }
      ];

      for (const unit of endUnits) {
        const page = document.createElement('div');
        page.className = `date-page ${unit.cls}`;
        const value = document.createElement('span');
        value.className = 'date-page-value';
        value.textContent = unit.val;
        page.appendChild(value);
        pagesContainer.appendChild(page);
      }

      return pagesContainer;
    }
  }

  const singleParts = parseDateParts(dateLabel);
  if (!singleParts) {
    const singlePill = document.createElement('div');
    singlePill.className = `${isCompact ? 'timeline-date-pill' : 'photo-date-pill'} numeric-lock`;
    singlePill.setAttribute('dir', 'ltr');
    singlePill.textContent = dateLabel;
    return singlePill;
  }

  const { day, month, year } = singleParts;
  const pagesContainer = document.createElement('div');
  pagesContainer.className = `${isCompact ? 'photo-date-pages date-pages-compact' : 'photo-date-pages'} numeric-lock`;
  pagesContainer.setAttribute('dir', 'ltr');
  pagesContainer.setAttribute('aria-label', `Date: ${day}-${month}-${year}`);

  const units = [
    { val: day, cls: 'date-page-day' },
    { val: month, cls: 'date-page-month' },
    { val: year, cls: 'date-page-year' }
  ];

  for (const unit of units) {
    const page = document.createElement('div');
    page.className = `date-page ${unit.cls}`;

    const value = document.createElement('span');
    value.className = 'date-page-value';
    value.textContent = unit.val;

    page.appendChild(value);
    pagesContainer.appendChild(page);
  }

  return pagesContainer;
}

/**
 * Interactive 3D Photo Card Stack Controller.
 * Manages touch/pointer drag gestures, tap-to-sift, keyboard navigation,
 * 4500ms auto-rotation, and dynamic `:root` ambient color dispersion.
 */
export class PhotoStackController {
  /**
   * @param {HTMLElement | string | {
   *   container?: HTMLElement | string,
   *   ambientContainer?: HTMLElement | string,
   *   photos?: import('./config.js').VaultPhoto[],
   *   deferInitialRender?: boolean,
   *   autoRotate?: boolean,
   *   autoRotateIntervalMs?: number,
   *   onPhotoChange?: (photo: import('./config.js').VaultPhoto, index: number, palette: { primary: string, secondary: string, tertiary: string, quaternary: string, accent: string }) => void
   * }} containerOrConfig
   * @param {Object} [options]
   */
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

  /**
   * Clears all rendered photo cards and resets ambient CSS variables on vault lock.
   */
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

  /**
   * Replaces the photo deck and re-renders. Falls back to built-in SVG illustrations if empty.
   * @param {import('./config.js').VaultPhoto[]} photos
   */
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

  /**
   * Shuffles the photo deck in place using Fisher-Yates and re-renders the stack.
   */
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

  /**
   * @returns {import('./config.js').VaultPhoto}
   */
  getActivePhoto() {
    return this.photos[this.activeIndex] || FALLBACK_PHOTOS[0];
  }

  /**
   * Renders the 3D card stack, caption overlay, auto-rotate button, and pagination dots.
   */
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

  /**
   * Computes the visual depth attribute ('0', '1', '2', or 'hidden') relative to activeIndex.
   * @param {number} cardIndex
   * @returns {'0' | '1' | '2' | 'hidden'}
   */
  computeDepthAttr(cardIndex) {
    const total = this.photos.length;
    if (total === 0) return 'hidden';
    const offset = (cardIndex - this.activeIndex + total) % total;
    if (offset === 0) return '0';
    if (offset === 1) return '1';
    if (offset === 2) return '2';
    return 'hidden';
  }

  /**
   * Updates card depth attributes and pagination dots without rebuilding DOM nodes.
   */
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

  /**
   * Advances to the next photo in the stack.
   * @param {'start' | 'end'} [throwDirection='start']
   */
  next(throwDirection = 'start') {
    if (this.photos.length <= 1) return;
    this.transitionToIndex((this.activeIndex + 1) % this.photos.length, throwDirection);
  }

  /**
   * Moves to the previous photo in the stack.
   */
  prev() {
    if (this.photos.length <= 1) return;
    this.transitionToIndex((this.activeIndex - 1 + this.photos.length) % this.photos.length, 'end');
  }

  /**
   * Jumps to a specific photo index.
   * @param {number} index
   */
  goTo(index) {
    if (index < 0 || index >= this.photos.length || index === this.activeIndex) return;
    this.transitionToIndex(index, 'start');
  }

  /**
   * Performs the throw animation on the outgoing top card and promotes the next card.
   * @param {number} nextIndex
   * @param {'start' | 'end'} throwDirection
   */
  transitionToIndex(nextIndex, throwDirection = 'start') {
    const outgoingCard = this.cardElements?.[this.activeIndex];
    this.activeIndex = nextIndex;

    if (outgoingCard) {
      outgoingCard.classList.remove('is-swiping');
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

  /**
   * Samples the active photo's luminous palette, updates `:root` CSS variables,
   * and updates the `.ambient-stage` blurred aura image.
   * @param {HTMLImageElement | null} [imgElement]
   */
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

  /**
   * Applies `--ambient-primary`, `--ambient-secondary`, `--ambient-tertiary`, `--ambient-quaternary`,
   * and `--ambient-accent` to `:root` and updates the ambient stage aura element.
   * @param {{ primary: string, secondary: string, tertiary?: string, quaternary?: string, accent: string }} palette
   * @param {import('./config.js').VaultPhoto} [photo]
   */
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

  /**
   * Toggles or sets the 4500ms auto-rotate interval.
   * @param {boolean} [forceState]
   * @returns {boolean} New auto-rotate state
   */
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
