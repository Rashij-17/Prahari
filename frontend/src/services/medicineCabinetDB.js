/**
 * medicineCabinetDB.js
 * =====================
 * Shared IndexedDB service for Prahari's medicine store.
 * DB: prahari_db  |  Object Store: medicines  |  keyPath: id
 *
 * Exports:
 *   openDB()          → Promise<IDBDatabase>
 *   addMedicine(med)  → Promise<string>  (returns id)
 *   getMedicines()    → Promise<Medicine[]>
 *   updateMedicine(med) → Promise<void>
 *   deleteMedicine(id)  → Promise<void>
 */

const DB_NAME = 'prahari_db'
const DB_VERSION = 1
const STORE_NAME = 'medicines'

/** Opens (or creates) the IndexedDB database. */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        // Secondary indexes for efficient queries
        store.createIndex('name', 'name', { unique: false })
        store.createIndex('expiryDate', 'expiryDate', { unique: false })
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
    request.onblocked = () => reject(new Error('IndexedDB blocked — close other tabs.'))
  })
}

/**
 * Add a new medicine. Caller must provide a valid Medicine object
 * with a unique `id` field (use crypto.randomUUID()).
 * @param {Medicine} medicine
 * @returns {Promise<string>} The id of the inserted record.
 */
export async function addMedicine(medicine) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.add(medicine)
    req.onsuccess = () => resolve(medicine.id)
    req.onerror = (e) => reject(e.target.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Retrieve all medicines, sorted by name ascending.
 * @returns {Promise<Medicine[]>}
 */
export async function getMedicines() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('name')
    const req = index.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = (e) => reject(e.target.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Update an existing medicine (full record replacement).
 * The medicine object must include its `id` field.
 * @param {Medicine} medicine
 * @returns {Promise<void>}
 */
export async function updateMedicine(medicine) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(medicine)
    req.onsuccess = () => resolve()
    req.onerror = (e) => reject(e.target.error)
    tx.oncomplete = () => db.close()
  })
}

/**
 * Delete a medicine by its id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteMedicine(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = (e) => reject(e.target.error)
    tx.oncomplete = () => db.close()
  })
}
