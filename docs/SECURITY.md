# Prahari — Security & Privacy Manual

**Version:** 1.0.0  
**Compliance Standards:** HIPAA (Health Insurance Portability and Accountability Act), DPDP Act (Digital Personal Data Protection Act, India)

---

## 1. Threat Model & Risk Matrix

The table below catalogs security threats mapped to their architectural vulnerabilities, impact levels, and Prahari's mitigation controls:

| Threat | Impact | Vector / Vulnerability | Mitigation Control |
| :--- | :--- | :--- | :--- |
| **API Key Draining** | Financial (Severe API charges) | Embedding API keys (`INFERMEDICA_KEY` or `GOOGLE_PLACES_KEY`) inside frontend React build artifacts. | **Backend Proxy Routing:** Client code never interacts directly with third-party servers. All requests are proxied through CORS-gated backend FastAPI routers. |
| **Medical Data Exposure** | Privacy Violation (Legal liability under DPDP/HIPAA) | Storing patient diagnostic logs, scanned labels, or symptoms inside databases. | **Client-Side E2EE & Volatile Processing:** Scanned camera frames and temporary symptom evaluations are kept in-memory and never saved. Synced items (medicine cabinets, appointments) are encrypted client-side using AES-GCM 256-bit before DB storage. |
| **Bypass of Location Privacy** | Privacy Violation | Sniffing browser GPS location coordinates. | **Explicit HTTPS Permission:** Browser coordinates are queried using the Geolocation API, which requires active user confirmation over secure HTTPS. Coordinates are sent only as transient POST payloads. |
| **FastAPI Route Flooding** | Resource Exhaustion (Backend crash) | Flooding the `/scan/process` (OCR pipeline) endpoint with heavy base64 buffers. | **Max Payload Constraints (TODO):** Add request size limits (middleware / reverse proxy) and reject payloads $> 5\text{MB}$ before processing. |
| **Cross-Site Scripting (XSS)** | Client Hijacking | Injecting scripts inside raw OCR text fields and rendering them in the browser. | **DOM Escaping:** React's JSX architecture automatically escapes variables rendered in the template (e.g., `{raw_text}`). |
| **Unauthorized DB Modification** | Data Tampering / Theft | Intercepting or fabricating client cabinet sync payloads without authentication. | **Supabase JWT Verification:** The backend verifies asymmetric RS256/HS256 tokens on cabinet and appointment CRUD endpoints. |

---

## 2. API Key Protection & Authentication Policy

### 2.1 Code-Level Constraints
No API keys or JWT secrets must ever be checked into version control. 

The backend environment configurations load keys at startup using `pydantic-settings` (see `backend/core/config.py`). Keys are read from `backend/.env` via `SettingsConfigDict(env_file=".env")`, and routes can degrade into mock preview modes if keys are missing.

### 2.2 JWT Authentication Gateway
Prahari integrates Supabase Auth for Google Sign-In and email login. 
* JWT Verification: The backend checks the `Authorization` header containing the bearer token. It verifies the signature against `SUPABASE_JWT_SECRET`.
* Local Dev Fallback: For local testing, if the token contains a mismatch (e.g. HS256 vs RS256 algorithm signature checks), a try-except fallback allows decoding unverified payloads to extract user identities, logging warnings while returning `200 OK` to ensure local developers are not blocked.

---

## 3. Data Privacy Compliance Flow (HIPAA / DPDP / E2EE)

To comply with global medical privacy frameworks (HIPAA & DPDP Act), Prahari enforces a strict **client-side End-to-End Encryption (E2EE)** policy for all persistent health data:

```
[React PWA User] ─────── (Client-Side AES-GCM 256-bit Encrypted Payload) ───────► [FastAPI / SQL Database]
                                                                                       │
                                                                           [Stored as Ciphertext]
                                                                                       │
                                                                           (Decrypted ONLY on Client)
                                                                                       ▼
                                                                           [Zero Plaintext Medical Data]
```

### 3.1 Cryptographic Implementation Details
* **Key Derivation:** A 256-bit AES-GCM key is derived from the user's unique Supabase UID seed using PBKDF2 with SHA-256 and 100,000 iterations over a secure salt.
* **Randomized Mode:** Used for instructions, notes, and times. Standard AES-GCM with a random 12-byte initialization vector (IV) for every encryption run, preventing statistical patterns.
* **Deterministic Mode:** Used for brand names and appointment titles. The 12-byte IV is deterministically derived from the plaintext itself using a SHA-256 hash. This allows the exact same string to always produce the same ciphertext, preserving database indexing/unique constraint lookups while keeping names encrypted in-transit and at-rest.
* **Metadata Exemption:** Non-identifiable metadata such as record timestamps, DB IDs, and standard date strings (e.g., `YYYY-MM-DD` for calendars) remain unencrypted to support backend sorting and indexing.

