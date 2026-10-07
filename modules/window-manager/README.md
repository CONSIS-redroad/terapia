# TERAPIA Window Manager

Gotowy, niezależny moduł wielookienkowego UI.

## Design

Wizualnie bazuje na Luna2: ciemne półprzezroczyste powierzchnie, mocny blur, subtelne białe obramowanie, `rounded-2xl`, dyskretne sterowanie przy hover oraz mała techniczna typografia.

## Minimalne użycie

```html
<link rel="stylesheet" href="./modules/window-manager/window.css">
<script type="module">
  import { WindowManager } from './modules/window-manager/window-manager.js';
  const wm = new WindowManager();
  wm.open({ id: 'demo', title: 'Demo', content: '<p>Okno TERAPIA</p>' });
</script>
```
