# Prahari — Security & Privacy Manual

**Version:** 1.0.0  
**Compliance Standards:** HIPAA (Health Insurance Portability and Accountability Act), DPDP Act (Digital Personal Data Protection Act, India)

---

## 1. Threat Model & Risk Matrix

The table below catalogs security threats mapped to their architectural vulnerabilities, impact levels, and Prahari's mitigation controls:

| Threat | Impact | Vector / Vulnerability | Mitigation Control |
| :--- | :--- | :--- | :--- |
| **API Key Draining** | Financial (Severe API charges) | Embedding API keys (`INFERMEDICA_KEY` or `GOOGLE_PLACES_KEY`) inside frontend React build artifacts. | **Backend Proxy Routing:** Client code never interacts directly with third-party servers. All requests are proxied through CORS-gated backend FastAPI routers. |
| **Medical Data Exposure** | Privacy Violation (Legal liability under DPDP/HIPAA) | Storing patient diagnostic logs, scanned labels, or symptoms inside local databases or flat files. | **In-Memory Volatile Processing:** The app uses zero databases. Captured camera frames and parsed strings are kept in RAM inside the HTTP thread context and wiped on execution completion. |
| **Bypass of Location Privacy** | Privacy Violation | Sniffing browser GPS location coordinates. | **Explicit HTTPS Permission:** Browser coordinates are queried using the Geolocation API, which requires active user confirmation over secure HTTPS. Coordinates are sent only as transient POST payloads. |
| **FastAPI Route Flooding** | Resource Exhaustion (Backend crash) | Flooding the `/scan/process` (OCR pipeline) endpoint with heavy base64 buffers. | **Max Payload Constraints (TODO):** Add request size limits (middleware / reverse proxy) and reject payloads $> 5\text{MB}$ before processing. |
| **Cross-Site Scripting (XSS)** | Client Hijacking | Injecting scripts inside raw OCR text fields and rendering them in the browser. | **DOM Escaping:** React's JSX architecture automatically escapes variables rendered in the template (e.g., `{raw_text}`). |

---

## 2. API Key Protection Policy

### 2.1 Code-Level Constraints
No API keys must ever be checked into version control. 

The backend environment configurations load keys at startup using `pydantic-settings` (see `backend/core/config.py`). Keys are read from `backend/.env` via `SettingsConfigDict(env_file=".env")`, and routes can degrade into mock preview modes if keys are missing.

---

## 3. Data Privacy Compliance Flow (HIPAA / DPDP)

To comply with global medical privacy frameworks, Prahari enforces a strict **zero-patient-profile policy**:

```
[React PWA User] ─────── (Sends anonymous base64 JPEG + symptom query) ───────► [FastAPI RAM]
                                                                                      │
                                                                           [In-Memory Processing]
                                                                                      │
                                                                           (Wiped on HTTP response)
                                                                                      ▼
                                                                           [Zero Database Records]
```

*   **No PII Association:** The symptom triage input requires **no user registration**. No names, emails, gender tags, or IP addresses are logged alongside medical assessments.
*   **In-Transit Encryption:** All endpoints, including local coordinate lookups, require TLS 1.3 encryption on outbound connections to openFDA, RxNorm, Google, and Infermedica.
*   **Volatile Storage:** Backend processes use Python's `BytesIO` buffers and OpenCV matrix variables. No image files or parsed text arrays are written to temp files or persistent disk partitions.
*   **Explicit Consent Modals:** Triage and Location directories display explicit prompts explaining that location data is queried purely in real-time and will be forgotten once the browser tab is closed.
