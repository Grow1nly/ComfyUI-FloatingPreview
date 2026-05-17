import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "FloatingPreviewPro";
const STYLE_ID = "floating-preview-pro-style";
const CONTAINER_ID = "floating-preview-pro";
const STORAGE_KEY = "fp-state-pro";
const STORAGE_VERSION = 2;
const GLOBAL_CLEANUP_KEY = "__floatingPreviewCleanuppro";
const DEFAULT_STATE = {
    enabled: true,
    minimized: false,
    left: "120px",
    top: "135px",
    width: 396,
    height: 640,
};
const MIN_WIDTH = 220;
const MIN_HEIGHT = 120;
const SAFE_MARGIN = 12;
const SAFE_TOP_MARGIN = 56;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_STATE };

    try {
        const parsed = JSON.parse(saved);
        if (parsed._version !== STORAGE_VERSION) {
            localStorage.removeItem(STORAGE_KEY);
            console.log("FloatingPreviewPro: state version mismatch, resetting to defaults");
            return { ...DEFAULT_STATE };
        }
        return {
            ...DEFAULT_STATE,
            ...parsed,
        };
    } catch (error) {
        console.warn("FloatingPreviewPro: unable to restore saved state", error);
        return { ...DEFAULT_STATE };
    }
}

app.registerExtension({
    name: EXTENSION_NAME,

    async setup() {
        if (typeof window[GLOBAL_CLEANUP_KEY] === "function") {
            window[GLOBAL_CLEANUP_KEY]();
        }

        const existingContainer = document.getElementById(CONTAINER_ID);
        if (existingContainer) {
            existingContainer.remove();
        }

        if (!document.getElementById(STYLE_ID)) {
            const link = document.createElement("link");
            link.id = STYLE_ID;
            link.rel = "stylesheet";
            link.href = new URL("./style.css", import.meta.url).href;
            document.head.appendChild(link);
            await new Promise(resolve => { link.onload = resolve; });
        }

        if (!document.getElementById("fp-font-inter")) {
            const fontLink = document.createElement("link");
            fontLink.id = "fp-font-inter";
            fontLink.rel = "stylesheet";
            fontLink.href =
                "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
            fontLink.onerror = () => console.warn("FloatingPreviewPro: failed to load Inter font, using system fallback");
            document.head.appendChild(fontLink);
        }

        const state = loadState();
        const container = document.createElement("div");
        container.id = CONTAINER_ID;
        container.innerHTML = `
            <div id="fp-header">
                <span>Preview pro<span id="fp-zoom-level"></span></span>
                <div id="fp-controls">
                    <button id="fp-download" type="button" aria-label="Download image"></button>
                    <button id="fp-minimize" type="button" aria-label="Minimize"></button>
                    <button id="fp-toggle" type="button" aria-label="Disable preview"></button>
                </div>
            </div>
            <div id="fp-content" role="status" aria-live="polite"></div>
            <div id="fp-resize"></div>
        `;
        document.body.appendChild(container);

        const content = container.querySelector("#fp-content");
        const toggleBtn = container.querySelector("#fp-toggle");
        const minimizeBtn = container.querySelector("#fp-minimize");
        const downloadBtn = container.querySelector("#fp-download");
        const header = container.querySelector("#fp-header");
        const resize = container.querySelector("#fp-resize");

        let enabled = Boolean(state.enabled);
        let minimized = Boolean(state.minimized);
        let currentNodeId = null;
        let lastBlobUrl = null;
        let currentImageUrl = null;
        let currentImageFilename = "preview.png";
        let isDragging = false;
        let isResizing = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let startWidth = 0;
        let startX = 0;
        let preDisabledMinimized = false;
        let zoom = 1;
        let panX = 0;
        let panY = 0;
        let isPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let panOrigX = 0;
        let panOrigY = 0;
        const cleanups = [];

        function registerCleanup(callback) {
            cleanups.push(callback);
        }

        function addManagedListener(target, eventName, handler) {
            target.addEventListener(eventName, handler);
            registerCleanup(() => target.removeEventListener(eventName, handler));
        }

        function saveState() {
            const nextState = {
                _version: STORAGE_VERSION,
                enabled,
                minimized,
                left: container.style.left || DEFAULT_STATE.left,
                top: container.style.top || DEFAULT_STATE.top,
                width: Math.round(container.offsetWidth || DEFAULT_STATE.width),
                height: Math.round(container.offsetHeight || DEFAULT_STATE.height),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        }

        function applyState() {
            container.style.left = state.left;
            container.style.top = state.top;
            container.style.width = `${Math.max(Number(state.width) || DEFAULT_STATE.width, MIN_WIDTH)}px`;
            toggleBtn.innerText = enabled ? "ON" : "OFF";
            toggleBtn.ariaLabel = enabled ? "Disable preview" : "Enable preview";
            applyInteractionMode();
            applyMinimizedState();
        }

        function applyInteractionMode() {
            container.classList.toggle("fp-disabled", !enabled);
        }

        function revokeLastBlobUrl() {
            if (lastBlobUrl) {
                URL.revokeObjectURL(lastBlobUrl);
                lastBlobUrl = null;
            }
        }

        function getGraphNodes() {
            const graph = app.graph;
            if (!graph) return [];
            if (Array.isArray(graph._nodes)) return graph._nodes;
            if (graph._nodes_by_id && typeof graph._nodes_by_id === "object") {
                return Object.values(graph._nodes_by_id);
            }
            return [];
        }

        function getNodeId(detail) {
            if (detail == null) return null;
            if (typeof detail === "number") return detail;
            if (typeof detail === "string") {
                const parsed = Number(detail);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (typeof detail.node === "number") return detail.node;
            if (typeof detail.display_node === "number") return detail.display_node;
            if (typeof detail.node === "string") {
                const parsed = Number(detail.node);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (typeof detail.display_node === "string") {
                const parsed = Number(detail.display_node);
                return Number.isFinite(parsed) ? parsed : null;
            }
            return null;
        }

        function clearNodePreview(node) {
            if (!node) return false;
            if (!node.imgs && !node.preview && node.imageIndex == null) return false;

            node.imgs = null;
            node.preview = null;
            node.imageIndex = null;
            return true;
        }

        function isSamplerNode(node) {
            const type = String(node?.type ?? "");
            return type.includes("KSampler") || type.includes("SamplerCustom");
        }

        function clearNativePreview(nodeId = currentNodeId) {
            if (!enabled || nodeId == null) return;

            const node = app.graph?.getNodeById?.(nodeId);
            if (!isSamplerNode(node)) return;

            if (clearNodePreview(node)) {
                app.graph?.setDirtyCanvas?.(true, true);
            }
        }

        function clearAllSamplerPreviews() {
            if (!enabled) return;

            let changed = false;
            for (const node of getGraphNodes()) {
                if (!isSamplerNode(node)) continue;
                changed = clearNodePreview(node) || changed;
            }

            if (changed) {
                app.graph?.setDirtyCanvas?.(true, true);
            }
        }

        function recalcHeightFromImage() {
            if (minimized) return;

            const img = content.querySelector("img");
            if (!img || !img.naturalWidth || !img.naturalHeight) return;

            const maxHeight = Math.max(window.innerHeight - SAFE_TOP_MARGIN - SAFE_MARGIN, MIN_HEIGHT);
            const imageHeight = container.offsetWidth * (img.naturalHeight / img.naturalWidth);
            const nextHeight = clamp(imageHeight + header.offsetHeight, MIN_HEIGHT, maxHeight);

            container.style.height = `${Math.round(nextHeight)}px`;
            sanitizePosition();
            saveState();
        }

        function updateZoomDisplay() {
            const zoomEl = container.querySelector("#fp-zoom-level");
            if (!zoomEl) return;
            zoomEl.textContent = zoom !== 1 ? `${Math.round(zoom * 100)}%` : "";
        }

        function clampPan() {
            const img = content.querySelector("img");
            if (!img || !img.naturalWidth || !img.naturalHeight) return;
            const contentW = content.clientWidth;
            const contentH = content.clientHeight;
            const renderedW = contentW;
            const renderedH = img.naturalHeight * (contentW / img.naturalWidth);
            const imgW = renderedW * zoom;
            const imgH = renderedH * zoom;
            if (imgW <= contentW) { panX = 0; } else { panX = clamp(panX, contentW - imgW, 0); }
            if (imgH <= contentH) { panY = 0; } else { panY = clamp(panY, contentH - imgH, 0); }
        }

        function applyZoomTransform() {
            const img = content.querySelector("img");
            if (!img) return;
            img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
            content.style.cursor = zoom > 1 ? "grab" : "";
            updateZoomDisplay();
        }

        function resetZoom() {
            zoom = 1;
            panX = 0;
            panY = 0;
            applyZoomTransform();
        }

        function addImage(url, isBlob, filename) {
            revokeLastBlobUrl();
            content.replaceChildren();

            const img = document.createElement("img");
            img.src = url;
            img.alt = "Floating preview";
            img.draggable = false;
            img.onload = () => { recalcHeightFromImage(); resetZoom(); };
            content.appendChild(img);

            currentImageUrl = url;
            currentImageFilename = filename || "preview.png";

            if (isBlob) {
                lastBlobUrl = url;
            }
        }

        function clearFloatingPreview() {
            revokeLastBlobUrl();
            content.replaceChildren();
            currentImageUrl = null;
            currentImageFilename = "preview.png";
        }

        function downloadCurrentImage() {
            if (!currentImageUrl) return;

            const a = document.createElement("a");
            a.href = currentImageUrl;
            a.download = currentImageFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function getBounds() {
            const maxLeft = Math.max(window.innerWidth - container.offsetWidth - SAFE_MARGIN, SAFE_MARGIN);
            const maxTop = Math.max(window.innerHeight - container.offsetHeight - SAFE_MARGIN, SAFE_TOP_MARGIN);
            return {
                minLeft: SAFE_MARGIN,
                minTop: SAFE_TOP_MARGIN,
                maxLeft,
                maxTop,
            };
        }

        function sanitizePosition() {
            const bounds = getBounds();
            const left = clamp(container.offsetLeft, bounds.minLeft, bounds.maxLeft);
            const top = clamp(container.offsetTop, bounds.minTop, bounds.maxTop);
            container.style.left = `${left}px`;
            container.style.top = `${top}px`;
        }

        function syncStateFromDom() {
            state.left = container.style.left || `${container.offsetLeft}px`;
            state.top = container.style.top || `${container.offsetTop}px`;
            state.width = container.offsetWidth;
            if (!minimized) {
                state.height = container.offsetHeight;
            }
            saveState();
        }

        function applyMinimizedState() {
            container.classList.toggle("fp-minimized", minimized);
            minimizeBtn.innerText = minimized ? "+" : "-";
            minimizeBtn.title = minimized ? "Expand" : "Minimize";
            minimizeBtn.ariaLabel = minimized ? "Expand" : "Minimize";
            resize.style.display = minimized ? "none" : "";

            if (minimized) {
                container.style.height = `${header.offsetHeight}px`;
            } else {
                recalcHeightFromImage();
            }
        }

        function setMinimized(nextMinimized) {
            container.style.transition = "height 0.25s ease";
            minimized = nextMinimized;
            state.minimized = minimized;
            applyMinimizedState();
            sanitizePosition();
            syncStateFromDom();
            window.setTimeout(() => {
                container.style.transition = "";
            }, 280);
        }

        function setEnabled(nextEnabled) {
            enabled = nextEnabled;
            toggleBtn.innerText = enabled ? "ON" : "OFF";
            applyInteractionMode();

            if (!enabled) {
                clearFloatingPreview();
                preDisabledMinimized = minimized;
                if (!minimized) {
                    setMinimized(true);
                }
            } else {
                if (minimized && !preDisabledMinimized) {
                    setMinimized(false);
                }
            }

            saveState();
        }

        addManagedListener(toggleBtn, "click", (event) => {
            event.stopPropagation();
            setEnabled(!enabled);
        });

        addManagedListener(minimizeBtn, "click", (event) => {
            event.stopPropagation();
            setMinimized(!minimized);
        });

        addManagedListener(downloadBtn, "click", (event) => {
            event.stopPropagation();
            downloadCurrentImage();
        });

        addManagedListener(app.api, "execution_start", () => {
            currentNodeId = null;
            if (!enabled) {
                clearFloatingPreview();
            }
        });

        addManagedListener(app.api, "executing", ({ detail }) => {
            if (!enabled) return;

            const nodeId = getNodeId(detail);
            if (nodeId != null) {
                currentNodeId = nodeId;
                clearNativePreview(nodeId);
            }
            clearAllSamplerPreviews();
        });

        addManagedListener(app.api, "progress", ({ detail }) => {
            const nodeId = getNodeId(detail);
            if (nodeId != null) {
                currentNodeId = nodeId;
            }
        });

        addManagedListener(app.api, "b_preview", ({ detail }) => {
            if (!enabled || !(detail instanceof Blob)) return;

            addImage(URL.createObjectURL(detail), true, "preview.png");

            clearNativePreview();
            clearAllSamplerPreviews();
            requestAnimationFrame(() => {
                clearNativePreview();
                clearAllSamplerPreviews();
            });
        });

        addManagedListener(app.api, "executed", ({ detail }) => {
            if (!enabled || !detail?.output?.images?.length) return;

            const nodeId = getNodeId(detail);
            if (nodeId != null) {
                currentNodeId = nodeId;
            }

            const image = detail.output.images[0];
            const filename = image.filename || "preview.png";
            const url = app.api.apiURL(
                `/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(image.type)}&subfolder=${encodeURIComponent(image.subfolder ?? "")}`
            );

            addImage(url, false, filename);
            clearNativePreview();
            clearAllSamplerPreviews();

            window.setTimeout(() => {
                clearNativePreview();
                clearAllSamplerPreviews();
            }, 80);
        });

        const wheelHandler = (event) => {
            if (!enabled || minimized) return;
            const img = content.querySelector("img");
            if (!img || !img.naturalWidth) return;
            event.preventDefault();
            const delta = event.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = clamp(zoom + delta, 1, 10);
            if (newZoom === zoom) return;
            const rect = content.getBoundingClientRect();
            const cursorX = event.clientX - rect.left;
            const cursorY = event.clientY - rect.top;
            const imgX = (cursorX - panX) / zoom;
            const imgY = (cursorY - panY) / zoom;
            zoom = newZoom;
            panX = cursorX - imgX * zoom;
            panY = cursorY - imgY * zoom;
            clampPan();
            applyZoomTransform();
        };
        content.addEventListener("wheel", wheelHandler, { passive: false });
        registerCleanup(() => content.removeEventListener("wheel", wheelHandler));

        addManagedListener(content, "mousedown", (event) => {
            if (event.button !== 0 || zoom <= 1) return;
            if (event.target.tagName !== "IMG") return;
            isPanning = true;
            panStartX = event.clientX;
            panStartY = event.clientY;
            panOrigX = panX;
            panOrigY = panY;
            content.style.cursor = "grabbing";
            event.preventDefault();
        });

        addManagedListener(header, "mousedown", (event) => {
            if (event.button !== 0) return;
            isDragging = true;
            dragOffsetX = event.clientX - container.offsetLeft;
            dragOffsetY = event.clientY - container.offsetTop;
            event.preventDefault();
        });

        addManagedListener(resize, "mousedown", (event) => {
            if (event.button !== 0 || minimized) return;
            isResizing = true;
            startWidth = container.offsetWidth;
            startX = event.clientX;
            event.stopPropagation();
            event.preventDefault();
        });

        addManagedListener(document, "mousemove", (event) => {
            if (isDragging) {
                const bounds = getBounds();
                const left = clamp(event.clientX - dragOffsetX, bounds.minLeft, bounds.maxLeft);
                const top = clamp(event.clientY - dragOffsetY, bounds.minTop, bounds.maxTop);
                container.style.left = `${left}px`;
                container.style.top = `${top}px`;
            }

            if (isResizing) {
                const maxWidth = Math.max(window.innerWidth - container.offsetLeft - SAFE_MARGIN, MIN_WIDTH);
                const nextWidth = clamp(startWidth + (event.clientX - startX), MIN_WIDTH, maxWidth);
                container.style.width = `${Math.round(nextWidth)}px`;
                recalcHeightFromImage();
            }

            if (isPanning) {
                panX = panOrigX + (event.clientX - panStartX);
                panY = panOrigY + (event.clientY - panStartY);
                clampPan();
                applyZoomTransform();
            }
        });

        addManagedListener(document, "mouseup", () => {
            if (!isDragging && !isResizing && !isPanning) return;
            isDragging = false;
            isResizing = false;
            isPanning = false;
            content.style.cursor = zoom > 1 ? "grab" : "";
            sanitizePosition();
            syncStateFromDom();
        });

        addManagedListener(window, "resize", () => {
            sanitizePosition();
            syncStateFromDom();
        });

        applyState();
        sanitizePosition();
        syncStateFromDom();

        window[GLOBAL_CLEANUP_KEY] = () => {
            clearFloatingPreview();
            for (const cleanup of cleanups.splice(0)) {
                cleanup();
            }
            container.remove();
            delete window[GLOBAL_CLEANUP_KEY];
        };
    },
});
