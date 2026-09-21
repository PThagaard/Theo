/**
 * Turns touches (and mouse clicks, for desktop testing) into simple
 * down/move/up calls, and blocks every browser gesture a baby could trigger:
 * scrolling, pinch zoom, double-tap zoom, long-press menus and text selection.
 */

export interface InputHandlers {
  down(id: number, x: number, y: number): void;
  move(id: number, x: number, y: number): void;
  up(id: number): void;
}

export function attachInput(element: HTMLElement, handlers: InputHandlers): void {
  const active = new Set<number>();

  const position = (event: PointerEvent): [number, number] => {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    active.add(event.pointerId);
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Not supported; moves are still delivered while the pointer stays over the canvas.
    }
    const [x, y] = position(event);
    handlers.down(event.pointerId, x, y);
  });

  element.addEventListener('pointermove', (event) => {
    if (!active.has(event.pointerId)) return;
    event.preventDefault();
    // Coalesced events give every sample of a fast swipe, so no balloon on the path is skipped.
    const samples = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
    for (const sample of samples.length ? samples : [event]) {
      const [x, y] = position(sample);
      handlers.move(event.pointerId, x, y);
    }
  });

  const end = (event: PointerEvent) => {
    if (!active.delete(event.pointerId)) return;
    handlers.up(event.pointerId);
  };
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);

  const block = (event: Event) => event.preventDefault();
  const blocked = ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'dblclick', 'selectstart', 'dragstart'];
  for (const type of blocked) element.addEventListener(type, block, { passive: false });
  // Stops rubber-band scrolling of the whole page on iOS; the parent menu may still scroll.
  document.addEventListener(
    'touchmove',
    (event) => {
      if ((event.target as Element | null)?.closest?.('#parent-panel')) return;
      event.preventDefault();
    },
    { passive: false },
  );
}

/**
 * Calls `onShake` when the phone is shaken. Uses the motion sensor through the standard
 * DeviceMotion API (works in the Android app and in browsers; iOS asks for permission on
 * the first touch).
 */
/**
 * The phone's roll, a few times a second, from the same motion sensor: how far the right side is held down
 * (radians, positive), smoothed so the water it drives moves calmly. Nothing without a sensor (desktop).
 */
export function attachTilt(onTilt: (roll: number) => void): void {
  if (typeof window.DeviceMotionEvent === 'undefined') return;
  let smoothed = 0;
  let last = 0;
  window.addEventListener('devicemotion', (event) => {
    const a = event.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null) return;
    // Upright, the reaction to gravity points up the screen (+y); tilting the right side down leans it to -x.
    const roll = Math.atan2(-a.x, Math.max(1, a.y));
    smoothed += (roll - smoothed) * 0.25;
    const now = performance.now();
    if (now - last < 40) return;
    last = now;
    onTilt(smoothed);
  });
}

export function attachShake(onShake: () => void): void {
  if (typeof window.DeviceMotionEvent === 'undefined') return;
  const THRESHOLD = 24; // m/s² change between two readings, summed over the axes
  const COOLDOWN_MS = 700;
  let previous: { x: number; y: number; z: number } | null = null;
  let lastShake = 0;

  const listen = () => {
    window.addEventListener('devicemotion', (event) => {
      const a = event.accelerationIncludingGravity ?? event.acceleration;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      if (previous) {
        const delta = Math.abs(a.x - previous.x) + Math.abs(a.y - previous.y) + Math.abs(a.z - previous.z);
        const now = performance.now();
        if (delta > THRESHOLD && now - lastShake > COOLDOWN_MS) {
          lastShake = now;
          onShake();
        }
      }
      previous = { x: a.x, y: a.y, z: a.z };
    });
  };

  const motion = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  if (typeof motion.requestPermission === 'function') {
    // iOS: permission can only be requested from a user gesture.
    const ask = () => {
      window.removeEventListener('pointerdown', ask);
      motion
        .requestPermission?.()
        .then((state) => {
          if (state === 'granted') listen();
        })
        .catch(() => undefined);
    };
    window.addEventListener('pointerdown', ask);
  } else {
    listen();
  }
}
