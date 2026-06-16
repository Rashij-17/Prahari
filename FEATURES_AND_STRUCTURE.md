# FEATURES_AND_STRUCTURE.md

---

> **Document Status:** Authoritative Blueprint — v1.0.0  
> **Application:** MedLens — Medication Demystifier, Symptom Triage System & Local Doctor Directory  
> **Stack:** React.js · Tailwind CSS · FastAPI · OpenCV · Tesseract OCR · openFDA · RxNorm · Infermedica · Google Places API  
> **Last Updated:** 2026-06-10  
> **Owner:** Lead Systems Architect & Product Owner

---

## Table of Contents

1. [Project Overview & Vision](#1-project-overview--vision)
   - 1.4 [Architectural Hybrid Model: Local vs. Cloud API Division](#14-architectural-hybrid-model-local-vs-cloud-api-division)
2. [Core Application Features (Functional Breakdown)](#2-core-application-features-functional-breakdown)
   - 2.1 [Visual Label Scanner](#21-visual-label-scanner)
   - 2.2 [Medication Demystification Engine](#22-medication-demystification-engine)
   - 2.3 [Symptom & Triage Analyzer](#23-symptom--triage-analyzer)
   - 2.4 [Geographic Specialist Directory](#24-geographic-specialist-directory)
3. [System Architecture & Technical Structure](#3-system-architecture--technical-structure)
   - 3.1 [Component Topography](#31-component-topography)
   - 3.2 [End-to-End Data Flow Pipelines](#32-end-to-end-data-flow-pipelines)
4. [UI/UX & Aesthetic Design Specifications](#4-uiux--aesthetic-design-specifications)
5. [Data Privacy, Security & Legal Disclaimers](#5-data-privacy-security--legal-disclaimers)

---

## 1. Project Overview & Vision

### 1.1 Problem Statement

Medication non-adherence, misidentification of prescription labels, delayed triage decisions, and inaccessible specialist directories collectively constitute one of the most preventable categories of adverse health outcomes. In India alone, more than 55% of patients in semi-urban and rural contexts cannot interpret pharmaceutical labels written in technical or English-only nomenclature. Globally, misread dosage instructions and ignored drug interaction warnings contribute to an estimated 125,000 preventable deaths annually.

**MedLens** was conceived to address three interlocking gaps in personal health management:

| Gap | Problem | MedLens Response |
|-----|---------|-----------------|
| **Medication Literacy** | Patients cannot decode chemical names, interactions, or dosage schedules from physical labels | Visual Label Scanner + Medication Demystification Engine |
| **Triage Safety** | Non-clinicians cannot determine whether symptoms warrant emergency care, a specialist visit, or watchful waiting | Symptom & Triage Analyzer powered by Infermedica |
| **Provider Access** | Patients lack reliable, real-time local directories filtered by specialty, availability, and distance | Geographic Specialist Directory powered by Google Places API |

### 1.2 Product Goals

- **G1 — Accessibility:** Deliver clinically grounded health information in plain, actionable language to users irrespective of medical literacy.
- **G2 — Safety:** Surface drug interaction warnings, contraindications, and triage urgency levels clearly, with high-contrast alert states that cannot be overlooked.
- **G3 — Trust:** Every data point is sourced from authoritative APIs (openFDA, RxNorm, Infermedica). No proprietary diagnoses are generated; the system triages and defers, it never prescribes.
- **G4 — Privacy-by-Design:** No camera frames, OCR outputs, or symptom logs are persisted to any server-side storage beyond the duration of a single request lifecycle.
- **G5 — Responsiveness:** Full feature parity between desktop browsers and mobile devices. The camera-based scanner is optimised for handheld use at arm's length from a medication bottle.

### 1.3 Non-Goals (Explicit Scope Exclusions)

- MedLens does **not** provide diagnoses, prescriptions, or treatment plans.
- MedLens does **not** replace emergency services. All severe-risk triage results direct users immediately to emergency contact numbers.
- MedLens does **not** store any personally identifiable information (PII), health history, or biometric data across sessions.

### 1.4 Architectural Hybrid Model: Local vs. Cloud API Division

To optimize for **data privacy, server costs, offline resiliency, and accuracy**, the current features in MedLens are split into a hybrid architecture:

| Feature / Sub-System | Classification | Architecture Rationale |
| :--- | :--- | :--- |
| **Visual Label Scanner (Image Preprocessing & OCR)** | **Local-Preferred (ML)** | Processing images via client-side Canvas and backend **OpenCV/Tesseract** operates locally. This keeps patient camera captures private, ensures zero API costs, and allows the scanner to run locally/privately. |
| **Medication Demystification Engine (RxNorm & openFDA Lookup)** | **API-Reliant** | Requires external APIs. The FDA and NLM databases of all approved chemical salts, brand names, and drug-drug interactions are hundreds of gigabytes, constantly updating. Mirroring this locally on a mobile client or cheap server is impractical and quickly goes out of date. |
| **Symptom & Triage Analyzer (Infermedica Interface)** | **API-Reliant** | Requires external APIs. Triage diagnostic flows rely on Infermedica's curated, proprietary clinical probabilistic models and clinical graphs which are kept secure and hosted in their compliant cloud. |
| **Geographic Specialist Directory (Google Places Search)** | **API-Reliant** | Requires external APIs. Querying real-time doctor listings, opening times, ratings, and addresses requires access to Google's dynamic global business directories. |

---


## 2. Core Application Features (Functional Breakdown)

### 2.1 Visual Label Scanner `[LOCAL PREFERRED — MACHINE LEARNING]`

* **Deployment Preference**: **Local-Preferred**. The scanner processes images using client-side HTML5 canvas frame capture and runs image preprocessing (OpenCV) and character recognition (Tesseract OCR) locally on the backend server CPU.
* **Why Local is Preferred**: Prescription bottles contain sensitive clinical and personal information. By keeping frame processing local, the system ensures HIPAA compliance (no images are sent to third-party cloud engines) and operates with zero API usage costs. In production, this can also be compiled to run entirely inside the user's browser using `tesseract.js` and OpenCV WebAssembly.

The Visual Label Scanner is the primary entry point for medication identification. It transforms a physical pharmaceutical label into a structured, machine-readable drug profile through a sequential pipeline of camera acquisition, image enhancement, optical character recognition, and text refinement.

#### 2.1.1 Camera Frame Acquisition

1. **Permission Request:** On scanner activation, the frontend calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })` to request the rear-facing camera on mobile devices. A graceful fallback presents a static image upload interface if `getUserMode` is denied or unavailable.
2. **Live Preview Rendering:** The media stream is bound to an HTML5 `<video>` element with `autoPlay`, `playsInline`, and `muted` attributes set. The video preview is constrained to a 4:3 aspect ratio container with a visible scan-frame overlay — a rounded-corner rectangular reticle rendered in SVG — to guide label alignment.
3. **Frame Capture:** On user trigger (a capture button), a single frame is drawn from the video stream onto an off-screen HTML5 `<canvas>` element using `CanvasRenderingContext2D.drawImage()`. The canvas dimensions are set to the native video resolution up to a maximum of `1920×1080` pixels to balance OCR accuracy with payload size.
4. **Image Export:** The canvas frame is exported as a Base64-encoded JPEG string via `canvas.toDataURL('image/jpeg', 0.92)` and transmitted to the FastAPI backend over HTTPS as a JSON payload within a POST request body. The video stream is immediately stopped after frame capture by calling `MediaStream.getTracks().forEach(track => track.stop())`.

#### 2.1.2 Backend Image Pre-Processing (OpenCV)

The FastAPI endpoint receives the Base64 image string, decodes it into a NumPy array via OpenCV's `cv2.imdecode`, and applies the following sequential pre-processing transformations:

| Step | Operation | OpenCV Call | Purpose |
|------|-----------|-------------|---------|
| 1 | Decode | `cv2.imdecode(np_arr, cv2.IMREAD_COLOR)` | Convert Base64 buffer to BGR matrix |
| 2 | Greyscale | `cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)` | Remove colour noise for OCR |
| 3 | Resize | `cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)` | Upscale small text labels |
| 4 | Gaussian Blur | `cv2.GaussianBlur(img, (5, 5), 0)` | Smooth noise before thresholding |
| 5 | Adaptive Threshold | `cv2.adaptiveThreshold(..., cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)` | Binarise uneven lighting |
| 6 | Deskew | Compute skew angle via Hough Line Transform; rotate using `cv2.warpAffine` | Correct label tilt up to ±15° |
| 7 | Morphological Opening | `cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel)` | Remove speckle artefacts |

#### 2.1.3 OCR Text Extraction (Tesseract)

The pre-processed image is passed to `pytesseract.image_to_string()` with the following configuration:

```python
custom_config = r'--oem 3 --psm 6 -l eng'
raw_text = pytesseract.image_to_string(processed_img, config=custom_config)
```

- **OEM 3:** Uses the LSTM neural network engine for highest accuracy on pharmaceutical label fonts.
- **PSM 6:** Assumes a single uniform block of text, appropriate for structured medication labels.
- A secondary pass with **PSM 11** (sparse text) is triggered if the primary pass yields fewer than 20 tokens, covering labels with non-standard layouts.

#### 2.1.4 OCR Text Refinement

Raw OCR output is post-processed through the following refinement pipeline before API dispatch:

1. **Noise Stripping:** Regex-based removal of non-alphanumeric characters that do not appear in known drug name patterns (e.g., stray pipe characters, repeated symbols).
2. **Common OCR Substitution Correction:** A lookup table corrects high-frequency OCR misreads in pharmaceutical contexts (e.g., `0` → `O` in amino acid prefixes, `l` → `1` in dosage numerals, `rn` → `m` in chemical suffixes).
3. **Candidate Phrase Extraction:** Noun phrases and capitalised tokens are extracted using a lightweight rule-based tokeniser. These candidates are ranked by character length and proximity to known pharmaceutical keywords (`mg`, `mcg`, `tablet`, `capsule`, `injection`, `USP`, `BP`).
4. **Top-N Drug Name Candidates:** The top 5 candidate strings are forwarded to the Medication Demystification Engine for RxNorm lookup.

---

### 2.2 Medication Demystification Engine `[REQUIRES CLOUD API]`

* **Deployment Preference**: **Cloud API-Reliant**. The engine queries the national RxNorm clinical drug terminology database and the openFDA drug label repository.
* **Why API is Required**: The database of all global/US-approved drugs, chemical active moieties, brand names, and drug-drug interactions is hundreds of gigabytes in size and continuously updated. Storing and searching this dataset locally on a mobile client or cheap VM is inefficient, goes out of date quickly, and misses critical safety updates. The NLM RxNorm and openFDA REST endpoints serve as the single source of truth.

This engine takes raw chemical or brand-name strings — whether sourced from the scanner or typed manually — and returns a comprehensive, patient-readable drug profile.

#### 2.2.1 Drug Name Resolution via RxNorm API

Each candidate string is submitted to the RxNorm REST API to resolve it to a canonical RxCUI (RxNorm Concept Unique Identifier):

```
GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name={candidate}&search=1
```

- **Approximate Matching (`search=1`):** Enables fuzzy matching for OCR-derived strings that may contain minor errors.
- **Multiple Candidates:** All 5 candidates are queried in parallel using `asyncio.gather()`. The candidate returning the highest-confidence RxCUI match (measured by Levenshtein distance between candidate and canonical name) is selected as the primary drug.
- **Synonym Expansion:** Once a primary RxCUI is resolved, related concept names (brand names, generic equivalents) are fetched via:

```
GET https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/allrelated.json
```

#### 2.2.2 Active Ingredient & Classification Lookup

Using the resolved RxCUI:

1. **Active Ingredients:** Retrieved via `GET /REST/rxcui/{rxcui}/property.json?propName=ACTIVE_MOIETY`.
2. **Drug Classes:** Pharmacological and therapeutic class memberships retrieved via `GET /REST/rxcui/{rxcui}/classes.json`.
3. **Interaction Group Identifiers:** The RxCUI is cross-referenced with interaction group tables for use in the interaction check step.

#### 2.2.3 Clinical Data Enrichment via openFDA API

The canonical drug name is queried against the openFDA Drug Label endpoint:

```
GET https://api.fda.gov/drug/label.json?search=openfda.generic_name:"{drug_name}"&limit=1
```

The following fields are extracted and structured for the UI:

| Field | openFDA Source Key | UI Label |
|-------|--------------------|----------|
| Indications | `indications_and_usage` | **What it treats** |
| Dosage & Administration | `dosage_and_administration` | **How to take it** |
| Contraindications | `contraindications` | **Who should not take it** |
| Warnings | `warnings_and_cautions` | **Important warnings** |
| Drug Interactions | `drug_interactions` | **Do not combine with** |
| Adverse Reactions | `adverse_reactions` | **Possible side effects** |
| Storage | `storage_and_handling` | **How to store it** |

All field values are truncated to a maximum of 600 characters for the summary card view. Full text is available via an expandable accordion component.

#### 2.2.4 Drug Interaction Checker

When a user registers multiple medications (via a persisted in-session medication list stored in React state), the engine performs pairwise interaction checks using the RxNorm Interaction API:

```
GET https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis={rxcui1}+{rxcui2}+...
```

Interactions are classified into three severity tiers, each mapped to a distinct visual alert state in the UI:

| Tier | Severity | Description | UI Treatment |
|------|----------|-------------|-------------|
| **T1** | Critical | Life-threatening interaction; requires immediate cessation and physician contact | Full-bleed red alert banner with urgent icon |
| **T2** | Moderate | Monitor closely; may require dose adjustment | Amber warning card |
| **T3** | Minor | Minimal clinical significance; informational | Teal informational chip |

#### 2.2.5 Response Serialisation

The engine assembles a `MedicationProfile` Pydantic model:

```python
class MedicationProfile(BaseModel):
    rxcui: str
    canonical_name: str
    brand_names: List[str]
    active_ingredients: List[str]
    drug_class: List[str]
    indications: str
    dosage: str
    contraindications: str
    warnings: str
    interactions: List[InteractionAlert]
    adverse_reactions: str
    storage: str
    data_sources: List[str]  # ["RxNorm", "openFDA"]
    retrieved_at: datetime
```

This model is serialised as JSON and returned to the React frontend for rendering.

---

### 2.3 Symptom & Triage Analyzer `[REQUIRES CLOUD API]`

* **Deployment Preference**: **Cloud API-Reliant** (with **`[LOCAL PREFERRED — ALGORITHM]`** pre-processing).
* **Why API is Required**: Diagnosing symptoms and generating safety-critical triage guidelines requires a massive probabilistic diagnostic decision network. Infermedica has clinical graphs containing thousands of symptoms, conditions, risk factors, and their clinical conditional probabilities. Recreating this reasoning engine locally requires specialized, proprietary knowledge graphs. However, Prahari performs local preprocessing (language detection, regex-based negation handling, and entity parsing) before sending the request to the cloud.

The Symptom & Triage Analyzer converts free-text symptom descriptions into structured triage assessments, urgency classifications, and medical specialty recommendations.

#### 2.3.1 Symptom Input Interface

The UI presents a multi-modal symptom input surface:

1. **Free-Text Entry:** A multi-line text input accepting plain language descriptions (e.g., "sharp pain in my lower right abdomen since this morning, with nausea and low fever").
2. **Body Region Selector:** An interactive SVG body diagram allows users to tap anatomical regions to pre-seed the symptom context. Selected regions are appended to the free-text payload as structured location metadata.
3. **Patient Context Form:** Age, biological sex at birth, and current pregnancy status are collected. These fields are mandatory for the Infermedica API and are transmitted only for the duration of the API call — they are not stored.

#### 2.3.2 Symptom Parsing & Normalisation

The raw text input is dispatched to the FastAPI `/triage/parse` endpoint. Before forwarding to Infermedica, the backend performs:

1. **Language Detection:** The `langdetect` library identifies the input language. If non-English, a lightweight translation stub routes the input through a configurable translation layer (placeholder for Google Translate API integration in v1.1).
2. **Negation Handling:** Common negation patterns (`"no fever"`, `"not vomiting"`) are identified via regex and flagged as absent symptoms to prevent false-positive matches.
3. **Duration & Severity Extraction:** Named entity patterns extract temporal modifiers (`"since yesterday"`, `"for three days"`) and intensity qualifiers (`"mild"`, `"severe"`, `"unbearable"`) as structured metadata fields.

#### 2.3.3 Infermedica API Integration

The structured symptom payload is submitted to the Infermedica Diagnosis API:

```
POST https://api.infermedica.com/v3/diagnosis
Headers:
  App-Id: {INFERMEDICA_APP_ID}
  App-Key: {INFERMEDICA_APP_KEY}
  Content-Type: application/json

Body:
{
  "sex": "female",
  "age": { "value": 34 },
  "evidence": [
    { "id": "s_21", "choice_id": "present", "source": "initial" },
    { "id": "s_305", "choice_id": "present", "source": "initial" }
  ],
  "extras": { "disable_groups": true }
}
```

Symptom IDs (`s_XXX`) are resolved from the free-text input using Infermedica's `/parse` endpoint prior to the diagnosis call:

```
POST https://api.infermedica.com/v3/parse
Body: { "text": "{normalised_symptom_text}", "context": [] }
```

#### 2.3.4 Triage Classification

The Infermedica `/triage` endpoint returns one of five triage levels, which MedLens maps to a three-tier urgency system:

| Infermedica Level | MedLens Tier | Label | Action |
|-------------------|--------------|-------|--------|
| `emergency_ambulance` | **CRITICAL** | 🔴 Emergency | Prompt to call emergency services immediately |
| `emergency` | **CRITICAL** | 🔴 Urgent Care | Seek emergency department within the hour |
| `consultation_24` | **MODERATE** | 🟠 See a Doctor Today | Book same-day appointment; shown with local urgent care results |
| `consultation` | **ROUTINE** | 🟡 Schedule an Appointment | Standard GP/specialist appointment recommended |
| `self_care` | **ROUTINE** | 🟢 Self-Care Advised | Symptom management guidance shown; no referral required |

**CRITICAL-tier results** trigger an interstitial full-screen modal with a high-contrast alert (deep red `#C0392B` background), emergency hotline numbers localised by the user's detected region, and a mandatory acknowledgement button before the user can proceed.

#### 2.3.5 Specialist Recommendation

For MODERATE and ROUTINE triage outcomes, Infermedica's response includes `suggested_specialties`. These are mapped to Google Places API search terms and forwarded to the Geographic Specialist Directory automatically, pre-populating the directory search with the recommended specialty type.

---

### 2.4 Geographic Specialist Directory `[REQUIRES CLOUD API]`

* **Deployment Preference**: **Cloud API-Reliant** (with **`[LOCAL PREFERRED — ALGORITHM]`** map rendering fallback).
* **Why API is Required**: Finding real-time addresses, open hours, and ratings of active clinics and pharmacies in a specific geographic radius requires access to Google's dynamic global business directory. Storing a local, static database of global hospital locations is not scalable or accurate enough for dynamic provider operations. However, Prahari handles maps client-side using OpenStreetMap/Leaflet to minimize rendering costs.

The Geographic Specialist Directory provides a live, filterable map and list view of nearby healthcare providers, seeded either manually by the user or automatically from a triage recommendation.

#### 2.4.1 User Location Acquisition

1. **Geolocation Request:** The frontend calls `navigator.geolocation.getCurrentPosition()` with a timeout of 10 seconds and `enableHighAccuracy: true`. The resolved coordinates (`latitude`, `longitude`) are stored in React component state only — never transmitted to the MedLens backend.
2. **Permission Denial Fallback:** If geolocation is denied or unavailable, a postal code / city text input is displayed. The entered string is geocoded via the Google Maps Geocoding API (`/geocode/json?address={input}`) to obtain coordinates client-side.
3. **Coordinate Transmission:** Coordinates are transmitted directly from the frontend to the Google Places API via the backend proxy endpoint to prevent API key exposure.

#### 2.4.2 Google Places API Query Construction

The FastAPI `/directory/search` endpoint constructs a Nearby Search request:

```
GET https://maps.googleapis.com/maps/api/place/nearbysearch/json
  ?location={lat},{lng}
  &radius={radius_metres}
  &type=doctor|hospital|pharmacy
  &keyword={specialty_keyword}
  &opennow={true|false}
  &key={GOOGLE_PLACES_API_KEY}
```

**Parameter logic:**

- `radius_metres` defaults to `5000` (5 km). User-adjustable via a slider UI component: `[1 km · 5 km · 10 km · 25 km]`.
- `specialty_keyword` is populated from the Infermedica triage output or from the manual specialty filter dropdown.
- `opennow` filter is toggled via a UI switch labelled "Open now only."

#### 2.4.3 Result Enrichment & Directory Generation

For each Place result returned (maximum 20 results per query), a Place Details request is made to retrieve full provider information:

```
GET https://maps.googleapis.com/maps/api/place/details/json
  ?place_id={place_id}
  &fields=name,formatted_address,formatted_phone_number,opening_hours,rating,user_ratings_total,geometry,website
  &key={GOOGLE_PLACES_API_KEY}
```

Each enriched result is serialised into a `ProviderListing` model:

```python
class ProviderListing(BaseModel):
    place_id: str
    name: str
    address: str
    phone: Optional[str]
    is_open_now: Optional[bool]
    opening_hours: Optional[List[str]]
    rating: Optional[float]
    total_ratings: Optional[int]
    distance_km: float  # Computed via Haversine formula
    website: Optional[str]
    coordinates: Coordinates
```

Distance is computed server-side using the Haversine formula against the user's submitted coordinates. Results are sorted ascending by `distance_km`.

#### 2.4.4 Interactive Directory UI

The directory presents results in two simultaneous views:

1. **Map View:** An embedded Google Maps iframe or Maps JavaScript API instance with custom markers. Each marker is styled with MedLens's teal palette. Clicking a marker opens an InfoWindow displaying name, distance, phone, and open/closed status.
2. **List View:** A scrollable card list sorted by distance. Each card displays: provider name, specialty badge, distance tag, star rating, open/closed status chip, a `tel:` linked phone number (tappable on mobile), and a "Get Directions" button linking to Google Maps navigation.

---

## 3. System Architecture & Technical Structure

### 3.1 Component Topography

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER (Browser / Mobile WebView)       │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    React.js Application                        │   │
│  │                                                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│  │  │  ScannerView  │  │  TriageView  │  │   DirectoryView    │  │   │
│  │  │  (Camera /   │  │  (Symptom    │  │   (Map + List)     │  │   │
│  │  │   Upload UI) │  │   Input UI)  │  │                    │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │   │
│  │         │                 │                    │               │   │
│  │  ┌──────▼─────────────────▼────────────────────▼───────────┐  │   │
│  │  │              Shared State (React Context / Zustand)      │  │   │
│  │  │   medicationProfile · triageResult · providerListings    │  │   │
│  │  └──────────────────────────────┬───────────────────────────┘  │   │
│  │                                 │  HTTPS / REST                 │   │
│  └─────────────────────────────────┼──────────────────────────────┘   │
│                                    │                                   │
│  HTML5 APIs: getUserMedia ·        │                                   │
│  Canvas · Geolocation              │                                   │
└────────────────────────────────────┼──────────────────────────────────┘
                                     │
                        ┌────────────▼────────────┐
                        │   FastAPI Backend Engine  │
                        │   (Python 3.11+)          │
                        │                           │
                        │  Routers:                 │
                        │  /scan/process            │
                        │  /medication/profile      │
                        │  /triage/parse            │
                        │  /triage/assess           │
                        │  /directory/search        │
                        │                           │
                        │  Services:                │
                        │  ┌─────────────────────┐  │
                        │  │  VisionService       │  │
                        │  │  (OpenCV + Tesseract)│  │
                        │  └──────────┬──────────┘  │
                        │  ┌──────────▼──────────┐  │
                        │  │  MedResolverService  │  │
                        │  │  (RxNorm + openFDA) │  │
                        │  └──────────┬──────────┘  │
                        │  ┌──────────▼──────────┐  │
                        │  │  TriageService       │  │
                        │  │  (Infermedica)       │  │
                        │  └──────────┬──────────┘  │
                        │  ┌──────────▼──────────┐  │
                        │  │  DirectoryService    │  │
                        │  │  (Google Places)     │  │
                        │  └─────────────────────┘  │
                        └────────────┬──────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                           │
          ▼                          ▼                           ▼
  ┌───────────────┐        ┌─────────────────┐        ┌──────────────────┐
  │ RxNorm API    │        │ Infermedica API  │        │ Google Places API│
  │ openFDA API   │        │ (Diagnosis +     │        │ (Nearby Search + │
  │               │        │  Triage)         │        │  Place Details)  │
  └───────────────┘        └─────────────────┘        └──────────────────┘
```

**Layer Responsibilities Summary:**

| Layer | Technology | Responsibility |
|-------|-----------|---------------|
| **Client** | React.js, Tailwind CSS | UI rendering, camera/geolocation APIs, state management, HTTPS dispatch |
| **Vision Layer** | OpenCV, Tesseract OCR | Image preprocessing, text extraction, OCR refinement |
| **Backend Engine** | FastAPI, Python | Request routing, service orchestration, API proxy, data serialisation |
| **Drug Data Layer** | RxNorm, openFDA | Drug name resolution, clinical data enrichment, interaction checking |
| **Triage Layer** | Infermedica | Symptom parsing, differential generation, urgency classification |
| **Directory Layer** | Google Places | Provider discovery, detail enrichment, location-aware sorting |

---

### 3.2 End-to-End Data Flow Pipelines

#### 3.2.1 Scan-to-Data Pipeline

```
 ┌─────────┐    Camera Frame (JPEG Base64)    ┌──────────────────────────────┐
 │  User   │ ──────────────────────────────▶ │  FastAPI: POST /scan/process  │
 │(Browser)│                                  └──────────────┬───────────────┘
 └─────────┘                                                  │
                                                              ▼
                                                  ┌─────────────────────┐
                                                  │  VisionService       │
                                                  │                      │
                                                  │  1. cv2.imdecode     │
                                                  │  2. Greyscale        │
                                                  │  3. Adaptive Thresh  │
                                                  │  4. Deskew           │
                                                  │  5. Morph Opening    │
                                                  └──────────┬──────────┘
                                                             │
                                                             ▼
                                                  ┌─────────────────────┐
                                                  │  Tesseract OCR       │
                                                  │  --oem 3 --psm 6     │
                                                  │                      │
                                                  │  Output: raw_text    │
                                                  └──────────┬──────────┘
                                                             │
                                                             ▼
                                                  ┌─────────────────────┐
                                                  │  Text Refiner        │
                                                  │                      │
                                                  │  - Noise strip       │
                                                  │  - OCR substitutions │
                                                  │  - Candidate extract │
                                                  │  → Top 5 candidates  │
                                                  └──────────┬──────────┘
                                                             │
                                             ┌───────────────┤ asyncio.gather()
                                             │               │
                                             ▼               ▼  (parallel RxNorm calls)
                                   ┌──────────────┐  ┌──────────────┐
                                   │ RxNorm /     │  │ RxNorm /     │  ... (×5)
                                   │ rxcui.json   │  │ rxcui.json   │
                                   │ candidate_1  │  │ candidate_2  │
                                   └──────┬───────┘  └──────┬───────┘
                                          └────────┬─────────┘
                                                   │ Best RxCUI match selected
                                                   ▼
                                          ┌─────────────────┐
                                          │ RxNorm:          │
                                          │ /allrelated      │
                                          │ /property        │
                                          │ /classes         │
                                          └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ openFDA:         │
                                          │ /drug/label.json │
                                          │                  │
                                          │ Extracts:        │
                                          │ - indications    │
                                          │ - dosage         │
                                          │ - warnings       │
                                          │ - interactions   │
                                          │ - adverse events │
                                          └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ MedicationProfile│
                                          │ (Pydantic model) │
                                          │ serialised JSON  │
                                          └────────┬────────┘
                                                   │
                                                   ▼
                                   ┌───────────────────────────┐
                                   │  React UI: Drug Profile    │
                                   │  Card rendered with:       │
                                   │  - Name & synonyms         │
                                   │  - Indications accordion   │
                                   │  - Dosage instructions     │
                                   │  - Interaction alerts      │
                                   │  - Warning severity badges │
                                   └───────────────────────────┘
```

---

#### 3.2.2 Symptom-to-Provider Pipeline

```
 ┌─────────┐   Free-text symptoms +    ┌─────────────────────────────────┐
 │  User   │   age / sex / body region │ FastAPI: POST /triage/parse      │
 │(Browser)│ ────────────────────────▶│                                   │
 └─────────┘                           └──────────────┬──────────────────┘
                                                       │
                                                       ▼
                                           ┌─────────────────────┐
                                           │  TriageService       │
                                           │                      │
                                           │  1. langdetect       │
                                           │  2. Negation flagging│
                                           │  3. Duration/severity│
                                           │     extraction       │
                                           └──────────┬──────────┘
                                                      │
                                                      ▼
                                           ┌─────────────────────┐
                                           │  Infermedica /parse  │
                                           │                      │
                                           │  text → evidence[]   │
                                           │  (symptom IDs)       │
                                           └──────────┬──────────┘
                                                      │
                                                      ▼
                                           ┌─────────────────────┐
                                           │  Infermedica         │
                                           │  /v3/diagnosis       │
                                           │                      │
                                           │  Returns:            │
                                           │  - conditions[]      │
                                           │  - should_stop: bool │
                                           └──────────┬──────────┘
                                                      │
                                                      ▼
                                           ┌─────────────────────┐
                                           │  Infermedica         │
                                           │  /v3/triage          │
                                           │                      │
                                           │  Returns:            │
                                           │  - triage_level      │
                                           │  - suggested_        │
                                           │    specialties[]     │
                                           └──────────┬──────────┘
                                                      │
                                          ┌───────────┴───────────┐
                                          │                         │
                              ┌───────────▼──────┐    ┌────────────▼──────────┐
                              │ CRITICAL tier?    │    │ MODERATE / ROUTINE?   │
                              │                   │    │                       │
                              │ → Full-screen     │    │ → specialty_keyword   │
                              │   emergency modal │    │   forwarded to        │
                              │   with local      │    │   DirectoryService    │
                              │   emergency nos.  │    └────────────┬──────────┘
                              └───────────────────┘                 │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  Browser Geolocation  │
                                                        │  getCurrentPosition() │
                                                        │  → {lat, lng}         │
                                                        └────────────┬──────────┘
                                                                     │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  FastAPI:              │
                                                        │  POST /directory/search│
                                                        │                        │
                                                        │  Google Places API:    │
                                                        │  /nearbysearch         │
                                                        │  → place_ids[]         │
                                                        └────────────┬──────────┘
                                                                     │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  Google Places API:    │
                                                        │  /details (×N)         │
                                                        │  → name, phone,        │
                                                        │    hours, rating,      │
                                                        │    coordinates         │
                                                        └────────────┬──────────┘
                                                                     │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  Haversine sort        │
                                                        │  → ProviderListing[]  │
                                                        │    sorted by distance  │
                                                        └────────────┬──────────┘
                                                                     │
                                                                     ▼
                                                        ┌───────────────────────┐
                                                        │  React UI:             │
                                                        │  - Triage result card  │
                                                        │  - Map view (markers)  │
                                                        │  - List view (cards)   │
                                                        │  - Phone / Directions  │
                                                        └───────────────────────┘
```

---

## 4. UI/UX & Aesthetic Design Specifications

### 4.1 Design Philosophy

MedLens operates at the intersection of authority and accessibility. The visual design must simultaneously project clinical trustworthiness and remain comprehensible to users with no medical background. The palette, typography, and spatial system are derived from the environment of institutional healthcare — clean, unambiguous, spacious — but tempered by warmth to avoid the sterile anxiety commonly associated with clinical interfaces.

**The single signature element of MedLens:** A colour-coded urgency ribbon — a slim 4px left-border band on every result card, cycling through sage green, amber, and critical red — that encodes risk at a glance before the user reads a single word.

---

### 4.2 Colour Palette

| Token Name | Hex Value | Usage |
|------------|-----------|-------|
| `--color-surface` | `#F7F5F0` | Primary page background (warm off-white, not clinical white) |
| `--color-surface-card` | `#FFFFFF` | Card and modal backgrounds |
| `--color-sage` | `#7A9E87` | Primary brand accent; safe/routine indicators; CTAs |
| `--color-sage-light` | `#B8D4C0` | Hover states; progress fills; section dividers |
| `--color-teal` | `#2A7F8C` | Interactive elements; links; map markers; info alerts |
| `--color-teal-dark` | `#1C5C66` | Teal hover/active states; focused input borders |
| `--color-beige` | `#D4C5A9` | Secondary surface; tag backgrounds; disabled states |
| `--color-text-primary` | `#1A1A2E` | Headings and primary body copy |
| `--color-text-secondary` | `#5A5A72` | Captions, labels, secondary metadata |
| `--color-text-inverse` | `#F7F5F0` | Text on dark/coloured backgrounds |
| `--color-alert-critical` | `#C0392B` | Critical triage tier; T1 drug interactions; emergency modals |
| `--color-alert-critical-bg` | `#FDECEA` | Critical alert card background |
| `--color-alert-moderate` | `#D4860A` | Moderate triage tier; T2 drug interactions |
| `--color-alert-moderate-bg` | `#FDF3E0` | Moderate alert card background |
| `--color-alert-safe` | `#2E7D52` | Safe/routine triage; T3 interactions |
| `--color-alert-safe-bg` | `#E8F5EE` | Safe alert card background |
| `--color-border` | `#E2DCCF` | Default borders; input outlines; dividers |
| `--color-focus-ring` | `#2A7F8C` | Keyboard focus outline (3px, 2px offset) |

**Dark Mode Variants:**

Dark mode is implemented via a `[data-theme="dark"]` CSS attribute selector on `<html>`. Key overrides:

| Token | Dark Mode Value |
|-------|----------------|
| `--color-surface` | `#12141A` |
| `--color-surface-card` | `#1E2029` |
| `--color-text-primary` | `#EDF0F5` |
| `--color-text-secondary` | `#9099AB` |
| `--color-border` | `#2D303A` |
| `--color-beige` | `#2A2D38` |

Alert state colours retain near-identical hue in dark mode, with brightness increased by 10% to maintain contrast ratios above WCAG AA (4.5:1) on dark surfaces.

---

### 4.3 Typography

| Role | Typeface | Weight | Size Scale |
|------|----------|--------|------------|
| **Display / Hero** | `DM Serif Display` | 400 | `clamp(2rem, 5vw, 3.5rem)` |
| **Section Headings** | `DM Serif Display` | 400 | `1.75rem / 1.5rem / 1.25rem` (H1–H3) |
| **Body / UI** | `Inter` | 400, 500 | `1rem` (16px base); line-height `1.6` |
| **Labels / Metadata** | `Inter` | 500 | `0.75rem`, letter-spacing `0.04em`, uppercase |
| **Drug Names / Chemical** | `IBM Plex Mono` | 400 | `0.875rem`; used exclusively for RxNorm canonical names and RxCUI codes |
| **Alert / Warning Copy** | `Inter` | 700 | Matching body size; bold weight used for urgency headings only |

Font loading via `@fontsource` packages to eliminate external network dependencies and FOUT.

---

### 4.4 Spatial System & Layout

- **Base Unit:** `4px`. All spacing, padding, margin, border-radius, and gap values are multiples of 4.
- **Container Max-Width:** `1100px`, centred with `margin: 0 auto` and `padding: 0 1.5rem`.
- **Card Padding:** `24px` (desktop) / `16px` (mobile).
- **Section Vertical Spacing:** `64px` between major sections (desktop) / `40px` (mobile).
- **Border Radius:** `12px` for cards and modals; `8px` for buttons and inputs; `4px` for chips and badges; `50%` for avatar/icon containers.

**Mobile-First Breakpoints (Tailwind custom config):**

```javascript
screens: {
  'xs': '360px',
  'sm': '480px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
}
```

All layout uses CSS Grid or Flexbox. No fixed pixel widths on content containers. The scanner view occupies `100vw × 100dvh` on mobile to maximise the camera viewfinder.

---

### 4.5 Component Design Specifications

#### Result Cards

Each result card (drug profile, triage result, provider listing) follows this structure:

```
┌────────────────────────────────────────────────────────┐
│ ▌ [4px urgency ribbon — sage / amber / red]             │
│                                                          │
│  [Icon]  Drug / Provider Name          [Status chip]    │
│          Subtitle / Specialty                           │
│  ─────────────────────────────────────────────────────  │
│  Section content (indications, dosage, distance, etc.)  │
│                                                          │
│  [Secondary action]                [Primary CTA]        │
└────────────────────────────────────────────────────────┘
```

The 4px left-border ribbon is the signature urgency indicator. It is always rendered first in the DOM and remains visible even if card content overflows.

#### Alert States (High-Contrast)

Critical alerts must meet these minimum requirements:
- Background: `--color-alert-critical-bg`
- Left ribbon: `4px solid --color-alert-critical`
- Heading: `--color-alert-critical`, `font-weight: 700`, minimum `1.125rem`
- Body contrast ratio: minimum 7:1 (WCAG AAA) against background
- Icon: ⚠ or 🚨 rendered at `24px`
- No animations on critical alerts — immediate render, no fade-in

#### Transitions

- Standard UI transitions: `transition: all 150ms ease-in-out`
- Modal entry: `transform: translateY(8px) → translateY(0)` with `opacity: 0 → 1` over `200ms`
- Card hover: `transform: translateY(-2px)` with `box-shadow` elevation increase over `150ms`
- Skeleton loaders: CSS `@keyframes shimmer` using gradient animation; no spinner icons
- **`prefers-reduced-motion`:** All transitions and animations are wrapped in `@media (prefers-reduced-motion: no-preference)`. Reduced-motion users see instant state changes with no animation.

#### Navigation

- **Desktop:** Horizontal top navigation bar; `position: sticky; top: 0; z-index: 100`; subtle `backdrop-filter: blur(12px)` on scroll.
- **Mobile:** Fixed bottom tab bar with four icons: Scanner · Medications · Triage · Directory. Active state uses `--color-teal` fill; inactive uses `--color-text-secondary`.

---

### 4.6 Loading & Empty States

- **Scanner Processing:** Full-screen overlay with the MedLens logo mark and a pulsing ring animation in `--color-sage`. Status text cycles through: "Reading label…" → "Identifying medication…" → "Fetching clinical data…"
- **Empty Directory:** Illustrated empty state (SVG, inline) of a map pin with a question mark. Copy: "No providers found nearby. Try increasing your search radius or removing the 'Open now' filter."
- **API Error State:** Inline error banner with `--color-alert-moderate` styling. Copy describes the specific failure (e.g., "Could not reach drug database. Check your connection and try again.") with a retry button.

---

## 5. Data Privacy, Security & Legal Disclaimers

### 5.1 Image & Camera Data Handling

| Principle | Implementation |
|-----------|---------------|
| **No Persistent Image Storage** | Camera frames are captured client-side, converted to Base64, transmitted over HTTPS, processed in-memory by OpenCV/Tesseract, and immediately discarded. No image data is written to disk, database, object storage, or logs at any point. |
| **In-Memory Processing Only** | The FastAPI endpoint processes the image within a single request context. Python's garbage collector reclaims the NumPy array and all derived objects at request completion. |
| **No Server-Side Logging of Image Data** | FastAPI logging middleware is configured to exclude request body content for the `/scan/process` endpoint. Log entries contain only timestamp, endpoint path, response status, and anonymised request ID. |
| **HTTPS Enforcement** | All client-server communication is encrypted via TLS 1.3. HTTP requests are redirected to HTTPS via HTTP 301 at the reverse proxy layer (NGINX). |
| **No Third-Party Image Forwarding** | OCR is performed entirely within the application stack. Camera frame data is never forwarded to any external API, CDN, or analytics provider. |

### 5.2 Symptom & Health Data Handling

| Principle | Implementation |
|-----------|---------------|
| **No Session Persistence** | Symptom inputs, triage results, patient context (age, sex), and medication session lists are stored exclusively in React component state. They are purged on tab close, page refresh, or session end. No `localStorage`, `sessionStorage`, or cookies are used for health data. |
| **Anonymised API Calls** | Calls to Infermedica contain no name, device ID, IP address, or any identifier. The backend acts as a stateless proxy. |
| **No User Accounts Required** | MedLens v1.0 does not implement authentication, user profiles, or any mechanism by which health queries could be linked to an individual over time. |

### 5.3 Geolocation Data Handling

- User coordinates are captured client-side and transmitted only within the encrypted POST request to `/directory/search`.
- Coordinates are used solely to construct the Google Places API query and compute Haversine distances.
- Coordinates are not logged, stored, or associated with any session identifier on the backend.
- Users are informed of geolocation use via a plain-language permission prompt displayed before `getCurrentPosition()` is called.

### 5.4 API Key Security

- All third-party API keys (openFDA, RxNorm, Infermedica, Google Places) are stored as environment variables on the FastAPI server.
- No API key is ever transmitted to the client or included in frontend bundles.
- The FastAPI server acts as a proxy for all external API calls. The client never communicates directly with third-party APIs.
- Google Places API key is restricted to the MedLens server IP range and the `/directory/search` referrer pattern via the Google Cloud Console API key restriction settings.

### 5.5 Security Headers

The following HTTP security headers are set on all responses via FastAPI middleware:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://maps.googleapis.com; script-src 'self'; connect-src 'self' https://rxnav.nlm.nih.gov https://api.fda.gov https://api.infermedica.com https://maps.googleapis.com
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), geolocation=(self), microphone=()
```

### 5.6 Mandatory Medical Liability Disclaimers

The following disclaimers are legally required for deployment and must be displayed as specified.

---

#### 5.6.1 Global Application Disclaimer

Displayed persistently in the application footer on every page and as an interstitial on first launch (requiring explicit "I understand" acknowledgement before access is granted):

> **MedLens is an informational tool only and does not constitute medical advice, diagnosis, or treatment.**
>
> All medication information, drug interaction data, and triage assessments presented by MedLens are sourced from publicly available databases (openFDA, RxNorm, Infermedica) and are provided for general informational purposes only. This information may not be complete, up to date, or applicable to your individual circumstances.
>
> **Always consult a qualified, licensed healthcare professional before making any decision about your medications, health, or treatment.** Do not disregard professional medical advice or delay seeking it because of information you have read in this application.
>
> In the event of a medical emergency, call your local emergency services immediately (e.g., 112 in India, 911 in the USA, 999 in the UK).

---

#### 5.6.2 Triage Result Disclaimer

Displayed beneath every triage result card, regardless of urgency tier:

> *This triage assessment is generated by an algorithmic symptom-checking system and is not a medical diagnosis. It does not account for your full medical history, current medications, allergies, or physical examination findings. Use this result as general guidance only. When in doubt, consult a doctor.*

---

#### 5.6.3 Drug Interaction Disclaimer

Displayed in the header of every drug interaction result section:

> *Drug interaction information is provided for awareness purposes only. The absence of an interaction warning does not guarantee that an interaction does not exist. Always disclose all medications, supplements, and herbal products to your prescribing physician and pharmacist.*

---

#### 5.6.4 OCR Accuracy Disclaimer

Displayed below every scan result before the drug profile is rendered:

> *Text was extracted automatically from the scanned image and may contain errors. Always verify the identified medication against the original label and confirm with your pharmacist if you have any doubts.*

---

#### 5.6.5 Provider Directory Disclaimer

Displayed in the Geographic Specialist Directory view:

> *Provider listings are sourced from Google Places and may not reflect current availability, specialisation, or acceptance of new patients. Always call ahead to confirm appointment availability, hours of operation, and services offered. MedLens does not endorse, recommend, or verify any listed healthcare provider.*

---

*End of FEATURES_AND_STRUCTURE.md — MedLens Authoritative Blueprint v1.0.0*
