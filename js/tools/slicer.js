import {
  downloadAsZip,
  getExtensionForMime,
  stripExtension,
  triggerBlobDownload
} from '../core/exporter.js';

export function mountSlicerTool(container, studio) {
  let mode = 'carousel';
  let rows = 1;
  let cols = 3;
  let reverseOrder = false;

  container.innerHTML = `
    <!-- Mode & Grid Controls -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2"/>
            <path d="M9 4v16"/>
            <path d="M15 4v16"/>
          </svg>
          <span>Slice Layout</span>
        </span>
        <span id="sliceCountBadge" class="badge-butter tabular-nums">3 slices</span>
      </div>

      <div class="row-2">
        <button id="modeCarouselBtn" class="btn btn-primary btn-sm" type="button">Carousel</button>
        <button id="modeGridBtn" class="btn btn-secondary btn-sm" type="button">Grid Cut</button>
      </div>

      <div id="carouselControls" class="field-group">
        <div class="field-label-row">
          <label for="carouselSlidesRange">Number of Slides</label>
          <span id="carouselSlidesVal" class="badge-butter tabular-nums">3</span>
        </div>
        <input type="range" id="carouselSlidesRange" min="2" max="10" step="1" value="3" />

        <label style="margin-top:0.35rem;">Auto-Calculate Slides from Ratio</label>
        <div class="chip-grid">
          <button class="btn-mini auto-slide-btn" data-ratio="0.8" type="button">4:5 IG Portrait</button>
          <button class="btn-mini auto-slide-btn" data-ratio="1" type="button">1:1 Square</button>
          <button class="btn-mini auto-slide-btn" data-ratio="0.5625" type="button">9:16 Story</button>
        </div>
      </div>

      <div id="gridControls" class="field-group hidden">
        <div class="row-2">
          <div class="field-group">
            <label for="gridRowsInput">Rows</label>
            <input type="number" id="gridRowsInput" class="input-control tabular-nums" value="3" min="1" max="12" />
          </div>
          <div class="field-group">
            <label for="gridColsInput">Columns</label>
            <input type="number" id="gridColsInput" class="input-control tabular-nums" value="3" min="1" max="12" />
          </div>
        </div>

        <label style="margin-top:0.35rem;">Grid Presets</label>
        <div class="chip-grid">
          <button class="btn-mini grid-preset-btn" data-r="3" data-c="3" type="button">3×3 IG Profile</button>
          <button class="btn-mini grid-preset-btn" data-r="3" data-c="2" type="button">3×2</button>
          <button class="btn-mini grid-preset-btn" data-r="1" data-c="3" type="button">1×3 Banner</button>
          <button class="btn-mini grid-preset-btn" data-r="2" data-c="2" type="button">2×2</button>
        </div>

        <label style="display:flex; align-items:center; gap:0.45rem; margin-top:0.4rem; cursor:pointer;">
          <input type="checkbox" id="reverseOrderCheck" />
          <span>Reverse numbering (IG bottom-to-top post order)</span>
        </label>
      </div>
    </div>

    <!-- Output & Export -->
    <div class="tool-section">
      <div class="section-title">
        <span class="section-title-left">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/>
            <path d="M10 12h4"/>
            <rect x="2" y="3" width="20" height="5" rx="1"/>
          </svg>
          <span>Slice Export</span>
        </span>
      </div>

      <div class="field-group">
        <label for="sliceFormatSelect">Slice Format</label>
        <select id="sliceFormatSelect" class="input-control">
          <option value="image/png">PNG (.png) — Crisp design edges</option>
          <option value="image/webp">WebP (.webp) — Lightweight slides</option>
          <option value="image/jpeg">JPEG (.jpg) — Standard photo</option>
        </select>
      </div>

      <div id="sliceSummaryBox" class="stat-box tabular-nums">
        Load an image to preview slice dimensions.
      </div>

      <button id="sliceDownloadZipBtn" class="btn btn-primary btn-full" type="button">
        Download All Slices (ZIP)
      </button>
      <button id="sliceDownloadEachBtn" class="btn btn-secondary btn-full" type="button">
        Download Slices Individually
      </button>
    </div>
  `;

  const overlayLayer = document.getElementById('overlayLayer');
  const sliceCountBadge = container.querySelector('#sliceCountBadge');
  const modeCarouselBtn = container.querySelector('#modeCarouselBtn');
  const modeGridBtn = container.querySelector('#modeGridBtn');
  const carouselControls = container.querySelector('#carouselControls');
  const gridControls = container.querySelector('#gridControls');
  const carouselSlidesRange = container.querySelector('#carouselSlidesRange');
  const carouselSlidesVal = container.querySelector('#carouselSlidesVal');
  const gridRowsInput = container.querySelector('#gridRowsInput');
  const gridColsInput = container.querySelector('#gridColsInput');
  const reverseOrderCheck = container.querySelector('#reverseOrderCheck');
  const sliceFormatSelect = container.querySelector('#sliceFormatSelect');
  const sliceSummaryBox = container.querySelector('#sliceSummaryBox');
  const sliceDownloadZipBtn = container.querySelector('#sliceDownloadZipBtn');
  const sliceDownloadEachBtn = container.querySelector('#sliceDownloadEachBtn');

  function updateGuideOverlay() {
    const active = studio.getActiveItem();
    const total = rows * cols;
    sliceCountBadge.textContent = `${total} ${total === 1 ? 'slice' : 'slices'}`;

    if (!active) {
      overlayLayer.innerHTML = '';
      sliceSummaryBox.textContent = 'Load an image to preview slice dimensions.';
      sliceDownloadZipBtn.disabled = true;
      sliceDownloadEachBtn.disabled = true;
      return;
    }

    sliceDownloadZipBtn.disabled = false;
    sliceDownloadEachBtn.disabled = false;

    const fullCanvas = studio.engine.renderPipeline(true);
    const tileW = Math.floor(fullCanvas.width / cols);
    const tileH = Math.floor(fullCanvas.height / rows);

    sliceSummaryBox.innerHTML = `
      Full Canvas: <strong>${fullCanvas.width} × ${fullCanvas.height} px</strong><br/>
      Each Piece: <strong>${tileW} × ${tileH} px</strong> (${rows}×${cols})
    `;

    let cellsHtml = '';
    for (let idx = 0; idx < total; idx++) {
      const displayNum = reverseOrder ? total - idx : idx + 1;
      cellsHtml += `
        <div style="
          border: 1px dashed #F6E6AD;
          box-shadow: inset 0 0 0 1px rgba(45, 138, 80, 0.75);
          position: relative;
        ">
          <span style="
            position: absolute;
            top: 6px;
            left: 6px;
            font-family: var(--font-main);
            font-variant-numeric: tabular-nums;
            font-size: 11px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 5px;
            background: #2D8A50;
            color: #FAF6EB;
            border: 1px solid #F6E6AD;
          ">${String(displayNum).padStart(2, '0')}</span>
        </div>
      `;
    }

    overlayLayer.innerHTML = `
      <div style="
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: repeat(${cols}, 1fr);
        grid-template-rows: repeat(${rows}, 1fr);
        pointer-events: none;
      ">${cellsHtml}</div>
    `;
  }

  async function generateSlices() {
    const active = studio.getActiveItem();
    if (!active) return [];

    const sourceCanvas = studio.engine.renderPipeline(true);
    const mime = sliceFormatSelect.value;
    const ext = getExtensionForMime(mime);
    const baseName = stripExtension(active.name);
    const total = rows * cols;
    const slices = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = Math.round((c * sourceCanvas.width) / cols);
        const sy = Math.round((r * sourceCanvas.height) / rows);
        const ex = Math.round(((c + 1) * sourceCanvas.width) / cols);
        const ey = Math.round(((r + 1) * sourceCanvas.height) / rows);
        const sw = Math.max(1, ex - sx);
        const sh = Math.max(1, ey - sy);

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = sw;
        tileCanvas.height = sh;
        tileCanvas.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

        const blob = await new Promise((resolve) => tileCanvas.toBlob(resolve, mime, 0.92));
        const linearIdx = r * cols + c;
        const orderNum = reverseOrder ? total - linearIdx : linearIdx + 1;
        const padded = String(orderNum).padStart(2, '0');

        slices.push({
          orderNum,
          filename: `${baseName}-slide-${padded}.${ext}`,
          blob
        });
      }
    }

    slices.sort((a, b) => a.orderNum - b.orderNum);
    return slices;
  }

  modeCarouselBtn.addEventListener('click', () => {
    mode = 'carousel';
    rows = 1;
    cols = parseInt(carouselSlidesRange.value, 10);
    reverseOrder = false;
    modeCarouselBtn.className = 'btn btn-primary btn-sm';
    modeGridBtn.className = 'btn btn-secondary btn-sm';
    carouselControls.classList.remove('hidden');
    gridControls.classList.add('hidden');
    updateGuideOverlay();
  });

  modeGridBtn.addEventListener('click', () => {
    mode = 'grid';
    rows = parseInt(gridRowsInput.value, 10) || 3;
    cols = parseInt(gridColsInput.value, 10) || 3;
    reverseOrder = reverseOrderCheck.checked;
    modeGridBtn.className = 'btn btn-primary btn-sm';
    modeCarouselBtn.className = 'btn btn-secondary btn-sm';
    gridControls.classList.remove('hidden');
    carouselControls.classList.add('hidden');
    updateGuideOverlay();
  });

  carouselSlidesRange.addEventListener('input', () => {
    cols = parseInt(carouselSlidesRange.value, 10);
    carouselSlidesVal.textContent = cols;
    updateGuideOverlay();
  });

  container.querySelectorAll('.auto-slide-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const active = studio.getActiveItem();
      if (!active) return;
      const full = studio.engine.renderPipeline(true);
      const slideAspect = parseFloat(btn.dataset.ratio);
      const idealSlides = Math.max(2, Math.min(10, Math.round(full.width / (full.height * slideAspect))));
      cols = idealSlides;
      carouselSlidesRange.value = idealSlides;
      carouselSlidesVal.textContent = idealSlides;
      updateGuideOverlay();
      studio.toast(`Auto-fitted ${idealSlides} seamless slides`);
    });
  });

  gridRowsInput.addEventListener('input', () => {
    rows = Math.max(1, Math.min(12, parseInt(gridRowsInput.value, 10) || 1));
    updateGuideOverlay();
  });

  gridColsInput.addEventListener('input', () => {
    cols = Math.max(1, Math.min(12, parseInt(gridColsInput.value, 10) || 1));
    updateGuideOverlay();
  });

  container.querySelectorAll('.grid-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      rows = parseInt(btn.dataset.r, 10);
      cols = parseInt(btn.dataset.c, 10);
      gridRowsInput.value = rows;
      gridColsInput.value = cols;
      updateGuideOverlay();
    });
  });

  reverseOrderCheck.addEventListener('change', () => {
    reverseOrder = reverseOrderCheck.checked;
    updateGuideOverlay();
  });

  sliceDownloadZipBtn.addEventListener('click', async () => {
    const active = studio.getActiveItem();
    if (!active) return;
    const slices = await generateSlices();
    const zipName = `${stripExtension(active.name)}-slices.zip`;
    await downloadAsZip(slices, zipName, (msg) => studio.toast(msg));
    studio.toast(`Downloaded ${slices.length} slices in ZIP`);
  });

  sliceDownloadEachBtn.addEventListener('click', async () => {
    const slices = await generateSlices();
    slices.forEach((s, i) => {
      setTimeout(() => triggerBlobDownload(s.blob, s.filename), i * 160);
    });
    studio.toast(`Downloading ${slices.length} individual slices`);
  });

  updateGuideOverlay();
  return { onImageChanged: updateGuideOverlay };
}
