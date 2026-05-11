# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-11
**Commit:** b1a15fc
**Branch:** ui-header-opaque-toggle

## OVERVIEW
ComfyUI frontend-only extension. Floating image preview panel for the ComfyUI canvas. No Python nodes, no dependencies.

## STRUCTURE
```
./
├── __init__.py              # Extension registration (7 lines, empty NODE_CLASS_MAPPINGS)
├── web/
│   ├── floating_preview.js  # All logic: ComfyUI extension, WebSocket events, drag/resize/zoom/pan (554 lines)
│   └── style.css            # Glassmorphism dark-only styling, specificity-ordered (307 lines)
└── images/                  # Demo GIF only
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add ComfyUI nodes | `__init__.py` | Currently empty - frontend only |
| Change preview behavior | `web/floating_preview.js` | `app.registerExtension()` pattern |
| Modify panel appearance | `web/style.css` | `#floating-preview-pro` selector |
| Change WebSocket event handling | `web/floating_preview.js` | Lines ~398-457: `execution_start`, `executing`, `progress`, `b_preview`, `executed` |
| Modify zoom/pan behavior | `web/floating_preview.js` | Lines ~258-290: `updateZoomDisplay()`, `clampPan()`, `applyZoomTransform()`, `resetZoom()` |
| Change zoom indicator style | `web/style.css` | `#fp-zoom-level` rule (line 161) |

## COMFYUI INTEGRATION
- `WEB_DIRECTORY = "./web"` in `__init__.py` → ComfyUI auto-loads JS from this dir
- JS imports `app` from `../../scripts/app.js` (relative to ComfyUI root)
- Extension name: `FloatingPreviewPro`
- No `NODE_CLASS_MAPPINGS` entries - purely frontend, zero Python logic

## CONVENTIONS
- Constants at top of JS file (lines 3-20): `EXTENSION_NAME`, `STORAGE_KEY`, `DEFAULT_STATE`
- Managed event listeners: `addManagedListener()` + cleanup array pattern (lines 126-129)
  - `registerCleanup()` for non-standard listeners (e.g., wheel with `{ passive: false }`)
- State persistence via `localStorage` key `fp-state-pro` (versioned via `STORAGE_VERSION`)
- Global cleanup hook on `window.__floatingPreviewCleanuppro`

## ANTI-PATTERNS (THIS PROJECT)
- No Python dependencies allowed - frontend-only extension
- No build step - JS/CSS served directly by ComfyUI
- Don't add Python node classes - defeats the purpose (frontend-only)

## UNIQUE STYLES
- Dark-only theme (`.fp-light` removed, no light mode)
- Glassmorphism UI: `backdrop-filter: blur(12px)`, semi-transparent backgrounds
- Pulse animation on header dot (`pulse-dot-pro` keyframe)
- No fade-in animation on images (instant display, `fade-in-pro` removed)
- Disabled mode: opacity 0.22, `pointer-events: none` (except header/controls)
- External font: Google Fonts Inter (loaded via JS `document.createElement("link")`, not CSS `@import`)
- Zoom indicator: `#fp-zoom-level` — small 11px text at 0.7 opacity
- CSS organized by ascending specificity (Biome-compliant): root variables → base components → descendants → pseudo-elements → compound states

## ZOOM & PAN (new since 2026-05-06)
- **Mouse wheel** on image area: zooms in/out by 10% increments, centered on cursor position
- **Clamp**: 1× (100%) minimum, 10× (1000%) maximum — cannot zoom out below fit
- **Pan**: click-drag on image when zoomed > 1×, cursor changes to `grab`/`grabbing`
- **Reset**: zoom resets to 1× on each new image (`addImage` → `img.onload`)
- **State vars**: `zoom`, `panX`, `panY`, `isPanning`, `panStartX/Y`, `panOrigX/Y`
- **Transform**: `translate(panX, panY) scale(zoom)` with `transform-origin: 0 0`
- **Wheel listener**: uses direct `addEventListener` with `{ passive: false }` + `registerCleanup()` (not `addManagedListener`)

## WEBSOCKET EVENTS
| Event | Handler | Purpose |
|-------|---------|---------|
| `execution_start` | Reset `currentNodeId`, clear preview if disabled | Workflow start |
| `executing` | Track active node, clear native preview | During generation |
| `progress` | Track node ID from progress updates | Progress tracking |
| `b_preview` | Display Blob preview image | Live preview stream |
| `executed` | Display final image from output | Generation complete |

## COMMANDS
```bash
# No build/test commands - drop-in ComfyUI extension
# Installation: git clone into ComfyUI/custom_nodes/
# Restart ComfyUI after any changes
```

## NOTES
- Clears native sampler previews (`clearAllSamplerPreviews()`) to keep canvas cleaner
- Sampler detection: node type includes "KSampler" or "SamplerCustom"
- `autoFit` permanently enabled (variable removed from DEFAULT_STATE and localStorage)
- Panel height auto-follows image ratio on resize via `recalcHeightFromImage()`: `height = width × (img.naturalHeight / img.naturalWidth) + headerHeight`
- State saved on every drag/resize/minimize action
- External font URL dependency (`fonts.googleapis.com`) — offline installs won't load Inter
- `preDisabledMinimized` preserved for re-enable state restoration
- CSS `#fp-header > span::before` uses child combinator `>` to avoid double dot on nested `#fp-zoom-level` span
