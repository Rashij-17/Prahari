// deps: none
// Heuristic-based text parser for converting raw cell OCR results into structured reports

const HEADER_KEYWORDS = ['test', 'parameter', 'investigation', 'result', 'value', 'unit', 'range', 'reference'];

/**
 * Parses raw cell OCR outputs into a structured lab report object
 * @param {Array<{cell: object, text: string, confidence: number}>} cellResults - OCR outputs
 * @returns {object} Structured lab report
 */
export function parseLabReport(cellResults) {
  if (!cellResults || cellResults.length === 0) {
    return { reportDate: new Date().toISOString().split('T')[0], tests: [] };
  }

  // 1. Group cells by Row (using a Y-coordinate grid layout spacing of ~15px)
  const rows = [];
  let currentY = -999;
  let currentRow = [];

  // Sort by Y first, then X
  const sorted = [...cellResults].sort((a, b) => a.cell.y - b.cell.y);

  sorted.forEach(item => {
    if (currentY === -999 || Math.abs(item.cell.y - currentY) > 15) {
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.cell.x - b.cell.x);
        rows.push(currentRow);
      }
      currentRow = [item];
      currentY = item.cell.y;
    } else {
      currentRow.push(item);
    }
  });
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.cell.x - b.cell.x);
    rows.push(currentRow);
  }

  // 2. Identify header row and map columns
  let headerRowIndex = -1;
  let columnCount = 0;
  let colMap = { test: 0, value: 1, unit: 2, range: 3 }; // Defaults

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const matchingKeywords = row.filter(cell => 
      HEADER_KEYWORDS.some(kw => cell.text.toLowerCase().includes(kw))
    );

    if (matchingKeywords.length >= 2) {
      headerRowIndex = r;
      columnCount = row.length;
      
      // Match indices based on text keywords
      row.forEach((cell, idx) => {
        const textLower = cell.text.toLowerCase();
        if (textLower.includes('test') || textLower.includes('parameter') || textLower.includes('investigation')) {
          colMap.test = idx;
        } else if (textLower.includes('result') || textLower.includes('value') || textLower.includes('observed')) {
          colMap.value = idx;
        } else if (textLower.includes('unit')) {
          colMap.unit = idx;
        } else if (textLower.includes('range') || textLower.includes('reference') || textLower.includes('interval')) {
          colMap.range = idx;
        }
      });
      break;
    }
  }

  // Fallback if no header row found
  const dataStartIdx = headerRowIndex !== -1 ? headerRowIndex + 1 : 0;
  const tests = [];

  // 3. Extract tests from rows
  for (let r = dataStartIdx; r < rows.length; r++) {
    const row = rows[r];
    
    // Skip empty or corrupted rows
    if (row.length < 2) continue;

    const testCell = row[colMap.test] || row[0];
    const valCell = row[colMap.value] || row[1];
    const unitCell = row[colMap.unit] || row[2];
    const rangeCell = row[colMap.range] || row[3];

    if (!testCell || !valCell) continue;

    const testName = cleanTestName(testCell.text);
    if (!testName || testName.length < 3) continue;

    const parsedVal = parseFloat(valCell.text.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedVal)) continue; // We need a numeric value for graphing

    const unit = unitCell ? standardizeUnit(unitCell.text) : 'units';
    const range = rangeCell ? parseReferenceRange(rangeCell.text) : { min: null, max: null };
    const status = getTestStatus(parsedVal, range);

    tests.push({
      name: testName,
      nameHindi: getHindiName(testName),
      value: parsedVal,
      unit: unit,
      referenceRange: range,
      status: status,
      category: getTestCategory(testName),
      confidence: Math.round((testCell.confidence + valCell.confidence) / 2)
    });
  }

  // 4. Search for report date in raw text
  const reportDate = extractDateFromCells(cellResults);

  return {
    reportDate,
    tests,
    rawText: cellResults.map(c => c.text).join('\n')
  };
}

function cleanTestName(text) {
  // Remove special characters, extra spaces, numbers at start
  return text
    .replace(/^[^a-zA-Z]+/g, '') // remove leading non-alpha
    .replace(/\s+/g, ' ')
    .trim();
}

function standardizeUnit(unitText) {
  const text = unitText.toLowerCase().trim();
  if (text.includes('g/dl') || text.includes('g/dL')) return 'g/dL';
  if (text.includes('mg/dl') || text.includes('mg/dL')) return 'mg/dL';
  if (text.includes('fl') || text.includes('fL')) return 'fL';
  if (text.includes('%')) return '%';
  if (text.includes('pg')) return 'pg';
  if (text.includes('cells') || text.includes('/ul') || text.includes('/uL')) return 'cells/mcL';
  return unitText;
}

function parseReferenceRange(rangeText) {
  // Extract two numbers from strings like "12.0 - 17.0" or "12-17" or "< 150"
  const numbers = rangeText.match(/[0-9.]+/g);
  if (!numbers) return { min: null, max: null };

  if (numbers.length >= 2) {
    return {
      min: parseFloat(numbers[0]),
      max: parseFloat(numbers[1])
    };
  } else if (numbers.length === 1) {
    const val = parseFloat(numbers[0]);
    if (rangeText.includes('<')) {
      return { min: 0, max: val };
    }
    if (rangeText.includes('>')) {
      return { min: val, max: null };
    }
  }
  return { min: null, max: null };
}

function getTestStatus(val, range) {
  if (range.min !== null && val < range.min) return 'low';
  if (range.max !== null && val > range.max) return 'high';
  if (range.min === null && range.max === null) return 'normal';
  return 'normal';
}

function getTestCategory(testName) {
  const name = testName.toLowerCase();
  if (name.includes('hemoglobin') || name.includes('rbc') || name.includes('wbc') || name.includes('platelet') || name.includes('cbc') || name.includes('hematocrit')) {
    return 'CBC';
  }
  if (name.includes('bilirubin') || name.includes('sgot') || name.includes('sgpt') || name.includes('alkaline phosphatase') || name.includes('ast') || name.includes('alt') || name.includes('lft')) {
    return 'Liver';
  }
  if (name.includes('urea') || name.includes('creatinine') || name.includes('uric acid') || name.includes('bun') || name.includes('kft')) {
    return 'Kidney';
  }
  if (name.includes('cholesterol') || name.includes('triglyceride') || name.includes('hdl') || name.includes('ldl') || name.includes('lipid')) {
    return 'Lipid';
  }
  if (name.includes('t3') || name.includes('t4') || name.includes('tsh') || name.includes('thyroid')) {
    return 'Thyroid';
  }
  return 'Other';
}

function getHindiName(testName) {
  const dictionary = {
    'hemoglobin': 'हीमोग्लोबिन',
    'red blood cells': 'लाल रक्त कोशिकाएं',
    'white blood cells': 'सफेद रक्त कोशिकाएं',
    'platelets': 'प्लेटलेट्स',
    'creatinine': 'क्रिएटिनिन',
    'bilirubin': 'बिलीरुबिन',
    'urea': 'यूरिया',
    'tsh': 'टीएसएच (थायराइड)',
    'cholesterol': 'कोलेस्ट्रॉल'
  };

  const nameLower = testName.toLowerCase();
  for (const [key, value] of Object.entries(dictionary)) {
    if (nameLower.includes(key)) return value;
  }
  return testName; // Fallback
}

function extractDateFromCells(cells) {
  // Regex looking for DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dateRegex = /\b(\d{1,2})[\/\-]\d{1,2}[\/\-](\d{2,4})\b|\b\d{4}\-\d{2}\-\d{2}\b/;
  for (const cell of cells) {
    const match = cell.text.match(dateRegex);
    if (match) {
      // Reformat to standard YYYY-MM-DD if needed
      const rawDate = match[0];
      try {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch (e) {}
    }
  }
  return new Date().toISOString().split('T')[0]; // Default to today
}
