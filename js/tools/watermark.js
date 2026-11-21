export function mountWatermarkTool(container, studio) {
  let uploadedLogoImg = studio.engine.state.watermark.logoImage || null;

  container.innerHTML = `
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3H5a2 2 0 0 0-2 2v7l8.3 8.3a2.4 2.4 0 0 0 3.4 0l5.6-5.6a2.4 2.4 0 0 0 0-3.4L12 3Z"/>
            <circle cx="7.5" cy="7.5" r="1.2"/>
          </svg>
          <span>Watermark Overlay</span>
        </span>
        <label style="display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.76rem; color:var(--text-primary);">
          <input type="checkbox" id="wmEnableCheck" />
          <span>Active</span>
        </label>
      </div>

      <div class="field-group">
        <label for="wmModeSelect">Watermark Style</label>
        <select id="wmModeSelect" class="input-control">
          <option value="text">Custom Text</option>
          <option value="image">Logo / Stamp Image</option>
          <option value="tiled">Diagonal Tiled Pattern (Proofing)</option>
        </select>
      </div>

      <div id="wmTextGroup" class="field-group">
        <label for="wmTextInput">Watermark Text</label>
        <input type="text" id="wmTextInput" class="input-control" value="© Darkroom" placeholder="e.g. © Mukhiteee / LensGrid" />

        <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.35rem; flex-wrap:wrap;">
          <input type="color" id="wmColorInput" value="#FFFFFF" />
          <button class="btn-mini wm-swatch" data-color="#FFFFFF" type="button">White</button>
          <button class="btn-mini wm-swatch" data-color="#0B0E0C" type="button">Obsidian</button>
          <button class="btn-mini wm-swatch" data-color="#F6E6AD" type="button">Butter</button>
          <button class="btn-mini wm-swatch" data-color="#2D8A50" type="button">Leaf</button>
        </div>
      </div>

      <div id="wmLogoGroup" class="field-group hidden">
        <label>Logo File (Transparent PNG / SVG)</label>
        <div class="row-2">
          <button id="wmUploadLogoBtn" class="btn btn-secondary btn-sm" type="button">Upload Logo</button>
          <button id="wmClearLogoBtn" class="btn btn-ghost btn-sm" type="button">Use Text</button>
        </div>
        <input type="file" id="wmLogoInput" accept="image/png,image/svg+xml,image/webp" hidden />
        <div id="wmLogoStatus" class="stat-box" style="font-size:0.74rem;">No logo uploaded yet.</div>
      </div>
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v4"/>
            <path d="M12 18v4"/>
            <path d="M2 12h4"/>
            <path d="M18 12h4"/>
          </svg>
          <span>Appearance &amp; Position</span>
        </span>
      </div>

      <div id="wmPositionGroup" class="field-group">
        <label for="wmPositionSelect">Anchor Position</label>
        <select id="wmPositionSelect" class="input-control">
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="top-right">Top Right</option>
          <option value="top-left">Top Left</option>
          <option value="center">Center</option>
        </select>
      </div>

      <div class="field-group">
        <div class="field-label-row">
          <label for="wmOpacityRange">Opacity</label>
          <span id="wmOpacityVal" class="badge-butter tabular-nums">55%</span>
        </div>
        <input type="range" id="wmOpacityRange" min="0.1" max="1" step="0.05" value="0.55" />
      </div>

      <div class="field-group">
        <div class="field-label-row">
          <label for="wmScaleRange">Scale / Size</label>
          <span id="wmScaleVal" class="badge-butter tabular-nums">1.0×</span>
        </div>
        <input type="range" id="wmScaleRange" min="0.4" max="2.5" step="0.1" value="1" />
      </div>

      <button id="wmApplyAllBtn" class="btn btn-butter btn-sm btn-full hidden" type="button">
        Apply Watermark to All Queued Images
      </button>
    </div>
  `;

  const wmEnableCheck = container.querySelector('#wmEnableCheck');
  const wmModeSelect = container.querySelector('#wmModeSelect');
  const wmTextGroup = container.querySelector('#wmTextGroup');
  const wmTextInput = container.querySelector('#wmTextInput');
  const wmColorInput = container.querySelector('#wmColorInput');
  const wmLogoGroup = container.querySelector('#wmLogoGroup');
  const wmUploadLogoBtn = container.querySelector('#wmUploadLogoBtn');
  const wmClearLogoBtn = container.querySelector('#wmClearLogoBtn');
  const wmLogoInput = container.querySelector('#wmLogoInput');
  const wmLogoStatus = container.querySelector('#wmLogoStatus');
  const wmPositionGroup = container.querySelector('#wmPositionGroup');
  const wmPositionSelect = container.querySelector('#wmPositionSelect');
  const wmOpacityRange = container.querySelector('#wmOpacityRange');
  const wmOpacityVal = container.querySelector('#wmOpacityVal');
  const wmScaleRange = container.querySelector('#wmScaleRange');
  const wmScaleVal = container.querySelector('#wmScaleVal');
  const wmApplyAllBtn = container.querySelector('#wmApplyAllBtn');

  function syncUI() {
    const wm = studio.engine.state.watermark;
    wmEnableCheck.checked = wm.enabled;
    wmModeSelect.value = wm.mode;
    wmTextInput.value = wm.text;
    wmColorInput.value = wm.color;
    wmPositionSelect.value = wm.position;
    wmOpacityRange.value = wm.opacity;
    wmOpacityVal.textContent = `${Math.round(wm.opacity * 100)}%`;
    wmScaleRange.value = wm.scale;
    wmScaleVal.textContent = `${wm.scale.toFixed(1)}×`;

    const isImageMode = wm.mode === 'image';
    const isTiledMode = wm.mode === 'tiled';
    wmTextGroup.classList.toggle('hidden', isImageMode);
    wmLogoGroup.classList.toggle('hidden', !isImageMode && !isTiledMode);
    wmPositionGroup.classList.toggle('hidden', isTiledMode);
    wmApplyAllBtn.classList.toggle('hidden', studio.items.length < 2);

    if (wm.logoImage) {
      wmLogoStatus.textContent = `Logo loaded (${wm.logoImage.width} × ${wm.logoImage.height} px)`;
    } else {
      wmLogoStatus.textContent = isTiledMode
        ? 'Tiling text (or upload a logo to tile your stamp).'
        : 'No logo uploaded yet.';
    }
  }

  function pushWatermarkUpdate(patch) {
    studio.engine.updateSection('watermark', { enabled: true, ...patch });
    studio.saveCurrentItemState();
    syncUI();
  }

  wmEnableCheck.addEventListener('change', () => {
    studio.engine.updateSection('watermark', { enabled: wmEnableCheck.checked });
    studio.saveCurrentItemState();
  });

  wmModeSelect.addEventListener('change', () => {
    const mode = wmModeSelect.value;
    pushWatermarkUpdate({
      mode,
      logoImage: mode === 'text' ? null : uploadedLogoImg
    });
  });

  wmTextInput.addEventListener('input', () => {
    pushWatermarkUpdate({ text: wmTextInput.value });
  });

  wmColorInput.addEventListener('input', () => {
    pushWatermarkUpdate({ color: wmColorInput.value });
  });

  container.querySelectorAll('.wm-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      wmColorInput.value = btn.dataset.color;
      pushWatermarkUpdate({ color: btn.dataset.color });
    });
  });

  wmUploadLogoBtn.addEventListener('click', () => wmLogoInput.click());

  wmLogoInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      uploadedLogoImg = await studio.decodeFileToBitmap(file);
      pushWatermarkUpdate({ logoImage: uploadedLogoImg });
      studio.toast('Logo stamp loaded');
    } catch {
      studio.toast('Could not load logo image');
    }
    wmLogoInput.value = '';
  });

  wmClearLogoBtn.addEventListener('click', () => {
    uploadedLogoImg = null;
    pushWatermarkUpdate({ logoImage: null });
  });

  wmPositionSelect.addEventListener('change', () => {
    pushWatermarkUpdate({ position: wmPositionSelect.value });
  });

  wmOpacityRange.addEventListener('input', () => {
    pushWatermarkUpdate({ opacity: parseFloat(wmOpacityRange.value) });
  });

  wmScaleRange.addEventListener('input', () => {
    pushWatermarkUpdate({ scale: parseFloat(wmScaleRange.value) });
  });

  wmApplyAllBtn.addEventListener('click', () => {
    const currentWm = { ...studio.engine.state.watermark };
    studio.items.forEach((item) => {
      if (!item.state) item.state = studio.engine.createDefaultState();
      item.state.watermark = { ...currentWm };
    });
    studio.toast(`Applied watermark to ${studio.items.length} images`);
  });

  syncUI();
  return { onImageChanged: syncUI };
}
