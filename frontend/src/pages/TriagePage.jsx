/**
 * TriagePage
 * ===========
 * Symptom Triage Analyzer — users describe symptoms in plain language
 * and receive an urgency classification + actionable recommendation.
 *
 * States: idle → loading → result | error
 * Source: FEATURES_AND_STRUCTURE.md §2.3
 */

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { assessSymptoms } from '../services/api.js'
import TriageChatbot from '../components/triage/TriageChatbot.jsx'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const URGENCY_CONFIG = {
  safe: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    color: 'var(--color-safe)',
    bg: 'var(--color-safe-bg)',
    cls: 'ribbon-safe'
  },
  moderate: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
    cls: 'ribbon-moderate'
  },
  critical: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    color: 'var(--color-critical)',
    bg: 'var(--color-critical-bg)',
    cls: 'ribbon-critical'
  },
}

const FIRST_AID_GUIDES = [
  {
    id: 'choking',
    title: 'Choking Relief (Heimlich Maneuver)',
    urgency: 'critical',
    steps: [
      'Stand behind the choking person. Wrap your arms around their waist.',
      'Make a fist with one hand. Place the thumb side of your fist against their belly, slightly above their belly button.',
      'Grasp your fist with your other hand. Pull sharply inward and upward into their stomach.',
      'Repeat these quick upward pulls (abdominal thrusts) until the food or object pops out, or until the person passes out.',
      'If the person passes out, lower them gently to the ground and start CPR immediately.'
    ],
    donts: [
      'Do NOT perform abdominal thrusts if the person is coughing strongly or able to speak.',
      'Do NOT blindly sweep your fingers inside their mouth, as you might push the object deeper down their throat.'
    ]
  },
  {
    id: 'bleeding',
    title: 'Severe Bleeding Control',
    urgency: 'critical',
    steps: [
      'Press a clean cloth or bandage firmly directly on the wound with both hands.',
      'Maintain continuous, heavy pressure for at least 5 to 10 minutes without lifting the cloth to check.',
      'If bleeding continues and blood leaks through the cloth, place another cloth on top and keep applying pressure (do NOT remove the first cloth).',
      'Elevate the injured limb above the level of the heart if possible.',
      'If pressure fails to stop life-threatening bleeding on an arm or leg, apply a tourniquet 2 to 3 inches above the wound (never over a joint) and note the exact time.'
    ],
    donts: [
      'Do NOT remove the original dressing once it becomes blood-soaked; always layer new ones on top.',
      'Do NOT wash or clean a large, severely bleeding wound as this can disrupt clotting.'
    ]
  },
  {
    id: 'heartattack',
    title: 'Heart Attack Protocol',
    urgency: 'critical',
    steps: [
      'Call emergency services immediately (112 / 102 / 911).',
      'Have the person sit down, rest, and try to remain calm. Do NOT let them walk or exert themselves.',
      'If the person is conscious and not allergic, have them chew and swallow one adult Aspirin (325mg) or four baby Aspirins.',
      'If the person becomes unconscious and is not breathing, immediately start CPR.',
      'Use the CPR rhythm helper below to maintain a steady rate of 100-120 compressions per minute.'
    ],
    donts: [
      'Do NOT leave the patient unattended.',
      'Do NOT give them anything to eat or drink other than Aspirin.',
      'Do NOT allow the patient to drive themselves to the hospital.'
    ],
    hasTimer: true
  },
  {
    id: 'stroke',
    title: 'Stroke Check (FAST Assessment)',
    urgency: 'critical',
    steps: [
      'F - Face Drooping: Ask the person to smile. Does one side of the face droop or feel numb?',
      'A - Arm Weakness: Ask the person to raise both arms. Does one arm drift downward?',
      'S - Speech Slurred: Ask the person to repeat a simple sentence. Is their speech slurred, strange, or garbled?',
      'T - Time to call: If you observe any of these signs (even if they go away), call emergency services immediately.',
      'Keep the patient laying down on their side (recovery position) if they are breathing but unconscious, to keep their airway clear.'
    ],
    donts: [
      'Do NOT give the patient food, drink, or medications (especially Aspirin) as strokes can be hemorrhagic (bleeding in the brain) and Aspirin will make it worse.',
      'Do NOT let the patient sleep or minimize the symptoms.'
    ]
  },
  {
    id: 'burns',
    title: 'Burns Treatment',
    urgency: 'moderate',
    steps: [
      'Immediately cool the burn under cool, gentle running tap water for 10 to 20 minutes (do NOT use ice or ice-cold water).',
      'Gently remove any jewelry, rings, or tight clothing near the burned area before it starts to swell.',
      'Cover the burn loosely with a clean, sterile, non-adhesive bandage or clean plastic wrap.',
      'For chemical burns, flush the chemical off the skin with large amounts of running water for 20 minutes.'
    ],
    donts: [
      'Do NOT apply ice, ice water, butter, toothpaste, oil, or ointments to the burn; they trap heat and worsen tissue damage.',
      'Do NOT pop or puncture any blisters, as intact blisters protect the skin from infection.'
    ]
  },
  {
    id: 'anaphylaxis',
    title: 'Severe Allergic Reaction (Anaphylaxis)',
    urgency: 'critical',
    steps: [
      'Call emergency services immediately.',
      'Ask the person if they carry an epinephrine auto-injector (EpiPen). If they do, help them use it.',
      'Press the auto-injector firmly into the outer thigh (through clothing is fine) and hold it in place for 3 to 10 seconds.',
      'Massage the injection spot for 10 seconds to help the medicine absorb.',
      'Have the person lie flat on their back with their legs raised about 12 inches, unless they are struggling to breathe (if so, sit them up).'
    ],
    donts: [
      'Do NOT wait to see if the reaction gets better before using the EpiPen.',
      'Do NOT give them oral allergy pills (like Benadryl) if they are struggling to swallow or breathe.'
    ]
  },
  {
    id: 'seizure',
    title: 'Seizure First Aid',
    urgency: 'moderate',
    steps: [
      'Gently guide the person to the floor to prevent them from falling.',
      'Place something soft (like a folded jacket or pillow) under their head to protect it.',
      'Loosen any tight clothing around their neck (like a tie or collar).',
      'Move any sharp or hard objects out of their way to prevent injury.',
      'As soon as the shaking stops, roll them gently onto their side (recovery position) to keep their airway clear.',
      'Time the seizure; call emergency services if the shaking lasts longer than 5 minutes.'
    ],
    donts: [
      'Do NOT hold the person down or try to stop their movements.',
      'Do NOT put anything in the person\'s mouth (they cannot swallow their tongue, and you might choke them or get bitten).'
    ]
  },
  {
    id: 'poisoning',
    title: 'Poisoning & Chemical Exposure',
    urgency: 'critical',
    steps: [
      'If the chemical is on their skin or in their eyes, rinse it off immediately with gentle running water for 15 to 20 minutes.',
      'If they swallowed a toxic substance, identify what it was and how much they took.',
      'Call your local poison control center or emergency services immediately.',
      'If the person is unconscious or not breathing, start CPR immediately.'
    ],
    donts: [
      'Do NOT induce vomiting unless specifically instructed to do so by a medical professional.',
      'Do NOT give them water or milk to drink unless poison control tells you to.'
    ]
  },
  {
    id: 'asthma',
    title: 'Asthma Attack Emergency Care',
    urgency: 'moderate',
    steps: [
      'Help the person sit upright and stay calm. Do NOT let them lie down.',
      'Locate their rescue inhaler (usually blue, e.g., Albuterol).',
      'Have them take 2 to 6 puffs of the inhaler, waiting 1 minute between puffs.',
      'If they do not improve after 5-10 minutes, or if they struggle to speak full sentences, call emergency services.'
    ],
    donts: [
      'Do NOT force the person to lie down; sitting upright makes breathing much easier.',
      'Do NOT allow them to breathe into a paper bag.'
    ]
  },
  {
    id: 'heatstroke',
    title: 'Heat Stroke (Overheating)',
    urgency: 'critical',
    steps: [
      'Move the person out of the sun and into a cool, shaded, or air-conditioned space.',
      'Cool them down quickly by spraying them with cool water, wrapping them in wet sheets, or placing ice packs on their neck, armpits, and groin.',
      'If they are conscious and alert, offer them cool water or sports drinks to sip slowly.',
      'Call emergency services if they are confused, pass out, or have a temperature above 40°C (104°F).'
    ],
    donts: [
      'Do NOT give them ice-cold drinks to gulp down quickly.',
      'Do NOT give them aspirin or fever reducers, as they do not help environmental heat stroke.'
    ]
  },
  {
    id: 'fainting',
    title: 'Fainting & Dizziness',
    urgency: 'moderate',
    steps: [
      'Help the person lay flat on their back.',
      'Raise their feet about 12 inches (30 cm) off the ground to restore blood flow to the brain.',
      'Loosen any tight collars, belts, or clothing.',
      'Make sure they get fresh air (fan them or open a window).',
      'If they do not wake up within 1 minute, call emergency services and roll them onto their side.'
    ],
    donts: [
      'Do NOT let the person stand up too quickly after waking up.',
      'Do NOT throw cold water on their face or slap them to wake them up.'
    ]
  },
  {
    id: 'fracture',
    title: 'Fractures & Sprains',
    urgency: 'moderate',
    steps: [
      'Keep the injured area completely still. Do NOT try to straighten a bent bone.',
      'Apply a cold ice pack wrapped in a cloth to the area to reduce swelling (do not put ice directly on the skin).',
      'If there is an open wound with bleeding, place a clean cloth over it and apply gentle pressure around the bone (not directly on it).',
      'Support the limb using a temporary splint (rolled newspapers, wood, or cardboard) tied loosely above and below the injury.'
    ],
    donts: [
      'Do NOT try to push a bone back into the skin if it has broken through.',
      'Do NOT move the person if you suspect a back, neck, or spine injury.'
    ]
  }
];

function CprTimer() {
  const [isActive, setIsActive] = useState(false);
  const [count, setCount] = useState(0);
  const [isPulse, setIsPulse] = useState(false);
  const timerRef = useRef(null);

  const toggleTimer = () => {
    if (isActive) {
      clearInterval(timerRef.current);
      setIsActive(false);
    } else {
      setIsActive(true);
      setCount(0);
      
      const intervalMs = (60 / 110) * 1000;
      timerRef.current = setInterval(() => {
        setCount(prev => {
          const nextVal = prev + 1;
          
          try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.08);
            osc.stop(audioCtx.currentTime + 0.08);
          } catch (e) {}
          
          setIsPulse(true);
          setTimeout(() => setIsPulse(false), 120);
          
          return nextVal;
        });
      }, intervalMs);
    }
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div style={{
      backgroundColor: 'var(--color-cream)',
      borderRadius: '12px',
      padding: '1.25rem',
      marginTop: '1.25rem',
      border: '1.5px solid var(--color-border)',
      textAlign: 'center'
    }}>
      <h4 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
        CPR Compression Rhythm Helper
      </h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0 0 1rem' }}>
        Aids rescuers in maintaining a steady rate of 110 compressions per minute.
      </p>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: isPulse ? 'var(--color-critical)' : 'var(--color-border-strong)',
          transform: isPulse ? 'scale(1.15)' : 'scale(1)',
          transition: 'all 0.08s ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isPulse ? '0 0 16px rgba(185, 28, 28, 0.4)' : 'none',
        }}>
          <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.75rem' }}>PULSE</span>
        </div>

        <div style={{ textAlign: 'left' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-faint)', fontWeight: 600 }}>
            Count
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {count}
          </div>
        </div>
      </div>

      <button
        onClick={toggleTimer}
        className={isActive ? 'btn-secondary' : 'btn-primary'}
        style={{
          width: '100%',
          padding: '0.625rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          borderColor: isActive ? 'var(--color-critical)' : '',
          color: isActive ? 'var(--color-critical)' : '',
          background: isActive ? 'transparent' : '',
        }}
      >
        {isActive ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop Metronome
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Metronome (110 BPM)
          </>
        )}
      </button>
    </div>
  );
}

function UrgencyResult({ result, onReset }) {
  const cfg = URGENCY_CONFIG[result.urgency_level] || URGENCY_CONFIG.moderate

  return (
    <div className="modal-enter">
      {/* Main urgency card */}
      <div
        className={`card ${cfg.cls}`}
        style={{
          backgroundColor: 'var(--color-white)',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          borderLeftWidth: '4px',
          textAlign: 'left'
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.875rem', color: cfg.color }}>
          <div style={{ display: 'flex', color: cfg.color }}>{cfg.icon}</div>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '1.25rem',
            color: 'var(--color-ink)',
            margin: 0,
            fontWeight: 700
          }}>
            {result.urgency_label}
          </h2>
        </div>
        <p style={{ color: 'var(--color-muted)', margin: 0, lineHeight: 1.6, fontSize: '0.9375rem' }}>
          {result.recommendation}
        </p>
      </div>

      {/* Mock notice */}
      {result.is_mock && result.mock_notice && (
        <div style={{
          backgroundColor: 'var(--color-cream)',
          borderRadius: '10px',
          padding: '0.875rem 1.125rem',
          fontSize: '0.825rem',
          color: 'var(--color-muted)',
          marginBottom: '1.25rem',
          border: '1px solid var(--color-border)',
          textAlign: 'left'
        }}>
          {result.mock_notice}
        </div>
      )}

      {/* Top conditions */}
      {result.conditions?.length > 0 && (
        <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.875rem', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>
            Most Likely Conditions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.conditions.map((c, i) => (
              <div key={i} className="card" style={{
                padding: '0.875rem 1.125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--color-white)',
                borderColor: 'var(--color-border)',
                borderRadius: '10px',
                transform: 'none',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-ink)', fontSize: '0.9rem' }}>
                  {c.name}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '80px',
                    height: '6px',
                    backgroundColor: 'var(--color-cream)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round(c.probability * 100)}%`,
                      height: '100%',
                      backgroundColor: 'var(--color-forest)',
                      borderRadius: '99px'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.785rem', color: 'var(--color-muted)', fontWeight: 600, minWidth: '32px', textAlign: 'right' }}>
                    {Math.round(c.probability * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        fontSize: '0.775rem',
        color: 'var(--color-muted)',
        lineHeight: 1.6,
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.875rem',
        margin: '0 0 1.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        textAlign: 'left'
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.125rem', color: 'var(--color-faint)' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          This assessment is for educational purposes only and does not constitute medical advice.
          Always consult a qualified healthcare professional for medical decisions.
        </span>
      </div>

      <div style={{ textAlign: 'left' }}>
        <button
          id="triage-reset-btn"
          className="btn-primary-forest"
          onClick={onReset}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
          </svg>
          Assess New Symptoms
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const SYMPTOM_EXAMPLES = [
  'I have a severe headache and stiff neck with fever since yesterday',
  'Chest pain radiating to my left arm, feeling dizzy and short of breath',
  'I have a mild cough, runny nose, and slight sore throat for 2 days',
  'Sharp stomach pain in lower right side that gets worse when I move',
]

export default function TriagePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'triage'
  const [expandedGuide, setExpandedGuide] = useState(null)

  const [phase,    setPhase]    = useState('idle')
  const [symptoms, setSymptoms] = useState('')
  const [sex,      setSex]      = useState('male')
  const [age,      setAge]      = useState(30)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState('')

  const handleAssess = async () => {
    if (symptoms.trim().length < 5) return
    setPhase('loading')
    setError('')

    try {
      const data = await assessSymptoms({ symptoms, sex, age })
      setResult(data)
      setPhase('result')
    } catch (err) {
      setError(err.message || 'Triage assessment failed. Please try again.')
      setPhase('error')
    }
  }

  const reset = () => {
    setResult(null)
    setSymptoms('')
    setPhase('idle')
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '2rem',
        gap: '1.5rem',
      }}>
        <button
          onClick={() => setSearchParams({ tab: 'triage' })}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.9375rem',
            fontWeight: activeTab === 'triage' ? 700 : 500,
            color: activeTab === 'triage' ? 'var(--color-forest)' : 'var(--color-muted)',
            borderBottom: activeTab === 'triage' ? '2.5px solid var(--color-forest)' : '2.5px solid transparent',
            marginBottom: '-1.5px',
            transition: 'var(--transition-fast)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          Quick Triage
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'chat' })}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.9375rem',
            fontWeight: activeTab === 'chat' ? 700 : 500,
            color: activeTab === 'chat' ? 'var(--color-forest)' : 'var(--color-muted)',
            borderBottom: activeTab === 'chat' ? '2.5px solid var(--color-forest)' : '2.5px solid transparent',
            marginBottom: '-1.5px',
            transition: 'var(--transition-fast)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          Conversational Chat
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'firstaid' })}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.25rem',
            fontSize: '0.9375rem',
            fontWeight: activeTab === 'firstaid' ? 700 : 500,
            color: activeTab === 'firstaid' ? 'var(--color-forest)' : 'var(--color-muted)',
            borderBottom: activeTab === 'firstaid' ? '2.5px solid var(--color-forest)' : '2.5px solid transparent',
            marginBottom: '-1.5px',
            transition: 'var(--transition-fast)',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          Emergency First Aid
        </button>
      </div>

      {activeTab === 'triage' ? (
        <>
          {/* Heading */}
          {phase !== 'result' && (
            <div style={{ marginBottom: '1.75rem', textAlign: 'left' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
                Symptom Triage Analyzer
              </h1>
              <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
                Describe your symptoms in plain language. Prahari will assess urgency and
                recommend your next step — self-care, doctor visit, or emergency.
              </p>
            </div>
          )}

          {/* === IDLE / FORM === */}
          {(phase === 'idle' || phase === 'error') && (
            <div style={{ textAlign: 'left' }}>
              {/* Symptom text area */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label
                  htmlFor="symptom-input"
                  style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-ink)', fontSize: '0.9rem' }}
                >
                  Describe your symptoms
                </label>
                <textarea
                  id="symptom-input"
                  value={symptoms}
                  onChange={e => setSymptoms(e.target.value)}
                  placeholder="e.g. I have a fever of 39°C, severe headache, and stiff neck for the past 6 hours…"
                  rows={5}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '10px',
                    border: '1.5px solid var(--color-border)',
                    backgroundColor: 'var(--color-white)',
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.9375rem',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box',
                    lineHeight: 1.6,
                    transition: 'var(--transition-fast)',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--color-forest)';
                    e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--color-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <p style={{ fontSize: '0.785rem', color: 'var(--color-muted)', margin: '0.375rem 0 0' }}>
                  Include symptom duration, severity (1–10), and any relevant medical history.
                </p>
              </div>

              {/* Patient context */}
              <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label htmlFor="sex-select" style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                    Biological sex
                  </label>
                  <select
                    id="sex-select"
                    value={sex}
                    onChange={e => setSex(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.875rem',
                      borderRadius: '9px',
                      border: '1.5px solid var(--color-border)',
                      backgroundColor: 'var(--color-white)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9375rem',
                      outline: 'none',
                      transition: 'var(--transition-fast)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--color-forest)';
                      e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--color-border)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label htmlFor="age-input" style={{ display: 'block', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                    Age
                  </label>
                  <input
                    id="age-input"
                    type="number"
                    min={1} max={120}
                    value={age}
                    onChange={e => setAge(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.875rem',
                      borderRadius: '9px',
                      border: '1.5px solid var(--color-border)',
                      backgroundColor: 'var(--color-white)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.9375rem',
                      outline: 'none',
                      transition: 'var(--transition-fast)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--color-forest)';
                      e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--color-border)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Quick examples */}
              <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-muted)', marginBottom: '0.625rem' }}>
                Try an example:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.75rem' }}>
                {SYMPTOM_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setSymptoms(ex)}
                    style={{
                      textAlign: 'left',
                      padding: '0.625rem 1rem',
                      borderRadius: '9px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-white)',
                      color: 'var(--color-muted)',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      lineHeight: 1.45,
                      transition: 'var(--transition-fast)',
                      outline: 'none',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'var(--color-forest)';
                      e.target.style.color = 'var(--color-ink)';
                      e.target.style.boxShadow = '0 0 0 3px var(--color-forest-glow)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'var(--color-border)';
                      e.target.style.color = 'var(--color-muted)';
                      e.target.style.boxShadow = 'none';
                    }}
                    onMouseEnter={e => {
                      e.target.style.borderColor = 'var(--color-forest)';
                      e.target.style.color = 'var(--color-ink)';
                    }}
                    onMouseLeave={e => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = 'var(--color-border)';
                        e.target.style.color = 'var(--color-muted)';
                      }
                    }}
                  >
                    "{ex}"
                  </button>
                ))}
              </div>

              {/* Error */}
              {phase === 'error' && (
                <div className="card ribbon-moderate" style={{ padding: '0.875rem 1.125rem', marginBottom: '1.5rem', borderLeftWidth: '3px', backgroundColor: 'var(--color-warning-bg)' }}>
                  <p style={{ color: 'var(--color-warning)', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{error}</p>
                </div>
              )}

              <button
                id="triage-submit-btn"
                className="btn-primary"
                onClick={handleAssess}
                disabled={symptoms.trim().length < 5}
                style={{
                  opacity: symptoms.trim().length < 5 ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: 'auto'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.8 3A2.4 2.4 0 1 0 9.6 3A2.4 2.4 0 1 0 4.8 3z"/>
                  <path d="M14.4 3A2.4 2.4 0 1 0 19.2 3A2.4 2.4 0 1 0 14.4 3z"/>
                  <path d="M7.2 5.4v4.2a4.8 4.8 0 0 0 9.6 0V5.4"/>
                  <path d="M12 9.6v5.4a3 3 0 0 0 6 0v-1.2"/>
                  <circle cx="18" cy="11.4" r="2"/>
                </svg>
                Assess My Symptoms
              </button>
            </div>
          )}

          {/* === LOADING === */}
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem' }}>
              <div className="pulse-ring" style={{ width: '64px', height: '64px', margin: '0 auto 1.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                  <path d="M16 2L4 7v9c0 6.627 5.373 12 12 12s12-5.373 12-12V7L16 2z"
                    fill="var(--color-forest-subtle)" stroke="var(--color-forest)" strokeWidth="1.75" />
                  <rect x="14" y="9" width="4" height="14" rx="1.5" fill="var(--color-forest)" />
                  <rect x="9" y="14" width="14" height="4" rx="1.5" fill="var(--color-forest)" />
                </svg>
              </div>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.9375rem', fontWeight: 500 }}>
                Analysing your symptoms…
              </p>
            </div>
          )}

          {/* === RESULT === */}
          {phase === 'result' && result && (
            <UrgencyResult result={result} onReset={reset} />
          )}
        </>
      ) : activeTab === 'chat' ? (
        <div style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
              Conversational Triage Chatbot
            </h1>
            <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
              Engage in a multi-turn dialogue. The assistant will ask follow-up questions to hone in on the clinical assessment.
            </p>
          </div>
          <TriageChatbot />
        </div>
      ) : (
        <>
          {/* First Aid Guides tab */}
          <div style={{ marginBottom: '1.75rem', textAlign: 'left' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', margin: '0 0 0.5rem' }}>
              Emergency First Aid Guides
            </h1>
            <p style={{ color: 'var(--color-muted)', margin: 0, fontSize: '0.975rem', lineHeight: 1.6 }}>
              Critical step-by-step instructions for medical emergencies. Access is 100% local and available offline.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            {FIRST_AID_GUIDES.map(guide => {
              const isExpanded = expandedGuide === guide.id;
              const borderLeftColor = guide.urgency === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)';
              const urgencyLabel = guide.urgency === 'critical' ? 'High Urgency' : 'Moderate Urgency';
              const urgencyColor = guide.urgency === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)';
              const urgencyBg = guide.urgency === 'critical' ? 'var(--color-critical-bg)' : 'var(--color-warning-bg)';
              
              return (
                <div 
                  key={guide.id} 
                  className="card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderLeft: `4px solid ${borderLeftColor}`,
                    cursor: 'pointer',
                    transition: 'var(--transition-standard)'
                  }}
                  onClick={() => setExpandedGuide(isExpanded ? null : guide.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>
                      {guide.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: urgencyColor,
                        backgroundColor: urgencyBg,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px'
                      }}>
                        {urgencyLabel}
                      </span>
                      <span style={{
                        color: 'var(--color-faint)',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'var(--transition-fast)',
                        fontSize: '0.75rem'
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div 
                      style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <h4 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                        Immediate Action Steps:
                      </h4>
                      <ol style={{ paddingLeft: '1.25rem', margin: '0 0 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {guide.steps.map((step, idx) => (
                          <li key={idx} style={{ fontSize: '0.875rem', color: 'var(--color-muted)', lineHeight: 1.6 }}>
                            {step}
                          </li>
                        ))}
                      </ol>
                      
                      <div style={{
                        backgroundColor: 'var(--color-critical-bg)',
                        borderLeft: '3px solid var(--color-critical)',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1rem'
                      }}>
                        <h4 style={{ margin: '0 0 0.375rem', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-critical)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          CRITICAL WARNINGS:
                        </h4>
                        <ul style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          {guide.donts.map((dont, idx) => (
                            <li key={idx} style={{ fontSize: '0.825rem', color: 'var(--color-critical)', lineHeight: 1.55, fontWeight: 500 }}>
                              {dont}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {guide.hasTimer && <CprTimer />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  )
}
