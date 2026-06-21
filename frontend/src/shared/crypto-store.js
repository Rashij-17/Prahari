// deps: none
// SubtleCrypto AES-GCM storage wrapper for local client-side encryption

const DEFAULT_SALT = "PrahariAppEncryptionSalt";
const DEFAULT_PIN = "0000"; // Fallback PIN if user has not set one

/**
 * Derives a cryptographic key from a user PIN using PBKDF2.
 * @param {string} pin - User Pin code
 * @returns {Promise<IDBKey>} Derived AES-GCM Key
 */
async function deriveKey(pin) {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin || DEFAULT_PIN);
  const salt = encoder.encode(DEFAULT_SALT);

  // Import raw pin as a key-generating material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pinData,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256 key using PBKDF2 SHA-256
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 1000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts an object using AES-GCM with a derived key.
 * @param {object} data - Data object to encrypt
 * @param {string} [pin] - User PIN for key derivation
 * @returns {Promise<{iv: string, ciphertext: string}>} Encrypted payload in base64 format
 */
export async function encryptData(data, pin) {
  try {
    const key = await deriveKey(pin);
    const rawText = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(rawText);

    // Initialization vector (IV) - must be unique for each encryption
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      dataBuffer
    );

    // Convert IV and encrypted data to base64 strings for storage
    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
    const ciphertextBase64 = btoa(
      String.fromCharCode.apply(null, new Uint8Array(encryptedBuffer))
    );

    return {
      iv: ivBase64,
      ciphertext: ciphertextBase64
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("ENCRYPTION_FAILED");
  }
}

/**
 * Decrypts an encrypted payload using AES-GCM.
 * @param {{iv: string, ciphertext: string}} encryptedPayload - Base64 representation of IV + ciphertext
 * @param {string} [pin] - User PIN
 * @returns {Promise<object>} Decrypted Javascript object
 */
export async function decryptData(encryptedPayload, pin) {
  try {
    const { iv, ciphertext } = encryptedPayload;
    if (!iv || !ciphertext) {
      throw new Error("INVALID_PAYLOAD");
    }

    const key = await deriveKey(pin);

    // Decode base64 strings to Uint8Arrays
    const ivArray = new Uint8Array(
      atob(iv)
        .split("")
        .map((c) => c.charCodeAt(0))
    );
    const cipherArray = new Uint8Array(
      atob(ciphertext)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivArray
      },
      key,
      cipherArray
    );

    const decoder = new TextDecoder();
    const rawText = decoder.decode(decryptedBuffer);

    return JSON.parse(rawText);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("DECRYPTION_FAILED");
  }
}
