import { useEffect, useState } from 'react';

/**
 * One place that knows whether the window is fullscreen.
 *
 * The desktop window knows best (F11 from the menu, the menu item, our own
 * button), so the main process pushes every enter/leave event here; in a plain
 * browser the Fullscreen API does the same through `fullscreenchange`. Anything
 * that offers a way *out* of fullscreen subscribes to this, which is why the
 * exit control can never get out of sync with the real window.
 */

let current = false;
const listeners = new Set();

function publish(next) {
  const value = Boolean(next);
  if (value === current) return;
  current = value;
  listeners.forEach((fn) => fn(value));
}

export const isFullscreen = () => current;

export function subscribeFullscreen(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const bridge = () => (typeof window === 'undefined' ? null : window.shoso || null);

let wired = false;
function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  document.addEventListener('fullscreenchange', () => publish(Boolean(document.fullscreenElement)));
  const api = bridge();
  if (api?.onFullscreenChange) api.onFullscreenChange((value) => publish(value));
  if (api?.isFullscreen) {
    Promise.resolve(api.isFullscreen()).then(publish).catch(() => {});
  }
}

export function toggleFullscreen() {
  wire();
  const api = bridge();
  if (api?.toggleFullscreen) {
    api.toggleFullscreen();
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
}

/** Leave fullscreen no matter who put us in it. */
export function exitFullscreen() {
  wire();
  const api = bridge();
  if (api?.setFullscreen) {
    api.setFullscreen(false);
    return;
  }
  if (api?.toggleFullscreen && current) {
    api.toggleFullscreen();
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen?.();
}

/** Subscribe to the real window state. */
export function useFullscreen() {
  const [value, setValue] = useState(current);
  useEffect(() => {
    wire();
    setValue(current);
    return subscribeFullscreen(setValue);
  }, []);
  return value;
}
