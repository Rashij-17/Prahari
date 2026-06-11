# Prahari (The Sentinel) - Implementation Plan

## Phase 1: Environment Setup & Architecture Initialization
**Objective:** Establish the foundational frontend and backend environments, ensuring clean routing and communication across the stack.

### Tasks:
- [ ] Initialize the React.js application using Vite for optimal build performance.
- [ ] Set up the FastAPI backend environment and virtual environment.
- [ ] Configure cross-origin resource sharing (CORS) in FastAPI to accept requests from the React dev server.
- [ ] Establish the base folder structures for both frontend (`components`, `pages`, `hooks`, `assets`) and backend (`routers`, `services`, `models`, `utils`).

### Key Files Created/Modified:
* `frontend/package.json`
* `backend/main.py` (Entry point for Uvicorn)
* `backend/requirements.txt`
* `backend/core/config.py` (Environment variables for API keys)

### Success Criteria:
- [ ] The React app is running on port 5173.
- [ ] The FastAPI server is running on port 8000.
- [ ] A GET request to `http://localhost:8000/health` returns a `200 OK` status with `{"status": "Sentinel Active"}`.

---

## Phase 2: The "Vigilant Sage" Frontend Foundation
**Objective:** Implement the minimalist, professional UI/UX theme utilizing the specified color palettes and typography to create a calming, clinical aesthetic.

### Tasks:
- [ ] Install and configure Tailwind CSS.
- [ ] Extend the Tailwind theme configuration with the "Vigilant Sage" palette (`teal-700` for primary actions, `emerald-500` for success states, soft slate for backgrounds).
- [ ] Import and set up the `Inter` (body) and `Outfit` (headings) fonts.
- [ ] Build the core shell: Dashboard layout, top navigation, and an aesthetic dark/light mode toggle.
- [ ] Create reusable UI primitives (Buttons, Cards, Modals).

### Key Files Created/Modified:
* `frontend/tailwind.config.js`
* `frontend/index.css` (Font imports and base styles)
* `frontend/src/components/layout/DashboardLayout.jsx`
* `frontend/src/components/ui/ThemeToggle.jsx`

### Success Criteria:
- [ ] The dashboard renders the core layout without visual overflow.
- [ ] The UI successfully toggles between dark mode and light mode, respecting the teal/slate color scales.
- [ ] Typography applies correctly across different heading levels.

---

## Phase 3: The Vision & OCR Engine
**Objective:** Establish the computer vision pipeline to capture medication labels via the device camera, process the frames, and extract raw text using standard backend visual processing techniques.

### Tasks:
- [ ] Implement an HTML5 `<video>` based camera component in React to capture high-resolution frames.
- [ ] Create a frontend service to convert captured frames to base64 strings and transmit them to the backend.
- [ ] Set up a FastAPI router endpoint to receive the image payloads.
- [ ] Implement image preprocessing using OpenCV (grayscale conversion, adaptive thresholding, noise reduction) to optimize for text extraction.
- [ ] Integrate Tesseract OCR to process the optimized frames and extract the medication label text.

### Key Files Created/Modified:
* `frontend/src/components/scanner/CameraScanner.jsx`
* `frontend/src/services/api.js`
* `backend/routers/vision.py`
* `backend/services/ocr_service.py` (OpenCV and Tesseract logic)

### Success Criteria:
- [ ] The browser successfully requests and activates the user's camera.
- [ ] Capturing a frame transmits the data to the backend.
- [ ] The FastAPI terminal logs the raw extracted text from a sample medication bottle.

---

## Phase 4: Medication Intelligence Pipeline
**Objective:** Transform the raw extracted OCR text into actionable medical intelligence using RxNorm and openFDA.

### Tasks:
- [ ] Develop a parsing utility to identify potential medication names/salts from the noisy OCR string.
- [ ] Integrate the RxNorm API to normalize the extracted string into a standard RxCUI (Concept Unique Identifier).
- [ ] Use the normalized RxCUI to query the openFDA API for structured data (active ingredients, side effects, contraindications, black box warnings).
- [ ] Build the frontend `DrugIntelligenceCard` to display these critical data points cleanly, utilizing the teal/emerald color scheme for safe data and distinct alerts for warnings.

### Key Files Created/Modified:
* `backend/services/rxnorm_service.py`
* `backend/services/fda_service.py`
* `backend/routers/medication.py`
* `frontend/src/components/medication/DrugIntelligenceCard.jsx`

### Success Criteria:
- [ ] Scanning a known label (e.g., "Acetaminophen") successfully normalizes the term.
- [ ] The openFDA response is parsed and sent to the frontend.
- [ ] The UI renders a structured card displaying at least 3 distinct sections: Active Ingredient, Warnings, and Common Side Effects.

---

## Phase 5: Triage & Geolocation Routing
**Objective:** Assess user symptoms and route them to appropriate local medical specialists.

### Tasks:
- [ ] Build a dynamic symptom input form (searchable dropdown or free-text tags).
- [ ] Integrate the Infermedica API to assess the provided symptoms and determine a triage level (e.g., Self-care, Consult Doctor, Emergency).
- [ ] Implement the HTML5 Geolocation API to securely request and capture the user's current latitude and longitude.
- [ ] Connect to the Google Places API to search for relevant nearby clinics or hospitals based on the determined triage urgency and user location.

### Key Files Created/Modified:
* `frontend/src/components/triage/SymptomChecker.jsx`
* `frontend/src/components/routing/MapRouter.jsx`
* `backend/routers/triage.py`
* `backend/services/routing_service.py` (Google Places integration)

### Success Criteria:
- [ ] Submitting a set of symptoms returns a calculated risk/triage level.
- [ ] The browser prompts for location access.
- [ ] The UI displays a list of at least 3 nearby medical facilities relevant to the symptom severity.

---

## Phase 6: Polish, Error Handling & Security
**Objective:** Fortify the application for edge cases, ensuring clear communication with the user and maintaining medical liability boundaries.

### Tasks:
- [ ] Implement robust error boundaries and fallback UIs for OCR failures (e.g., blurry images) or API timeouts.
- [ ] Add aesthetic loading skeletons and spinners during asynchronous API calls (OCR processing, Infermedica triage).
- [ ] Implement strict, non-dismissible medical disclaimers (e.g., "Prahari is an informational tool, not a substitute for professional medical advice").
- [ ] Secure backend endpoints and ensure no sensitive location or health data is logged persistently without encryption.

### Key Files Created/Modified:
* `frontend/src/components/shared/LoadingState.jsx`
* `frontend/src/components/shared/DisclaimerModal.jsx`
* `backend/middleware/error_handler.py`

### Success Criteria:
- [ ] Simulating a network failure during scanning yields a graceful user-facing error message.
- [ ] The medical disclaimer must be explicitly acknowledged before the user can access the camera or symptom checker.
- [ ] All asynchronous actions have visual indicators preventing duplicate submissions.
