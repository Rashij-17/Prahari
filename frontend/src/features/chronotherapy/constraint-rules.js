// deps: none
// Hard and Soft constraint definitions for Prahari Chronotherapy Engine

import interactions from './drug-interactions.json';

/**
 * Checks if a proposed time slot violates any HARD constraints.
 * All checks must return true for the schedule to be valid.
 * 
 * @param {object} med - Medicine object
 * @param {string} time - 24-hr format "HH:MM"
 * @param {object} assignment - Current state of scheduled doses: { medId: ["HH:MM", ...] }
 * @param {object} patientMeds - Array of all active medicines in list
 * @param {object} prefs - User routine preferences: { wakeTime, sleepTime, mealTimes: { breakfast, lunch, dinner } }
 * @returns {boolean} True if consistent, false if hard violation
 */
export function verifyHardConstraints(med, time, assignment, patientMeds, prefs) {
  // 1. SLEEP EXCLUSION: No doses during sleep window
  if (isDuringSleep(time, prefs.wakeTime, prefs.sleepTime)) {
    return false;
  }

  // 2. MIN INTERVAL BETWEEN DOSES: If same medicine has other doses scheduled, check gap
  const existingDoses = assignment[med.id] || [];
  const minIntervalHours = med.intervalHours || 6;
  for (const existingTime of existingDoses) {
    const gap = getHourDifference(time, existingTime);
    if (gap < minIntervalHours) {
      return false;
    }
  }

  // 3. DRUG-DRUG INTERACTION BLACKOUT: Check spacing with conflicting meds already scheduled
  for (const otherMedId of Object.keys(assignment)) {
    const otherMed = patientMeds.find(m => m.id === otherMedId);
    if (!otherMed) continue;

    // Check interaction key (e.g. "levothyroxine+calcium")
    const key1 = `${med.name.toLowerCase().split(' ')[0]}+${otherMed.name.toLowerCase().split(' ')[0]}`;
    const key2 = `${otherMed.name.toLowerCase().split(' ')[0]}+${med.name.toLowerCase().split(' ')[0]}`;
    
    const conflict = interactions[key1] || interactions[key2];
    if (conflict && conflict.minGapHours > 0) {
      const otherDoses = assignment[otherMedId] || [];
      for (const otherTime of otherDoses) {
        const gap = getHourDifference(time, otherTime);
        if (gap < conflict.minGapHours) {
          return false; // Violates required drug spacing
        }
      }
    }
  }

  // 4. FOOD DEPENDENCY: Must take relative to breakfast/lunch/dinner if required
  if (med.mustTakeWith) {
    const isClose = isNearMeal(time, med.mustTakeWith, prefs.mealTimes);
    if (!isClose) return false;
  }

  return true;
}

/**
 * Calculates a preference/optimality score (0-100) for a given slot.
 * Used for post-solver sorting and chronotherapy ranking.
 */
export function scoreSoftConstraints(med, time, assignment, prefs) {
  let score = 50; // Starting baseline

  // 1. CHRONOTHERAPY OPTIMAL TIME
  if (med.chronoOptimal && med.chronoOptimal !== 'any') {
    const optimalWindow = getChronotherapyWindow(med.chronoOptimal, prefs);
    const isWithin = isTimeWithinWindow(time, optimalWindow.start, optimalWindow.end);
    if (isWithin) {
      score += 30; // Substantial boost for matching bio-timing
    }
  }

  // 2. MINIMIZE DAILY INTERRUPTIONS (Clustering)
  // Check if there are other medications already assigned near this time slot.
  // This helps patients take their medications together rather than waking up repeatedly.
  let nearCount = 0;
  for (const otherMedId of Object.keys(assignment)) {
    if (otherMedId === med.id) continue;
    const otherDoses = assignment[otherMedId] || [];
    for (const otherTime of otherDoses) {
      const gapMinutes = getHourDifference(time, otherTime) * 60;
      if (gapMinutes <= 45) { // Within 45 minutes
        nearCount++;
      }
    }
  }
  if (nearCount > 0) {
    score += 15; // Small boost for grouping meds
  }

  // 3. PATIENT ROUTINE ALIGNMENT
  // Prefer slots aligned with user milestones (wake time, meals, sleep)
  const distances = [
    getHourDifference(time, prefs.wakeTime),
    getHourDifference(time, prefs.sleepTime),
    getHourDifference(time, prefs.mealTimes.breakfast),
    getHourDifference(time, prefs.mealTimes.lunch),
    getHourDifference(time, prefs.mealTimes.dinner)
  ];
  const minDistance = Math.min(...distances);
  if (minDistance <= 0.5) { // Within 30 minutes of a major routine point
    score += 5;
  }

  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Time Utility Helpers
// ---------------------------------------------------------------------------

function getHourDifference(t1, t2) {
  const [h1, m1] = t1.split(':').map(Number);
  const [h2, m2] = t2.split(':').map(Number);
  const diffMin = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
  // Handles 24h wraps (e.g. 23:00 to 01:00 is 2 hours, not 22)
  const minWrapped = Math.min(diffMin, 1440 - diffMin);
  return minWrapped / 60;
}

function isDuringSleep(time, wake, sleep) {
  const [tH, tM] = time.split(':').map(Number);
  const [wH, wM] = wake.split(':').map(Number);
  const [sH, sM] = sleep.split(':').map(Number);

  const tVal = tH * 60 + tM;
  const wVal = wH * 60 + wM;
  const sVal = sH * 60 + sM;

  if (sVal > wVal) {
    // Normal sleep (e.g., 23:00 to 07:00)
    return tVal >= sVal || tVal < wVal;
  } else {
    // Wrapped sleep (e.g. sleep at 01:00, wake at 08:00)
    return tVal >= sVal && tVal < wVal;
  }
}

function isNearMeal(time, mealType, mealTimes) {
  if (mealType === 'food') {
    // Near ANY meal (breakfast, lunch, or dinner)
    return ['breakfast', 'lunch', 'dinner'].some(meal => 
      getHourDifference(time, mealTimes[meal]) <= 0.75 // Within 45 minutes
    );
  }
  
  const targetMeal = mealTimes[mealType];
  if (!targetMeal) return false;
  return getHourDifference(time, targetMeal) <= 0.75;
}

function getChronotherapyWindow(chrono, prefs) {
  const [wakeH, wakeM] = prefs.wakeTime.split(':').map(Number);
  const wakeVal = wakeH * 60 + wakeM;

  switch (chrono) {
    case 'morning':
      return { start: prefs.wakeTime, end: formatMinutes(wakeVal + 180) }; // 3h after wake
    case 'evening':
      return { start: '17:00', end: '20:30' };
    case 'bedtime':
      return { start: formatMinutes(wakeVal - 90), end: prefs.sleepTime }; // 1.5h before sleep to sleep
    default:
      return { start: '00:00', end: '23:59' };
  }
}

function isTimeWithinWindow(time, start, end) {
  const tVal = parseTimeToMinutes(time);
  const sVal = parseTimeToMinutes(start);
  const eVal = parseTimeToMinutes(end);

  if (eVal >= sVal) {
    return tVal >= sVal && tVal <= eVal;
  } else {
    // Wrapped window (spans midnight)
    return tVal >= sVal || tVal <= eVal;
  }
}

function parseTimeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(min) {
  const norm = (min + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
