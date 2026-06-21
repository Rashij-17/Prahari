// deps: react, react-router-dom
import React, { useState, useEffect, useRef } from 'react';
import { useCameraStream } from './useCameraStream.js';
import { loadOpenCV, validatePillContour } from './opencv-contour.js';
import { classifyPill } from './onnx-classifier.js';
import { addMedicine } from '../../services/medicineCabinetDB.js';
import { t } from '../../shared/bilingual.js';
import { logError } from '../../shared/error-handler.jsx';

export default function PillScanner() {
  const [lang, setLang] = useState('en');
  const [cvReady, setCvReady] = useState(false);
  const [loadingCv, setLoadingCv] = useState(true);
  const [scannerState, setScannerState] = useState('idle'); // 'idle' | 'scanning' | 'cv_error' | 'result' | 'error'
  const [results, setResults] = useState([]);
  const [contourData, setContourData] = useState(null); // { shape, color }
  const [dbStatus, setDbStatus] = useState(''); // Status msg when adding to cabinet

  const canvasRef = useRef(null);

  // Initialize camera hook
  const {
    videoRef,
    stream,
    facingMode,
    error: cameraError,
    loading: cameraLoading,
    toggleFacingMode,
    captureFrame,
    startCamera,
    stopCamera
  } = useCameraStream();

  // Load OpenCV on mount
  useEffect(() => {
    setLoadingCv(true);
    loadOpenCV()
      .then(() => {
        setCvReady(true);
        setLoadingCv(false);
      })
      .catch((err) => {
        logError('ONNX_LOAD_FAILED', err);
        setScannerState('error');
        setLoadingCv(false);
      });

    return () => stopCamera();
  }, []);

  // Sync camera errors to scannerState
  useEffect(() => {
    if (cameraError === 'CAMERA_DENIED') {
      setScannerState('error');
    }
  }, [cameraError]);

  const handleScan = async () => {
    if (scannerState === 'scanning' || !cvReady) return;
    setScannerState('scanning');
    setDbStatus('');

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const imageData = captureFrame(canvasRef.current);
      if (!imageData) {
        setScannerState('cv_error');
        return;
      }

      const cvResult = validatePillContour(imageData);
      if (!cvResult.valid) {
        setScannerState('cv_error');
        return;
      }

      setContourData({
        shape: cvResult.pillShape,
        color: cvResult.pillColor
      });

      const classification = await classifyPill(imageData, cvResult.pillShape, cvResult.pillColor);
      setResults(classification);
      setScannerState('result');

    } catch (err) {
      logError('OPENCV_TIMEOUT', err);
      setScannerState('error');
    }
  };

  const handleAddToCabinet = async (pill) => {
    try {
      let freqCode = 'OD';
      if (pill.chronoOptimal === 'morning') freqCode = 'OD';
      else if (pill.chronoOptimal === 'evening') freqCode = 'OD';
      else if (pill.chronoOptimal === 'bedtime') freqCode = 'HS';

      const newMed = {
        id: crypto.randomUUID(),
        name: pill.name,
        genericSalt: pill.category || 'Visual Pill Scanner Match',
        dosage: pill.dosage || '1 tablet',
        frequency: freqCode,
        stockCount: 30,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Interactions: ${pill.warnings}\nMissed Dose: ${pill.instructions}`
      };

      await addMedicine(newMed);
      setDbStatus('success');
    } catch (err) {
      logError('ENCRYPTION_FAILED', err);
      setDbStatus('failed');
    }
  };

  const getLanguageLabel = () => lang === 'en' ? 'हिन्दी' : 'English';
  const toggleLanguage = () => setLang(l => l === 'en' ? 'hi' : 'en');

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      background: 'var(--color-paper)',
      color: 'var(--color-ink)',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
      padding: '1rem',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Spinner + animation styles */}
      <style>{`
        .pill-cv-spinner {
          width: 38px; height: 38px;
          border: 3.5px solid var(--color-border);
          border-top: 3.5px solid var(--color-forest);
          border-radius: 50%; margin: 0 auto;
          animation: pillSpin 1s linear infinite;
        }
        @keyframes pillSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pillPulseReticle {
          0% { transform: scale(0.97); opacity: 0.8; }
          50% { transform: scale(1.03); opacity: 1; border-color: var(--color-forest-mid); }
          100% { transform: scale(0.97); opacity: 0.8; }
        }
        @keyframes pillScanLine {
          0% { top: 0%; } 50% { top: 100%; } 100% { top: 0%; }
        }
        @keyframes pillSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Page Header */}
      <div className="page-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: '1rem',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.25rem',
            fontFamily: 'var(--font-display)',
            margin: 0,
            color: 'var(--color-ink)',
          }}>
            {t(lang, 'pill_scan_title')}
          </h1>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--color-muted)',
            margin: 0,
          }}>
            {t(lang, 'pill_scan_subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={toggleLanguage}
            style={{
              background: 'var(--color-cream)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-forest)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {getLanguageLabel()}
          </button>
          
          {stream && (
            <button
              onClick={toggleFacingMode}
              aria-label="Toggle Camera Orientation"
              style={{
                background: 'var(--color-cream)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-ink)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {/* Main scanning viewport */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: 'var(--color-cream)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1.5px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
      }}>
        {loadingCv ? (
          <div style={{ textAlign: 'center', zIndex: 5, padding: '2rem' }}>
            <div className="pill-cv-spinner" />
            <p style={{ marginTop: '1rem', color: 'var(--color-forest)', fontWeight: 600, fontSize: '13px' }}>
              {t(lang, 'onnx_loading')}
            </p>
          </div>
        ) : scannerState === 'error' ? (
          <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '300px', zIndex: 10 }}>
            <span style={{ fontSize: '3rem' }}>⚠️</span>
            <h4 style={{ color: 'var(--color-warning)', margin: '1rem 0 0.5rem' }}>
              {t(lang, 'error')}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              {cameraError === 'CAMERA_DENIED' ? t(lang, 'camera_denied') : t(lang, 'onnx_failed')}
            </p>
            <button
              onClick={() => {
                setScannerState('idle');
                startCamera();
              }}
              className="btn-primary-forest"
              style={{ marginTop: '1rem', padding: '8px 16px', fontSize: '13px' }}
            >
              {t(lang, 'retry')}
            </button>
          </div>
        ) : (
          <>
            {/* Camera Video Stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            />

            {/* Targeting reticle overlay */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                zIndex: 2,
                width: '160px',
                height: '160px',
                border: '2px dashed var(--color-forest-mid)',
                borderRadius: '24px',
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                animation: 'pillPulseReticle 2s infinite ease-in-out',
              }}
            >
              {/* Corner brackets */}
              <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '3.5px solid var(--color-forest)', borderLeft: '3.5px solid var(--color-forest)', borderRadius: '6px 0 0 0' }} />
              <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '3.5px solid var(--color-forest)', borderRight: '3.5px solid var(--color-forest)', borderRadius: '0 6px 0 0' }} />
              <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '3.5px solid var(--color-forest)', borderLeft: '3.5px solid var(--color-forest)', borderRadius: '0 0 0 6px' }} />
              <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '3.5px solid var(--color-forest)', borderRight: '3.5px solid var(--color-forest)', borderRadius: '0 0 6px 0' }} />
            </div>

            {/* Live announcer for screen reader */}
            <div aria-live="polite" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
              {scannerState === 'scanning' ? t(lang, 'scanning_active') : t(lang, 'camera_viewfinder')}
            </div>

            {/* Bottom action trigger overlay */}
            {scannerState === 'idle' && (
              <div style={{
                position: 'absolute',
                bottom: '1.25rem',
                zIndex: 5,
                left: 0,
                right: 0,
                textAlign: 'center',
              }}>
                <button
                  id="pill-scan-action-btn"
                  onClick={handleScan}
                  className="btn-primary-forest"
                  style={{
                    borderRadius: '24px',
                    padding: '10px 24px',
                    fontSize: '13px',
                  }}
                >
                  📸 {t(lang, 'tap_to_scan')}
                </button>
              </div>
            )}
            
            {scannerState === 'scanning' && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                zIndex: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '4px',
                  background: 'linear-gradient(to right, transparent, var(--color-forest), transparent)',
                  boxShadow: '0 0 12px var(--color-forest)',
                  animation: 'pillScanLine 2s linear infinite',
                }} />
                <div className="pill-cv-spinner" />
                <p style={{ color: 'white', marginTop: '1rem', fontSize: '13px', fontWeight: 600 }}>
                  {t(lang, 'scanning_active')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* CV Error Warning Card */}
      {scannerState === 'cv_error' && (
        <div style={{
          marginTop: '1rem',
          background: 'var(--color-warning-bg)',
          border: '1.5px solid var(--color-warning-border)',
          borderRadius: '12px',
          padding: '1rem',
          zIndex: 10,
        }}>
          <h4 style={{ color: 'var(--color-warning)', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ {t(lang, 'contour_error_title')}
          </h4>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-muted)', lineHeight: 1.5 }}>
            {t(lang, 'contour_error_msg')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              onClick={() => setScannerState('idle')}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              {t(lang, 'cancel')}
            </button>
            <button
              onClick={handleScan}
              className="btn-primary-forest"
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              🔄 {t(lang, 'retry')}
            </button>
          </div>
        </div>
      )}

      {/* Result Bottom Sheet */}
      {scannerState === 'result' && results.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '75%',
          background: 'var(--color-white)',
          borderTop: '1.5px solid var(--color-border)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          animation: 'pillSlideUp 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        }}>
          {/* Handle */}
          <div style={{
            width: '40px',
            height: '4px',
            background: 'var(--color-border)',
            borderRadius: '2px',
            margin: '8px auto',
          }} />

          {/* Scrollable Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 1.25rem 1.5rem',
            textAlign: 'left',
          }}>
            {(() => {
              const bestMatch = results[0];
              const pill = bestMatch.pillInfo;
              const confidencePct = Math.round(bestMatch.confidence * 100);
              
              const confidenceColor = confidencePct > 80 ? 'var(--color-safe)' :
                                      confidencePct >= 60 ? 'var(--color-warning)' :
                                      'var(--color-critical)';

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', color: 'var(--color-ink)', margin: '0 0 0.15rem', fontWeight: 'bold' }}>
                        {lang === 'hi' ? pill.nameHindi : pill.name}
                      </h2>
                      <span className="chip chip-info" style={{ textTransform: 'capitalize', fontSize: '9px', padding: '2px 6px' }}>
                        {contourData?.color || pill.color} · {t(lang, `pill_shape_${contourData?.shape || pill.shape}`)}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        color: confidenceColor,
                        fontWeight: 700,
                        fontSize: '15px'
                      }}>
                        {confidencePct}%
                      </span>
                      <div style={{ fontSize: '8.5px', color: 'var(--color-faint)' }}>
                        {t(lang, 'match_confidence')}
                      </div>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div style={{
                    width: '100%',
                    height: '5px',
                    background: 'var(--color-cream)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${confidencePct}%`,
                      height: '100%',
                      background: confidenceColor,
                    }} />
                  </div>

                  {/* DB Sync feedback */}
                  {dbStatus === 'success' && (
                    <div style={{ background: 'var(--color-safe-bg)', border: '1px solid var(--color-safe-border)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', color: 'var(--color-safe)', marginTop: '5px' }}>
                      ✓ Added to My Cabinet successfully!
                    </div>
                  )}
                  {dbStatus === 'failed' && (
                    <div style={{ background: 'var(--color-critical-bg)', border: '1px solid var(--color-critical-border)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', color: 'var(--color-critical)', marginTop: '5px' }}>
                      ⚠️ Failed to add to cabinet. Try again.
                    </div>
                  )}

                  {/* Medicine properties */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                    <div>
                      <h4 style={{ color: 'var(--color-ink)', fontSize: '12px', margin: '0 0 0.25rem', fontWeight: 600 }}>
                        📋 {t(lang, 'dosage_info')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                        {pill.dosage}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--color-warning)', fontSize: '12px', margin: '0 0 0.25rem', fontWeight: 600 }}>
                        ⚠️ {t(lang, 'warnings_info')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                        {pill.warnings}
                      </p>
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--color-forest)', fontSize: '12px', margin: '0 0 0.25rem', fontWeight: 600 }}>
                        🕒 {t(lang, 'missed_dose_guide')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                        {pill.instructions}
                      </p>
                    </div>
                  </div>

                  {/* Actions CTAs */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                    <button
                      onClick={() => setScannerState('idle')}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '10px 16px', fontSize: '12.5px' }}
                    >
                      {t(lang, 'scan_another')}
                    </button>

                    <button
                      onClick={() => handleAddToCabinet(pill)}
                      disabled={dbStatus === 'success'}
                      className="btn-primary-forest"
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        fontSize: '12.5px',
                        opacity: dbStatus === 'success' ? 0.5 : 1,
                        cursor: dbStatus === 'success' ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {t(lang, 'add_to_cabinet')}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
