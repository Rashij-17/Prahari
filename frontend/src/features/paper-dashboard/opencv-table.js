// deps: none
// Pure-JS table cell region generator for Prahari Paper Dashboard.
// NOTE: OpenCV.js morphological table detection is intentionally NOT used —
// loading it caused the page to hang. We instead generate a structured grid
// by dividing the image into logical row/column regions, which works well
// for standard lab report formats.

/**
 * Generates a grid of cell bounding boxes from a canvas image.
 * Uses pure JS geometry — no external libraries needed.
 *
 * @param {HTMLCanvasElement} canvasElement - Canvas containing the report image
 * @returns {Promise<Array<{x: number, y: number, width: number, height: number}>>}
 */
export async function isolateTableCells(canvasElement) {
  const w = canvasElement.width;
  const h = canvasElement.height;

  // Skip the top ~18% of the image (letterhead/header area) and
  // divide the remaining area into a 4-column, 10-row grid that maps
  // to standard CBC/LFT/lipid panel report layouts.
  const topSkip = Math.floor(h * 0.18);
  const usableH = h - topSkip;
  const numRows = 10;
  const numCols = 4;
  const cellW   = Math.floor(w / numCols);
  const cellH   = Math.floor(usableH / numRows);
  const padding = 4; // px inset per cell

  const cells = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      cells.push({
        x:      c * cellW + padding,
        y:      topSkip + r * cellH + padding,
        width:  cellW  - padding * 2,
        height: cellH  - padding * 2
      });
    }
  }

  return cells;
}
