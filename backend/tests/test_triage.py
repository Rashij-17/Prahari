import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_assess_triage_success(mocker):
    # Mock assess_symptoms response
    mock_result = {
        "urgency_level": "moderate",
        "urgency_label": "See Doctor",
        "urgency_color": "warning",
        "recommendation": "Consult a doctor within 24 hours.",
        "conditions": [
            {"name": "Migraine", "probability": 0.75, "urgency": "moderate"}
        ],
        "risk_factors": [],
        "is_mock": True,
        "mock_notice": "Demo response"
    }
    mocker.patch(
        "routers.triage.assess_symptoms",
        return_value=mock_result
    )

    response = client.post(
        "/triage/assess",
        json={"symptoms": "severe headache and vomiting", "sex": "female", "age": 28}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["urgency_level"] == "moderate"
    assert data["conditions"][0]["name"] == "Migraine"

def test_assess_triage_validation_error(mocker):
    # symptoms too short (less than 5 characters validation happens in Pydantic schema)
    response = client.post(
        "/triage/assess",
        json={"symptoms": "pain", "sex": "male", "age": 30}
    )
    assert response.status_code == 422
