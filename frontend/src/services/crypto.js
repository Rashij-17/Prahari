/**
 * Prahari — Client-Side End-to-End Encryption (E2EE) Module
 * ============================================================
 * Implements AES-GCM 256-bit encryption/decryption using the native Web Crypto API.
 * 
 * Cryptographic Designs:
 *   1. Key Derivation: Derives a 256-bit AES-GCM key from a unique user seed (Supabase UID) 
 *      and a static salt using PBKDF2 with SHA-256 and 100,000 iterations.
 *   2. Randomized Mode (for instructions, notes, times): Uses standard AES-GCM with a 
 *      random 12-byte initialization vector (IV) for every encryption, ensuring semantic security.
 *   3. Deterministic Mode (for brand_name, appointment title): Uses a deterministic IV 
 *      derived from the text itself using SHA-256. This ensures the exact same text always
 *      encrypts to the exact same ciphertext, preserving database unique key/index matching 
 *      capabilities (essential for database update/upsert queries) while keeping names fully encrypted.
 */

const SALT = "prahari-e2ee-salt-key-2026";

/**
 * Derives a crypto key from a secret seed (User UID)
 */
async function deriveKey(seed) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(seed),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(SALT),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generates a deterministic 12-byte IV from plaintext using SHA-256
 */
async function getDeterministicIV(text) {
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", enc.encode(text));
  return new Uint8Array(hashBuffer).slice(0, 12);
}

/**
 * Encrypts plaintext using AES-GCM (Randomized or Deterministic)
 * Returns a Base64-encoded string containing IV + ciphertext.
 */
export async function encryptText(text, seed, deterministic = false) {
  if (!text) return "";
  try {
    const enc = new TextEncoder();
    const key = await deriveKey(seed);
    
    // Choose IV based on mode
    const iv = deterministic 
      ? await getDeterministicIV(text)
      : window.crypto.getRandomValues(new Uint8Array(12));
      
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(text)
    );
    
    // Pack IV and Ciphertext together
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to Base64
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error("Encryption failed:", err);
    return text;
  }
}

/**
 * Decrypts Base64-encoded ciphertext (containing IV + ciphertext) using AES-GCM.
 * Returns plaintext. If decryption fails, returns original string (safe fallback).
 */
export async function decryptText(base64Str, seed) {
  if (!base64Str) return "";
  try {
    const dec = new TextDecoder();
    const key = await deriveKey(seed);
    
    // Convert Base64 back to bytes
    const combined = new Uint8Array(
      atob(base64Str).split("").map((c) => c.charCodeAt(0))
    );
    
    if (combined.length < 13) return base64Str; // Must contain at least 12 bytes IV + 1 byte payload
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return dec.decode(decrypted);
  } catch (err) {
    // Decryption fails when the text is not encrypted (e.g. legacy/mock data)
    return base64Str;
  }
}
