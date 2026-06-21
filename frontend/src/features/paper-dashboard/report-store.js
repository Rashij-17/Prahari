// deps: none
// Persistent IndexedDB report store with GCM encryption for Prahari Paper Dashboard

import { encryptData, decryptData } from '../../shared/crypto-store.js';

const DB_NAME = 'PrahariDB';
const DB_VERSION = 1;
const STORE_NAME = 'reports';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('reportDate', 'reportDate', { unique: false });
        store.createIndex('uploadedAt', 'uploadedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Encrypts and saves a lab report to IndexedDB.
 * @param {object} report - Raw report object containing tests array
 * @param {string} [pin] - User PIN for encryption
 */
export async function saveReport(report, pin) {
  const db = await openDB();
  
  // Encrypt the tests array to protect patient medical PII
  const encryptedPayload = await encryptData(report.tests, pin);

  // Prepare database record (storing encrypted ciphertext instead of raw test names/values)
  const record = {
    uploadedAt: new Date().toISOString(),
    reportDate: report.reportDate || new Date().toISOString().split('T')[0],
    labName: report.labName || 'Unknown Laboratory',
    patientName: report.patientName || 'Patient',
    encryptedPayload: encryptedPayload, // Contains { iv, ciphertext }
    thumbnailDataURL: report.thumbnailDataURL || '',
    processingStatus: report.processingStatus || 'complete'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);

    req.onsuccess = () => resolve(req.result); // Returns inserted ID
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Retrieves all stored lab reports, decrypting their test datasets.
 * @param {string} [pin] - User PIN for decryption
 * @returns {Promise<Array<object>>} Decrypted report items
 */
export async function getReports(pin) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('reportDate');
    const req = index.getAll();

    req.onsuccess = async () => {
      const records = req.result || [];
      const decryptedReports = [];

      for (const record of records) {
        try {
          // Decrypt tests list
          const tests = await decryptData(record.encryptedPayload, pin);
          
          decryptedReports.push({
            id: record.id,
            uploadedAt: record.uploadedAt,
            reportDate: record.reportDate,
            labName: record.labName,
            patientName: record.patientName,
            tests: tests,
            thumbnailDataURL: record.thumbnailDataURL,
            processingStatus: record.processingStatus
          });
        } catch (err) {
          console.error(`Failed to decrypt report ID ${record.id}:`, err);
          // Return report structure with empty tests to prevent crash
          decryptedReports.push({
            id: record.id,
            uploadedAt: record.uploadedAt,
            reportDate: record.reportDate,
            labName: record.labName,
            patientName: record.patientName,
            tests: [],
            thumbnailDataURL: record.thumbnailDataURL,
            processingStatus: 'failed_decryption'
          });
        }
      }

      resolve(decryptedReports);
    };

    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Deletes a report record from IndexedDB by key.
 * @param {number} id - Record ID to delete
 */
export async function deleteReport(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });
}
