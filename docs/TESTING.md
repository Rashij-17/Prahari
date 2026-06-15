# Prahari — Testing Documentation & Code Samples

This manual details the testing suite configuration, test directory layout, and mock behaviors used to ensure the reliability of Prahari's visual scanner, medication APIs, and symptom triage.

---

## 1. Testing Stack & Commands

| Scope | Tooling | Run Command |
| :--- | :--- | :--- |
| **Backend Unit & Routes** | *(planned)* `pytest` + `pytest-asyncio` | *(not set up yet)* |
| **Backend Coverage** | *(planned)* `pytest-cov` | *(not set up yet)* |
| **Frontend Unit** | *(planned)* `Vitest` + React Testing Library | *(not set up yet)* |
| **Frontend Coverage** | *(planned)* `Vitest` coverage | *(not set up yet)* |

---

## 2. Backend Test Suites (Code Samples)

To verify the endpoints and OpenCV preprocessors without hitting third-party rate limits, the backend uses mocked API clients. Below are representative test cases:

### 2.1 Testing the OCR Text Refiner (`tests/test_ocr.py`)
```python
import pytest
from utils.text_refiner import refine_ocr_output, _strip_noise, _apply_substitutions

def test_strip_noise():
    raw = "Metformin @1000mg !!!"
    cleaned = _strip_noise(raw)
    assert "@" not in cleaned
    assert "!" not in cleaned
    assert "Metformin 1000mg" in cleaned

def test_apply_substitutions():
    # Test OCR correction table rules
    assert _apply_substitutions("arnoxicillin") == "amoxicillin"  # rn -> m
    assert _apply_substitutions("hydrochloricle") == "hydrochloride"  # suffix correction
    assert _apply_substitutions("l0mg") == "10mg"  # l -> 1 in dosage context

def test_refine_ocr_output():
    raw_ocr = "Rx Only\nBatch: 10293\nMetformin Hydrochloride 500mg\nStore below 25C"
    candidates = refine_ocr_output(raw_ocr)
    assert len(candidates) > 0
    assert "Metformin" in candidates[0]
```

### 2.2 Testing FastAPI Routes with Mocked Services (`tests/test_medication.py`)
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_get_medication_profile_success(mocker):
    # Mock RxNorm resolver to bypass external web queries
    mocker.patch(
        "routers.medication.resolve_name_to_rxcui",
        return_value="104494"
    )
    
    # Mock openFDA data mapper
    mock_profile = {
        "brand_name": "Tylenol",
        "generic_name": "Acetaminophen",
        "manufacturer": "McNeil Consumer",
        "product_type": "Human OTC Drug",
        "route": ["oral"],
        "rxcui": ["104494"],
        "indications": "Pain relief",
        "dosage": "Take 1-2 tablets every 4 hours",
        "warnings": "Do not exceed 4000mg daily",
        "boxed_warning": "",
        "contraindications": "Severe liver disease",
        "has_boxed_warning": False,
        "urgency_level": "safe"
    }
    mocker.patch(
        "routers.medication.get_drug_profile_by_rxcui",
        return_value=mock_profile
    )

    response = client.get("/medication/profile?name=tylenol")
    assert response.status_code == 200
    data = response.json()
    assert data["generic_name"] == "Acetaminophen"
    assert data["urgency_level"] == "safe"
```

---

## 3. Frontend Component Testing (`src/__tests__/CameraScanner.test.jsx`)

Component integration tests verify that layout phases switch accurately on user interaction:

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CameraScanner from '../components/scanner/CameraScanner.jsx'

// Mock the API client module
vi.mock('../services/api.js', () => ({
  processFrame: vi.fn().mockResolvedValue({
    raw_text: "Acetaminophen 500mg",
    candidates: ["Acetaminophen"],
    word_count: 2,
    psm_used: 6,
    processing_note: "Success"
  })
}))

describe('CameraScanner Component Integration', () => {
  it('renders the idle state and transitions to camera mode', async () => {
    render(<CameraScanner />)
    
    // 1. Verify idle card is visible
    expect(screen.getByText('Ready to scan')).toBeInTheDocument()
    
    const startBtn = screen.getByRole('button', { name: /start camera/i })
    
    // Mock getUserMedia API
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      })
    }

    // 2. Trigger camera start
    fireEvent.click(startBtn)
    
    // 3. Verify video preview viewfinder mounts
    await waitFor(() => {
      expect(screen.getByLabelText('Camera viewfinder')).toBeInTheDocument()
    })
  })
})
```
