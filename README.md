# ComfyUI Floating Preview

![Demo](images/Enregistrement%202026-04-29%20133128.gif)

A lightweight, zero‑dependency floating preview panel for ComfyUI. It displays live and final generated images in a draggable, resizable, zoomable glassmorphism window — without a single Python node.

---

## Features

- **Live preview** — stream images in real‑time during generation via `b_preview` WebSocket events
- **Zoom & pan** — mouse wheel zoom (1×–10×) centered on cursor; click‑drag to pan when zoomed in
- **Drag & resize** — move the panel by its header, resize from the bottom‑right corner
- **Auto‑fit** — panel height follows the image aspect ratio on every resize or new image
- **Minimize / toggle** — collapse to header‑only with `[–]`, disable preview with `[OFF]` (keeps panel minimal)
- **Persistent state** — position, size, enabled/minimized status saved in `localStorage` across sessions
- **Canvas‑friendly** — automatically clears native sampler previews so the canvas stays clean
- **Zero dependencies** — no npm, no build step, no Python packages. Drop‑in extension.

---



## Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Grow1nly/ComfyUI-FloatingPreview.git
```

Restart ComfyUI (or reload the frontend). No other steps required.

> **No Python nodes, no `pip install`, no `npm install`, no build step.**  
> The extension registers itself via `WEB_DIRECTORY = "./web"` in `__init__.py` — ComfyUI loads the JS and CSS automatically.

---

## Usage

| Action | How |
|--------|-----|
| Move the panel | Drag the header (`● Preview pro`) |
| Resize | Drag the bottom‑right corner grip |
| Zoom in / out | Mouse wheel on the image (centered on cursor, 100%–1000%) |
| Pan | Click‑drag on the image (only when zoomed beyond 100%) |
| Reset zoom | Happens automatically on each new image |
| Collapse | Click `[–]` in the header |
| Disable / enable | Click `[OFF]` / `[ON]` — panel enters a faded disabled state |

---

## How it works

The extension listens to five ComfyUI WebSocket events and reacts accordingly:

```
  execution_start     → reset internal node tracking
                           clear preview if disabled

  executing(nodeId)   → track active node
                           clear that node's native canvas preview
                           clear all sampler native previews

  progress({node})    → update tracked node ID

  b_preview(Blob)     → display live image in the panel (ObjectURL)
                           resize height to match image ratio
                           reset zoom to 100%
                           clear native previews (twice for reliability)

  executed({output})  → fetch final image from ComfyUI's /view endpoint
                           display it in the panel
                           same auto‑fit + zoom reset
                           clear native previews
```

All event listeners are registered through a managed pattern (`addManagedListener`) and cleaned up on extension hot‑reload via a global `window.__floatingPreviewCleanuppro` hook.

### Sampler preview clearing

The extension detects sampler nodes by checking if the node type includes `"KSampler"` or `"SamplerCustom"`. When enabled, it clears their native canvas previews at every relevant event to avoid visual clutter.

---

## UI details

- **Glassmorphism** — `backdrop-filter: blur(12px)`, semi‑transparent `rgba(20, 20, 25, 0.7)` background, light inner shadow
- **Header** — darker background (`rgba(30, 30, 35, 0.88)`), contains the green pulsing status dot, the zoom level indicator, and control buttons
- **Status dot** — animated `pulse-dot-pro` keyframe (green glow ripple) when enabled, static gray `#555` when disabled
- **Zoom indicator** — shows current zoom percentage next to the title (hidden at 100%)
- **Toggle button** — green `ON` / red `OFF` with hover lift effect
- **Font** — Google Inter loaded via JS (`document.createElement("link")`), falls back to system `system-ui, -apple-system, sans-serif` if offline
- **Dark only** — no light theme, no light‑mode variables
- **CSS** — organised by ascending specificity with CSS custom properties, Biome‑compliant

---

## State persistence

The panel saves its state to `localStorage` under the key `fp-state-pro`:

```json
{
  "_version": 2,
  "enabled": true,
  "minimized": false,
  "left": "120px",
  "top": "135px",
  "width": 396,
  "height": 640
}
```

- State is persisted on every drag end, resize end, minimize toggle, and enable toggle
- A `_version` field guards against breaking schema changes — mismatched versions reset to defaults automatically
- **Reset manually**: run `localStorage.removeItem("fp-state-pro")` in the browser console

---

## Project structure

| File | Role |
|------|------|
| `__init__.py` | Extension registration (`WEB_DIRECTORY = "./web"`, empty `NODE_CLASS_MAPPINGS`) |
| `web/floating_preview.js` | All logic — ComfyUI integration, WebSocket handlers, drag/resize/zoom/pan, state management |
| `web/style.css` | Glassmorphism dark‑only styling organised by ascending specificity |

---

## Compatibility

- **ComfyUI only** — frontend‑only extension, no Python backend
- **No dependencies** — zero npm/pip packages required
- **No build** — JS and CSS served directly by ComfyUI's static file server

---

## License

MIT
