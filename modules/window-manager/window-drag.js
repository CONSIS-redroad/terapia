export function attachDrag(handle, element, { getState, setPosition, onStart, onEnd, disabled = () => false }) {
  let active = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const down = (event) => {
    if (disabled() || event.button !== 0) return;
    if (event.target.closest('button, input, textarea, select, a')) return;
    const state = getState();
    if (state.maximized || state.minimized) return;
    active = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = state.x;
    originY = state.y;
    handle.setPointerCapture?.(event.pointerId);
    onStart?.(event);
    event.preventDefault();
  };

  const move = (event) => {
    if (!active) return;
    setPosition(originX + event.clientX - startX, originY + event.clientY - startY);
  };

  const up = (event) => {
    if (!active) return;
    active = false;
    try { handle.releasePointerCapture?.(event.pointerId); } catch {}
    onEnd?.(event);
  };

  handle.addEventListener('pointerdown', down);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);

  return () => {
    handle.removeEventListener('pointerdown', down);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
  };
}
