import { DarkroomEngine } from './core/engine.js';
import { formatBytes } from './core/exporter.js';
import { mountConvertTool } from './tools/convert.js';
import { mountTransformTool } from './tools/transform.js';
import { mountSlicerTool } from './tools/slicer.js';
import { mountWatermarkTool } from './tools/watermark.js';
import { mountColorRedactTool } from './tools/color-redact.js';
import { mountCutoutTool } from './tools/cutout.js';
import { mountUtilitiesTool } from './tools/utilities.js';

const TOOL_MOUNTERS = {
  convert: mountConvertTool,
  transform: mountTransformTool,
  slicer: mountSlicerTool,
  watermark: mountWatermarkTool,
  'color-redact': mountColorRedactTool,
  cutout: mountCutoutTool,
  utilities: mountUtilitiesTool
};

class DarkroomStudio {
  constructor() {
    this.engine = new DarkroomEngine();
    this.items = [];
    this.activeIndex = -1;
    this.activeToolKey = 'convert';
    this.activeToolHandle = null;
    this.bypassPreview = false;

    this.displayCanvas = document.getElementById('displayCanvas');
    this.canvasFrame = document.getElementById('canvasFrame');
    this.emptyDropzone = document.getElementById('emptyDropzone');
    this.stageViewport = document.getElementById('stageViewport');
    this.overlayLayer = document.getElementById('overlayLayer');
    this.toolPanelContainer = document.getElementById('toolPanelContainer');
    this.queueStrip = document.getElementById('queueStrip');
    this.queueCountLabel = document.getElementById('queueCountLabel');
    this.activeImageMeta = document.getElementById('activeImageMeta');

    this.compareHoldBtn = document.getElementById('compareHoldBtn');
    this.resetAllEditsBtn = document.getElementById('resetAllEditsBtn');
    this.batchZipBtn = document.getElementById('batchZipBtn');
    this.clearQueueBtn = document.getElementById('clearQueueBtn');
    this.mainFileInput = document.getElementById('mainFileInput');
    this.toastBanner = document.getElementById('toastBanner');

    this.engine.onRender = () => this.paintViewportCanvas();

    this.bindEvents();
    this.switchTool('convert');
    this.registerServiceWorker();
  }

  getActiveItem() {
    return this.activeIndex >= 0 ? this.items[this.activeIndex] : null;
  }

  saveCurrentItemState() {
    const active = this.getActiveItem();
    if (active) {
      active.state = this.engine.cloneState(this.engine.state);
    }
  }

  async decodeFileToBitmap(file) {
    if ('createImageBitmap' in window) {
      return createImageBitmap(file);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      this.toast('Please select valid image files');
      return;
    }

    for (const file of files) {
      try {
        const bitmap = await this.decodeFileToBitmap(file);
        const thumbUrl = URL.createObjectURL(file);
        this.items.push({
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          name: file.name,
          file,
          bitmap,
          thumbUrl,
          state: this.engine.createDefaultState()
        });
      } catch {
        this.toast(`Could not decode ${file.name}`);
      }
    }

    if (this.activeIndex === -1 && this.items.length > 0) {
      this.selectItem(0);
    } else {
      this.renderQueueStrip();
      this.updateHeaderControls();
      this.activeToolHandle?.onImageChanged?.();
    }

    this.toast(`Added ${files.length} ${files.length === 1 ? 'image' : 'images'}`);
  }

  selectItem(index) {
    if (index < 0 || index >= this.items.length) return;
    this.activeIndex = index;
    const item = this.items[index];

    this.emptyDropzone.classList.add('hidden');
    this.canvasFrame.classList.remove('hidden');

    this.engine.setSource(item.bitmap, item.state);
    this.renderQueueStrip();
    this.updateHeaderControls();
    this.activeToolHandle?.onImageChanged?.();
  }

  clearQueue() {
    this.items.forEach((it) => URL.revokeObjectURL(it.thumbUrl));
    this.items = [];
    this.activeIndex = -1;
    this.engine.fullBitmap = null;
    this.overlayLayer.innerHTML = '';

    this.canvasFrame.classList.add('hidden');
    this.emptyDropzone.classList.remove('hidden');
    this.renderQueueStrip();
    this.updateHeaderControls();
    this.activeToolHandle?.onImageChanged?.();
  }

  updateHeaderControls() {
    const active = this.getActiveItem();
    const hasItems = this.items.length > 0;
    this.compareHoldBtn.disabled = !active;
    this.resetAllEditsBtn.disabled = !active;
    this.batchZipBtn.disabled = !hasItems;
    this.clearQueueBtn.classList.toggle('hidden', !hasItems);
    this.queueCountLabel.textContent = `QUEUE (${this.items.length})`;

    if (!active) {
      this.activeImageMeta.textContent = 'No image loaded — drop files or paste (Ctrl+V)';
    } else {
      this.activeImageMeta.textContent = `${active.name} · ${active.bitmap.width}×${active.bitmap.height} · ${formatBytes(active.file.size)}`;
    }
  }

  renderQueueStrip() {
    this.queueStrip.innerHTML = this.items
      .map(
        (item, idx) => `
        <button class="queue-thumb ${idx === this.activeIndex ? 'active' : ''}" data-idx="${idx}" type="button">
          <img src="${item.thumbUrl}" alt="" />
          <div class="queue-thumb-info">
            <div class="queue-thumb-name">${item.name}</div>
            <div class="queue-thumb-meta">${item.bitmap.width}×${item.bitmap.height}</div>
          </div>
        </button>
      `
      )
      .join('');
  }

  paintViewportCanvas() {
    const active = this.getActiveItem();
    if (!active) return;

    const rendered = this.engine.renderPipeline(false, this.bypassPreview);
    const maxW = Math.max(200, this.stageViewport.clientWidth - 40);
    const maxH = Math.max(200, this.stageViewport.clientHeight - 40);
    const fitScale = Math.min(1, maxW / rendered.width, maxH / rendered.height);

    const cssW = Math.max(1, Math.round(rendered.width * fitScale));
    const cssH = Math.max(1, Math.round(rendered.height * fitScale));

    this.displayCanvas.width = rendered.width;
    this.displayCanvas.height = rendered.height;
    this.displayCanvas.style.width = `${cssW}px`;
    this.displayCanvas.style.height = `${cssH}px`;

    const ctx = this.displayCanvas.getContext('2d');
    ctx.clearRect(0, 0, rendered.width, rendered.height);
    ctx.drawImage(rendered, 0, 0);
  }

  switchTool(toolKey) {
    const mounter = TOOL_MOUNTERS[toolKey];
    if (!mounter) return;

    this.activeToolKey = toolKey;
    this.overlayLayer.innerHTML = '';

    document.querySelectorAll('.rail-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolKey);
    });

    this.toolPanelContainer.innerHTML = '';
    this.activeToolHandle = mounter(this.toolPanelContainer, this);
  }

  toast(message) {
    this.toastBanner.textContent = message;
    this.toastBanner.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastBanner.classList.remove('show');
    }, 2400);
  }

  bindEvents() {
    document.getElementById('addFilesBtn').addEventListener('click', () => this.mainFileInput.click());
    document.getElementById('heroUploadBtn').addEventListener('click', () => this.mainFileInput.click());
    this.mainFileInput.addEventListener('change', (e) => {
      this.addFiles(e.target.files);
      this.mainFileInput.value = '';
    });

    this.clearQueueBtn.addEventListener('click', () => this.clearQueue());

    this.queueStrip.addEventListener('click', (e) => {
      const thumb = e.target.closest('.queue-thumb');
      if (thumb) this.selectItem(Number(thumb.dataset.idx));
    });

    document.querySelector('.tool-rail').addEventListener('click', (e) => {
      const btn = e.target.closest('.rail-btn');
      if (btn) this.switchTool(btn.dataset.tool);
    });

    // Hold-to-compare original image
    const startCompare = () => {
      if (!this.getActiveItem()) return;
      this.bypassPreview = true;
      this.paintViewportCanvas();
    };
    const endCompare = () => {
      if (!this.bypassPreview) return;
      this.bypassPreview = false;
      this.paintViewportCanvas();
    };
    this.compareHoldBtn.addEventListener('pointerdown', startCompare);
    window.addEventListener('pointerup', endCompare);

    // Reset all edits on active image
    this.resetAllEditsBtn.addEventListener('click', () => {
      const active = this.getActiveItem();
      if (!active) return;
      active.state = this.engine.createDefaultState();
      this.engine.setSource(active.bitmap, active.state);
      this.overlayLayer.innerHTML = '';
      this.activeToolHandle?.onImageChanged?.();
      this.toast('Reset all edits on current image');
    });

    // Top-bar Batch ZIP export
    this.batchZipBtn.addEventListener('click', () => {
      this.switchTool('convert');
      const batchBtn = this.toolPanelContainer.querySelector('#exportBatchZipBtn');
      const singleBtn = this.toolPanelContainer.querySelector('#exportSingleBtn');
      if (this.items.length > 1 && batchBtn) {
        batchBtn.click();
      } else if (singleBtn) {
        singleBtn.click();
      }
    });

    // Drag & Drop anywhere on stage
    ['dragenter', 'dragover'].forEach((evt) => {
      this.stageViewport.addEventListener(evt, (e) => {
        e.preventDefault();
        this.stageViewport.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      this.stageViewport.addEventListener(evt, (e) => {
        e.preventDefault();
        this.stageViewport.classList.remove('drag-over');
      });
    });
    this.stageViewport.addEventListener('drop', (e) => {
      if (e.dataTransfer?.files?.length) {
        this.addFiles(e.dataTransfer.files);
      }
    });

    // Clipboard Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) pastedFiles.push(f);
        }
      }
      if (pastedFiles.length) this.addFiles(pastedFiles);
    });

    window.addEventListener('resize', () => this.paintViewportCanvas());
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.darkroom = new DarkroomStudio();
});
