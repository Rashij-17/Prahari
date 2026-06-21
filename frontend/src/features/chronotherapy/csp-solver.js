// deps: none
// Medication constraint satisfaction solver using AC-3 and Backtracking search

import { verifyHardConstraints, scoreSoftConstraints } from './constraint-rules.js';

export class MedicationCSPSolver {
  /**
   * @param {Array} medications - Array of medication objects to schedule
   * @param {object} patientPrefs - Patient routine times: { wakeTime, sleepTime, mealTimes: { breakfast, lunch, dinner } }
   */
  constructor(medications, patientPrefs) {
    this.meds = medications;
    this.prefs = patientPrefs;
    this.slots = this.generateTimeSlots(); // All 30-min slots in 24h: ["00:00", "00:30", ..., "23:30"]
    
    // Generate variables: split multi-dose medications into dose variables (e.g. "med_001_1", "med_001_2")
    this.variables = [];
    this.varToMedMap = {};
    
    this.meds.forEach(med => {
      const doses = med.dosesPerDay || 1;
      for (let d = 1; d <= doses; d++) {
        const varId = `${med.id}_${d}`;
        this.variables.push(varId);
        this.varToMedMap[varId] = med;
      }
    });
  }

  /** Generates 30-minute intervals for a 24h period */
  generateTimeSlots() {
    const list = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        list.push(timeStr);
      }
    }
    return list;
  }

  /** Step 1: Generate valid domains for each dose variable */
  generateDomains() {
    const domains = {};
    this.variables.forEach(varId => {
      const med = this.varToMedMap[varId];
      // Filter out slots that violate initial unary constraints (like sleep exclusion)
      domains[varId] = this.slots.filter(slot => {
        return verifyHardConstraints(med, slot, {}, this.meds, this.prefs);
      });
    });
    return domains;
  }

  /** Step 2: Arc Consistency (AC-3) algorithm to prune domains */
  ac3(domains) {
    // Generate pairs of variables (arcs) that have constraints
    const queue = [];
    for (let i = 0; i < this.variables.length; i++) {
      for (let j = i + 1; j < this.variables.length; j++) {
        queue.push([this.variables[i], this.variables[j]]);
        queue.push([this.variables[j], this.variables[i]]);
      }
    }

    while (queue.length > 0) {
      const [xi, xj] = queue.shift();
      if (this.revise(domains, xi, xj)) {
        if (domains[xi].length === 0) {
          return false; // No solution possible (domain empty)
        }
        // Add neighboring arcs back to queue
        this.getNeighbors(xi).forEach(xk => {
          if (xk !== xj) queue.push([xk, xi]);
        });
      }
    }
    return domains;
  }

  /** Revise domain values of Xi relative to Xj */
  revise(domains, xi, xj) {
    let revised = false;
    const medI = this.varToMedMap[xi];
    const medJ = this.varToMedMap[xj];

    const toKeep = [];
    for (const valI of domains[xi]) {
      // Check if there is ANY value in Xj's domain that is consistent with valI
      const hasConsistentVal = domains[xj].some(valJ => {
        // Build mock assignment to verify pair consistency
        const mockAssignment = {
          [medI.id]: [valI],
          [medJ.id]: [valJ]
        };
        // Verify constraint passes
        return verifyHardConstraints(medI, valI, mockAssignment, this.meds, this.prefs) &&
               verifyHardConstraints(medJ, valJ, mockAssignment, this.meds, this.prefs);
      });

      if (hasConsistentVal) {
        toKeep.push(valI);
      } else {
        revised = true;
      }
    }

    domains[xi] = toKeep;
    return revised;
  }

  /** Returns all variables except current variable */
  getNeighbors(varId) {
    return this.variables.filter(v => v !== varId);
  }

  /** Step 3: Backtracking search with MRV heuristic */
  backtrack(assignment, domains) {
    // Base Case: Assignment complete
    if (Object.keys(assignment).length === this.variables.length) {
      return assignment;
    }

    // MRV: Select unassigned variable with fewest remaining valid slots
    const varId = this.selectUnassignedVariable(assignment, domains);
    const med = this.varToMedMap[varId];

    // LCV: Order values using soft chronotherapy scores + constraint checks
    const orderedValues = this.orderDomainValues(varId, domains[varId], assignment);

    for (const val of orderedValues) {
      if (this.isConsistent(varId, val, assignment)) {
        // Add to temporary assignment
        assignment[varId] = val;

        // Clone domains for forward check branching
        const nextDomains = this.cloneDomains(domains);
        nextDomains[varId] = [val];

        // Propagate constraints forward
        const inference = this.ac3(nextDomains);
        if (inference !== false) {
          const result = this.backtrack(assignment, inference);
          if (result !== false) return result;
        }

        // Backtrack
        delete assignment[varId];
      }
    }

    return false; // Triggers backtrack
  }

  /** Selects unassigned variable using Minimum Remaining Values */
  selectUnassignedVariable(assignment, domains) {
    const unassigned = this.variables.filter(v => !assignment[v]);
    
    // Sort by domain size ascending
    unassigned.sort((a, b) => domains[a].length - domains[b].length);
    return unassigned[0];
  }

  /** Orders values according to soft constraint score (highest score first) */
  orderDomainValues(varId, domainValues, assignment) {
    const med = this.varToMedMap[varId];
    
    // Map to mock solver structure
    const tempAssignment = {};
    for (const [v, time] of Object.entries(assignment)) {
      const m = this.varToMedMap[v];
      tempAssignment[m.id] = tempAssignment[m.id] || [];
      tempAssignment[m.id].push(time);
    }

    return [...domainValues].sort((valA, valB) => {
      const scoreA = scoreSoftConstraints(med, valA, tempAssignment, this.prefs);
      const scoreB = scoreSoftConstraints(med, valB, tempAssignment, this.prefs);
      return scoreB - scoreA; // Descending
    });
  }

  /** Assures the value meets hard constraints against current assignments */
  isConsistent(varId, val, assignment) {
    const med = this.varToMedMap[varId];

    // Build medication-grouped assignments from individual dose variables
    const groupedAssignment = {};
    for (const [v, time] of Object.entries(assignment)) {
      const m = this.varToMedMap[v];
      groupedAssignment[m.id] = groupedAssignment[m.id] || [];
      groupedAssignment[m.id].push(time);
    }

    return verifyHardConstraints(med, val, groupedAssignment, this.meds, this.prefs);
  }

  /** Helper to deep clone domain dictionaries */
  cloneDomains(domains) {
    const copy = {};
    Object.keys(domains).forEach(k => {
      copy[k] = [...domains[k]];
    });
    return copy;
  }

  /** Main solve execution method */
  solve() {
    const domains = this.generateDomains();
    const reducedDomains = this.ac3(domains);
    
    if (!reducedDomains) {
      return { success: false, reason: 'No conflict-free schedule possible with these constraints.' };
    }

    const assignment = this.backtrack({}, reducedDomains);
    if (!assignment) {
      return { success: false, reason: 'Constraint solver found no valid arrangement.' };
    }

    // Process variables assignment back to scheduled medication slots
    const scheduleSlots = [];
    const groupedResults = {};

    this.variables.forEach(varId => {
      const med = this.varToMedMap[varId];
      const time = assignment[varId];
      
      groupedResults[med.id] = groupedResults[med.id] || [];
      groupedResults[med.id].push(time);

      // Get appropriate label (e.g. Breakfast, Bedtime, etc.)
      const label = this.getTimeLabel(time);
      const warnings = this.getSlotWarnings(med, time, groupedResults);

      scheduleSlots.push({
        id: varId,
        medicationId: med.id,
        name: med.name,
        nameHindi: med.nameHindi,
        time: time,
        label: label,
        category: med.category || 'General',
        warnings: warnings
      });
    });

    // Sort timeline chronologically
    scheduleSlots.sort((a, b) => a.time.localeCompare(b.time));

    // Calculate alternatives count based on remaining domains
    let alternatives = 1;
    this.variables.forEach(v => {
      if (reducedDomains[v].length > 1) {
        alternatives *= reducedDomains[v].length;
      }
    });

    return {
      success: true,
      schedule: scheduleSlots,
      warnings: this.generateAggregateWarnings(scheduleSlots),
      alternativesCount: Math.min(100, alternatives)
    };
  }

  getTimeLabel(time) {
    const [h] = time.split(':').map(Number);
    const meals = this.prefs.mealTimes;

    if (h < 11) return 'With Breakfast';
    if (h >= 11 && h < 16) return 'With Lunch';
    if (h >= 16 && h < 20) return 'With Dinner';
    return 'At Bedtime';
  }

  /** Evaluates and creates inline warnings for visual cards */
  getSlotWarnings(med, time, assignment) {
    const list = [];
    // Check if food requirement is not met (within 45 mins)
    if (med.mustTakeWith) {
      const isNear = ['breakfast', 'lunch', 'dinner'].some(meal => {
        const mealTime = this.prefs.mealTimes[meal];
        const [mh, mm] = mealTime.split(':').map(Number);
        const [th, tm] = time.split(':').map(Number);
        return Math.abs((mh * 60 + mm) - (th * 60 + tm)) <= 45;
      });
      if (!isNear) {
        list.push(`Take within 45 mins of ${med.mustTakeWith}.`);
      }
    }
    return list;
  }

  generateAggregateWarnings(slots) {
    const warningList = [];
    slots.forEach(slot => {
      if (slot.warnings.length > 0) {
        slot.warnings.forEach(w => {
          warningList.push(`${slot.name}: ${w}`);
        });
      }
    });
    return warningList;
  }
}
