export function stripExtension(filename = 'image') {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}

export function getExtensionForMime(mime) {
  switch (mime) {
    case 'image/webp':
      return 'webp';
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/bmp':
      return 'bmp';
    case 'image/x-icon':
      return 'ico';
    default:
      return 'png';
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, exp);
  return `${val >= 100 || exp === 0 ? Math.round(val) : val.toFixed(1)} ${units[exp]}`;
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Pure-JS 24-bit uncompressed BMP encoder
 */
export function encodeBmpBlob(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { data } = ctx.getImageData(0, 0, w, h);

  const rowStride = Math.floor((24 * w + 31) / 32) * 4;
  const pixelArraySize = rowStride * h;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // BITMAPFILEHEADER
  view.setUint16(0, 0x424d, false); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, w, true);
  view.setInt32(22, h, true); // bottom-up
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelArraySize, true);

  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < w; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 3;
      bytes[d] = data[s + 2];     // B
      bytes[d + 1] = data[s + 1]; // G
      bytes[d + 2] = data[s];     // R
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Pure-JS multi-resolution PNG-compressed .ico encoder (16, 32, 48, 64 px)
 */
export async function encodeIcoBlob(sourceCanvas) {
  const sizes = [16, 32, 48, 64];
  const pngBuffers = [];

  for (const size of sizes) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const scale = Math.min(size / sourceCanvas.width, size / sourceCanvas.height);
    const dw = sourceCanvas.width * scale;
    const dh = sourceCanvas.height * scale;
    ctx.drawImage(sourceCanvas, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    pngBuffers.push(new Uint8Array(await blob.arrayBuffer()));
  }

  const headerSize = 6 + sizes.length * 16;
  const totalBytes = headerSize + pngBuffers.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);

  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type 1 = ICO
  view.setUint16(4, sizes.length, true);

  let offset = headerSize;
  sizes.forEach((size, idx) => {
    const png = pngBuffers[idx];
    const entryOffset = 6 + idx * 16;
    out[entryOffset] = size === 256 ? 0 : size;
    out[entryOffset + 1] = size === 256 ? 0 : size;
    out[entryOffset + 2] = 0;
    out[entryOffset + 3] = 0;
    view.setUint16(entryOffset + 4, 1, true);
    view.setUint16(entryOffset + 6, 32, true);
    view.setUint32(entryOffset + 8, png.length, true);
    view.setUint32(entryOffset + 12, offset, true);

    out.set(png, offset);
    offset += png.length;
  });

  return new Blob([out], { type: 'image/x-icon' });
}

/* ---------------- Zero-Dependency Store-Mode ZIP Archive Builder ---------------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function downloadAsZip(entries, zipFilename = 'darkroom-export.zip', onProgress) {
  if (!entries || !entries.length) return;

  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (let i = 0; i < entries.length; i++) {
    const { filename, blob } = entries[i];
    if (onProgress) onProgress(`Packing ${i + 1}/${entries.length}: ${filename}`);

    const nameBytes = encoder.encode(filename);
    const fileBytes = new Uint8Array(await blob.arrayBuffer());
    const checksum = crc32(fileBytes);

    // Local File Header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true);      // Store (no compression)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, fileBytes.length, true);
    lv.setUint32(22, fileBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, fileBytes);

    // Central Directory Header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, fileBytes.length, true);
    cv.setUint32(24, fileBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + fileBytes.length;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const zipBlob = new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/zip'
  });
  triggerBlobDownload(zipBlob, zipFilename);
}
