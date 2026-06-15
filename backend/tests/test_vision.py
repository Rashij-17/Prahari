import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_process_frame_success(mocker):
    # Mock process_image_frame
    mock_result = {
        "raw_text": "Metformin 500mg",
        "candidates": ["Metformin"],
        "word_count": 2,
        "psm_used": 6,
        "processing_note": "Success"
    }
    mocker.patch(
        "routers.vision.process_image_frame",
        return_value=mock_result
    )

    # Base64 image payload (dummy string)
    response = client.post(
        "/scan/process",
        json={"image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["raw_text"] == "Metformin 500mg"
    assert data["candidates"][0] == "Metformin"

def test_process_frame_empty_payload():
    response = client.post(
        "/scan/process",
        json={"image": ""}
    )
    assert response.status_code == 400
