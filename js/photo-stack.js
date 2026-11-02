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

export {
  rgbToHsl,
  hslToHex,
  parseHexColor,
  clamp,
  clampHslForRole,
  extractPaletteFromPixels,
  extractLuminousPalette,
  DEFAULT_LUMINOUS_PALETTE,
  SAMPLE_CANVAS_SIZE,
  PASTEL_BOUNDS
} from './photo-palette.js';

export {
  parseDateParts,
  createPhotoDateElement
} from './photo-badge.js';
