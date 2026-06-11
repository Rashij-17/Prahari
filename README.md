
# Prahari — MedLens

### *Medication Demystifier · Symptom Triage · Local Doctor Directory*

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenCV-4.9-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Status-Active%20Development-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Version-0.1.0-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/API-RxNorm%20%7C%20openFDA%20%7C%20Infermedica-purple?style=flat-square" />
</p>

<br/>

> **Prahari** (Sanskrit: प्रहरी) means *Guardian* or *Sentinel*.  
> This application stands watch over your health — decoding prescriptions, triaging symptoms, and connecting you to the right care.

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Core Features](#-core-features)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Data Privacy & Safety](#-data-privacy--safety)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🩹 Problem Statement

Medication non-adherence, misidentification of prescription labels, delayed triage decisions, and inaccessible specialist directories collectively represent one of the most **preventable categories of adverse health outcomes**.

| Gap | Problem | Prahari's Response |
|-----|---------|-------------------|
| 💊 **Medication Literacy** | Patients cannot decode chemical names, interactions, or dosage schedules from physical labels | Visual Label Scanner + Medication Demystification Engine |
| 🚨 **Triage Safety** | Non-clinicians cannot determine whether symptoms warrant emergency care or watchful waiting | Symptom & Triage Analyzer powered by Infermedica |
| 📍 **Provider Access** | Patients lack reliable, real-time local directories filtered by specialty and distance | Geographic Specialist Directory powered by Google Places API |

> In India alone, **55%+ of patients** in semi-urban and rural contexts cannot interpret pharmaceutical labels written in technical English nomenclature.

---

## ✨ Core Features

### 📸 1. Visual Label Scanner
Transforms a physical pharmaceutical label into a structured drug profile using a full computer vision pipeline.

- 🎥 **Live Camera Capture** — Rear-camera stream with scan-frame overlay guide
- 🔬 **OpenCV Image Pre-Processing** — Greyscale, adaptive thresholding, deskewing (±15°), and morphological opening
- 📝 **Tesseract OCR** — Dual-pass extraction with LSTM engine (`--oem 3`) for maximum pharmaceutical label accuracy
- 🔍 **Intelligent Text Refinement** — OCR correction lookups, noise stripping, candidate phrase extraction
- 📤 **File Upload Fallback** — Graceful static image upload when camera is unavailable

### 💊 2. Medication Demystification Engine
Takes raw chemical or brand-name drug strings and returns a comprehensive, patient-readable drug profile.

- 🔗 **RxNorm API** — Resolves drug names to canonical RxCUI identifiers with fuzzy matching
- 🏥 **openFDA Enrichment** — Extracts indications, dosage, contraindications, warnings, side effects, and storage
- ⚠️ **Drug Interaction Checker** — Pairwise interaction checks across your entire medication list with 3-tier severity classification:

  | Tier | Severity | Visual Treatment |
  |------|----------|-----------------|
  | T1 | 🔴 Critical | Full-bleed red alert banner |
  | T2 | 🟠 Moderate | Amber warning card |
  | T3 | 🟡 Minor | Teal informational chip |

### 🩺 3. Symptom & Triage Analyzer
Converts free-text symptom descriptions into structured triage assessments and urgency classifications.

- 🗣️ **Free-Text Symptom Input** — Plain language descriptions accepted
- 🧠 **Infermedica AI** — Differential generation and urgency classification via `/v3/diagnosis` + `/v3/triage`
- 🗺️ **Interactive SVG Body Diagram** — Tap anatomical regions to pre-seed symptom context
- 🚨 **5-Level Triage System**:

  | Urgency | Label | Action |
  |---------|-------|--------|
  | 🔴 CRITICAL | Emergency | Immediate emergency services modal |
  | 🔴 CRITICAL | Urgent Care | Emergency department within the hour |
  | 🟠 MODERATE | See a Doctor Today | Same-day appointment + local urgent care |
  | 🟡 ROUTINE | Schedule an Appointment | Standard GP referral |
  | 🟢 ROUTINE | Self-Care Advised | Self-management guidance shown |

### 📍 4. Geographic Specialist Directory
Live, filterable map and list view of nearby healthcare providers.

- 📡 **Browser Geolocation API** — High-accuracy positioning with postal code fallback
- 🗺️ **Google Places API** — Nearby search filtered by specialty, distance (1–25 km), and open-now status
- 📊 **Haversine Sorting** — Results sorted by computed distance from user
- 🏥 **Enriched Provider Cards** — Name, specialty, distance, rating, hours, phone (`tel:` linked), and directions

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER (React.js + Tailwind CSS)          │
│                                                                       │
│   ScannerView        TriageView        DirectoryView                 │
│   (Camera/Upload)    (Symptom Input)   (Map + List)                  │
│                                                                       │
│   ──────────────── React State / Context ─────────────────────────  │
│                         │  HTTPS / REST                              │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │   FastAPI Backend      │
              │   (Python 3.11+)       │
              │                        │
              │  POST /scan/process    │
              │  GET  /medication/...  │
              │  POST /triage/parse    │
              │  POST /triage/assess   │
              │  POST /directory/search│
              └───────────┬───────────┘
                          │
      ┌───────────────────┼────────────────────┐
      ▼                   ▼                    ▼
┌──────────┐    ┌──────────────────┐  ┌─────────────────┐
│ RxNorm   │    │  Infermedica API  │  │ Google Places   │
│ openFDA  │    │  (Diagnosis +     │  │ (Nearby Search  │
│          │    │   Triage)         │  │  + Details)     │
└──────────┘    └──────────────────┘  └─────────────────┘
```

**Vision Pipeline (within FastAPI):**
```
Camera JPEG → cv2.imdecode → Greyscale → Resize ×1.5 → Gaussian Blur
→ Adaptive Threshold → Deskew → Morph Opening → Tesseract OCR
→ Text Refinement → RxNorm Parallel Lookup → MedicationProfile JSON
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React.js | 18.3 | UI framework |
| React Router DOM | 6.23 | Client-side routing |
| Tailwind CSS | 3.4 | Utility-first styling |
| Vite | 5.2 | Build tool & dev server |
| HTML5 APIs | — | Camera (`getUserMedia`), Canvas, Geolocation |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.111 | REST API framework |
| Uvicorn | ≥0.30 | ASGI server |
| OpenCV | ≥4.9 | Image pre-processing |
| Tesseract / pytesseract | ≥0.3.13 | OCR engine |
| Pydantic | ≥2.10 | Data validation & serialisation |
| httpx | ≥0.27 | Async HTTP client |
| langdetect | 1.0.9 | Symptom input language detection |
| Pillow | ≥10.4 | Image handling |
| NumPy | ≥2.0 | Numerical computation |

### External APIs
| API | Provider | Usage |
|-----|---------|-------|
| RxNorm REST API | NLM / NIH | Drug name resolution, interaction IDs |
| openFDA Drug Labels | FDA | Clinical data enrichment |
| Infermedica v3 | Infermedica | Symptom parsing, diagnosis, triage |
| Google Places API | Google | Provider discovery & details |

---

## 📁 Project Structure

```
Prahari/
├── backend/                        # FastAPI application
│   ├── main.py                     # App entry point, CORS, router registration
│   ├── requirements.txt            # Python dependencies
│   ├── .env.example                # Environment variable template
│   ├── core/                       # App configuration & settings
│   ├── models/                     # Pydantic data models
│   │   ├── medication.py           # MedicationProfile, InteractionAlert
│   │   └── triage.py               # TriageResult, ProviderListing
│   ├── routers/                    # API route handlers
│   │   ├── vision.py               # POST /scan/process
│   │   ├── medication.py           # GET /medication/profile
│   │   └── phase5.py               # Triage & directory endpoints
│   ├── services/                   # Business logic layer
│   │   ├── vision_service.py       # OpenCV + Tesseract pipeline
│   │   ├── med_resolver_service.py # RxNorm + openFDA integration
│   │   ├── triage_service.py       # Infermedica integration
│   │   └── directory_service.py    # Google Places integration
│   ├── middleware/                 # CORS, logging middleware
│   └── utils/                     # Shared utilities (Haversine, OCR corrections)
│
├── frontend/                       # React.js application
│   ├── index.html                  # HTML entry point
│   ├── package.json                # Node dependencies
│   ├── vite.config.js              # Vite configuration
│   ├── tailwind.config.js          # Tailwind design tokens
│   └── src/
│       ├── main.jsx                # React root
│       ├── App.jsx                 # Router setup
│       ├── index.css               # Global styles & CSS variables
│       ├── pages/
│       │   ├── HomePage.jsx        # Landing page
│       │   ├── MedicationsPage.jsx # Label scanner + drug profile
│       │   ├── TriagePage.jsx      # Symptom input + triage results
│       │   └── DirectoryPage.jsx   # Map + provider list
│       ├── components/             # Reusable UI components
│       ├── hooks/                  # Custom React hooks
│       └── services/               # API client functions
│
├── FEATURES_AND_STRUCTURE.md       # Detailed product blueprint (v1.0.0)
├── IMPLEMENTATION_PLAN.md          # Technical implementation roadmap
├── push.ps1                        # Git push helper script
└── README.md                       # ← You are here
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

| Requirement | Minimum Version | Check Command |
|------------|----------------|---------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Tesseract OCR | 5.0+ | `tesseract --version` |
| Git | Any | `git --version` |

> **Windows:** Install Tesseract from [UB Mannheim Tesseract builds](https://github.com/UB-Mannheim/tesseract/wiki) and add it to your system `PATH`.

---

### Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
copy .env.example .env
# Edit .env and populate your API keys

# 5. Start the development server
uvicorn main:app --reload --port 8000
```

The FastAPI backend will be available at: **http://localhost:8000**  
Interactive API docs (Swagger UI): **http://localhost:8000/docs**

---

### Frontend Setup

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The React frontend will be available at: **http://localhost:5173**

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory based on `.env.example`:

```env
# ─── Infermedica Symptom Triage ────────────────────────────────────────
INFERMEDICA_APP_ID=your_infermedica_app_id_here
INFERMEDICA_APP_KEY=your_infermedica_app_key_here

# ─── Google Places (Doctor Directory) ──────────────────────────────────
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here

# ─── Application Settings ──────────────────────────────────────────────
DEBUG=false
FRONTEND_ORIGIN=http://localhost:5173
```

### How to obtain API keys:

| API | Registration Link | Notes |
|-----|------------------|-------|
| **Infermedica** | [infermedica.com](https://infermedica.com) | Free developer tier available |
| **Google Places** | [console.cloud.google.com](https://console.cloud.google.com) | Enable "Places API" in your project |
| **RxNorm** | *(No key required)* | Free public API by NIH |
| **openFDA** | *(No key required)* | Free public API by FDA |

> ⚠️ **Never commit your `.env` file to version control.** It is included in `.gitignore` by default.

---

## 📡 API Reference

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| `POST` | `/scan/process` | Process Base64 image, run OCR pipeline | `{ image_b64: string }` |
| `GET` | `/medication/profile` | Fetch drug profile from RxNorm + openFDA | `?drug_name=string` |
| `GET` | `/medication/interactions` | Check interactions between multiple drugs | `?rxcuis=id1+id2+...` |
| `POST` | `/triage/parse` | Parse free-text symptoms via Infermedica | `{ text, age, sex }` |
| `POST` | `/triage/assess` | Get triage level + specialist suggestions | `{ evidence[], age, sex }` |
| `POST` | `/directory/search` | Search nearby providers via Google Places | `{ lat, lng, specialty, radius }` |

Full interactive documentation available at `http://localhost:8000/docs` when the backend is running.

---

## 🛡️ Data Privacy & Safety

Prahari is built with **Privacy-by-Design** principles:

- 🚫 **No persistent storage** — Camera frames, OCR outputs, and symptom logs are **never stored** beyond a single request lifecycle.
- 🚫 **No PII collection** — Patient context (age, sex) is transmitted only for the duration of an API call and is not retained.
- 🚫 **No diagnosis** — Prahari triages and defers; it **never prescribes or diagnoses**.
- ✅ **Emergency escalation** — Critical triage results surface local emergency numbers immediately.
- ✅ **Authoritative data sources** — All clinical data comes from openFDA, RxNorm, and Infermedica — not proprietary models.

> 🔴 **Medical Disclaimer:** Prahari is a health information and triage aid tool. It does **not** replace professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions.

---

## 🎨 Design System

Prahari uses a carefully curated, clinically-inspired design system:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-sage` | `#7A9E87` | Primary brand accent, CTAs |
| `--color-teal` | `#2A7F8C` | Interactive elements, links |
| `--color-surface` | `#F7F5F0` | Warm off-white background |
| `--color-alert-critical` | `#C0392B` | Emergency alerts |
| `--color-alert-moderate` | `#D4860A` | Moderate warnings |
| `--color-alert-safe` | `#2E7D52` | Safe/routine indicators |

**Typography:** `DM Serif Display` (headings) · `Inter` (body/UI) · `IBM Plex Mono` (drug names/chemical)

**Dark Mode** is supported via `[data-theme="dark"]` CSS attribute on `<html>`, with WCAG AA contrast ratios maintained across all alert states.

---

## 🗺️ Roadmap

- [x] Project architecture & design system
- [x] FastAPI backend scaffolding (routers, models, services)
- [x] React frontend scaffolding (pages, components, routing)
- [x] OpenCV + Tesseract OCR pipeline
- [x] RxNorm + openFDA medication engine
- [ ] Infermedica triage integration (in progress)
- [ ] Google Places directory integration (in progress)
- [ ] Drug interaction checker UI
- [ ] Dark mode toggle
- [ ] PWA / mobile optimization
- [ ] v1.1: Google Translate integration for multilingual symptom input

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -m 'feat: add some feature'`
4. **Push** to the branch: `git push origin feature/your-feature-name`
5. **Open** a Pull Request

Please ensure your code follows the existing architecture patterns and that API keys are never committed.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ and a mission to make healthcare accessible.**

*Prahari — Your Health Guardian*

</div>
