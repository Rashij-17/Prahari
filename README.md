<div align="center">
  <!-- Prahari Sentinel Logo -->
  <svg width="150" height="150" viewBox="0 0 32 32" fill="none" style="border-radius: 20%; filter: drop-shadow(0px 8px 24px rgba(42, 127, 140, 0.35));" aria-hidden="true">
    <rect width="32" height="32" rx="6" fill="#12141a" />
    <path d="M16 4L6 8.5v8.5c0 6.275 4.582 11.4 10 12.5 5.418-1.1 10-6.225 10-12.5V8.5L16 4z" fill="#2A7F8C" fill-opacity="0.15" stroke="#2A7F8C" stroke-width="1.5" />
    <rect x="14" y="10" width="4" height="12" rx="1" fill="#7A9E87" />
    <rect x="10" y="14" width="12" height="4" rx="1" fill="#7A9E87" />
  </svg>

  <br /><br />

  <!-- Animated Typing Headline -->
  <a href="https://github.com/Rashij-17/Prahari">
    <img src="https://readme-typing-svg.herokuapp.com?font=DM+Serif+Display&weight=800&size=55&pause=1000&color=2A7F8C&center=true&vCenter=true&width=800&lines=🛡️+PRAHARI;YOUR+HEALTH+SENTINEL+🩺;VISUAL+DRUG+SCANNER+📸;AI+TRIAGE+AND+CARE+DIRECTORY+📍" alt="Prahari Typing Headline" />
  </a>

  <h3>🛡️ Patient-Centric Health Sentinel, Medication Demystifier & Triage PWA 🛡️</h3>
  
  <p>
    Prahari is a responsive Progressive Web App (PWA) designed to solve the critical gaps in health literacy and emergency care navigation for India's semi-urban populations.
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
    <img src="https://img.shields.io/badge/OpenCV-4.9-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" alt="OpenCV" />
  </p>

  <br />

  <!-- Bento Grid Status -->
  <table align="center" style="border-collapse: collapse; border: 2px solid #2A7F8C; background: #12141a; font-family: 'Courier New', Courier, monospace; width: 100%; border-radius: 8px; overflow: hidden; box-shadow: 0px 8px 30px rgba(42,127,140,0.25);">
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 15px; border-right: 1px solid #222; color: #FFF;"><strong>🛡️ SYSTEM STATUS</strong></td>
      <td style="padding: 15px; color: #7A9E87; border-right: 1px solid #222; text-shadow: 0 0 5px #7A9E87;">🟢 ACTIVE DEVELOPMENT</td>
      <td style="padding: 15px; border-right: 1px solid #222; color: #FFF;"><strong>🧠 CLINICAL NLP</strong></td>
      <td style="padding: 15px; color: #2A7F8C; text-shadow: 0 0 5px #2A7F8C;">🩺 INFERMEDICA v3</td>
    </tr>
    <tr>
      <td style="padding: 15px; border-right: 1px solid #222; color: #FFF;"><strong>🏥 DRUG DATABASE</strong></td>
      <td style="padding: 15px; color: #2A7F8C; border-right: 1px solid #222; text-shadow: 0 0 5px #2A7F8C;">⚡ FDA + RXNORM</td>
      <td style="padding: 15px; border-right: 1px solid #222; color: #FFF;"><strong>📍 GEOLOCATION</strong></td>
      <td style="padding: 15px; color: #7A9E87; text-shadow: 0 0 5px #7A9E87;">🗺️ GOOGLE PLACES</td>
    </tr>
  </table>

</div>

<br />
<hr style="border: 0; border-top: 2px dashed #2A7F8C; margin: 2rem 0;" />

## 🎨 The Design System (v2.0 Vigilant Sage)

Prahari utilizes a clinical, highly legible, and reassuring color scheme combined with dynamic animations to optimize accessibility for visually challenged or anxious patients.

<details>
<summary><b>🎨 View CSS Variables Token Registry (`frontend/src/index.css`)</b></summary>

See [`frontend/src/index.css`](frontend/src/index.css) for the authoritative token registry.

</details>

---

## 🚀 Core Features

<table style="width: 100%; border-collapse: separate; border-spacing: 12px;">
  <tr>
    <td style="background: #181c1b; color: #fff; padding: 20px; border: 1.5px solid #7a9e87; border-radius: 12px; width: 50%; vertical-align: top;">
      <h3 style="margin-top:0; color: #7a9e87;">📸 1. Visual Label Scanner</h3>
      <p style="color: #bbb; font-size: 13.5px; line-height: 1.6;">Point the camera at any medication bottle. The CV pipeline handles frames, runs deskewing, binarizes characters, and extracts candidates through a text refiner.</p>
      <span style="font-size: 11px; background: rgba(122,158,135,0.2); color: #7a9e87; padding: 3px 8px; border-radius: 4px;">OPENCV + TESSERACT</span>
    </td>
    <td style="background: #181c1b; color: #fff; padding: 20px; border: 1.5px solid #2a7f8c; border-radius: 12px; width: 50%; vertical-align: top;">
      <h3 style="margin-top:0; color: #2a7f8c;">💊 2. Drug Intelligence</h3>
      <p style="color: #bbb; font-size: 13.5px; line-height: 1.6;">Resolves brand/generic names to canonical RxCUIs via NLM RxNorm, then scrapes openFDA records to yield structured dosage, warnings, and interactions.</p>
      <span style="font-size: 11px; background: rgba(42,127,140,0.2); color: #2a7f8c; padding: 3px 8px; border-radius: 4px;">FDA + RXNORM API</span>
    </td>
  </tr>
  <tr>
    <td style="background: #181c1b; color: #fff; padding: 20px; border: 1.5px solid #c24b3c; border-radius: 12px; width: 50%; vertical-align: top;">
      <h3 style="margin-top:0; color: #c24b3c;">🩺 3. Symptom Triage</h3>
      <p style="color: #bbb; font-size: 13.5px; line-height: 1.6;">Accepts unstructured plain text symptoms (e.g., *"my head hurts since last night"*), detects language, parses clinical tokens, and categorizes urgency with actionable care paths.</p>
      <span style="font-size: 11px; background: rgba(194,75,60,0.2); color: #c24b3c; padding: 3px 8px; border-radius: 4px;">INFERMEDICA AI</span>
    </td>
    <td style="background: #181c1b; color: #fff; padding: 20px; border: 1.5px solid #d48d2a; border-radius: 12px; width: 50%; vertical-align: top;">
      <h3 style="margin-top:0; color: #d48d2a;">📍 4. Doctor Directory</h3>
      <p style="color: #bbb; font-size: 13.5px; line-height: 1.6;">Fetches live latitude/longitude from your browser, computes Haversine distances, and queries Google Places for nearby specialist clinics and hospitals.</p>
      <span style="font-size: 11px; background: rgba(212,141,42,0.2); color: #d48d2a; padding: 3px 8px; border-radius: 4px;">GOOGLE PLACES API</span>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack & Dependencies

### Frontend Architecture
* **React 18.3** — Single Page Application (SPA) structure.
* **Vite** — High-speed Hot Module Replacement (HMR) bundler.
* **React Router DOM 6** — Client-side route navigator.
* **TailwindCSS 3.4** — Component responsive utility styling.
* **HTML5 Canvas / MediaDevices** — Handles direct camera frame capture in 4:3 ratios.

### Backend Pipeline
* **FastAPI 0.111** — Asynchronous Python web framework.
* **Uvicorn** — ASGI production server.
* **OpenCV (cv2) 4.9** — Image preprocessing (up-scaling, blurring, adaptive thresholding).
* **PyTesseract** — Wrapper binding Tesseract OCR LSTM Engine.
* **HTTPX** — Fully async client requests to RxNorm, openFDA, and Google.

---

## 🟢 Implementation Status

| Feature | Status | Backend Service | Frontend Interface |
| :--- | :--- | :--- | :--- |
| **Drug Intelligence** | 🟢 **100% Functional** | RxNorm + openFDA resolvers | Search bar + full detailed profile |
| **Symptom Triage** | 🟡 **Demo Mode** | Infermedica NLP (Fallback mocks) | Symptom submission + conditions list |
| **Doctor Directory** | 🟡 **Demo Mode** | Google Places (Fallback mocks) | Geo-sorted lists, map directions |
| **Label Scanner** | 🟡 **Partially Connected** | OpenCV Preprocess + Tesseract | Camera frame capture & crop canvas |

---

## 📸 The Visual Scanner Roadmap (Architectural Options)

For our visual scanner, we have analyzed four paths for resolving medication text on curved bottles. We will keep these options open for future updates:

```
                  ┌────────────────────────────────────────┐
                  │        Medication Scan Request         │
                  └───────────────────┬────────────────────┘
                                      │
             ┌────────────────────────┼────────────────────────┐
             ▼                        ▼                        ▼
    [Option A: Local Tesseract]  [Option B: Gemini Flash]  [Option C: Cloud Vision]
    - Low server RAM             - Zero server RAM         - Zero server RAM
    - Inaccurate on curves       - Perfect curve accuracy  - Perfect curve accuracy
    - Local & Free               - Free developer tier     - Free 1k scans/mo
```

### Option A: Local Tesseract OCR (Current Implementation)
* **How:** Browser canvas captures image $\rightarrow$ Base64 posted $\rightarrow$ OpenCV greyscales & deskews $\rightarrow$ Tesseract extracts text.
* **Pros:** Free, completely self-contained.
* **Cons:** Setup is highly system-dependent (requires Tesseract binary installation on Windows/Linux). Accuracy is extremely low on cylindrical containers (pill bottles) or under bad lighting.

### Option B: Gemini 1.5 / 2.5 Flash API (Multimodal AI) — *Recommended*
* **How:** Frontend posts the captured frame directly $\rightarrow$ Backend forwards the image to Gemini Flash with a parser prompt $\rightarrow$ Gemini returns structured drug names in JSON.
* **Pros:** Flawless reading capability on distorted surfaces, curved bottles, and shadows. Zero RAM impact on the python backend. Completely free developer tier (15 RPM / 1500 RPD).
* **Cons:** Requires active internet connectivity and API keys.

### Option C: Google Cloud Vision API (Commercial OCR)
* **How:** Backend routes the captured frame to Google Cloud Vision's OCR endpoint.
* **Pros:** Highly accurate on rotated text, curves, and glares. Zero RAM impact on the backend.
* **Cons:** Free up to 1,000 requests/month, after which it charges $1.50 per 1,000 requests.

### Option D: Client-Side Barcode Scanning
* **How:** Browser runs `html5-qrcode` to scan the medicine package barcode $\rightarrow$ posts number $\rightarrow$ openFDA NDC API returns the drug profile.
* **Pros:** 100% accurate. Zero server RAM overhead.
* **Cons:** Only works on retail medicine boxes with standard barcodes; fails on custom hospital pharmacy bottles.

---

## 🚨 Codebase Shortcomings & Active Bugs

The following critical issues were uncovered during the codebase audit and need to be fixed:

### 1. 🔴 Scanner $\rightarrow$ Drug Intelligence Handoff is Disconnected
* **Location:** [`CameraScanner.jsx`](frontend/src/components/scanner/CameraScanner.jsx)
* **Bug:** The candidate drug chips generated by the OCR are displayed correctly but are not interactive. Clicking a chip does not trigger a medication search. The component still displays a static message: *"Drug Intelligence lookup will be available in Phase 4."*

### 2. 🔴 Duplicate Routes via Shared Router Instance
* **Location:** [`main.py`](backend/main.py) & [`phase5.py`](backend/routers/phase5.py)
* **Bug:** Both symptom triage and directory lookups share a single router object (`phase5.py`). In `main.py`, this router is mounted twice at different prefixes (`/triage` and `/directory`), meaning all triage routes are also exposed under the `/directory` path and vice-versa.

### 3. 🟠 Fragile OCR Replacement Rule
* **Location:** [`text_refiner.py`](backend/utils/text_refiner.py)
* **Bug:** The regex replacement pattern `r"cl": "d"` is far too broad. It replaces the character sequence `cl` anywhere in the text without boundary limits, causing common words like `"clinical"` to be incorrectly modified into `"dinical"`.

### 4. 🟠 Missing Pydantic Models Organization
* **Location:** `backend/models/`
* **Bug:** The `models/` directory in the backend is completely empty. Instead of being modular, Pydantic schemas (like `TriageResponse` or `DrugProfile`) are written inline inside the route files, violating the codebase structure guidelines.

### 5. 🟡 Silent Exception Swallowing
* **Location:** [`backend/routers/medication.py`](backend/routers/medication.py)
* **Bug:** The API call executes `asyncio.gather(..., return_exceptions=True)`. However, if an exception is raised, it gets returned as an exception object instead of a list. The code checks `isinstance(rxnorm_results, list)` but silently swallows the error if it fails, leaving the user with zero error feedback.

### 6. 🟡 Missing Rate Limiting and Caching
* **Location:** `backend/routers/`
* **Bug:** The endpoints that query third-party APIs (openFDA, Google Places) have no caching or rate-limiting system. This makes the app highly vulnerable to denial-of-service and API quota exhaustion.

---

## 🔧 Getting Started & Installation

### 1. System Prerequisites
* **Python 3.11+**
* **Node.js 18+**
* **Tesseract OCR (v5.0+)** $\rightarrow$ [Download UB-Mannheim Builds](https://github.com/UB-Mannheim/tesseract/wiki) (Add to Windows `PATH` variable).

### 2. Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Create your .env file
Copy-Item .env.example .env

# Run FastAPI
uvicorn main:app --reload --port 8000
```
* **API Documentation (Swagger UI):** `http://localhost:8000/docs`

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
* **Web UI Access:** `http://localhost:5173`

### 4. Environment File Configuration (`backend/.env`)
```env
# Infermedica API credentials (Triage)
INFERMEDICA_APP_ID=your_id
INFERMEDICA_APP_KEY=your_key

# Google Places API key (Doctor Directory)
GOOGLE_PLACES_API_KEY=your_google_places_api_key

# App Environment Settings
DEBUG=true
FRONTEND_ORIGIN=http://localhost:5173
```

---

<div align="center">

**Built with ❤️ for accessible healthcare.**

*Prahari — Your Health Guardian*

</div>
