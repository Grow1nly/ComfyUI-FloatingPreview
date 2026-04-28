# ComfyUI Floating Preview

A lightweight ComfyUI frontend extension that shows image previews in a movable floating window while your workflow is running.

## Features

- Live floating preview for generated images
- Draggable and resizable preview window
- Minimize and enable/disable controls
- Automatic image fit on first display
- Saved window position and size between sessions
- Clears native sampler previews to keep the canvas cleaner

## Installation

Clone this repository into your ComfyUI `custom_nodes` directory:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Grow1nly/ComfyUI-FloatingPreview.git
```

Restart ComfyUI after installation.

## Usage

Start a workflow as usual. The floating preview panel appears in the ComfyUI interface and updates when previews or final images are produced.

You can:

- drag the panel from the header
- resize it from the bottom-right corner
- minimize it
- disable or re-enable it without removing the extension

## Structure

- `__init__.py`: registers the frontend extension
- `web/floating_preview.js`: preview logic and UI behavior
- `web/style.css`: panel styling

## Compatibility

Built for ComfyUI as a frontend-only custom node extension. No extra Python dependencies are required.

## Roadmap

- configurable default position and size
- optional settings panel
- improved support for different preview event flows

## License

MIT
