// deps: react
import React, { useState, useEffect } from 'react';
import { t } from './bilingual.js';

// Global error registry
const errorRegistry = {
  CAMERA_DENIED: { en: "Camera access denied. Please enable camera in browser settings.", hi: "कैमरा अनुमति अस्वीकृत। कृपया ब्राउज़र सेटिंग्स में कैमरा चालू करें।" },
  OPENCV_TIMEOUT: { en: "Image analysis timed out. The operation took too long.", hi: "छवि विश्लेषण समय सीमा समाप्त। ऑपरेशन में बहुत अधिक समय लगा।" },
  NO_TABLE_FOUND: { en: "No table detected in the uploaded lab report.", hi: "अपलोड की गई लैब रिपोर्ट में कोई तालिका नहीं मिली।" },
  ONNX_LOAD_FAILED: { en: "Classifier unavailable. ONNX model load failed.", hi: "वर्गीकरणकर्ता अनुपलब्ध। एआई मॉडल लोड विफल रहा।" },
  DECRYPTION_FAILED: { en: "Failed to decrypt local health data. Incorrect PIN or corrupted data.", hi: "स्थानीय स्वास्थ्य डेटा को डिक्रिप्ट करने में विफल। गलत पिन या विकृत डेटा।" },
  ENCRYPTION_FAILED: { en: "Failed to securely store data.", hi: "डेटा को सुरक्षित रूप से सहेजने में विफल।" }
};

// In-memory debug logs
let debugLogs = [];
let logListeners = [];

function notifyListeners() {
  logListeners.forEach(l => l([...debugLogs]));
}

/**
 * Logs an error to the debug console
 * @param {string} code - Error code
 * @param {Error|object} error - Native error object
 */
export function logError(code, error) {
  const timestamp = new Date().toLocaleTimeString();
  const rawMsg = error?.message || String(error);
  const localizedMsg = errorRegistry[code] || { en: rawMsg, hi: rawMsg };
  
  const newLog = {
    id: Date.now() + Math.random(),
    timestamp,
    code,
    rawMsg,
    localizedMsg
  };

  debugLogs.unshift(newLog); // Newest first
  if (debugLogs.length > 50) debugLogs.pop(); // Keep last 50 logs
  
  console.error(`[Prahari Error] ${code}: ${rawMsg}`);
  notifyListeners();
  
  return {
    code,
    getMessage: (lang) => lang === 'hi' ? localizedMsg.hi : localizedMsg.en
  };
}

export function getLogs() {
  return [...debugLogs];
}

export function clearLogs() {
  debugLogs = [];
  notifyListeners();
}

/**
 * Collapsible debugging log drawer that floats on screen
 */
export function PrahariDebugConsole() {
  const [logs, setLogs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLogs(getLogs());
    const listener = (newLogs) => setLogs(newLogs);
    logListeners.push(listener);
    return () => {
      logListeners = logListeners.filter(l => l !== listener);
    };
  }, []);

  // Only display in development or localhost environment
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '1rem',
      zIndex: 9999,
      fontFamily: 'monospace',
      fontSize: '11px',
    }}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#1A1714',
          color: '#00D4AA',
          border: '1.5px solid #1E3A5F',
          padding: '0.4rem 0.8rem',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <span>🛠️ Debug Console</span>
        <span style={{
          background: logs.length > 0 ? '#EF4444' : '#1E3A5F',
          color: 'white',
          borderRadius: '10px',
          padding: '1px 5px',
          fontSize: '9px',
        }}>{logs.length}</span>
      </button>

      {/* Floating Logs Drawer */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '35px',
          left: 0,
          width: '320px',
          height: '240px',
          background: '#0D1F33',
          border: '1.5px solid #1E3A5F',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#8899BB',
        }}>
          {/* Header */}
          <div style={{
            background: '#122B47',
            padding: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #1E3A5F',
          }}>
            <span style={{ fontWeight: 'bold', color: 'white' }}>System Debug Console</span>
            <button
              onClick={clearLogs}
              style={{
                background: 'none',
                border: 'none',
                color: '#EF4444',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              Clear Logs
            </button>
          </div>

          {/* List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#5E564E', textAlign: 'center', padding: '2rem' }}>No system errors logged.</div>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{
                  borderBottom: '1px solid #1E3A5F',
                  paddingBottom: '0.25rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FF6B35' }}>
                    <span>[{log.timestamp}] {log.code}</span>
                  </div>
                  <div style={{ color: 'white', marginTop: '2px' }}>{log.rawMsg}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
