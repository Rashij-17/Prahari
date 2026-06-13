# Prahari — Codebase Shortcomings, Active Bugs & Remediation Roadmap

This document catalogs all identified technical debt, codebase bugs, and architecture shortcomings in both the React frontend and FastAPI backend. Each issue includes a severity rating and a step-by-step remediation plan.

---

## 1. Backend Codebase Issues

### 1.1 Shared Router Instance Causing Duplicate Paths
* **Location:** [`main.py`](file:///d:/Prahari/backend/main.py) and [`phase5.py`](file:///d:/Prahari/backend/routers/phase5.py)
* **Severity:** 🔴 **Critical** (Architectural)
* **Description:** Both the Symptom Triage (`/triage`) and Doctor Directory (`/directory`) endpoints are declared on the same router instance in `phase5.py` and mounted twice in `main.py`. This means `/triage/search` (which should only be directory search) and `/directory/assess` (which should only be triage) both exist as duplicate routes.
* **Remediation:**
  1. Split `phase5.py` into two separate files: `routers/triage.py` and `routers/directory.py`.
  2. Instantiate separate `APIRouter()` objects in each file.
  3. Register `triage.router` at `/triage` and `directory.router` at `/directory` in `main.py`.

### 1.2 Inline Pydantic Schemas
* **Location:** `backend/models/` is empty; schemas are inline in `routers/`
* **Severity:** 🟠 **Medium** (Code Organization)
* **Description:** The project structure has a dedicated `models/` directory, but it remains empty. All Pydantic request/response schemas are written inline in the routers, violating modular coding practices.
* **Remediation:**
  1. Move `FramePayload` and `OCRResult` schemas to `models/vision.py`.
  2. Move `DrugProfile` and `DrugSummary` schemas to `models/medication.py`.
  3. Move `TriageRequest`, `TriageResponse`, and `DirectoryRequest` schemas to `models/triage.py`.
  4. Update imports in all router files.

### 1.3 Fragile OCR Character Substitution Rules
* **Location:** [`text_refiner.py` (Line 35)](file:///d:/Prahari/backend/utils/text_refiner.py#L35)
* **Severity:** 🟠 **Medium** (Core Scanner Accuracy)
* **Description:** The replacement lookup `r"cl": "d"` runs as a global substring replacement without word boundary gates. This causes standard words like `"clinical"` to be incorrectly processed into `"dinical"`.
* **Remediation:**
  - Update the regex pattern to use word boundaries or lookaheads, restricting the correction to known prefix patterns (e.g., matching `cl` only at the start of specific syllables like `chloro` -> `dloro` if appropriate, or refactoring the rule entirely).

### 1.4 Silent Exception Swallowing in Concurrency
* **Location:** [`medication.py` (Line 183-189)](file:///d:/Prahari/backend/routers/medication.py#L183-L189)
* **Severity:** 🟡 **Low** (Stability)
* **Description:** The search queries run concurrently using `asyncio.gather(..., return_exceptions=True)`. However, if an API call fails, the exception object is returned inline in the results list. The code checks `isinstance(rxnorm_results, list)` but fails to catch or log the exception if it is an Exception object, silently swallowing backend failure states.
* **Remediation:**
  - Check if the returned element in the gathered list is an instance of `Exception`. If so, log the error using `logger.error` and handle it gracefully instead of proceeding blindly.

### 1.5 Stop Words List Recreated on Every Invocation
* **Location:** [`text_refiner.py` (Line 178-189)](file:///d:/Prahari/backend/utils/text_refiner.py#L178-L189)
* **Severity:** 🟡 **Low** (Performance)
* **Description:** The `_STOP_WORDS` set is declared inside the `_filter_boilerplate` function. This causes the Python interpreter to allocate memory and reconstruct this set on every OCR text scan, generating unnecessary heap allocations.
* **Remediation:**
  - Move `_STOP_WORDS` to the module level as a private constant.

---

## 2. Frontend Interface Issues

### 2.1 Scanner $\rightarrow$ Drug Search Handoff is Disconnected
* **Location:** [`CameraScanner.jsx` (Line 244-290)](file:///d:/Prahari/frontend/src/components/scanner/CameraScanner.jsx#L244-L290)
* **Severity:** 🔴 **Critical** (Broken Feature Flow)
* **Description:** The visual scanner displays identified drug candidate chips (e.g., *"Metformin"*), but tapping the chips does nothing. The user must manually navigate to the medications page and type the name. An outdated comment label remains: *"Drug Intelligence lookup will be available in Phase 4."*
* **Remediation:**
  1. Add a navigation prop or use React Router's `useNavigate` hook inside `CameraScanner.jsx`.
  2. Implement an `onClick` handler on the candidate chips that routes the user to `/medications?search={candidate_name}`.
  3. Update `MedicationsPage.jsx` to parse search parameters from the URL on load and execute the query automatically.

### 2.2 Triage Conditions Bar Width is Pixel-Based
* **Location:** [`TriagePage.jsx`](file:///d:/Prahari/frontend/src/pages/TriagePage.jsx)
* **Severity:** 🟠 **Medium** (Visual Bug)
* **Description:** The probability bar that displays disease probability in symptom results uses `Math.round(c.probability * 100)` as a **pixel width** (e.g., `100px` max) instead of a percentage width (e.g., `100%`), causing the bar to appear extremely narrow and misaligned on high-resolution screens.
* **Remediation:**
  - Modify the inline styles in `TriagePage.jsx` to set width as a percentage string: `width: "${Math.round(c.probability * 100)}%"` instead of using absolute pixel numbers.

### 2.3 Dead Page Imports in Root Router
* **Location:** [`App.jsx` (Line 20)](file:///d:/Prahari/frontend/src/App.jsx#L20)
* **Severity:** 🟡 **Low** (Code Cleanup)
* **Description:** `PlaceholderPage.jsx` is imported but never mapped to a route or rendered.
* **Remediation:**
  - Remove the unused import.

### 2.4 Missing Accessibility Elements
* **Location:** [`MedicationsPage.jsx`](file:///d:/Prahari/frontend/src/pages/MedicationsPage.jsx)
* **Severity:** 🟡 **Low** (Accessibility)
* **Description:** Drug result list cards lack focus states, keydown handlers, and appropriate role definitions for screen readers.
* **Remediation:**
  - Add `onKeyDown` listeners to result buttons to trigger lookups on `Enter`/`Space` key presses.

---

## 3. The Visual Scanner Blueprint (Architectural Options)

For resolving the visual scanner curved subject and accuracy bottlenecks, Prahari can implement any of the following models in a future sprint:

### Option 1: In-Memory Tesseract (Current Setup)
* **Accuracy:** 40%–60% on average label conditions; 10% on curved pill bottles.
* **Backend RAM:** Low ($< 100\text{MB}$).
* **Dependencies:** Requires local system installation of Tesseract OCR binaries.
* **Implementation Effort:** None (already built).

### Option 2: Gemini Flash API (Multimodal LLM) — *Recommended*
* **Accuracy:** 90%–95% (corrects perspective warp, reads shadows, glares, and curved bottles).
* **Backend RAM:** Zero (handled by external API).
* **Dependencies:** Requires a Google AI Studio Developer Key (generous free tier: 15 RPM / 1,500 RPD).
* **Implementation Effort:** Low (~40 lines of code to call Google's API). Completely replaces OpenCV preprocessing code.

### Option 3: Google Cloud Vision API (Commercial OCR)
* **Accuracy:** 85%–90% (built-in curved line detection).
* **Backend RAM:** Zero.
* **Dependencies:** Requires Google Cloud API Project with enabled Vision API (free for first 1,000 requests/month).
* **Implementation Effort:** Low.

### Option 4: Client-Side Barcode Scanning (html5-qrcode)
* **Accuracy:** 100% (extracts exact numeric barcode).
* **Backend RAM:** Zero.
* **Dependencies:** JavaScript library (`html5-qrcode` or native browser `BarcodeDetector` API). Queries openFDA NDC directory.
* **Implementation Effort:** Medium (requires building a separate barcode scanning view in React). Only works on packaged retail boxes, not custom prescription bottles.
