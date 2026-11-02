/**
 * Trip Countdown & Timeline Board
 * Sheet Gestures: Touch & Pointer Drag-to-Dismiss Handler
 */

/**
 * Binds downward drag gestures to a bottom sheet container using pointer and touch events.
 *
 * @param {HTMLElement | null} sheetElement
 * @param {HTMLElement | null} dragTargetElement
 * @param {() => void} onClose
 * @param {object} [gestureOptions]
 * @param {number} [gestureOptions.dismissThreshold=100]
 * @param {number} [gestureOptions.velocityThreshold=0.5]
 * @param {string} [gestureOptions.openClass='is-open']
 * @returns {() => void} Unbind cleanup function
 */
export function bindSheetDragGestures(sheetElement, dragTargetElement, onClose, gestureOptions = {}) {
  if (!sheetElement || typeof window === 'undefined') {
    return () => {};
  }

  const {
    dismissThreshold = 100,
    velocityThreshold = 0.5,
    openClass = 'is-open'
  } = gestureOptions;

  let pointerStartY = 0;
  let dragStartTimeMs = 0;
  let currentDownwardDeltaY = 0;
  let isTrackingDrag = false;

  const resetSheetTransforms = () => {
    sheetElement.style.transform = '';
    sheetElement.style.transition = '';
  };

  const handlePointerDown = (/** @type {PointerEvent} */ pointerEvent) => {
    if (!sheetElement.classList.contains(openClass)) return;
    if (pointerEvent.pointerType === 'mouse' && pointerEvent.button !== 0) return;

    pointerStartY = pointerEvent.clientY;
    dragStartTimeMs = Date.now();
    currentDownwardDeltaY = 0;
    isTrackingDrag = true;
    sheetElement.style.transition = 'none';

    if (dragTargetElement?.setPointerCapture) {
      try {
        dragTargetElement.setPointerCapture(pointerEvent.pointerId);
      } catch {
        // Pointer capture unavailable
      }
    }
  };

  const handlePointerMove = (/** @type {PointerEvent} */ pointerEvent) => {
    if (!isTrackingDrag) return;
    const deltaY = pointerEvent.clientY - pointerStartY;
    if (deltaY > 0) {
      currentDownwardDeltaY = deltaY;
      sheetElement.style.transform = `translateY(${deltaY}px)`;
      if (pointerEvent.cancelable) pointerEvent.preventDefault();
    }
  };

  const handlePointerEnd = (/** @type {PointerEvent} */ pointerEvent) => {
    if (!isTrackingDrag) return;
    isTrackingDrag = false;

    if (dragTargetElement?.releasePointerCapture) {
      try {
        dragTargetElement.releasePointerCapture(pointerEvent.pointerId);
      } catch {
        // Pointer capture release failed
      }
    }

    const elapsedDragMs = Math.max(1, Date.now() - dragStartTimeMs);
    const downwardVelocity = currentDownwardDeltaY / elapsedDragMs;

    if (currentDownwardDeltaY >= dismissThreshold || (currentDownwardDeltaY > 30 && downwardVelocity >= velocityThreshold)) {
      resetSheetTransforms();
      onClose();
    } else {
      sheetElement.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
      sheetElement.style.transform = '';
      const handleTransitionEnd = () => {
        sheetElement.removeEventListener('transitionend', handleTransitionEnd);
        sheetElement.style.transition = '';
      };
      sheetElement.addEventListener('transitionend', handleTransitionEnd);
    }
    currentDownwardDeltaY = 0;
  };

  const handleSheetTouchStart = (/** @type {TouchEvent} */ touchEvent) => {
    if (!sheetElement.classList.contains(openClass)) return;
    if (sheetElement.scrollTop <= 0 && touchEvent.touches.length > 0) {
      pointerStartY = touchEvent.touches[0].clientY;
      dragStartTimeMs = Date.now();
      currentDownwardDeltaY = 0;
    }
  };

  const handleSheetTouchMove = (/** @type {TouchEvent} */ touchEvent) => {
    if (sheetElement.scrollTop <= 0 && touchEvent.touches.length > 0) {
      const deltaY = touchEvent.touches[0].clientY - pointerStartY;
      if (deltaY > 0 && !isTrackingDrag) {
        isTrackingDrag = true;
        sheetElement.style.transition = 'none';
      }
      if (isTrackingDrag) {
        currentDownwardDeltaY = deltaY;
        sheetElement.style.transform = `translateY(${deltaY}px)`;
        if (touchEvent.cancelable) touchEvent.preventDefault();
      }
    }
  };

  const handleSheetTouchEnd = () => {
    if (!isTrackingDrag) return;
    isTrackingDrag = false;

    const elapsedDragMs = Math.max(1, Date.now() - dragStartTimeMs);
    const downwardVelocity = currentDownwardDeltaY / elapsedDragMs;

    if (currentDownwardDeltaY >= dismissThreshold || (currentDownwardDeltaY > 30 && downwardVelocity >= velocityThreshold)) {
      resetSheetTransforms();
      onClose();
    } else {
      sheetElement.style.transition = 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)';
      sheetElement.style.transform = '';
      const handleTransitionEnd = () => {
        sheetElement.removeEventListener('transitionend', handleTransitionEnd);
        sheetElement.style.transition = '';
      };
      sheetElement.addEventListener('transitionend', handleTransitionEnd);
    }
    currentDownwardDeltaY = 0;
  };

  if (dragTargetElement) {
    dragTargetElement.addEventListener('pointerdown', handlePointerDown);
    dragTargetElement.addEventListener('pointermove', handlePointerMove);
    dragTargetElement.addEventListener('pointerup', handlePointerEnd);
    dragTargetElement.addEventListener('pointercancel', handlePointerEnd);
  }

  sheetElement.addEventListener('touchstart', handleSheetTouchStart, { passive: true });
  sheetElement.addEventListener('touchmove', handleSheetTouchMove, { passive: false });
  sheetElement.addEventListener('touchend', handleSheetTouchEnd, { passive: true });
  sheetElement.addEventListener('touchcancel', handleSheetTouchEnd, { passive: true });

  return () => {
    if (dragTargetElement) {
      dragTargetElement.removeEventListener('pointerdown', handlePointerDown);
      dragTargetElement.removeEventListener('pointermove', handlePointerMove);
      dragTargetElement.removeEventListener('pointerup', handlePointerEnd);
      dragTargetElement.removeEventListener('pointercancel', handlePointerEnd);
    }
    sheetElement.removeEventListener('touchstart', handleSheetTouchStart);
    sheetElement.removeEventListener('touchmove', handleSheetTouchMove);
    sheetElement.removeEventListener('touchend', handleSheetTouchEnd);
    sheetElement.removeEventListener('touchcancel', handleSheetTouchEnd);
    resetSheetTransforms();
  };
}
