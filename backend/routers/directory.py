"""
Prahari — Directory Router
==========================
FastAPI router endpoints for:
    POST /directory/search — Nearby provider search via Google Places

Source: FEATURES_AND_STRUCTURE.md §2.4 (Directory)
        IMPLEMENTATION_PLAN.md Phase 5
"""

import logging

from fastapi import APIRouter, HTTPException, Depends

from middleware.rate_limiter import InMemoryRateLimiter
from models.directory import DirectoryRequest, DirectoryResponse
from services.directory_service import search_providers

logger = logging.getLogger(__name__)

router = APIRouter()

# 10 requests per minute per IP — same as other external-API endpoints
limit_directory = InMemoryRateLimiter(requests_limit=10, window_seconds=60)


@router.post(
    "/search",
    response_model=DirectoryResponse,
    dependencies=[Depends(limit_directory)],
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
