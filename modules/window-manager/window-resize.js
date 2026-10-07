const EDGES = ['n','e','s','w','ne','se','sw','nw'];

export function attachResize(element, { getState, setRect, onStart, onEnd, disabled = () => false }) {
  const handles = {};
  let active = null;
  let start = null;

  for (const edge of EDGES) {
    const h = document.createElement('div');
    h.className = `terapia-window__resize-handle terapia-window__resize-handle--${edge}`;
    h.dataset.edge = edge;
    element.appendChild(h);
    handles[edge] = h;

    h.addEventListener('pointerdown', (event) => {
      if (disabled() || event.button !== 0) return;
      const state = getState();
      if (state.maximized || state.minimized || state.locked) return;
      active = edge;
      start = { x: event.clientX, y: event.clientY, ...state };
      h.setPointerCapture?.(event.pointerId);
      onStart?.(event);
      event.preventDefault();
      event.stopPropagation();
    });

    h.addEventListener('pointermove', (event) => {
      if (!active || !start) return;
      let { x, y, width, height } = start;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      let nextX = start.x;
      let nextY = start.y;

      if (active.includes('e')) width = start.width + dx;
      if (active.includes('s')) height = start.height + dy;
      if (active.includes('w')) { width = start.width - dx; nextX = start.x + dx; }
      if (active.includes('n')) { height = start.height - dy; nextY = start.y + dy; }

      if (width < start.minWidth) {
        if (active.includes('w')) nextX -= start.minWidth - width;
        width = start.minWidth;
      }
      if (height < start.minHeight) {
        if (active.includes('n')) nextY -= start.minHeight - height;
        height = start.minHeight;
      }
      setRect(nextX, nextY, width, height);
    });

    h.addEventListener('pointerup', (event) => {
      if (!active) return;
      active = null;
      start = null;
      try { h.releasePointerCapture?.(event.pointerId); } catch {}
      onEnd?.(event);
    });
    h.addEventListener('pointercancel', () => { active = null; start = null; });
  }

  return () => Object.values(handles).forEach(h => h.remove());
}
