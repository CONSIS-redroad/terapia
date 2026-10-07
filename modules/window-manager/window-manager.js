import { TerapiaWindow } from './window.js';
import { WindowLayer } from './window-layer.js';

export class WindowManager {
  constructor({ root = document.body, storageKey = 'terapia.window-manager.v1' } = {}) {
    this.root = root;
    this.storageKey = storageKey;
    this.windows = new Map();
    this.layer = new WindowLayer(100);
    this.saved = this.load();
    this.root.classList.add('terapia-window-layer');
    addEventListener('resize', () => this.windows.forEach(w => w.render()));
  }

  open(options) {
    const existing = this.windows.get(options.id);
    if (existing) { this.focus(options.id); return existing; }
    const win = new TerapiaWindow(this, options);
    win.state.zIndex = this.layer.next();
    this.windows.set(options.id, win);
    this.root.appendChild(win.el);
    win.render();
    this.save();
    return win;
  }

  close(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.el.remove();
    this.windows.delete(id);
    delete this.saved[id];
    this.save();
  }

  focus(id) {
    const win = this.windows.get(id);
    if (!win) return;
    win.state.zIndex = this.layer.next();
    win.render();
    this.save();
  }

  save() {
    const data = {};
    this.windows.forEach((w, id) => { data[id] = w.state; });
    try { localStorage.setItem(this.storageKey, JSON.stringify(data)); } catch {}
    this.saved = data;
  }

  load() {
    try { return JSON.parse(localStorage.getItem(this.storageKey) || '{}'); } catch { return {}; }
  }
}
