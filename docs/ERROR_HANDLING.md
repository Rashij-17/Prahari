# Prahari — Error Handling & Exceptions Manual

This document details the classification, HTTP status mappings, and recovery behaviors for exceptions across the React client and FastAPI backend.

---

## 1. Error Taxonomy

Errors in Prahari are classified into four domains:

| Category | Source | Client Recovery Action |
| :--- | :--- | :--- |
| **CAMERA_ERROR** | Browser media devices | Inform user, disable viewfinder, mount File Upload Fallback dashboard. |
| **OCR_FAILURE** | Tesseract engine | Render warning chip: *"No text detected. Ensure lighting is clear."* |
| **API_TIMEOUT** | openFDA / RxNorm / Places | Show retry button, fall back to mock placeholder data if API keys are inactive. |
| **CORS_BLOCKED** | FastAPI origin settings | Block fetch requests and surface network connectivity warning modal. |

---

## 2. Backend HTTP Status Codes

The FastAPI backend maps execution exceptions to unified HTTP codes:

| HTTP Code | Trigger Context | JSON Response payload | Client Action |
| :--- | :--- | :--- | :--- |
| **400 Bad Request** | Empty Base64 image string, invalid image formats. | `{"detail": "Image payload is empty."}` | Toast warning popup. |
| **404 Not Found** | openFDA direct search returns zero matches. | `{"detail": "No drug information found for 'xyz'."}` | Prompt user to search generic name. |
| **422 Unprocessable** | Tesseract OCR extracts 0 characters. | `{"detail": "OCR processing failed: No text extracted."}` | Request user to re-align label. |
| **503 Service Unavailable** | External API endpoints (Infermedica, Google) timeout. | `{"detail": "Infermedica API is unreachable."}` | Toggle fallback mock modes automatically. |

---

## 3. Frontend Error Boundaries & Fallbacks

### 3.1 Camera Permission Fallback
If the user denies camera access, or if the device lacks a webcam, Prahari catches the error:

```javascript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
} catch (err) {
  // Capture error code and mount file selector fallback
  setPhase('upload')
}
```

### 3.2 Network Retry Buttons
Failed searches (due to temporary internet dropouts) display a card with the `Retry` and `Clear Search` buttons, allowing the patient to re-trigger API queries without reloading the application:

```javascript
<button className="btn-primary" onClick={handleSearch}>
  Retry Search
</button>
```
