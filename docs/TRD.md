# Prahari — Technical Requirements Document (TRD)

**Version:** 1.0.0  
**Date:** June 2026  
**Status:** Approved for Build  

---

## 1. System Stack & Rationale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│   React 18.3 + Vite + Tailwind CSS 3.4 + React Router DOM 6            │
│   - HTML5 Camera & Canvas frame grabs (in-browser)                      │
│   - Geolocation API coordination                                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / REST (JSON)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND LAYER                                 │
│   FastAPI (Python 3.11+) + Uvicorn                                      │
│   - OpenCV (cv2) 4.9 (In-memory frame transformations)                  │
│   - PyTesseract (LSTM OEM 3 engine wrapper)                             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Async REST requests
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                             │
│   - RxNorm (NIH)       - openFDA (FDA)                                  │
│   - Infermedica v3     - Google Places                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Technology Decisions
*   **Vite:** Replaces CRA (Create React App) to provide high-speed Hot Module Replacement (HMR) and optimized Rollup build chunks.
*   **FastAPI:** Replaces Flask/Django due to its native asynchronous loop (`async/await`) handling, which is critical for making multiple concurrent outbound requests to external medical APIs.
*   **In-Memory OpenCV:** Processed image buffers are kept inside RAM as NumPy arrays during the API request lifecycle. This avoids disk write wear and latency.

---

## 2. External API Interfaces & Integration Specs

Prahari integrates with four external services. Below are the technical specification details for each API connection:

### 2.1 RxNorm API (National Library of Medicine)
Used to resolve raw text candidates to canonical medicine concepts.

*   **Fuzzy Lookup Endpoint:**
    ```http
    GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name={query_string}&search=1
    ```
    *Parameters:* `search=1` activates the approximate matching algorithm to handle OCR typos (fuzzy matches).
*   **Synonym & Class Lookup Endpoint:**
    ```http
    GET https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/allrelated.json
    ```
    *Response Mapping:* Extracts terms with Term Types (`tty`) matching `IN` (Ingredient), `BN` (Brand Name), and `SCD` (Semantic Clinical Drug) to build candidate profiles.

### 2.2 openFDA Drug Label API (Food and Drug Administration)
Provides raw clinical labels based on resolved generic or brand names.

*   **Label Search Endpoint:**
    ```http
    GET https://api.fda.gov/drug/label.json?search=openfda.generic_name:"{resolved_name}"+openfda.brand_name:"{resolved_name}"&limit=1
    ```
*   **JSON Field Extractions:**
    *   `indications_and_usage` $\rightarrow$ Map to `indications` ("What it treats")
    *   `dosage_and_administration` $\rightarrow$ Map to `dosage` ("How to take it")
    *   `warnings` or `warnings_and_cautions` $\rightarrow$ Map to `warnings` ("Precautions")
    *   `boxed_warning` $\rightarrow$ Map to `boxed_warning` ("Black Box Warnings")
    *   `contraindications` $\rightarrow$ Map to `contraindications` ("When to avoid")

### 2.3 Infermedica API (v3)
Analyzes patient symptoms and returns diagnostic classifications and triage grading.

*   **Auth Headers:**
    ```http
    App-Id: {INFERMEDICA_APP_ID}
    App-Key: {INFERMEDICA_APP_KEY}
    Content-Type: application/json
    ```
*   **NLP Parse Endpoint:**
    ```http
    POST https://api.infermedica.com/v3/parse
    Payload: { "text": "my chest hurts and i feel dizzy", "age": { "value": 30 } }
    ```
*   **Triage Assessment Endpoint:**
    ```http
    POST https://api.infermedica.com/v3/triage
    Payload: { "sex": "male", "age": { "value": 30 }, "evidence": [...] }
    ```
    *Response Mapping:* Extracts `triage_level` (`emergency`, `consultation`, `self_treatment`) and maps it to Prahari's 5-level urgency color-coded ribbons.

### 2.4 Google Places API
Finds local medical providers matching geolocation.

*   **Nearby Search Endpoint:**
    ```http
    GET https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lng}&radius={radius_meters}&type=doctor|hospital|health&key={GOOGLE_PLACES_API_KEY}
    ```
*   **Provider Details Endpoint:**
    ```http
    GET https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=formatted_phone_number,url&key={GOOGLE_PLACES_API_KEY}
    ```

---

## 3. Data Pipelines & Sequence Flow

### 3.1 Scanner & Enrichment Data Flow
The sequence diagram below shows the data lifecycle from camera capture to clinical profile display:

```
React Client             FastAPI Backend             RxNorm API            openFDA API
     │                          │                        │                      │
     │── 1. POST Base64 JPEG ──>│                        │                      │
     │   (JSON payload)         │── 2. cv2 decode        │                      │
     │                          │── 3. Preprocess        │                      │
     │                          │── 4. Tesseract OCR     │                      │
     │                          │── 5. Text Refinement   │                      │
     │                          │                        │                      │
     │                          │── 6. GET /rxcui ──────>│                      │
     │                          │<─ 7. RXCUI Identifier ─│                      │
     │                          │                        │                      │
     │                          │── 8. GET /label ─────────────────────────────>│
     │                          │<─ 9. Raw FDA Label JSON ──────────────────────│
     │                          │                        │                      │
     │<─ 10. DrugProfile JSON ──│                        │                      │
     │   (Candidates + Label)   │                        │                      │
```

---

## 4. Backend Routing & Schemas (Pydantic Models)

All Pydantic schemas must be organized under `models/` directory instead of inline routes:

### 4.1 Vision Schemas (`models/vision.py`)
```python
from pydantic import BaseModel

class FramePayload(BaseModel):
    image: str  # Base64-encoded JPEG image string

class OCRResult(BaseModel):
    raw_text: str
    candidates: list[str]
    word_count: int
    psm_used: int
    processing_note: str
```

### 4.2 Medication Schemas (`models/medication.py`)
```python
from pydantic import BaseModel

class DrugProfile(BaseModel):
    brand_name: str
    generic_name: str
    manufacturer: str
    product_type: str
    route: list[str]
    rxcui: list[str]
    ndc: list[str]
    indications: str
    dosage: str
    warnings: str
    boxed_warning: str
    contraindications: str
    adverse_reactions: str
    drug_interactions: str
    has_boxed_warning: bool
    urgency_level: str  # "safe" | "moderate" | "critical"
```

### 4.3 Triage & Directory Schemas (`models/triage.py`)
```python
from pydantic import BaseModel, Field

class TriageRequest(BaseModel):
    symptoms: str
    sex: str = "male"
    age: int = 30

class ConditionResult(BaseModel):
    name: str
    probability: float
    urgency: str = ""

class TriageResponse(BaseModel):
    urgency_level: str  # "safe" | "moderate" | "critical"
    urgency_label: str
    urgency_color: str
    recommendation: str
    conditions: list[ConditionResult]
    is_mock: bool = False
```
