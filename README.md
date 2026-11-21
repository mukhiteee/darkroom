# Darkroom

**Local-First Browser Image Studio & Offline PWA** — Zero uploads, zero servers, 100% client-side processing via HTML5 Canvas.

### Features
- **Batch Convert & Compress:** WebP, PNG, JPEG, BMP, and multi-size `.ico` export with target-KB compression and zero-dependency ZIP bundling.
- **Geometry & Social Framing:** Interactive Rule-of-Thirds aspect-ratio cropper, smart resizer, rotate/flip, and blurred/solid social padding (`1:1`, `4:5`, `9:16`, `16:9`).
- **Carousel & Grid Slicer:** Seamless Instagram/LinkedIn panorama slicing and `3×3` profile grid cutting.
- **Watermarking & Branding:** Text, transparent logo stamps, and diagonal client-proofing overlays across queued batches.
- **Privacy & Developer Utilities:** Pure-JS binary EXIF/GPS inspector & metadata stripper, plus 7-file Favicon & PWA icon pack generator.
- **Color Grading & Redaction:** Real-time presets, Median-Cut HEX palette extraction, and drag-to-draw pixelate/blur privacy boxes.
- **Cutout Studio:** Zero-data Magic Wand + manual mask brush, cached offline AI background removal, backdrop replacement, and portrait bokeh blur.

### Running Locally
Serve the `darkroom/` folder with any static HTTP server (e.g. `npx serve .`, `python -m http.server 8000`, or VS Code Live Server) so ES Modules and the Service Worker register properly.
