"""
Prahari — Triage Router
=======================
FastAPI router endpoints for:
    POST /triage/assess   — Symptom triage via Infermedica

Source: FEATURES_AND_STRUCTURE.md §2.3 (Triage)
        IMPLEMENTATION_PLAN.md Phase 5
"""

import logging

from fastapi import APIRouter, HTTPException, Depends

from middleware.rate_limiter import limit_assess
from models.triage import TriageRequest, TriageResponse
from services.triage_service import assess_symptoms

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/assess",
    response_model=TriageResponse,
    dependencies=[Depends(limit_assess)],
    summary="Assess symptoms for urgency level",
    description=(
        "Submits a free-text symptom description to the Infermedica Clinical NLP API. "
        "Returns an urgency level (safe/moderate/critical), a recommendation, "
        "and a list of top probable conditions. Returns a mock response if "
        "Infermedica credentials are not configured."
    ),
)
async def assess_triage(body: TriageRequest) -> TriageResponse:
    """
    Two-stage Infermedica pipeline:
        1. /parse — NLP symptom extraction
        2. /triage — Evidence-based urgency assessment

    Returns a standardised TriageResponse with urgency level and
    actionable next steps for the patient.
    """
    logger.info("Triage request: age=%d sex=%s text='%s…'", body.age, body.sex, body.symptoms[:50])

    try:
        result = await assess_symptoms(body.symptoms, body.sex, body.age)
        return TriageResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
