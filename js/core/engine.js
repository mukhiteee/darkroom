import { encodeBmpBlob, encodeIcoBlob } from './exporter.js';

export class DarkroomEngine {
  constructor() {
    this.fullBitmap = null;
    this.state = this.createDefaultState();
    this.onRender = null;
    this._rafPending = false;
  }

  createDefaultState() {
    return {
      transform: {
        rotate: 0,
        flipH: false,
        flipV: false,
        crop: null,
        resize: null,
        frame: null
      },
      cutout: {
        enabled: false,
        maskCanvas: null,
        mask: null,
        feather: 1,
        bgMode: 'transparent',
        bgColor: '#FAF6EB',
        bgGradient: ['#236B3D', '#F6E6AD'],
        bokehBlur: 18,
        bgImage: null
      },
      adjustments: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        hue: 0,
        vignette: 0
      },
      redactions: [],
      watermark: {
        enabled: false,
        mode: 'text',
        text: '© Darkroom',
        color: '#FFFFFF',
        logoImage: null,
        position: 'bottom-right',
        opacity: 0.55,
        scale: 1
      }
    };
  }

  setSource(bitmap, savedState = null) {
    this.fullBitmap = bitmap;
    this.state = savedState ? this.cloneState(savedState) : this.createDefaultState();
    this.requestRender();
  }

  cloneState(src) {
    const base = this.createDefaultState();
    return {
      transform: { ...base.transform, ...(src.transform || {}) },
      cutout: { ...base.cutout, ...(src.cutout || {}) },
      adjustments: { ...base.adjustments, ...(src.adjustments || {}) },
      redactions: Array.isArray(src.redactions) ? src.redactions.map((b) => ({ ...b })) : [],
      watermark: { ...base.watermark, ...(src.watermark || {}) }
    };
  }

  updateSection(section, patch) {
    if (Array.isArray(patch)) {
      this.state[section] = patch;
    } else if (patch && typeof patch === 'object') {
      this.state[section] = { ...(this.state[section] || {}), ...patch };
    } else {
      this.state[section] = patch;
    }
    this.requestRender();
  }

  requestRender() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      if (typeof this.onRender === 'function') {
        this.onRender();
      }
    });
  }

  /**
   * Executes the full non-destructive rendering pipeline onto an offscreen canvas.
   */
  renderPipeline(fullRes = true, bypassEdits = false) {
    const bm = this.fullBitmap;
    const out = document.createElement('canvas');
    if (!bm) {
      out.width = 1;
      out.height = 1;
      return out;
    }

    if (bypassEdits) {
      out.width = bm.width;
      out.height = bm.height;
      out.getContext('2d').drawImage(bm, 0, 0);
      return out;
    }

    const { transform, cutout, adjustments, redactions, watermark } = this.state;

    // 1. Apply Cutout Mask & Backdrop on raw source space before geometric transforms
    let workingSource = bm;
    if (cutout && cutout.enabled && cutout.maskCanvas) {
      workingSource = this._composeCutoutLayer(bm, cutout);
    }

    // 2. Source Crop
    const crop = transform.crop;
    const sx = crop ? Math.round(crop.x * bm.width) : 0;
    const sy = crop ? Math.round(crop.y * bm.height) : 0;
    const sw = crop ? Math.max(1, Math.round(crop.w * bm.width)) : bm.width;
    const sh = crop ? Math.max(1, Math.round(crop.h * bm.height)) : bm.height;

    // 3. Rotate & Flip + Target Resize
    const swapped = transform.rotate === 90 || transform.rotate === 270;
    const rotW = swapped ? sh : sw;
    const rotH = swapped ? sw : sh;

    let targetW = transform.resize ? Math.max(1, transform.resize.width) : rotW;
    let targetH = transform.resize ? Math.max(1, transform.resize.height) : rotH;

    if (!fullRes) {
      const maxPreview = 1400;
      const previewScale = Math.min(1, maxPreview / Math.max(targetW, targetH));
      targetW = Math.max(1, Math.round(targetW * previewScale));
      targetH = Math.max(1, Math.round(targetH * previewScale));
    }

    const geoCanvas = document.createElement('canvas');
    geoCanvas.width = targetW;
    geoCanvas.height = targetH;
    const gCtx = geoCanvas.getContext('2d');

    gCtx.save();
    gCtx.translate(targetW / 2, targetH / 2);
    gCtx.rotate((transform.rotate * Math.PI) / 180);
    gCtx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);

    const drawW = swapped ? targetH : targetW;
    const drawH = swapped ? targetW : targetH;
    gCtx.drawImage(workingSource, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    gCtx.restore();

    // 4. Light & Color Grading
    const gradedCanvas = this._applyColorGrading(geoCanvas, adjustments);

    // 5. Social Frame Padding
    let framedCanvas = gradedCanvas;
    if (transform.frame && transform.frame.ratio) {
      framedCanvas = this._applySocialFrame(gradedCanvas, transform.frame);
    }

    // 6. Privacy Redactions
    if (Array.isArray(redactions) && redactions.length > 0) {
      this._applyRedactions(framedCanvas, redactions);
    }

    // 7. Watermark Overlay
    if (watermark && watermark.enabled) {
      this._applyWatermark(framedCanvas, watermark);
    }

    return framedCanvas;
  }

  _composeCutoutLayer(bm, cutout) {
    const w = bm.width;
    const h = bm.height;

    // Extract foreground subject using white=opaque, black=transparent mask
    const fg = document.createElement('canvas');
    fg.width = w;
    fg.height = h;
    const fgCtx = fg.getContext('2d', { willReadFrequently: true });
    fgCtx.drawImage(bm, 0, 0);

    const maskTmp = document.createElement('canvas');
    maskTmp.width = w;
    maskTmp.height = h;
    const mCtx = maskTmp.getContext('2d', { willReadFrequently: true });
    if (cutout.feather > 0) {
      mCtx.filter = `blur(${cutout.feather}px)`;
    }
    mCtx.drawImage(cutout.maskCanvas, 0, 0, w, h);

    const fgImg = fgCtx.getImageData(0, 0, w, h);
    const mData = mCtx.getImageData(0, 0, w, h).data;
    const fData = fgImg.data;

    for (let i = 0; i < fData.length; i += 4) {
      fData[i + 3] = Math.round((fData[i + 3] * mData[i]) / 255);
    }
    fgCtx.putImageData(fgImg, 0, 0);

    const composed = document.createElement('canvas');
    composed.width = w;
    composed.height = h;
    const cCtx = composed.getContext('2d');

    if (cutout.bgMode === 'bokeh') {
      cCtx.save();
      cCtx.filter = `blur(${cutout.bokehBlur || 18}px)`;
      cCtx.drawImage(bm, -20, -20, w + 40, h + 40);
      cCtx.restore();
    } else if (cutout.bgMode === 'color') {
      cCtx.fillStyle = cutout.bgColor || '#FAF6EB';
      cCtx.fillRect(0, 0, w, h);
    } else if (cutout.bgMode === 'gradient') {
      const [c1, c2] = cutout.bgGradient || ['#236B3D', '#F6E6AD'];
      const grad = cCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      cCtx.fillStyle = grad;
      cCtx.fillRect(0, 0, w, h);
    } else if (cutout.bgMode === 'image' && cutout.bgImage) {
      const bg = cutout.bgImage;
      const scale = Math.max(w / bg.width, h / bg.height);
      const dw = bg.width * scale;
      const dh = bg.height * scale;
      cCtx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    cCtx.drawImage(fg, 0, 0);
    return composed;
  }

  _applyColorGrading(srcCanvas, adj) {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');

    const b = 100 + (adj.brightness || 0);
    const c = 100 + (adj.contrast || 0);
    const s = 100 + (adj.saturation || 0);
    const hue = adj.hue || 0;

    ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${hue}deg)`;
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.filter = 'none';

    // Warmth / Temperature tint
    const warmth = adj.warmth || 0;
    if (warmth !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = Math.min(0.65, Math.abs(warmth) / 110);
      ctx.fillStyle = warmth > 0 ? '#FF9D2E' : '#2E90FF';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Radial Vignette
    const vig = adj.vignette || 0;
    if (vig > 0) {
      const radius = Math.hypot(w, h) * 0.55;
      const grad = ctx.createRadialGradient(w / 2, h / 2, radius * 0.35, w / 2, h / 2, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(10, 14, 12, ${(vig / 100) * 0.82})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    return out;
  }

  _applySocialFrame(srcCanvas, frame) {
    const parts = frame.ratio.split(':').map(Number);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return srcCanvas;
    const targetRatio = parts[0] / parts[1];
    const srcRatio = srcCanvas.width / srcCanvas.height;

    let canvasW = srcCanvas.width;
    let canvasH = srcCanvas.height;

    if (srcRatio > targetRatio) {
      canvasH = Math.round(srcCanvas.width / targetRatio);
    } else {
      canvasW = Math.round(srcCanvas.height * targetRatio);
    }

    const out = document.createElement('canvas');
    out.width = canvasW;
    out.height = canvasH;
    const ctx = out.getContext('2d');

    if (frame.mode === 'color') {
      ctx.fillStyle = frame.color || '#FAF6EB';
      ctx.fillRect(0, 0, canvasW, canvasH);
    } else {
      ctx.save();
      ctx.filter = 'blur(26px) brightness(0.9)';
      const coverScale = Math.max(canvasW / srcCanvas.width, canvasH / srcCanvas.height);
      const cw = srcCanvas.width * coverScale;
      const ch = srcCanvas.height * coverScale;
      ctx.drawImage(srcCanvas, (canvasW - cw) / 2 - 16, (canvasH - ch) / 2 - 16, cw + 32, ch + 32);
      ctx.restore();
    }

    const paddingFactor = frame.mode === 'color' ? 0.92 : 0.96;
    const fitScale = Math.min(
      (canvasW * paddingFactor) / srcCanvas.width,
      (canvasH * paddingFactor) / srcCanvas.height
    );
    const dw = Math.round(srcCanvas.width * fitScale);
    const dh = Math.round(srcCanvas.height * fitScale);
    ctx.drawImage(srcCanvas, Math.round((canvasW - dw) / 2), Math.round((canvasH - dh) / 2), dw, dh);

    return out;
  }

  _applyRedactions(canvas, boxes) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    for (const box of boxes) {
      const rx = Math.round(box.x * w);
      const ry = Math.round(box.y * h);
      const rw = Math.max(2, Math.round(box.w * w));
      const rh = Math.max(2, Math.round(box.h * h));
      const strength = box.strength || 18;

      if (box.mode === 'solid') {
        ctx.fillStyle = '#18241C';
        ctx.fillRect(rx, ry, rw, rh);
      } else if (box.mode === 'blur') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        ctx.filter = `blur(${strength}px)`;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
      } else {
        // Mosaic Pixelate
        const blockSize = Math.max(4, strength);
        const tinyW = Math.max(1, Math.round(rw / blockSize));
        const tinyH = Math.max(1, Math.round(rh / blockSize));
        const tiny = document.createElement('canvas');
        tiny.width = tinyW;
        tiny.height = tinyH;
        tiny.getContext('2d').drawImage(canvas, rx, ry, rw, rh, 0, 0, tinyW, tinyH);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tiny, 0, 0, tinyW, tinyH, rx, ry, rw, rh);
        ctx.restore();
      }
    }
  }

  _applyWatermark(canvas, wm) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const baseUnit = Math.max(16, Math.round(Math.min(w, h) * 0.042 * (wm.scale || 1)));

    ctx.save();
    ctx.globalAlpha = wm.opacity ?? 0.55;

    if (wm.mode === 'tiled') {
      const step = baseUnit * 6;
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-32 * Math.PI) / 180);
      const diag = Math.hypot(w, h);

      for (let y = -diag; y <= diag; y += step) {
        for (let x = -diag; x <= diag; x += step * 1.5) {
          if (wm.logoImage) {
            const lh = baseUnit * 1.6;
            const lw = (wm.logoImage.width / wm.logoImage.height) * lh;
            ctx.drawImage(wm.logoImage, x - lw / 2, y - lh / 2, lw, lh);
          } else {
            ctx.font = `700 ${baseUnit}px "Space Grotesk", sans-serif`;
            ctx.fillStyle = wm.color || '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(wm.text || '© Darkroom', x, y);
          }
        }
      }
      ctx.restore();
      return;
    }

    const margin = Math.round(Math.min(w, h) * 0.035);
    let itemW = 0;
    let itemH = 0;

    if (wm.mode === 'image' && wm.logoImage) {
      itemH = baseUnit * 2.2;
      itemW = (wm.logoImage.width / wm.logoImage.height) * itemH;
    } else {
      ctx.font = `700 ${baseUnit}px "Space Grotesk", sans-serif`;
      itemW = ctx.measureText(wm.text || '© Darkroom').width;
      itemH = baseUnit;
    }

    let x = w - itemW - margin;
    let y = h - itemH - margin;
    if (wm.position === 'bottom-left') {
      x = margin;
      y = h - itemH - margin;
    } else if (wm.position === 'top-right') {
      x = w - itemW - margin;
      y = margin;
    } else if (wm.position === 'top-left') {
      x = margin;
      y = margin;
    } else if (wm.position === 'center') {
      x = (w - itemW) / 2;
      y = (h - itemH) / 2;
    }

    if (wm.mode === 'image' && wm.logoImage) {
      ctx.drawImage(wm.logoImage, x, y, itemW, itemH);
    } else {
      ctx.fillStyle = wm.color || '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 4;
      ctx.textBaseline = 'top';
      ctx.fillText(wm.text || '© Darkroom', x, y);
    }

    ctx.restore();
  }

  async renderToBlob(mime = 'image/webp', quality = 0.92) {
    const canvas = this.renderPipeline(true);
    if (mime === 'image/bmp') return encodeBmpBlob(canvas);
    if (mime === 'image/x-icon') return encodeIcoBlob(canvas);
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  }

  async canvasToIcoBlob(sourceCanvas) {
    return encodeIcoBlob(sourceCanvas);
  }
}
