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

---

## 6. Clinician & Health Profile Endpoints

All clinician endpoints require a valid Supabase authentication token sent via the `Authorization: Bearer <token>` header.

### 6.1 GET `/clinician/profile`
Retrieves the unencrypted health profile (allergies and lab results).

*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "allergies": "Base64_Encrypted_Allergies_JSON==",
      "lab_results": "Base64_Encrypted_Labs_JSON=="
    }
    ```

### 6.2 POST `/clinician/profile`
Saves/updates the encrypted health profile.

*   **Request Body (JSON):**
    ```json
    {
      "allergies": "Base64_Encrypted_Allergies_JSON==",
      "lab_results": "Base64_Encrypted_Labs_JSON=="
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "message": "Health profile updated successfully"
    }
    ```

### 6.3 GET `/clinician/caregivers`
Retrieves all caregiver circle contacts.

*   **Response Body (JSON - `200 OK`):**
    ```json
    [
      {
        "id": 1,
        "name": "Base64_Encrypted_Name==",
        "phone": "Base64_Encrypted_Phone==",
        "email": "Base64_Encrypted_Email==",
        "notification_type": "all"
      }
    ]
    ```

### 6.4 POST `/clinician/caregivers`
Adds or updates a caregiver contact.

*   **Request Body (JSON):**
    ```json
    {
      "id": null,
      "name": "Base64_Encrypted_Name==",
      "phone": "Base64_Encrypted_Phone==",
      "email": "Base64_Encrypted_Email==",
      "notification_type": "all"
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "id": 1,
      "user_id": "supabase-uid-1234",
      "name": "Base64_Encrypted_Name==",
      "phone": "Base64_Encrypted_Phone==",
      "email": "Base64_Encrypted_Email==",
      "notification_type": "all",
      "created_at": "2026-06-18T12:00:00Z"
    }
    ```

### 6.5 DELETE `/clinician/caregivers/{caregiver_id}`
Deletes a caregiver contact.

*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "message": "Caregiver deleted"
    }
    ```

### 6.6 POST `/clinician/chat`
Checks for safety rules and processes natural language clinical chat.

*   **Request Body (JSON):**
    ```json
    {
      "query": "Can I take ibuprofen with my medicine?",
      "history": [],
      "run_ai_scan": true,
      "decrypted_allergies": ["penicillin"],
      "decrypted_labs": ["Creatinine: High"]
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "response": "Clinical chat assistant response...",
      "safety_warnings": [
        {
          "rule_type": "drug_interaction",
          "ingredient_name": "warfarin",
          "value_match": "ibuprofen",
          "warning_text": "Warfarin and Ibuprofen increase bleeding risk.",
          "severity": "critical"
        }
      ],
      "is_emergency": false
    }
    ```

---

## 7. Alert Escalation Endpoints

### 7.1 POST `/alerts/escalate`
Triggers physical inactivity alerts or missed medication escalations to caregivers.

*   **Request Body (JSON):**
    ```json
    {
      "missed_medication_name": "Warfarin 5mg",
      "patient_name": "John Doe",
      "patient_email": "patient@prahari.org",
      "inactivity_duration_minutes": 120,
      "decrypted_caregiver_circle": [
        {
          "name": "Son",
          "phone": "+919999999999",
          "email": "son@example.com",
          "notification_type": "all"
        }
      ]
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "is_mock": true,
      "sms_sent_count": 0,
      "push_sent_count": 0,
      "email_sent_count": 1,
      "details": "Alerts dispatched successfully via fallback logging."
    }
    ```

### 7.2 POST `/alerts/push-subscription`
Saves web push registration tokens for caregivers or devices.

*   **Request Body (JSON):**
    ```json
    {
      "endpoint": "https://fcm.googleapis.com/fcm/send/token...",
      "keys": {
        "p256dh": "keys-p256dh-string",
        "auth": "keys-auth-string"
      }
    }
    ```
*   **Response Body (JSON - `200 OK`):**
    ```json
    {
      "status": "success",
      "message": "Push subscription saved"
    }
    ```


