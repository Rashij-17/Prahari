# Prahari — Backend API Schema & Interface Registry

This document lists the JSON schemas, payload structures, and response shapes for all FastAPI endpoints.

---

## 1. Vision Endpoints

### 1.1 POST `/scan/process`
Processes a Base64-encoded image of a medicine label and returns OCR candidates.

*   **Request Body (JSON):**
    ```json
    {
      "image": "data:image/jpeg;base64,/9j/4AAQSkZJR..."
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "raw_text": "Metformin Hydrochloride 500mg\nStore below 25C\nRx Only",
      "candidates": ["Metformin", "Metformin Hydrochloride"],
      "word_count": 7,
      "psm_used": 6,
      "processing_note": "Successfully extracted 7 words using PSM 6."
    }
    ```

---

## 2. Medication Endpoints

### 2.1 GET `/medication/profile`
Retrieves a detailed FDA profile for a verified medication.

*   **Query Parameters:**
    *   `name` (string, required): Brand or generic name (e.g., `tylenol`).
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "brand_name": "Tylenol",
      "generic_name": "Acetaminophen",
      "manufacturer": "McNeil Consumer Healthcare",
      "product_type": "Human OTC Drug",
      "route": ["oral"],
      "rxcui": ["161"],
      "ndc": ["50580-496"],
      "indications": "For temporary relief of minor aches and pains...",
      "dosage": "Do not take more than directed...",
      "warnings": "Liver warning: This product contains acetaminophen...",
      "boxed_warning": "",
      "contraindications": "Do not use with any other drug containing acetaminophen...",
      "adverse_reactions": "Severe skin reactions may occur...",
      "drug_interactions": "Ask a doctor before use if you are taking warfarin...",
      "has_boxed_warning": false,
      "urgency_level": "safe"
    }
    ```

### 2.2 GET `/medication/search`
Retrieves lightweight autocomplete suggestions from RxNorm and openFDA.

*   **Query Parameters:**
    *   `q` (string, required): Search query (minimum 2 characters).
    *   `limit` (integer, optional): Maximum results to return (default: `8`).
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "query": "meta",
      "results": [
        {
          "rxcui": "6809",
          "name": "Metformin",
          "brand_name": "Glucophage",
          "generic_name": "Metformin Hydrochloride",
          "manufacturer": "Bristol Myers Squibb",
          "route": ["oral"],
          "has_boxed_warning": false,
          "urgency_level": "safe",
          "tty": "IN"
        }
      ],
      "total": 1,
      "source": "combined"
    }
    ```

---

## 3. Triage & Directory Endpoints

### 3.1 POST `/triage/assess`
Parses free-text symptom logs and returns triage urgency tiers.

*   **Request Body (JSON):**
    ```json
    {
      "symptoms": "chest pain and shortness of breath",
      "sex": "male",
      "age": 45
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "urgency_level": "critical",
      "urgency_label": "Emergency Care Required",
      "urgency_color": "alert-critical",
      "recommendation": "Call emergency services immediately.",
      "conditions": [
        {
          "name": "Acute Coronary Syndrome",
          "probability": 0.82,
          "urgency": "emergency"
        }
      ],
      "is_mock": false
    }
    ```

---

## 4. Cabinet & Appointment Sync Endpoints

All endpoints in this section require a valid Supabase authentication token sent via the `Authorization: Bearer <token>` header.

### 4.1 GET `/medication/cabinet`
Retrieves all items stored in the authenticated user's medicine cabinet. 
*   **Response Body (JSON - `200 OK`):**
    ```json
    [
      {
        "id": 1,
        "user_id": "supabase-uid-1234",
        "brand_name": "Base64_Encrypted_Brand==",
        "generic_name": "Base64_Encrypted_Generic==",
        "dosage_strength": "Base64_Encrypted_Dosage==",
        "frequency": "Base64_Encrypted_Frequency==",
        "instructions": "Base64_Encrypted_Instructions==",
        "created_at": "2026-06-17T18:00:00Z"
      }
    ]
    ```

### 4.2 POST `/medication/cabinet`
Adds a new medicine cabinet item or updates an existing one.
*   **Request Body (JSON):**
    ```json
    {
      "id": 1,
      "brand_name": "Base64_Encrypted_Brand==",
      "generic_name": "Base64_Encrypted_Generic==",
      "dosage_strength": "Base64_Encrypted_Dosage==",
      "frequency": "Base64_Encrypted_Frequency==",
      "instructions": "Base64_Encrypted_Instructions=="
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "id": 1,
      "user_id": "supabase-uid-1234",
      "brand_name": "Base64_Encrypted_Brand==",
      "generic_name": "Base64_Encrypted_Generic==",
      "dosage_strength": "Base64_Encrypted_Dosage==",
      "frequency": "Base64_Encrypted_Frequency==",
      "instructions": "Base64_Encrypted_Instructions==",
      "created_at": "2026-06-17T18:00:00Z"
    }
    ```

### 4.3 DELETE `/medication/cabinet/{item_id}`
Removes a medicine item from the cabinet.
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "message": "Item deleted"
    }
    ```

### 4.4 GET `/medication/appointments`
Retrieves all appointments for the authenticated user.
*   **Response Body (JSON - `200 OK`):**
    ```json
    [
      {
        "id": 1,
        "user_id": "supabase-uid-1234",
        "title": "Base64_Encrypted_Title==",
        "date": "2026-07-15",
        "time": "Base64_Encrypted_Time==",
        "notes": "Base64_Encrypted_Notes==",
        "created_at": "2026-06-17T18:00:00Z"
      }
    ]
    ```

### 4.5 POST `/medication/appointments`
Creates or updates an appointment.
*   **Request Body (JSON):**
    ```json
    {
      "id": 1,
      "title": "Base64_Encrypted_Title==",
      "date": "2026-07-15",
      "time": "Base64_Encrypted_Time==",
      "notes": "Base64_Encrypted_Notes=="
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "id": 1,
      "user_id": "supabase-uid-1234",
      "title": "Base64_Encrypted_Title==",
      "date": "2026-07-15",
      "time": "Base64_Encrypted_Time==",
      "notes": "Base64_Encrypted_Notes==",
      "created_at": "2026-06-17T18:00:00Z"
    }
    ```

### 4.6 DELETE `/medication/appointments/{appointment_id}`
Deletes an appointment.
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "message": "Appointment deleted"
    }
    ```

---

## 5. Audio Transcription & Dictation Endpoints

### 5.1 POST `/triage/transcribe`
Uploads raw audio data of a doctor's consultation or medical explanation. The audio is converted to standard WAV format via backend ffmpeg transcoding, transcribed via a 3-tier fallback chain (Groq Whisper-v3 $\rightarrow$ Gemini Flash Lite Audio $\rightarrow$ Simulator), and then parsed into structured clinical entities using Gemini LLM.

*   **Request (Multipart Form-Data):**
    *   `file` (file): Audio file (MP3, WAV, M4A, WEBM, etc.)
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "transcript": "Hello Mr. Sharma... I am prescribing you Metformin 500mg...",
      "confidence": 1.0,
      "is_incomplete": false,
      "medications": [
        {
          "brand_name": "Metformin",
          "generic_name": "Metformin Hydrochloride",
          "strength": "500mg",
          "frequency": "twice daily after meals",
          "duration": "30 days",
          "needs_spelling_correction": false,
          "spelling_suggestion": ""
        }
      ],
      "appointments": [
        {
          "title": "Follow-up appointment",
          "date": "2026-07-15",
          "time": "10:00 AM",
          "notes": "blood check"
        }
      ],
      "warnings": [
        "Avoid eating high-sugar foods or drinking alcohol."
      ]
    }
    ```

