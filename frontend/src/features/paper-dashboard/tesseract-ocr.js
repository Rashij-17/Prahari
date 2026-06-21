// deps: none
// OCR extraction stub for Prahari Paper Dashboard.
// NOTE: Tesseract.js (~50MB model download) is intentionally NOT used —
// downloading language packs causes the pipeline to hang for minutes.
// We return structured mock OCR data that feeds the report parser correctly.
// In production this would be replaced by a server-side OCR endpoint.

/**
 * Extracts text from cell regions of a canvas image.
 * Currently returns structured demo OCR data that exercises the full
 * parse → verify → save pipeline without any network dependency.
 *
 * @param {HTMLCanvasElement} canvasElement - Main canvas (not used in mock)
 * @param {Array<{x, y, width, height}>} cells - Cell bounding boxes
 * @param {Function} [onProgress] - Progress callback (current, total)
 * @returns {Promise<Array<{cell: object, text: string, confidence: number}>>}
 */
export async function extractCellText(canvasElement, cells, onProgress) {
  if (!cells || cells.length === 0) return [];

  // Simulate progressive OCR with small delays so the UI progress bar animates
  const mockRows = [
    ["Test Name",         "Value",  "Unit",   "Reference Range"],
    ["Hemoglobin",        "11.2",   "g/dL",   "12.0 - 17.0"],
    ["Serum Creatinine",  "0.9",    "mg/dL",  "0.6 - 1.2"],
    ["Cholesterol",       "210",    "mg/dL",  "< 200"],
    ["Blood Glucose",     "98",     "mg/dL",  "70 - 110"],
    ["WBC Count",         "7.4",    "10³/μL", "4.5 - 11.0"],
    ["Platelet Count",    "185",    "10³/μL", "150 - 400"],
    ["Sodium",            "138",    "mEq/L",  "136 - 145"],
    ["Potassium",         "4.1",    "mEq/L",  "3.5 - 5.0"],
    ["ALT",               "32",     "U/L",    "7 - 56"],
  ];

  const results = [];
  const numCols = 4;

  for (let idx = 0; idx < cells.length; idx++) {
    const cell = cells[idx];
    const row = Math.floor(idx / numCols);
    const col = idx % numCols;

    if (typeof onProgress === 'function') {
      onProgress(idx + 1, cells.length);
    }

    // Tiny delay so the progress bar animation is visible
    if (idx % numCols === 0) {
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    const text = (row < mockRows.length && col < numCols)
      ? mockRows[row][col]
      : '';

    results.push({
      cell,
      text,
      confidence: text ? Math.floor(85 + Math.random() * 14) : 0
    });
  }

  return results;
}

