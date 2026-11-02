import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_ISO_3166_CODES, getCountryInfo } from '../js/config.js';
import { bindSheetDragGestures } from '../js/ui-gestures.js';
import { PreviewBannerController } from '../js/ui-preview-banner.js';
import { populateCountrySelect, StatusEditSheet } from '../js/ui-status-sheet.js';
import { TimelineEditorSheet } from '../js/ui-editor-sheet.js';
import { DaysBreakdownModal, EventCountdownModal } from '../js/ui-modals.js';

// DOM mock helper
function createMockElement(id = '', tag = 'div') {
  const listeners = new Map();
  const children = [];
  const attributes = new Map();
  const classNames = new Set();
  let rawHtml = '';

  return {
    id,
    tagName: tag.toUpperCase(),
    hidden: false,
    textContent: '',
    value: '',
    disabled: false,
    title: '',
    scrollTop: 0,
    style: { transform: '', transition: '', display: '' },
    dataset: {},
    children,
    get innerHTML() {
      return rawHtml;
    },
    set innerHTML(val) {
      rawHtml = val;
      if (!val) {
        children.length = 0;
      }
    },
    get firstElementChild() { return children[0] || null; },
    get lastElementChild() { return children[children.length - 1] || null; },
    classList: {
      add(...tokens) { tokens.forEach((t) => classNames.add(t)); },
      remove(...tokens) { tokens.forEach((t) => classNames.delete(t)); },
      toggle(token, force) {
        if (typeof force === 'boolean') {
          if (force) classNames.add(token);
          else classNames.delete(token);
          return force;
        }
        if (classNames.has(token)) {
          classNames.delete(token);
          return false;
        }
        classNames.add(token);
        return true;
      },
      contains(token) { return classNames.has(token); }
    },
    setAttribute(name, val) { attributes.set(name, String(val)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    appendChild(child) {
      children.push(child);
      return child;
    },
    append(...newChildren) {
      children.push(...newChildren);
    },
    replaceChildren(...newChildren) {
      children.length = 0;
      children.push(...newChildren);
    },
    querySelectorAll(selector) {
      const results = [];
      const traverse = (node) => {
        for (const child of node.children || []) {
          if (selector.startsWith('.') && child.classList?.contains(selector.slice(1))) {
            results.push(child);
          }
          traverse(child);
        }
      };
      traverse(this);
      return results;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    focus() {},
    scrollIntoView() {},
    addEventListener(type, fn, opts) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      if (opts?.signal) {
        opts.signal.addEventListener('abort', () => {
          listeners.get(type)?.delete(fn);
        });
      }
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type);
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          handler(event);
        }
      }
      return !event.defaultPrevented;
    },
    getListenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
    getTotalListenerCount() {
      let count = 0;
      for (const set of listeners.values()) count += set.size;
      return count;
    }
  };
}

test('UI Sub-Controllers: PreviewBannerController null-safety in raw headless environment', () => {
  const prevDoc = globalThis.document;
  try {
    delete globalThis.document;
    const controller = new PreviewBannerController();
    assert.equal(controller.getPreviewTimestamp(), null);

    controller.setTripConfig({ homeCountryCode: 'IL' });
    controller.setPreviewTimestamp(1761868800000, 'preset-1');
    assert.equal(controller.getPreviewTimestamp(), 1761868800000);

    controller.stepDays(3);
    assert.equal(controller.getPreviewTimestamp(), 1761868800000 + 3 * 86400000);

    controller.stepDays(-1);
    assert.equal(controller.getPreviewTimestamp(), 1761868800000 + 2 * 86400000);

    controller.reset();
    assert.equal(controller.getPreviewTimestamp(), null);

    controller.destroy();
    controller.destroy();
  } finally {
    globalThis.document = prevDoc;
  }
});

test('UI Sub-Controllers: PreviewBannerController null-safety when #preview-banner and #time-travel-slider are absent from DOM', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  const mockElements = {
    'preview-banner': null,
    'preview-banner-date': null,
    'preview-reset-btn': null,
    'time-travel-slider': null,
    'slider-date-readout': null,
    'preset-chips-row': createMockElement('preset-chips-row'),
    'preview-step-prev': null,
    'preview-step-next': null
  };

  globalThis.document = {
    getElementById: (id) => mockElements[id] ?? null,
    createElement: (tag) => createMockElement('created-' + Math.random(), tag)
  };
  globalThis.window = globalThis;

  try {
    let notifiedTs = -1;
    const controller = new PreviewBannerController({
      onPreviewChange: (ts) => { notifiedTs = ts; }
    });

    assert.equal(controller.dom.previewBanner, null);
    assert.equal(controller.dom.timeTravelSlider, null);
    assert.ok(controller.dom.presetChipsRow);

    const tripConfig = {
      homeCountryCode: 'IL',
      timeTravelPresets: [
        { id: 'pre-1', label: 'Preset 1', isoDate: '2026-06-01T12:00:00Z' },
        { id: 'pre-2', label: 'Preset 2', isoDate: '2026-07-01T12:00:00Z' }
      ]
    };

    controller.setTripConfig(tripConfig);
    const chips = controller.dom.presetChipsRow.children;
    assert.equal(chips.length, 3);
    assert.equal(chips[0].dataset.presetId, 'live');
    assert.equal(chips[1].dataset.presetId, 'pre-1');
    assert.equal(chips[2].dataset.presetId, 'pre-2');

    chips[1].dispatchEvent({ type: 'click' });
    assert.equal(controller.getPreviewTimestamp(), Date.parse('2026-06-01T12:00:00Z'));
    assert.equal(notifiedTs, Date.parse('2026-06-01T12:00:00Z'));

    controller.stepDays(2);
    assert.equal(controller.getPreviewTimestamp(), Date.parse('2026-06-01T12:00:00Z') + 2 * 86400000);

    chips[0].dispatchEvent({ type: 'click' });
    assert.equal(controller.getPreviewTimestamp(), null);
    assert.equal(notifiedTs, null);

    controller.destroy();
    assert.equal(controller.dom.presetChipsRow.children.length, 0);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('UI Sub-Controllers: populateCountrySelect catalog integrity and ordering', () => {
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => createMockElement('select-opt-' + Math.random(), tag)
  };

  try {
    assert.doesNotThrow(() => populateCountrySelect(null));

    const selectEl = createMockElement('country-select', 'select');
    const pinned = ['TH', 'VN', 'JP', 'KR'];
    populateCountrySelect(selectEl, 'JP', pinned);

    assert.equal(selectEl.children.length, 2);
    const pinnedGroup = selectEl.children[0];
    const allGroup = selectEl.children[1];

    assert.equal(pinnedGroup.label, '⭐ Pinned Destinations');
    assert.equal(allGroup.label, '🌍 All 249 Countries (A–Z)');

    assert.equal(pinnedGroup.children.length, 4);
    assert.deepEqual(pinnedGroup.children.map((c) => c.value), ['TH', 'VN', 'JP', 'KR']);

    const pinnedSet = new Set(pinnedGroup.children.map((c) => c.value));
    assert.equal(pinnedSet.size, 4);

    assert.equal(allGroup.children.length, 249);
    const allCodes = allGroup.children.map((c) => c.value);
    const allSet = new Set(allCodes);
    assert.equal(allSet.size, 249);

    for (const code of ALL_ISO_3166_CODES) {
      assert.ok(allSet.has(code), `Missing ISO country code: ${code}`);
    }

    const countryNames = allGroup.children.map((c) => getCountryInfo(c.value).name);
    for (let i = 1; i < countryNames.length; i += 1) {
      assert.ok(
        countryNames[i - 1].localeCompare(countryNames[i]) <= 0,
        `Country sort violation at index ${i}: "${countryNames[i - 1]}" vs "${countryNames[i]}"`
      );
    }

    assert.equal(selectEl.value, 'JP');
  } finally {
    globalThis.document = prevDoc;
  }
});

test('UI Sub-Controllers: bindSheetDragGestures lifecycle and unbinding', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const noopUnbind1 = bindSheetDragGestures(null, null, () => {});
    assert.equal(typeof noopUnbind1, 'function');
    assert.doesNotThrow(() => noopUnbind1());

    const sheetEl = createMockElement('sheet');
    const handleEl = createMockElement('handle');
    sheetEl.classList.add('is-open');

    let closeCalled = false;
    const unbind = bindSheetDragGestures(sheetEl, handleEl, () => {
      closeCalled = true;
    }, { dismissThreshold: 50 });

    assert.equal(handleEl.getListenerCount('pointerdown'), 1);
    assert.equal(handleEl.getListenerCount('pointermove'), 1);
    assert.equal(handleEl.getListenerCount('pointerup'), 1);
    assert.equal(handleEl.getListenerCount('pointercancel'), 1);

    assert.equal(sheetEl.getListenerCount('touchstart'), 1);
    assert.equal(sheetEl.getListenerCount('touchmove'), 1);
    assert.equal(sheetEl.getListenerCount('touchend'), 1);
    assert.equal(sheetEl.getListenerCount('touchcancel'), 1);

    handleEl.dispatchEvent({ type: 'pointerdown', clientY: 100, pointerType: 'touch' });
    handleEl.dispatchEvent({ type: 'pointermove', clientY: 200, cancelable: true, preventDefault() {} });
    handleEl.dispatchEvent({ type: 'pointerup', clientY: 200 });
    assert.equal(closeCalled, true);

    unbind();

    assert.equal(handleEl.getTotalListenerCount(), 0);
    assert.equal(sheetEl.getTotalListenerCount(), 0);
    assert.equal(sheetEl.style.transform, '');
    assert.equal(sheetEl.style.transition, '');

    assert.doesNotThrow(() => unbind());
  } finally {
    globalThis.window = prevWin;
  }
});

test('UI Sub-Controllers: StatusEditSheet & TimelineEditorSheet listener cleanup on destroy', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  const mockRegistry = new Map();
  const getMock = (id, tag = 'div') => {
    if (!mockRegistry.has(id)) {
      mockRegistry.set(id, createMockElement(id, tag));
    }
    return mockRegistry.get(id);
  };

  globalThis.document = {
    getElementById: (id) => getMock(id),
    querySelector: () => null,
    createElement: (tag) => createMockElement('created-' + Math.random(), tag),
    activeElement: null
  };
  globalThis.window = globalThis;

  try {
    const statusSheet = new StatusEditSheet();
    statusSheet.mount(
      { homeCountryCode: 'IL', pinnedCountryCodes: ['TH', 'JP'] },
      { firstPartnerKey: 'partnerA', secondPartnerKey: 'partnerB' }
    );

    let statusListenersBefore = 0;
    for (const el of mockRegistry.values()) {
      statusListenersBefore += el.getTotalListenerCount();
    }
    assert.ok(statusListenersBefore > 0);

    statusSheet.destroy();

    let statusListenersAfter = 0;
    for (const el of mockRegistry.values()) {
      statusListenersAfter += el.getTotalListenerCount();
    }
    assert.equal(statusListenersAfter, 0, 'All StatusEditSheet listeners must be removed on destroy');

    mockRegistry.clear();
    const editorSheet = new TimelineEditorSheet();
    editorSheet.mount({ homeCountryCode: 'IL' });

    let editorListenersBefore = 0;
    for (const el of mockRegistry.values()) {
      editorListenersBefore += el.getTotalListenerCount();
    }
    assert.ok(editorListenersBefore > 0);

    editorSheet.destroy();

    let editorListenersAfter = 0;
    for (const el of mockRegistry.values()) {
      editorListenersAfter += el.getTotalListenerCount();
    }
    assert.equal(editorListenersAfter, 0, 'All TimelineEditorSheet listeners must be removed on destroy');
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('UI Sub-Controllers: DaysBreakdownModal & EventCountdownModal in DOM environment and cleanup on destroy', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;

  const mockRegistry = new Map();
  const windowListeners = new Map();

  const getMock = (id, tag = 'div') => {
    if (!mockRegistry.has(id)) {
      mockRegistry.set(id, createMockElement(id, tag));
    }
    return mockRegistry.get(id);
  };

  globalThis.document = {
    getElementById: (id) => getMock(id),
    querySelector: () => null,
    createElement: (tag) => createMockElement('created-' + Math.random(), tag),
    activeElement: null
  };

  globalThis.window = {
    addEventListener(type, fn) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      windowListeners.get(type)?.delete(fn);
    }
  };

  try {
    // 1. DaysBreakdownModal
    const daysModal = new DaysBreakdownModal();
    assert.equal(getMock('days-modal-close-btn').getListenerCount('click'), 1);
    assert.equal(getMock('days-modal-done-btn').getListenerCount('click'), 1);
    assert.equal(getMock('days-modal-backdrop').getListenerCount('click'), 1);

    daysModal.open({
      timeline: { countryDaysBreakdown: [{ flag: '🇯🇵', countryName: 'Japan', days: 14 }], plannedTripDaysTogether: 14 }
    });
    assert.equal(daysModal.isOpen(), true);
    assert.equal(windowListeners.get('keydown')?.size, 1);

    daysModal.destroy();
    assert.equal(getMock('days-modal-close-btn').getListenerCount('click'), 0);
    assert.equal(getMock('days-modal-done-btn').getListenerCount('click'), 0);
    assert.equal(getMock('days-modal-backdrop').getListenerCount('click'), 0);
    assert.equal(windowListeners.get('keydown')?.size || 0, 0);

    // 2. EventCountdownModal
    mockRegistry.clear();
    let editedEntry = null;
    const eventModal = new EventCountdownModal({
      onEdit: (entry) => { editedEntry = entry; }
    });

    assert.equal(getMock('event-modal-close-btn').getListenerCount('click'), 1);
    assert.equal(getMock('event-modal-done-btn').getListenerCount('click'), 1);
    assert.equal(getMock('event-modal-backdrop').getListenerCount('click'), 1);
    assert.equal(getMock('event-modal-edit-btn').getListenerCount('click'), 1);

    const testMilestone = {
      id: 'ms-test',
      title: 'Our Anniversary',
      date: '2026-11-10',
      category: 'anniversary',
      emoji: '💖',
      countryCode: 'IL'
    };

    eventModal.open(testMilestone, { nowMs: Date.now() });
    assert.equal(eventModal.isOpen(), true);
    assert.equal(windowListeners.get('keydown')?.size, 1);

    getMock('event-modal-edit-btn').dispatchEvent({ type: 'click' });
    assert.equal(editedEntry?.id, 'ms-test');
    assert.equal(eventModal.isOpen(), false);

    eventModal.destroy();
    assert.equal(getMock('event-modal-close-btn').getListenerCount('click'), 0);
    assert.equal(getMock('event-modal-done-btn').getListenerCount('click'), 0);
    assert.equal(getMock('event-modal-backdrop').getListenerCount('click'), 0);
    assert.equal(getMock('event-modal-edit-btn').getListenerCount('click'), 0);
    assert.equal(windowListeners.get('keydown')?.size || 0, 0);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});

test('UI Sub-Controllers: EventCountdownModal instantiation succeeds safely if document is undefined', () => {
  const prevDoc = globalThis.document;
  try {
    delete globalThis.document;
    assert.doesNotThrow(() => {
      const modal = new EventCountdownModal();
      assert.equal(modal.isOpen(), false);
    });
  } finally {
    globalThis.document = prevDoc;
  }
});

test('UI Sub-Controllers: DaysBreakdownModal and EventCountdownModal destroy() succeed safely if window is undefined', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  try {
    globalThis.document = {
      getElementById: () => null,
      querySelector: () => null
    };
    delete globalThis.window;

    const daysModal = new DaysBreakdownModal();
    assert.doesNotThrow(() => daysModal.destroy());

    const eventModal = new EventCountdownModal();
    assert.doesNotThrow(() => eventModal.destroy());
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
  }
});
