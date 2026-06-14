# Prahari — Codebase Shortcomings, Active Bugs & Remediation Roadmap

This document catalogs all identified technical debt, codebase bugs, and architecture shortcomings in both the React frontend and FastAPI backend. Each issue includes a severity rating and a step-by-step remediation plan.

---

## 1. Backend Codebase Issues (All Resolved)

### 1.1 Shared Router Instance Causing Duplicate Paths — ✅ **RESOLVED**
* **Location:** [`main.py`](file:///d:/Prahari/backend/main.py) and [`phase5.py`](file:///d:/Prahari/backend/routers/phase5.py)
* **Status:** Resolved. Split router into `triage.py` and `directory.py` and mounted them correctly on their respective prefixes.

### 1.2 Inline Pydantic Schemas — ✅ **RESOLVED**
* **Location:** `backend/models/`
* **Status:** Resolved. Moved all schemas to model files (`models/vision.py`, `models/medication.py`, `models/triage.py`, `models/directory.py`).

### 1.3 Fragile OCR Character Substitution Rules — ✅ **RESOLVED**
* **Location:** [`text_refiner.py` (Line 35)](file:///d:/Prahari/backend/utils/text_refiner.py#L35)
* **Status:** Resolved. Restricted `cl` -> `d` substitution utilizing lookahead patterns and removed the redundant `capsule$` rule.

### 1.4 Silent Exception Swallowing in Concurrency — ✅ **RESOLVED**
* **Location:** [`medication.py` (Line 183-189)](file:///d:/Prahari/backend/routers/medication.py#L183-L189)
* **Status:** Resolved. Handled gathered exceptions appropriately and logged failures rather than swallowing them.

### 1.5 Stop Words List Recreated on Every Invocation — ✅ **RESOLVED**
* **Location:** [`text_refiner.py` (Line 178-189)](file:///d:/Prahari/backend/utils/text_refiner.py#L178-L189)
* **Status:** Resolved. Moved `_STOP_WORDS` to the module level.

---

## 2. Frontend Interface Issues (All Resolved)

### 2.1 Scanner → Drug Search Handoff is Disconnected — ✅ **RESOLVED**
* **Location:** [`CameraScanner.jsx` (Line 244-290)](file:///d:/Prahari/frontend/src/components/scanner/CameraScanner.jsx#L244-L290)
* **Status:** Resolved. Implemented `useNavigate` to route chip clicks to MedicationsPage with `?search={candidate_name}`.

### 2.2 Triage Conditions Bar Width is Pixel-Based — ✅ **RESOLVED**
* **Location:** [`TriagePage.jsx`](file:///d:/Prahari/frontend/src/pages/TriagePage.jsx)
* **Status:** Resolved. Fixed the inline styling to use percentage-based widths in a 100px overflow-hidden track.

### 2.3 Dead Page Imports in Root Router — ✅ **RESOLVED**
* **Location:** [`App.jsx` (Line 20)](file:///d:/Prahari/frontend/src/App.jsx#L20)
* **Status:** Resolved. Unused PlaceholderPage imports removed.

### 2.4 Missing Accessibility Elements — ✅ **RESOLVED**
* **Location:** [`MedicationsPage.jsx`](file:///d:/Prahari/frontend/src/pages/MedicationsPage.jsx)
* **Status:** Resolved. Focus/blur tracking and focus rings added for keyboard-only users.

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
