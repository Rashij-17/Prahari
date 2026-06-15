# Prahari (The Sentinel) - Implementation Plan

## Phase 1: Environment Setup & Architecture Initialization
**Objective:** Establish the foundational frontend and backend environments, ensuring clean routing and communication across the stack.

### Tasks:
- [x] Initialize the React.js application using Vite for optimal build performance.
- [x] Set up the FastAPI backend environment and virtual environment.
- [x] Configure cross-origin resource sharing (CORS) in FastAPI to accept requests from the React dev server.
- [x] Establish the base folder structures for both frontend (`components`, `pages`, `hooks`, `assets`) and backend (`routers`, `services`, `models`, `utils`).

### Key Files Created/Modified:
* `frontend/package.json`
* `backend/main.py` (Entry point for Uvicorn)
* `backend/requirements.txt`
* `backend/core/config.py` (Environment variables for API keys)

### Success Criteria:
- [x] The React app is running on port 5173.
- [x] The FastAPI server is running on port 8000.
- [x] A GET request to `http://localhost:8000/health` returns a `200 OK` status with `{"status": "Sentinel Active"}`.

---

## Phase 2: The "Vigilant Sage" Frontend Foundation
**Objective:** Implement the minimalist, professional UI/UX theme utilizing the specified color palettes and typography to create a calming, clinical aesthetic.

### Tasks:
- [x] Install and configure Tailwind CSS.
- [x] Extend the Tailwind theme configuration with the "Vigilant Sage" palette (`teal-700` for primary actions, `emerald-500` for success states, soft slate for backgrounds).
- [x] Import and set up the `Inter` (body) and `Outfit` (headings) fonts.
- [x] Build the core shell: Dashboard layout, top navigation, and an aesthetic dark/light mode toggle.
- [x] Create reusable UI primitives (Buttons, Cards, Modals).

### Key Files Created/Modified:
* `frontend/tailwind.config.js`
* `frontend/index.css` (Font imports and base styles)
* `frontend/src/components/layout/DashboardLayout.jsx`
* `frontend/src/components/ui/ThemeToggle.jsx`

### Success Criteria:
- [x] The dashboard renders the core layout without visual overflow.
- [x] The UI successfully toggles between dark mode and light mode, respecting the teal/slate color scales.
- [x] Typography applies correctly across different heading levels.

---

## Phase 3: The Vision & OCR Engine
**Objective:** Establish the computer vision pipeline to capture medication labels via the device camera, process the frames, and extract raw text using standard backend visual processing techniques.

### Tasks:
- [x] Implement an HTML5 `<video>` based camera component in React to capture high-resolution frames.
- [x] Create a frontend service to convert captured frames to base64 strings and transmit them to the backend.
- [x] Set up a FastAPI router endpoint to receive the image payloads.
- [x] Implement image preprocessing using OpenCV (grayscale conversion, adaptive thresholding, noise reduction) to optimize for text extraction.
- [x] Integrate Tesseract OCR to process the optimized frames and extract the medication label text.

### Key Files Created/Modified:
* `frontend/src/components/scanner/CameraScanner.jsx`
* `frontend/src/services/api.js`
* `backend/routers/vision.py`
* `backend/services/ocr_service.py` (OpenCV and Tesseract logic)

### Success Criteria:
- [x] The browser successfully requests and activates the user's camera.
- [x] Capturing a frame transmits the data to the backend.
- [x] The FastAPI terminal logs the raw extracted text from a sample medication bottle.

---

## Phase 4: Medication Intelligence Pipeline
**Objective:** Transform the raw extracted OCR text into actionable medical intelligence using RxNorm and openFDA.

### Tasks:
- [x] Develop a parsing utility to identify potential medication names/salts from the noisy OCR string.
- [x] Integrate the RxNorm API to normalize the extracted string into a standard RxCUI (Concept Unique Identifier).
- [x] Use the normalized RxCUI to query the openFDA API for structured data (active ingredients, side effects, contraindications, black box warnings).
- [x] Build the frontend `DrugIntelligenceCard` to display these critical data points cleanly, utilizing the teal/emerald color scheme for safe data and distinct alerts for warnings.

### Key Files Created/Modified:
* `backend/services/rxnorm_service.py`
* `backend/services/fda_service.py`
* `backend/routers/medication.py`
* `frontend/src/components/medication/DrugIntelligenceCard.jsx`

### Success Criteria:
- [x] Scanning a known label (e.g., "Acetaminophen") successfully normalizes the term.
- [x] The openFDA response is parsed and sent to the frontend.
- [x] The UI renders a structured card displaying at least 3 distinct sections: Active Ingredient, Warnings, and Common Side Effects.

---

## Phase 5: Triage & Geolocation Routing
**Objective:** Assess user symptoms and route them to appropriate local medical specialists.

### Tasks:
- [x] Build a dynamic symptom input form (searchable dropdown or free-text tags).
- [x] Integrate the Infermedica API to assess the provided symptoms and determine a triage level (e.g., Self-care, Consult Doctor, Emergency).
- [x] Implement the HTML5 Geolocation API to securely request and capture the user's current latitude and longitude.
- [x] Connect to the Google Places API to search for relevant nearby clinics or hospitals based on the determined triage urgency and user location.

### Key Files Created/Modified:
* `frontend/src/components/triage/SymptomChecker.jsx`
* `frontend/src/components/routing/MapRouter.jsx`
* `backend/routers/triage.py`
* `backend/services/routing_service.py` (Google Places integration)

### Success Criteria:
- [x] Submitting a set of symptoms returns a calculated risk/triage level.
- [x] The browser prompts for location access.
- [x] The UI displays a list of at least 3 nearby medical facilities relevant to the symptom severity.

---

## Phase 6: Polish, Error Handling & Security
**Objective:** Fortify the application for edge cases, ensuring clear communication with the user and maintaining medical liability boundaries.

### Tasks:
- [x] Implement robust error boundaries and fallback UIs for OCR failures (e.g., blurry images) or API timeouts.
- [x] Add aesthetic loading skeletons and spinners during asynchronous API calls (OCR processing, Infermedica triage).
- [x] Implement strict, non-dismissible medical disclaimers (e.g., "Prahari is an informational tool, not a substitute for professional medical advice").
- [x] Secure backend endpoints and ensure no sensitive location or health data is logged persistently without encryption.

### Key Files Created/Modified:
* `frontend/src/components/shared/LoadingState.jsx`
* `frontend/src/components/shared/DisclaimerModal.jsx`
* `backend/middleware/error_handler.py`

### Success Criteria:
- [x] Simulating a network failure during scanning yields a graceful user-facing error message.
- [x] The medical disclaimer must be explicitly acknowledged before the user can access the camera or symptom checker.
- [x] All asynchronous actions have visual indicators preventing duplicate submissions.
