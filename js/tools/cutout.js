export function mountCutoutTool(container, studio) {
  let activePointerTool = 'none';
  let polarity = 'remove';
  let wandTolerance = 34;
  let wandContiguous = true;
  let brushSize = 28;
  let maskFeather = 1;

  let maskCanvas = null;
  let maskHistory = [];
  let aiInFlight = false;

  container.innerHTML = `
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9"/>
            <path d="M12 3v18"/>
            <path d="M12 8h6"/>
            <path d="M12 12h9"/>
            <path d="M12 16h6"/>
          </svg>
          <span>Background &amp; Cutout</span>
        </span>
        <span id="cutoutStatusBadge" class="badge-butter">Full</span>
      </div>

      <button id="aiAutoCutoutBtn" class="btn btn-primary btn-full" type="button">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
        </svg>
        <span>AI Auto-Cutout (Cached Offline)</span>
      </button>
      <div id="aiProgressBox" class="stat-box hidden" style="font-size:0.74rem;"></div>

      <div class="row-2">
        <button id="wandToolBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4V2"/>
            <path d="M15 16v-2"/>
            <path d="M8 9h2"/>
            <path d="M20 9h2"/>
            <path d="m17.8 11.8 1.4 1.4"/>
            <path d="m17.8 6.2 1.4-1.4"/>
            <path d="m3 21 9-9"/>
          </svg>
          <span>Magic Wand</span>
        </button>
        <button id="brushToolBtn" class="btn btn-secondary btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/>
            <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>
          </svg>
          <span>Mask Brush</span>
        </button>
      </div>

      <div class="row-2">
        <button id="polarityRemoveBtn" class="btn btn-butter btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Erase Region</span>
        </button>
        <button id="polarityKeepBtn" class="btn btn-ghost btn-sm" type="button">
          <svg class="icon-xs" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>Keep Region</span>
        </button>
      </div>

      <div id="wandOptionsGroup" class="field-group">
        <div class="field-label-row">
          <label for="wandTolRange">Wand Color Tolerance</label>
          <span id="wandTolVal" class="badge-butter tabular-nums">34</span>
        </div>
        <input type="range" id="wandTolRange" min="4" max="120" step="2" value="34" />

        <label style="display:flex; align-items:center; gap:0.45rem; margin-top:0.35rem; cursor:pointer;">
          <input type="checkbox" id="wandContigCheck" checked />
          <span>Contiguous region only (uncheck for global color key)</span>
        </label>
      </div>

      <div id="brushOptionsGroup" class="field-group hidden">
        <div class="field-label-row">
          <label for="brushSizeRange">Brush Diameter</label>
          <span id="brushSizeVal" class="badge-butter tabular-nums">28px</span>
        </div>
        <input type="range" id="brushSizeRange" min="4" max="120" step="2" value="28" />
      </div>

      <div class="field-group">
        <div class="field-label-row">
          <label for="featherRange">Edge Softness / Feather</label>
          <span id="featherVal" class="badge-butter tabular-nums">1px</span>
        </div>
        <input type="range" id="featherRange" min="0" max="10" step="1" value="1" />
      </div>

      <div style="display:flex; gap:0.35rem;">
        <button id="undoMaskBtn" class="btn btn-ghost btn-sm" style="flex:1;" type="button" disabled>Undo</button>
        <button id="invertMaskBtn" class="btn btn-ghost btn-sm" style="flex:1;" type="button">Invert</button>
        <button id="resetMaskBtn" class="btn btn-ghost btn-sm" style="flex:1;" type="button">Reset</button>
      </div>
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="m21 15-5-5L5 21"/>
          </svg>
          <span>Backdrop &amp; Portrait Bokeh</span>
        </span>
      </div>

      <div class="field-group">
        <label for="bgReplaceModeSelect">Backdrop Style</label>
        <select id="bgReplaceModeSelect" class="input-control">
          <option value="transparent">Transparent (PNG / WebP)</option>
          <option value="bokeh">Portrait Bokeh Blur (DSLR Depth)</option>
          <option value="color">Solid Studio Color</option>
          <option value="gradient">Two-Tone Gradient</option>
          <option value="image">Custom Background Image</option>
        </select>
      </div>

      <div id="bgBokehGroup" class="field-group hidden">
        <div class="field-label-row">
          <label for="bokehBlurRange">Background Blur Radius</label>
          <span id="bokehBlurVal" class="badge-butter tabular-nums">18px</span>
        </div>
        <input type="range" id="bokehBlurRange" min="4" max="42" step="2" value="18" />
      </div>

      <div id="bgColorGroup" class="field-group hidden">
        <label for="bgSolidColorInput">Backdrop Color</label>
        <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
          <input type="color" id="bgSolidColorInput" value="#FAF6EB" />
          <button class="btn-mini bg-swatch" data-color="#FAF6EB" type="button">Cream</button>
          <button class="btn-mini bg-swatch" data-color="#F6E6AD" type="button">Butter</button>
          <button class="btn-mini bg-swatch" data-color="#2D8A50" type="button">Leaf</button>
          <button class="btn-mini bg-swatch" data-color="#FFFFFF" type="button">White</button>
          <button class="btn-mini bg-swatch" data-color="#0B0E0C" type="button">Obsidian</button>
        </div>
      </div>

      <div id="bgGradientGroup" class="field-group hidden">
        <div class="row-2">
          <div>
            <label for="bgGradStartInput">Start Color</label>
            <input type="color" id="bgGradStartInput" value="#2D8A50" class="input-control" style="height:34px; padding:2px;" />
          </div>
          <div>
            <label for="bgGradEndInput">End Color</label>
            <input type="color" id="bgGradEndInput" value="#F6E6AD" class="input-control" style="height:34px; padding:2px;" />
          </div>
        </div>
      </div>

      <div id="bgImageGroup" class="field-group hidden">
        <button id="uploadBgImageBtn" class="btn btn-secondary btn-sm btn-full" type="button">
          Choose Replacement Photo
        </button>
        <input type="file" id="bgImageFileInput" accept="image/*" hidden />
      </div>
    </div>
  `;

  const overlayLayer = document.getElementById('overlayLayer');
  const cutoutStatusBadge = container.querySelector('#cutoutStatusBadge');
  const aiAutoCutoutBtn = container.querySelector('#aiAutoCutoutBtn');
  const aiProgressBox = container.querySelector('#aiProgressBox');
  const wandToolBtn = container.querySelector('#wandToolBtn');
  const brushToolBtn = container.querySelector('#brushToolBtn');
  const polarityRemoveBtn = container.querySelector('#polarityRemoveBtn');
  const polarityKeepBtn = container.querySelector('#polarityKeepBtn');
  const wandOptionsGroup = container.querySelector('#wandOptionsGroup');
  const wandTolRange = container.querySelector('#wandTolRange');
  const wandTolVal = container.querySelector('#wandTolVal');
  const wandContigCheck = container.querySelector('#wandContigCheck');
  const brushOptionsGroup = container.querySelector('#brushOptionsGroup');
  const brushSizeRange = container.querySelector('#brushSizeRange');
  const brushSizeVal = container.querySelector('#brushSizeVal');
  const featherRange = container.querySelector('#featherRange');
  const featherVal = container.querySelector('#featherVal');
  const undoMaskBtn = container.querySelector('#undoMaskBtn');
  const invertMaskBtn = container.querySelector('#invertMaskBtn');
  const resetMaskBtn = container.querySelector('#resetMaskBtn');

  const bgReplaceModeSelect = container.querySelector('#bgReplaceModeSelect');
  const bgBokehGroup = container.querySelector('#bgBokehGroup');
  const bokehBlurRange = container.querySelector('#bokehBlurRange');
  const bokehBlurVal = container.querySelector('#bokehBlurVal');
  const bgColorGroup = container.querySelector('#bgColorGroup');
  const bgSolidColorInput = container.querySelector('#bgSolidColorInput');
  const bgGradientGroup = container.querySelector('#bgGradientGroup');
  const bgGradStartInput = container.querySelector('#bgGradStartInput');
  const bgGradEndInput = container.querySelector('#bgGradEndInput');
  const bgImageGroup = container.querySelector('#bgImageGroup');
  const uploadBgImageBtn = container.querySelector('#uploadBgImageBtn');
  const bgImageFileInput = container.querySelector('#bgImageFileInput');

  function ensureMaskCanvas() {
    const bm = studio.engine.fullBitmap;
    if (!bm) return null;

    const existing =
      studio.engine.state.cutout?.maskCanvas || studio.engine.state.cutout?.mask || maskCanvas;

    if (existing && existing.width === bm.width && existing.height === bm.height) {
      maskCanvas = existing;
      return maskCanvas;
    }

    const c = document.createElement('canvas');
    c.width = bm.width;
    c.height = bm.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    maskCanvas = c;
    maskHistory = [];
    return maskCanvas;
  }

  function pushMaskSnapshot() {
    const c = ensureMaskCanvas();
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    maskHistory.push(ctx.getImageData(0, 0, c.width, c.height));
    if (maskHistory.length > 10) maskHistory.shift();
    undoMaskBtn.disabled = false;
  }

  function commitMaskToEngine(enabled = true) {
    const c = ensureMaskCanvas();
    if (!c) return;
    studio.engine.updateSection('cutout', {
      enabled,
      maskCanvas: c,
      mask: c,
      feather: maskFeather
    });
    studio.saveCurrentItemState();
    cutoutStatusBadge.textContent = enabled ? 'Masked' : 'Full';
  }

  function applyMagicWandAt(normX, normY) {
    const bm = studio.engine.fullBitmap;
    const mCanvas = ensureMaskCanvas();
    if (!bm || !mCanvas) return;

    pushMaskSnapshot();

    const w = bm.width;
    const h = bm.height;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const sCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sCtx.drawImage(bm, 0, 0);
    const srcData = sCtx.getImageData(0, 0, w, h).data;

    const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
    const maskImg = mCtx.getImageData(0, 0, w, h);
    const mData = maskImg.data;

    const seedX = Math.max(0, Math.min(w - 1, Math.floor(normX * w)));
    const seedY = Math.max(0, Math.min(h - 1, Math.floor(normY * h)));
    const seedIdx = (seedY * w + seedX) * 4;
    const sr = srcData[seedIdx];
    const sg = srcData[seedIdx + 1];
    const sb = srcData[seedIdx + 2];

    const maxDistSq = (wandTolerance * 2.2) ** 2;
    const targetVal = polarity === 'remove' ? 0 : 255;

    function matchesColor(pxOffset) {
      const dr = srcData[pxOffset] - sr;
      const dg = srcData[pxOffset + 1] - sg;
      const db = srcData[pxOffset + 2] - sb;
      return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 <= maxDistSq;
    }

    if (!wandContiguous) {
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        if (matchesColor(p)) {
          mData[p] = targetVal;
          mData[p + 1] = targetVal;
          mData[p + 2] = targetVal;
          mData[p + 3] = 255;
        }
      }
    } else {
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const startFlat = seedY * w + seedX;
      visited[startFlat] = 1;
      queue[tail++] = startFlat;

      while (head < tail) {
        const curr = queue[head++];
        const p = curr * 4;
        mData[p] = targetVal;
        mData[p + 1] = targetVal;
        mData[p + 2] = targetVal;
        mData[p + 3] = 255;

        const cx = curr % w;
        const cy = (curr - cx) / w;

        const neighbors = [];
        if (cx > 0) neighbors.push(curr - 1);
        if (cx < w - 1) neighbors.push(curr + 1);
        if (cy > 0) neighbors.push(curr - w);
        if (cy < h - 1) neighbors.push(curr + w);

        for (let n = 0; n < neighbors.length; n++) {
          const nb = neighbors[n];
          if (!visited[nb]) {
            visited[nb] = 1;
            if (matchesColor(nb * 4)) {
              queue[tail++] = nb;
            }
          }
        }
      }
    }

    mCtx.putImageData(maskImg, 0, 0);
    commitMaskToEngine(true);
    studio.toast(polarity === 'remove' ? 'Removed sampled region' : 'Restored sampled region');
  }

  function paintMaskStroke(normX1, normY1, normX2, normY2) {
    const mCanvas = ensureMaskCanvas();
    if (!mCanvas) return;

    const ctx = mCanvas.getContext('2d');
    const stageW = studio.displayCanvas.clientWidth || mCanvas.width;
    const scaleFactor = mCanvas.width / stageW;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, brushSize * scaleFactor);
    ctx.strokeStyle = polarity === 'remove' ? '#000000' : '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(normX1 * mCanvas.width, normY1 * mCanvas.height);
    ctx.lineTo(normX2 * mCanvas.width, normY2 * mCanvas.height);
    ctx.stroke();
    ctx.restore();
  }

  function renderCutoutOverlay() {
    if (activePointerTool === 'none' || !studio.getActiveItem()) {
      overlayLayer.innerHTML = '';
      return;
    }

    overlayLayer.innerHTML = `
      <div id="cutoutStageSurface" style="
        position:absolute; inset:0; cursor:${activePointerTool === 'wand' ? 'crosshair' : 'none'};
        pointer-events:auto; touch-action:none;
      ">
        <div id="brushRingCursor" style="
          position:absolute; width:${brushSize}px; height:${brushSize}px;
          border-radius:50%; border:2px solid ${polarity === 'remove' ? '#F6E6AD' : '#3BB268'};
          background:rgba(45, 138, 80, 0.18); transform:translate(-50%, -50%);
          pointer-events:none; display:${activePointerTool === 'brush' ? 'block' : 'none'};
        "></div>
      </div>
    `;

    const surface = overlayLayer.querySelector('#cutoutStageSurface');
    const ring = overlayLayer.querySelector('#brushRingCursor');
    let painting = false;
    let lastNorm = null;

    surface.addEventListener('pointermove', (e) => {
      const rect = surface.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      if (activePointerTool === 'brush') {
        ring.style.left = `${px}px`;
        ring.style.top = `${py}px`;
      }

      if (painting && activePointerTool === 'brush' && lastNorm) {
        const nextNorm = {
          x: Math.max(0, Math.min(1, px / rect.width)),
          y: Math.max(0, Math.min(1, py / rect.height))
        };
        paintMaskStroke(lastNorm.x, lastNorm.y, nextNorm.x, nextNorm.y);
        lastNorm = nextNorm;
        commitMaskToEngine(true);
      }
    });

    surface.addEventListener('pointerdown', (e) => {
      const rect = surface.getBoundingClientRect();
      const norm = {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      };

      if (activePointerTool === 'wand') {
        applyMagicWandAt(norm.x, norm.y);
      } else if (activePointerTool === 'brush') {
        pushMaskSnapshot();
        painting = true;
        lastNorm = norm;
        paintMaskStroke(norm.x, norm.y, norm.x, norm.y);
        commitMaskToEngine(true);
        surface.setPointerCapture(e.pointerId);
      }
    });

    surface.addEventListener('pointerup', () => {
      painting = false;
      lastNorm = null;
    });
  }

  aiAutoCutoutBtn.addEventListener('click', async () => {
    const active = studio.getActiveItem();
    if (!active || aiInFlight) return;

    aiInFlight = true;
    aiAutoCutoutBtn.disabled = true;
    aiProgressBox.classList.remove('hidden');
    aiProgressBox.textContent = 'Loading offline AI segmentation engine (cached after 1st run)...';

    try {
      const { removeBackground } = await import(
        'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm'
      );

      aiProgressBox.textContent = 'Segmenting subject locally on device...';
      const resultBlob = await removeBackground(active.file, {
        progress: (key, current, total) => {
          if (total > 0) {
            const pct = Math.min(100, Math.round((current / total) * 100));
            aiProgressBox.textContent = `AI Model (${key}): ${pct}%`;
          }
        }
      });

      const cutBitmap = await createImageBitmap(resultBlob);
      const mCanvas = ensureMaskCanvas();
      pushMaskSnapshot();

      const temp = document.createElement('canvas');
      temp.width = mCanvas.width;
      temp.height = mCanvas.height;
      const tCtx = temp.getContext('2d', { willReadFrequently: true });
      tCtx.drawImage(cutBitmap, 0, 0, temp.width, temp.height);
      const imgData = tCtx.getImageData(0, 0, temp.width, temp.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const alpha = d[i + 3];
        d[i] = alpha;
        d[i + 1] = alpha;
        d[i + 2] = alpha;
        d[i + 3] = 255;
      }

      mCanvas.getContext('2d').putImageData(imgData, 0, 0);
      commitMaskToEngine(true);
      aiProgressBox.textContent = 'AI cutout complete — refine edges anytime with Wand or Brush.';
      studio.toast('AI background removed');
    } catch {
      aiProgressBox.textContent =
        'Offline without cached AI weights — use Magic Wand & Mask Brush above (0 KB, 100% offline).';
      studio.toast('AI model unavailable offline; use Magic Wand');
    } finally {
      aiInFlight = false;
      aiAutoCutoutBtn.disabled = false;
    }
  });

  function setPointerTool(tool) {
    activePointerTool = activePointerTool === tool ? 'none' : tool;
    wandToolBtn.className =
      activePointerTool === 'wand' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    brushToolBtn.className =
      activePointerTool === 'brush' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    wandOptionsGroup.classList.toggle('hidden', activePointerTool === 'brush');
    brushOptionsGroup.classList.toggle('hidden', activePointerTool !== 'brush');
    renderCutoutOverlay();
  }

  wandToolBtn.addEventListener('click', () => setPointerTool('wand'));
  brushToolBtn.addEventListener('click', () => setPointerTool('brush'));

  polarityRemoveBtn.addEventListener('click', () => {
    polarity = 'remove';
    polarityRemoveBtn.className = 'btn btn-butter btn-sm';
    polarityKeepBtn.className = 'btn btn-ghost btn-sm';
    if (activePointerTool !== 'none') renderCutoutOverlay();
  });

  polarityKeepBtn.addEventListener('click', () => {
    polarity = 'keep';
    polarityKeepBtn.className = 'btn btn-butter btn-sm';
    polarityRemoveBtn.className = 'btn btn-ghost btn-sm';
    if (activePointerTool !== 'none') renderCutoutOverlay();
  });

  wandTolRange.addEventListener('input', () => {
    wandTolerance = parseInt(wandTolRange.value, 10);
    wandTolVal.textContent = wandTolerance;
  });

  wandContigCheck.addEventListener('change', () => {
    wandContiguous = wandContigCheck.checked;
  });

  brushSizeRange.addEventListener('input', () => {
    brushSize = parseInt(brushSizeRange.value, 10);
    brushSizeVal.textContent = `${brushSize}px`;
    if (activePointerTool === 'brush') renderCutoutOverlay();
  });

  featherRange.addEventListener('input', () => {
    maskFeather = parseInt(featherRange.value, 10);
    featherVal.textContent = `${maskFeather}px`;
    if (studio.engine.state.cutout?.enabled) {
      commitMaskToEngine(true);
    }
  });

  undoMaskBtn.addEventListener('click', () => {
    if (!maskHistory.length || !maskCanvas) return;
    const prev = maskHistory.pop();
    maskCanvas.getContext('2d').putImageData(prev, 0, 0);
    undoMaskBtn.disabled = maskHistory.length === 0;
    commitMaskToEngine(true);
  });

  invertMaskBtn.addEventListener('click', () => {
    const c = ensureMaskCanvas();
    if (!c) return;
    pushMaskSnapshot();
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 255 - img.data[i];
      img.data[i + 1] = 255 - img.data[i + 1];
      img.data[i + 2] = 255 - img.data[i + 2];
    }
    ctx.putImageData(img, 0, 0);
    commitMaskToEngine(true);
    studio.toast('Inverted cutout mask');
  });

  resetMaskBtn.addEventListener('click', () => {
    maskCanvas = null;
    maskHistory = [];
    undoMaskBtn.disabled = true;
    studio.engine.updateSection('cutout', { enabled: false, maskCanvas: null, mask: null });
    studio.saveCurrentItemState();
    cutoutStatusBadge.textContent = 'Full';
    studio.toast('Cutout mask cleared');
  });

  function syncBackdropGroups() {
    const mode = bgReplaceModeSelect.value;
    bgBokehGroup.classList.toggle('hidden', mode !== 'bokeh');
    bgColorGroup.classList.toggle('hidden', mode !== 'color');
    bgGradientGroup.classList.toggle('hidden', mode !== 'gradient');
    bgImageGroup.classList.toggle('hidden', mode !== 'image');
  }

  bgReplaceModeSelect.addEventListener('change', () => {
    syncBackdropGroups();
    studio.engine.updateSection('cutout', {
      bgMode: bgReplaceModeSelect.value,
      bgColor: bgSolidColorInput.value,
      bgGradient: [bgGradStartInput.value, bgGradEndInput.value],
      bokehBlur: parseInt(bokehBlurRange.value, 10)
    });
    studio.saveCurrentItemState();
  });

  bokehBlurRange.addEventListener('input', () => {
    const val = parseInt(bokehBlurRange.value, 10);
    bokehBlurVal.textContent = `${val}px`;
    studio.engine.updateSection('cutout', { bokehBlur: val });
    studio.saveCurrentItemState();
  });

  bgSolidColorInput.addEventListener('input', () => {
    studio.engine.updateSection('cutout', { bgColor: bgSolidColorInput.value });
    studio.saveCurrentItemState();
  });

  container.querySelectorAll('.bg-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      bgSolidColorInput.value = btn.dataset.color;
      studio.engine.updateSection('cutout', { bgColor: btn.dataset.color });
      studio.saveCurrentItemState();
    });
  });

  function updateGradient() {
    studio.engine.updateSection('cutout', {
      bgGradient: [bgGradStartInput.value, bgGradEndInput.value]
    });
    studio.saveCurrentItemState();
  }

  bgGradStartInput.addEventListener('input', updateGradient);
  bgGradEndInput.addEventListener('input', updateGradient);

  uploadBgImageBtn.addEventListener('click', () => bgImageFileInput.click());

  bgImageFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bgBitmap = await studio.decodeFileToBitmap(file);
      studio.engine.updateSection('cutout', { bgMode: 'image', bgImage: bgBitmap });
      studio.saveCurrentItemState();
      studio.toast('Custom backdrop applied');
    } catch {
      studio.toast('Failed to load background image');
    }
    bgImageFileInput.value = '';
  });

  function onImageChanged() {
    maskCanvas = null;
    maskHistory = [];
    undoMaskBtn.disabled = true;
    const cut = studio.engine.state.cutout || {};
    cutoutStatusBadge.textContent = cut.enabled ? 'Masked' : 'Full';
    bgReplaceModeSelect.value = cut.bgMode || 'transparent';
    syncBackdropGroups();
    if (activePointerTool !== 'none') renderCutoutOverlay();
  }

  onImageChanged();
  return { onImageChanged };
}
