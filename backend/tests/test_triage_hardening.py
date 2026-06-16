import pytest
from unittest.mock import patch, AsyncMock
from services.triage_service import (
    _sanitize_and_validate_triage_response,
    assess_triage_chat
)
from pydantic import ValidationError

def test_sanitize_and_validate_question_normalization():
    # 1. Test "radio" gets normalized to "group_single"
    raw_radio = {
        "should_stop": False,
        "evidence": [],
        "question": {
            "type": "radio",
            "text": "Choose your primary symptom:",
            "items": [
                {"id": "s_headache", "name": "Headache", "choices": []}
            ]
        }
    }
    res = _sanitize_and_validate_triage_response(raw_radio)
    assert res["should_stop"] is False
    assert res["question"]["type"] == "group_single"
    assert res["question"]["items"][0]["id"] == "s_headache"

    # 2. Test "checkbox" gets normalized to "group_multiple"
    raw_check = {
        "should_stop": False,
        "evidence": [],
        "question": {
            "type": "checkbox",
            "text": "Do you have any of the following:",
            "items": [
                {"id": "s_fever", "name": "Fever", "choices": []}
            ]
        }
    }
    res = _sanitize_and_validate_triage_response(raw_check)
    assert res["question"]["type"] == "group_multiple"

    # 3. Test missing choices for a "single" type question gets populated with default choices
    raw_single_missing_choices = {
        "should_stop": False,
        "evidence": [],
        "question": {
            "type": "single",
            "text": "Are you experiencing chest pain?",
            "items": [
                {"id": "s_chest_pain", "name": "Chest Pain"} # choices missing
            ]
        }
    }
    res = _sanitize_and_validate_triage_response(raw_single_missing_choices)
    assert len(res["question"]["items"][0]["choices"]) == 3
    assert res["question"]["items"][0]["choices"][0]["id"] == "present"
    assert res["question"]["items"][0]["choices"][0]["label"] == "Yes"


def test_sanitize_and_validate_result_fallback():
    # Test that should_stop = True sanitizes missing triage_result fields
    raw_res = {
        "should_stop": True,
        "evidence": [],
        "triage_result": {
            # missing urgency_level and recommendations
            "conditions": []
        }
    }
    res = _sanitize_and_validate_triage_response(raw_res)
    assert res["should_stop"] is True
    assert res["triage_result"]["urgency_level"] == "moderate"
    assert res["triage_result"]["urgency_label"] == "🩺 Consult a Doctor"
    assert "professional" in res["triage_result"]["recommendation"]


@pytest.mark.asyncio
@patch("services.triage_service._run_gemini_triage")
@patch("services.triage_service._run_groq_triage")
@patch("services.triage_service._has_credentials", return_value=False)
async def test_assess_triage_chat_fallback_on_llm_malformation(mock_has_cred, mock_groq, mock_gemini):
    # Setup mock clients to be active so we enter Tier 2/3
    with patch("services.triage_service.settings") as mock_settings:
        mock_settings.gemini_api_key = "mock_gemini_key"
        mock_settings.gemini_model_name = "gemini-3.1-flash-lite"
        mock_settings.groq_api_key = "mock_groq_key"
        mock_settings.groq_model_name = "llama-3.3-70b-versatile"
        
        # Scenario: Gemini returns completely malformed JSON that fails validation
        mock_gemini.side_effect = ValueError("Empty/Invalid response")
        # Scenario: Groq returns completely garbage dictionary that fails validation
        mock_groq.return_value = {"garbage": "data"} # Missing should_stop, question, etc.
        
        # When calling assess_triage_chat, both Tier 2 and Tier 3 will fail/throw
        # and cascade down to Tier 4 (Deterministic Local Simulator fallback)
        res = await assess_triage_chat(evidence=[], sex="male", age=30, text="I have a headache")
        
        # Assert Tier 4 simulator successfully caught the fallbacks and returned valid structure
        assert res["should_stop"] is False
        assert "Fever" in res["question"]["items"][0]["name"]
        # Ensure evidence was populated by local simulator
        assert len(res["evidence"]) == 1
        assert res["evidence"][0]["id"] == "s_headache"
