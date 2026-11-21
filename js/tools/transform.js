const ASPECT_PRESETS = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '4:3', ratio: 4 / 3 }
];

const SVG_LOCK_CLOSED = `<svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span>Locked</span>`;
const SVG_LOCK_OPEN = `<svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-1.9"/></svg><span>Unlocked</span>`;

export function mountTransformTool(container, studio) {
  let cropEditMode = false;
  let selectedRatio = null;
  let draftCrop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  let aspectLocked = true;

  container.innerHTML = `
    <!-- 1. Rotate & Flip -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          <span>Rotate &amp; Flip</span>
        </span>
        <span id="rotAngleBadge" class="badge-butter tabular-nums">0°</span>
      </div>
      <div class="row-2">
        <button id="rotLeftBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>Rotate -90°</span>
        </button>
        <button id="rotRightBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
          <span>Rotate +90°</span>
        </button>
        <button id="flipHBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/>
            <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/>
            <path d="M12 20v2"/>
            <path d="M12 14v2"/>
            <path d="M12 8v2"/>
            <path d="M12 2v2"/>
          </svg>
          <span>Flip Horiz</span>
        </button>
        <button id="flipVBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3"/>
            <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/>
            <path d="M4 12H2"/>
            <path d="M10 12H8"/>
            <path d="M16 12h-2"/>
            <path d="M22 12h-2"/>
          </svg>
          <span>Flip Vert</span>
        </button>
      </div>
    </div>

    <!-- 2. Interactive Aspect Ratio Cropper -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
            <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
          </svg>
          <span>Aspect Ratio Crop</span>
        </span>
        <span id="cropStatusBadge" class="badge-butter">Full</span>
      </div>

      <div id="cropPresetGrid" class="chip-grid">
        ${ASPECT_PRESETS.map(
          (p, i) =>
            `<button class="btn-mini crop-preset-btn ${i === 0 ? 'active' : ''}" data-idx="${i}" type="button">${p.label}</button>`
        ).join('')}
      </div>

      <div class="row-2">
        <button id="toggleCropEditBtn" class="btn btn-secondary btn-sm" type="button">Open Crop Box</button>
        <button id="applyCropBtn" class="btn btn-primary btn-sm" type="button" disabled>Apply Crop</button>
      </div>

      <button id="clearCropBtn" class="btn btn-ghost btn-sm btn-full hidden" type="button">
        Reset Crop to Full Frame
      </button>
    </div>

    <!-- 3. Smart Resizer -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>Smart Resize</span>
        </span>
        <button id="lockAspectBtn" class="btn-mini active" type="button" title="Toggle Aspect Ratio Lock">
          ${SVG_LOCK_CLOSED}
        </button>
      </div>

      <div class="row-2">
        <div class="field-group">
          <label for="resizeWInput">Width (px)</label>
          <input type="number" id="resizeWInput" class="input-control tabular-nums" min="1" max="16000" />
        </div>
        <div class="field-group">
          <label for="resizeHInput">Height (px)</label>
          <input type="number" id="resizeHInput" class="input-control tabular-nums" min="1" max="16000" />
        </div>
      </div>

      <div class="field-group">
        <label>Quick Scale &amp; Long-Edge Presets</label>
        <div class="chip-grid">
          <button class="btn-mini scale-pct-btn" data-scale="0.25" type="button">25%</button>
          <button class="btn-mini scale-pct-btn" data-scale="0.5" type="button">50%</button>
          <button class="btn-mini scale-pct-btn" data-scale="0.75" type="button">75%</button>
          <button class="btn-mini max-edge-btn" data-edge="1080" type="button">1080px</button>
          <button class="btn-mini max-edge-btn" data-edge="1920" type="button">1920px</button>
        </div>
      </div>

      <div class="row-2">
        <button id="applyResizeBtn" class="btn btn-primary btn-sm" type="button">Apply Size</button>
        <button id="resetResizeBtn" class="btn btn-secondary btn-sm" type="button">Original Size</button>
      </div>
    </div>

    <!-- 4. Fit-to-Frame / Social Padding -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <rect x="7" y="7" width="10" height="10" rx="1"/>
          </svg>
          <span>Social Frame Padding</span>
        </span>
      </div>

      <div class="row-2">
        <div class="field-group">
          <label for="frameRatioSelect">Canvas Ratio</label>
          <select id="frameRatioSelect" class="input-control">
            <option value="">None (Tight)</option>
            <option value="1:1">1:1 Square</option>
            <option value="4:5">4:5 IG Portrait</option>
            <option value="9:16">9:16 Story / Reel</option>
            <option value="16:9">16:9 Widescreen</option>
          </select>
        </div>

        <div class="field-group">
          <label for="frameModeSelect">Padding Fill</label>
          <select id="frameModeSelect" class="input-control">
            <option value="blur">Blurred Photo</option>
            <option value="color">Solid Color</option>
          </select>
        </div>
      </div>

      <div id="frameColorGroup" class="field-group hidden">
        <label for="frameColorInput">Border Color</label>
        <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
          <input type="color" id="frameColorInput" value="#FAF6EB" />
          <button class="btn-mini frame-swatch" data-color="#FAF6EB" type="button">Butter</button>
          <button class="btn-mini frame-swatch" data-color="#2D8A50" type="button">Leaf</button>
          <button class="btn-mini frame-swatch" data-color="#FFFFFF" type="button">White</button>
          <button class="btn-mini frame-swatch" data-color="#0B0E0C" type="button">Obsidian</button>
        </div>
      </div>
    </div>
  `;

  const overlayLayer = document.getElementById('overlayLayer');
  const rotAngleBadge = container.querySelector('#rotAngleBadge');
  const cropStatusBadge = container.querySelector('#cropStatusBadge');
  const toggleCropEditBtn = container.querySelector('#toggleCropEditBtn');
  const applyCropBtn = container.querySelector('#applyCropBtn');
  const clearCropBtn = container.querySelector('#clearCropBtn');
  const lockAspectBtn = container.querySelector('#lockAspectBtn');
  const resizeWInput = container.querySelector('#resizeWInput');
  const resizeHInput = container.querySelector('#resizeHInput');
  const frameRatioSelect = container.querySelector('#frameRatioSelect');
  const frameModeSelect = container.querySelector('#frameModeSelect');
  const frameColorGroup = container.querySelector('#frameColorGroup');
  const frameColorInput = container.querySelector('#frameColorInput');

  function getBaseDimensions() {
    const bm = studio.engine.fullBitmap;
    if (!bm) return { w: 0, h: 0 };
    const t = studio.engine.state.transform;
    const cw = t.crop ? Math.round(t.crop.w * bm.width) : bm.width;
    const ch = t.crop ? Math.round(t.crop.h * bm.height) : bm.height;
    const swapped = t.rotate === 90 || t.rotate === 270;
    return { w: swapped ? ch : cw, h: swapped ? cw : ch };
  }

  function syncUI() {
    const active = studio.getActiveItem();
    if (!active) {
      overlayLayer.innerHTML = '';
      return;
    }

    const t = studio.engine.state.transform;
    rotAngleBadge.textContent = `${t.rotate}°`;
    cropStatusBadge.textContent = t.crop ? 'Cropped' : 'Full';
    clearCropBtn.classList.toggle('hidden', !t.crop);

    const base = getBaseDimensions();
    resizeWInput.value = t.resize ? t.resize.width : base.w;
    resizeHInput.value = t.resize ? t.resize.height : base.h;

    frameRatioSelect.value = t.frame?.ratio || '';
    frameModeSelect.value = t.frame?.mode || 'blur';
    frameColorInput.value = t.frame?.color || '#FAF6EB';
    frameColorGroup.classList.toggle('hidden', !t.frame || t.frame.mode !== 'color');

    if (cropEditMode) {
      renderCropOverlay();
    } else {
      overlayLayer.innerHTML = '';
    }
  }

  function enforceAspectRatio(box, ratio, stageW, stageH) {
    if (!ratio || !stageW || !stageH) return box;
    const stageAspect = stageW / stageH;
    const normRatio = ratio / stageAspect;

    let w = box.w;
    let h = w / normRatio;
    if (box.y + h > 1) {
      h = 1 - box.y;
      w = h * normRatio;
    }
    if (box.x + w > 1) {
      w = 1 - box.x;
      h = w / normRatio;
    }
    return { x: box.x, y: box.y, w: Math.max(0.05, w), h: Math.max(0.05, h) };
  }

  function renderCropOverlay() {
    if (!cropEditMode || !studio.getActiveItem()) {
      overlayLayer.innerHTML = '';
      return;
    }

    const stageW = studio.displayCanvas.clientWidth;
    const stageH = studio.displayCanvas.clientHeight;
    draftCrop = enforceAspectRatio(draftCrop, selectedRatio, stageW, stageH);

    overlayLayer.innerHTML = `
      <div id="cropBoxEl" style="
        position: absolute;
        left: ${draftCrop.x * 100}%;
        top: ${draftCrop.y * 100}%;
        width: ${draftCrop.w * 100}%;
        height: ${draftCrop.h * 100}%;
        border: 2px solid #F6E6AD;
        box-shadow: 0 0 0 9999px rgba(8, 10, 9, 0.68);
        cursor: move;
        pointer-events: auto;
        touch-action: none;
      ">
        <div style="position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr 1fr; pointer-events:none;">
          <div style="border-right:1px solid rgba(246,230,173,0.35); border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-right:1px solid rgba(246,230,173,0.35); border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-right:1px solid rgba(246,230,173,0.35); border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-right:1px solid rgba(246,230,173,0.35); border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-bottom:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-right:1px solid rgba(246,230,173,0.35);"></div>
          <div style="border-right:1px solid rgba(246,230,173,0.35);"></div>
          <div></div>
        </div>
        <div data-handle="nw" style="position:absolute; top:-6px; left:-6px; width:13px; height:13px; background:#2D8A50; border:2px solid #F6E6AD; border-radius:3px; cursor:nwse-resize;"></div>
        <div data-handle="ne" style="position:absolute; top:-6px; right:-6px; width:13px; height:13px; background:#2D8A50; border:2px solid #F6E6AD; border-radius:3px; cursor:nesw-resize;"></div>
        <div data-handle="sw" style="position:absolute; bottom:-6px; left:-6px; width:13px; height:13px; background:#2D8A50; border:2px solid #F6E6AD; border-radius:3px; cursor:nesw-resize;"></div>
        <div data-handle="se" style="position:absolute; bottom:-6px; right:-6px; width:13px; height:13px; background:#2D8A50; border:2px solid #F6E6AD; border-radius:3px; cursor:nwse-resize;"></div>
      </div>
    `;

    const cropBoxEl = overlayLayer.querySelector('#cropBoxEl');
    let dragMode = null;
    let startX = 0;
    let startY = 0;
    let startBox = null;

    cropBoxEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      dragMode = e.target.dataset.handle || 'move';
      startX = e.clientX;
      startY = e.clientY;
      startBox = { ...draftCrop };
      cropBoxEl.setPointerCapture(e.pointerId);
    });

    cropBoxEl.addEventListener('pointermove', (e) => {
      if (!dragMode || !startBox) return;
      const rect = overlayLayer.getBoundingClientRect();
      const dx = (e.clientX - startX) / rect.width;
      const dy = (e.clientY - startY) / rect.height;

      if (dragMode === 'move') {
        draftCrop.x = Math.max(0, Math.min(1 - startBox.w, startBox.x + dx));
        draftCrop.y = Math.max(0, Math.min(1 - startBox.h, startBox.y + dy));
      } else {
        let { x, y, w, h } = startBox;
        if (dragMode.includes('e')) w = Math.max(0.06, Math.min(1 - x, startBox.w + dx));
        if (dragMode.includes('s')) h = Math.max(0.06, Math.min(1 - y, startBox.h + dy));
        if (dragMode.includes('w')) {
          const maxDx = startBox.w - 0.06;
          const clampedDx = Math.max(-startBox.x, Math.min(maxDx, dx));
          x = startBox.x + clampedDx;
          w = startBox.w - clampedDx;
        }
        if (dragMode.includes('n')) {
          const maxDy = startBox.h - 0.06;
          const clampedDy = Math.max(-startBox.y, Math.min(maxDy, dy));
          y = startBox.y + clampedDy;
          h = startBox.h - clampedDy;
        }
        draftCrop = enforceAspectRatio({ x, y, w, h }, selectedRatio, rect.width, rect.height);
      }

      cropBoxEl.style.left = `${draftCrop.x * 100}%`;
      cropBoxEl.style.top = `${draftCrop.y * 100}%`;
      cropBoxEl.style.width = `${draftCrop.w * 100}%`;
      cropBoxEl.style.height = `${draftCrop.h * 100}%`;
    });

    cropBoxEl.addEventListener('pointerup', () => {
      dragMode = null;
      startBox = null;
    });
  }

  function mapScreenCropToSource(box) {
    const { rotate, flipH, flipV } = studio.engine.state.transform;
    const mapPoint = (u, v) => {
      let x2 = u - 0.5;
      let y2 = v - 0.5;
      let x1 = x2;
      let y1 = y2;

      if (rotate === 90) {
        x1 = y2;
        y1 = -x2;
      } else if (rotate === 180) {
        x1 = -x2;
        y1 = -y2;
      } else if (rotate === 270) {
        x1 = -y2;
        y1 = x2;
      }

      const x0 = flipH ? -x1 : x1;
      const y0 = flipV ? -y1 : y1;
      return { x: x0 + 0.5, y: y0 + 0.5 };
    };

    const p1 = mapPoint(box.x, box.y);
    const p2 = mapPoint(box.x + box.w, box.y + box.h);
    const minX = Math.max(0, Math.min(p1.x, p2.x));
    const minY = Math.max(0, Math.min(p1.y, p2.y));
    const maxX = Math.min(1, Math.max(p1.x, p2.x));
    const maxY = Math.min(1, Math.max(p1.y, p2.y));

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  container.querySelector('#rotLeftBtn').addEventListener('click', () => {
    const next = (studio.engine.state.transform.rotate + 270) % 360;
    studio.engine.updateSection('transform', { rotate: next, resize: null });
    studio.saveCurrentItemState();
  });

  container.querySelector('#rotRightBtn').addEventListener('click', () => {
    const next = (studio.engine.state.transform.rotate + 90) % 360;
    studio.engine.updateSection('transform', { rotate: next, resize: null });
    studio.saveCurrentItemState();
  });

  container.querySelector('#flipHBtn').addEventListener('click', () => {
    studio.engine.updateSection('transform', { flipH: !studio.engine.state.transform.flipH });
    studio.saveCurrentItemState();
  });

  container.querySelector('#flipVBtn').addEventListener('click', () => {
    studio.engine.updateSection('transform', { flipV: !studio.engine.state.transform.flipV });
    studio.saveCurrentItemState();
  });

  container.querySelector('#cropPresetGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.crop-preset-btn');
    if (!btn) return;
    container.querySelectorAll('.crop-preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedRatio = ASPECT_PRESETS[Number(btn.dataset.idx)].ratio;

    if (!cropEditMode && studio.getActiveItem()) {
      cropEditMode = true;
      toggleCropEditBtn.textContent = 'Cancel Crop';
      applyCropBtn.disabled = false;
      studio.engine.updateSection('transform', { crop: null, resize: null });
    }
    renderCropOverlay();
  });

  toggleCropEditBtn.addEventListener('click', () => {
    if (!studio.getActiveItem()) return;
    cropEditMode = !cropEditMode;
    toggleCropEditBtn.textContent = cropEditMode ? 'Cancel Crop' : 'Open Crop Box';
    applyCropBtn.disabled = !cropEditMode;

    if (cropEditMode) {
      draftCrop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
      studio.engine.updateSection('transform', { crop: null, resize: null });
      renderCropOverlay();
    } else {
      overlayLayer.innerHTML = '';
    }
  });

  applyCropBtn.addEventListener('click', () => {
    if (!cropEditMode) return;
    const mapped = mapScreenCropToSource(draftCrop);
    cropEditMode = false;
    toggleCropEditBtn.textContent = 'Open Crop Box';
    applyCropBtn.disabled = true;
    overlayLayer.innerHTML = '';
    studio.engine.updateSection('transform', { crop: mapped, resize: null });
    studio.saveCurrentItemState();
    studio.toast('Crop applied');
  });

  clearCropBtn.addEventListener('click', () => {
    cropEditMode = false;
    toggleCropEditBtn.textContent = 'Open Crop Box';
    applyCropBtn.disabled = true;
    overlayLayer.innerHTML = '';
    studio.engine.updateSection('transform', { crop: null, resize: null });
    studio.saveCurrentItemState();
    studio.toast('Crop cleared');
  });

  lockAspectBtn.addEventListener('click', () => {
    aspectLocked = !aspectLocked;
    lockAspectBtn.innerHTML = aspectLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
    lockAspectBtn.classList.toggle('active', aspectLocked);
  });

  resizeWInput.addEventListener('input', () => {
    const base = getBaseDimensions();
    const w = parseInt(resizeWInput.value, 10);
    if (aspectLocked && base.w > 0 && w > 0) {
      resizeHInput.value = Math.max(1, Math.round((w / base.w) * base.h));
    }
  });

  resizeHInput.addEventListener('input', () => {
    const base = getBaseDimensions();
    const h = parseInt(resizeHInput.value, 10);
    if (aspectLocked && base.h > 0 && h > 0) {
      resizeWInput.value = Math.max(1, Math.round((h / base.h) * base.w));
    }
  });

  container.querySelectorAll('.scale-pct-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const base = getBaseDimensions();
      if (!base.w) return;
      const factor = parseFloat(btn.dataset.scale);
      resizeWInput.value = Math.max(1, Math.round(base.w * factor));
      resizeHInput.value = Math.max(1, Math.round(base.h * factor));
    });
  });

  container.querySelectorAll('.max-edge-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const base = getBaseDimensions();
      if (!base.w) return;
      const maxEdge = parseInt(btn.dataset.edge, 10);
      const scale = maxEdge / Math.max(base.w, base.h);
      resizeWInput.value = Math.max(1, Math.round(base.w * scale));
      resizeHInput.value = Math.max(1, Math.round(base.h * scale));
    });
  });

  container.querySelector('#applyResizeBtn').addEventListener('click', () => {
    const width = parseInt(resizeWInput.value, 10);
    const height = parseInt(resizeHInput.value, 10);
    if (!width || !height) return;
    studio.engine.updateSection('transform', { resize: { width, height } });
    studio.saveCurrentItemState();
    studio.toast(`Resized to ${width} × ${height} px`);
  });

  container.querySelector('#resetResizeBtn').addEventListener('click', () => {
    studio.engine.updateSection('transform', { resize: null });
    studio.saveCurrentItemState();
    studio.toast('Restored native dimensions');
  });

  function updateFrameState() {
    const ratio = frameRatioSelect.value;
    if (!ratio) {
      studio.engine.updateSection('transform', { frame: null });
    } else {
      studio.engine.updateSection('transform', {
        frame: {
          ratio,
          mode: frameModeSelect.value,
          color: frameColorInput.value
        }
      });
    }
    studio.saveCurrentItemState();
  }

  frameRatioSelect.addEventListener('change', updateFrameState);
  frameModeSelect.addEventListener('change', updateFrameState);
  frameColorInput.addEventListener('input', updateFrameState);

  container.querySelectorAll('.frame-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      frameColorInput.value = btn.dataset.color;
      updateFrameState();
    });
  });

  syncUI();
  return { onImageChanged: syncUI };
}
