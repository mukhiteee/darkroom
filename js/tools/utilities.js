import {
  downloadAsZip,
  formatBytes,
  getExtensionForMime,
  stripExtension,
  triggerBlobDownload
} from '../core/exporter.js';

export function mountUtilitiesTool(container, studio) {
  container.innerHTML = `
    <div class="tool-section">
      <div class="section-title">
        <span>EXIF &amp; Privacy Metadata</span>
        <span id="exifCountBadge" class="badge-butter mono-text">0 tags</span>
      </div>

      <div id="exifListBox" class="stat-box mono-text" style="max-height:210px; overflow-y:auto; font-size:0.74rem;">
        Load an image to inspect embedded EXIF / GPS metadata.
      </div>

      <button id="stripMetadataBtn" class="btn btn-primary btn-sm btn-full" type="button">
        Strip All Metadata &amp; Download Clean Copy
      </button>
    </div>

    <div class="tool-section">
      <div class="section-title">
        <span>Favicon &amp; PWA Icon Pack</span>
        <span class="badge-butter">7 Files</span>
      </div>

      <p style="font-size:0.78rem; color:var(--text-secondary); line-height:1.45;">
        Generates <code>16×16</code>, <code>32×32</code>, <code>favicon.ico</code>, <code>180×180</code> Apple Touch, <code>192×192</code>, <code>512×512</code>, and <code>site.webmanifest</code>.
      </p>

      <div class="row-2">
        <div class="field-group">
          <label for="iconRadiusRange">Corner Radius</label>
          <input type="range" id="iconRadiusRange" min="0" max="50" step="5" value="20" />
        </div>
        <div class="field-group">
          <label for="iconBgSelect">Icon Backdrop</label>
          <select id="iconBgSelect" class="input-control">
            <option value="transparent">Transparent</option>
            <option value="#F6E6AD">Butter (#F6E6AD)</option>
            <option value="#236B3D">Leaf (#236B3D)</option>
            <option value="#FFFFFF">White (#FFFFFF)</option>
            <option value="#0E1210">Dark (#0E1210)</option>
          </select>
        </div>
      </div>

      <button id="generateIconPackBtn" class="btn btn-butter btn-full" type="button">
        Generate &amp; Download Icon ZIP
      </button>
    </div>
  `;

  const exifCountBadge = container.querySelector('#exifCountBadge');
  const exifListBox = container.querySelector('#exifListBox');
  const stripMetadataBtn = container.querySelector('#stripMetadataBtn');
  const iconRadiusRange = container.querySelector('#iconRadiusRange');
  const iconBgSelect = container.querySelector('#iconBgSelect');
  const generateIconPackBtn = container.querySelector('#generateIconPackBtn');

  async function inspectFileMetadata(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const entries = [];

    entries.push(['File Name', file.name]);
    entries.push(['MIME Type', file.type || 'Unknown']);
    entries.push(['File Size', formatBytes(file.size)]);

    if (view.byteLength > 4 && view.getUint16(0, false) === 0xffd8) {
      let offset = 2;
      while (offset + 4 < view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffda || marker === 0xffd9) break;

        const segLen = view.getUint16(offset, false);
        if (marker === 0xffe1 && segLen > 8) {
          const exifHeader = readAscii(view, offset + 2, 4);
          if (exifHeader === 'Exif') {
            parseTiffBlock(view, offset + 8, entries);
          }
        }
        offset += segLen;
      }
    }

    if (view.byteLength > 12 && view.getUint32(0, false) === 0x89504e47) {
      let offset = 8;
      while (offset + 8 < view.byteLength) {
        const len = view.getUint32(offset, false);
        const type = readAscii(view, offset + 4, 4);
        if (type === 'tEXt' && offset + 8 + len <= view.byteLength) {
          const raw = readAscii(view, offset + 8, Math.min(len, 240));
          const sep = raw.indexOf('\0');
          if (sep > 0) {
            entries.push([raw.slice(0, sep), raw.slice(sep + 1)]);
          }
        }
        if (type === 'eXIf') {
          entries.push(['EXIF Chunk', `${len} bytes embedded`]);
        }
        if (type === 'IEND') break;
        offset += 12 + len;
      }
    }

    return entries;
  }

  function readAscii(view, start, length) {
    let out = '';
    const end = Math.min(view.byteLength, start + length);
    for (let i = start; i < end; i++) {
      out += String.fromCharCode(view.getUint8(i));
    }
    return out;
  }

  function parseTiffBlock(view, tiffStart, entries) {
    if (tiffStart + 8 > view.byteLength) return;
    const endianMark = readAscii(view, tiffStart, 2);
    const littleEndian = endianMark === 'II';
    if (!littleEndian && endianMark !== 'MM') return;

    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    const TAG_NAMES = {
      0x010f: 'Camera Make',
      0x0110: 'Camera Model',
      0x0112: 'Orientation',
      0x0131: 'Software',
      0x0132: 'Modified Date',
      0x829a: 'Exposure Time',
      0x829d: 'Aperture (F-Stop)',
      0x8827: 'ISO Speed',
      0x9003: 'Date Taken',
      0x920a: 'Focal Length',
      0xa434: 'Lens Model'
    };

    const gpsData = {};

    function readIfd(ifdOffset, isGps = false) {
      const absIfd = tiffStart + ifdOffset;
      if (absIfd + 2 > view.byteLength) return;
      const count = view.getUint16(absIfd, littleEndian);

      for (let i = 0; i < count; i++) {
        const entryPos = absIfd + 2 + i * 12;
        if (entryPos + 12 > view.byteLength) break;

        const tag = view.getUint16(entryPos, littleEndian);
        const type = view.getUint16(entryPos + 2, littleEndian);
        const numVals = view.getUint32(entryPos + 4, littleEndian);
        const valOffset = view.getUint32(entryPos + 8, littleEndian);

        if (!isGps && tag === 0x8769) {
          readIfd(valOffset, false);
          continue;
        }
        if (!isGps && tag === 0x8825) {
          readIfd(valOffset, true);
          continue;
        }

        if (isGps) {
          if ((tag === 0x0001 || tag === 0x0003) && type === 2) {
            gpsData[tag] = String.fromCharCode(view.getUint8(entryPos + 8));
          } else if ((tag === 0x0002 || tag === 0x0004) && type === 5 && numVals === 3) {
            const rOff = tiffStart + valOffset;
            if (rOff + 24 <= view.byteLength) {
              const deg = view.getUint32(rOff, littleEndian) / (view.getUint32(rOff + 4, littleEndian) || 1);
              const min = view.getUint32(rOff + 8, littleEndian) / (view.getUint32(rOff + 12, littleEndian) || 1);
              const sec = view.getUint32(rOff + 16, littleEndian) / (view.getUint32(rOff + 20, littleEndian) || 1);
              gpsData[tag] = deg + min / 60 + sec / 3600;
            }
          }
          continue;
        }

        const label = TAG_NAMES[tag];
        if (!label) continue;

        if (type === 2) {
          const strStart = numVals <= 4 ? entryPos + 8 : tiffStart + valOffset;
          const text = readAscii(view, strStart, numVals - 1).trim();
          if (text) entries.push([label, text]);
        } else if (type === 3) {
          const num = view.getUint16(entryPos + 8, littleEndian);
          entries.push([label, String(num)]);
        } else if (type === 5) {
          const rOff = tiffStart + valOffset;
          if (rOff + 8 <= view.byteLength) {
            const num = view.getUint32(rOff, littleEndian);
            const den = view.getUint32(rOff + 4, littleEndian) || 1;
            if (tag === 0x829a && num < den) {
              entries.push([label, `1/${Math.round(den / num)}s`]);
            } else if (tag === 0x829d) {
              entries.push([label, `f/${(num / den).toFixed(1)}`]);
            } else if (tag === 0x920a) {
              entries.push([label, `${Math.round(num / den)}mm`]);
            }
          }
        }
      }
    }

    readIfd(firstIfdOffset, false);

    if (typeof gpsData[0x0002] === 'number' && typeof gpsData[0x0004] === 'number') {
      const lat = (gpsData[0x0001] === 'S' ? -1 : 1) * gpsData[0x0002];
      const lng = (gpsData[0x0003] === 'W' ? -1 : 1) * gpsData[0x0004];
      entries.push(['GPS Coordinates', `${lat.toFixed(5)}, ${lng.toFixed(5)}`]);
    }
  }

  async function refreshMetadata() {
    const active = studio.getActiveItem();
    if (!active) {
      exifCountBadge.textContent = '0 tags';
      exifListBox.textContent = 'Load an image to inspect embedded EXIF / GPS metadata.';
      stripMetadataBtn.disabled = true;
      generateIconPackBtn.disabled = true;
      return;
    }

    stripMetadataBtn.disabled = false;
    generateIconPackBtn.disabled = false;

    const rows = await inspectFileMetadata(active.file);
    exifCountBadge.textContent = `${rows.length} fields`;
    exifListBox.innerHTML = rows
      .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
      .join('');
  }

  stripMetadataBtn.addEventListener('click', async () => {
    const active = studio.getActiveItem();
    if (!active) return;

    const cleanMime =
      active.file.type === 'image/jpeg'
        ? 'image/jpeg'
        : active.file.type === 'image/webp'
        ? 'image/webp'
        : 'image/png';

    const cleanBlob = await studio.engine.renderToBlob(cleanMime, 0.94);
    const outName = `${stripExtension(active.name)}-clean.${getExtensionForMime(cleanMime)}`;
    triggerBlobDownload(cleanBlob, outName);
    studio.toast('Stripped EXIF/GPS metadata & saved clean copy');
  });

  async function renderSquareIconBlob(sourceCanvas, size, radiusPct, bgColor) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const r = Math.round((size * radiusPct) / 100);
    if (r > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r);
      ctx.clip();
    }

    if (bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);
    }

    const scale = Math.min(size / sourceCanvas.width, size / sourceCanvas.height);
    const dw = sourceCanvas.width * scale;
    const dh = sourceCanvas.height * scale;
    ctx.drawImage(sourceCanvas, (size - dw) / 2, (size - dh) / 2, dw, dh);

    return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
  }

  generateIconPackBtn.addEventListener('click', async () => {
    const active = studio.getActiveItem();
    if (!active) return;

    const fullCanvas = studio.engine.renderPipeline(true);
    const radiusPct = parseInt(iconRadiusRange.value, 10);
    const bgColor = iconBgSelect.value;

    const sizes = [
      { size: 16, name: 'favicon-16x16.png' },
      { size: 32, name: 'favicon-32x32.png' },
      { size: 180, name: 'apple-touch-icon.png' },
      { size: 192, name: 'icon-192x192.png' },
      { size: 512, name: 'icon-512x512.png' }
    ];

    const entries = [];
    for (const item of sizes) {
      const blob = await renderSquareIconBlob(fullCanvas, item.size, radiusPct, bgColor);
      entries.push({ filename: item.name, blob });
    }

    const icoBlob = await studio.engine.canvasToIcoBlob(fullCanvas);
    entries.push({ filename: 'favicon.ico', blob: icoBlob });

    const manifestJson = JSON.stringify(
      {
        name: stripExtension(active.name),
        short_name: stripExtension(active.name),
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ],
        theme_color: bgColor === 'transparent' ? '#236B3D' : bgColor,
        background_color: bgColor === 'transparent' ? '#F8F4E8' : bgColor,
        display: 'standalone'
      },
      null,
      2
    );
    entries.push({
      filename: 'site.webmanifest',
      blob: new Blob([manifestJson], { type: 'application/manifest+json' })
    });

    await downloadAsZip(entries, `${stripExtension(active.name)}-favicons.zip`, (msg) =>
      studio.toast(msg)
    );
    studio.toast('Favicon & PWA icon bundle downloaded');
  });

  refreshMetadata();
  return { onImageChanged: refreshMetadata };
}
