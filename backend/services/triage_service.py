"""
Prahari — Symptom Triage Service (Infermedica Integration)
===========================================================
Interfaces with the Infermedica Clinical NLP API to:
    1. Parse free-text symptoms into structured medical concepts
    2. Run the evidence-based triage assessment algorithm
    3. Return an urgency level + actionable recommendation

Infermedica API Docs: https://developer.infermedica.com/
Free tier: 100 calls/day (sufficient for development and personal use).

API credentials are loaded from the .env file:
    INFERMEDICA_APP_ID=your_id
    INFERMEDICA_APP_KEY=your_key

If credentials are not set, the service returns a demo mock response
so the UI remains testable without API registration.
"""

import logging
import json
from typing import Optional

import httpx
from google import genai
from google.genai import types
from groq import Groq

from core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Infermedica API Configuration
# ---------------------------------------------------------------------------

_INFERMEDICA_BASE = "https://api.infermedica.com/v3"
_TIMEOUT = 12.0


def _has_credentials() -> bool:
    """Check if Infermedica API credentials are configured."""
    return bool(
        settings.infermedica_app_id and
        settings.infermedica_app_key and
        settings.infermedica_app_id != "your_infermedica_app_id_here"
    )


def _headers() -> dict:
    """Build the required Infermedica authentication headers."""
    return {
        "App-Id":       settings.infermedica_app_id,
        "App-Key":      settings.infermedica_app_key,
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Mock Response (used when no API key is configured)
# ---------------------------------------------------------------------------

_MOCK_TRIAGE_RESPONSE = {
    "urgency_level":   "moderate",
    "urgency_label":   "See a Doctor Soon",
    "urgency_color":   "moderate",
    "recommendation":  (
        "Based on your symptoms, a medical consultation within 24–48 hours "
        "is recommended. Monitor your symptoms and seek emergency care "
        "immediately if they worsen significantly."
    ),
    "conditions":  [
        {
            "name":        "Common Cold",
            "probability": 0.42,
            "urgency":     "low",
        },
        {
            "name":        "Influenza",
            "probability": 0.28,
            "urgency":     "moderate",
        },
        {
            "name":        "Sinusitis",
            "probability": 0.18,
            "urgency":     "low",
        },
    ],
    "risk_factors":    [],
    "is_mock":         True,
    "mock_notice":     (
        "⚠️ This is a demonstration result. Configure INFERMEDICA_APP_ID and "
        "INFERMEDICA_APP_KEY in your .env file to enable live triage analysis."
    ),
}


# ---------------------------------------------------------------------------
# Infermedica API Pipeline
# ---------------------------------------------------------------------------

async def _parse_symptoms(text: str) -> list[dict]:
    """
    Use Infermedica's NLP endpoint to parse free-text symptom description
    into structured symptom evidence objects.

    Args:
        text: Plain-language symptom description from the user.

    Returns:
        List of evidence objects: [{id, choice_id, initial}, ...]
    """
    payload = {
        "text":            text,
        "context":         [],
        "correct_spelling": True,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{_INFERMEDICA_BASE}/parse",
            json=payload,
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

    evidence = []
    for mention in data.get("mentions", []):
        evidence.append({
            "id":        mention["id"],
            "choice_id": mention.get("choice_id", "present"),
            "initial":   True,
        })

    logger.info("Infermedica NLP parsed %d symptoms from text.", len(evidence))
    return evidence


async def _run_triage(evidence: list[dict], sex: str, age: int) -> dict:
    """
    Submit parsed symptom evidence to the Infermedica /triage endpoint.

    Args:
        evidence: List of evidence objects from _parse_symptoms().
        sex:      "male" or "female"
        age:      Patient age in years.

    Returns:
        Raw Infermedica triage response dict.
    """
    payload = {
        "sex":      sex,
        "age":      {"value": age},
        "evidence": evidence,
        "extras":   {"disable_groups": True},
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{_INFERMEDICA_BASE}/triage",
            json=payload,
            headers=_headers(),
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()


def _normalise_triage(raw: dict) -> dict:
    """
    Normalise the raw Infermedica triage response into Prahari's
    standardised format for consistent frontend display.

    Urgency level mapping (Infermedica → Prahari):
        emergency_ambulance  → critical
        emergency            → critical
        consultation_24      → moderate
        consultation         → moderate
        self_care            → safe

    Args:
        raw: Raw /triage response from Infermedica.

    Returns:
        Normalised triage result dict.
    """
    triage_level = raw.get("triage_level", "consultation")

    _LEVEL_MAP = {
        "emergency_ambulance": ("critical",  "🚨 Seek Emergency Care Immediately",  "critical"),
        "emergency":           ("critical",  "🚨 Go to Emergency Room Now",          "critical"),
        "consultation_24":     ("moderate",  "⚠️ See a Doctor Within 24 Hours",      "moderate"),
        "consultation":        ("moderate",  "🩺 Schedule a Doctor Appointment",     "moderate"),
        "self_care":           ("safe",      "✅ Self-Care Recommended",              "safe"),
    }

    urgency_level, urgency_label, urgency_color = _LEVEL_MAP.get(
        triage_level, ("moderate", "🩺 Consult a Doctor", "moderate")
    )

    _RECOMMENDATIONS = {
        "critical": (
            "Your symptoms suggest a potentially serious condition. "
            "Please call the National Emergency Helpline (112) or Ambulance (102 / 108) "
            "immediately, or visit the nearest hospital emergency department. "
            "You can also reach the National Health Helpline at 1800-180-1104."
        ),
        "moderate": (
            "Your symptoms warrant medical evaluation. Please schedule an appointment "
            "with a local doctor within 24 hours. For medical guidance, you can also "
            "contact the National Health Helpline at 1800-180-1104. Monitor your symptoms "
            "and seek immediate emergency care (112) if they worsen rapidly."
        ),
        "safe": (
            "Your symptoms appear mild and can likely be managed at home with self-care. "
            "Rest, stay hydrated, and monitor your condition. For assistance, you can call "
            "the National Health Helpline at 1800-180-1104. Consult a doctor if symptoms "
            "persist or worsen."
        ),
    }

    conditions = [
        {
            "name":        c.get("name", "Unknown"),
            "probability": round(c.get("probability", 0), 3),
            "urgency":     c.get("urgency", ""),
        }
        for c in raw.get("conditions", [])[:5]   # top 5 conditions
    ]

    return {
        "urgency_level":  urgency_level,
        "urgency_label":  urgency_label,
        "urgency_color":  urgency_color,
        "recommendation": _RECOMMENDATIONS[urgency_level],
        "conditions":     conditions,
        "risk_factors":   raw.get("serious", []),
        "is_mock":        False,
        "mock_notice":    "",
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def assess_symptoms(
    symptom_text: str,
    sex: str = "male",
    age: int = 30,
) -> dict:
    """
    Main triage pipeline entry point.

    If Infermedica credentials are present:
        1. NLP parse symptom text → evidence list
        2. Submit to /triage → urgency level + conditions
        3. Return normalised result

    If credentials are not configured:
        Returns mock response so the UI remains functional.

    Args:
        symptom_text: Free-text symptom description.
        sex:          Patient biological sex ("male" | "female").
        age:          Patient age in years.

    Returns:
        Normalised triage result dict.
    """
    if not _has_credentials():
        logger.info("Infermedica credentials not configured — returning mock triage response.")
        return _MOCK_TRIAGE_RESPONSE

    try:
        evidence = await _parse_symptoms(symptom_text)

        if not evidence:
            # No recognisable symptoms — return safe default
            return {
                **_MOCK_TRIAGE_RESPONSE,
                "is_mock": False,
                "mock_notice": (
                    "No specific medical symptoms were recognised in your description. "
                    "Try describing your symptoms in plain terms (e.g. 'I have a headache and fever')."
                ),
                "urgency_level": "safe",
                "urgency_label": "No Symptoms Detected",
                "recommendation": "Please describe your symptoms more specifically and try again.",
            }

        raw = await _run_triage(evidence, sex, age)
        result = _normalise_triage(raw)
        logger.info("Triage complete: level=%s, conditions=%d", result["urgency_level"], len(result["conditions"]))
        return result

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise ValueError("Invalid Infermedica API credentials. Check your .env file.") from exc
        raise RuntimeError(f"Infermedica API error: {exc}") from exc
    except Exception as exc:
        logger.error("Triage service failed: %s", exc)
        raise RuntimeError(f"Triage assessment failed: {exc}") from exc


def _build_triage_prompt(evidence: list[dict], sex: str, age: int, text: Optional[str] = None) -> str:
    # Format evidence nicely
    evidence_str = ""
    for item in evidence:
        choice = item.get("choice_id", "unknown")
        if choice == "present":
            status = "Present"
        elif choice == "absent":
            status = "Absent"
        elif choice == "unknown":
            status = "Unknown"
        else:
            status = f"'{choice}'"
        evidence_str += f"- Symptom/Condition ID: '{item['id']}' is {status}\n"
        
    # If we have gathered 5 or more evidence items, force a final triage assessment.
    if len(evidence) >= 5:
        prompt = f"""You are a clinical triage chatbot.
Patient Context: Biological Sex: {sex}, Age: {age} years.
{f'Initial symptoms reported by patient: "{text}"' if text else ""}
Current Evidence Gathered So Far:
{evidence_str}

CRITICAL: You have gathered sufficient evidence (5 or more turns have occurred). You MUST complete the triage assessment now. Do not ask any more questions. Set 'should_stop': true, set 'question': null, and populate the 'triage_result' object.

Return a JSON object matching this schema exactly:
{{
  "should_stop": true,
  "evidence": [
     // Include all incoming evidence items. Keep their exact id and choice_id formats.
  ],
  "question": null,
  "triage_result": {{
    "urgency_level": "critical" | "moderate" | "safe",
    "urgency_label": "🚨 Seek Emergency Care Immediately" | "⚠️ See a Doctor Within 24 Hours" | "✅ Self-Care Recommended",
    "urgency_color": "critical" | "moderate" | "safe",
    "recommendation": "Detailed actionable clinical instructions. If critical, mention calling 112 / 102.",
    "conditions": [
      {{"name": "Condition Name", "probability": 0.45, "urgency": "critical" | "moderate" | "safe"}}
    ],
    "risk_factors": []
  }}
}}
Ensure the output is valid JSON and matches this schema.
"""
        return prompt
        
    prompt = f"""You are a clinical triage chatbot.
Patient Context: Biological Sex: {sex}, Age: {age} years.
{f'Initial symptoms reported by patient: "{text}"' if text else ""}
Current Evidence Gathered So Far:
{evidence_str if evidence_str else "- No follow-up evidence gathered yet"}

Your task is to either:
1. Ask the next logical follow-up question to help narrow down the diagnosis and assess urgency. Keep questions clear and friendly.
2. Or, if you have sufficient symptoms (usually after 3-5 turns, or immediately for severe red-flag conditions like chest pain, stroke symptoms, severe bleeding), complete the triage.

Return a JSON object matching this schema exactly:
{{
  "should_stop": boolean,
  "evidence": [
     // Include all incoming evidence items PLUS any new ones if relevant (e.g., if this is the first turn, add the initial symptom ID like '{{"id": "s_headache", "choice_id": "present"}}'). Keep their exact id and choice_id formats.
  ],
  "question": {{
    "type": "single",
    "text": "The question string to display to the user, e.g., 'Are you experiencing any shortness of breath?'",
    "items": [
      {{
        "id": "s_unique_id", // A descriptive string ID, e.g., 's_dyspnea'
        "name": "Shortness of breath",
        "choices": [
          {{"id": "present", "label": "Yes"}},
          {{"id": "absent", "label": "No"}},
          {{"id": "unknown", "label": "Don't know"}}
        ]
      }}
    ]
  }}, // Set question to null if should_stop is true
  "triage_result": {{
    "urgency_level": "critical" | "moderate" | "safe",
    "urgency_label": "🚨 Seek Emergency Care Immediately" | "⚠️ See a Doctor Within 24 Hours" | "✅ Self-Care Recommended",
    "urgency_color": "critical" | "moderate" | "safe",
    "recommendation": "Detailed actionable clinical instructions. If critical, mention calling 112 / 102.",
    "conditions": [
      {{"name": "Meningitis", "probability": 0.45, "urgency": "critical"}}
    ],
    "risk_factors": []
  }} // Set triage_result to null if should_stop is false
}}
Ensure the output is valid JSON and matches this schema.
"""
    return prompt


from models.triage import TriageChatResponse

def _sanitize_and_validate_triage_response(raw_data: dict) -> dict:
    """
    Sanitizes raw LLM triage responses to ensure they match our strict UI schema,
    and runs them through Pydantic validation.
    Raises ValueError/Pydantic errors if validation fails.
    """
    if not isinstance(raw_data, dict):
        raise ValueError("Raw triage response is not a JSON object")
        
    # 1. Base values
    should_stop = bool(raw_data.get("should_stop", False))
    raw_data["should_stop"] = should_stop
    
    if "evidence" not in raw_data or not isinstance(raw_data["evidence"], list):
        raw_data["evidence"] = []
        
    # 2. Handle should_stop = True (Triage Result validation)
    if should_stop:
        raw_data["question"] = None
        triage_res = raw_data.get("triage_result")
        if not isinstance(triage_res, dict):
            triage_res = {
                "urgency_level": "moderate",
                "urgency_label": "🩺 Consult a Doctor",
                "urgency_color": "moderate",
                "recommendation": "Please consult a healthcare professional. Monitor your symptoms.",
                "conditions": []
            }
        
        # Ensure critical keys exist
        triage_res["urgency_level"] = triage_res.get("urgency_level", "moderate")
        triage_res["urgency_label"] = triage_res.get("urgency_label", "🩺 Consult a Doctor")
        triage_res["urgency_color"] = triage_res.get("urgency_color", "moderate")
        triage_res["recommendation"] = triage_res.get("recommendation", "Please consult a healthcare professional.")
        
        if "conditions" not in triage_res or not isinstance(triage_res["conditions"], list):
            triage_res["conditions"] = []
        else:
            cleaned_conds = []
            for c in triage_res["conditions"]:
                if isinstance(c, dict) and "name" in c:
                    cleaned_conds.append({
                        "name": str(c["name"]),
                        "probability": float(c.get("probability", 0.1)),
                        "urgency": str(c.get("urgency", ""))
                    })
            triage_res["conditions"] = cleaned_conds
            
        if "risk_factors" not in triage_res or not isinstance(triage_res["risk_factors"], list):
            triage_res["risk_factors"] = []
            
        raw_data["triage_result"] = triage_res
        
    # 3. Handle should_stop = False (Question structure validation)
    else:
        raw_data["triage_result"] = None
        question = raw_data.get("question")
        if not isinstance(question, dict):
            raise ValueError("Missing question object when should_stop is False")
            
        # Sanitize text
        question["text"] = str(question.get("text", "Are you experiencing any other symptoms?"))
        
        # Normalize type
        q_type = str(question.get("type", "single")).lower()
        if q_type in ["radio", "select"]:
            q_type = "group_single"
        elif q_type in ["checkbox", "check"]:
            q_type = "group_multiple"
            
        if q_type not in ["single", "group_single", "group_multiple"]:
            q_type = "single"
        question["type"] = q_type
        
        # Sanitize items
        items = question.get("items")
        if not isinstance(items, list) or not items:
            items = [{
                "id": "s_general_followup",
                "name": "General follow-up",
                "choices": []
            }]
            
        cleaned_items = []
        for it in items:
            if not isinstance(it, dict):
                continue
            it_id = str(it.get("id", "s_symptom"))
            it_name = str(it.get("name", "Symptom"))
            
            # Extract choices
            choices = it.get("choices")
            if not isinstance(choices, list):
                choices = []
                
            # Populate standard choices for single type if missing
            if q_type == "single" and not choices:
                choices = [
                    {"id": "present", "label": "Yes"},
                    {"id": "absent", "label": "No"},
                    {"id": "unknown", "label": "Don't know"}
                ]
                
            cleaned_choices = []
            for ch in choices:
                if isinstance(ch, dict) and "id" in ch and "label" in ch:
                    cleaned_choices.append({
                        "id": str(ch["id"]),
                        "label": str(ch["label"])
                    })
                    
            it["choices"] = cleaned_choices
            cleaned_items.append({
                "id": it_id,
                "name": it_name,
                "choices": cleaned_choices
            })
            
        question["items"] = cleaned_items
        raw_data["question"] = question
        
    # Enforce Pydantic validation
    validated = TriageChatResponse.model_validate(raw_data)
    return validated.model_dump()


async def _run_gemini_triage(evidence: list[dict], sex: str, age: int, model_name: str, text: Optional[str] = None) -> dict:
    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = _build_triage_prompt(evidence, sex, age, text)
    
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )
    
    if response and response.text:
        return json.loads(response.text)
    raise ValueError("Empty response from Gemini")


async def _run_groq_triage(evidence: list[dict], sex: str, age: int, model_name: str, text: Optional[str] = None) -> dict:
    client = Groq(api_key=settings.groq_api_key)
    prompt = _build_triage_prompt(evidence, sex, age, text)
    
    response = client.chat.completions.create(
        model=model_name,
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
    )
    
    content = response.choices[0].message.content
    if content:
        return json.loads(content)
    raise ValueError("Empty response from Groq")


from core.models import TRIAGE_FALLBACK_CHAIN

async def assess_triage_chat(
    evidence: list[dict],
    sex: str,
    age: int,
    text: Optional[str] = None
) -> dict:
    """
    Multi-turn symptom check conversation dialog state driver.
    Runs a dynamic fallback pipeline based on TRIAGE_FALLBACK_CHAIN in core/models.py.
    """
    last_error = None
    current_evidence = list(evidence)
    
    for step in TRIAGE_FALLBACK_CHAIN:
        provider = step["provider"]
        model = step["model_name"]
        
        # --- Tier 1: Infermedica ---
        if provider == "infermedica":
            if _has_credentials():
                try:
                    logger.info("Attempting Triage Step: Infermedica")
                    # If text is provided (first turn), parse it first
                    if text and not current_evidence:
                        current_evidence = await _parse_symptoms(text)
                        if not current_evidence:
                            # Fallback question if NLP parsing fails to find symptoms
                            return _sanitize_and_validate_triage_response({
                                "should_stop": False,
                                "evidence": [],
                                "question": {
                                    "type": "single",
                                    "text": "Could you please describe your symptoms in another way? Or do you have a headache?",
                                    "items": [{
                                        "id": "s_headache",
                                        "name": "Headache",
                                        "choices": [
                                            {"id": "present", "label": "Yes"},
                                            {"id": "absent", "label": "No"},
                                            {"id": "unknown", "label": "Don't know"}
                                        ]
                                    }]
                                }
                            })

                    payload = {
                        "sex": sex,
                        "age": {"value": age},
                        "evidence": current_evidence,
                        "extras": {"disable_groups": True}
                    }
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{_INFERMEDICA_BASE}/diagnosis",
                            json=payload,
                            headers=_headers(),
                            timeout=_TIMEOUT,
                        )
                        response.raise_for_status()
                        data = response.json()
                        
                    should_stop = data.get("should_stop", False)
                    if len(current_evidence) >= 8:
                        should_stop = True
                        
                    if should_stop:
                        raw_triage = await _run_triage(current_evidence, sex, age)
                        normalised = _normalise_triage(raw_triage)
                        logger.info("Triage Step (Infermedica) completed.")
                        return _sanitize_and_validate_triage_response({
                            "should_stop": True,
                            "evidence": current_evidence,
                            "triage_result": normalised
                        })
                    else:
                        logger.info("Triage Step (Infermedica) proceeding to next question.")
                        return _sanitize_and_validate_triage_response({
                            "should_stop": False,
                            "evidence": current_evidence,
                            "question": data.get("question")
                        })
                except Exception as exc:
                    logger.warning("Triage Step (Infermedica) failed: %s. Proceeding to next step...", exc, exc_info=True)
                    last_error = exc
            else:
                logger.info("Triage Step (Infermedica) skipped: credentials not configured.")
                
        # --- Tier 2: Gemini ---
        elif provider == "gemini":
            is_gemini_configured = bool(
                settings.gemini_api_key and 
                "your_gemini_api_key" not in settings.gemini_api_key and
                settings.gemini_api_key.strip() != ""
            )
            if is_gemini_configured:
                try:
                    logger.info("Attempting Triage Step: Gemini (%s)", model)
                    raw_result = await _run_gemini_triage(current_evidence, sex, age, model, text)
                    result = _sanitize_and_validate_triage_response(raw_result)
                    logger.info("Triage Step (Gemini) succeeded.")
                    
                    # Update local current_evidence if it was seeded on first turn
                    if not current_evidence and result.get("evidence"):
                        current_evidence = result["evidence"]
                        
                    return result
                except Exception as exc:
                    logger.warning("Triage Step (Gemini) failed: %s. Proceeding to next step...", exc, exc_info=True)
                    last_error = exc
            else:
                logger.info("Triage Step (Gemini) skipped: GEMINI_API_KEY not configured.")
                
        # --- Tier 3: Groq ---
        elif provider == "groq":
            is_groq_configured = bool(
                settings.groq_api_key and 
                "your_groq_api_key" not in settings.groq_api_key and
                settings.groq_api_key.strip() != ""
            )
            if is_groq_configured:
                try:
                    logger.info("Attempting Triage Step: Groq (%s)", model)
                    raw_result = await _run_groq_triage(current_evidence, sex, age, model, text)
                    result = _sanitize_and_validate_triage_response(raw_result)
                    logger.info("Triage Step (Groq) succeeded.")
                    
                    # Update local current_evidence if it was seeded on first turn
                    if not current_evidence and result.get("evidence"):
                        current_evidence = result["evidence"]
                        
                    return result
                except Exception as exc:
                    logger.warning("Triage Step (Groq) failed: %s. Proceeding to next step...", exc, exc_info=True)
                    last_error = exc
            else:
                logger.info("Triage Step (Groq) skipped: GROQ_API_KEY not configured.")
                
        # --- Tier 4: Local Triage Simulator ---
        elif provider == "local" and model == "simulator":
            logger.info("Executing fail-safe Triage Step: Deterministic Local Simulator")
            try:
                if text and not current_evidence:
                    # Simple keywords mapping
                    keywords = {
                        "head": "s_headache",
                        "fever": "s_fever",
                        "cough": "s_cough",
                        "chest": "s_chest_pain",
                        "breath": "s_dyspnea"
                    }
                    seed_id = "s_headache"
                    for kw, s_id in keywords.items():
                        if kw in text.lower():
                            seed_id = s_id
                            break
                    current_evidence = [{"id": seed_id, "choice_id": "present"}]

                if len(current_evidence) <= 1:
                    return _sanitize_and_validate_triage_response({
                        "should_stop": False,
                        "evidence": current_evidence,
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
                    })
                elif len(current_evidence) == 2:
                    return _sanitize_and_validate_triage_response({
                        "should_stop": False,
                        "evidence": current_evidence,
                        "question": {
                            "type": "single",
                            "text": "Do you have difficulty breathing or shortness of breath?",
                            "items": [
                                {
                                    "id": "s_dyspnea",
                                    "name": "Difficulty breathing",
                                    "choices": [
                                        {"id": "present", "label": "Yes"},
                                        {"id": "absent", "label": "No"},
                                        {"id": "unknown", "label": "Don't know"}
                                    ]
                                }
                            ]
                        }
                    })
                else:
                    has_dyspnea = any(e["id"] == "s_dyspnea" and e["choice_id"] == "present" for e in current_evidence)
                    has_fever = any(e["id"] == "s_fever" and e["choice_id"] == "present" for e in current_evidence)
                    
                    mock_res = dict(_MOCK_TRIAGE_RESPONSE)
                    mock_res["is_mock"] = True
                    mock_res["mock_notice"] = "⚠️ Local Triage Simulator Fallback active."
                    
                    if has_dyspnea:
                        mock_res["urgency_level"] = "critical"
                        mock_res["urgency_label"] = "🚨 Seek Emergency Care Immediately"
                        mock_res["urgency_color"] = "critical"
                        mock_res["recommendation"] = (
                            "Difficulty breathing detected. Call the National Emergency Helpline (112) "
                            "or visit the nearest emergency room immediately."
                        )
                    elif has_fever:
                        mock_res["urgency_level"] = "moderate"
                        mock_res["urgency_label"] = "⚠️ See a Doctor Within 24 Hours"
                        mock_res["urgency_color"] = "moderate"
                        mock_res["recommendation"] = (
                            "Fever detected. Please consult a local healthcare provider within 24 hours "
                            "or contact the National Health Helpline at 1800-180-1104."
                        )
                    else:
                        mock_res["urgency_level"] = "safe"
                        mock_res["urgency_label"] = "✅ Self-Care Recommended"
                        mock_res["urgency_color"] = "safe"
                        mock_res["recommendation"] = (
                            "Your symptoms appear mild and can likely be managed at home with rest and "
                            "hydration. Monitor your condition closely."
                        )
                        
                    return _sanitize_and_validate_triage_response({
                        "should_stop": True,
                        "evidence": current_evidence,
                        "triage_result": mock_res
                    })
            except Exception as exc:
                logger.error("Simulator Triage failed: %s", exc, exc_info=True)
                last_error = exc

    # Ultimate fallback to prevent any unhandled error crashes
    logger.error("All configured Triage fallback steps failed.")
    return _sanitize_and_validate_triage_response({
        "should_stop": True,
        "evidence": current_evidence,
        "triage_result": {
            "urgency_level": "moderate",
            "urgency_label": "🩺 Consult a Doctor",
            "urgency_color": "moderate",
            "recommendation": f"All triage engines failed. Last error: {str(last_error)}. Please monitor symptoms and consult a doctor.",
            "conditions": []
        }
    })

