// deps: none
// Pill contour detection using lightweight pure-JS analysis.
// NOTE: OpenCV.js (~30MB WASM) is intentionally NOT loaded — it caused the page
// to hang indefinitely. Shape/color analysis is performed via pure canvas/JS below.

let cvReady = false;

/**
 * Initializes the lightweight contour system (resolves immediately).
 * Kept async for API compatibility with the original OpenCV loader.
 * @returns {Promise<void>}
 */
export function loadOpenCV() {
  cvReady = true;
  return Promise.resolve();
}

/**
 * Validates if the frame has a valid pill contour.
 * Returns shape ('round'|'oval') and dominant color ('white'|'yellow'|'blue'|'pink'|'green'|'red').
 * @param {ImageData} imageData - Captured frame raw data
 * @returns {{valid: boolean, pillShape: string|null, pillColor: string|null}}
 */
export function validatePillContour(imageData) {
  if (!cvReady) {
    throw new Error("Contour system not initialized. Call loadOpenCV() first.");
  }

  const { width, height, data } = imageData;

  // ── Pure-JS brightness analysis to detect if a pill-like object is present ──
  // We sample pixels in the center region and look for a bright foreground
  // object (pill) against a darker background.
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const roiRadius = Math.min(width, height) * 0.25; // analyse centre 25%

  let brightCount = 0;
  let totalSampled = 0;
  let sumR = 0, sumG = 0, sumB = 0;

  const step = Math.max(1, Math.floor(roiRadius / 20));

  for (let dy = -roiRadius; dy <= roiRadius; dy += step) {
    for (let dx = -roiRadius; dx <= roiRadius; dx += step) {
      if (dx * dx + dy * dy > roiRadius * roiRadius) continue; // circular ROI
      const px = Math.floor(centerX + dx);
      const py = Math.floor(centerY + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const idx = (py * width + px) * 4;
      const R = data[idx];
      const G = data[idx + 1];
      const B = data[idx + 2];
      const brightness = (R + G + B) / 3;

      totalSampled++;
      sumR += R;
      sumG += G;
      sumB += B;
      if (brightness > 80) brightCount++;
    }
  }

  // Need at least 35% bright pixels in the center to consider a pill present
  const brightRatio = totalSampled > 0 ? brightCount / totalSampled : 0;
  const valid = brightRatio >= 0.35;

  if (!valid) {
    return { valid: false, pillShape: null, pillColor: null };
  }

  // ── Shape heuristic: aspect ratio of the brightest region ──
  // Scan horizontal vs vertical extent of bright pixels to estimate roundness
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let dy = -roiRadius; dy <= roiRadius; dy += step) {
    for (let dx = -roiRadius; dx <= roiRadius; dx += step) {
      const px = Math.floor(centerX + dx);
      const py = Math.floor(centerY + dy);
      if (px < 0 || px >= width || py < 0 || py >= height) continue;
      const idx = (py * width + px) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness > 80) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }

  const bboxW = maxX - minX || 1;
  const bboxH = maxY - minY || 1;
  const aspectRatio = Math.max(bboxW, bboxH) / Math.min(bboxW, bboxH);
  const pillShape = aspectRatio < 1.3 ? 'round' : 'oval';

  // ── Color mapping from average RGB ──
  const avgR = totalSampled > 0 ? sumR / totalSampled : 0;
  const avgG = totalSampled > 0 ? sumG / totalSampled : 0;
  const avgB = totalSampled > 0 ? sumB / totalSampled : 0;
  const pillColor = mapToPillColor(avgR, avgG, avgB);

  return { valid: true, pillShape, pillColor };
}

/**
 * Heuristic color extractor from Mat ROI.
 * Calculates average RGB inside the box and maps to discrete colors.
 */
/**
 * Maps average RGB values to a discrete pill color name.
 * @param {number} avgR
 * @param {number} avgG
 * @param {number} avgB
 * @returns {string}
 */
function mapToPillColor(avgR, avgG, avgB) {
  if (avgR > 200 && avgG > 200 && avgB > 200) return 'white';
  if (avgR > 180 && avgG > 160 && avgB < 100)  return 'yellow';
  if (avgR > 180 && avgG < 140 && avgB > 150)  return 'pink';
  if (avgB > 160 && avgR < 130 && avgG > 120)  return 'blue';
  if (avgG > 130 && avgR < 130 && avgB < 140)  return 'green';
  if (avgR > 150 && avgG < 100 && avgB < 100)  return 'red';
  return 'white'; // most pills are white
}
