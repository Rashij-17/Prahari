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
from typing import Optional

import httpx

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
