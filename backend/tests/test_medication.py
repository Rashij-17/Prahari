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
    assert data["generic_name"] == "Paracetamol"
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
    mocker.patch("routers.medication.query_local_indian_db", return_value=[])
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


def test_normalize_comp():
    from routers.medication import normalize_comp
    assert normalize_comp("  Amoxycillin   (500mg)  ") == "amoxycillin (500mg)"
    assert normalize_comp("") == ""


def test_parse_pack_size_units():
    from routers.medication import parse_pack_size_units
    assert parse_pack_size_units("strip of 10 tablets") == 10
    assert parse_pack_size_units("bottle of 100 ml Syrup") == 100
    assert parse_pack_size_units("strip of 6 tablets") == 6
    assert parse_pack_size_units("some text") == 1
    assert parse_pack_size_units("") == 1


def test_find_jan_aushadhi_alternative():
    from routers.medication import find_jan_aushadhi_alternative
    # Test matching Paracetamol (650mg) which is seeded in the database
    alt = find_jan_aushadhi_alternative("Paracetamol (650mg)", "")
    assert alt is not None
    assert alt["generic_name"] == "Paracetamol 650mg Generic"
    assert alt["price"] > 0
    
    # Test mismatch
    assert find_jan_aushadhi_alternative("Unknown Chemical", "") is None


def test_get_medication_profile_with_savings(mocker):
    # Mock NLM / FDA so we don't hit external APIs
    mocker.patch("routers.medication.resolve_name_to_rxcui", return_value="161")
    mock_profile = {
        "brand_name": "Dolo 650",
        "generic_name": "Paracetamol",
        "manufacturer": "Micro Labs Ltd.",
        "product_type": "Analgesic",
        "route": ["ORAL"],
        "rxcui": ["161"],
        "indications": "Fever",
        "dosage": "1 tab",
        "warnings": "Avoid alcohol",
        "has_boxed_warning": False,
        "urgency_level": "safe"
    }
    mocker.patch("routers.medication.get_drug_profile_by_rxcui", return_value=mock_profile)
    
    response = client.get("/medication/profile?name=dolo 650")
    assert response.status_code == 200
    data = response.json()
    assert data["brand_name"] == "Dolo 650"
    # Dolo 650 has Paracetamol (650mg) composition, which should match the seeded generic alternative
    assert "generic_alternative" in data
    assert data["generic_alternative"] is not None
    assert data["generic_alternative"]["generic_name"] == "Paracetamol 650mg Generic"
    assert data["generic_alternative"]["savings_percentage"] > 0

