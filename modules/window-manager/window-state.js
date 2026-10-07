export const DEFAULT_WINDOW = {
  x: 80,
  y: 80,
  width: 760,
  height: 520,
  minWidth: 320,
  minHeight: 220,
  zIndex: 100,
  opacity: 0.96,
  minimized: false,
  maximized: false,
  locked: false,
};

export function mergeWindowState(base, patch = {}) {
  return { ...DEFAULT_WINDOW, ...base, ...patch };
}

export function clampWindowState(state, viewport = { width: innerWidth, height: innerHeight }) {
  const next = { ...state };
  next.width = Math.max(next.minWidth, Math.min(next.width, viewport.width));
  next.height = Math.max(next.minHeight, Math.min(next.height, viewport.height));
  next.x = Math.max(0, Math.min(next.x, Math.max(0, viewport.width - next.width)));
  next.y = Math.max(0, Math.min(next.y, Math.max(0, viewport.height - next.height)));
  return next;
}
