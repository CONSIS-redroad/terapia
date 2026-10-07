import { mergeWindowState, clampWindowState } from './window-state.js';
import { attachDrag } from './window-drag.js';
import { attachResize } from './window-resize.js';

export class TerapiaWindow {
  constructor(manager, options) {
    this.manager = manager;
    this.options = options;
    this.id = options.id;
    this.state = mergeWindowState(manager.saved[this.id], options.state);
    this.normalState = null;
    this.el = document.createElement('section');
    this.el.className = 'terapia-window';
    this.el.dataset.windowId = this.id;
    this.renderShell();
    this.bind();
    this.render();
  }

  renderShell() {
    this.el.innerHTML = `
      <header class="terapia-window__titlebar">
        <div class="terapia-window__titlegroup">
          <span class="terapia-window__grip" aria-hidden="true">⋮⋮</span>
          <h2 class="terapia-window__title"></h2>
        </div>
        <div class="terapia-window__controls">
          <button type="button" data-action="minimize" title="Minimalizuj">−</button>
          <button type="button" data-action="maximize" title="Maksymalizuj">□</button>
          <button type="button" data-action="close" title="Zamknij">×</button>
        </div>
      </header>
      <div class="terapia-window__body"></div>
    `;
    this.el.querySelector('.terapia-window__title').textContent = this.options.title || this.id;
    const body = this.el.querySelector('.terapia-window__body');
    if (this.options.content instanceof Node) body.appendChild(this.options.content);
    else body.innerHTML = this.options.content || '';
  }

  bind() {
    this.el.addEventListener('pointerdown', () => this.manager.focus(this.id));
    this.el.querySelector('[data-action="close"]').onclick = () => this.close();
    this.el.querySelector('[data-action="minimize"]').onclick = () => this.minimize();
    this.el.querySelector('[data-action="maximize"]').onclick = () => this.toggleMaximize();
    attachDrag(this.el.querySelector('.terapia-window__titlebar'), this.el, {
      getState: () => this.state,
      setPosition: (x, y) => { this.state = clampWindowState({ ...this.state, x, y }); this.render(); this.persist(); },
      onStart: () => this.manager.focus(this.id)
    });
    attachResize(this.el, {
      getState: () => this.state,
      setRect: (x, y, width, height) => { this.state = clampWindowState({ ...this.state, x, y, width, height }); this.render(); this.persist(); },
      onStart: () => this.manager.focus(this.id)
    });
  }

  render() {
    const mobile = matchMedia('(max-width: 700px)').matches;
    const s = this.state;
    this.el.style.zIndex = s.zIndex;
    this.el.style.opacity = s.opacity;
    this.el.classList.toggle('is-minimized', s.minimized);
    this.el.classList.toggle('is-maximized', s.maximized);
    if (mobile || s.maximized) {
      this.el.style.left = '0px'; this.el.style.top = '0px'; this.el.style.width = '100vw'; this.el.style.height = '100vh';
    } else {
      this.el.style.left = `${s.x}px`; this.el.style.top = `${s.y}px`; this.el.style.width = `${s.width}px`; this.el.style.height = `${s.height}px`;
    }
  }

  persist() { this.manager.save(); }
  minimize() { this.state.minimized = !this.state.minimized; this.render(); this.persist(); }
  toggleMaximize() {
    if (!this.state.maximized) {
      this.normalState = { ...this.state };
      this.state.maximized = true; this.state.minimized = false;
    } else {
      this.state = mergeWindowState(this.state, this.normalState || {});
      this.state.maximized = false;
    }
    this.render(); this.persist();
  }
  close() { this.manager.close(this.id); }
}
