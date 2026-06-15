# Prahari — Complete Project Blueprint

This document serves as the authoritative blueprint for Prahari (MedLens), consolidating the system boundaries, design choices, and core features of the sentinel health application.

---

## 1. Core Modules Specifications

Prahari contains four core functional modules. Their exact specifications and data lifecycles are mapped out below:

### 1.1 Visual Label Scanner
*   **Purpose:** Captures prescription label photos and extracts candidate terms.
*   **Technological Bounds:** Rear-camera selector, SVG guides, 1920x1080 canvas export, OpenCV greyscale/adaptive thresholding/deskewing, PyTesseract OCR (LSTM), and text correction heuristics.
*   **Reference Document:** See detailed layout under [FEATURES_AND_STRUCTURE.md](../FEATURES_AND_STRUCTURE.md#21-visual-label-scanner).

### 1.2 Drug Intelligence Engine
*   **Purpose:** Resolves extracted strings to verified concepts and clinical FDA details.
*   **Technological Bounds:** Async RxNorm fuzzy matching, synonym mappings, openFDA query triggers, and 3-tier drug interaction check charts.
*   **Reference Document:** See detailed layout under [FEATURES_AND_STRUCTURE.md](file:///d:/Prahari/FEATURES_AND_STRUCTURE.md#22-medication-demystification-engine).

### 1.3 Symptom & Triage Analyzer
*   **Purpose:** Parses symptom queries to suggest urgency levels.
*   **Technological Bounds:** Infermedica v3 NLP parser requests, age/sex factors, interactive anatomical SVG body diagram maps, and 5-level risk indicators.
*   **Reference Document:** See detailed layout under [FEATURES_AND_STRUCTURE.md](file:///d:/Prahari/FEATURES_AND_STRUCTURE.md#23-symptom--triage-analyzer).

### 1.4 Geographic Specialist Directory
*   **Purpose:** Locates nearby doctors based on geolocation.
*   **Technological Bounds:** Browser Geolocation API, Google Places Nearby Search, Haversine Distance computation, and tel-linked provider detail cards.
*   **Reference Document:** See detailed layout under [FEATURES_AND_STRUCTURE.md](file:///d:/Prahari/FEATURES_AND_STRUCTURE.md#24-geographic-specialist-directory).

---

## 2. Global Non-Goals

Prahari maintains strict ethical and legal boundaries:
1.  **No Clinical Diagnosis:** The app classifies urgency and suggests specialists; it **never** makes definitive diagnostic determinations.
2.  **No Prescription Generation:** It provides information about existing medications; it **never** suggests new prescription drugs.
3.  **No Persistent Records:** No database is instantiated. Captured frames, coordinates, and diagnostic strings are volatile and wiped immediately upon request completion.

---

## 3. Product Roadmap Timeline

```
 Phase 1: Core Setup  ──►  Phase 2: Sage UI  ──►  Phase 3: Scanner  ──►  Phase 4: Drug Intel  ──►  Phase 5: Triage  ──►  Phase 6: Deployment
    [ COMPLETE ]             [ COMPLETE ]        [ COMPLETE ]          [ COMPLETE ]           [ COMPLETE ]          [ IN PROGRESS ]
```

*   **Phase 1 & 2:** Established FastAPI backend configurations, React client layout structure, CSS variables, and layout routing.
*   **Phase 3 & 4:** Image capture canvas triggers, OpenCV preprocess services, RxNorm lookup mapping, and openFDA details rendering.
*   **Phase 5:** Triage Symptom NLP assessments, Places nearby search integrations, Haversine geo-sorting, and router splitting.
*   **Phase 6:** Response caching, API rate limiting, PWA manifests & offline service workers, and automated test suites.

