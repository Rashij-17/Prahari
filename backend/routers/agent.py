"""
Prahari — Core Agent Router
============================
FastAPI router for the Prahari intelligence engine.

POST /agent/chat

This is the primary AI routing layer. It uses the Prahari Core Agent
system prompt to classify every incoming user query into one of three
intents:

    - "triage"    → symptom analysis; automatically runs assess_symptoms()
                    and embeds the full triage result (one-trip design)
    - "directory" → healthcare facility search; extracts location metadata
                    for the frontend to call /directory/search
    - "unknown"   → fallback for unrecognised queries

The endpoint returns pure, minified JSON — no markdown, no prose.
The frontend can parse and render this directly into UI components
(progress bars, warning banners, directory cards).
"""

import json
import logging
import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types

from core.config import settings
from services.triage_service import assess_symptoms

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Prahari Core Agent — System Prompt
# This is passed as Gemini's system_instruction so it governs every response
# without contaminating the user-facing conversation history.
# ---------------------------------------------------------------------------

_PRAHARI_AGENT_SYSTEM_PROMPT = """
You are the core intelligence engine for "Prahari," a professional, high-accuracy health sentinel and triage application. Your objective is to analyze user input and route it to either the Triage Analyzer or the Medical Directory system.

CRITICAL INSTRUCTION: You must strictly output in minified JSON format only. Do not include markdown formatting, code blocks (like ```json), conversational filler, or pleasantries. Your entire response must be a single, valid JSON object.

# RULE 1: CONSERVATIVE MEDICAL TRIAGE

If the user provides symptoms or asks for medical analysis, act as a deterministic triage analyzer. Do not provide a definitive medical diagnosis. Calculate the probabilities of the top 3 most likely conditions based on standard clinical presentations.

Your output MUST map exactly to this schema:
{
"intent": "triage",
"data": {
"alert_title": "Select one: 'Self-Care', 'See a Doctor Soon', 'Urgent Care', or 'Emergency Room'",
"alert_description": "Provide a sterile, clinical, 2-sentence recommendation advising the user on what to do next based on the alert_title.",
"conditions": [
{
"name": "Condition Name 1",
"probability_percentage": integer (0-100)
},
{
"name": "Condition Name 2",
"probability_percentage": integer (0-100)
},
{
"name": "Condition Name 3",
"probability_percentage": integer (0-100)
}
]
}
}

# RULE 2: MEDICAL DIRECTORY ROUTING

If the user is looking for a physical healthcare facility (e.g., "Find a hospital near me", "Where is a clinic?", "I need a pharmacy"), extract the geographical intent so the backend can query the Overpass API. If the user does not specify a location in their prompt, you must ask for it.

Your output MUST map exactly to this schema:
{
"intent": "directory",
"data": {
"facility_type": "Select one: 'hospital', 'clinic', 'pharmacy', 'doctors'",
"location_provided_by_user": boolean,
"extracted_location_name": "Name of city/area if provided, otherwise null",
"system_message": "If location_provided_by_user is false, provide a short string asking the user for their location. If true, return null."
}
}

# RULE 3: FALLBACK / UNKNOWN

If the query is neither a symptom check nor a directory request, return this structure:
{
"intent": "unknown",
"data": {
"system_message": "I am Prahari's core agent. Please describe your symptoms for triage or ask to find a nearby medical facility."
}
}
""".strip()

# ---------------------------------------------------------------------------
# Static fallback (used when Gemini is unavailable)
# ---------------------------------------------------------------------------

_FALLBACK_UNKNOWN = {
    "intent": "unknown",
    "data": {
        "system_message": (
            "I am Prahari's core agent. "
            "Please describe your symptoms for triage or ask to find a nearby medical facility."
        )
    }
}


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AgentChatRequest(BaseModel):
    query: str


class AgentChatResponse(BaseModel):
    intent: str
    data: Any
    # triage_result is only populated when intent == "triage" and the
    # backend has completed the full assess_symptoms() pipeline.
    triage_result: Any = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_gemini_configured() -> bool:
    return bool(
        settings.gemini_api_key
        and "your_gemini_api_key" not in settings.gemini_api_key
        and settings.gemini_api_key.strip() != ""
    )


async def _call_gemini_agent(query: str) -> dict:
    """
    Call Gemini with the Prahari Core Agent system prompt and return
    the parsed JSON response dict.
    Raises ValueError on empty / unparseable response.
    """
    def _sync():
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=query,
            config=types.GenerateContentConfig(
                system_instruction=_PRAHARI_AGENT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,   # Low temperature for deterministic routing
            ),
        )
        if response and response.text:
            return json.loads(response.text)
        raise ValueError("Empty response from Gemini agent")

    return await asyncio.to_thread(_sync)


def _map_alert_title_to_prahari_schema(agent_data: dict) -> dict:
    """
    Map the agent's alert_title string to the urgency_level / urgency_label /
    urgency_color fields that the existing TriagePage UX expects, and convert
    probability_percentage integers → float probabilities (0.0–1.0).
    This lets the frontend reuse its existing UrgencyResult component directly.
    """
    title_map = {
        "Self-Care": ("safe",     "Self-Care Recommended",              "safe"),
        "See a Doctor Soon": ("moderate", "See a Doctor Soon",          "moderate"),
        "Urgent Care": ("moderate", "Urgent Care Needed",               "moderate"),
        "Emergency Room": ("critical", "Go to Emergency Room Now",      "critical"),
    }
    alert_title = agent_data.get("alert_title", "See a Doctor Soon")
    urgency_level, urgency_label, urgency_color = title_map.get(
        alert_title, ("moderate", alert_title, "moderate")
    )

    conditions = [
        {
            "name": c.get("name", "Unknown"),
            "probability": round(c.get("probability_percentage", 10) / 100, 3),
            "urgency": urgency_level,
        }
        for c in agent_data.get("conditions", [])
    ]

    return {
        "urgency_level":  urgency_level,
        "urgency_label":  urgency_label,
        "urgency_color":  urgency_color,
        "recommendation": agent_data.get("alert_description", ""),
        "conditions":     conditions,
        "risk_factors":   [],
        "is_mock":        False,
        "mock_notice":    "",
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/chat",
    response_model=AgentChatResponse,
    summary="Prahari Core Agent — intent routing",
    description=(
        "Sends a free-text query to the Prahari intelligence engine. "
        "The agent classifies the query as 'triage', 'directory', or 'unknown' "
        "and returns a strict JSON payload the frontend can render directly. "
        "For triage intent, the full symptom assessment is embedded in the response."
    ),
)
async def agent_chat(body: AgentChatRequest) -> AgentChatResponse:
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    logger.info("Agent chat query: '%s…'", body.query[:80])

    # ── Step 1: Route via Gemini agent ──────────────────────────────────────
    agent_json: dict = _FALLBACK_UNKNOWN

    if _is_gemini_configured():
        try:
            agent_json = await _call_gemini_agent(body.query.strip())
            logger.info("Agent routing result: intent=%s", agent_json.get("intent"))
        except Exception as exc:
            logger.warning("Gemini agent call failed: %s — using fallback.", exc)
            agent_json = _FALLBACK_UNKNOWN
    else:
        logger.info("Gemini not configured — returning unknown fallback.")

    intent = agent_json.get("intent", "unknown")
    agent_data = agent_json.get("data", {})

    # ── Step 2: For triage intent, run the full assess_symptoms pipeline ─────
    # One-trip design: the frontend gets everything in a single call.
    triage_result = None
    if intent == "triage":
        try:
            triage_result = await assess_symptoms(
                symptom_text=body.query.strip(),
                sex="male",    # Default; agent prompt doesn't extract demographics
                age=30,        # Default; agent prompt doesn't extract age
            )
            logger.info(
                "Triage pipeline completed: level=%s",
                triage_result.get("urgency_level", "unknown"),
            )
        except Exception as exc:
            logger.warning("triage pipeline failed in agent endpoint: %s", exc)
            # Fall back to mapping the agent's own triage data
            triage_result = _map_alert_title_to_prahari_schema(agent_data)

    return AgentChatResponse(
        intent=intent,
        data=agent_data,
        triage_result=triage_result,
    )
