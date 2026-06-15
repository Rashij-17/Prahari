# Prahari — Product Requirements Document (PRD)

**Version:** 1.0.0  
**Date:** June 2026  
**Status:** Approved for Build  
**Project Name:** Prahari — MedLens (*The Health Sentinel*)

---

## 1. Executive Summary & Vision

Prahari (Sanskrit: प्रहरी — *The Sentinel*) is a responsive Progressive Web App (PWA) built to bridge critical health literacy gaps for India's tier-2/3 and semi-urban populations. The app is designed to help patients demystify complex English pharmaceutical labels, triage symptoms using simple language, and easily find nearby care providers. 

The core mission is **accessibility, reassurance, and speed**. Every feature is tailored to be used in high-stress, low-connectivity situations, running on mid-to-low tier mobile hardware.

---

## 2. Problem Statement

Semi-urban and rural Indian healthcare consumers encounter three major barriers:

### 2.1 Low Medication Literacy
Over **55% of patients** in semi-urban and rural Indian contexts cannot interpret pharmaceutical labels. Labels are printed in small fonts and use complex chemical names (e.g., *"Metformin Hydrochloride 500mg"*) written in English. This frequently leads to accidental double-dosing, missed warning labels, and incorrect storage.

### 2.2 Triage Decision Paralysis
Patients and caregivers frequently struggle to determine if a symptom (e.g., severe abdominal pain, chest tightness, or a child's high fever) is a medical emergency requiring immediate hospitalization or a mild issue that can wait for a standard clinic visit.

### 2.3 Provider Access Barriers
When emergency or urgent care is required, finding a nearby specialist clinic or hospital that is open and has contact details is a high-friction process, especially under panic.

---

## 3. Target User Personas & Scenarios

### 3.1 Primary User: The Family Caregiver (Ramesh, 42)
*   **Profile:** Lives in a tier-2 city (e.g., Jhansi), runs a small business, uses a mid-range Android phone.
*   **Context:** Manages health tracking for his elderly parents, who take multiple medications for diabetes and high blood pressure.
*   **Pain Points:** Ramesh gets confused by brand names versus generic equivalents and worries that his parents might take overlapping medications from different doctors. He needs a quick way to scan a new bottle to understand what it does and check for interactions.

### 3.2 Secondary User: The Isolated Elder (Savitri, 65)
*   **Profile:** Lives alone in a semi-urban town, has limited English literacy, uses a basic smartphone.
*   **Context:** Takes chronic disease medications daily.
*   **Pain Points:** Savitri cannot read the tiny warning texts on pill containers. She needs an app that clearly translates clinical alerts, indications, and dosages into clean, high-contrast layouts.

---

## 4. Product Goals & Scope Boundaries

### 4.1 Product Goals (In-Scope)
*   **Authoritative Clinical Data:** All data must be fetched directly from official databases (openFDA, RxNorm, Infermedica). No proprietary AI hallucinations are permitted.
*   **High-Contrast Actionable UI:** Surface critical warnings (black box alerts, emergency triage levels) in bold color states that cannot be missed.
*   **Privacy-by-Design:** Collect zero personally identifiable information (PII). All user assets (captured images, symptom descriptions) must be processed in-memory and wiped immediately after the request lifecycle.
*   **Dual-Viewport Fluidity:** The app must be fully functional on mobile viewports (with bottom navigation bars) and desktop screens (dense grid controls).

### 4.2 Non-Goals (Out-of-Scope)
*   Prahari does **not** diagnose conditions or prescribe treatments. It only triages and maps options.
*   The app does **not** provide accounts, persistent user history, or cloud-based health records, which avoids database security vulnerabilities.

---

## 5. Feature Inventory & Functional Specifications

### 5.1 Visual Label Scanner
Provides a hands-free capture interface to read text from medicine packages:
*   **Rear-Camera Viewfinder:** Initiates the camera stream, drawing a 4:3 target viewport with a rounded SVG bounding frame.
*   **Image Enhancement Pipeline:** Greyscales, upscales by 1.5x, applies Gaussian Blur, deskews within a $\pm 15^\circ$ range, and performs morphological opening.
*   **Tesseract OCR:** Extracts characters using LSTM networks. Runs PSM 6 (uniform text blocks) with an automatic fallback to PSM 11 (sparse layout) if the token count is $< 20$.
*   **Pharma Refiner:** Wipes punctuation noise, applies pharmaceutical correction lookups (e.g., `"rn" -> "m"`, `"cl" -> "d"`), and filters out boilerplate words to isolate the top 5 drug candidates.
*   **File Upload:** Serves as a static fallback if camera permissions are blocked.

### 5.2 Drug Intelligence Engine
Demystifies chemical listings and warns of negative interactions:
*   **RxNorm Resolution:** Submits terms to RxNorm's fuzzy-search API. Converts brand or generic strings to standard RxCUI identifiers.
*   **openFDA Enrichment:** Fetches FDA drug labels mapping clinical parameters:
    *   *Indications:* What the medication treats.
    *   *Dosage:* Standard intake guidelines.
    *   *Warnings:* Critical usage parameters.
    *   *Contraindications:* When the drug must never be taken.
*   **3-Tier Drug Interaction Checker:** Compares the user's active medication list to flag cross-reactions:
    *   `T1 - Critical:` Full-bleed red alert banner.
    *   `T2 - Moderate:` Amber warning card.
    *   `T3 - Minor:` Informational teal chip.

### 5.3 Symptom & Triage Analyzer
Converts unstructured sentences into triage risk tiers:
*   **Free-Text Symptom Parser:** Processes plain descriptions (e.g., *"I have a sharp pain in my chest that radiates to my shoulder"*).
*   **Infermedica NLP mapping:** Identifies symptoms and feeds them to the differential diagnostic engine.
*   **5-Level Triage Output:**
    *   `🔴 CRITICAL - Emergency:` Prompt modal instructions to call emergency services (`112`).
    *   `🔴 CRITICAL - Urgent Care:` Advise visiting an ER within the hour.
    *   `🟠 MODERATE - See a Doctor Today:` Highlight local walk-in clinics.
    *   `🟡 ROUTINE - Schedule Appointment:` Link to standard local practitioners.
    *   `🟢 ROUTINE - Self-Care Advised:` Present validated self-management guidelines.

### 5.4 Geographic Specialist Directory
Locates nearby doctors and clinics:
*   **Browser Geolocation Integration:** Fetches high-accuracy latitude/longitude coordinates.
*   **Google Places Query:** Conducts a nearby search within a 1–25 km radius, filtered by the specialty matching the triage result.
*   **Haversine Distance Sorting:** Computes the direct path from the user's coordinates to each facility and displays them sorted closest-first.
*   **Enriched Provider Cards:** Renders clinic names, addresses, distance in kilometers, ratings, open-now status, phone links (`tel:` format), and direct navigation URLs.

---

## 6. Target Success Metrics

| Goal Area | Metric | Target Metric |
| :--- | :--- | :--- |
| **Scanner Performance** | OCR Character Accuracy | $\ge 90\%$ on flat, well-lit drug labels |
| **Scanner Performance** | Token Extraction Failure | $< 5\%$ of scans return zero text tokens |
| **Drug Search** | Query Resolution Latency | $< 1.2\text{s}$ to resolve RxNorm and openFDA profiles |
| **Triage Analyzer** | Symptom Map Accuracy | $\ge 85\%$ of inputs mapped to correct clinical terms |
| **Geo Directory** | Haversine Ordering | 100% correct sorting of closest locations |

---

## 7. Current Project Roadmap

```
Phase 1: Scaffolding ──► Phase 2: Sage UI ──► Phase 3: Scanner ──► Phase 4: Drug Intel ──► Phase 5: Triage ──► Phase 6: Security & Caching
    [ COMPLETE ]             [ COMPLETE ]        [ IN PROGRESS ]       [ IN PROGRESS ]        [ IN PROGRESS ]           [ PLANNED ]
```

- **Done:** Dashboard layout shell, Tailwind setup, FastAPI core servers, initial OpenCV/Tesseract backend routing.
- **In-Progress:** Connecting the scanner candidate chips to the MedicationsPage search, refining the Infermedica mock integration, resolving duplicate routing in `phase5.py`.
- **Planned:** Response caching decorators, rate-limiting middlewares, and complete unit testing coverage.
