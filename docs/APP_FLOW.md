# Prahari — Application Flow & User Journeys

This document details the screen flows, state transitions, and user journeys across mobile and desktop views in Prahari (MedLens).

---

## 1. Landing & Navigation Flow

Prahari uses a single-page Dashboard shell. Navigation dynamically shifts viewports based on device layout:

```
                      [ App Launch ]
                            │
                            ▼
                  [ HomePage Dashboard ]
                            │
        ┌───────────────────┼───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
 [ Scanner Page ]    [ Medications ]     [ Triage Page ]     [ Directory ]
  - Camera View       - Search input      - Symptom check     - Nearby map
  - File Upload       - Quick searches    - Urgency meter     - Specialist lists
```

---

## 2. Visual Scanner & Lookup Journey

This journey demonstrates how the Visual Scanner coordinates with the Drug Intelligence database:

```
[ Scanner Page ] ──► [ Active Camera ] ──► [ Off-Screen Canvas ] ──► [ Results Panel ]
                         - Reticle guide       - base64 JPEG          - Refined chips
                         - Capture trigger     - Process loading      - Auto-search trigger
```

### 2.1 Scanner Flow Steps
1. **Camera Permission:** User navigates to `/scanner`. The app requests rear-facing camera access.
2. **Alignment:** User aligns the medication label within the SVG dotted bounding box.
3. **Capture:** Tapping the capture button grabs the canvas frame, converts it to base64, halts the camera feed, and launches the `/scan/process` POST request.
4. **Candidates Output:** The results screen shows the extracted words. Clicking any of the drug chips auto-routes the user to the Medications page and searches for that drug.

---

## 3. Symptom Triage & Provider Referral Journey

This journey coordinates symptom checking with nearby clinic navigation:

```
[ Triage Page ] ──► [ Symptom Input ] ──► [ Urgency Assessment ] ──► [ Specialist Link ]
                         - Text query         - Red/Amber modal        - Map routing
                         - SVG body diagram   - Recommendation         - Places list
```

### 3.1 Triage Flow Steps
1. **Symptom Log:** User types their symptom in plain language or clicks regions of the SVG anatomical body diagram to pre-fill symptom variables.
2. **Assessment:** Frontend sends symptom parameters to `/triage/assess`.
3. **Triage Level Check:**
   - If **Critical (Emergency):** Renders a non-dismissible red warning box instructing the user to call emergency services (`112`).
   - If **Moderate / Routine:** Displays calculated condition probabilities and suggests a medical specialty (e.g., *Cardiologist*, *Neurologist*).
4. **Specialist Lookup:** Tapping the directory lookup button routes the user to the Directory page with the specialty pre-selected, calling the Google Places API for geolocated clinics.
