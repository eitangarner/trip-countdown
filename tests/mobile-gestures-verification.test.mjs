import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { bindTabSwipeGestures } from '../js/ui-gestures.js';

function createMockSwipeTarget(id = 'board-container') {
  const listeners = new Map();
  const classNames = new Set();

  return {
    id,
    tagName: 'DIV',
    classList: {
      contains: (cls) => classNames.has(cls),
      add: (cls) => classNames.add(cls)
    },
    addEventListener(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener(event, handler) {
      const arr = listeners.get(event);
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
    dispatchMockTouch(eventName, touchPayload) {
      const handlers = listeners.get(eventName) || [];
      handlers.forEach((h) => h(touchPayload));
    },
    getListenerCount(eventName) {
      return (listeners.get(eventName) || []).length;
    }
  };
}

test('Mobile Tab Gestures: triggers onSwipeLeft when swiping left horizontally', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();
    let swipedLeftCount = 0;
    let swipedRightCount = 0;

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => { swipedLeftCount++; },
      onSwipeRight: () => { swipedRightCount++; },
      swipeThresholdPx: 40
    });

    // Start touch at x=200, y=300
    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 200, clientY: 300 }],
      target: mockTarget
    });

    // End touch at x=120, y=305 (deltaX = -80, deltaY = 5) -> horizontal swipe left
    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 120, clientY: 305 }]
    });

    assert.equal(swipedLeftCount, 1);
    assert.equal(swipedRightCount, 0);

    unbind();
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Tab Gestures: triggers onSwipeRight when swiping right horizontally', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();
    let swipedLeftCount = 0;
    let swipedRightCount = 0;

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => { swipedLeftCount++; },
      onSwipeRight: () => { swipedRightCount++; },
      swipeThresholdPx: 40
    });

    // Start touch at x=100, y=250
    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 100, clientY: 250 }],
      target: mockTarget
    });

    // End touch at x=180, y=252 (deltaX = +80, deltaY = 2) -> horizontal swipe right
    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 180, clientY: 252 }]
    });

    assert.equal(swipedLeftCount, 0);
    assert.equal(swipedRightCount, 1);

    unbind();
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Tab Gestures: ignores predominantly vertical scrolling gestures', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();
    let swipedCount = 0;

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => { swipedCount++; },
      onSwipeRight: () => { swipedCount++; },
      swipeThresholdPx: 40
    });

    // Start touch
    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 200, clientY: 100 }],
      target: mockTarget
    });

    // End touch: deltaX = 50, but deltaY = 180 (user was scrolling the page vertically)
    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 250, clientY: 280 }]
    });

    assert.equal(swipedCount, 0);

    unbind();
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Tab Gestures: ignores touches originating inside excluded elements (.photo-stack)', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();
    let swipedCount = 0;

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => { swipedCount++; },
      onSwipeRight: () => { swipedCount++; },
      swipeThresholdPx: 40
    });

    const mockPhotoCard = {
      closest(selector) {
        return selector.includes('.photo-stack');
      }
    };

    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 200, clientY: 200 }],
      target: mockPhotoCard
    });

    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 100, clientY: 200 }]
    });

    assert.equal(swipedCount, 0);

    unbind();
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Tab Gestures: respects isSwipeEnabled predicate', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();
    let swipedCount = 0;
    let isModalOpen = true;

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => { swipedCount++; },
      onSwipeRight: () => { swipedCount++; },
      isSwipeEnabled: () => !isModalOpen,
      swipeThresholdPx: 40
    });

    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 200, clientY: 200 }],
      target: mockTarget
    });

    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 100, clientY: 200 }]
    });

    assert.equal(swipedCount, 0, 'Swipe should be suppressed while modal is open');

    isModalOpen = false;
    mockTarget.dispatchMockTouch('touchstart', {
      touches: [{ clientX: 200, clientY: 200 }],
      target: mockTarget
    });

    mockTarget.dispatchMockTouch('touchend', {
      changedTouches: [{ clientX: 100, clientY: 200 }]
    });

    assert.equal(swipedCount, 1, 'Swipe should trigger when modal closes');

    unbind();
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Tab Gestures: unbind cleans up touch listeners without memory leaks', () => {
  const prevWin = globalThis.window;
  globalThis.window = globalThis;

  try {
    const mockTarget = createMockSwipeTarget();

    const unbind = bindTabSwipeGestures({
      containerElement: mockTarget,
      onSwipeLeft: () => {},
      onSwipeRight: () => {}
    });

    assert.equal(mockTarget.getListenerCount('touchstart'), 1);
    assert.equal(mockTarget.getListenerCount('touchend'), 1);
    assert.equal(mockTarget.getListenerCount('touchcancel'), 1);

    unbind();

    assert.equal(mockTarget.getListenerCount('touchstart'), 0);
    assert.equal(mockTarget.getListenerCount('touchend'), 0);
    assert.equal(mockTarget.getListenerCount('touchcancel'), 0);
  } finally {
    globalThis.window = prevWin;
  }
});

test('Mobile Markup Integrity: index.html contains status header button and interactive status cards', () => {
  const htmlPath = path.resolve('index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="status-header-update-btn"'), 'Header update button must be present in HTML');
  assert.ok(html.includes('id="status-card-primary"'), 'Primary status card must be present');
  assert.ok(html.includes('id="status-card-secondary"'), 'Secondary status card must be present');
  assert.ok(html.includes('role="button"'), 'Status cards must have role="button"');
});

test('Mobile Stylesheet Integrity: form inputs avoid iOS zoom and modals have max-height bounds', () => {
  const sheetsCss = fs.readFileSync(path.resolve('styles/sheets-and-modals.css'), 'utf8');
  const timelineCss = fs.readFileSync(path.resolve('styles/timeline.css'), 'utf8');

  // Input font-size must be 1rem (16px) to avoid iOS Safari zoom
  assert.ok(
    sheetsCss.includes('font-size: 1rem;'),
    '.form-input font-size must be at least 1rem / 16px to prevent iOS auto-zoom'
  );

  // Event modal must have max-height
  assert.ok(
    sheetsCss.includes('max-height: min(86dvh'),
    '.event-modal must specify responsive max-height'
  );

  // Milestone metadata row must prevent wrapping
  assert.ok(
    timelineCss.includes('.milestone-meta-row {') && timelineCss.includes('flex-wrap: nowrap;'),
    '.milestone-meta-row must enforce flex-wrap: nowrap to prevent staggered heights'
  );

  // Reunion metadata row must exist
  assert.ok(
    timelineCss.includes('.reunion-meta-row {'),
    '.reunion-meta-row must pair date range and duration pill'
  );
});

test('Mobile Tab Transitions & Counter Cleanup Integrity', () => {
  const baseCss = fs.readFileSync(path.resolve('styles/base.css'), 'utf8');
  const modalsJs = fs.readFileSync(path.resolve('js/ui-modals.js'), 'utf8');
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf8');

  // Verify fluid hardware-accelerated slide transitions
  assert.ok(baseCss.includes('--slide-offset: 64px;'), 'Slide offset must be at least 48px for fluid mobile transitions');
  assert.ok(baseCss.includes('translate3d('), 'Keyframe animations must use translate3d for GPU compositing');
  assert.ok(baseCss.includes('touch-action: pan-y pinch-zoom;'), 'Panels must declare touch-action for responsive gestures');

  // Verify zero "Days Away" or separation days in modal displays
  assert.equal(modalsJs.includes('Days Away'), false, 'UI modals must not contain "Days Away" status text');
  assert.ok(modalsJs.includes('${plannedDays} Days Together'), 'Days breakdown must strictly show Days Together');
  assert.ok(modalsJs.includes('Days Together'), 'Modal status pill must retain Days Together for chapters');

  // Verify sub-milestone banner omits "In X days"
  assert.equal(appJs.includes('In ${evaluatedBoardState.soonerMilestoneDaysAway} days'), false, 'Sub-milestone banner must omit days away countdown string');
});
