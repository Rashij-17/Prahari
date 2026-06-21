// deps: react
import React from 'react';

// Deterministic HSL color generator for medicine chips
export function getMedColor(name) {
  let hash = 0;
  const str = name || "";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Curated clinical colors hue range: 160 (teal) to 320 (violet/purple/pink)
  const h = Math.abs(hash % 200) + 140; 
  return `hsl(${h}, 65%, 42%)`;
}

export default function TimelineChart({ schedule, lang }) {
  // Generate 24 hour markers
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Convert time "HH:MM" to percent of day (for positioning)
  const getTimePercent = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const totalMinutes = h * 60 + m;
    return (totalMinutes / 1440) * 100;
  };

  return (
    <div className="card" style={{
      borderRadius: '16px',
      marginTop: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontFamily: 'var(--font-display)',
        margin: '0 0 1.5rem',
        color: 'var(--color-ink)',
      }}>
        ⏱️ {lang === 'hi' ? '२४-घंटे की समय सारणी' : '24-Hour Timeline Flow'}
      </h3>

      {/* Horizontal Timeline Scroll Container */}
      <div style={{
        overflowX: 'auto',
        position: 'relative',
        paddingBottom: '2.5rem',
        paddingTop: '2.5rem',
        minWidth: '100%',
        scrollbarWidth: 'thin',
      }}>
        {/* The Timeline Track line */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: '2px',
          background: 'linear-gradient(to right, var(--color-border), var(--color-forest), var(--color-border))',
          zIndex: 1,
        }} />

        {/* Hour Markers */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative',
          width: '1000px', // Fixed wide track to allow scrolling
          height: '140px',
        }}>
          {hours.map(h => {
            const timePct = (h / 24) * 100;
            return (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  left: `${timePct}%`,
                  top: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 2,
                }}
              >
                {/* Tick */}
                <div style={{
                  width: '1px',
                  height: '12px',
                  background: 'var(--color-muted)',
                  marginBottom: '4px',
                }} />
                {/* Label */}
                <span style={{
                  fontSize: '9px',
                  color: 'var(--color-muted)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            );
          })}

          {/* Dose Chips overlay */}
          {schedule.map((dose, idx) => {
            const pct = getTimePercent(dose.time);
            const medColor = getMedColor(dose.name);
            const isTop = idx % 2 === 0; // Stagger chips top/bottom to avoid overlapping

            return (
              <div
                key={dose.id}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: isTop ? '5px' : '75px',
                  transform: 'translateX(-50%)',
                  zIndex: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Connecting dot to track */}
                <div style={{
                  position: 'absolute',
                  top: isTop ? '55px' : '-13px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: medColor,
                  border: '2px solid var(--color-white)',
                }} />

                {/* Vertical connecting line */}
                <div style={{
                  position: 'absolute',
                  top: isTop ? '35px' : '-8px',
                  width: '1px',
                  height: '24px',
                  borderLeft: `1px dashed ${medColor}`,
                }} />

                {/* Pill Card */}
                <div style={{
                  background: 'var(--color-white)',
                  border: `1.5px solid ${medColor}`,
                  borderRadius: '10px',
                  padding: '6px 10px',
                  width: '120px',
                  boxShadow: 'var(--shadow-sm)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {lang === 'hi' ? dose.nameHindi : dose.name}
                  </div>
                  <div style={{
                    fontSize: '9px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-forest)',
                    marginTop: '2px',
                    fontWeight: 600,
                  }}>
                    {dose.time}
                  </div>
                  <div style={{
                    fontSize: '8px',
                    color: 'var(--color-muted)',
                    marginTop: '1px',
                  }}>
                    {dose.label}
                  </div>
                  {dose.warnings.length > 0 && (
                    <div style={{
                      fontSize: '7.5px',
                      color: 'var(--color-warning)',
                      fontWeight: 'bold',
                      marginTop: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                    }}>
                      ⚠️ Warning
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
