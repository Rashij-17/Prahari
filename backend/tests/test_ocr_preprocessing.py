import base64
import numpy as np
import cv2
import pytest
from services.multimodal_ocr_service import _preprocess_handwriting

def test_preprocess_handwriting_success():
    # 1. Create a dummy gray/color image using numpy (100x100 pixels)
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    # Draw a white line representing "handwriting"
    cv2.line(img, (10, 50), (90, 50), (255, 255, 255), 2)
    
    # 2. Encode to base64
    _, encoded = cv2.imencode(".jpg", img)
    b64_data = base64.b64encode(encoded.tobytes()).decode("utf-8")
    
    # 3. Process with base64 data URI prefix
    prefix_payload = f"data:image/jpeg;base64,{b64_data}"
    result = _preprocess_handwriting(prefix_payload)
    
    assert result.startswith("data:image/jpeg;base64,")
    clean_b64 = result.split(",", 1)[1]
    decoded = base64.b64decode(clean_b64)
    assert len(decoded) > 0
    
    # Verify we can decode it back to an image
    np_arr = np.frombuffer(decoded, dtype=np.uint8)
    processed_img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
    assert processed_img is not None
    assert processed_img.shape == (100, 100)

def test_preprocess_handwriting_no_prefix():
    img = np.zeros((50, 50, 3), dtype=np.uint8)
    _, encoded = cv2.imencode(".jpg", img)
    b64_data = base64.b64encode(encoded.tobytes()).decode("utf-8")
    
    result = _preprocess_handwriting(b64_data)
    assert not result.startswith("data:")
    decoded = base64.b64decode(result)
    assert len(decoded) > 0

def test_preprocess_handwriting_invalid_b64():
    # Invalid base64 or corrupt payload should return the input unchanged or handle gracefully
    invalid_payload = "this-is-not-valid-base64!!!"
    result = _preprocess_handwriting(invalid_payload)
    # Should fall back to returning input without crashing
    assert result == invalid_payload
