const COLOR_PRESETS = [
  { name: 'Natural', values: { brightness: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, vignette: 0 } },
  { name: 'Warm Butter', values: { brightness: 6, contrast: 10, saturation: 8, warmth: 28, hue: 0, vignette: 18 } },
  { name: 'Botanical Crisp', values: { brightness: 4, contrast: 16, saturation: 14, warmth: -12, hue: 4, vignette: 10 } },
  { name: 'Matte Film', values: { brightness: 8, contrast: -14, saturation: -18, warmth: 14, hue: 0, vignette: 26 } },
  { name: 'Monochrome', values: { brightness: 4, contrast: 28, saturation: -100, warmth: 0, hue: 0, vignette: 22 } },
  { name: 'Vivid Pop', values: { brightness: 5, contrast: 22, saturation: 34, warmth: 6, hue: 0, vignette: 0 } }
];

export function mountColorRedactTool(container, studio) {
  const defaultState = studio.engine.createDefaultState();
  const adjKey = 'adjustments' in defaultState ? 'adjustments' : 'color';
  const baseAdj = defaultState[adjKey] || {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    hue: 0,
    vignette: 0
  };
  const isHundredBase = baseAdj.brightness === 100;

  let drawRedactMode = false;
  let redactStyle = 'pixelate';
  let redactStrength = 18;

  container.innerHTML = `
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 3v18"/>
            <path d="M12 12 18.4 5.6"/>
          </svg>
          <span>Studio Presets</span>
        </span>
        <button id="resetColorBtn" class="btn-mini" type="button">Reset</button>
      </div>
      <div id="colorPresetGrid" class="chip-grid">
        ${COLOR_PRESETS.map(
          (p, idx) =>
            `<button class="btn-mini color-preset-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" type="button">${p.name}</button>`
        ).join('')}
      </div>
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
            <circle cx="9" cy="6" r="2" fill="currentColor"/>
            <circle cx="15" cy="12" r="2" fill="currentColor"/>
            <circle cx="11" cy="18" r="2" fill="currentColor"/>
          </svg>
          <span>Light &amp; Color Grading</span>
        </span>
      </div>

      ${[
        { id: 'brightness', label: 'Brightness', min: -100, max: 100, unit: '' },
        { id: 'contrast', label: 'Contrast', min: -100, max: 100, unit: '' },
        { id: 'saturation', label: 'Saturation', min: -100, max: 100, unit: '' },
        { id: 'warmth', label: 'Warmth / Temp', min: -100, max: 100, unit: '' },
        { id: 'hue', label: 'Hue Shift', min: -180, max: 180, unit: '°' },
        { id: 'vignette', label: 'Vignette', min: 0, max: 100, unit: '%' }
      ]
        .map(
          (s) => `
        <div class="field-group">
          <div class="field-label-row">
            <label for="grade_${s.id}">${s.label}</label>
            <span id="val_${s.id}" class="badge-butter tabular-nums">0${s.unit}</span>
          </div>
          <input type="range" id="grade_${s.id}" data-key="${s.id}" data-unit="${s.unit}" min="${s.min}" max="${s.max}" step="1" value="0" />
        </div>
      `
        )
        .join('')}
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m2 22 1-1h3l9-9"/>
            <path d="M3 21v-3l9-9"/>
            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>
          </svg>
          <span>Dominant Palette</span>
        </span>
        <button id="copyAllHexBtn" class="btn-mini" type="button">Copy All</button>
      </div>
      <div id="paletteSwatches" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.42rem;">
        <div class="stat-box" style="grid-column:1 / -1;">Load an image to extract HEX palette.</div>
      </div>
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M8 10h8"/>
            <path d="M8 14h5"/>
          </svg>
          <span>Privacy Redaction</span>
        </span>
        <span id="redactCountBadge" class="badge-butter tabular-nums">0 boxes</span>
      </div>

      <div class="row-2">
        <div class="field-group">
          <label for="redactModeSelect">Redaction Style</label>
          <select id="redactModeSelect" class="input-control">
            <option value="pixelate">Mosaic Pixelate</option>
            <option value="blur">Gaussian Blur</option>
            <option value="solid">Solid Censor Bar</option>
          </select>
        </div>

        <div class="field-group">
          <div class="field-label-row">
            <label for="redactStrengthRange">Intensity</label>
            <span id="redactStrengthVal" class="badge-butter tabular-nums">18px</span>
          </div>
          <input type="range" id="redactStrengthRange" min="6" max="48" step="2" value="18" />
        </div>
      </div>

      <button id="toggleRedactDrawBtn" class="btn btn-secondary btn-sm btn-full" type="button">
        Enable Drag-to-Redact on Canvas
      </button>

      <div class="row-2">
        <button id="undoRedactBtn" class="btn btn-ghost btn-sm" type="button" disabled>Undo Last</button>
        <button id="clearRedactBtn" class="btn btn-ghost btn-sm" type="button" disabled>Clear All</button>
      </div>
    </div>
  `;

  const overlayLayer = document.getElementById('overlayLayer');
  const paletteSwatches = container.querySelector('#paletteSwatches');
  const copyAllHexBtn = container.querySelector('#copyAllHexBtn');
  const redactCountBadge = container.querySelector('#redactCountBadge');
  const redactModeSelect = container.querySelector('#redactModeSelect');
  const redactStrengthRange = container.querySelector('#redactStrengthRange');
  const redactStrengthVal = container.querySelector('#redactStrengthVal');
  const toggleRedactDrawBtn = container.querySelector('#toggleRedactDrawBtn');
  const undoRedactBtn = container.querySelector('#undoRedactBtn');
  const clearRedactBtn = container.querySelector('#clearRedactBtn');

  let extractedHexList = [];

  function toEngineVal(key, sliderVal) {
    if (isHundredBase && (key === 'brightness' || key === 'contrast' || key === 'saturation')) {
      return 100 + sliderVal;
    }
    return sliderVal;
  }

  function fromEngineVal(key, engineVal) {
    if (isHundredBase && (key === 'brightness' || key === 'contrast' || key === 'saturation')) {
      return (engineVal ?? 100) - 100;
    }
    return engineVal ?? 0;
  }

  function getRedactBoxes() {
    const st = studio.engine.state;
    if (Array.isArray(st.redactions)) return st.redactions;
    if (st.redact && Array.isArray(st.redact.boxes)) return st.redact.boxes;
    return [];
  }

  function setRedactBoxes(boxes) {
    const st = studio.engine.state;
    if ('redactions' in st) {
      studio.engine.updateSection('redactions', boxes);
    } else {
      studio.engine.updateSection('redact', { boxes });
    }
    studio.saveCurrentItemState();
    syncRedactUI();
  }

  function syncGradingUI() {
    const currentAdj = studio.engine.state[adjKey] || baseAdj;
    ['brightness', 'contrast', 'saturation', 'warmth', 'hue', 'vignette'].forEach((key) => {
      const input = container.querySelector(`#grade_${key}`);
      const badge = container.querySelector(`#val_${key}`);
      const val = Math.round(fromEngineVal(key, currentAdj[key]));
      input.value = val;
      badge.textContent = `${val > 0 && key !== 'vignette' ? '+' : ''}${val}${input.dataset.unit}`;
    });
  }

  function syncRedactUI() {
    const boxes = getRedactBoxes();
    redactCountBadge.textContent = `${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'}`;
    undoRedactBtn.disabled = boxes.length === 0;
    clearRedactBtn.disabled = boxes.length === 0;
  }

  function extractDominantPalette(bitmap, colorCount = 6) {
    const sampleCanvas = document.createElement('canvas');
    const maxDim = 96;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    sampleCanvas.width = Math.max(1, Math.round(bitmap.width * scale));
    sampleCanvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = sampleCanvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, sampleCanvas.width, sampleCanvas.height);

    const { data } = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (!pixels.length) return [];

    function channelRange(bucket) {
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const [r, g, b] of bucket) {
        if (r < rMin) rMin = r; if (r > rMax) rMax = r;
        if (g < gMin) gMin = g; if (g > gMax) gMax = g;
        if (b < bMin) bMin = b; if (b > bMax) bMax = b;
      }
      const ranges = [rMax - rMin, gMax - gMin, bMax - bMin];
      const maxRange = Math.max(...ranges);
      return { channel: ranges.indexOf(maxRange), range: maxRange };
    }

    let buckets = [pixels];
    while (buckets.length < colorCount) {
      let bestIdx = -1;
      let widest = -1;
      let splitCh = 0;

      buckets.forEach((b, idx) => {
        if (b.length < 2) return;
        const { channel, range } = channelRange(b);
        if (range > widest) {
          widest = range;
          bestIdx = idx;
          splitCh = channel;
        }
      });

      if (bestIdx === -1 || widest === 0) break;
      const target = buckets[bestIdx].slice().sort((a, b) => a[splitCh] - b[splitCh]);
      const mid = Math.floor(target.length / 2);
      buckets.splice(bestIdx, 1, target.slice(0, mid), target.slice(mid));
    }

    const totalPx = pixels.length;
    return buckets
      .map((bucket) => {
        let rSum = 0, gSum = 0, bSum = 0;
        for (const [r, g, b] of bucket) {
          rSum += r;
          gSum += g;
          bSum += b;
        }
        const n = bucket.length || 1;
        const r = Math.round(rSum / n);
        const g = Math.round(gSum / n);
        const b = Math.round(bSum / n);
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
        const pct = Math.max(1, Math.round((bucket.length / totalPx) * 100));
        return { hex, pct, r, g, b };
      })
      .sort((a, b) => b.pct - a.pct);
  }

  function renderPaletteUI() {
    const active = studio.getActiveItem();
    if (!active || !studio.engine.fullBitmap) {
      extractedHexList = [];
      paletteSwatches.innerHTML = `<div class="stat-box" style="grid-column:1 / -1;">Load an image to extract HEX palette.</div>`;
      return;
    }

    const swatches = extractDominantPalette(studio.engine.fullBitmap, 6);
    extractedHexList = swatches.map((s) => s.hex);

    paletteSwatches.innerHTML = swatches
      .map(
        (s) => `
        <button class="palette-chip" data-hex="${s.hex}" type="button" title="Copy ${s.hex}">
          <span style="width:100%; height:24px; border-radius:5px; background:${s.hex}; border:1px solid rgba(255,255,255,0.16);"></span>
          <span class="tabular-nums" style="font-size:0.72rem; font-weight:700;">${s.hex}</span>
          <span class="tabular-nums" style="font-size:0.65rem; color:var(--text-secondary);">${s.pct}%</span>
        </button>
      `
      )
      .join('');
  }

  function renderRedactOverlay() {
    if (!drawRedactMode || !studio.getActiveItem()) {
      overlayLayer.innerHTML = '';
      return;
    }

    overlayLayer.innerHTML = `
      <div id="redactDrawSurface" style="
        position:absolute; inset:0; cursor:crosshair; pointer-events:auto; touch-action:none;
      ">
        <div id="redactDraftBox" style="
          position:absolute; display:none; border:2px dashed #F6E6AD;
          background:rgba(45, 138, 80, 0.28); pointer-events:none;
        "></div>
      </div>
    `;

    const surface = overlayLayer.querySelector('#redactDrawSurface');
    const draftEl = overlayLayer.querySelector('#redactDraftBox');
    let startNorm = null;
    let currentRect = null;

    surface.addEventListener('pointerdown', (e) => {
      const rect = surface.getBoundingClientRect();
      startNorm = {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      };
      currentRect = { x: startNorm.x, y: startNorm.y, w: 0, h: 0 };
      draftEl.style.display = 'block';
      surface.setPointerCapture(e.pointerId);
    });

    surface.addEventListener('pointermove', (e) => {
      if (!startNorm) return;
      const rect = surface.getBoundingClientRect();
      const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      currentRect = {
        x: Math.min(startNorm.x, curX),
        y: Math.min(startNorm.y, curY),
        w: Math.abs(curX - startNorm.x),
        h: Math.abs(curY - startNorm.y)
      };

      draftEl.style.left = `${currentRect.x * 100}%`;
      draftEl.style.top = `${currentRect.y * 100}%`;
      draftEl.style.width = `${currentRect.w * 100}%`;
      draftEl.style.height = `${currentRect.h * 100}%`;
    });

    surface.addEventListener('pointerup', () => {
      draftEl.style.display = 'none';
      if (currentRect && currentRect.w > 0.012 && currentRect.h > 0.012) {
        const nextBoxes = [
          ...getRedactBoxes(),
          {
            mode: redactStyle,
            strength: redactStrength,
            x: currentRect.x,
            y: currentRect.y,
            w: currentRect.w,
            h: currentRect.h
          }
        ];
        setRedactBoxes(nextBoxes);
        studio.toast(`Added ${redactStyle} redaction`);
      }
      startNorm = null;
      currentRect = null;
    });
  }

  container.querySelector('#colorPresetGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-preset-btn');
    if (!btn) return;
    container.querySelectorAll('.color-preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const preset = COLOR_PRESETS[Number(btn.dataset.idx)];
    const patch = {};
    Object.entries(preset.values).forEach(([k, v]) => {
      patch[k] = toEngineVal(k, v);
    });
    studio.engine.updateSection(adjKey, patch);
    studio.saveCurrentItemState();
    syncGradingUI();
  });

  container.querySelectorAll('input[id^="grade_"]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.key;
      const raw = parseInt(slider.value, 10);
      container.querySelector(`#val_${key}`).textContent =
        `${raw > 0 && key !== 'vignette' ? '+' : ''}${raw}${slider.dataset.unit}`;

      studio.engine.updateSection(adjKey, { [key]: toEngineVal(key, raw) });
      studio.saveCurrentItemState();
    });
  });

  container.querySelector('#resetColorBtn').addEventListener('click', () => {
    studio.engine.updateSection(adjKey, { ...baseAdj });
    studio.saveCurrentItemState();
    container.querySelectorAll('.color-preset-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    syncGradingUI();
    studio.toast('Color grading reset');
  });

  paletteSwatches.addEventListener('click', async (e) => {
    const chip = e.target.closest('.palette-chip');
    if (!chip) return;
    await navigator.clipboard.writeText(chip.dataset.hex);
    studio.toast(`Copied ${chip.dataset.hex}`);
  });

  copyAllHexBtn.addEventListener('click', async () => {
    if (!extractedHexList.length) return;
    await navigator.clipboard.writeText(extractedHexList.join(', '));
    studio.toast(`Copied ${extractedHexList.length} HEX codes`);
  });

  redactModeSelect.addEventListener('change', () => {
    redactStyle = redactModeSelect.value;
  });

  redactStrengthRange.addEventListener('input', () => {
    redactStrength = parseInt(redactStrengthRange.value, 10);
    redactStrengthVal.textContent = `${redactStrength}px`;
  });

  toggleRedactDrawBtn.addEventListener('click', () => {
    if (!studio.getActiveItem()) return;
    drawRedactMode = !drawRedactMode;
    toggleRedactDrawBtn.textContent = drawRedactMode
      ? 'Stop Redacting (Done)'
      : 'Enable Drag-to-Redact on Canvas';
    toggleRedactDrawBtn.className = drawRedactMode
      ? 'btn btn-primary btn-sm btn-full'
      : 'btn btn-secondary btn-sm btn-full';
    renderRedactOverlay();
  });

  undoRedactBtn.addEventListener('click', () => {
    const boxes = getRedactBoxes();
    if (!boxes.length) return;
    setRedactBoxes(boxes.slice(0, -1));
  });

  clearRedactBtn.addEventListener('click', () => {
    setRedactBoxes([]);
    studio.toast('Cleared all redactions');
  });

  function onImageChanged() {
    syncGradingUI();
    syncRedactUI();
    renderPaletteUI();
    if (drawRedactMode) renderRedactOverlay();
  }

  onImageChanged();
  return { onImageChanged };
}
