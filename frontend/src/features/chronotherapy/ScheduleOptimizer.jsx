// deps: react, react-router-dom
import React, { useState, useEffect } from 'react';
import { getMedicines } from '../../services/medicineCabinetDB.js';
import { MedicationCSPSolver } from './csp-solver.js';
import TimelineChart from './TimelineChart.jsx';
import pillData from '../pill-scan/pill-data.json';
import { t } from '../../shared/bilingual.js';
import { logError } from '../../shared/error-handler.jsx';

export default function ScheduleOptimizer() {
  const [lang, setLang] = useState('en');
  const [step, setStep] = useState(1); // 1 = Input, 2 = Processing, 3 = Result
  const [activeStepText, setActiveStepText] = useState('');
  
  // Patient Routine Preferences
  const [prefs, setPrefs] = useState({
    wakeTime: '07:00',
    sleepTime: '22:30',
    mealTimes: {
      breakfast: '08:30',
      lunch: '13:30',
      dinner: '20:30'
    }
  });

  // Selected Medications
  const [medsList, setMedsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Solver outputs
  const [solverResult, setSolverResult] = useState(null);

  // Load existing medicines from cabinet on mount to pre-populate list
  useEffect(() => {
    getMedicines()
      .then(cabinetMeds => {
        if (cabinetMeds && cabinetMeds.length > 0) {
          // Map cabinet medicines to our solver schema
          const mapped = cabinetMeds.map(c => {
            // Find in pill-data template if exists to get halfLife/avoid fields
            const template = pillData.find(p => p.name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(p.name.toLowerCase()));
            
            // Map frequency string to dosesPerDay integer
            let doses = 1;
            if (c.frequency === 'BD' || c.frequency === 'BID') doses = 2;
            else if (c.frequency === 'TDS' || c.frequency === 'TID') doses = 3;
            else if (c.frequency === 'QID') doses = 4;
            
            return {
              id: c.id,
              name: c.name,
              nameHindi: template?.nameHindi || c.name,
              dosesPerDay: doses,
              intervalHours: template?.intervalHours || 6,
              mustTakeWith: template?.mustTakeWith || null,
              avoidWith: template?.avoidWith || [],
              conflictsWith: template?.conflictsWith || [],
              chronoOptimal: template?.chronoOptimal || 'any',
              halfLifeHours: template?.halfLifeHours || 6,
              category: template?.category || 'General'
            };
          });
          setMedsList(mapped);
        }
      })
      .catch(err => console.error("Error loading medicines for optimizer:", err));
  }, []);

  // Search local formulary
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    const filtered = pillData.filter(
      p => p.name.toLowerCase().includes(query.toLowerCase()) || 
           (p.category && p.category.toLowerCase().includes(query.toLowerCase()))
    );
    setSearchResults(filtered);
  };

  const addMed = (med) => {
    if (medsList.some(m => m.id === med.id)) return;
    setMedsList([...medsList, med]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeMed = (id) => {
    setMedsList(medsList.filter(m => m.id !== id));
  };

  const handleGenerate = () => {
    if (medsList.length === 0) return;
    setStep(2); // Move to Processing Stepper

    // Step-by-step animated loader log simulation
    const steps = [
      { text: t(lang, 'optimizing_step_1'), delay: 400 },
      { text: t(lang, 'optimizing_step_2'), delay: 900 },
      { text: t(lang, 'optimizing_step_3'), delay: 1400 },
      { text: t(lang, 'optimizing_step_4'), delay: 1900 }
    ];

    steps.forEach((s, idx) => {
      setTimeout(() => {
        setActiveStepText(s.text);
        if (idx === steps.length - 1) {
          // Trigger Solver solve when complete
          setTimeout(() => {
            runSolver();
          }, 300);
        }
      }, s.delay);
    });
  };

  const runSolver = () => {
    try {
      const solver = new MedicationCSPSolver(medsList, prefs);
      const output = solver.solve();
      setSolverResult(output);
      setStep(3); // Move to Result Dashboard
    } catch (err) {
      logError('OPENCV_TIMEOUT', err); // Using general computation timeout error code
      setSolverResult({ success: false, reason: "An unexpected error occurred in the scheduler engine." });
      setStep(3);
    }
  };

  // Export reminder to standard .ics file format
  const handleExportICS = () => {
    if (!solverResult || !solverResult.success) return;
    
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Prahari//Medication Reminders//EN\n";
    
    solverResult.schedule.forEach(dose => {
      const [h, m] = dose.time.split(':');
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:med-reminder-${dose.id}@prahari.org\n`;
      icsContent += `DTSTART;TZID=Asia/Kolkata:20260601T${h}${m}00\n`;
      icsContent += `RRULE:FREQ=DAILY\n`;
      icsContent += `SUMMARY:Prahari Rx: Take ${dose.name}\n`;
      icsContent += `DESCRIPTION:Reminder to take ${dose.name} (${dose.label}).\\nCategory: ${dose.category}\\nWarnings: ${dose.warnings.join(', ') || 'None'}\n`;
      icsContent += "END:VEVENT\n";
    });
    
    icsContent += "END:VCALENDAR";
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'prahari_medication_schedule.ics';
    link.click();
  };

  // Trigger browser print window (which runs CSS @media print styling)
  const handlePrintPDF = () => {
    window.print();
  };

  const handleExportJSON = () => {
    if (!solverResult || !solverResult.success) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(solverResult.schedule, null, 2));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "prahari_schedule.json");
    link.click();
  };

  // Styling - uses CSS variables for theme consistency

  return (
    <div style={{
      maxWidth: '720px',
      margin: '0 auto',
      paddingBottom: '5rem',
      fontFamily: 'var(--font-sans)',
      textAlign: 'left'
    }}>
      
      {/* Header Panel */}
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1rem',
        borderBottom: `1.5px solid var(--color-border)`
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', margin: 0 }}>
            🗓️ {t(lang, 'scheduler_title')}
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '12.5px', color: 'var(--color-muted)' }}>
            {t(lang, 'scheduler_subtitle')}
          </p>
        </div>
        <button
          onClick={() => setLang(l => l === 'en' ? 'hi' : 'en')}
          style={{
            background: 'var(--color-cream)',
            border: `1.5px solid var(--color-border)`,
            padding: '4px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          {lang === 'en' ? 'हिन्दी' : 'English'}
        </button>
      </div>

      {/* STEP 1: Medication and Routine Input Form */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1.5rem' }}>
          
          {/* Medication Selector Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem' }}>
              💊 {t(lang, 'med_list')}
            </h3>

            {/* Local Search Input */}
            <div className="search-wrapper" style={{ marginBottom: '1rem' }}>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t(lang, 'add_med_placeholder')}
                aria-label="Search and Add Medication"
                className="input-base"
              />
              
              {/* Floating search results */}
              {searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--color-white)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 100,
                  maxHeight: '200px',
                  overflowY: 'auto',
                }}>
                  {searchResults.map(med => (
                    <button
                      key={med.id}
                      onClick={() => addMed(med)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--color-border)',
                        background: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{med.name}</span>
                      <span style={{ color: 'var(--color-muted)', fontSize: '11px' }}>{med.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* List of currently added medicines */}
            {medsList.length === 0 ? (
              <div style={{ color: 'var(--color-faint)', fontSize: '12px', textAlign: 'center', padding: '1.5rem' }}>
                {t(lang, 'empty_scheduler')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {medsList.map(med => (
                  <div key={med.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--color-cream)',
                    borderRadius: '10px',
                    padding: '8px 12px',
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        {lang === 'hi' ? med.nameHindi : med.name}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                        <span className="chip chip-neutral" style={{ fontSize: '8px' }}>
                          {med.dosesPerDay} {med.dosesPerDay > 1 ? 'doses/day' : 'dose/day'}
                        </span>
                        {med.mustTakeWith && (
                          <span className="chip chip-info" style={{ fontSize: '8px' }}>
                            🍽️ {med.mustTakeWith}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeMed(med.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-critical)',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '4px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Routine preferences Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem' }}>
              🕒 {t(lang, 'pref_title')}
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
            }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
                  🌅 {t(lang, 'wake_time')}
                </label>
                <input
                  type="time"
                  value={prefs.wakeTime}
                  onChange={(e) => setPrefs({ ...prefs, wakeTime: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', colorScheme: 'light dark' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
                  🌙 {t(lang, 'sleep_time')}
                </label>
                <input
                  type="time"
                  value={prefs.sleepTime}
                  onChange={(e) => setPrefs({ ...prefs, sleepTime: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', colorScheme: 'light dark' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
                  🥣 {t(lang, 'breakfast_time')}
                </label>
                <input
                  type="time"
                  value={prefs.mealTimes.breakfast}
                  onChange={(e) => setPrefs({ ...prefs, mealTimes: { ...prefs.mealTimes, breakfast: e.target.value } })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', colorScheme: 'light dark' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
                  🥪 {t(lang, 'lunch_time')}
                </label>
                <input
                  type="time"
                  value={prefs.mealTimes.lunch}
                  onChange={(e) => setPrefs({ ...prefs, mealTimes: { ...prefs.mealTimes, lunch: e.target.value } })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', colorScheme: 'light dark' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>
                  🍛 {t(lang, 'dinner_time')}
                </label>
                <input
                  type="time"
                  value={prefs.mealTimes.dinner}
                  onChange={(e) => setPrefs({ ...prefs, mealTimes: { ...prefs.mealTimes, dinner: e.target.value } })}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-white)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', colorScheme: 'light dark' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={medsList.length === 0}
            className="btn-primary-forest"
            style={{
              width: '100%',
              padding: '12px',
              opacity: medsList.length === 0 ? 0.6 : 1,
              cursor: medsList.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ⚡ {t(lang, 'btn_optimize')}
          </button>
        </div>
      )}

      {/* STEP 2: Processing Simulator */}
      {step === 2 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
        }}>
          <div className="solver-spinner" />
          <p style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-forest)',
            animation: 'pulse 1.5s infinite',
          }}>
            {activeStepText}
          </p>

          <style>{`
            .solver-spinner {
              width: 44px;
              height: 44px;
              border: 4px solid var(--color-cream);
              border-top: 4px solid var(--color-forest);
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* STEP 3: Results Timeline and Schedule Dashboard */}
      {step === 3 && solverResult && (
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {solverResult.success ? (
            <>
              {/* Visual Horizontal Timeline */}
              <TimelineChart schedule={solverResult.schedule} lang={lang} />

              {/* Warnings Panel */}
              {solverResult.warnings.length > 0 && (
                <div style={{
                  background: 'var(--color-warning-bg)',
                  border: '1.5px solid var(--color-warning-border)',
                  borderRadius: '12px',
                  padding: '1rem',
                }}>
                  <h4 style={{ color: 'var(--color-warning)', margin: '0 0 0.5rem', fontSize: '13px', fontWeight: 'bold' }}>
                    ⚠️ {t(lang, 'conflict_detected')}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
                    {solverResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Daily Dose list */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span className="section-label" style={{ margin: 0 }}>
                    {t(lang, 'dose_chips')}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted)' }}>
                    {solverResult.schedule.length} {t(lang, 'total_doses')}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {solverResult.schedule.map(dose => (
                    <div key={dose.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-paper)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          background: 'var(--color-cream)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}>
                          {dose.time}
                        </span>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {lang === 'hi' ? dose.nameHindi : dose.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-muted)', marginTop: '2px' }}>
                            {dose.label} · {dose.category}
                          </span>
                        </div>
                      </div>

                      {dose.warnings.length > 0 && (
                        <span className="chip chip-moderate" style={{ fontSize: '8px' }}>
                          Spacing Alert
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
              }}>
                <button onClick={handleExportICS} className="btn-secondary" style={{ fontSize: '11.5px', padding: '10px' }}>
                  📅 {t(lang, 'export_ics')}
                </button>
                <button onClick={handlePrintPDF} className="btn-secondary" style={{ fontSize: '11.5px', padding: '10px' }}>
                  🖨️ {t(lang, 'export_pdf')}
                </button>
                <button onClick={handleExportJSON} className="btn-secondary" style={{ fontSize: '11.5px', padding: '10px' }}>
                  💾 Export JSON
                </button>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <span style={{ fontSize: '2.5rem' }}>⚠️</span>
              <h4 style={{ color: 'var(--color-critical)', margin: '1rem 0 0.5rem' }}>
                No Schedule Found
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: 0 }}>
                {solverResult.reason || t(lang, 'no_solution')}
              </p>
            </div>
          )}

          {/* Stepper Navigation */}
          <button
            onClick={() => setStep(1)}
            className="btn-primary-forest"
            style={{ width: '100%', padding: '12px' }}
          >
            ← Modify Input Medication List
          </button>
        </div>
      )}
    </div>
  );
}
