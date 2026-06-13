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
