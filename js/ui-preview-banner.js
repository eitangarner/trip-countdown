/**
 * Trip Countdown & Timeline Board
 * PreviewBannerController: Time-Travel Preview Slider & Floating Banner Controller
 * Defensive against missing DOM elements (null-safe / headless compatible)
 */

import { getCountryInfo } from './config.js';
import {
  formatDisplayDate,
  getZonedDateParts,
  MS_PER_DAY
} from './date-utils.js';

export class PreviewBannerController {
  /** @type {import('./config.js').TripConfig | null} */
  #tripConfig = null;

  /** @type {number | null} */
  #previewEpochMs = null;

  /** @type {string} */
  #activePresetId = '';

  /** @type {(() => void)[]} */
  #unbinders = [];

  /**
   * @param {object} [options]
   * @param {(epochMs: number | null) => void} [options.onPreviewChange]
   */
  constructor(options = {}) {
    this.onPreviewChange = options.onPreviewChange || null;
    this.cacheDomElements();
    this.bindEvents();
  }

  cacheDomElements() {
    if (typeof document === 'undefined') {
      this.dom = {
        previewBanner: null,
        previewBannerDate: null,
        previewResetBtn: null,
        timeTravelSlider: null,
        sliderDateReadout: null,
        presetChipsRow: null,
        previewStepPrev: null,
        previewStepNext: null
      };
      return;
    }

    this.dom = {
      previewBanner: document.getElementById('preview-banner'),
      previewBannerDate: document.getElementById('preview-banner-date'),
      previewResetBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-reset-btn')),
      timeTravelSlider: /** @type {HTMLInputElement | null} */ (document.getElementById('time-travel-slider')),
      sliderDateReadout: document.getElementById('slider-date-readout'),
      presetChipsRow: document.getElementById('preset-chips-row'),
      previewStepPrev: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-step-prev')),
      previewStepNext: /** @type {HTMLButtonElement | null} */ (document.getElementById('preview-step-next'))
    };
  }

  bindEvents() {
    if (this.dom.timeTravelSlider) {
      const handleSliderInput = () => {
        const val = Number(this.dom.timeTravelSlider?.value);
        if (!Number.isNaN(val)) {
          this.setPreviewTimestamp(val);
        }
      };
      this.dom.timeTravelSlider.addEventListener('input', handleSliderInput);
      this.#unbinders.push(() => {
        this.dom.timeTravelSlider?.removeEventListener('input', handleSliderInput);
      });
    }

    if (this.dom.previewResetBtn) {
      const handleReset = () => this.reset();
      this.dom.previewResetBtn.addEventListener('click', handleReset);
      this.#unbinders.push(() => {
        this.dom.previewResetBtn?.removeEventListener('click', handleReset);
      });
    }

    if (this.dom.previewStepPrev) {
      const handleStepPrev = () => this.stepDays(-1);
      this.dom.previewStepPrev.addEventListener('click', handleStepPrev);
      this.#unbinders.push(() => {
        this.dom.previewStepPrev?.removeEventListener('click', handleStepPrev);
      });
    }

    if (this.dom.previewStepNext) {
      const handleStepNext = () => this.stepDays(1);
      this.dom.previewStepNext.addEventListener('click', handleStepNext);
      this.#unbinders.push(() => {
        this.dom.previewStepNext?.removeEventListener('click', handleStepNext);
      });
    }
  }

  /**
   * Sets the active trip configuration and renders presets if present.
   * @param {import('./config.js').TripConfig} tripConfig
   */
  setTripConfig(tripConfig) {
    this.#tripConfig = tripConfig;
    this.renderPresets();
  }

  #resolveTimeZone() {
    const homeCode = this.#tripConfig?.homeCountryCode || 'US';
    return getCountryInfo(homeCode)?.timeZone || 'UTC';
  }

  renderPresets() {
    if (!this.dom.presetChipsRow || !this.#tripConfig) return;
    this.dom.presetChipsRow.innerHTML = '';

    const presets = Array.isArray(this.#tripConfig.timeTravelPresets)
      ? this.#tripConfig.timeTravelPresets
      : [];

    const liveChip = document.createElement('button');
    liveChip.type = 'button';
    liveChip.className = `preset-chip${this.#previewEpochMs === null ? ' is-active' : ''}`;
    liveChip.dataset.presetId = 'live';
    liveChip.textContent = '🟢 Live Now';
    const handleLiveClick = () => this.reset();
    liveChip.addEventListener('click', handleLiveClick);
    this.dom.presetChipsRow.appendChild(liveChip);

    for (const preset of presets) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `preset-chip${preset.id === this.#activePresetId ? ' is-active' : ''}`;
      chip.dataset.presetId = preset.id;
      chip.textContent = preset.label;
      const handlePresetClick = () => {
        const epochMs = Date.parse(preset.isoDate);
        if (!Number.isNaN(epochMs)) {
          this.setPreviewTimestamp(epochMs, preset.id);
        }
      };
      chip.addEventListener('click', handlePresetClick);
      this.dom.presetChipsRow.appendChild(chip);
    }
  }

  /**
   * Sets or clears the preview timestamp and updates DOM elements.
   * @param {number | null} epochMs
   * @param {string} [presetId='']
   */
  setPreviewTimestamp(epochMs, presetId = '') {
    this.#previewEpochMs = typeof epochMs === 'number' && Number.isFinite(epochMs)
      ? epochMs
      : null;
    this.#activePresetId = this.#previewEpochMs === null ? '' : presetId;

    if (this.dom.presetChipsRow) {
      const chips = this.dom.presetChipsRow.querySelectorAll('.preset-chip');
      chips.forEach((chipNode) => {
        const chipId = /** @type {HTMLElement} */ (chipNode).dataset.presetId;
        const isActive = this.#previewEpochMs === null ? chipId === 'live' : chipId === this.#activePresetId;
        chipNode.classList.toggle('is-active', isActive);
      });
    }

    if (this.#previewEpochMs === null) {
      if (this.dom.previewBanner) this.dom.previewBanner.hidden = true;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = 'Live Now';
    } else {
      const timeZone = this.#resolveTimeZone();
      const zoned = getZonedDateParts(this.#previewEpochMs, timeZone);
      const formatted = formatDisplayDate(zoned.dateStr);

      if (this.dom.previewBanner) this.dom.previewBanner.hidden = false;
      if (this.dom.previewBannerDate) this.dom.previewBannerDate.textContent = formatted;
      if (this.dom.sliderDateReadout) this.dom.sliderDateReadout.textContent = formatted;
      if (this.dom.timeTravelSlider) this.dom.timeTravelSlider.value = String(this.#previewEpochMs);
    }

    this.onPreviewChange?.(this.#previewEpochMs);
  }

  /**
   * Gets current preview timestamp in ms, or null if live.
   * @returns {number | null}
   */
  getPreviewTimestamp() {
    return this.#previewEpochMs;
  }

  /**
   * Steps the preview timestamp by given calendar days (+/-).
   * @param {number} days
   */
  stepDays(days) {
    const baseMs = this.#previewEpochMs ?? Date.now();
    const nextEpochMs = baseMs + days * MS_PER_DAY;
    this.setPreviewTimestamp(nextEpochMs);
  }

  /**
   * Resets preview to live time.
   */
  reset() {
    this.setPreviewTimestamp(null);
  }

  /**
   * Cleans up event listeners and state.
   */
  destroy() {
    for (const unbind of this.#unbinders) {
      unbind();
    }
    this.#unbinders = [];
    if (this.dom.presetChipsRow) {
      this.dom.presetChipsRow.innerHTML = '';
    }
    this.#tripConfig = null;
    this.#previewEpochMs = null;
    this.#activePresetId = '';
    this.onPreviewChange = null;
  }
}
