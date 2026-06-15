import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_get_medication_profile_success(mocker):
    # Mock RxNorm resolver and openFDA database lookup
    mocker.patch(
        "routers.medication.resolve_name_to_rxcui",
        return_value="104494"
    )
    
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
    assert data["brand_name"] == "Tylenol"

def test_get_medication_profile_not_found(mocker):
    # Mock lookup failing
    mocker.patch(
        "routers.medication.resolve_name_to_rxcui",
        return_value=None
    )
    mocker.patch(
        "routers.medication.get_drug_profile_by_name",
        return_value=None
    )

    response = client.get("/medication/profile?name=unknown_drug")
    assert response.status_code == 404
    assert "No drug information found" in response.json()["detail"]

def test_search_medications_success(mocker):
    mock_rxnorm = [
        {"name": "Metformin 500mg", "rxcui": "860975", "synonym": "Glucophage", "tty": "SBD"}
    ]
    mock_openfda = [
        {
            "generic_name": "Metformin Hydrochloride",
            "brand_name": "Glucophage",
            "rxcui": ["860975"],
            "manufacturer": "Bristol-Myers Squibb",
            "route": ["oral"],
            "has_boxed_warning": True,
            "urgency_level": "safe"
        }
    ]

    mocker.patch("routers.medication.search_drugs", return_value=mock_rxnorm)
    mocker.patch("routers.medication.search_drugs_openfda", return_value=mock_openfda)

    response = client.get("/medication/search?q=metformin")
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "metformin"
    assert len(data["results"]) > 0
    # First result should match Metformin
    assert "Metformin" in data["results"][0]["name"]
