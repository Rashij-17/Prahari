import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_search_directory_success(mocker):
    # Mock search_providers service call
    mock_result = {
        "providers": [
            {
                "name": "City Clinic",
                "address": "123 Main St",
                "phone": "+91-9999999999",
                "rating": 4.5,
                "distance_km": 1.2,
                "lat": 12.9716,
                "lng": 77.5946,
                "open_now": True
            }
        ],
        "total": 1,
        "radius_km": 5,
        "center_lat": 12.9716,
        "center_lng": 77.5946,
        "is_mock": True,
        "mock_notice": "Demo response"
    }
    mocker.patch(
        "routers.directory.search_providers",
        return_value=mock_result
    )

    response = client.post(
        "/directory/search",
        json={"lat": 12.9716, "lng": 77.5946, "radius_km": 5, "specialty": "clinic", "limit": 5}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["providers"]) == 1
    assert data["providers"][0]["name"] == "City Clinic"

def test_search_directory_validation_error():
    # Invalid lat/lng (e.g. missing required lat field)
    response = client.post(
        "/directory/search",
        json={"lng": 77.5946, "radius_km": 5}
    )
    assert response.status_code == 422
