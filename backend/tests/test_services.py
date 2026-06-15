import pytest
import httpx
import numpy as np
import cv2
import pytesseract
from unittest.mock import MagicMock

from core.config import settings
from services import (
    rxnorm_service,
    openfda_service,
    directory_service,
    triage_service,
    ocr_service,
)

# ---------------------------------------------------------------------------
# RxNorm Service Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rxnorm_resolve_name_cache_hit():
    # Pre-populate cache
    rxnorm_service._RESOLVE_CACHE["testdrug"] = "12345"
    res = await rxnorm_service.resolve_name_to_rxcui("testdrug")
    assert res == "12345"

@pytest.mark.asyncio
async def test_rxnorm_resolve_name_exact_match(mocker):
    # Clear cache
    rxnorm_service._RESOLVE_CACHE.clear()

    # Mock exact match response
    mock_response = {
        "idGroup": {
            "rxnormId": ["98765"]
        }
    }
    mocker.patch("services.rxnorm_service._get", return_value=mock_response)

    res = await rxnorm_service.resolve_name_to_rxcui("ExactDrug")
    assert res == "98765"
    assert rxnorm_service._RESOLVE_CACHE["exactdrug"] == "98765"

@pytest.mark.asyncio
async def test_rxnorm_resolve_name_approx_match(mocker):
    rxnorm_service._RESOLVE_CACHE.clear()

    # Mock exact match returning empty list, and approx match returning candidates
    mock_responses = [
        {"idGroup": {}}, # exact match empty
        {
            "approximateGroup": {
                "candidate": [{"rxcui": "11122"}]
            }
        }
    ]
    
    mock_get = mocker.patch("services.rxnorm_service._get")
    mock_get.side_effect = mock_responses

    res = await rxnorm_service.resolve_name_to_rxcui("ApproxDrug")
    assert res == "11122"
    assert rxnorm_service._RESOLVE_CACHE["approxdrug"] == "11122"

@pytest.mark.asyncio
async def test_rxnorm_resolve_name_failure(mocker):
    rxnorm_service._RESOLVE_CACHE.clear()
    mocker.patch("services.rxnorm_service._get", side_effect=Exception("API failure"))

    res = await rxnorm_service.resolve_name_to_rxcui("FailDrug")
    assert res is None
    assert rxnorm_service._RESOLVE_CACHE["faildrug"] is None

@pytest.mark.asyncio
async def test_rxnorm_get_details(mocker):
    mock_responses = [
        {"properties": {"name": "Test Ingredient", "tty": "IN"}},
        {"propConceptGroup": {"propConcept": [{"propValue": "Synonym 1"}, {"propValue": "Test Ingredient"}]}}
    ]
    mock_get = mocker.patch("services.rxnorm_service._get")
    mock_get.side_effect = mock_responses

    details = await rxnorm_service.get_drug_details_by_rxcui("123")
    assert details["name"] == "Test Ingredient"
    assert details["tty"] == "IN"
    assert "Synonym 1" in details["synonyms"]
    assert "Test Ingredient" not in details["synonyms"]

@pytest.mark.asyncio
async def test_rxnorm_search_drugs(mocker):
    mock_response = {
        "drugGroup": {
            "conceptGroup": [
                {
                    "tty": "IN",
                    "conceptProperties": [{"rxcui": "555", "name": "Aspirin", "synonym": "ASA"}]
                },
                {
                    "tty": "INVALID_TTY",
                    "conceptProperties": [{"rxcui": "666", "name": "Bad"}]
                }
            ]
        }
    }
    mocker.patch("services.rxnorm_service._get", return_value=mock_response)

    results = await rxnorm_service.search_drugs("aspirin")
    assert len(results) == 1
    assert results[0]["rxcui"] == "555"
    assert results[0]["name"] == "Aspirin"

# ---------------------------------------------------------------------------
# openFDA Service Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_openfda_get_profile_by_name_cache_hit():
    openfda_service._PROFILE_BY_NAME_CACHE["aspirin"] = {"brand_name": "Aspirin"}
    res = await openfda_service.get_drug_profile_by_name("aspirin")
    assert res == {"brand_name": "Aspirin"}

@pytest.mark.asyncio
async def test_openfda_get_profile_by_name_success(mocker):
    openfda_service._PROFILE_BY_NAME_CACHE.clear()

    mock_response = {
        "results": [{
            "openfda": {
                "brand_name": ["Bufferin"],
                "generic_name": ["Aspirin"],
                "manufacturer_name": ["Bristol-Myers"],
                "product_type": ["HUMAN OTC DRUG"],
                "route": ["ORAL"],
                "rxcui": ["1191"],
                "ndc": ["0003-1234"]
            },
            "indications_and_usage": ["For pain relief"],
            "dosage_and_administration": ["Take 1 tablet"],
            "warnings": ["Do not take if allergic"],
            "boxed_warning": ["Box warning text"]
        }]
    }
    mocker.patch("services.openfda_service._query_openfda", return_value=mock_response)

    profile = await openfda_service.get_drug_profile_by_name("Bufferin")
    assert profile is not None
    assert profile["brand_name"] == "Bufferin"
    assert profile["generic_name"] == "Aspirin"
    assert profile["has_boxed_warning"] is True
    assert profile["urgency_level"] == "critical"

@pytest.mark.asyncio
async def test_openfda_get_profile_by_rxcui(mocker):
    openfda_service._PROFILE_BY_RXCUI_CACHE.clear()

    mock_response = {
        "results": [{
            "openfda": {
                "generic_name": ["Aspirin"]
            },
            "warnings": ["Warning text"]
        }]
    }
    mocker.patch("services.openfda_service._query_openfda", return_value=mock_response)

    profile = await openfda_service.get_drug_profile_by_rxcui("1191")
    assert profile is not None
    assert profile["generic_name"] == "Aspirin"
    assert profile["has_boxed_warning"] is False
    assert profile["urgency_level"] == "moderate"

@pytest.mark.asyncio
async def test_openfda_search_drugs(mocker):
    mock_response = {
        "results": [{
            "openfda": {
                "brand_name": ["Advil"],
                "generic_name": ["Ibuprofen"]
            }
        }]
    }
    mocker.patch("services.openfda_service._query_openfda", return_value=mock_response)

    summaries = await openfda_service.search_drugs_openfda("advil")
    assert len(summaries) == 1
    assert summaries[0]["brand_name"] == "Advil"
    assert summaries[0]["generic_name"] == "Ibuprofen"

# ---------------------------------------------------------------------------
# Google Places Directory Service Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_directory_mock_fallback(monkeypatch):
    monkeypatch.setattr(settings, "google_places_api_key", "")
    res = await directory_service.search_providers(12.9716, 77.5946)
    assert res["is_mock"] is True
    assert len(res["providers"]) > 0

@pytest.mark.asyncio
async def test_directory_live_search(monkeypatch, mocker):
    monkeypatch.setattr(settings, "google_places_api_key", "valid_key")

    mock_response = {
        "status": "OK",
        "results": [{
            "geometry": {"location": {"lat": 12.9720, "lng": 77.5950}},
            "name": "Live Clinic",
            "vicinity": "100 MG Road",
            "rating": 4.6,
            "user_ratings_total": 45,
            "types": ["doctor", "health"],
            "opening_hours": {"open_now": True},
            "place_id": "live_001"
        }]
    }

    # Mock the http client
    mock_get = MagicMock()
    mock_get.status_code = 200
    mock_get.json.return_value = mock_response
    mocker.patch("httpx.AsyncClient.get", return_value=mock_get)

    res = await directory_service.search_providers(12.9716, 77.5946)
    assert res["is_mock"] is False
    assert res["total"] == 1
    assert res["providers"][0]["name"] == "Live Clinic"
    assert res["providers"][0]["distance_km"] > 0

# ---------------------------------------------------------------------------
# Infermedica Triage Service Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_triage_mock_fallback(monkeypatch):
    monkeypatch.setattr(settings, "infermedica_app_id", "")
    res = await triage_service.assess_symptoms("I have a headache")
    assert res["is_mock"] is True
    assert res["urgency_level"] == "moderate"

@pytest.mark.asyncio
async def test_triage_live_assessment(monkeypatch, mocker):
    monkeypatch.setattr(settings, "infermedica_app_id", "test_id")
    monkeypatch.setattr(settings, "infermedica_app_key", "test_key")

    # Mock NLP parse response
    mock_parse_response = MagicMock()
    mock_parse_response.status_code = 200
    mock_parse_response.json.return_value = {
        "mentions": [{"id": "s_21", "choice_id": "present"}]
    }

    # Mock Triage assessment response
    mock_triage_response = MagicMock()
    mock_triage_response.status_code = 200
    mock_triage_response.json.return_value = {
        "triage_level": "emergency",
        "conditions": [{"name": "Migraine", "probability": 0.75, "urgency": "moderate"}],
        "serious": []
    }

    mock_post = mocker.patch("httpx.AsyncClient.post")
    mock_post.side_effect = [mock_parse_response, mock_triage_response]

    res = await triage_service.assess_symptoms("I have severe head pain")
    assert res["is_mock"] is False
    assert res["urgency_level"] == "critical"
    assert res["conditions"][0]["name"] == "Migraine"

# ---------------------------------------------------------------------------
# OCR Service Tests
# ---------------------------------------------------------------------------

def test_ocr_decode_base64_image():
    # 1x1 pixel base64 transparent PNG
    base64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    img = ocr_service._decode_base64_image(base64_png)
    assert isinstance(img, np.ndarray)
    assert img.shape == (1, 1, 3)

    # Empty string should fail
    with pytest.raises((ValueError, cv2.error)):
        ocr_service._decode_base64_image("")

def test_ocr_process_image_frame(mocker):
    base64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    
    # Mock Tesseract OCR
    mocker.patch("pytesseract.image_to_string", return_value="Acetaminophen 500mg\nTake one tablet daily")

    res = ocr_service.process_image_frame(base64_png)
    assert res["raw_text"] == "Acetaminophen 500mg\nTake one tablet daily"
    assert "Acetaminophen" in res["candidates"]
    assert res["psm_used"] == 6

def test_ocr_process_image_frame_fallback_psm11(mocker):
    base64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    
    mock_tesseract = mocker.patch("pytesseract.image_to_string")
    mock_tesseract.side_effect = ["Sparse text", "Acetaminophen 500mg fallback"]

    res = ocr_service.process_image_frame(base64_png)
    assert res["psm_used"] == 11
    assert "Acetaminophen" in res["candidates"]

