import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import AsyncMock, MagicMock, patch
import json

client = TestClient(app)

# ---------------------------------------------------------------------------
# Test Triage Chatbot Endpoint
# ---------------------------------------------------------------------------

def test_triage_chat_initial_turn(mocker):
    # Test turn 1: empty evidence, free text.
    # Mock assess_triage_chat in triage_service
    mock_chat_result = {
        "should_stop": False,
        "evidence": [{"id": "s_headache", "choice_id": "present"}],
        "question": {
            "type": "single",
            "text": "Are you experiencing a fever or chills?",
            "items": [
                {
                    "id": "s_fever",
                    "name": "Fever",
                    "choices": [
                        {"id": "present", "label": "Yes"},
                        {"id": "absent", "label": "No"},
                        {"id": "unknown", "label": "Don't know"}
                    ]
                }
            ]
        }
    }
    mocker.patch(
        "routers.triage.assess_triage_chat",
        new_callable=AsyncMock,
        return_value=mock_chat_result
    )

    response = client.post(
        "/triage/chat",
        json={
            "evidence": [],
            "sex": "male",
            "age": 30,
            "text": "severe headache"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["should_stop"] is False
    assert data["evidence"][0]["id"] == "s_headache"
    assert "fever" in data["question"]["text"].lower()


def test_triage_chat_final_turn(mocker):
    # Test last turn: enough evidence -> triage result
    mock_chat_result = {
        "should_stop": True,
        "evidence": [
            {"id": "s_headache", "choice_id": "present"},
            {"id": "s_fever", "choice_id": "absent"}
        ],
        "triage_result": {
            "urgency_level": "safe",
            "urgency_label": "Self-Care",
            "urgency_color": "safe",
            "recommendation": "Rest and hydrate.",
            "conditions": [],
            "risk_factors": []
        }
    }
    mocker.patch(
        "routers.triage.assess_triage_chat",
        new_callable=AsyncMock,
        return_value=mock_chat_result
    )

    response = client.post(
        "/triage/chat",
        json={
            "evidence": [
                {"id": "s_headache", "choice_id": "present"}
            ],
            "sex": "male",
            "age": 30
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["should_stop"] is True
    assert data["triage_result"]["urgency_level"] == "safe"


# ---------------------------------------------------------------------------
# Test Multimodal OCR Fallback Pipeline
# ---------------------------------------------------------------------------

def test_multimodal_ocr_gemini_success(mocker):
    # Tier 1: Gemini succeeds
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps({
        "drugs": [
            {
                "brand_name": "Lipitor",
                "generic_name": "Atorvastatin",
                "dosage_strength": "10mg",
                "frequency": "once daily",
                "instructions": "at bedtime"
            }
        ],
        "patient_notes": "Take daily"
    })
    
    # Mock genai.Client
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.return_value = mock_gemini_response
    mocker.patch("services.multimodal_ocr_service.genai.Client", return_value=mock_genai_client)
    mocker.patch("services.multimodal_ocr_service.settings.gemini_api_key", "test_gemini_key")

    response = client.post(
        "/scan/process-multimodal",
        json={"image": "dummy_b64"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["drugs"]) == 1
    assert data["drugs"][0]["brand_name"] == "Lipitor"
    assert data["patient_notes"] == "Take daily"


def test_multimodal_ocr_groq_fallback(mocker):
    # Tier 1 fails, Tier 2 (Groq) succeeds
    mocker.patch("services.multimodal_ocr_service.settings.gemini_api_key", "test_gemini_key")
    mocker.patch("services.multimodal_ocr_service.settings.groq_api_key", "test_groq_key")
    
    # Force Gemini to fail
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini Quota Exceeded")
    mocker.patch("services.multimodal_ocr_service.genai.Client", return_value=mock_genai_client)

    # Mock Groq
    mock_groq_response = MagicMock()
    mock_groq_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "drugs": [
                        {
                            "brand_name": "Amoxil",
                            "generic_name": "Amoxicillin",
                            "dosage_strength": "500mg",
                            "frequency": "three times daily",
                            "instructions": "with food"
                        }
                    ],
                    "patient_notes": "Complete full course"
                })
            )
        )
    ]
    mock_groq_client = MagicMock()
    mock_groq_client.chat.completions.create.return_value = mock_groq_response
    mocker.patch("services.multimodal_ocr_service.Groq", return_value=mock_groq_client)

    response = client.post(
        "/scan/process-multimodal",
        json={"image": "dummy_b64"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["drugs"]) == 1
    assert data["drugs"][0]["brand_name"] == "Amoxil"
    assert "Complete full course" in data["patient_notes"]


def test_multimodal_ocr_tesseract_fallback(mocker):
    # Tier 1 and 2 fail, Tier 3 (Tesseract) succeeds
    mocker.patch("services.multimodal_ocr_service.settings.gemini_api_key", "test_gemini_key")
    mocker.patch("services.multimodal_ocr_service.settings.groq_api_key", "test_groq_key")
    
    # Force both Gemini and Groq to fail
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini Error")
    mocker.patch("services.multimodal_ocr_service.genai.Client", return_value=mock_genai_client)

    mock_groq_client = MagicMock()
    mock_groq_client.chat.completions.create.side_effect = Exception("Groq Error")
    mocker.patch("services.multimodal_ocr_service.Groq", return_value=mock_groq_client)

    # Mock Tesseract
    mock_tesseract_result = {
        "raw_text": "Metformin 500mg",
        "candidates": ["Metformin"],
        "word_count": 2,
        "psm_used": 6,
        "processing_note": "Local fallback complete"
    }
    mocker.patch(
        "services.multimodal_ocr_service.process_image_frame",
        return_value=mock_tesseract_result
    )

    response = client.post(
        "/scan/process-multimodal",
        json={"image": "dummy_b64"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["drugs"]) == 1
    assert data["drugs"][0]["brand_name"] == "Metformin"
    assert "Tesseract raw output" in data["patient_notes"]


@pytest.mark.asyncio
async def test_assess_triage_chat_gemini_fallback(mocker):
    # Tier 1 fails, Tier 2 (Gemini) succeeds
    mocker.patch("services.triage_service._has_credentials", return_value=False)
    mocker.patch("services.triage_service.settings.gemini_api_key", "test_gemini_key")
    mocker.patch("services.triage_service.settings.groq_api_key", "")
    
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps({
        "should_stop": False,
        "evidence": [{"id": "s_headache", "choice_id": "present"}],
        "question": {
            "type": "single",
            "text": "Do you have neck stiffness?",
            "items": [{"id": "s_418", "name": "Neck stiffness"}]
        },
        "triage_result": None
    })
    
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.return_value = mock_gemini_response
    mocker.patch("services.triage_service.genai.Client", return_value=mock_genai_client)
    
    from services.triage_service import assess_triage_chat
    res = await assess_triage_chat([], "male", 30, "severe headache")
    assert res["should_stop"] is False
    assert res["question"]["text"] == "Do you have neck stiffness?"


@pytest.mark.asyncio
async def test_assess_triage_chat_groq_fallback(mocker):
    # Tier 1 fails, Tier 2 (Gemini) fails, Tier 3 (Groq) succeeds
    mocker.patch("services.triage_service._has_credentials", return_value=False)
    mocker.patch("services.triage_service.settings.gemini_api_key", "test_gemini_key")
    mocker.patch("services.triage_service.settings.groq_api_key", "test_groq_key")
    
    # Gemini throws error
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini Error")
    mocker.patch("services.triage_service.genai.Client", return_value=mock_genai_client)
    
    # Mock Groq
    mock_groq_response = MagicMock()
    mock_groq_response.choices = [
        MagicMock(
            message=MagicMock(
                content=json.dumps({
                    "should_stop": True,
                    "evidence": [{"id": "s_headache", "choice_id": "present"}],
                    "question": None,
                    "triage_result": {
                        "urgency_level": "moderate",
                        "urgency_label": "Schedule Doctor",
                        "urgency_color": "moderate",
                        "recommendation": "Consult a doctor.",
                        "conditions": []
                    }
                })
            )
        )
    ]
    mock_groq_client = MagicMock()
    mock_groq_client.chat.completions.create.return_value = mock_groq_response
    mocker.patch("services.triage_service.Groq", return_value=mock_groq_client)
    
    from services.triage_service import assess_triage_chat
    res = await assess_triage_chat([], "male", 30, "severe headache")
    assert res["should_stop"] is True
    assert res["triage_result"]["urgency_level"] == "moderate"


@pytest.mark.asyncio
async def test_assess_triage_chat_simulator_fallback(mocker):
    # All fail, Tier 4 (Simulator) succeeds
    mocker.patch("services.triage_service._has_credentials", return_value=False)
    mocker.patch("services.triage_service.settings.gemini_api_key", "")
    mocker.patch("services.triage_service.settings.groq_api_key", "")
    
    from services.triage_service import assess_triage_chat
    res = await assess_triage_chat([], "male", 30, "severe headache")
    assert res["should_stop"] is False
    assert "fever" in res["question"]["text"].lower()

