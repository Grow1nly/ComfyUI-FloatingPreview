# ComfyUI Floating Preview

🤖 A draggable, zoomable floating preview panel for ComfyUI.

![Demo](images/Enregistrement%202026-04-29%20133128.gif)

## ✨ Features

- 📺 Live preview during workflow generation
- 🖱️ Draggable and resizable preview window
- 🔍 Zoom (mouse wheel) and pan (click-drag when zoomed in)
- 📦 Minimize and enable/disable toggle
- 🔲 Auto-fit — panel height follows image aspect ratio
- 💾 Position and size saved between sessions
- 🧹 Clears native sampler previews to keep the canvas clean

## 🚀 Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Grow1nly/ComfyUI-FloatingPreview.git
```

Restart ComfyUI. No dependencies, no build step, no Python nodes.

## ▶️ Usage

| Action | How |
|--------|-----|
| Move the panel | Drag the header |
| Resize | Drag the bottom-right corner |
| Zoom | Mouse wheel on the image (100%–1000%) |
| Pan | Click-drag on the image (when zoomed in) |
| Collapse | Click `[–]` |
| Disable / enable | Click `[ON]` / `[OFF]` |

## 📂 Structure

```
./
├── __init__.py              # Extension registration
├── web/
│   ├── floating_preview.js  # All logic — drag, resize, zoom, WebSocket handling
│   └── style.css            # Glassmorphism dark-only styling
└── images/                  # Demo GIF
```

## 📝 License

MIT
