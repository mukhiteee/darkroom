import {
  downloadAsZip,
  formatBytes,
  getExtensionForMime,
  stripExtension,
  triggerBlobDownload
} from '../core/exporter.js';

export function mountConvertTool(container, studio) {
  let targetMime = 'image/webp';
  let quality = 0.88;
  let targetMaxKb = 0;

  container.innerHTML = `
    <!-- 1. Output Format & Quality -->
    <div class="tool-section">
      <div class="section-title">
        <span>Format &amp; Compression</span>
        <span id="savingsBadge" class="badge-butter mono-text">—</span>
      </div>

      <div class="field-group">
        <label for="convFormatSelect">Target Format</label>
        <select id="convFormatSelect" class="input-control">
          <option value="image/webp">WebP (.webp) — Modern web &amp; small size</option>
          <option value="image/png">PNG (.png) — Lossless &amp; transparency</option>
          <option value="image/jpeg">JPEG (.jpg) — Universal compatibility</option>
          <option value="image/bmp">BMP (.bmp) — Uncompressed bitmap</option>
          <option value="image/x-icon">ICO (.ico) — Multi-size Windows/Web icon</option>
        </select>
      </div>

      <div id="convQualityGroup" class="field-group">
        <div class="field-label-row">
          <label for="convQualityRange">Compression Quality</label>
          <span id="convQualityVal" class="badge-butter mono-text">88%</span>
        </div>
        <input type="range" id="convQualityRange" min="0.1" max="1" step="0.02" value="0.88" />
      </div>

      <div class="field-group">
        <label for="targetKbInput">Target Max File Size (KB, optional)</label>
        <div style="display:flex; gap:0.4rem;">
          <input type="number" id="targetKbInput" class="input-control mono-text" min="0" placeholder="e.g. 250 (0 = off)" />
          <button class="btn-mini kb-preset" data-kb="100" type="button">100KB</button>
          <button class="btn-mini kb-preset" data-kb="250" type="button">250KB</button>
          <button class="btn-mini kb-preset" data-kb="500" type="button">500KB</button>
        </div>
      </div>
    </div>

    <!-- 2. Export Summary & Actions -->
    <div class="tool-section">
      <div class="section-title">
        <span>Export Summary</span>
      </div>

      <div id="convStatsBox" class="stat-box mono-text">
        Load an image to estimate converted file size.
      </div>

      <button id="exportSingleBtn" class="btn btn-primary btn-full" type="button">
        Download Converted Image
      </button>

      <button id="exportBatchZipBtn" class="btn btn-butter btn-full hidden" type="button">
        Batch Convert All Queued (ZIP)
      </button>
    </div>
  `;

  const convFormatSelect = container.querySelector('#convFormatSelect');
  const convQualityGroup = container.querySelector('#convQualityGroup');
  const convQualityRange = container.querySelector('#convQualityRange');
  const convQualityVal = container.querySelector('#convQualityVal');
  const targetKbInput = container.querySelector('#targetKbInput');
  const savingsBadge = container.querySelector('#savingsBadge');
  const convStatsBox = container.querySelector('#convStatsBox');
  const exportSingleBtn = container.querySelector('#exportSingleBtn');
  const exportBatchZipBtn = container.querySelector('#exportBatchZipBtn');

  async function encodeWithConstraints(engine) {
    const lossy = targetMime === 'image/webp' || targetMime === 'image/jpeg';
    if (!lossy || targetMaxKb <= 0) {
      return engine.renderToBlob(targetMime, quality);
    }

    const maxBytes = targetMaxKb * 1024;
    let low = 0.08;
    let high = quality;
    let bestBlob = await engine.renderToBlob(targetMime, low);

    for (let step = 0; step < 6; step++) {
      const mid = (low + high) / 2;
      const candidate = await engine.renderToBlob(targetMime, mid);
      if (candidate.size <= maxBytes) {
        bestBlob = candidate;
        low = mid;
      } else {
        high = mid;
      }
    }
    return bestBlob;
  }

  async function refreshEstimate() {
    const active = studio.getActiveItem();
    const lossy = targetMime === 'image/webp' || targetMime === 'image/jpeg';
    convQualityGroup.classList.toggle('hidden', !lossy);
    exportBatchZipBtn.classList.toggle('hidden', studio.items.length < 2);

    if (!active) {
      savingsBadge.textContent = '—';
      convStatsBox.textContent = 'Load an image to estimate converted file size.';
      exportSingleBtn.disabled = true;
      return;
    }

    exportSingleBtn.disabled = false;
    const blob = await encodeWithConstraints(studio.engine);
    const origSize = active.file.size;
    const newSize = blob.size;
    const diffPct = Math.round(((origSize - newSize) / origSize) * 100);

    savingsBadge.textContent = diffPct >= 0 ? `-${diffPct}%` : `+${Math.abs(diffPct)}%`;
    convStatsBox.innerHTML = `
      Original: <strong>${formatBytes(origSize)}</strong><br/>
      Output (${getExtensionForMime(targetMime).toUpperCase()}): <strong>${formatBytes(newSize)}</strong>
    `;
  }

  convFormatSelect.addEventListener('change', () => {
    targetMime = convFormatSelect.value;
    refreshEstimate();
  });

  convQualityRange.addEventListener('input', () => {
    quality = parseFloat(convQualityRange.value);
    convQualityVal.textContent = `${Math.round(quality * 100)}%`;
    refreshEstimate();
  });

  targetKbInput.addEventListener('input', () => {
    targetMaxKb = Math.max(0, parseInt(targetKbInput.value, 10) || 0);
    refreshEstimate();
  });

  container.querySelectorAll('.kb-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      targetMaxKb = parseInt(btn.dataset.kb, 10);
      targetKbInput.value = targetMaxKb;
      refreshEstimate();
    });
  });

  exportSingleBtn.addEventListener('click', async () => {
    const active = studio.getActiveItem();
    if (!active) return;
    const blob = await encodeWithConstraints(studio.engine);
    const ext = getExtensionForMime(targetMime);
    triggerBlobDownload(blob, `${stripExtension(active.name)}.${ext}`);
    studio.toast(`Exported ${stripExtension(active.name)}.${ext}`);
  });

  exportBatchZipBtn.addEventListener('click', async () => {
    if (!studio.items.length) return;
    const ext = getExtensionForMime(targetMime);
    const entries = [];

    for (let i = 0; i < studio.items.length; i++) {
      const item = studio.items[i];
      studio.engine.setSource(item.bitmap, item.state);
      const blob = await encodeWithConstraints(studio.engine);
      entries.push({
        filename: `${stripExtension(item.name)}.${ext}`,
        blob
      });
    }

    // Restore active item in engine
    const current = studio.getActiveItem();
    if (current) studio.engine.setSource(current.bitmap, current.state);

    await downloadAsZip(entries, `darkroom-batch-${ext}.zip`, (msg) => studio.toast(msg));
    studio.toast(`Exported ${entries.length} files in ZIP`);
  });

  refreshEstimate();
  return {
    onImageChanged: refreshEstimate,
    batchExport: () => exportBatchZipBtn.click()
  };
}
