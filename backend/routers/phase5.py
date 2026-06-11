"""
Prahari — Triage & Directory Router
=====================================
Phase 5 FastAPI router endpoints for:
    POST /triage/assess   — Symptom triage via Infermedica
    POST /directory/search — Nearby provider search via Google Places

Source: FEATURES_AND_STRUCTURE.md §2.3 (Triage), §2.4 (Directory)
        IMPLEMENTATION_PLAN.md Phase 5
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.triage_service import assess_symptoms
from services.directory_service import search_providers

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Triage Schemas
# ---------------------------------------------------------------------------

class TriageRequest(BaseModel):
    """Symptom triage input from the user."""
    symptoms:   str  = Field(..., min_length=5, description="Free-text symptom description")
    sex:        str  = Field(default="male",   description='"male" or "female"')
    age:        int  = Field(default=30,       ge=1, le=120, description="Patient age in years")


class ConditionResult(BaseModel):
    name:        str
    probability: float
    urgency:     str = ""


class TriageResponse(BaseModel):
    urgency_level:  str               # "safe" | "moderate" | "critical"
    urgency_label:  str               # Human-readable label
    urgency_color:  str               # Maps to CSS ribbon class
    recommendation: str               # What to do next
    conditions:     list[ConditionResult]
    risk_factors:   list = []
    is_mock:        bool = False
    mock_notice:    str  = ""


# ---------------------------------------------------------------------------
# Directory Schemas
# ---------------------------------------------------------------------------

class DirectoryRequest(BaseModel):
    """Provider search input."""
    lat:        float = Field(...,        description="User latitude")
    lng:        float = Field(...,        description="User longitude")
    specialty:  str   = Field(default="", description="Specialty filter (optional)")
    radius_km:  int   = Field(default=5,  ge=1, le=50)
    limit:      int   = Field(default=10, ge=1, le=20)


class ProviderResult(BaseModel):
    name:          str
    address:       str  = ""
    rating:        float = 0.0
    total_ratings: int   = 0
    types:         list[str] = []
    open_now:      bool | None = None
    place_id:      str  = ""
    phone:         str  = ""
    maps_url:      str  = ""
    distance_km:   float = 0.0
    is_mock:       bool  = False


class DirectoryResponse(BaseModel):
    providers:   list[ProviderResult]
    total:       int
    radius_km:   int
    is_mock:     bool = False
    mock_notice: str  = ""


# ---------------------------------------------------------------------------
# Triage Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/assess",
    response_model=TriageResponse,
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


# ---------------------------------------------------------------------------
# Directory Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/search",
    response_model=DirectoryResponse,
    summary="Find nearby healthcare providers",
    description=(
        "Searches Google Places for nearby doctors, clinics, and hospitals "
        "within the specified radius. Returns provider summaries sorted by "
        "distance. Returns demo results if Google Places API key is not set."
    ),
)
async def search_directory(body: DirectoryRequest) -> DirectoryResponse:
    """
    Google Places Nearby Search for healthcare providers.
    Results are sorted by distance (closest first).
    """
    logger.info("Directory search: (%.4f, %.4f) radius=%dkm specialty='%s'",
                body.lat, body.lng, body.radius_km, body.specialty)

    try:
        result = await search_providers(
            body.lat, body.lng,
            body.specialty, body.radius_km, body.limit
        )
        return DirectoryResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
