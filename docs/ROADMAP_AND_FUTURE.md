# Prahari — Future Feature Roadmap & Innovations

This document details the planned next-generation features for Prahari (MedLens), designed to solve accessibility and security challenges in Indian healthcare.

---

## 1. Planned Innovation Pipelines

### 1.1 Pill Fingerprint (Visual Drug Identifier)
*   **Concept:** Allows patients to photograph a loose tablet or capsule (outside its packaging) and identify it.
*   **Implementation:** 
    - Frontend camera grabs a macro shot of the tablet against a neutral background.
    - Backend preprocessor runs shape detection (circular, oval, capsule) and extracts the color hex codes and imprint texts.
    - Query matches parameters against the **NIH Pillbox Directory API** containing over 10,000 reference pill shapes and colors.
*   **Impact:** Life-saving for elderly patients who mix up pills in daily pillboxes.

### 1.2 Medication Schedule Guardian & AI Alerts
*   **Concept:** A local schedule planner that runs automated pairwise drug interaction alerts.
*   **Implementation:**
    - User logs active daily drugs (e.g. *Antacids* + *Fluoroquinolone Antibiotics*).
    - AI planner identifies scheduling windows (e.g. antacids decrease antibiotic absorption and must be spaced by at least 2 hours).
    - Registers browser **Push Notifications** via service worker schedules to remind users of staggered intakes.
*   **Impact:** Protects users from self-induced drug inactivation.

### 1.3 Multilingual Indian Languages Translator (OCR $\rightarrow$ Localized Text)
*   **Concept:** Translates extracted English chemical label details into localized Indian languages.
*   **Implementation:**
    - Detects input context.
    - Integrates the Google Translate API.
    - Converts indications, warnings, and dosages into **Hindi, Tamil, Telugu, Kannada, Bengali, and Marathi**.
*   **Impact:** Solves the core literacy gap for over 50% of the rural Indian population.

### 1.4 Counterfeit Drug Detector
*   **Concept:** Validates packaging numbers against official manufacturer registration databases.
*   **Implementation:**
    - Captures barcode numbers.
    - Queries the **openFDA National Drug Code (NDC) Directory**.
    - Compares manufacturer names, package sizes, and lot formatting rules to flag discrepancies.
*   **Impact:** Addresses the counterfeit drug market in tier-3 cities.

---

## 2. Quick Integration Roadmap

### 2.1 WhatsApp Pharmacy Order Link
*   **Concept:** One-click reordering of medications from local pharmacies.
*   **Implementation:**
    - Once a drug is scanned, the app renders a WhatsApp button.
    - Generates a pre-filled `wa.me` deep link: `https://wa.me/919999999999?text=Please+prepare+Metformin+500mg+x30+tablets+for+Ramesh+Kumar`.
*   **Impact:** Zero-friction ordering for non-technical users.

### 2.2 Emergency Red Button
*   **Concept:** Instantly share health profiles with emergency services.
*   **Implementation:**
    - If symptom triage flags a `Critical` status, a red button is rendered.
    - Generates a shareable card URL (encoded with transient URL parameters: age, active meds, symptoms) for paramedics.
*   **Impact:** Saves crucial minutes during ambulance coordination.
