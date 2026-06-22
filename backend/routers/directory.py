"""
Prahari — Directory Router
==========================
FastAPI router endpoints for:
    POST /directory/search  — Nearby provider search via OSM / Google Places
    GET  /directory/geocode — Convert a location name to lat/lng (OSM Nominatim)

Source: FEATURES_AND_STRUCTURE.md §2.4 (Directory)
        IMPLEMENTATION_PLAN.md Phase 5
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, Depends, Query

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
        "Searches OSM/Google Places for nearby doctors, clinics, and hospitals "
        "within the specified radius. Returns provider summaries sorted by "
        "distance. Returns demo results if all live searches fail."
    ),
)
async def search_directory(body: DirectoryRequest) -> DirectoryResponse:
    """
    OSM Overpass → Google Places → Mock fallback.
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


@router.get(
    "/geocode",
    summary="Convert a location name to lat/lng coordinates",
    description=(
        "Uses OpenStreetMap Nominatim (free, no API key) to resolve a place "
        "name into latitude/longitude. Used by the Prahari Agent to convert "
        "extracted location names into coordinates for directory searches."
    ),
)
async def geocode_location(
    location: str = Query(..., description="Place name to geocode, e.g. 'Connaught Place, Delhi'"),
) -> dict:
    """
    Geocode a location string using OSM Nominatim.
    Returns { lat, lng, display_name } or raises 404 if not found.
    """
    if not location or not location.strip():
        raise HTTPException(status_code=400, detail="Location query must not be empty.")

    logger.info("Geocoding location: '%s'", location)

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "Prahari-Health-App/1.0 (health-sentinel)"}
        ) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": location.strip(),
                    "format": "json",
                    "limit": "1",
                    "addressdetails": "1",
                },
                timeout=8.0,
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            raise HTTPException(
                status_code=404,
                detail=f"Location '{location}' could not be resolved. Please be more specific (e.g. 'Bandra, Mumbai')."
            )

        best = results[0]
        return {
            "lat":          float(best["lat"]),
            "lng":          float(best["lon"]),
            "display_name": best.get("display_name", location),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Geocoding failed for '%s': %s", location, exc)
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {exc}") from exc

