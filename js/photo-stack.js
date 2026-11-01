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
    id: 'fallback-tlv-origin',
    caption: '',
    dateLabel: '10-01-2026',
    palette: {
      primary: '#f6b8d0',
      secondary: '#fbd3a7',
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
    id: 'fallback-patagonia-peaks',
    caption: '',
    dateLabel: '06-12-2026',
    palette: {
      primary: '#b3dcf7',
      secondary: '#c8c4f7',
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
    id: 'fallback-thailand-reunion',
    caption: '',
    dateLabel: '31-12-2026',
    palette: {
      primary: '#f8c5a8',
      secondary: '#a8ebd8',
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
    id: 'fallback-asia-trio-sakura',
    caption: '',
    dateLabel: '10-03-2027',
    palette: {
      primary: '#f7bdd8',
      secondary: '#d5bdf8',
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

/**
 * Clamps an HSL color to the DESIGN.md luminous pastel range:
 * - ambient ('primary' | 'secondary'): Lightness 68%–84%, Saturation 65%–90%
 * - interactive ('accent'): Lightness 48%–58%, Saturation 65%–90%
 * @param {{ h: number, s: number, l: number }} hsl
 * @param {'primary' | 'secondary' | 'accent'} role
 * @returns {string} Clamped hex color
 */
export function clampHslForRole(hsl, role = 'primary') {
  const s = clamp(hsl.s, 66, 89);
  const l = role === 'accent'
    ? clamp(hsl.l, 49, 57)
    : clamp(hsl.l, 69, 83);
  return hslToHex(hsl.h, s, l);
}

/**
 * Samples RGBA pixel buffer and extracts luminous pastel primary, secondary, and accent colors.
 * @param {Uint8ClampedArray | number[]} rgbaData
 * @returns {{ primary: string, secondary: string, accent: string }}
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
    return {
      primary: '#f6b8d0',
      secondary: '#b8d8f8',
      accent: '#e86f9a'
    };
  }

  const dominant = rankedBuckets[0];
  const primaryHsl = rgbToHsl(
    dominant.rSum / dominant.weightSum,
    dominant.gSum / dominant.weightSum,
    dominant.bSum / dominant.weightSum
  );

  // Pick a secondary bucket with a distinct hue when available
  const distinctSecondary = rankedBuckets.find(
    (candidate) => Math.abs(candidate.idx - dominant.idx) >= 2 && Math.abs(candidate.idx - dominant.idx) <= 10
  ) || rankedBuckets[1];

  const secondaryHsl = distinctSecondary
    ? rgbToHsl(
        distinctSecondary.rSum / distinctSecondary.weightSum,
        distinctSecondary.gSum / distinctSecondary.weightSum,
        distinctSecondary.bSum / distinctSecondary.weightSum
      )
    : { h: (primaryHsl.h + 48) % 360, s: primaryHsl.s, l: primaryHsl.l };

  return {
    primary: clampHslForRole(primaryHsl, 'primary'),
    secondary: clampHslForRole(secondaryHsl, 'secondary'),
    accent: clampHslForRole({ h: primaryHsl.h, s: Math.max(primaryHsl.s, 75), l: 53 }, 'accent')
  };
}

/**
 * Extracts a luminous Apple Music matte-glass palette from an image element, canvas,
 * ImageData buffer, VaultPhoto object, or SVG/hex string.
 * Clamps lightness to 68%–84% and saturation to 65%–90% for primary/secondary,
 * and lightness 48%–58% for accent.
 *
 * @param {HTMLImageElement | HTMLCanvasElement | ImageData | import('./config.js').VaultPhoto | string | null} imageSource
 * @returns {{ primary: string, secondary: string, accent: string }}
 */
export function extractLuminousPalette(imageSource) {
  const defaultPalette = {
    primary: '#f6b8d0',
    secondary: '#b8d8f8',
    accent: '#e86f9a'
  };

  if (!imageSource) {
    return defaultPalette;
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
      const pRgb = parseHexColor(imageSource.palette.primary);
      const sRgb = parseHexColor(imageSource.palette.secondary || imageSource.palette.primary);
      const aRgb = parseHexColor(imageSource.palette.accent || imageSource.palette.primary);
      if (pRgb && sRgb && aRgb) {
        const pHsl = rgbToHsl(pRgb.r, pRgb.g, pRgb.b);
        const sHsl = rgbToHsl(sRgb.r, sRgb.g, sRgb.b);
        const aHsl = rgbToHsl(aRgb.r, aRgb.g, aRgb.b);
        return {
          primary: clampHslForRole(pHsl, 'primary'),
          secondary: clampHslForRole(sHsl, 'secondary'),
          accent: clampHslForRole(aHsl, 'accent')
        };
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
      const firstRgb = parseHexColor(hexMatches[0]);
      const secondRgb = parseHexColor(hexMatches[Math.min(1, hexMatches.length - 1)]);
      if (firstRgb && secondRgb) {
        const pHsl = rgbToHsl(firstRgb.r, firstRgb.g, firstRgb.b);
        const sHsl = hexMatches.length > 1
          ? rgbToHsl(secondRgb.r, secondRgb.g, secondRgb.b)
          : { h: (pHsl.h + 45) % 360, s: pHsl.s, l: pHsl.l };
        return {
          primary: clampHslForRole(pHsl, 'primary'),
          secondary: clampHslForRole(sHsl, 'secondary'),
          accent: clampHslForRole({ h: pHsl.h, s: Math.max(pHsl.s, 75), l: 53 }, 'accent')
        };
      }
    }
  }

  return defaultPalette;
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
   *   autoRotate?: boolean,
   *   autoRotateIntervalMs?: number,
   *   onPhotoChange?: (photo: import('./config.js').VaultPhoto, index: number, palette: { primary: string, secondary: string, accent: string }) => void
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
      this.render();
      this.bindEvents();
    } else {
      this.syncActiveAmbient();
    }

    if (this.isAutoRotating) {
      this.startAutoRotate();
    }
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
        const datePill = document.createElement('div');
        datePill.className = 'photo-date-pill numeric-lock';
        datePill.setAttribute('dir', 'ltr');
        datePill.textContent = photo.dateLabel;
        overlay.appendChild(datePill);
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
   * Applies `--ambient-primary`, `--ambient-secondary`, and `--ambient-accent` to `:root`
   * and updates the ambient stage aura element.
   * @param {{ primary: string, secondary: string, accent: string }} palette
   * @param {import('./config.js').VaultPhoto} [photo]
   */
  applyAmbientPalette(palette, photo = this.getActivePhoto()) {
    if (typeof document === 'undefined') return;

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--ambient-primary', palette.primary);
    rootStyle.setProperty('--ambient-secondary', palette.secondary);
    rootStyle.setProperty('--ambient-accent', palette.accent);

    if (this.ambientContainer && photo?.dataUrl) {
      let auraImg = this.ambientContainer.querySelector('.ambient-photo-aura');
      if (!auraImg) {
        auraImg = document.createElement('img');
        auraImg.className = 'ambient-photo-aura';
        auraImg.alt = '';
        auraImg.setAttribute('aria-hidden', 'true');
        this.ambientContainer.appendChild(auraImg);
      }
      if (auraImg.getAttribute('src') !== photo.dataUrl) {
        auraImg.setAttribute('src', photo.dataUrl);
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
