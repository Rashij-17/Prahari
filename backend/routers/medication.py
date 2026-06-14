"""
Prahari — Medication Intelligence Router
=========================================
FastAPI router providing drug information endpoints for Phase 4.

Two-stage lookup pipeline:
    1. RxNorm API → resolve drug name to canonical RxCUI
    2. openFDA API → fetch full clinical label by RxCUI (or name as fallback)

Endpoints:
    GET  /medication/profile?name={drug_name}
         Full drug profile (indications, dosage, warnings, interactions)

    GET  /medication/search?q={query}&limit={n}
         Lightweight drug search across RxNorm + openFDA

Source: FEATURES_AND_STRUCTURE.md §2.2 (Drug Intelligence)
        IMPLEMENTATION_PLAN.md Phase 4
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from middleware.rate_limiter import limit_profile
from models.medication import DrugProfile, DrugSummary, MedicationSearchResponse
from services.rxnorm_service import resolve_name_to_rxcui, search_drugs
from services.openfda_service import (
    get_drug_profile_by_name,
    get_drug_profile_by_rxcui,
    search_drugs_openfda,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/profile",
    response_model=DrugProfile,
    dependencies=[Depends(limit_profile)],
    summary="Get full drug clinical profile",
    description=(
        "Two-stage pipeline: RxNorm resolves the drug name to an RxCUI, "
        "then openFDA returns the full FDA label data including indications, "
        "dosage, warnings, contraindications, and drug interactions."
    ),
)
async def get_medication_profile(
    name: str = Query(..., min_length=2, description="Drug name (generic or brand)"),
) -> DrugProfile:
    """
    Full drug lookup pipeline.

    Steps:
        1. Resolve name → RxCUI via RxNorm
        2. Fetch FDA label by RxCUI (preferred) or name (fallback)
        3. Return normalised DrugProfile

    Args:
        name: Generic or brand name (e.g. 'paracetamol', 'Tylenol', 'metformin')

    Returns:
        Full DrugProfile with all available clinical data.

    Raises:
        HTTPException 404: If no drug is found in any data source.
        HTTPException 503: If both external APIs are unreachable.
    """
    logger.info("Drug profile request: '%s'", name)

    profile = None

    # Stage 1: Resolve via RxNorm → openFDA
    rxcui = await resolve_name_to_rxcui(name)
    if rxcui:
        logger.info("RxCUI resolved: %s → %s", name, rxcui)
        profile = await get_drug_profile_by_rxcui(rxcui)

    # Stage 2: Fall back to direct openFDA name search
    if not profile:
        logger.info("RxCUI lookup failed — trying openFDA direct name search for '%s'", name)
        profile = await get_drug_profile_by_name(name)

    if not profile:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No drug information found for '{name}'. "
                "Check the spelling or try the generic name."
            ),
        )

    return DrugProfile(**profile)


@router.get(
    "/search",
    response_model=MedicationSearchResponse,
    summary="Search for medications by name",
    description=(
        "Returns lightweight drug summaries from RxNorm and openFDA "
        "matching the query string. Supports partial name input."
    ),
)
async def search_medications(
    q:     str = Query(..., min_length=2, description="Search query (min 2 characters)"),
    limit: int = Query(default=8, ge=1, le=20, description="Max results (1–20)"),
) -> MedicationSearchResponse:
    """
    Drug name search across RxNorm and openFDA.

    Args:
        q:     Search query string.
        limit: Maximum results to return (default 8, max 20).

    Returns:
        MedicationSearchResponse with merged and deduplicated results.
    """
    logger.info("Medication search: '%s' (limit=%d)", q, limit)

    # Query both sources concurrently
    rxnorm_results, fda_results = await asyncio.gather(
        search_drugs(q, max_results=limit),
        search_drugs_openfda(q, limit=limit),
        return_exceptions=True,
    )

    if isinstance(rxnorm_results, Exception):
        logger.error("RxNorm search failed during query '%s'", q, exc_info=rxnorm_results)
        rxnorm_results = []

    if isinstance(fda_results, Exception):
        logger.error("openFDA search failed during query '%s'", q, exc_info=fda_results)
        fda_results = []

    summaries: list[DrugSummary] = []
    seen_names: set[str] = set()

    # Add RxNorm results
    if isinstance(rxnorm_results, list):
        for r in rxnorm_results:
            key = (r.get("name") or "").lower()
            if key and key not in seen_names:
                seen_names.add(key)
                summaries.append(DrugSummary(
                    rxcui=r.get("rxcui"),
                    name=r.get("name", ""),
                    generic_name=r.get("name", ""),
                    brand_name=r.get("synonym", ""),
                    tty=r.get("tty", ""),
                ))

    # Add openFDA results (prefer if more detailed)
    if isinstance(fda_results, list):
        for r in fda_results:
            key = (r.get("generic_name") or r.get("brand_name") or "").lower()
            if key and key not in seen_names:
                seen_names.add(key)
                summaries.append(DrugSummary(
                    rxcui=r.get("rxcui", [None])[0] if r.get("rxcui") else None,
                    name=r.get("generic_name") or r.get("brand_name", ""),
                    brand_name=r.get("brand_name", ""),
                    generic_name=r.get("generic_name", ""),
                    manufacturer=r.get("manufacturer", ""),
                    route=r.get("route", []),
                    has_boxed_warning=r.get("has_boxed_warning", False),
                    urgency_level=r.get("urgency_level", "safe"),
                ))

    source = "combined" if summaries else "none"
    return MedicationSearchResponse(
        query=q,
        results=summaries[:limit],
        total=len(summaries),
        source=source,
    )
